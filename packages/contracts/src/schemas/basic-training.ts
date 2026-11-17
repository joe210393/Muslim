import { z } from "zod";
import { companyTrainingRequestStatusSchema, courseDeliverySchema } from "./common";

export const trainingPolicySchema = z.object({
  id: z.string().uuid(),
  requireBasicBeforeApply: z.boolean(),
  quizPassPercent: z.number().int(),
  privateRequestMinHeadcount: z.number().int(),
  version: z.number().int(),
  updatedAt: z.string().datetime(),
});

export const trainingPolicyWriteSchema = z.object({
  requireBasicBeforeApply: z.boolean(),
  quizPassPercent: z.number().int().min(1).max(100),
  privateRequestMinHeadcount: z.number().int().positive(),
  expectedVersion: z.number().int(),
});

export const basicTrainingQuestionSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  prompt: z.string(),
  options: z.array(z.string()).min(2).max(8),
  correctIndex: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int(),
});

export const basicTrainingModuleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  sortOrder: z.number().int(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  hasVideo: z.boolean(),
  version: z.number().int(),
  questions: z.array(basicTrainingQuestionSchema),
  completed: z.boolean().optional(),
});

export const basicTrainingModuleWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  sortOrder: z.number().int().nonnegative().default(0),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  questions: z.array(z.object({
    id: z.string().uuid().optional(),
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(8),
    correctIndex: z.number().int().nonnegative(),
    sortOrder: z.number().int().nonnegative().default(0),
  })).max(40),
  expectedVersion: z.number().int().optional(),
});

export const basicTrainingStatusSchema = z.object({
  policy: trainingPolicySchema,
  modules: z.array(basicTrainingModuleSchema),
  requiredComplete: z.boolean(),
  passed: z.boolean(),
  passedAt: z.string().datetime().nullable(),
  certificateNo: z.string().nullable(),
  hasCertificate: z.boolean(),
  lastScorePercent: z.number().int().nullable(),
  canTakeQuiz: z.boolean(),
});

export const basicQuizSubmitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedIndex: z.number().int().nonnegative(),
  })).min(1).max(80),
});

export const companyTrainingRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  requestedById: z.string().uuid(),
  requestedByName: z.string(),
  headcount: z.number().int(),
  preferredStartsOn: z.string(),
  preferredEndsOn: z.string(),
  delivery: courseDeliverySchema,
  location: z.string(),
  note: z.string(),
  status: companyTrainingRequestStatusSchema,
  adminNote: z.string(),
  courseId: z.string().uuid().nullable(),
  version: z.number().int(),
  submittedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const companyTrainingRequestWriteSchema = z.object({
  headcount: z.number().int().positive(),
  preferredStartsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery: courseDeliverySchema.default("OFFLINE"),
  location: z.string().trim().max(200).default(""),
  note: z.string().trim().max(2000).default(""),
  expectedVersion: z.number().int().optional(),
});

export const companyTrainingReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  adminNote: z.string().trim().max(2000).default(""),
  courseId: z.string().uuid().nullable().optional(),
  expectedVersion: z.number().int(),
});

export const trainingCertificateSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  userId: z.string().uuid(),
  userName: z.string(),
  certificateNo: z.string(),
  issuedOnDate: z.string(),
  validUntilDate: z.string(),
  registeredAt: z.string().datetime(),
});

export const trainingCertificateWriteSchema = z.object({
  enrollmentId: z.string().uuid(),
  certificateNo: z.string().trim().min(1).max(64),
  issuedOnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type TrainingPolicy = z.infer<typeof trainingPolicySchema>;
export type BasicTrainingStatus = z.infer<typeof basicTrainingStatusSchema>;
export type CompanyTrainingRequest = z.infer<typeof companyTrainingRequestSchema>;
export type TrainingCertificate = z.infer<typeof trainingCertificateSchema>;
