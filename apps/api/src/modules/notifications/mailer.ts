import { NotificationJobStatus } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import nodemailer from "nodemailer";
import type { Env } from "../../config/env";

export async function deliverNotification(env: Env, jobId: string, consoleDetail?: string): Promise<void> {
  const job = await prisma.notificationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === NotificationJobStatus.SENT || job.status === NotificationJobStatus.MOCKED) return;
  if (env.MAIL_DRIVER === "console") {
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
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: job.recipientEmail,
      subject: subjectFor(job.type),
      text: consoleDetail ?? "請登入系統查看案件或帳號通知。此信不包含密碼或重設 token 以外的機密。",
    });
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: NotificationJobStatus.SENT, attemptCount: { increment: 1 }, sentAt: new Date(), lastErrorCode: null },
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
  if (type === "SUPPLEMENT_REQUEST") return "案件需要補件";
  if (type === "DECISION_RESULT") return "案件審核結果";
  return "申請已送出";
}
