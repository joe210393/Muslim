import { FILE_POLICY, APP_NAME, DEMO_CONTACT_EMAIL } from "@mf/contracts";
import { ClientError, type Services } from "./types";

let csrfToken = "";

async function request(method: string, path: string, body?: unknown): Promise<{ data: unknown; meta?: Services extends never ? never : { page: number; pageSize: number; total: number; totalPages: number } }> {
  const headers = new Headers();
  const form = body instanceof FormData;
  if (!form && body !== undefined) headers.set("content-type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    csrfToken = csrfCookie() || csrfToken;
    if (!csrfToken) await refreshCsrf();
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "include",
    body: form ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return { data: null };
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv") || contentType.includes("application/pdf") || contentType.startsWith("image/") || contentType.startsWith("video/")) {
    if (!response.ok) throw new ClientError("下載失敗", { status: response.status });
    return { data: await response.blob() };
  }
  const json = (await response.json()) as {
    success: boolean;
    data?: unknown;
    meta?: { page: number; pageSize: number; total: number; totalPages: number };
    error?: { code: string; message: string; fieldErrors?: { path: string; message: string }[] };
  };
  if (!json.success) {
    throw new ClientError(json.error?.message ?? "請求失敗", {
      code: json.error?.code,
      status: response.status,
      fieldErrors: json.error?.fieldErrors,
    });
  }
  return { data: json.data, meta: json.meta };
}

function csrfCookie() {
  const match = document.cookie.match(/(?:^|;\s*)mf_csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

async function refreshCsrf() {
  const result = await request("GET", "/auth/csrf");
  csrfToken = (result.data as { csrfToken: string }).csrfToken;
}

function page<T>(result: { data: unknown; meta?: { page: number; pageSize: number; total: number; totalPages: number } }) {
  return { items: result.data as T[], meta: result.meta ?? { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
}

export function createHttpServices(): Services {
  return {
    mode: "api",
    async config() {
      try {
        return (await request("GET", "/public-config")).data as Awaited<ReturnType<Services["config"]>>;
      } catch {
        return {
          appName: APP_NAME,
          dataMode: "api",
          demoMode: false,
          maxFileBytes: FILE_POLICY.maxFileBytes,
          maxApplicationBytes: FILE_POLICY.maxApplicationBytes,
          allowedMimeTypes: [...FILE_POLICY.allowedMimeTypes],
          contactEmail: DEMO_CONTACT_EMAIL,
          contactNote: "無法讀取公開設定。",
        };
      }
    },
    async login(email, password) {
      const result = await request("POST", "/auth/login", { email, password });
      const data = result.data as { user: Awaited<ReturnType<Services["login"]>>; csrfToken: string };
      csrfToken = data.csrfToken;
      return data.user;
    },
    async register(input) {
      const result = await request("POST", "/auth/register", input);
      const data = result.data as { user: Awaited<ReturnType<Services["login"]>>; csrfToken: string };
      csrfToken = data.csrfToken;
      return data.user;
    },
    async logout() {
      await request("POST", "/auth/logout");
      csrfToken = "";
    },
    async me() {
      try {
        return (await request("GET", "/auth/me")).data as Awaited<ReturnType<Services["me"]>>;
      } catch (error) {
        if (error instanceof ClientError && error.status === 401) return null;
        throw error;
      }
    },
    async forgot(email) {
      return (await request("POST", "/auth/forgot-password", { email })).data as { message: string };
    },
    async reset(token, password, confirmPassword) {
      return (await request("POST", "/auth/reset-password", { token, password, confirmPassword })).data as { message: string };
    },
    async changePassword(currentPassword, password, confirmPassword) {
      return (await request("POST", "/auth/change-password", { currentPassword, password, confirmPassword })).data as { message: string };
    },
    async organization() {
      return (await request("GET", "/organizations/me")).data as Awaited<ReturnType<Services["organization"]>>;
    },
    async updateOrganization(patch) {
      return (await request("PATCH", "/organizations/me", patch)).data as Awaited<ReturnType<Services["organization"]>>;
    },
    async categories() {
      return (await request("GET", "/application-categories")).data as Awaited<ReturnType<Services["categories"]>>;
    },
    async categoryForm(categoryId) {
      return (await request("GET", `/admin/application-categories/${categoryId}/form`)).data as Awaited<ReturnType<Services["categoryForm"]>>;
    },
    async saveCategoryFormDraft(categoryId, definition) {
      return (await request("PUT", `/admin/application-categories/${categoryId}/form-draft`, definition)).data as Awaited<ReturnType<Services["saveCategoryFormDraft"]>>;
    },
    async publishCategoryForm(categoryId, definition) {
      return (await request("POST", `/admin/application-categories/${categoryId}/form-publish`, definition)).data as Awaited<ReturnType<Services["publishCategoryForm"]>>;
    },
    async applications(query = {}) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      return page(await request("GET", `/applications?${params}`));
    },
    async application(id) {
      return (await request("GET", `/applications/${id}`)).data as Awaited<ReturnType<Services["application"]>>;
    },
    async createApplication(categoryId) {
      return (await request("POST", "/applications", { categoryId })).data as Awaited<ReturnType<Services["application"]>>;
    },
    async deleteDraft(id) {
      await request("DELETE", `/applications/${id}`);
    },
    async updateApplication(id, patch) {
      return (await request("PATCH", `/applications/${id}`, patch)).data as { version: number; updatedAt: string };
    },
    async submit(id, expectedVersion, requestId) {
      return (await request("POST", `/applications/${id}/submit`, { expectedVersion, requestId })).data as Awaited<ReturnType<Services["application"]>>;
    },
    async resubmit(id, expectedVersion, requestId) {
      return (await request("POST", `/applications/${id}/resubmit`, { expectedVersion, requestId })).data as Awaited<ReturnType<Services["application"]>>;
    },
    async assign(id, assignedToId, expectedVersion, requestId) {
      return (await request("POST", `/admin/applications/${id}/assign`, { assignedToId, expectedVersion, requestId })).data as Awaited<ReturnType<Services["application"]>>;
    },
    async review(id, input) {
      return (await request("POST", `/admin/applications/${id}/actions`, input)).data as Awaited<ReturnType<Services["application"]>>;
    },
    async saveFieldReviews(id, expectedVersion, fieldReviews) {
      return (await request("PUT", `/admin/applications/${id}/field-reviews`, { expectedVersion, fieldReviews })).data as Awaited<ReturnType<Services["saveFieldReviews"]>>;
    },
    async staffOptions() {
      return (await request("GET", "/admin/staff-options")).data as Awaited<ReturnType<Services["staffOptions"]>>;
    },
    async saveSiteCheck(id, input) {
      return (await request("PUT", `/admin/applications/${id}/site-checks`, input)).data as Awaited<ReturnType<Services["application"]>>;
    },
    async uploadSitePhoto(applicationId, requirementKey, file) {
      const form = new FormData();
      form.set("file", file);
      form.set("requirementKey", requirementKey);
      await request("POST", `/admin/applications/${applicationId}/site-photos`, form);
    },
    async events(id) {
      return (await request("GET", `/applications/${id}/events`)).data as Awaited<ReturnType<Services["events"]>>;
    },
    async submissions(id) {
      return (await request("GET", `/applications/${id}/submissions`)).data as Awaited<ReturnType<Services["submissions"]>>;
    },
    async upload(applicationId, requirementKey, file) {
      const form = new FormData();
      form.set("file", file);
      form.set("requirementKey", requirementKey);
      await request("POST", `/applications/${applicationId}/attachments`, form);
    },
    async removeAttachment(applicationId, attachmentId) {
      await request("DELETE", `/applications/${applicationId}/attachments/${attachmentId}`);
    },
    async download(fileId) {
      const result = await request("GET", `/files/${fileId}/download`);
      return { blob: result.data as Blob, name: "download" };
    },
    async summary() {
      const me = await this.me();
      if (!me) throw new ClientError("請先登入", { status: 401 });
      const path = me.role === "APPLICANT" ? "/portal/summary" : "/admin/summary";
      return (await request("GET", path)).data as Awaited<ReturnType<Services["summary"]>>;
    },
    async notices() {
      return (await request("GET", "/notifications")).data as Awaited<ReturnType<Services["notices"]>>;
    },
    async adminNotices() {
      return (await request("GET", "/admin/notifications")).data as Awaited<ReturnType<Services["adminNotices"]>>;
    },
    async mailTemplates() {
      return (await request("GET", "/admin/mail-templates")).data as Awaited<ReturnType<Services["mailTemplates"]>>;
    },
    async saveMailTemplate(key, input) {
      return (await request("PATCH", `/admin/mail-templates/${encodeURIComponent(key)}`, input)).data as Awaited<ReturnType<Services["saveMailTemplate"]>>;
    },
    async sendMail(input) {
      return (await request("POST", "/admin/notifications/send", input)).data as Awaited<ReturnType<Services["sendMail"]>>;
    },
    async organizationProfile(lookup) {
      const params = new URLSearchParams(Object.entries(lookup).filter((entry): entry is [string, string] => Boolean(entry[1])));
      return (await request("GET", `/admin/organization-profile?${params.toString()}`)).data as Awaited<ReturnType<Services["organizationProfile"]>>;
    },
    async organizationNotices(organizationId) {
      return (await request("GET", `/admin/organizations/${organizationId}/notifications`)).data as Awaited<ReturnType<Services["organizationNotices"]>>;
    },
    async courses(scope) {
      return (await request("GET", scope === "manage" ? "/admin/courses" : "/courses")).data as Awaited<ReturnType<Services["courses"]>>;
    },
    async course(id, scope = "public") {
      return (await request("GET", scope === "manage" ? `/admin/courses/${id}` : `/courses/${id}`)).data as Awaited<ReturnType<Services["course"]>>;
    },
    async saveCourse(input, id) {
      const result = id ? await request("PATCH", `/admin/courses/${id}`, input) : await request("POST", "/admin/courses", input);
      return result.data as Awaited<ReturnType<Services["course"]>>;
    },
    async enroll(courseId) {
      return (await request("POST", `/courses/${courseId}/enrollments`)).data as Awaited<ReturnType<Services["enroll"]>>;
    },
    async cancelEnrollment(id) {
      return (await request("POST", `/enrollments/${id}/cancel`)).data as Awaited<ReturnType<Services["enroll"]>>;
    },
    async learning() {
      return (await request("GET", "/learning-records/mine")).data as Awaited<ReturnType<Services["learning"]>>;
    },
    async courseEnrollments(courseId) {
      return page(await request("GET", `/admin/courses/${courseId}/enrollments?pageSize=50`)).items as Awaited<ReturnType<Services["courseEnrollments"]>>;
    },
    async attendance(id, input) {
      return (await request("PATCH", `/admin/enrollments/${id}/attendance`, input)).data as Awaited<ReturnType<Services["attendance"]>>;
    },
    async basicTrainingStatus() {
      return (await request("GET", "/training/basic")).data as Awaited<ReturnType<Services["basicTrainingStatus"]>>;
    },
    async recordBasicModuleWatch(moduleId, input) {
      return (await request("POST", `/training/basic/modules/${moduleId}/watch`, input)).data as Awaited<ReturnType<Services["recordBasicModuleWatch"]>>;
    },
    async startCourseQuiz(enrollmentId) {
      return (await request("POST", `/training/enrollments/${enrollmentId}/quiz/start`)).data as Awaited<ReturnType<Services["startCourseQuiz"]>>;
    },
    async submitCourseQuiz(enrollmentId, input) {
      return (await request("POST", `/training/enrollments/${enrollmentId}/quiz`, input)).data as Awaited<ReturnType<Services["submitCourseQuiz"]>>;
    },
    async downloadCourseMaterial(courseId) {
      const result = await request("GET", `/courses/${courseId}/material`);
      return { blob: result.data as Blob, name: "course-material" };
    },
    async uploadCourseMaterial(id, file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", `/admin/courses/${id}/material`, form)).data as Awaited<ReturnType<Services["uploadCourseMaterial"]>>;
    },
    async startBasicQuiz() {
      return (await request("POST", "/training/basic/quiz/start")).data as Awaited<ReturnType<Services["startBasicQuiz"]>>;
    },
    async submitBasicQuiz(input) {
      return (await request("POST", "/training/basic/quiz", input)).data as Awaited<ReturnType<Services["submitBasicQuiz"]>>;
    },
    async downloadBasicModuleMaterial(moduleId) {
      const result = await request("GET", `/training/basic/modules/${moduleId}/material`);
      return { blob: result.data as Blob, name: "basic-material" };
    },
    async trainingPolicy() {
      return (await request("GET", "/training/policy")).data as Awaited<ReturnType<Services["trainingPolicy"]>>;
    },
    async saveTrainingPolicy(input) {
      return (await request("PUT", "/admin/training/policy", input)).data as Awaited<ReturnType<Services["saveTrainingPolicy"]>>;
    },
    async adminBasicModules() {
      return (await request("GET", "/admin/training/basic-modules")).data as Awaited<ReturnType<Services["adminBasicModules"]>>;
    },
    async saveBasicModule(input, id) {
      const result = id ? await request("PUT", `/admin/training/basic-modules/${id}`, input) : await request("POST", "/admin/training/basic-modules", input);
      return result.data as Awaited<ReturnType<Services["saveBasicModule"]>>;
    },
    async uploadBasicModuleMaterial(id, file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", `/admin/training/basic-modules/${id}/material`, form)).data as Awaited<ReturnType<Services["uploadBasicModuleMaterial"]>>;
    },
    async adminQuestionBank() {
      return (await request("GET", "/admin/training/question-bank")).data as Awaited<ReturnType<Services["adminQuestionBank"]>>;
    },
    async replaceQuestionBank(input) {
      return (await request("PUT", "/admin/training/question-bank", input)).data as Awaited<ReturnType<Services["replaceQuestionBank"]>>;
    },
    async saveQuestion(input, id) {
      const result = id
        ? await request("PUT", `/admin/training/question-bank/questions/${id}`, input)
        : await request("POST", "/admin/training/question-bank/questions", input);
      return result.data as Awaited<ReturnType<Services["saveQuestion"]>>;
    },
    async deleteQuestion(id) {
      return (await request("DELETE", `/admin/training/question-bank/questions/${id}`)).data as Awaited<ReturnType<Services["deleteQuestion"]>>;
    },
    async uploadQuestionBank(file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", "/admin/training/question-bank/upload", form)).data as Awaited<ReturnType<Services["uploadQuestionBank"]>>;
    },
    async myCompanyTrainingRequests() {
      return (await request("GET", "/training/company-requests")).data as Awaited<ReturnType<Services["myCompanyTrainingRequests"]>>;
    },
    async saveCompanyTrainingRequest(input, id) {
      const result = id ? await request("PATCH", `/training/company-requests/${id}`, input) : await request("POST", "/training/company-requests", input);
      return result.data as Awaited<ReturnType<Services["saveCompanyTrainingRequest"]>>;
    },
    async submitCompanyTrainingRequest(id, expectedVersion) {
      return (await request("POST", `/training/company-requests/${id}/submit`, { expectedVersion })).data as Awaited<ReturnType<Services["submitCompanyTrainingRequest"]>>;
    },
    async adminCompanyTrainingRequests() {
      return (await request("GET", "/admin/training/company-requests")).data as Awaited<ReturnType<Services["adminCompanyTrainingRequests"]>>;
    },
    async reviewCompanyTrainingRequest(id, input) {
      return (await request("POST", `/admin/training/company-requests/${id}/review`, input)).data as Awaited<ReturnType<Services["reviewCompanyTrainingRequest"]>>;
    },
    async trainingCertificates() {
      return (await request("GET", "/admin/training/certificates")).data as Awaited<ReturnType<Services["trainingCertificates"]>>;
    },
    async registerTrainingCertificate(input) {
      return (await request("POST", "/admin/training/certificates", input)).data as Awaited<ReturnType<Services["registerTrainingCertificate"]>>;
    },
    async certificateTemplates() {
      return (await request("GET", "/admin/certificate-templates")).data as Awaited<ReturnType<Services["certificateTemplates"]>>;
    },
    async saveCertificateTemplate(key, input) {
      return (await request("PATCH", `/admin/certificate-templates/${encodeURIComponent(key)}`, input)).data as Awaited<ReturnType<Services["saveCertificateTemplate"]>>;
    },
    async uploadCertificateLogo(key, file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", `/admin/certificate-templates/${encodeURIComponent(key)}/logo`, form)).data as Awaited<ReturnType<Services["uploadCertificateLogo"]>>;
    },
    async uploadCertificateSignature(key, file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", `/admin/certificate-templates/${encodeURIComponent(key)}/signature`, form)).data as Awaited<ReturnType<Services["uploadCertificateSignature"]>>;
    },
    async certifications() {
      return (await request("GET", "/certifications/mine")).data as Awaited<ReturnType<Services["certifications"]>>;
    },
    async saveCertification(applicationId, input) {
      return (await request("POST", `/admin/applications/${applicationId}/certification`, input)).data as Awaited<ReturnType<Services["saveCertification"]>>;
    },
    async certificationDocument(applicationId) {
      const result = await request("GET", `/applications/${applicationId}/certification/document`);
      return { blob: result.data as Blob, name: "certificate.pdf" };
    },
    async users(q) {
      return page(await request("GET", `/admin/users?pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ""}`)).items as Awaited<ReturnType<Services["users"]>>;
    },
    async createUser(input) {
      await request("POST", "/admin/users", input);
    },
    async updateUser(id, input) {
      await request("PATCH", `/admin/users/${id}`, input);
    },
    async paymentDesk() {
      return (await request("GET", "/admin/payments")).data as Awaited<ReturnType<Services["paymentDesk"]>>;
    },
    async createPlan(input) {
      return (await request("POST", "/admin/plans", input)).data as Awaited<ReturnType<Services["createPlan"]>>;
    },
    async updatePlan(id, input) {
      return (await request("PATCH", `/admin/plans/${id}`, input)).data as Awaited<ReturnType<Services["updatePlan"]>>;
    },
    async deletePlan(id) {
      return (await request("DELETE", `/admin/plans/${id}`)).data as Awaited<ReturnType<Services["deletePlan"]>>;
    },
    async uploadPlanImage(planId, file, caption = "") {
      const form = new FormData();
      form.append("file", file);
      if (caption) form.append("caption", caption);
      return (await request("POST", `/admin/plans/${planId}/images`, form)).data as Awaited<ReturnType<Services["uploadPlanImage"]>>;
    },
    async removePlanImage(planId, imageId) {
      return (await request("DELETE", `/admin/plans/${planId}/images/${imageId}`)).data as Awaited<ReturnType<Services["removePlanImage"]>>;
    },
    async selectPlan(input) {
      return (await request("POST", "/payments/select-plan", input)).data as Awaited<ReturnType<Services["selectPlan"]>>;
    },
    async confirmReconciliation(input) {
      return (await request("POST", "/admin/payments/confirm-reconciliation", input)).data as Awaited<ReturnType<Services["confirmReconciliation"]>>;
    },
    async reviewPayment(input) {
      return (await request("POST", "/admin/payments/review", input)).data as Awaited<ReturnType<Services["reviewPayment"]>>;
    },
    async uploadPaymentReceipt(paymentId, file) {
      const form = new FormData();
      form.append("file", file);
      return (await request("POST", `/payments/${paymentId}/receipt`, form)).data as Awaited<ReturnType<Services["uploadPaymentReceipt"]>>;
    },
    async paymentReceipt(paymentId) {
      const result = await request("GET", `/payments/${paymentId}/receipt`);
      return { blob: result.data as Blob, name: "receipt" };
    },
    async markPaidPending(paymentId) {
      return (await request("POST", "/payments/pay", { paymentId })).data as Awaited<ReturnType<Services["markPaidPending"]>>;
    },
    async recordPayment(input) {
      return (await request("POST", "/admin/payments", input)).data as Awaited<ReturnType<Services["recordPayment"]>>;
    },
    async myPayments() {
      return (await request("GET", "/payments")).data as Awaited<ReturnType<Services["myPayments"]>>;
    },
    async startCheckout(paymentId) {
      return (await request("POST", "/payments/checkout", { paymentId })).data as Awaited<ReturnType<Services["startCheckout"]>>;
    },
    async organizations(q) {
      return page(await request("GET", `/admin/organizations?pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ""}`)).items as Awaited<ReturnType<Services["organizations"]>>;
    },
    async importTemplate(type) {
      const result = await request("GET", `/admin/imports/template/${type}`);
      return await (result.data as Blob).text();
    },
    async importPreview(type, csv) {
      return (await request("POST", "/admin/imports/preview", { type, csv })).data as Awaited<ReturnType<Services["importPreview"]>>;
    },
    async importCommit(id, requestId) {
      return (await request("POST", `/admin/imports/${id}/commit`, { requestId })).data as { committed?: number };
    },
    async exportApplications() {
      return await ((await request("GET", "/admin/applications/export")).data as Blob).text();
    },
    async savedReports() {
      return (await request("GET", "/admin/reports")).data as Awaited<ReturnType<Services["savedReports"]>>;
    },
    async saveReport(input, id) {
      return (await request(id ? "PATCH" : "POST", id ? `/admin/reports/${id}` : "/admin/reports", input)).data as Awaited<ReturnType<Services["saveReport"]>>;
    },
    async previewReport(input) {
      return (await request("POST", "/admin/reports/preview", input)).data as Awaited<ReturnType<Services["previewReport"]>>;
    },
    async deleteReport(id) {
      await request("DELETE", `/admin/reports/${id}`);
    },
    async exportReport(id) {
      return await ((await request("GET", `/admin/reports/${id}/export`)).data as Blob).text();
    },
    async exportEnrollments(courseId) {
      return await ((await request("GET", `/admin/courses/${courseId}/enrollments/export`)).data as Blob).text();
    },
    async audit(query) {
      const params = new URLSearchParams({ page: String(query?.page ?? 1), pageSize: "100" });
      if (query?.category && query.category !== "ALL") params.set("category", query.category);
      return page(await request("GET", `/admin/audit-logs?${params}`)) as Awaited<ReturnType<Services["audit"]>>;
    },
    async publicSite() {
      return (await request("GET", "/site-content")).data as Awaited<ReturnType<Services["publicSite"]>>;
    },
    async adminSite() {
      return (await request("GET", "/admin/site-content")).data as Awaited<ReturnType<Services["adminSite"]>>;
    },
    async saveSite(slot, input) {
      return (await request("PATCH", `/admin/site-content/${slot}`, input)).data as Awaited<ReturnType<Services["saveSite"]>>;
    },
    async uploadSiteImage(slot, file) {
      const form = new FormData();
      form.set("file", file);
      return (await request("POST", `/admin/site-content/${slot}/image`, form)).data as Awaited<ReturnType<Services["uploadSiteImage"]>>;
    },
    async uploadEntryImage(id, file) {
      const form = new FormData();
      form.set("file", file);
      return (await request("POST", `/admin/editorial/${id}/image`, form)).data as Awaited<ReturnType<Services["uploadEntryImage"]>>;
    },
    async uploadCourseImage(id, file) {
      const form = new FormData();
      form.set("file", file);
      return (await request("POST", `/admin/courses/${id}/image`, form)).data as Awaited<ReturnType<Services["uploadCourseImage"]>>;
    },
    async uploadCourseVideo(id, file, durationSeconds) {
      const form = new FormData();
      form.set("file", file);
      form.set("durationSeconds", String(durationSeconds));
      return (await request("POST", `/admin/courses/${id}/video`, form)).data as Awaited<ReturnType<Services["uploadCourseVideo"]>>;
    },
    async recordWatch(id, input) {
      return (await request("POST", `/enrollments/${id}/watch`, input)).data as Awaited<ReturnType<Services["recordWatch"]>>;
    },
    async courseVideo(id) {
      const result = await request("GET", `/enrollments/${id}/video`);
      return { blob: result.data as Blob, name: "course-video" };
    },
    async adminEntries() {
      return (await request("GET", "/admin/editorial")).data as Awaited<ReturnType<Services["adminEntries"]>>;
    },
    async createEntry(input) {
      return (await request("POST", "/admin/editorial", input)).data as Awaited<ReturnType<Services["createEntry"]>>;
    },
    async updateEntry(id, input) {
      return (await request("PATCH", `/admin/editorial/${id}`, input)).data as Awaited<ReturnType<Services["updateEntry"]>>;
    },
    async deleteEntry(id) {
      await request("DELETE", `/admin/editorial/${id}`);
    },
    async publicSitePages() {
      return (await request("GET", "/site-pages")).data as Awaited<ReturnType<Services["publicSitePages"]>>;
    },
    async adminSitePages() {
      return (await request("GET", "/admin/site-pages")).data as Awaited<ReturnType<Services["adminSitePages"]>>;
    },
    async createSitePage(input) {
      return (await request("POST", "/admin/site-pages", input)).data as Awaited<ReturnType<Services["createSitePage"]>>;
    },
    async updateSitePage(id, input) {
      return (await request("PATCH", `/admin/site-pages/${id}`, input)).data as Awaited<ReturnType<Services["updateSitePage"]>>;
    },
    async publishSitePage(id, expectedVersion) {
      return (await request("POST", `/admin/site-pages/${id}/publish`, { expectedVersion })).data as Awaited<ReturnType<Services["publishSitePage"]>>;
    },
    async unpublishSitePage(id, expectedVersion) {
      return (await request("POST", `/admin/site-pages/${id}/unpublish`, { expectedVersion })).data as Awaited<ReturnType<Services["unpublishSitePage"]>>;
    },
    async deleteSitePage(id, expectedVersion) {
      await request("DELETE", `/admin/site-pages/${id}?expectedVersion=${expectedVersion}`);
    },
    async reorderSitePages(input) {
      return (await request("POST", "/admin/site-pages/reorder", input)).data as Awaited<ReturnType<Services["reorderSitePages"]>>;
    },
    async uploadSitePageImage(file) {
      const form = new FormData();
      form.set("file", file);
      return (await request("POST", "/admin/site-pages/images", form)).data as Awaited<ReturnType<Services["uploadSitePageImage"]>>;
    },
    async myContracts() {
      return (await request("GET", "/contracts/mine")).data as Awaited<ReturnType<Services["myContracts"]>>;
    },
    async contract(id) {
      return (await request("GET", `/contracts/${id}`)).data as Awaited<ReturnType<Services["contract"]>>;
    },
    async uploadSignedContract(id, input) {
      const form = new FormData();
      form.set("expectedVersion", String(input.expectedVersion));
      form.set("pdf", input.pdf, "signed.pdf");
      return (await request("POST", `/contracts/${id}/upload-signed`, form)).data as Awaited<ReturnType<Services["uploadSignedContract"]>>;
    },
    async contractDocument(id) {
      const result = await request("GET", `/contracts/${id}/document`);
      return { blob: result.data as Blob, name: "contract.pdf" };
    },
    async recordRenewal(id, input) {
      return (await request("POST", `/contracts/${id}/renewal`, input)).data as Awaited<ReturnType<Services["recordRenewal"]>>;
    },
    async contractTemplates() {
      return (await request("GET", "/admin/contract-templates")).data as Awaited<ReturnType<Services["contractTemplates"]>>;
    },
    async createContractTemplate(input) {
      return (await request("POST", "/admin/contract-templates", input)).data as Awaited<ReturnType<Services["createContractTemplate"]>>;
    },
    async createContractTemplateVersion(id, input) {
      return (await request("POST", `/admin/contract-templates/${id}/versions`, input)).data as Awaited<ReturnType<Services["createContractTemplateVersion"]>>;
    },
    async saveContractTemplate(id, input) {
      return (await request("PATCH", `/admin/contract-templates/${id}`, input)).data as Awaited<ReturnType<Services["saveContractTemplate"]>>;
    },
    async adminContracts() {
      return (await request("GET", "/admin/contracts")).data as Awaited<ReturnType<Services["adminContracts"]>>;
    },
    async operationSetting() {
      return (await request("GET", "/operation-settings")).data as Awaited<ReturnType<Services["operationSetting"]>>;
    },
    async saveOperationSetting(input) {
      return (await request("PATCH", "/admin/operation-settings", input)).data as Awaited<ReturnType<Services["saveOperationSetting"]>>;
    },
    async systemConnection() {
      return (await request("GET", "/admin/system-connection")).data as Awaited<ReturnType<Services["systemConnection"]>>;
    },
    async saveSystemConnection(input) {
      return (await request("PATCH", "/admin/system-connection", input)).data as Awaited<ReturnType<Services["saveSystemConnection"]>>;
    },
    async issuableOrganizations() {
      return (await request("GET", "/admin/contracts/issuable-organizations")).data as Awaited<ReturnType<Services["issuableOrganizations"]>>;
    },
    async issueContract(input) {
      return (await request("POST", "/admin/contracts", input)).data as Awaited<ReturnType<Services["issueContract"]>>;
    },
    async reviseContract(id, input) {
      return (await request("PATCH", `/admin/contracts/${id}`, input)).data as Awaited<ReturnType<Services["reviseContract"]>>;
    },
    async recallContract(id, input) {
      return (await request("POST", `/admin/contracts/${id}/recall`, input)).data as Awaited<ReturnType<Services["recallContract"]>>;
    },
    async contractSeals() {
      return (await request("GET", "/contract-seals")).data as Awaited<ReturnType<Services["contractSeals"]>>;
    },
    async uploadContractSeal(kind, file) {
      const form = new FormData();
      form.set("file", file);
      return (await request("POST", `/admin/contract-seals/${kind}`, form)).data as Awaited<ReturnType<Services["uploadContractSeal"]>>;
    },
    async updateSealPositions(input) {
      return (await request("PATCH", "/admin/contract-seals/positions", input)).data as Awaited<ReturnType<Services["updateSealPositions"]>>;
    },
    async accessSettings() {
      return (await request("GET", "/admin/access")).data as Awaited<ReturnType<Services["accessSettings"]>>;
    },
    async updateFeature(input) {
      await request("PATCH", "/admin/access/features", input);
    },
    async updateIntegration(input) {
      await request("PATCH", "/admin/access/integrations", input);
    },
  };
}
