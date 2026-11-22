import {
  ErrorCodes,
  detectFileSignature,
  extensionForMime,
  isInTaipeiMonth,
  isServiceUnlocked,
  paymentActionSchema,
  paymentRecordWriteSchema,
  planIsVisibleToUser,
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

function paymentItem(row: {
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
  note: string;
  createdAt: Date;
}): PaymentItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    planId: row.planId,
    planName: row.planName,
    amount: row.amount,
    status: row.status === "QUOTED" ? "PENDING" : row.status,
    paymentMethod: row.paymentMethod,
    paidAt: row.paidAt?.toISOString() ?? null,
    quoteConfirmedAt: row.quoteConfirmedAt?.toISOString() ?? null,
    accountingConfirmedAt: row.accountingConfirmedAt?.toISOString() ?? null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
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
  const [plans, payments, organizations, applicantUsers] = await Promise.all([
    loadPlans(),
    prisma.paymentRecord.findMany({ orderBy: { createdAt: "desc" } }),
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
    awaitingReconciliation: payments.filter((row) => row.status === "PAID_PENDING").map(paymentItem),
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
        status: { in: ["QUOTED", "PENDING", "PAID_PENDING", "PAID"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!plan || !plan.isActive) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到開放中的方案");
  const visibleIds = plan.viewers.map((item) => item.userId);
  if (!planIsVisibleToUser(visibleIds, actor.id)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "這個方案未開放給你的帳號");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  if (alreadySelected) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這個方案已經選過，不能再選；請改選尚未使用過的方案");
  }
  const saved = await prisma.paymentRecord.create({
    data: {
      organizationId: organization.id,
      organizationName: organization.organizationName,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: "PENDING",
      quoteConfirmedAt: new Date(),
      recordedById: actor.id,
      note: "已選擇方案，待付款",
      paidAt: null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_SELECT",
      entityType: "PaymentRecord",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { planName: plan.name, amount: plan.amount },
    },
  });
  return paymentItem(saved);
}

/** 先不接金流：業者按付款後直接進入待核帳。 */
export async function markPaidPending(actor: SessionActor, paymentId: string) {
  if (actor.role !== "APPLICANT" || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以付款");
  const row = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, organizationId: actor.organizationId },
  });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到訂單");
  if (row.status !== "PENDING" && row.status !== "QUOTED") throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這筆目前不能付款");
  const saved = await prisma.paymentRecord.update({
    where: { id: row.id },
    data: {
      status: "PAID_PENDING",
      paidAt: new Date(),
      paymentMethod: "MANUAL",
      note: row.note ? `${row.note}；業者已送出付款（待核帳）` : "業者已送出付款（待核帳）",
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PAYMENT_SUBMIT",
      entityType: "PaymentRecord",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { planName: saved.planName, amount: saved.amount },
    },
  });
  return paymentItem(saved);
}

export async function confirmReconciliation(actor: SessionActor, input: unknown) {
  await assertFeature(actor, "payments.manage");
  const parsed = paymentActionSchema.parse(input);
  const row = await prisma.paymentRecord.findUnique({ where: { id: parsed.paymentId } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到付款紀錄");
  if (row.status !== "PAID_PENDING") throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這筆不是待核帳");
  const saved = await prisma.paymentRecord.update({
    where: { id: row.id },
    data: {
      status: "PAID",
      accountingConfirmedAt: new Date(),
      paidAt: row.paidAt ?? new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "RECONCILIATION_CONFIRM",
      entityType: "PaymentRecord",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { planName: saved.planName, amount: saved.amount },
    },
  });
  return paymentItem(saved);
}

/** @deprecated 改用 confirmReconciliation */
export async function confirmAccounting(actor: SessionActor, input: unknown) {
  return confirmReconciliation(actor, input);
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
        status: { in: ["QUOTED", "PENDING", "PAID_PENDING", "PAID"] },
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
      note: parsed.note || "人工登錄待核帳",
    },
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
  const [payments, plans] = await Promise.all([
    prisma.paymentRecord.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.servicePlan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: planInclude,
    }),
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
  };
}

export async function startCheckout(actor: SessionActor, paymentId: string, _env: Env) {
  // 暫不接金流：與 markPaidPending 相同
  const item = await markPaidPending(actor, paymentId);
  return {
    action: "https://payment.local/mock-paid-pending",
    fields: { paymentId: item.id, status: item.status },
  };
}

export async function applyEcpayNotification(env: Env, body: unknown) {
  const settings = ecpaySettings(env);
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
  if (params.SimulatePaid === "1" || params.RtnCode !== "1" || row.status === "PAID" || row.status === "PAID_PENDING") return;
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
