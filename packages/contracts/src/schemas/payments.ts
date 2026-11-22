import { z } from "zod";

const paymentUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//.test(value), "付款連結須為 http 或 https 網址");

export const paymentStatusSchema = z.enum(["QUOTED", "PENDING", "PAID_PENDING", "PAID"]);

export const servicePlanImageSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  caption: z.string(),
  sortOrder: z.number().int(),
  imageUrl: z.string().nullable(),
});

export const servicePlanViewerSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string(),
  organizationName: z.string().nullable(),
});

export const servicePlanWriteSchema = z.object({
  name: z.string().trim().min(1, "請填方案名稱").max(80),
  amount: z.coerce.number().int().min(0, "金額不可為負").max(9_999_999),
  description: z.string().trim().max(4000).default(""),
  paymentUrl: paymentUrl.default(""),
  isActive: z.boolean().default(true),
  /** 空陣列＝全體可見；有值＝僅這些使用者可見。 */
  visibleUserIds: z.array(z.string().uuid()).default([]),
});

export const servicePlanUpdateSchema = servicePlanWriteSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const paymentRecordWriteSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  note: z.string().trim().max(200).default(""),
});

export const selectPlanSchema = z.object({
  planId: z.string().uuid(),
});

export const paymentActionSchema = z.object({
  paymentId: z.string().uuid(),
  expectedStatus: paymentStatusSchema.optional(),
});

export const servicePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  amount: z.number().int(),
  description: z.string(),
  paymentUrl: z.string(),
  isActive: z.boolean(),
  version: z.number().int(),
  updatedAt: z.string().datetime(),
  images: z.array(servicePlanImageSchema).default([]),
  visibleUserIds: z.array(z.string().uuid()).default([]),
  viewers: z.array(servicePlanViewerSchema).default([]),
  visibilityLabel: z.string(),
});

export const paymentItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  planId: z.string().uuid(),
  planName: z.string(),
  amount: z.number().int(),
  status: paymentStatusSchema,
  paymentMethod: z.string(),
  paidAt: z.string().datetime().nullable(),
  quoteConfirmedAt: z.string().datetime().nullable(),
  accountingConfirmedAt: z.string().datetime().nullable(),
  note: z.string(),
  createdAt: z.string().datetime(),
});

export const ecpayCheckoutSchema = z.object({
  action: z.string().url(),
  fields: z.record(z.string(), z.string()),
});

export const paymentDeskSchema = z.object({
  monthLabel: z.string(),
  dealCount: z.number().int(),
  paidAmount: z.number().int(),
  payments: z.array(paymentItemSchema),
  awaitingReconciliation: z.array(paymentItemSchema),
  plans: z.array(servicePlanSchema),
  organizations: z.array(z.object({ id: z.string().uuid(), organizationName: z.string() })),
  /** 已核帳開通、可發出合約的業者 */
  unlockedOrganizations: z.array(z.object({
    id: z.string().uuid(),
    organizationName: z.string(),
    taxId: z.string().nullable(),
    address: z.string().nullable(),
    contactName: z.string().nullable(),
  })).default([]),
  applicantUsers: z.array(z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    email: z.string(),
    organizationName: z.string().nullable(),
  })),
});

export const myPaymentsSchema = z.object({
  payments: z.array(paymentItemSchema),
  plans: z.array(servicePlanSchema),
  serviceUnlocked: z.boolean(),
  activeOrder: paymentItemSchema.nullable(),
});

export type ServicePlanWrite = z.infer<typeof servicePlanWriteSchema>;
export type ServicePlanUpdate = z.infer<typeof servicePlanUpdateSchema>;
export type PaymentRecordWrite = z.infer<typeof paymentRecordWriteSchema>;
export type ServicePlanItem = z.infer<typeof servicePlanSchema>;
export type ServicePlanImageItem = z.infer<typeof servicePlanImageSchema>;
export type PaymentItem = z.infer<typeof paymentItemSchema>;
export type PaymentStatusValue = z.infer<typeof paymentStatusSchema>;
export type EcpayCheckout = z.infer<typeof ecpayCheckoutSchema>;
export type PaymentDesk = z.infer<typeof paymentDeskSchema>;
export type MyPayments = z.infer<typeof myPaymentsSchema>;
