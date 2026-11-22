import { AUDIT_CATEGORIES, applicationStatusLabels, auditActionLabel, auditCategoryDetail, auditCategoryOf, auditEntityLabel, companyTrainingRequestStatusLabels, contractStatusLabels, courseDeliveryLabels, courseStatusLabels, daysUntilContractExpiry, formatTwd, isContractRenewalDue, layoutCertificateRowsHtml, matchCertificateTemplates, type ApplicationDetail, type CourseStatus, type StatusTone } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { ApplicationReview } from "./ApplicationReview";
import { AdminPageHeader, Badge, Button, Card, DataTable, Empty, ErrorText, Field, Pager, SectionHeader, SelectInput, StatCard, TextArea, TextInput, tableRowClass, NoticeText, failNotice, type Notice } from "../../components/ui";
import { PermissionsPage, SiteReviewBody } from "./InfoAdminPages";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";
import type { NavFromState } from "../../components/shell/Shell";

type TodoItem = { key: string; kind: string; tone: StatusTone; subject: string; detail: string; since: string | null; href: string; navFrom?: string };

const DAY_MS = 86_400_000;

function waitingLabel(since: string | null) {
  if (!since) return "—";
  const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS);
  return days <= 0 ? "今天" : `${days} 天`;
}

function ModulePanel({ title, href, rows, footer }: { title: string; href: string; rows: Array<{ label: string; value: ReactNode; href?: string; tone?: "warning" }>; footer?: ReactNode }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <Link className="text-sm text-[var(--link)] underline" to={href}>管理</Link>
      </div>
      <dl className="divide-y divide-[var(--line)] text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-[var(--muted)]">{row.href ? <Link className="text-[var(--muted)] no-underline hover:underline" to={row.href}>{row.label}</Link> : row.label}</dt>
            <dd className={`font-semibold ${row.tone === "warning" ? "text-[var(--warn)]" : ""}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer}
    </Card>
  );
}

export function AdminHome() {
  const services = useServices();
  const session = useSession();
  const features = new Set(session.user?.featureKeys ?? []);
  const canReview = features.has("applications.review") || features.has("applications.decide");
  const canDecide = features.has("applications.decide");
  const canPay = features.has("payments.manage");
  const canContract = features.has("contracts.issue");
  const canTraining = features.has("training.manage");
  const canAudit = features.has("audit.view");
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => services.summary() });
  const queue = useQuery({ queryKey: ["admin-applications", "", "ALL"], queryFn: () => services.applications({ page: 1 }), enabled: canReview });
  const toCertify = useQuery({ queryKey: ["admin-applications", "", "APPROVED", "pending", 1], queryFn: () => services.applications({ status: "APPROVED", certification: "pending", page: 1 }), enabled: canDecide });
  const payments = useQuery({ queryKey: ["payment-desk"], queryFn: () => services.paymentDesk(), enabled: canPay });
  const contracts = useQuery({ queryKey: ["admin-contracts"], queryFn: () => services.adminContracts(), enabled: canContract });
  const requests = useQuery({ queryKey: ["admin-company-training"], queryFn: () => services.adminCompanyTrainingRequests(), enabled: canTraining });
  const audit = useQuery({ queryKey: ["audit", "ALL", 1], queryFn: () => services.audit({ page: 1, category: "ALL" }), enabled: canAudit });
  if (summary.isLoading) return <p>載入中…</p>;
  if (!summary.data) return <ErrorText message="無法載入工作總覽" />;
  const data = summary.data;
  const inReview = data.submitted + data.initialReview + data.secondReview + data.finalReview;
  const allContracts = contracts.data ?? [];
  const pendingContracts = allContracts.filter((item) => item.status === "ISSUED");
  const renewableContracts = allContracts.filter((item) => item.status === "SIGNED" && isContractRenewalDue(item.signedAt));
  const signedCount = allContracts.filter((item) => item.status === "SIGNED" || item.status === "RENEWED").length;
  const notRenewedCount = allContracts.filter((item) => item.status === "NOT_RENEWED").length;
  const awaiting = payments.data?.awaitingReconciliation ?? [];
  const pendingRequests = (requests.data ?? []).filter((item) => item.status === "SUBMITTED");

  const todos: TodoItem[] = [
    ...(queue.data?.items ?? [])
      .filter((item) => item.status === "SUBMITTED" || item.status === "FINAL_REVIEW")
      .map((item) => ({
        key: `app-${item.id}`,
        kind: item.status === "SUBMITTED" ? "待派案" : "待核定",
        tone: applicationStatusLabels[item.status].tone,
        subject: item.organizationName,
        detail: `${item.applicationNo} · ${item.categoryName}`,
        since: item.status === "SUBMITTED" ? item.submittedAt : item.updatedAt,
        href: `/admin/applications/${item.id}`,
      })),
    ...(toCertify.data?.items ?? []).map((item) => ({
      key: `cert-${item.id}`,
      kind: "待發證",
      tone: "warning" as const,
      subject: item.organizationName,
      detail: `${item.applicationNo} · ${item.categoryName}`,
      since: item.updatedAt,
      href: `/admin/applications/${item.id}`,
      navFrom: "/admin/certificates",
    })),
    ...awaiting.map((row) => ({
      key: `pay-${row.id}`,
      kind: "待核帳",
      tone: "warning" as const,
      subject: row.organizationName,
      detail: `${row.planName} · ${formatTwd(row.amount)}`,
      since: row.paidAt,
      href: "/admin/payments/reconciliation",
    })),
    ...pendingRequests.map((row) => ({
      key: `req-${row.id}`,
      kind: "專班申請",
      tone: companyTrainingRequestStatusLabels.SUBMITTED.tone,
      subject: row.organizationName,
      detail: `${row.headcount} 人 · ${courseDeliveryLabels[row.delivery].label} · ${row.preferredStartsOn}`,
      since: row.submittedAt,
      href: "/admin/training/company-requests",
    })),
    ...pendingContracts.map((row) => ({
      key: `con-${row.id}`,
      kind: "待業者回傳合約",
      tone: contractStatusLabels.ISSUED.tone,
      subject: row.organizationName,
      detail: `${row.contractNo} · ${row.title}`,
      since: row.createdAt,
      href: "/admin/contracts?tab=pending",
    })),
    ...renewableContracts.map((row) => ({
      key: `renew-${row.id}`,
      kind: "合約即將到期",
      tone: "warning" as const,
      subject: row.organizationName,
      detail: `${row.contractNo} · 約 ${row.signedAt ? daysUntilContractExpiry(row.signedAt) : "—"} 天到期`,
      since: row.signedAt,
      href: "/admin/contracts?tab=renewable",
    })),
  ].sort((left, right) => (left.since ?? "").localeCompare(right.since ?? ""));
  const shownTodos = todos.slice(0, 10);

  const kpis = [
    canReview ? { label: "審查中案件", value: inReview, hint: `待核定 ${data.finalReview} · 待補件 ${data.needSupplement}`, to: "/admin/applications" } : null,
    canDecide ? { label: "待發證", value: toCertify.data?.meta.total ?? 0, hint: `已核定 ${data.approved}`, to: "/admin/certificates" } : null,
    canPay ? { label: "待核帳", value: awaiting.length, hint: payments.data ? `${payments.data.monthLabel}已核帳 ${formatTwd(payments.data.paidAmount)}` : undefined, to: "/admin/payments/reconciliation" } : null,
    canContract ? { label: "待業者回傳合約", value: pendingContracts.length, hint: `即將到期 ${renewableContracts.length}`, to: "/admin/contracts?tab=pending" } : null,
    canTraining ? { label: "專班待審", value: pendingRequests.length, hint: `近期梯次 ${data.upcomingCourses}`, to: "/admin/training/company-requests" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const pipeline = caseReviewStatuses.map(([id, label, , href]) => ({
    id,
    label,
    href,
    count: {
      SUBMITTED: data.submitted,
      INITIAL_REVIEW: data.initialReview,
      NEED_SUPPLEMENT: data.needSupplement,
      SECOND_REVIEW: data.secondReview,
      FINAL_REVIEW: data.finalReview,
      APPROVED: data.approved,
      REJECTED: data.rejected,
    }[id],
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="工作總覽"
        description="今天要處理的事都在這裡。點數字或「前往」可直接進到該清單。"
        actions={
          <>
            {canContract ? <Link to="/admin/contracts/issue" className="btn rounded-md px-3 py-2 text-sm no-underline">發送合約</Link> : null}
            {canPay ? <Link to="/admin/payments/record" className="btn rounded-md px-3 py-2 text-sm no-underline">登錄付款</Link> : null}
            {canTraining ? <Link to="/admin/courses/new" className="btn rounded-md px-3 py-2 text-sm no-underline">＋ 新增課程</Link> : null}
          </>
        }
      />

      {kpis.length ? (
        <div className={`grid grid-cols-2 gap-3 ${kpis.length >= 5 ? "lg:grid-cols-5" : kpis.length === 4 ? "lg:grid-cols-4" : kpis.length === 3 ? "lg:grid-cols-3" : ""}`}>
          {kpis.map((item) => <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} to={item.to} tone={item.value > 0 ? "warning" : undefined} />)}
        </div>
      ) : null}

      <section className="space-y-3">
        <SectionHeader title="待辦事項" hint={todos.length ? `共 ${todos.length} 項，等候最久的排在前面。` : "目前沒有待辦。"} />
        {todos.length === 0 ? (
          <Empty title="都處理完了" body="新的送件、付款、專班申請或合約回傳會出現在這裡。" />
        ) : (
          <DataTable columns={["類型", "對象", "內容", "已等候", "操作"]}>
            {shownTodos.map((item) => (
              <tr key={item.key} className={tableRowClass}>
                <td className="p-3"><Badge tone={item.tone}>{item.kind}</Badge></td>
                <td className="p-3 font-medium">{item.subject}</td>
                <td className="p-3">{item.detail}</td>
                <td className="p-3 whitespace-nowrap">{waitingLabel(item.since)}</td>
                <td className="p-3"><Link className="text-[var(--link)] underline" to={item.href} state={item.navFrom ? ({ navFrom: item.navFrom } satisfies NavFromState) : undefined}>前往</Link></td>
              </tr>
            ))}
          </DataTable>
        )}
        {todos.length > shownTodos.length ? <p className="text-sm text-[var(--muted)]">只列出前 {shownTodos.length} 項，其餘請到各模組清單查看。</p> : null}
      </section>

      {canReview ? (
        <section className="space-y-3">
          <SectionHeader title="案件流程" hint="各審查階段的案件數。" actions={<Button variant="secondary" onClick={async () => downloadText("applications.csv", await services.exportApplications())}>匯出 CSV</Button>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {pipeline.map((item) => <StatCard key={item.id} label={item.label} value={item.count} to={item.href} />)}
          </div>
        </section>
      ) : null}

      {canContract || canPay || canTraining ? (
        <section className="space-y-3">
          <SectionHeader title="模組狀態" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {canContract ? (
              <ModulePanel
                title="合約"
                href="/admin/contracts"
                rows={[
                  { label: "待業者回傳", value: pendingContracts.length, href: "/admin/contracts?tab=pending", tone: pendingContracts.length ? "warning" : undefined },
                  { label: "已簽約", value: signedCount, href: "/admin/contracts?tab=signed" },
                  { label: "即將到期可續約", value: renewableContracts.length, href: "/admin/contracts?tab=renewable", tone: renewableContracts.length ? "warning" : undefined },
                  { label: "未續約", value: notRenewedCount, href: "/admin/contracts?tab=not_renewed" },
                ]}
              />
            ) : null}
            {canPay && payments.data ? (
              <ModulePanel
                title="方案與付款"
                href="/admin/payments/plans"
                rows={[
                  { label: "待核帳", value: awaiting.length, href: "/admin/payments/reconciliation", tone: awaiting.length ? "warning" : undefined },
                  { label: `${payments.data.monthLabel}成交`, value: `${payments.data.dealCount} 筆`, href: "/admin/payments" },
                  { label: `${payments.data.monthLabel}已核帳`, value: formatTwd(payments.data.paidAmount), href: "/admin/payments" },
                  { label: "開放中方案", value: payments.data.plans.filter((plan) => plan.isActive).length, href: "/admin/payments/plans" },
                ]}
              />
            ) : null}
            {canTraining ? (
              <ModulePanel
                title="教育訓練"
                href="/admin/courses"
                rows={[
                  { label: "專班待審", value: pendingRequests.length, href: "/admin/training/company-requests", tone: pendingRequests.length ? "warning" : undefined },
                  { label: "近期梯次", value: data.upcomingCourses, href: "/admin/courses" },
                ]}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeader title="近期課程" actions={canTraining ? <Link className="text-sm text-[var(--link)] underline" to="/admin/courses">全部課程</Link> : null} />
        {data.upcoming.length === 0 ? <Empty title="沒有近期課程" body="公開新的梯次後會出現在這裡。" /> : (
          <DataTable columns={["課程", "開始時間", "地點"]}>
            {data.upcoming.map((course) => (
              <tr key={course.id} className={tableRowClass}>
                <td className="p-3 font-medium">{canTraining ? <Link className="text-[var(--link)]" to={`/admin/courses/${course.id}/edit`}>{course.title}</Link> : course.title}</td>
                <td className="p-3">{formatTaipei(course.startsAt)}</td>
                <td className="p-3">{course.location || "線上"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {canAudit ? (
        <section className="space-y-3">
          <SectionHeader title="最近操作" actions={<Link className="text-sm text-[var(--link)] underline" to="/admin/audit-logs">全部紀錄</Link>} />
          {(audit.data?.items.length ?? 0) === 0 ? <Empty title="尚無紀錄" body="最近 30 天沒有操作。" /> : (
            <DataTable columns={["時間", "人員", "動作", "對象"]}>
              {audit.data?.items.slice(0, 8).map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  <td className="p-3 whitespace-nowrap">{formatTaipei(row.createdAt)}</td>
                  <td className="p-3">{row.actorName ?? "系統"}</td>
                  <td className="p-3">{auditActionLabel(row.action)}</td>
                  <td className="p-3">{auditEntityLabel(row.entityType)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ) : null}
    </div>
  );
}

const caseReviewStatuses = [
  ["SUBMITTED", "已送件", "業者剛送出，還沒開始審文件。", "/admin/applications"],
  ["INITIAL_REVIEW", "初審中", "承辦正在看文件。還沒到核定。", "/admin/applications/initial-review"],
  ["NEED_SUPPLEMENT", "待補件", "退回業者改指定欄位。改完送回當初要求補件的階段。", "/admin/applications/need-supplement"],
  ["SECOND_REVIEW", "複審中", "初審通過後，指定的複審人員在這裡做現場複審。通過後仍留在案件審查，進入待核定。", "/admin/applications/second-review"],
  ["FINAL_REVIEW", "待核定", "初審和現場複審都過了，等管理員核定或退件。", "/admin/applications/final-review"],
  ["APPROVED", "已核定", "管理員已核定。可依類別／項目發證書。", "/admin/applications/approved"],
  ["REJECTED", "已退件", "管理員已退件，案件結束。", "/admin/applications/rejected"],
] as const;

const caseReviewStatusByPath: Record<string, (typeof caseReviewStatuses)[number][0]> = {
  "/admin/applications": "SUBMITTED",
  "/admin/applications/initial-review": "INITIAL_REVIEW",
  "/admin/applications/need-supplement": "NEED_SUPPLEMENT",
  "/admin/applications/second-review": "SECOND_REVIEW",
  "/admin/applications/final-review": "FINAL_REVIEW",
  "/admin/applications/approved": "APPROVED",
  "/admin/applications/rejected": "REJECTED",
};

export function AdminApplicationList() {
  const services = useServices();
  const location = useLocation();
  const [params] = useSearchParams();
  const fromPath = caseReviewStatusByPath[location.pathname];
  const requested = params.get("status");
  const status =
    fromPath
    ?? (caseReviewStatuses.some(([id]) => id === requested) ? (requested as (typeof caseReviewStatuses)[number][0]) : "SUBMITTED");
  const stage = caseReviewStatuses.find(([id]) => id === status);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status]);
  const query = useQuery({ queryKey: ["admin-applications", q, status, page], queryFn: () => services.applications({ q, status, page }) });
  const items = query.data?.items ?? [];
  const meta = query.data?.meta;
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="案件審查"
        description="業者送出的驗證申請依審查階段分開處理。點案件編號進入送件表審查。"
        actions={<Button variant="secondary" onClick={async () => downloadText("applications.csv", await services.exportApplications())}>匯出 CSV</Button>}
      />
      <SectionHeader
        title={`${stage?.[1] ?? "已送件"}案件`}
        hint={stage?.[2]}
        actions={<TextInput className="w-56" placeholder="搜尋編號或業者" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} aria-label="搜尋案件" />}
      />
      {query.isLoading ? <p>載入中…</p> : null}
      {!query.isLoading && items.length === 0 ? <Empty title="沒有符合的案件" body="這裡只看已送出的案件。草稿留在業者會員區。" /> : null}
      {items.length > 0 ? (
        <DataTable columns={["編號", "業者", "類別", "承辦", ...(status === "SECOND_REVIEW" ? ["複審人員"] : []), "送件時間", "狀態", "操作"]}>
          {items.map((item) => (
            <tr key={item.id} className={tableRowClass}>
              <td className="p-3 font-medium">{item.applicationNo}</td>
              <td className="p-3">{item.organizationName}</td>
              <td className="p-3">{item.categoryName}</td>
              <td className="p-3">{item.assignedToName ?? "未派案"}</td>
              {status === "SECOND_REVIEW" ? <td className="p-3">{item.siteReviewerName ?? "未指定"}</td> : null}
              <td className="p-3 whitespace-nowrap">{formatTaipei(item.submittedAt)}</td>
              <td className="p-3"><Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge></td>
              <td className="p-3"><Link className="text-[var(--link)] underline" to={`/admin/applications/${item.id}`} state={{ navFrom: location.pathname } satisfies NavFromState}>審查</Link></td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {meta && items.length > 0 ? <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} /> : null}
    </div>
  );
}

export function AdminCertificatesPage() {
  const services = useServices();
  const location = useLocation();
  const part: "pending" | "issued" = location.pathname.endsWith("/issued") ? "issued" : "pending";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [part]);
  const query = useQuery({ queryKey: ["admin-applications", q, "APPROVED", part, page], queryFn: () => services.applications({ q, status: "APPROVED", certification: part, page }) });
  const items = query.data?.items ?? [];
  const meta = query.data?.meta;
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="電子證書"
        description="管理員核定後的案件在這裡發證。進入案件選擇證書範本、填證書編號與效期，儲存後移到「已發證」，業者即可下載 PDF。"
      />
      <SectionHeader
        title={part === "pending" ? "待發證案件" : "已發證案件"}
        hint={meta ? `共 ${meta.total} 件` : undefined}
        actions={<TextInput className="w-56" placeholder="搜尋編號或業者" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} aria-label="搜尋證書案件" />}
      />
      {query.isLoading ? <p>載入中…</p> : null}
      {!query.isLoading && items.length === 0 ? (
        <Empty
          title={part === "pending" ? "沒有待發證案件" : "還沒有已發證案件"}
          body={part === "pending" ? "核定後尚未發證的案件會出現在這裡。" : "在待發證案件裡發證並儲存後會移到這裡。"}
        />
      ) : null}
      {items.length > 0 ? (
        <DataTable columns={["編號", "業者", "類別", "承辦", ...(part === "issued" ? ["證書編號"] : []), "案件最後更新", "操作"]}>
          {items.map((item) => (
            <tr key={item.id} className={tableRowClass}>
              <td className="p-3 font-medium whitespace-nowrap">{item.applicationNo}</td>
              <td className="p-3">{item.organizationName}</td>
              <td className="p-3">{item.categoryName}</td>
              <td className="p-3">{item.assignedToName ?? "—"}</td>
              {part === "issued" ? <td className="p-3 break-all">{item.certificateNo}</td> : null}
              <td className="p-3 whitespace-nowrap">{formatTaipei(item.updatedAt)}</td>
              <td className="p-3 whitespace-nowrap"><Link className="text-[var(--link)] underline" to={`/admin/applications/${item.id}`} state={{ navFrom: location.pathname } satisfies NavFromState}>{part === "pending" ? "發證" : "查看／下載"}</Link></td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {meta && items.length > 0 ? <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} /> : null}
    </div>
  );
}

export function AdminApplicationDetail() {
  const { applicationId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const navFrom = (useLocation().state as NavFromState | null)?.navFrom;
  const [flash, setFlash] = useState<Notice>(null);
  const application = useQuery({ queryKey: ["application", applicationId], queryFn: () => services.application(applicationId) });
  if (!application.data) return application.isLoading ? <p>載入中…</p> : <ErrorText message="找不到案件" />;
  const item = application.data;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["application", applicationId] });
    await client.invalidateQueries({ queryKey: ["events", applicationId] });
  };
  const leadMain = item.status === "APPROVED" ? <Card id="case-certificate"><CertificationForm application={item} /></Card> : null;
  const leadJumps = item.status === "APPROVED" ? [{ id: "case-certificate", label: "核發證書" }] : [];
  const extraMain = <ApplicationHistory applicationId={applicationId} />;
  const extraJumps = [{ id: "case-history", label: "歷程" }];
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={item.applicationNo}
        description={`${item.organizationName} · ${item.categoryName}`}
        actions={
          <>
            <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
            <Link className="text-sm text-[var(--link)] underline" to={navFrom ?? (item.status === "APPROVED" ? (item.certificateNo ? "/admin/certificates/issued" : "/admin/certificates") : caseReviewStatuses.find(([id]) => id === item.status)?.[3] ?? "/admin/applications")}>回到列表</Link>
          </>
        }
      />
      <NoticeText notice={flash} />
      {item.status === "SECOND_REVIEW" ? (
        <SiteReviewBody item={item} embedded onChanged={refresh} onFlash={setFlash} extraMain={extraMain} extraJumps={extraJumps} />
      ) : (
        <ApplicationReview item={item} onChanged={refresh} onFlash={setFlash} leadMain={leadMain} leadJumps={leadJumps} extraMain={extraMain} extraJumps={extraJumps} />
      )}
    </div>
  );
}

function ApplicationHistory({ applicationId }: { applicationId: string }) {
  const services = useServices();
  const events = useQuery({ queryKey: ["events", applicationId], queryFn: () => services.events(applicationId) });
  return (
      <section id="case-history" className="scroll-mt-4 space-y-3">
        <SectionHeader title="歷程" />
        {(events.data?.length ?? 0) === 0 ? <Empty title="還沒有歷程" body="送件、派案與審查動作會記在這裡。" /> : (
          <DataTable columns={["時間", "人員", "動作", "意見"]}>
            {events.data?.map((event) => (
              <tr key={event.id} className={tableRowClass}>
                <td className="p-3 whitespace-nowrap">{formatTaipei(event.createdAt)}</td>
                <td className="p-3">{event.actorName}</td>
                <td className="p-3">{event.action}</td>
                <td className="p-3">{event.publicComment ?? ""}{event.internalNote ? <span className="text-[var(--muted)]">（內部：{event.internalNote}）</span> : null}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
  );
}

function CertificationForm({ application }: { application: ApplicationDetail }) {
  const services = useServices();
  const client = useQueryClient();
  const matched = matchCertificateTemplates({
    categoryCode: application.categoryCode,
    applyType: typeof application.formData.applyType === "string" ? application.formData.applyType : null,
    mealBreakfast: Boolean(application.formData.mealBreakfast),
    mealLunch: Boolean(application.formData.mealLunch),
    mealDinner: Boolean(application.formData.mealDinner),
    mealDrink: Boolean(application.formData.mealDrink),
    mealSnack: Boolean(application.formData.mealSnack),
  });
  const [form, setForm] = useState({
    certificateNo: "",
    issuedOnDate: "",
    validUntilDate: "",
    templateKey: matched[0]?.key ?? "",
  });
  const [message, setMessage] = useState<Notice>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">核發證書</h2>
      <p className="text-sm text-[var(--muted)]">依申請類別／項目對應範本；儲存後業者可在電子證書預覽與下載 PDF。</p>
      {application.certificateNo ? <p className="text-sm">目前已發證：<strong>{application.certificateNo}</strong>。重新儲存會更新這張證書。</p> : null}
      {matched.length === 0 ? <p className="text-sm text-[var(--danger)]">找不到對應證書範本，請先確認申請項目。</p> : null}
      <Field label="證書範本">
        <SelectInput value={form.templateKey} onChange={(event) => setForm({ ...form, templateKey: event.target.value })}>
          {matched.map((item) => (
            <option key={item.key} value={item.key}>{item.titleZh}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label="證書編號"><TextInput value={form.certificateNo} onChange={(event) => setForm({ ...form, certificateNo: event.target.value })} /></Field>
      <Field label="核發日"><TextInput type="date" value={form.issuedOnDate} onChange={(event) => setForm({ ...form, issuedOnDate: event.target.value })} /></Field>
      <Field label="到期日"><TextInput type="date" value={form.validUntilDate} onChange={(event) => setForm({ ...form, validUntilDate: event.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !form.templateKey}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            try {
              const saved = await services.saveCertification(application.id, form);
              await client.invalidateQueries({ queryKey: ["admin-applications"] });
              await client.invalidateQueries({ queryKey: ["application", application.id] });
              setMessage(`已發證 ${saved.certificateNo}（${saved.templateTitle ?? "證書"}），已移到「已發證」。`);
              setPreviewHtml(saved.bodyHtml ?? null);
            } catch (error) {
              setMessage(failNotice(error instanceof ClientError ? error.message : "登錄失敗"));
            } finally {
              setBusy(false);
            }
          }}
        >
          發證並儲存
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const file = await services.certificationDocument(application.id);
              const url = URL.createObjectURL(file.blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = file.name;
              link.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              setMessage(failNotice(error instanceof ClientError ? error.message : "請先發證後再下載"));
            } finally {
              setBusy(false);
            }
          }}
        >
          下載 PDF
        </Button>
      </div>
      <NoticeText notice={message} />
      {previewHtml ? (
        <div className="mt-3">
          <h4 className="mb-2 font-medium">證書預覽</h4>
          <div className="certificate-sheet contract-body-view max-w-3xl border border-[var(--line)] bg-white text-sm" dangerouslySetInnerHTML={{ __html: layoutCertificateRowsHtml(previewHtml) }} />
        </div>
      ) : null}
    </div>
  );
}

export function CourseListPage() {
  const services = useServices();
  const courses = useQuery({ queryKey: ["courses", "manage"], queryFn: () => services.courses("manage") });
  const rows = courses.data ?? [];
  return (
    <div className="space-y-4">
      <SectionHeader
        title="梯次列表"
        hint="點課程名稱編輯內容與時間；報名名單可登錄出席與匯出。"
        actions={<Link className="btn btn-primary rounded-md px-3 py-2 text-sm no-underline" to="/admin/courses/new">＋ 新增課程</Link>}
      />
      {courses.isLoading ? <p>載入中…</p> : null}
      {!courses.isLoading && rows.length === 0 ? <Empty title="還沒有課程" body="按右上角新增第一個梯次。" /> : null}
      {rows.length > 0 ? (
        <DataTable columns={["課程", "方式", "開始時間", "名額", "狀態", "操作"]}>
          {rows.map((course) => (
            <tr key={course.id} className={tableRowClass}>
              <td className="p-3 font-medium">{course.title}</td>
              <td className="p-3">{courseDeliveryLabels[course.delivery].label}</td>
              <td className="p-3 whitespace-nowrap">{formatTaipei(course.startsAt)}</td>
              <td className="p-3">{course.confirmedCount}/{course.capacity}</td>
              <td className="p-3"><Badge tone={courseStatusLabels[course.status].tone}>{courseStatusLabels[course.status].label}</Badge></td>
              <td className="p-3 whitespace-nowrap">
                <Link className="text-[var(--link)] underline" to={`/admin/courses/${course.id}/edit`}>編輯</Link>
                <Link className="ml-3 text-[var(--link)] underline" to={`/admin/courses/${course.id}/enrollments`}>報名名單</Link>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}
    </div>
  );
}

export function CourseFormPage() {
  const { courseId } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const existing = useQuery({ queryKey: ["course", courseId], queryFn: () => services.course(courseId ?? "", "manage"), enabled: Boolean(courseId) });
  const [error, setError] = useState<string | null>(null);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const course = existing.data;
  const [form, setForm] = useState<{ title: string; description: string; delivery: "ONLINE" | "OFFLINE"; youtubeUrl: string; location: string; startsAt: string; endsAt: string; registrationOpensAt: string; registrationClosesAt: string; capacity: number; durationMinutes: number; requiredAttendanceMinutes: number; status: CourseStatus }>({ title: "", description: "", delivery: "OFFLINE", youtubeUrl: "", location: "", startsAt: "", endsAt: "", registrationOpensAt: "", registrationClosesAt: "", capacity: 20, durationMinutes: 180, requiredAttendanceMinutes: 120, status: "DRAFT" });
  const value = course ? { title: course.title, description: course.description, delivery: course.delivery, youtubeUrl: course.youtubeUrl ?? "", location: course.location, startsAt: toLocal(course.startsAt), endsAt: toLocal(course.endsAt), registrationOpensAt: toLocal(course.registrationOpensAt), registrationClosesAt: toLocal(course.registrationClosesAt), capacity: course.capacity, durationMinutes: course.durationMinutes, requiredAttendanceMinutes: course.requiredAttendanceMinutes, status: course.status } : form;
  useEffect(() => {
    if (!course) return;
    setForm({ title: course.title, description: course.description, delivery: course.delivery, youtubeUrl: course.youtubeUrl ?? "", location: course.location, startsAt: toLocal(course.startsAt), endsAt: toLocal(course.endsAt), registrationOpensAt: toLocal(course.registrationOpensAt), registrationClosesAt: toLocal(course.registrationClosesAt), capacity: course.capacity, durationMinutes: course.durationMinutes, requiredAttendanceMinutes: course.requiredAttendanceMinutes, status: course.status });
  }, [course]);
  const delivery = form.delivery || value.delivery;
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={courseId ? "編輯課程" : "新增課程"}
        description="設定上課方式、時間、名額與完課門檻。公開後業者才看得到。"
        actions={<>
        <Link className="text-sm text-[var(--link)] underline" to="/admin/courses">回到列表</Link>
        <Button onClick={async () => {
          const source = form.title ? form : value;
          const payload = { ...source, delivery, location: delivery === "ONLINE" ? "" : source.location, startsAt: new Date(source.startsAt).toISOString(), endsAt: new Date(source.endsAt).toISOString(), registrationOpensAt: new Date(source.registrationOpensAt).toISOString(), registrationClosesAt: new Date(source.registrationClosesAt).toISOString(), expectedVersion: course?.version };
          try {
            const saved = await services.saveCourse(payload, courseId);
            if (delivery === "ONLINE" && pendingVideo) {
              const durationSeconds = await readVideoDuration(pendingVideo);
              await services.uploadCourseVideo(saved.id, pendingVideo, durationSeconds);
              setPendingVideo(null);
            }
            navigate(`/admin/courses/${saved.id}/edit`);
          } catch (reason) {
            setError(reason instanceof ClientError ? reason.message : reason instanceof Error ? reason.message : "儲存失敗");
          }
        }}>儲存課程</Button>
        </>}
      />
      <Card className="space-y-3">
      <Field label="上課方式">
        <SelectInput value={delivery} onChange={(event) => setForm({ ...value, delivery: event.target.value as "ONLINE" | "OFFLINE", location: event.target.value === "ONLINE" ? "" : value.location })}>
          <option value="OFFLINE">線下課程</option>
          <option value="ONLINE">線上課程</option>
        </SelectInput>
      </Field>
      {delivery === "ONLINE" ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-4">
          <p className="text-sm">上傳課程影片。業者至少看完影片時間的三分之二，才算通過。請用 MP4 或 WebM。</p>
          <label className="btn mt-3 inline-block cursor-pointer rounded-md px-3 py-2 text-sm">選擇課程影片
            <input className="sr-only" type="file" accept="video/mp4,video/webm" onChange={async (event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              const file = files[0];
              if (!file) return;
              if (!courseId) {
                setPendingVideo(file);
                setError(null);
                return;
              }
              try {
                const durationSeconds = await readVideoDuration(file);
                await services.uploadCourseVideo(courseId, file, durationSeconds);
                await existing.refetch();
                setPendingVideo(null);
                setError(null);
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : reason instanceof Error ? reason.message : "上傳失敗");
              }
            }} />
          </label>
          {pendingVideo ? <p className="mt-2 text-sm">已選擇 {pendingVideo.name}。按下儲存課程就會上傳。</p> : null}
          {course?.hasVideo ? <p className="mt-2 text-sm">已上傳影片，長度 {course.videoDurationSeconds} 秒。通過門檻是三分之二。</p> : null}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
      <Field label="名稱"><TextInput value={form.title || value.title} onChange={(event) => setForm({ ...value, title: event.target.value })} /></Field>
      {delivery === "OFFLINE" ? <Field label="地點"><TextInput value={form.location || value.location} onChange={(event) => setForm({ ...value, location: event.target.value })} /></Field> : null}
      <Field label="介紹"><TextArea value={course ? value.description : form.description} onChange={(event) => setForm({ ...value, description: event.target.value })} /></Field>
      <Field label="YouTube 連結" hint="貼上 youtube.com 或 youtu.be 的影片網址。留白表示這一梯次不放影片。"><TextInput value={form.youtubeUrl || value.youtubeUrl} onChange={(event) => setForm({ ...value, youtubeUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=" /></Field>
      <Field label="開始"><TextInput type="datetime-local" value={course && !form.startsAt ? value.startsAt : form.startsAt || value.startsAt} onChange={(event) => setForm({ ...value, startsAt: event.target.value })} /></Field>
      <Field label="結束"><TextInput type="datetime-local" value={form.endsAt || value.endsAt} onChange={(event) => setForm({ ...value, endsAt: event.target.value })} /></Field>
      <Field label="報名開始"><TextInput type="datetime-local" value={form.registrationOpensAt || value.registrationOpensAt} onChange={(event) => setForm({ ...value, registrationOpensAt: event.target.value })} /></Field>
      <Field label="報名截止"><TextInput type="datetime-local" value={form.registrationClosesAt || value.registrationClosesAt} onChange={(event) => setForm({ ...value, registrationClosesAt: event.target.value })} /></Field>
      <Field label="名額"><TextInput type="number" value={form.capacity || value.capacity} onChange={(event) => setForm({ ...value, capacity: Number(event.target.value) })} /></Field>
      <Field label="認證分鐘" hint="列表上的認證時數由這裡換算成小時。"><TextInput type="number" value={form.durationMinutes || value.durationMinutes} onChange={(event) => setForm({ ...value, durationMinutes: Number(event.target.value) })} /></Field>
      {delivery === "OFFLINE" ? <Field label="完課分鐘" hint="已有出席紀錄時，初版不允許改門檻。"><TextInput type="number" value={form.requiredAttendanceMinutes || value.requiredAttendanceMinutes} onChange={(event) => setForm({ ...value, requiredAttendanceMinutes: Number(event.target.value) })} /></Field> : null}
      </div>
      <Field label="狀態"><SelectInput value={form.status || value.status} onChange={(event) => setForm({ ...value, status: event.target.value as CourseStatus })}>{Object.entries(courseStatusLabels).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</SelectInput></Field>
      {courseId ? (
        <div>
          <label className="btn inline-block cursor-pointer rounded-md px-3 py-2 text-sm">上傳圖片
            <input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || !courseId) return;
              try {
                await services.uploadCourseImage(courseId, file);
                await existing.refetch();
                setError(null);
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "上傳失敗");
              }
            }} />
          </label>
          {course?.imageUrl ? <img src={course.imageUrl} alt="" className="mt-3 h-48 w-full rounded-md object-cover" /> : <p className="mt-2 text-sm text-[var(--muted)]">還沒有圖片。</p>}
        </div>
      ) : <p className="text-sm text-[var(--muted)]">先儲存課程，再上傳圖片。</p>}
      {error ? <ErrorText message={error} /> : null}
      </Card>
    </div>
  );
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration < 1) reject(new Error("無法讀取影片長度"));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取影片"));
    };
    video.src = url;
  });
}

function toLocal(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function EnrollmentAdminPage() {
  const { courseId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: ["enrollments", courseId], queryFn: () => services.courseEnrollments(courseId) });
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="報名名單"
        description="線下課程在這裡登錄出席與分鐘數；線上課程依觀看時間自動判定。"
        actions={<>
          <Link className="text-sm text-[var(--link)] underline" to="/admin/courses">回到列表</Link>
          <Button variant="secondary" onClick={async () => downloadText("enrollments.csv", await services.exportEnrollments(courseId))}>匯出名單</Button>
        </>}
      />
      {(rows.data?.length ?? 0) === 0 ? <Empty title="還沒有報名" body="公開課程後，業者可以自行報名。" /> : (
        <DataTable columns={["報名人", "Email", "完課狀態", "出席登錄", ""]}>
          {(rows.data ?? []).map((row) => <AttendanceRow key={row.id} row={row} onSaved={() => client.invalidateQueries({ queryKey: ["enrollments", courseId] })} />)}
        </DataTable>
      )}
    </div>
  );
}

function AttendanceRow({ row, onSaved }: { row: Awaited<ReturnType<ReturnType<typeof useServices>["courseEnrollments"]>>[number]; onSaved: () => void }) {
  const services = useServices();
  const [status, setStatus] = useState(row.attendanceStatus);
  const [minutes, setMinutes] = useState(row.attendedMinutes);
  const [message, setMessage] = useState<Notice>(null);
  return (
    <tr className={`${tableRowClass} align-top`}>
      <td className="p-3 font-medium">{row.userName}</td>
      <td className="p-3">{row.userEmail}</td>
      <td className="p-3"><Badge tone={labels.completion[row.completion].tone}>{labels.completion[row.completion].label}</Badge></td>
      <td className="p-3">
        {row.delivery === "ONLINE" ? <span>已看 {row.watchedSeconds} 秒／需 {row.passSeconds} 秒</span> : (
          <div className="flex flex-wrap items-center gap-2">
            <SelectInput className="w-28" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="出席狀態">{Object.entries(labels.attendance).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</SelectInput>
            <TextInput className="w-24" type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="分鐘數" />
            <span className="text-[var(--muted)]">分鐘</span>
          </div>
        )}
        <NoticeText notice={message} />
      </td>
      <td className="p-3">
        {row.delivery === "ONLINE" ? null : (
          <Button variant="secondary" onClick={async () => { try { await services.attendance(row.id, { expectedVersion: row.version, attendanceStatus: status, attendedMinutes: minutes }); setMessage("已登錄出席"); onSaved(); } catch (error) { setMessage(failNotice(error instanceof ClientError ? error.message : "登錄失敗")); } }}>儲存</Button>
        )}
      </td>
    </tr>
  );
}

export function UsersPage() {
  return <PermissionsPage />;
}

export function OrganizationsPage() {
  const services = useServices();
  const [q, setQ] = useState("");
  const rows = useQuery({ queryKey: ["organizations", q], queryFn: () => services.organizations(q) });
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="會員管理"
        description="前台註冊的業者資料。業者自行在會員區維護；需要批次建立時用資料匯入。"
        actions={<Link to="/admin/imports" className="btn rounded-md px-3 py-2 text-sm no-underline">資料匯入</Link>}
      />
      <SectionHeader
        title="業者列表"
        hint={rows.data ? `共 ${rows.data.length} 家` : undefined}
        actions={<TextInput className="w-56" placeholder="搜尋名稱或統編" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋業者" />}
      />
      {(rows.data?.length ?? 0) === 0 && !rows.isLoading ? <Empty title="沒有符合的業者" body="換個關鍵字，或確認業者已在前台註冊。" /> : (
        <DataTable columns={["業者", "統編", "聯絡人", "電話"]}>
          {rows.data?.map((org) => <tr key={org.id} className={tableRowClass}><td className="p-3 font-medium">{org.organizationName}</td><td className="p-3">{org.taxId}</td><td className="p-3">{org.contactName}</td><td className="p-3">{org.contactPhone}</td></tr>)}
        </DataTable>
      )}
    </div>
  );
}

export function ImportsPage() {
  const services = useServices();
  const [type, setType] = useState<"ORGANIZATIONS" | "APPLICATION_DRAFTS">("ORGANIZATIONS");
  const [csv, setCsv] = useState("organizationName,taxId,contactName,contactPhone,contactEmail,address");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof services.importPreview>> | null>(null);
  const [message, setMessage] = useState<Notice>(null);
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="資料匯入"
        description="先預覽。有錯誤不會寫入；確認後整批成功或整批不匯入。不能用 CSV 直接建立已核定案件。"
        actions={<Button variant="secondary" onClick={async () => downloadText(`${type}.csv`, await services.importTemplate(type))}>下載範本</Button>}
      />
      <Card className="space-y-3">
        <Field label="匯入類型">
          <SelectInput value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ORGANIZATIONS">業者資料</option><option value="APPLICATION_DRAFTS">驗證草稿</option></SelectInput>
        </Field>
        <Field label="CSV 內容"><TextArea value={csv} onChange={(event) => setCsv(event.target.value)} aria-label="CSV 內容" /></Field>
        <Button onClick={async () => setPreview(await services.importPreview(type, csv))}>預覽</Button>
      </Card>
      {preview ? (
        <section className="space-y-3">
          <SectionHeader
            title="預覽結果"
            hint={preview.errorCount > 0 ? `有 ${preview.errorCount} 列錯誤，修正後再預覽。` : "全部可匯入。"}
            actions={<Button disabled={preview.errorCount > 0} onClick={async () => { const result = await services.importCommit(preview.id, crypto.randomUUID()); setMessage(`已匯入 ${result.committed ?? 0} 筆`); }}>確認匯入</Button>}
          />
          <DataTable columns={["列", "結果", "說明"]}>
            {preview.rows.map((row) => (
              <tr key={row.rowNumber} className={tableRowClass}>
                <td className="p-3">第 {row.rowNumber} 列</td>
                <td className="p-3"><Badge tone={row.ok ? "success" : "danger"}>{row.ok ? "可匯入" : "錯誤"}</Badge></td>
                <td className="p-3">{row.ok ? "—" : row.messages.join("、")}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
      <NoticeText notice={message} />
    </div>
  );
}

export function AuditPage() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const category = AUDIT_CATEGORIES.some((item) => item.key === params.get("category")) ? params.get("category")! : "ALL";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const rows = useQuery({ queryKey: ["audit", category, page], queryFn: () => services.audit({ page, category }) });
  const choose = (nextCategory: string) => {
    const next = new URLSearchParams(params);
    if (nextCategory === "ALL") next.delete("category");
    else next.set("category", nextCategory);
    next.delete("page");
    setParams(next);
  };
  const turn = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
  };
  const items = rows.data?.items ?? [];
  const meta = rows.data?.meta;
  return (
    <div className="space-y-4">
      <AdminPageHeader title="操作紀錄" description="只保留最近 30 天。一頁最多 100 筆。" />
      <SectionHeader
        title="紀錄列表"
        hint={auditCategoryDetail(category)}
        actions={
          <SelectInput className="w-48" aria-label="分類" value={category} onChange={(event) => choose(event.target.value)}>
            <option value="ALL">全部分類</option>
            {AUDIT_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </SelectInput>
        }
      />
      {items.length === 0 ? <Empty title="尚無紀錄" body="這個分類在最近 30 天沒有操作。" /> : (
        <DataTable columns={["時間", "人員", "分類", "動作", "對象"]}>
          {items.map((row) => <tr key={row.id} className={tableRowClass}><td className="p-3 whitespace-nowrap">{formatTaipei(row.createdAt)}</td><td className="p-3">{row.actorName ?? "系統"}</td><td className="p-3">{AUDIT_CATEGORIES.find((item) => item.key === auditCategoryOf(row.action))?.label}</td><td className="p-3">{auditActionLabel(row.action)}</td><td className="p-3">{auditEntityLabel(row.entityType)}</td></tr>)}
        </DataTable>
      )}
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => turn(page - 1)}>上一頁</Button>
          <span>第 {meta.page} / {meta.totalPages} 頁，共 {meta.total} 筆</span>
          <Button variant="secondary" disabled={page >= meta.totalPages} onClick={() => turn(page + 1)}>下一頁</Button>
        </div>
      ) : meta ? <p className="text-sm text-[var(--muted)]">共 {meta.total} 筆</p> : null}
    </div>
  );
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}
