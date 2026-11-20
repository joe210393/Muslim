import { z } from "zod";
import { companyTrainingRequestStatusSchema, courseDeliverySchema } from "./common";
import { youtubeVideoId } from "../domain/platform-defaults";

export const trainingPolicySchema = z.object({
  id: z.string().uuid(),
  requireBasicBeforeApply: z.boolean(),
  quizDrawCount: z.number().int(),
  quizPassCount: z.number().int(),
  privateRequestMinHeadcount: z.number().int(),
  version: z.number().int(),
  updatedAt: z.string().datetime(),
});

export const trainingPolicyWriteSchema = z.object({
  requireBasicBeforeApply: z.boolean(),
  quizDrawCount: z.number().int().min(1).max(100),
  quizPassCount: z.number().int().min(1).max(100),
  privateRequestMinHeadcount: z.number().int().positive(),
  expectedVersion: z.number().int(),
});

export const basicTrainingQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  options: z.array(z.string()).min(2).max(8),
  correctIndex: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean().optional(),
});

export const basicTrainingModuleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  youtubeUrl: z.string(),
  requiredWatchPercent: z.number().int(),
  sortOrder: z.number().int(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  hasMaterial: z.boolean(),
  materialFileId: z.string().uuid().nullable().optional(),
  materialName: z.string().nullable().optional(),
  version: z.number().int(),
  completed: z.boolean().optional(),
  watchedSeconds: z.number().int().optional(),
  videoDurationSeconds: z.number().int().optional(),
  requiredWatchSeconds: z.number().int().nullable().optional(),
});

export const basicTrainingModuleWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).default(""),
  youtubeUrl: z.string().trim().max(200).default("").refine((value) => value === "" || youtubeVideoId(value) !== null, "請貼 YouTube 影片連結"),
  requiredWatchPercent: z.number().int().min(1).max(100).default(80),
  sortOrder: z.number().int().nonnegative().default(0),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  expectedVersion: z.number().int().optional(),
});

export const basicWatchProgressSchema = z.object({
  watchedSeconds: z.number().int().nonnegative().max(60 * 60 * 12),
  videoDurationSeconds: z.number().int().positive().max(60 * 60 * 12),
});

export const basicQuestionWriteSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(8),
  correctIndex: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().default(true),
});

export const basicQuizSessionSchema = z.object({
  attemptId: z.string().uuid(),
  drawCount: z.number().int(),
  passCount: z.number().int(),
  questions: z.array(basicTrainingQuestionSchema),
});

export const basicTrainingStatusSchema = z.object({
  policy: trainingPolicySchema,
  modules: z.array(basicTrainingModuleSchema),
  questionBankCount: z.number().int(),
  requiredComplete: z.boolean(),
  passed: z.boolean(),
  passedAt: z.string().datetime().nullable(),
  certificateNo: z.string().nullable(),
  hasCertificate: z.boolean(),
  lastCorrectCount: z.number().int().nullable(),
  lastDrawCount: z.number().int().nullable(),
  lastScorePercent: z.number().int().nullable(),
  canTakeQuiz: z.boolean(),
  activeAttempt: basicQuizSessionSchema.nullable(),
});

export const basicQuizSubmitSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedIndex: z.number().int().nonnegative(),
  })).min(1).max(100),
});

export const basicQuestionBankReplaceSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(8),
    correctIndex: z.number().int().nonnegative(),
  })).min(1).max(500),
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
export type BasicTrainingModule = z.infer<typeof basicTrainingModuleSchema>;
export type BasicTrainingQuestion = z.infer<typeof basicTrainingQuestionSchema>;
export type BasicQuizSession = z.infer<typeof basicQuizSessionSchema>;
export type CompanyTrainingRequest = z.infer<typeof companyTrainingRequestSchema>;
export type TrainingCertificate = z.infer<typeof trainingCertificateSchema>;
