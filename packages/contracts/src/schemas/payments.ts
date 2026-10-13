import { z } from "zod";

const paymentUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//.test(value), "付款連結須為 http 或 https 網址");

export const servicePlanWriteSchema = z.object({
  name: z.string().trim().min(1, "請填方案名稱").max(80),
  amount: z.coerce.number().int().min(0, "金額不可為負").max(9_999_999),
  description: z.string().trim().max(4000).default(""),
  paymentUrl,
  isActive: z.boolean().default(true),
});

export const servicePlanUpdateSchema = servicePlanWriteSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const paymentRecordWriteSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  note: z.string().trim().max(200).default(""),
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
});

export const paymentItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  planId: z.string().uuid(),
  planName: z.string(),
  amount: z.number().int(),
  status: z.enum(["PENDING", "PAID"]),
  paymentMethod: z.string(),
  paidAt: z.string().datetime().nullable(),
  note: z.string(),
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
  plans: z.array(servicePlanSchema),
  organizations: z.array(z.object({ id: z.string().uuid(), organizationName: z.string() })),
});

export const myPaymentsSchema = z.object({
  payments: z.array(paymentItemSchema),
  plans: z.array(servicePlanSchema),
});

export type ServicePlanWrite = z.infer<typeof servicePlanWriteSchema>;
export type ServicePlanUpdate = z.infer<typeof servicePlanUpdateSchema>;
export type PaymentRecordWrite = z.infer<typeof paymentRecordWriteSchema>;
export type ServicePlanItem = z.infer<typeof servicePlanSchema>;
export type PaymentItem = z.infer<typeof paymentItemSchema>;
export type EcpayCheckout = z.infer<typeof ecpayCheckoutSchema>;
export type PaymentDesk = z.infer<typeof paymentDeskSchema>;
export type MyPayments = z.infer<typeof myPaymentsSchema>;
