import type { ContentSlot, EditorialKind } from "@mf/contracts";
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
  ReportPreview,
  MyPayments,
  EcpayCheckout,
  PaymentDesk,
  PaymentItem,
  PaymentRecordWrite,
  SavedReport,
  SavedReportWrite,
  ServicePlanItem,
  ServicePlanUpdate,
  ServicePlanWrite,
} from "@mf/contracts";

export type Page<T> = { items: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

export type SiteSlot = {
  slot: ContentSlot;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  youtubeUrl: string;
  imageUrl: string | null;
};

export type AdminSiteSlot = SiteSlot & { isPublished: boolean; version: number; updatedAt: string };
export type EditorialEntry = {
  id: string;
  kind: EditorialKind;
  slug: string;
  groupLabel: string;
  title: string;
  summary: string;
  body: string;
  note: string;
  youtubeUrl: string;
  imageUrl: string | null;
  publishedOn: string | null;
  sortOrder: number;
};
export type AdminEditorialEntry = EditorialEntry & { isPublished: boolean; version: number; updatedAt: string };
export type EditorialWrite = Omit<EditorialEntry, "id" | "imageUrl"> & { isPublished: boolean };
export type EditorialUpdate = Omit<EditorialWrite, "kind" | "slug"> & { expectedVersion: number };
export type PublicSite = {
  hero: SiteSlot | null;
  banner: SiteSlot | null;
  about: SiteSlot | null;
  newsIntro: SiteSlot | null;
  verification: SiteSlot | null;
  faq: SiteSlot | null;
  entries: EditorialEntry[];
};
export type SiteSlotInput = {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  youtubeUrl: string;
  isPublished: boolean;
  expectedVersion: number;
};
export type ContractItem = {
  id: string;
  contractNo: string;
  organizationId: string;
  organizationName: string;
  title: string;
  status: "ISSUED" | "SIGNED" | "RENEWED" | "NOT_RENEWED" | "VOID";
  signerName: string | null;
  signerTitle: string | null;
  signedAt: string | null;
  hasSignature: boolean;
  hasFace: boolean;
  version: number;
  createdAt: string;
};
export type ContractTemplateItem = { id: string; code: string; title: string; body: string; revision: number; version: number; updatedAt: string };
export type AccessSettings = {
  accounts: Array<{
    id: string;
    email: string;
    displayName: string;
    isActive: boolean;
    features: Array<{ featureKey: string; label: string; enabled: boolean }>;
  }>;
  integrations: Array<{ key: string; label: string; provider: string; enabled: boolean; note: string }>;
};

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
  review: (id: string, input: { action: string; expectedVersion: number; requestId: string; publicComment?: string; internalNote?: string; fieldReviews?: ApplicationDetail["fieldReviews"] }) => Promise<ApplicationDetail>;
  saveFieldReviews: (id: string, expectedVersion: number, fieldReviews: ApplicationDetail["fieldReviews"]) => Promise<ApplicationDetail>;
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
  createUser: (input: { email: string; displayName: string; password: string; features: string[] }) => Promise<void>;
  updateUser: (id: string, input: { isActive?: boolean; role?: "CASE_OFFICER" | "ADMIN" }) => Promise<void>;
  organizations: (q?: string) => Promise<Organization[]>;
  paymentDesk: () => Promise<PaymentDesk>;
  createPlan: (input: ServicePlanWrite) => Promise<ServicePlanItem>;
  updatePlan: (id: string, input: ServicePlanUpdate) => Promise<ServicePlanItem>;
  recordPayment: (input: PaymentRecordWrite) => Promise<PaymentItem>;
  myPayments: () => Promise<MyPayments>;
  startCheckout: (planId: string) => Promise<EcpayCheckout>;
  importTemplate: (type: "ORGANIZATIONS" | "APPLICATION_DRAFTS") => Promise<string>;
  importPreview: (type: "ORGANIZATIONS" | "APPLICATION_DRAFTS", csv: string) => Promise<ImportPreview>;
  importCommit: (id: string, requestId: string) => Promise<{ committed?: number }>;
  exportApplications: () => Promise<string>;
  savedReports: () => Promise<SavedReport[]>;
  saveReport: (input: SavedReportWrite, id?: string) => Promise<SavedReport>;
  previewReport: (input: Pick<SavedReportWrite, "selections">) => Promise<ReportPreview>;
  deleteReport: (id: string) => Promise<void>;
  exportReport: (id: string) => Promise<string>;
  exportEnrollments: (courseId: string) => Promise<string>;
  audit: (query?: { page?: number; category?: string }) => Promise<{ items: AuditLog[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }>;
  publicSite: () => Promise<PublicSite>;
  adminSite: () => Promise<AdminSiteSlot[]>;
  saveSite: (slot: ContentSlot, input: SiteSlotInput) => Promise<AdminSiteSlot>;
  uploadSiteImage: (slot: ContentSlot, file: File) => Promise<AdminSiteSlot>;
  uploadEntryImage: (id: string, file: File) => Promise<AdminEditorialEntry>;
  uploadCourseImage: (id: string, file: File) => Promise<Course>;
  uploadCourseVideo: (id: string, file: File, durationSeconds: number) => Promise<Course>;
  recordWatch: (id: string, input: { expectedVersion: number; watchedSeconds: number }) => Promise<LearningRecord>;
  courseVideo: (id: string) => Promise<{ blob: Blob; name: string }>;
  adminEntries: () => Promise<AdminEditorialEntry[]>;
  createEntry: (input: EditorialWrite) => Promise<AdminEditorialEntry>;
  updateEntry: (id: string, input: EditorialUpdate) => Promise<AdminEditorialEntry>;
  deleteEntry: (id: string) => Promise<void>;
  myContracts: () => Promise<ContractItem[]>;
  contract: (id: string) => Promise<ContractItem & { body: string }>;
  signContract: (id: string, input: { signerName: string; signerTitle: string; expectedVersion: number; face: Blob; signature: Blob }) => Promise<ContractItem & { body: string }>;
  contractDocument: (id: string) => Promise<{ blob: Blob; name: string }>;
  contractSignature: (id: string) => Promise<{ blob: Blob; name: string }>;
  contractFace: (id: string) => Promise<{ blob: Blob; name: string }>;
  recordRenewal: (id: string, input: { decision: "RENEWED" | "NOT_RENEWED"; expectedVersion: number }) => Promise<ContractItem & { body: string }>;
  contractTemplates: () => Promise<ContractTemplateItem[]>;
  createContractTemplate: (input: { title: string; body: string }) => Promise<ContractTemplateItem>;
  createContractTemplateVersion: (id: string, input: { title: string; body: string }) => Promise<ContractTemplateItem>;
  saveContractTemplate: (id: string, input: { title: string; body: string; expectedVersion: number }) => Promise<ContractTemplateItem>;
  adminContracts: () => Promise<ContractItem[]>;
  issueContract: (organizationId: string, templateId: string) => Promise<ContractItem>;
  accessSettings: () => Promise<AccessSettings>;
  updateFeature: (input: { userId: string; featureKey: string; enabled: boolean }) => Promise<void>;
  updateIntegration: (input: { key: string; provider: string; enabled: boolean; note: string }) => Promise<void>;
  resetDemo?: () => Promise<void>;
  demoAccounts?: () => Array<{ email: string; label: string }>;
  switchDemoUser?: (email: string) => Promise<PublicUser>;
};
