import type {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationPatch,
  AuditLog,
  CategorySummary,
  Certification,
  Course,
  CourseWrite,
  DashboardCounts,
  ImportPreview,
  LearningRecord,
  Organization,
  OrganizationPatch,
  PublicConfig,
  PublicUser,
} from "@mf/contracts";

export type Page<T> = { items: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

export class ClientError extends Error {
  fieldErrors?: { path: string; message: string }[];
  code?: string;
  status?: number;
  constructor(message: string, extra?: { fieldErrors?: { path: string; message: string }[]; code?: string; status?: number }) {
    super(message);
    this.fieldErrors = extra?.fieldErrors;
    this.code = extra?.code;
    this.status = extra?.status;
  }
}

export type Services = {
  mode: "mock" | "api";
  config: () => Promise<PublicConfig>;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (input: { displayName: string; email: string; password: string; confirmPassword: string; organizationName: string; taxId: string }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  me: () => Promise<PublicUser | null>;
  forgot: (email: string) => Promise<{ message: string; demoResetUrl?: string }>;
  reset: (token: string, password: string, confirmPassword: string) => Promise<{ message: string }>;
  changePassword: (currentPassword: string, password: string, confirmPassword: string) => Promise<{ message: string }>;
  organization: () => Promise<Organization>;
  updateOrganization: (patch: OrganizationPatch) => Promise<Organization>;
  categories: () => Promise<CategorySummary[]>;
  applications: (query?: { q?: string; status?: string; categoryId?: string; page?: number }) => Promise<Page<ApplicationListItem>>;
  application: (id: string) => Promise<ApplicationDetail>;
  createApplication: (categoryId: string) => Promise<ApplicationDetail>;
  updateApplication: (id: string, patch: ApplicationPatch) => Promise<{ version: number; updatedAt: string }>;
  submit: (id: string, expectedVersion: number, requestId: string) => Promise<ApplicationDetail>;
  resubmit: (id: string, expectedVersion: number, requestId: string) => Promise<ApplicationDetail>;
  assign: (id: string, assignedToId: string, expectedVersion: number, requestId: string) => Promise<ApplicationDetail>;
  review: (id: string, input: { action: string; expectedVersion: number; requestId: string; publicComment?: string; internalNote?: string }) => Promise<ApplicationDetail>;
  events: (id: string) => Promise<Array<{ id: string; action: string; publicComment: string | null; internalNote: string | null; actorName: string; createdAt: string; fromStatus: string | null; toStatus: string | null }>>;
  submissions: (id: string) => Promise<Array<{ id: string; revision: number; submittedAt: string; payloadSnapshot: Record<string, unknown> }>>;
  upload: (applicationId: string, requirementKey: string, file: File) => Promise<void>;
  removeAttachment: (applicationId: string, attachmentId: string) => Promise<void>;
  download: (fileId: string) => Promise<{ blob: Blob; name: string }>;
  summary: () => Promise<DashboardCounts>;
  courses: (scope: "public" | "manage") => Promise<Course[]>;
  course: (id: string, scope?: "public" | "manage") => Promise<Course>;
  saveCourse: (input: CourseWrite, id?: string) => Promise<Course>;
  enroll: (courseId: string) => Promise<LearningRecord>;
  cancelEnrollment: (id: string) => Promise<LearningRecord>;
  learning: () => Promise<LearningRecord[]>;
  courseEnrollments: (courseId: string) => Promise<LearningRecord[]>;
  attendance: (id: string, input: { expectedVersion: number; attendanceStatus: "NOT_RECORDED" | "PRESENT" | "ABSENT"; attendedMinutes: number }) => Promise<LearningRecord>;
  certifications: () => Promise<Certification[]>;
  saveCertification: (applicationId: string, input: { certificateNo: string; issuedOnDate: string; validUntilDate: string }) => Promise<Certification>;
  users: (q?: string) => Promise<Array<{ id: string; email: string; displayName: string; role: string; organizationName: string | null; isActive: boolean }>>;
  createUser: (input: { email: string; displayName: string; password: string; role: "CASE_OFFICER" | "ADMIN" }) => Promise<void>;
  updateUser: (id: string, input: { isActive?: boolean; role?: "CASE_OFFICER" | "ADMIN" }) => Promise<void>;
  organizations: (q?: string) => Promise<Organization[]>;
  importTemplate: (type: "ORGANIZATIONS" | "APPLICATION_DRAFTS") => Promise<string>;
  importPreview: (type: "ORGANIZATIONS" | "APPLICATION_DRAFTS", csv: string) => Promise<ImportPreview>;
  importCommit: (id: string, requestId: string) => Promise<{ committed?: number }>;
  exportApplications: () => Promise<string>;
  exportEnrollments: (courseId: string) => Promise<string>;
  audit: () => Promise<AuditLog[]>;
  resetDemo?: () => Promise<void>;
  demoAccounts?: () => Array<{ email: string; label: string }>;
  switchDemoUser?: (email: string) => Promise<PublicUser>;
};
