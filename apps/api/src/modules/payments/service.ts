import {
  ErrorCodes,
  isInTaipeiMonth,
  paymentRecordWriteSchema,
  servicePlanUpdateSchema,
  servicePlanWriteSchema,
  taipeiMonthTitle,
  ecpayCheckoutUrl,
  ecpayTradeDate,
  type PaymentDesk,
  type PaymentItem,
  type PaymentRecordWrite,
  type ServicePlanItem,
  type ServicePlanUpdate,
  type ServicePlanWrite,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import { assertFeature } from "../platform/access";
import { ecpaySettings } from "./ecpay-config";
import { ecpayBody, ecpayCheckMac, ecpayCheckoutFields, ecpayMerchantTradeNo } from "./ecpay-mac";
import { timingSafeEqual } from "node:crypto";

function planItem(row: {
  id: string;
  name: string;
  amount: number;
  description: string;
  paymentUrl: string;
  isActive: boolean;
  version: number;
  updatedAt: Date;
}): ServicePlanItem {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    description: row.description,
    paymentUrl: row.paymentUrl,
    isActive: row.isActive,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function paymentItem(row: {
  id: string;
  organizationId: string;
  organizationName: string;
  planId: string;
  planName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paymentMethod: string;
  paidAt: Date | null;
  note: string;
}): PaymentItem {
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
    note: row.note,
  };
}

export async function paymentDesk(actor: SessionActor): Promise<PaymentDesk> {
  await assertFeature(actor, "payments.manage");
  const [plans, payments, organizations] = await Promise.all([
    prisma.servicePlan.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.paymentRecord.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" } }),
    prisma.organization.findMany({ orderBy: { organizationName: "asc" }, select: { id: true, organizationName: true } }),
  ]);
  const month = payments.filter((row) => row.paidAt && isInTaipeiMonth(row.paidAt.toISOString()));
  return {
    monthLabel: taipeiMonthTitle(),
    dealCount: month.length,
    paidAmount: month.reduce((sum, row) => sum + row.amount, 0),
    payments: month.slice(0, 100).map(paymentItem),
    plans: plans.map(planItem),
    organizations,
  };
}

export async function createPlan(actor: SessionActor, input: ServicePlanWrite) {
  await assertFeature(actor, "payments.manage");
  const parsed = servicePlanWriteSchema.parse(input);
  const saved = await prisma.servicePlan.create({ data: parsed });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_CREATE",
      entityType: "ServicePlan",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { name: saved.name, amount: saved.amount, hasPaymentUrl: saved.paymentUrl.length > 0 },
    },
  });
  return planItem(saved);
}

export async function updatePlan(actor: SessionActor, id: string, input: ServicePlanUpdate) {
  await assertFeature(actor, "payments.manage");
  const parsed = servicePlanUpdateSchema.parse(input);
  const { expectedVersion, ...data } = parsed;
  const changed = await prisma.servicePlan.updateMany({
    where: { id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "方案已被更新，請重新載入");
  const saved = await prisma.servicePlan.findUniqueOrThrow({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PLAN_UPDATE",
      entityType: "ServicePlan",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { name: saved.name, amount: saved.amount, isActive: saved.isActive, hasPaymentUrl: saved.paymentUrl.length > 0 },
    },
  });
  return planItem(saved);
}

export async function recordPayment(actor: SessionActor, input: PaymentRecordWrite) {
  await assertFeature(actor, "payments.manage");
  const parsed = paymentRecordWriteSchema.parse(input);
  const [plan, organization] = await Promise.all([
    prisma.servicePlan.findUnique({ where: { id: parsed.planId } }),
    prisma.organization.findUnique({ where: { id: parsed.organizationId } }),
  ]);
  if (!plan) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到方案");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  const saved = await prisma.paymentRecord.create({
    data: {
      organizationId: organization.id,
      organizationName: organization.organizationName,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: "PAID",
      paidAt: new Date(),
      recordedById: actor.id,
      note: parsed.note,
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
    prisma.servicePlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return { payments: payments.map(paymentItem), plans: plans.map(planItem) };
}

export async function startCheckout(actor: SessionActor, planId: string, env: Env) {
  if (actor.role !== "APPLICANT" || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以前往付款");
  const settings = ecpaySettings(env);
  const [plan, organization] = await Promise.all([
    prisma.servicePlan.findUnique({ where: { id: planId } }),
    prisma.organization.findUnique({ where: { id: actor.organizationId } }),
  ]);
  if (!plan || !plan.isActive) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到開放中的方案");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
  if (plan.amount < 1) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "綠界金額需大於 0");
  const saved = await prisma.paymentRecord.create({
    data: {
      organizationId: organization.id,
      organizationName: organization.organizationName,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: "PENDING",
      merchantTradeNo: ecpayMerchantTradeNo(),
      recordedById: actor.id,
      paidAt: null,
    },
  });
  const site = env.APP_ENV === "local" ? env.WEB_DEV_ORIGIN : env.APP_BASE_URL;
  const fields = ecpayCheckoutFields(
    {
      merchantId: settings.merchantId,
      merchantTradeNo: saved.merchantTradeNo ?? "",
      merchantTradeDate: ecpayTradeDate(),
      totalAmount: plan.amount,
      tradeDesc: plan.name,
      itemName: plan.name,
      returnUrl: `${env.APP_BASE_URL}/api/v1/payments/ecpay/notify`,
      orderResultUrl: `${env.APP_BASE_URL}/api/v1/payments/ecpay/result`,
      clientBackUrl: `${site}/portal/payments`,
      customField1: saved.id,
    },
    settings,
  );
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PAYMENT_CHECKOUT",
      entityType: "PaymentRecord",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { merchantTradeNo: saved.merchantTradeNo, amount: plan.amount, planName: plan.name, stage: settings.stage },
    },
  });
  return { action: settings.action || ecpayCheckoutUrl(settings.stage), fields };
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
  if (params.SimulatePaid === "1" || params.RtnCode !== "1" || row.status === "PAID") return;
  if (Number(params.TradeAmt) !== row.amount) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "付款金額與方案不符");
  await prisma.paymentRecord.update({
    where: { id: row.id },
    data: {
      status: "PAID",
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
