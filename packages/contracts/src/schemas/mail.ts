import { z } from "zod";
import { isMailTemplateKey } from "../domain/application-mail";

export const mailSendSchema = z
  .object({
    audience: z.enum(["all", "one"]),
    userId: z.string().uuid().optional(),
    subject: z.string().trim().min(1, "請填主旨").max(200),
    body: z.string().trim().min(1, "請填內文").max(8000),
  })
  .superRefine((value, ctx) => {
    if (value.audience === "one" && !value.userId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["userId"], message: "請選擇一位業者" });
  });

export type MailSendInput = z.infer<typeof mailSendSchema>;

export const mailTemplateWriteSchema = z.object({
  subject: z.string().trim().min(1, "請填主旨").max(200),
  body: z.string().trim().min(1, "請填內文").max(8000),
  expectedVersion: z.number().int(),
});

export type MailTemplateWrite = z.infer<typeof mailTemplateWriteSchema>;

export const mailTemplateViewSchema = z.object({
  key: z.string().refine(isMailTemplateKey),
  label: z.string(),
  hint: z.string(),
  subject: z.string(),
  body: z.string(),
  version: z.number().int(),
});

export type MailTemplateView = z.infer<typeof mailTemplateViewSchema>;
