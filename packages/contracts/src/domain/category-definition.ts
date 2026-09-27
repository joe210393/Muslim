import { z } from "zod";

export const RESERVED_FORM_KEYS = [
  "id",
  "organizationId",
  "applicationId",
  "applicationNo",
  "status",
  "role",
  "categoryId",
  "organizationName",
  "taxId",
  "contactName",
  "contactPhone",
  "contactEmail",
  "organizationAddress",
  "siteName",
  "siteAddress",
  "applicationDescription",
  "declarationAccepted",
  "formData",
  "passwordHash",
  "certificateNo",
  "issuedOnDate",
  "validUntilDate",
] as const;

const reserved = new Set<string>(RESERVED_FORM_KEYS);

export const fieldInputTypeSchema = z.enum(["text", "textarea", "select", "date", "number", "checkbox"]);

export const categoryFieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][A-Za-z0-9]{1,40}$/, "欄位代碼需為 camelCase 業務名稱"),
    label: z.string().min(1).max(80),
    inputType: fieldInputTypeSchema,
    requiredOnSubmit: z.boolean(),
    options: z.array(z.object({ value: z.string().min(1).max(40), label: z.string().min(1).max(80) })).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    helpText: z.string().max(300).optional(),
  })
  .superRefine((field, ctx) => {
    if (reserved.has(field.key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `欄位 ${field.key} 是保留欄位，不可作為額外欄位` });
    }
    if (field.inputType === "select" && (!field.options || field.options.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "選項欄位需要 options" });
    }
    if (field.inputType !== "select" && field.options) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "只有選項欄位可以有 options" });
    }
  });

export const attachmentRequirementSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
  label: z.string().min(1).max(120),
  requiredOnSubmit: z.boolean(),
  helpText: z.string().max(300).optional(),
});

export const categoryDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    fields: z.array(categoryFieldSchema),
    attachmentRequirements: z.array(attachmentRequirementSchema),
    helpText: z.string().max(1000),
  })
  .superRefine((definition, ctx) => {
    const fieldKeys = new Set<string>();
    for (const field of definition.fields) {
      if (fieldKeys.has(field.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `欄位代碼重複：${field.key}` });
      }
      fieldKeys.add(field.key);
    }
    const attachmentKeys = new Set<string>();
    for (const item of definition.attachmentRequirements) {
      if (attachmentKeys.has(item.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `附件代碼重複：${item.key}` });
      }
      attachmentKeys.add(item.key);
    }
  });

export type CategoryField = z.infer<typeof categoryFieldSchema>;
export type AttachmentRequirement = z.infer<typeof attachmentRequirementSchema>;
export type CategoryDefinition = z.infer<typeof categoryDefinitionSchema>;

export function parseCategoryDefinition(value: unknown): CategoryDefinition {
  return categoryDefinitionSchema.parse(value);
}
