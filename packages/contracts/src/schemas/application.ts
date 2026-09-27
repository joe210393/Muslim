import { z } from "zod";
import { categoryDefinitionSchema } from "../domain/category-definition";
import {
  applicationActionSchema,
  applicationStatusSchema,
  configurationStatusSchema,
  nullableText,
} from "./common";

export const categorySummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  latestVersion: z.object({
    id: z.string().uuid(),
    version: z.number().int(),
    configurationStatus: configurationStatusSchema,
    definition: categoryDefinitionSchema,
  }),
});

export const applicationListItemSchema = z.object({
  id: z.string().uuid(),
  applicationNo: z.string(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  categoryId: z.string().uuid(),
  categoryCode: z.string(),
  categoryName: z.string(),
  status: applicationStatusSchema,
  assignedToId: z.string().uuid().nullable(),
  assignedToName: z.string().nullable(),
  version: z.number().int(),
  submittedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  requirementKey: z.string(),
  fileId: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  createdAt: z.string().datetime(),
});

export const applicationContentSchema = z.object({
  organizationName: z.string().nullable(),
  taxId: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  organizationAddress: z.string().nullable(),
  siteName: z.string().nullable(),
  siteAddress: z.string().nullable(),
  applicationDescription: z.string().nullable(),
  declarationAccepted: z.boolean(),
  formData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const applicationDetailSchema = applicationListItemSchema.merge(applicationContentSchema).extend({
  categoryFormVersionId: z.string().uuid(),
  formVersion: z.number().int(),
  configurationStatus: configurationStatusSchema,
  definition: categoryDefinitionSchema,
  resumeStatus: applicationStatusSchema.nullable(),
  createdById: z.string().uuid(),
  sourceSystem: z.string().nullable(),
  sourceRecordKey: z.string().nullable(),
  decidedAt: z.string().datetime().nullable(),
  attachments: z.array(attachmentSchema),
});

export const applicationEventSchema = z.object({
  id: z.string().uuid(),
  action: applicationActionSchema,
  fromStatus: applicationStatusSchema.nullable(),
  toStatus: applicationStatusSchema.nullable(),
  publicComment: z.string().nullable(),
  internalNote: z.string().nullable(),
  actorId: z.string().uuid(),
  actorName: z.string(),
  createdAt: z.string().datetime(),
});

export const submissionSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int(),
  submittedAt: z.string().datetime(),
  formVersionId: z.string().uuid(),
  payloadSnapshot: z.record(z.string(), z.unknown()),
  attachmentIdsSnapshot: z.array(z.string().uuid()),
});

export const createApplicationSchema = z.object({
  categoryId: z.string().uuid(),
});

export const applicationPatchSchema = z
  .object({
    expectedVersion: z.number().int(),
    categoryId: z.string().uuid().optional(),
    organizationName: nullableText(200).optional(),
    taxId: nullableText(32).optional(),
    contactName: nullableText(100).optional(),
    contactPhone: nullableText(30).optional(),
    contactEmail: nullableText(320).optional(),
    organizationAddress: nullableText(300).optional(),
    siteName: nullableText(200).optional(),
    siteAddress: nullableText(300).optional(),
    applicationDescription: nullableText(4000).optional(),
    declarationAccepted: z.boolean().optional(),
    formData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict();

export const submitApplicationSchema = z.object({
  expectedVersion: z.number().int(),
  requestId: z.string().uuid(),
});

export const reviewActionSchema = z.object({
  action: z.enum(["START_REVIEW", "PASS_INITIAL", "PASS_SECOND", "APPROVE", "REQUEST_SUPPLEMENT", "REJECT"]),
  expectedVersion: z.number().int(),
  requestId: z.string().uuid(),
  publicComment: z.string().trim().max(2000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
});

export const assignApplicationSchema = z.object({
  assignedToId: z.string().uuid(),
  expectedVersion: z.number().int(),
  requestId: z.string().uuid(),
});

export const applicationListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: applicationStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const certificationSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  applicationNo: z.string(),
  organizationName: z.string(),
  certificateNo: z.string(),
  issuedOnDate: z.string(),
  validUntilDate: z.string(),
  isCurrent: z.boolean(),
  validityLabel: z.string(),
  registeredAt: z.string().datetime(),
});

export const certificationWriteSchema = z.object({
  certificateNo: z.string().trim().min(1).max(64),
  issuedOnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ApplicationListItem = z.infer<typeof applicationListItemSchema>;
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;
export type ApplicationPatch = z.infer<typeof applicationPatchSchema>;
export type CategorySummary = z.infer<typeof categorySummarySchema>;
export type Certification = z.infer<typeof certificationSchema>;
