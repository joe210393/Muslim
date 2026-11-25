import { NotificationJobStatus } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import nodemailer from "nodemailer";
import type { Env } from "../../config/env";
import { resolveMail } from "../platform/system-connection";

export async function deliverNotification(env: Env, jobId: string, consoleDetail?: string): Promise<void> {
  const job = await prisma.notificationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === NotificationJobStatus.SENT || job.status === NotificationJobStatus.MOCKED) return;
  const emailSetting = await prisma.integrationSetting.findUnique({ where: { key: "email" } }).catch(() => null);
  if (emailSetting && !emailSetting.enabled) {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: NotificationJobStatus.FAILED, attemptCount: { increment: 1 }, lastErrorCode: "INTEGRATION_DISABLED" },
    });
    return;
  }
  const mail = await resolveMail(env);
  if (!mail.enabled) {
    console.info(
      `[mail:console] type=${job.type} to=${job.recipientEmail} status=MOCKED ${consoleDetail ? `detail=${consoleDetail}` : ""}（未真正寄出）`,
    );
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: NotificationJobStatus.MOCKED, attemptCount: { increment: 1 }, lastErrorCode: "MAIL_DRIVER_CONSOLE" },
    });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
    });
    await transport.sendMail({
      from: mail.from,
      to: job.recipientEmail,
      subject: job.subject || subjectFor(job.type),
      text: job.body || consoleDetail || "請登入系統查看案件或帳號通知。",
    });
    const localCatcher = mail.local;
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: localCatcher ? NotificationJobStatus.MOCKED : NotificationJobStatus.SENT,
        attemptCount: { increment: 1 },
        sentAt: localCatcher ? null : new Date(),
        lastErrorCode: localCatcher ? "LOCAL_CATCHER" : null,
      },
    });
  } catch (error) {
    console.error("[mail:smtp] failed", error instanceof Error ? error.message : "unknown");
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: NotificationJobStatus.FAILED, attemptCount: { increment: 1 }, lastErrorCode: "SMTP_ERROR" },
    });
  }
}

function subjectFor(type: string): string {
  if (type === "PASSWORD_RESET") return "密碼重設";
  if (type === "SUPPLEMENT_REQUEST") return "請補充驗證申請資料";
  if (type === "DECISION_RESULT") return "驗證申請審核結果";
  if (type === "MANUAL") return "通知";
  if (type === "RENEWAL") return "驗證合約即將到期";
  if (type === "CASE_PROGRESS") return "驗證申請有新進度";
  return "已收到驗證申請";
}
