import { z } from "zod";
import { passwordSchema, userRoleSchema } from "./common";

export const registerRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(320),
    password: passwordSchema,
    confirmPassword: z.string(),
    organizationName: z.string().trim().min(1).max(200),
    taxId: z.string().trim().regex(/^\d{8}$/, "統一編號暫定為 8 位數字（海外規則待確認）"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "兩次密碼不一致",
  });

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordRequestSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "兩次密碼不一致",
  });

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "兩次密碼不一致",
  });

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
  organizationId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export const authResponseSchema = z.object({
  user: publicUserSchema,
  csrfToken: z.string(),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const csrfResponseSchema = z.object({
  csrfToken: z.string(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
