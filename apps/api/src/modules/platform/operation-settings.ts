import { ErrorCodes, operationSettingWriteSchema } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import { assertFeature } from "./access";

const DEFAULT_ID = "default";

function view(row: {
  renewalReminderDays: number;
  certificateTermMonths: number;
  attachmentMaxBytes: number;
  paymentDueDays: number;
  remitBankName: string;
  remitAccountNo: string;
  remitAccountName: string;
  version: number;
}) {
  return {
    renewalReminderDays: row.renewalReminderDays,
    certificateTermMonths: row.certificateTermMonths,
    attachmentMaxBytes: row.attachmentMaxBytes,
    attachmentMaxMb: Math.round(row.attachmentMaxBytes / (1024 * 1024)),
    paymentDueDays: row.paymentDueDays,
    remitBankName: row.remitBankName,
    remitAccountNo: row.remitAccountNo,
    remitAccountName: row.remitAccountName,
    version: row.version,
  };
}

export async function getOperationSetting() {
  const row = await prisma.operationSetting.upsert({
    where: { id: DEFAULT_ID },
    create: { id: DEFAULT_ID },
    update: {},
  });
  return view(row);
}

export async function saveOperationSetting(actor: SessionActor, raw: unknown) {
  const input = operationSettingWriteSchema.parse(raw);
  if (input.renewalReminderDays !== undefined) await assertFeature(actor, "contracts.issue");
  if (input.certificateTermMonths !== undefined) await assertFeature(actor, "applications.decide");
  if (input.attachmentMaxMb !== undefined) await assertFeature(actor, "users.manage");
  const touchesRemittance = [input.paymentDueDays, input.remitBankName, input.remitAccountNo, input.remitAccountName].some((item) => item !== undefined);
  if (touchesRemittance) await assertFeature(actor, "payments.manage");
  const current = await getOperationSetting();
  if (current.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "設定已被更新，請重新載入");
  const changed = await prisma.operationSetting.updateMany({
    where: { id: DEFAULT_ID, version: input.expectedVersion },
    data: {
      ...(input.renewalReminderDays !== undefined ? { renewalReminderDays: input.renewalReminderDays } : {}),
      ...(input.certificateTermMonths !== undefined ? { certificateTermMonths: input.certificateTermMonths } : {}),
      ...(input.attachmentMaxMb !== undefined ? { attachmentMaxBytes: input.attachmentMaxMb * 1024 * 1024 } : {}),
      ...(input.paymentDueDays !== undefined ? { paymentDueDays: input.paymentDueDays } : {}),
      ...(input.remitBankName !== undefined ? { remitBankName: input.remitBankName } : {}),
      ...(input.remitAccountNo !== undefined ? { remitAccountNo: input.remitAccountNo } : {}),
      ...(input.remitAccountName !== undefined ? { remitAccountName: input.remitAccountName } : {}),
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "設定已被更新，請重新載入");
  const saved = await prisma.operationSetting.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "OPERATION_SETTING_UPDATE",
      entityType: "OperationSetting",
      entityId: null,
      requestId: crypto.randomUUID(),
      safeChanges: {
        renewalReminderDays: saved.renewalReminderDays,
        certificateTermMonths: saved.certificateTermMonths,
        attachmentMaxBytes: saved.attachmentMaxBytes,
        paymentDueDays: saved.paymentDueDays,
        remittanceAccountChanged: input.remitBankName !== undefined || input.remitAccountNo !== undefined || input.remitAccountName !== undefined,
      },
    },
  });
  return view(saved);
}
