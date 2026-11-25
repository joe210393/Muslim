import {
  CONTRACT_RENEWAL_WINDOW_DAYS,
  DEFAULT_MAIL_TEMPLATES,
  ErrorCodes,
  UserRole,
  daysUntilContractExpiry,
  isContractRenewalDue,
  isMailTemplateKey,
  renewalNotice,
  type MailSendInput,
  type MailTemplateView,
  type MailTemplateWrite,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { getEnv } from "../../config/env";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import { assertFeature } from "../platform/access";
import { resolveMail } from "../platform/system-connection";
import { deliverNotification } from "./mailer";

async function ensureMailTemplates() {
  const existing = new Set((await prisma.mailTemplate.findMany({ select: { key: true } })).map((item) => item.key));
  const missing = DEFAULT_MAIL_TEMPLATES.filter((item) => !existing.has(item.key));
  if (!missing.length) return;
  await prisma.mailTemplate.createMany({
    data: missing.map((item) => ({ key: item.key, subject: item.subject, body: item.body })),
    skipDuplicates: true,
  });
}

export async function loadMailTemplates(): Promise<Array<{ key: string; subject: string; body: string }>> {
  await ensureMailTemplates();
  return prisma.mailTemplate.findMany({ select: { key: true, subject: true, body: true } });
}

export async function listMailTemplates(actor: SessionActor): Promise<MailTemplateView[]> {
  await assertFeature(actor, "users.manage");
  await ensureMailTemplates();
  const rows = await prisma.mailTemplate.findMany();
  return DEFAULT_MAIL_TEMPLATES.map((item) => {
    const saved = rows.find((row) => row.key === item.key);
    return { ...item, subject: saved?.subject ?? item.subject, body: saved?.body ?? item.body, version: saved?.version ?? 1 };
  });
}

export async function saveMailTemplate(actor: SessionActor, key: string, input: MailTemplateWrite): Promise<MailTemplateView> {
  await assertFeature(actor, "users.manage");
  if (!isMailTemplateKey(key)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這一種通知");
  await ensureMailTemplates();
  const current = await prisma.mailTemplate.findUnique({ where: { key } });
  if (!current || current.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "內容已被更新，請重新載入");
  const saved = await prisma.mailTemplate.update({
    where: { key },
    data: { subject: input.subject, body: input.body, version: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "MAIL_TEMPLATE_UPDATE",
      entityType: "MailTemplate",
      entityId: key,
      requestId: crypto.randomUUID(),
      safeChanges: { key },
    },
  });
  const draft = DEFAULT_MAIL_TEMPLATES.find((item) => item.key === key)!;
  return { ...draft, subject: saved.subject, body: saved.body, version: saved.version };
}

export async function sendManualMail(actor: SessionActor, input: MailSendInput): Promise<{ count: number; failed: number; local: boolean }> {
  await assertFeature(actor, "users.manage");
  const recipients = await prisma.user.findMany({
    where: {
      role: UserRole.APPLICANT,
      isActive: true,
      ...(input.audience === "one" ? { id: input.userId } : {}),
    },
    select: { id: true, email: true },
  });
  if (!recipients.length) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "沒有可寄送的業者");
  const batch = crypto.randomUUID();
  const ids: string[] = [];
  for (const user of recipients) {
    const job = await prisma.notificationJob.create({
      data: {
        dedupeKey: `manual:${batch}:${user.id}`,
        type: "MANUAL",
        subject: input.subject,
        body: input.body,
        recipientUserId: user.id,
        recipientEmail: user.email,
        status: "PENDING",
      },
    });
    ids.push(job.id);
  }
  const env = getEnv();
  let failed = 0;
  for (const id of ids) {
    await deliverNotification(env, id);
    const job = await prisma.notificationJob.findUnique({ where: { id }, select: { status: true } });
    if (job?.status !== "SENT") failed += 1;
  }
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "MAIL_SEND",
      entityType: "NotificationJob",
      entityId: batch,
      requestId: batch,
      safeChanges: { audience: input.audience, count: ids.length, failed },
    },
  });
  const local = (await resolveMail(env)).local;
  return { count: ids.length, failed, local };
}

export async function listOrganizationNotices(actor: SessionActor, organizationId: string) {
  await assertFeature(actor, "users.manage");
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  const rows = await prisma.notificationJob.findMany({
    where: { recipientUser: { organizationId }, type: { not: "PASSWORD_RESET" } },
    include: { application: { select: { applicationNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((job) => ({
    id: job.id,
    type: job.type,
    subject: job.subject || "案件通知",
    body: job.body || "這是較早的通知紀錄，沒有留下信件本文。",
    status: job.status,
    applicationId: job.applicationId,
    applicationNo: job.application?.applicationNo ?? null,
    recipientEmail: job.recipientEmail,
    createdAt: job.createdAt.toISOString(),
    sentAt: job.sentAt ? job.sentAt.toISOString() : null,
    lastErrorCode: job.lastErrorCode,
  }));
}

export async function ensureRenewalNotices(): Promise<void> {
  const setting = await prisma.operationSetting.findUnique({ where: { id: "default" } }).catch(() => null);
  const reminderDays = setting?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const templates = await loadMailTemplates().catch(() => undefined);
  const contracts = await prisma.contractRecord.findMany({
    where: { status: "SIGNED", signedAt: { not: null } },
    include: { organization: { select: { organizationName: true, users: { where: { role: UserRole.APPLICANT, isActive: true }, select: { id: true, email: true } } } } },
  });
  const env = getEnv();
  for (const contract of contracts) {
    if (!contract.signedAt || !isContractRenewalDue(contract.signedAt.toISOString(), new Date(), reminderDays)) continue;
    const letter = renewalNotice({
      contractNo: contract.contractNo,
      organizationName: contract.organization.organizationName,
      daysLeft: daysUntilContractExpiry(contract.signedAt.toISOString()),
      reminderDays,
      templates,
    });
    for (const user of contract.organization.users) {
      const dedupeKey = `renewal:${contract.id}:${contract.signedAt.toISOString()}:${user.id}`;
      const existing = await prisma.notificationJob.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
      if (existing?.status === "SENT" || existing?.status === "MOCKED") continue;
      const job = existing
        ? await prisma.notificationJob.update({ where: { id: existing.id }, data: { status: "PENDING", subject: letter.subject, body: letter.body } })
        : await prisma.notificationJob.create({
            data: {
              dedupeKey,
              type: letter.type,
              subject: letter.subject,
              body: letter.body,
              recipientUserId: user.id,
              recipientEmail: user.email,
              status: "PENDING",
            },
          });
      await deliverNotification(env, job.id);
    }
  }
}
