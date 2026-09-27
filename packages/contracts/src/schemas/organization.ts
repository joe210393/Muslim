import { z } from "zod";
import { nullableText } from "./common";

export const organizationSchema = z.object({
  id: z.string().uuid(),
  organizationName: z.string(),
  taxId: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  address: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const organizationPatchSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(200).optional(),
    contactName: nullableText(100).optional(),
    contactPhone: nullableText(30).optional(),
    contactEmail: z.union([z.string().trim().email().max(320), z.null()]).optional(),
    address: nullableText(300).optional(),
  })
  .strict();

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.string(),
  organizationId: z.string().uuid().nullable(),
  organizationName: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export const createStaffUserSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(72),
  role: z.enum(["CASE_OFFICER", "ADMIN"]),
});

export const updateStaffUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    role: z.enum(["CASE_OFFICER", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationPatch = z.infer<typeof organizationPatchSchema>;
