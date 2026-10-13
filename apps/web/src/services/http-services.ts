import { FILE_POLICY, APP_NAME, DEMO_CONTACT_EMAIL } from "@mf/contracts";
import { ClientError, type Services } from "./types";

let csrfToken = "";

async function request(method: string, path: string, body?: unknown): Promise<{ data: unknown; meta?: Services extends never ? never : { page: number; pageSize: number; total: number; totalPages: number } }> {
  const headers = new Headers();
  const form = body instanceof FormData;
  if (!form && body !== undefined) headers.set("content-type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
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
    async certifications() {
      return (await request("GET", "/certifications/mine")).data as Awaited<ReturnType<Services["certifications"]>>;
    },
    async saveCertification(applicationId, input) {
      return (await request("POST", `/admin/applications/${applicationId}/certification`, input)).data as Awaited<ReturnType<Services["saveCertification"]>>;
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
    async recordPayment(input) {
      return (await request("POST", "/admin/payments", input)).data as Awaited<ReturnType<Services["recordPayment"]>>;
    },
    async myPayments() {
      return (await request("GET", "/payments")).data as Awaited<ReturnType<Services["myPayments"]>>;
    },
    async startCheckout(planId) {
      return (await request("POST", "/payments/checkout", { planId })).data as Awaited<ReturnType<Services["startCheckout"]>>;
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
    async myContracts() {
      return (await request("GET", "/contracts/mine")).data as Awaited<ReturnType<Services["myContracts"]>>;
    },
    async contract(id) {
      return (await request("GET", `/contracts/${id}`)).data as Awaited<ReturnType<Services["contract"]>>;
    },
    async signContract(id, input) {
      const form = new FormData();
      form.set("signerName", input.signerName);
      form.set("signerTitle", input.signerTitle);
      form.set("expectedVersion", String(input.expectedVersion));
      form.set("consent", "true");
      form.set("face", input.face, "face.jpg");
      form.set("signature", input.signature, "signature.png");
      return (await request("POST", `/contracts/${id}/sign`, form)).data as Awaited<ReturnType<Services["signContract"]>>;
    },
    async contractDocument(id) {
      const result = await request("GET", `/contracts/${id}/document`);
      return { blob: result.data as Blob, name: "contract.pdf" };
    },
    async contractSignature(id) {
      const result = await request("GET", `/contracts/${id}/signature`);
      return { blob: result.data as Blob, name: "signature.png" };
    },
    async contractFace(id) {
      const result = await request("GET", `/contracts/${id}/face`);
      return { blob: result.data as Blob, name: "face.jpg" };
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
    async issueContract(organizationId, templateId) {
      return (await request("POST", "/admin/contracts", { organizationId, templateId })).data as Awaited<ReturnType<Services["issueContract"]>>;
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
