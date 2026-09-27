import { z } from "zod";
import { importBatchStatusSchema, importBatchTypeSchema } from "./common";

export const dashboardCountsSchema = z.object({
  draft: z.number().int(),
  submitted: z.number().int(),
  initialReview: z.number().int(),
  secondReview: z.number().int(),
  finalReview: z.number().int(),
  needSupplement: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
  upcomingCourses: z.number().int(),
  upcoming: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      startsAt: z.string().datetime(),
      location: z.string(),
    }),
  ),
});

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid().nullable(),
  requestId: z.string(),
  safeChanges: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const importRowSchema = z.object({
  rowNumber: z.number().int(),
  ok: z.boolean(),
  messages: z.array(z.string()),
  preview: z.record(z.string(), z.string()),
});

export const importPreviewSchema = z.object({
  id: z.string().uuid(),
  type: importBatchTypeSchema,
  status: importBatchStatusSchema,
  rowCount: z.number().int(),
  errorCount: z.number().int(),
  rows: z.array(importRowSchema),
});

export const publicConfigSchema = z.object({
  appName: z.string(),
  dataMode: z.enum(["mock", "api"]),
  demoMode: z.boolean(),
  maxFileBytes: z.number().int(),
  maxApplicationBytes: z.number().int(),
  allowedMimeTypes: z.array(z.string()),
  contactEmail: z.string(),
  contactNote: z.string(),
});

export type DashboardCounts = z.infer<typeof dashboardCountsSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
