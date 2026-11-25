import {
  ErrorCodes,
  detectFileSignature,
  extensionForMime,
  isInTaipeiMonth,
  isServiceUnlocked,
  paymentActionSchema,
  paymentDueAt,
  paymentRecordWriteSchema,
  paymentReviewSchema,
  planIsVisibleToUser,
  remittanceSlipNo,
  type PaymentDecision,
  selectPlanSchema,
  servicePlanUpdateSchema,
  servicePlanWriteSchema,
  sha256Hex,
  taipeiMonthTitle,
  type PaymentDesk,
  type PaymentItem,
  type PaymentRecordWrite,
  type PaymentStatusValue,
  type ServicePlanItem,
  type ServicePlanUpdate,
  type ServicePlanWrite,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { UserRole } from "@mf/db/enums";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature } from "../platform/access";
import { ecpaySettings } from "./ecpay-config";
import { ecpayBody, ecpayCheckMac } from "./ecpay-mac";

type PlanRow = {
  id: string;
  name: string;
  amount: number;
  description: string;
  paymentUrl: string;
  isActive: boolean;
  version: number;
  updatedAt: Date;
  images?: Array<{ id: string; fileId: string; caption: string; sortOrder: number }>;
  viewers?: Array<{
    userId: string;
    user: { id: string; displayName: string; email: string; organization: { organizationName: string } | null };
  }>;
};

function planImageView(row: { id: string; fileId: string; caption: string; sortOrder: number }) {
  return {
    id: row.id,
    fileId: row.fileId,
    caption: row.caption,
    sortOrder: row.sortOrder,
    imageUrl: `/api/v1/media/${row.fileId}`,
  };
}

function planItem(row: PlanRow): ServicePlanItem {
  const viewers = (row.viewers ?? []).map((item) => ({
    userId: item.userId,
    displayName: item.user.displayName,
    email: item.user.email,
    organizationName: item.user.organization?.organizationName ?? null,
  }));
  const visibleUserIds = viewers.map((item) => item.userId);
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    description: row.description,
    paymentUrl: row.paymentUrl,
    isActive: row.isActive,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    images: (row.images ?? []).map(planImageView),
    visibleUserIds,
    viewers,
    visibilityLabel: visibleUserIds.length === 0 ? "全體可見" : `指定 ${visibleUserIds.length} 人`,
  };
}

type PaymentRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  planId: string;
  planName: string;
  amount: number;
  status: PaymentStatusValue;
  paymentMethod: string;
  paidAt: Date | null;
  quoteConfirmedAt?: Date | null;
  accountingConfirmedAt?: Date | null;
  merchantTradeNo?: string | null;
  dueAt?: Date | null;
  receiptFileId?: string | null;
  receipt?: { originalName: string } | null;
  voidedAt?: Date | null;
  voidReason?: string;
  note: string;
  createdAt: Date;
};

const paymentInclude = { receipt: { select: { originalName: true } } } as const;

function paymentItem(row: PaymentRow): PaymentItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    planId: row.planId,
    planName: row.planName,
    amount: row.amount,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paidAt: row.paidAt?.toISOString() ?? null,
    quoteConfirmedAt: row.quoteConfirmedAt?.toISOString() ?? null,
    accountingConfirmedAt: row.accountingConfirmedAt?.toISOString() ?? null,
    note: row.note,
    slipNo: row.merchantTradeNo ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    receiptUploaded: Boolean(row.receiptFileId),
    receiptName: row.receipt?.originalName ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

const OPEN_STATUSES: PaymentStatusValue[] = ["QUOTED", "PENDING", "PAID_PENDING", "PAID"];
const OVERDUE_REASON = "逾期未上傳繳費單據";

/** 未付款且過了繳費期限的單改為未成立。讀取付款清單與上傳前都會先跑，避免依賴排程才鎖住上傳。 */
export async function expireOverduePayments(now = new Date()) {
  const rows = await prisma.paymentRecord.findMany({
    where: { status: "PENDING", dueAt: { lt: now } },
    select: { id: true, planName: true, amount: true, dueAt: true },
  });
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.paymentRecord.updateMany({
        where: { id: row.id, status: "PENDING", dueAt: { lt: now } },
        data: { status: "VOID", voidedAt: now, voidReason: OVERDUE_REASON },
      });
      if (changed.count !== 1) return;
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "PAYMENT_EXPIRE",
          entityType: "PaymentRecord",
          entityId: row.id,
          requestId: crypto.randomUUID(),
          safeChanges: { planName: row.planName, amount: row.amount, dueAt: row.dueAt?.toISOString() ?? null },
        },
      });
    });
  }
  return rows.length;
}

async function remittanceInfo() {
  const setting = await prisma.operationSetting.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  return {
    bankName: setting.remitBankName,
    accountNo: setting.remitAccountNo,
    accountName: setting.remitAccountName,
    dueDays: setting.paymentDueDays,
  };
}

const planInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  viewers: { include: { user: { include: { organization: true } } } },
};

async function loadPlans() {
  return prisma.servicePlan.findMany({
    orderBy: { updatedAt: "desc" },
    include: planInclude,
  });
}

async function replaceViewers(planId: string, visibleUserIds: string[]) {
  const unique = [...new Set(visibleUserIds)];
  if (unique.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: unique }, role: UserRole.APPLICANT, isActive: true },
      select: { id: true },
    });
    if (users.length !== unique.length) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "指定的可見使用者必須是啟用中的業者帳號");
  }
  await prisma.servicePlanViewer.deleteMany({ where: { planId } });
  if (unique.length > 0) {
    await prisma.servicePlanViewer.createMany({
      data: unique.map((userId) => ({ planId, userId })),
    });
  }
}

export async function organizationServiceUnlocked(organizationId: string) {
  const rows = await prisma.paymentRecord.findMany({
    where: { organizationId, status: "PAID" },
    select: { status: true },
  });
  return isServiceUnlocked(rows.map((row) => row.status));
}

export async function assertServiceUnlocked(actor: SessionActor, message = "請先完成方案付款與核帳後，才能使用此功能") {
  if (actor.role !== "APPLICANT" || !actor.organizationId) return;
  const unlocked = await organizationServiceUnlocked(actor.organizationId);
  if (!unlocked) throw new ApiError(403, ErrorCodes.FORBIDDEN, message);
}

export async function paymentDesk(actor: SessionActor): Promise<PaymentDesk> {
  await assertFeature(actor, "payments.manage");
  await expireOverduePayments();
  const [plans, payments, organizations, applicantUsers] = await Promise.all([
    loadPlans(),
    prisma.paymentRecord.findMany({ orderBy: { createdAt: "desc" }, include: paymentInclude }),
    prisma.organization.findMany({ orderBy: { organizationName: "asc" }, select: { id: true, organizationName: true } }),
    prisma.user.findMany({
      where: { role: UserRole.APPLICANT, isActive: true },
      orderBy: { displayName: "asc" },
      include: { organization: true },
    }),
  ]);
  const paid = payments.filter((row) => row.status === "PAID");
  const month = paid.filter((row) => row.paidAt && isInTaipeiMonth(row.paidAt.toISOString()));
  const unlockedIds = [...new Set(paid.map((row) => row.organizationId))];
  const unlockedRows = unlockedIds.length
    ? await prisma.organization.findMany({
      where: { id: { in: unlockedIds } },
      orderBy: { organizationName: "asc" },
      select: { id: true, organizationName: true, taxId: true, address: true, contactName: true },
    })
    : [];
  return {
    monthLabel: taipeiMonthTitle(),
    dealCount: month.length,
    paidAmount: month.reduce((sum, row) => sum + row.amount, 0),
    payments: month.slice(0, 100).map(paymentItem),
    awaitingQuote: payments.filter((row) => row.status === "QUOTED").map(paymentItem),
    awaitingPayment: payments.filter((row) => row.status === "PENDING").map(paymentItem),
    awaitingReconciliation: payments.filter((row) => row.status === "PAID_PENDING").map(paymentItem),
    recentVoid: payments.filter((row) => row.status === "VOID").slice(0, 50).map(paymentItem),
    plans: plans.map(planItem),
    organizations,
    unlockedOrganizations: unlockedRows,
    applicantUsers: applicantUsers.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      organizationName: user.organization?.organizationName ?? null,
    })),
  };
}

export async function createPlan(actor: SessionActor, input: ServicePlanWrite) {
  await assertFeature(actor, "payments.manage");
  const parsed = servicePlanWriteSchema.parse(input);
  const { visibleUserIds, ...data } = parsed;
  const saved = await prisma.servicePlan.create({ data, include: planInclude });
  await replaceViewers(saved.id, visibleUserIds);
  const refreshed = await prisma.servicePlan.findUniqueOrThrow({ where: { id: saved.id }, include: planInclude });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_CREATE",
      entityType: "ServicePlan",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { name: saved.name, amount: saved.amount, viewerCount: visibleUserIds.length },
    },
  });
  return planItem(refreshed);
}

export async function updatePlan(actor: SessionActor, id: string, input: ServicePlanUpdate) {
  await assertFeature(actor, "payments.manage");
  const parsed = servicePlanUpdateSchema.parse(input);
  const { expectedVersion, visibleUserIds, ...data } = parsed;
  const changed = await prisma.servicePlan.updateMany({
    where: { id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "方案已被更新，請重新載入");
  await replaceViewers(id, visibleUserIds);
  const saved = await prisma.servicePlan.findUniqueOrThrow({ where: { id }, include: planInclude });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_UPDATE",
      entityType: "ServicePlan",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { name: saved.name, amount: saved.amount, isActive: saved.isActive, viewerCount: visibleUserIds.length },
    },
  });
  return planItem(saved);
}

export async function uploadPlanImage(
  actor: SessionActor,
  storage: StorageAdapter,
  planId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  caption = "",
) {
  await assertFeature(actor, "payments.manage");
  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
    include: { images: true },
  });
  if (!plan) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到方案");
  if (plan.images.length >= 8) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "每個方案最多 8 張說明圖");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "圖片只接受 JPEG 或 PNG");
  }
  const fileId = randomUUID();
  const storageKey = `plans/${planId}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    await prisma.fileObject.create({
      data: {
        id: fileId,
        uploadedById: actor.id,
        storageKey,
        originalName: file.originalname.slice(0, 180) || "plan-image",
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      },
    });
    await prisma.servicePlanImage.create({
      data: {
        planId,
        fileId,
        caption: caption.slice(0, 200),
        sortOrder: plan.images.length,
      },
    });
    await prisma.servicePlan.update({ where: { id: planId }, data: { version: { increment: 1 } } });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  const saved = await prisma.servicePlan.findUniqueOrThrow({ where: { id: planId }, include: planInclude });
  return planItem(saved);
}

export async function deletePlan(actor: SessionActor, storage: StorageAdapter, id: string) {
  await assertFeature(actor, "payments.manage");
  const plan = await prisma.servicePlan.findUnique({
    where: { id },
    include: { images: { include: { file: true } }, _count: { select: { payments: true } } },
  });
  if (!plan) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到方案");
  if (plan._count.payments > 0) {
    throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "已有業者選過或付過這個方案，不能刪除。可以改成不開放。");
  }
  const files = plan.images.map((image) => image.file);
  await prisma.servicePlan.delete({ where: { id } });
  if (files.length > 0) {
    await prisma.fileObject.deleteMany({ where: { id: { in: files.map((file) => file.id) } } }).catch(() => undefined);
    for (const file of files) await storage.delete(file.storageKey).catch(() => undefined);
  }
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_DELETE",
      entityType: "ServicePlan",
      entityId: id,
      requestId: crypto.randomUUID(),
      safeChanges: { name: plan.name },
    },
  });
  return { id };
}

export async function removePlanImage(actor: SessionActor, planId: string, imageId: string) {
  await assertFeature(actor, "payments.manage");
  const image = await prisma.servicePlanImage.findFirst({ where: { id: imageId, planId } });
  if (!image) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到方案圖片");
  await prisma.servicePlanImage.delete({ where: { id: image.id } });
  await prisma.servicePlan.update({ where: { id: planId }, data: { version: { increment: 1 } } });
  const saved = await prisma.servicePlan.findUniqueOrThrow({ where: { id: planId }, include: planInclude });
  return planItem(saved);
}

export async function selectPlan(actor: SessionActor, input: unknown) {
  if (actor.role !== "APPLICANT" || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以選擇方案");
  const parsed = selectPlanSchema.parse(input);
  const [plan, organization, alreadySelected] = await Promise.all([
    prisma.servicePlan.findUnique({ where: { id: parsed.planId }, include: { viewers: true } }),
    prisma.organization.findUnique({ where: { id: actor.organizationId } }),
    prisma.paymentRecord.findFirst({
      where: {
        organizationId: actor.organizationId,
        planId: parsed.planId,
        status: { in: OPEN_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!plan || !plan.isActive) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到開放中的方案");
  const visibleIds = plan.viewers.map((item) => item.userId);
  if (!planIsVisibleToUser(visibleIds, actor.id)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "這個方案未開放給你的帳號");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  if (alreadySelected) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這個方案已經申請過，請等候處理；未成立的才可以重新申請");
  }
  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentRecord.create({
      data: {
        organizationId: organization.id,
        organizationName: organization.organizationName,
        planId: plan.id,
        planName: plan.name,
        amount: plan.amount,
        status: "QUOTED",
        recordedById: actor.id,
        note: "已選擇方案，待管理員確認",
        paidAt: null,
      },
      include: paymentInclude,
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PLAN_SELECT",
        entityType: "PaymentRecord",
        entityId: created.id,
        requestId: crypto.randomUUID(),
        safeChanges: { planName: plan.name, amount: plan.amount },
      },
    });
    return created;
  });
  return paymentItem(saved);
}

/** 已改為上傳繳費單據；保留路徑避免舊頁面送出時默默成功。 */
export async function markPaidPending(actor: SessionActor, _paymentId: string): Promise<PaymentItem> {
  if (actor.role !== "APPLICANT" || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以付款");
  throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請依匯款單繳費後上傳繳費單據");
}

const RECEIPT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function uploadPaymentReceipt(
  actor: SessionActor,
  storage: StorageAdapter,
  paymentId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  if (actor.role !== "APPLICANT" || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以上傳繳費單據");
  await expireOverduePayments();
  const row = await prisma.paymentRecord.findFirst({ where: { id: paymentId, organizationId: actor.organizationId } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到匯款單");
  if (row.status === "VOID") throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "此繳費已未成立，上傳已鎖定；請重新選擇方案申請");
  if (row.status !== "PENDING") throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, row.status === "QUOTED" ? "管理員尚未核准方案，還沒有匯款單" : "這筆已上傳單據或已核帳");
  const setting = await prisma.operationSetting.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  if (file.size > setting.attachmentMaxBytes) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `單據檔案不可超過 ${Math.round(setting.attachmentMaxBytes / (1024 * 1024))} MB`);
  }
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || !RECEIPT_TYPES.has(mime)) throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "繳費單據只接受 PDF、JPEG 或 PNG");
  const fileId = randomUUID();
  const storageKey = `payment-receipts/${row.id}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    const saved = await prisma.$transaction(async (tx) => {
      await tx.fileObject.create({
        data: {
          id: fileId,
          uploadedById: actor.id,
          storageKey,
          originalName: file.originalname.slice(0, 180) || "receipt",
          mimeType: mime,
          sizeBytes: bytes.byteLength,
          sha256: await sha256Hex(bytes),
        },
      });
      const changed = await tx.paymentRecord.updateMany({
        where: { id: row.id, status: "PENDING", OR: [{ dueAt: null }, { dueAt: { gte: new Date() } }] },
        data: { status: "PAID_PENDING", receiptFileId: fileId, paidAt: new Date(), paymentMethod: "TRANSFER" },
      });
      if (changed.count !== 1) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "匯款單狀態已變更，請重新整理");
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PAYMENT_RECEIPT_UPLOAD",
          entityType: "PaymentRecord",
          entityId: row.id,
          requestId: crypto.randomUUID(),
          safeChanges: { planName: row.planName, amount: row.amount, mimeType: mime, sizeBytes: bytes.byteLength },
        },
      });
      return tx.paymentRecord.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude });
    });
    return paymentItem(saved);
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function readPaymentReceipt(actor: SessionActor, storage: StorageAdapter, paymentId: string) {
  const row = await prisma.paymentRecord.findUnique({ where: { id: paymentId }, include: { receipt: true } });
  if (!row || !row.receipt) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到繳費單據");
  if (actor.role === "APPLICANT") {
    if (row.organizationId !== actor.organizationId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到繳費單據");
  } else {
    await assertFeature(actor, "payments.manage");
  }
  const bytes = await storage.read(row.receipt.storageKey);
  return { bytes, mimeType: row.receipt.mimeType, name: row.receipt.originalName };
}

/** 報價核准／不核准、單據退回、改未成立。以 expectedStatus 做條件更新，重複送出會得到 409。 */
export async function reviewPayment(actor: SessionActor, input: unknown) {
  await assertFeature(actor, "payments.manage");
  const parsed = paymentReviewSchema.parse(input);
  const allowed: Record<PaymentDecision, PaymentStatusValue[]> = {
    APPROVE_QUOTE: ["QUOTED"],
    REJECT_QUOTE: ["QUOTED"],
    RETURN_RECEIPT: ["PAID_PENDING"],
    VOID: ["PENDING", "PAID_PENDING"],
  };
  if (!allowed[parsed.decision].includes(parsed.expectedStatus)) {
    throw new ApiError(400, ErrorCodes.INVALID_TRANSITION, "這個狀態不能做這個處理");
  }
  const row = await prisma.paymentRecord.findUnique({ where: { id: parsed.paymentId } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到付款紀錄");
  const now = new Date();
  const remittance = await remittanceInfo();
  const free = row.amount === 0;
  const data = (() => {
    switch (parsed.decision) {
      case "APPROVE_QUOTE":
        return free
          ? { status: "PAID" as const, quoteConfirmedAt: now, accountingConfirmedAt: now, paidAt: now, paymentMethod: "FREE", note: "免費方案，核准即開通" }
          : {
            status: "PENDING" as const,
            quoteConfirmedAt: now,
            dueAt: paymentDueAt(remittance.dueDays, now),
            merchantTradeNo: row.merchantTradeNo ?? remittanceSlipNo(now, randomUUID().replaceAll("-", "")),
            note: parsed.note || "已核准，已產生匯款單",
          };
      case "REJECT_QUOTE":
      case "VOID":
        return { status: "VOID" as const, voidedAt: now, voidReason: parsed.note };
      case "RETURN_RECEIPT":
        return { status: "PENDING" as const, receiptFileId: null, paidAt: null, paymentMethod: "", note: `單據退回：${parsed.note}`.slice(0, 200) };
    }
  })();
  const saved = await prisma.$transaction(async (tx) => {
    const changed = await tx.paymentRecord.updateMany({ where: { id: row.id, status: parsed.expectedStatus }, data });
    if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "這筆已被處理，請重新整理");
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `PAYMENT_${parsed.decision}`,
        entityType: "PaymentRecord",
        entityId: row.id,
        requestId: crypto.randomUUID(),
        safeChanges: { planName: row.planName, amount: row.amount, from: parsed.expectedStatus, to: data.status },
      },
    });
    return tx.paymentRecord.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude });
  });
  return paymentItem(saved);
}

export async function confirmReconciliation(actor: SessionActor, input: unknown) {
  await assertFeature(actor, "payments.manage");
  const parsed = paymentActionSchema.parse(input);
  const row = await prisma.paymentRecord.findUnique({ where: { id: parsed.paymentId } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到付款紀錄");
  if (row.status !== "PAID_PENDING") throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這筆不是未核付款");
  const saved = await prisma.$transaction(async (tx) => {
    const changed = await tx.paymentRecord.updateMany({
      where: { id: row.id, status: "PAID_PENDING" },
      data: { status: "PAID", accountingConfirmedAt: new Date(), paidAt: row.paidAt ?? new Date() },
    });
    if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "這筆已被處理，請重新整理");
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "RECONCILIATION_CONFIRM",
        entityType: "PaymentRecord",
        entityId: row.id,
        requestId: crypto.randomUUID(),
        safeChanges: { planName: row.planName, amount: row.amount },
      },
    });
    return tx.paymentRecord.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude });
  });
  return paymentItem(saved);
}

export async function recordPayment(actor: SessionActor, input: PaymentRecordWrite) {
  await assertFeature(actor, "payments.manage");
  const parsed = paymentRecordWriteSchema.parse(input);
  const [plan, organization, alreadySelected] = await Promise.all([
    prisma.servicePlan.findUnique({ where: { id: parsed.planId } }),
    prisma.organization.findUnique({ where: { id: parsed.organizationId } }),
    prisma.paymentRecord.findFirst({
      where: {
        organizationId: parsed.organizationId,
        planId: parsed.planId,
        status: { in: OPEN_STATUSES },
      },
    }),
  ]);
  if (!plan) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到方案");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  if (alreadySelected) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此業者已選過這個方案，不能重複登錄");
  const saved = await prisma.paymentRecord.create({
    data: {
      organizationId: organization.id,
      organizationName: organization.organizationName,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: "PAID_PENDING",
      paidAt: new Date(),
      quoteConfirmedAt: new Date(),
      recordedById: actor.id,
      note: parsed.note || "人工登錄未核付款",
    },
    include: paymentInclude,
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PAYMENT_RECORD",
      entityType: "PaymentRecord",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { organizationId: organization.id, planName: plan.name, amount: plan.amount },
    },
  });
  return paymentItem(saved);
}

export async function myPayments(actor: SessionActor) {
  if (!actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "這個帳號沒有所屬業者");
  await expireOverduePayments();
  const [payments, plans, remittance] = await Promise.all([
    prisma.paymentRecord.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, include: paymentInclude }),
    prisma.servicePlan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: planInclude,
    }),
    remittanceInfo(),
  ]);
  const items = payments.map(paymentItem);
  const visiblePlans = plans
    .map(planItem)
    .filter((plan) => planIsVisibleToUser(plan.visibleUserIds, actor.id));
  const activeOrder = items.find((item) => item.status === "PENDING" || item.status === "PAID_PENDING" || item.status === "QUOTED") ?? null;
  return {
    payments: items,
    plans: visiblePlans,
    serviceUnlocked: isServiceUnlocked(items.map((item) => item.status)),
    activeOrder,
    remittance,
  };
}

export async function startCheckout(actor: SessionActor, paymentId: string, _env: Env) {
  const item = await markPaidPending(actor, paymentId);
  return {
    action: "https://payment.local/mock-paid-pending",
    fields: { paymentId: item.id, status: item.status },
  };
}

export async function applyEcpayNotification(env: Env, body: unknown) {
  const settings = await ecpaySettings(env);
  const params = ecpayBody(body);
  const received = params.CheckMacValue ?? "";
  const expected = ecpayCheckMac(params, settings.hashKey, settings.hashIv);
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "檢查碼不符");
  }
  if (params.MerchantID !== settings.merchantId) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "商店代號不符");
  const row = await prisma.paymentRecord.findUnique({ where: { merchantTradeNo: params.MerchantTradeNo ?? "" } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到訂單");
  if (params.SimulatePaid === "1" || params.RtnCode !== "1" || row.status !== "PENDING") return;
  if (Number(params.TradeAmt) !== row.amount) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "付款金額與方案不符");
  await prisma.paymentRecord.update({
    where: { id: row.id },
    data: {
      status: "PAID_PENDING",
      paidAt: new Date(),
      ecpayTradeNo: (params.TradeNo ?? "").slice(0, 20),
      paymentMethod: (params.PaymentType ?? "").slice(0, 20),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: row.recordedById,
      action: "PAYMENT_ECPAY",
      entityType: "PaymentRecord",
      entityId: row.id,
      requestId: crypto.randomUUID(),
      safeChanges: { merchantTradeNo: row.merchantTradeNo, amount: row.amount, paymentType: (params.PaymentType ?? "").slice(0, 20) },
    },
  });
}
