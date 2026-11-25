import type { CustomerNoticeItem } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import type { SessionActor } from "../../middleware/auth";

function present(job: {
  id: string;
  type: CustomerNoticeItem["type"];
  subject: string;
  body: string;
  status: CustomerNoticeItem["status"];
  applicationId: string | null;
  recipientEmail: string;
  createdAt: Date;
  sentAt: Date | null;
  lastErrorCode: string | null;
  application: { applicationNo: string } | null;
}, includeError: boolean): CustomerNoticeItem {
  return {
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
    lastErrorCode: includeError ? job.lastErrorCode : null,
  };
}

export async function listOwnNotices(actor: SessionActor): Promise<CustomerNoticeItem[]> {
  const rows = await prisma.notificationJob.findMany({
    where: { recipientUserId: actor.id, type: { not: "PASSWORD_RESET" } },
    include: { application: { select: { applicationNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((job) => present(job, false));
}

export async function listStaffNotices(): Promise<CustomerNoticeItem[]> {
  const rows = await prisma.notificationJob.findMany({
    where: { applicationId: { not: null }, type: { not: "PASSWORD_RESET" } },
    include: { application: { select: { applicationNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((job) => present(job, true));
}
