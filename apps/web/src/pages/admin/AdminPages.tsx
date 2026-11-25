import { AUDIT_CATEGORIES, applicationStatusLabels, auditActionLabel, auditCategoryDetail, auditCategoryOf, auditEntityLabel, certificateDefaultUntil, courseDeliveryLabels, courseStatusLabels, layoutCertificateRowsHtml, matchCertificateTemplates, taipeiDateString, userRoleLabels, type ApplicationDetail, type CourseStatus } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { ApplicationReview } from "./ApplicationReview";
import { OrgLink } from "../../components/OrgLink";
import { AdminPageHeader, Badge, Button, Card, DataTable, Empty, ErrorText, Field, Pager, SectionHeader, SelectInput, TextArea, TextInput, WorkTile, tableRowClass, NoticeText, failNotice, type Notice } from "../../components/ui";
import { PermissionsPage, SiteReviewBody } from "./InfoAdminPages";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";
import type { NavFromState } from "../../components/shell/Shell";

export function AdminHome() {
  const services = useServices();
  const session = useSession();
  const features = new Set(session.user?.featureKeys ?? []);
  const canReview = features.has("applications.review") || features.has("applications.decide");
  const canDecide = features.has("applications.decide");
  const canPay = features.has("payments.manage");
  const canContract = features.has("contracts.issue");
  const canTraining = features.has("training.manage");
  const canUsers = features.has("users.manage");
  const canCms = features.has("cms.edit");
  const canReports = features.has("reports.export");
  const canAudit = features.has("audit.view");
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => services.summary() });
  const toCertify = useQuery({ queryKey: ["admin-applications", "", "APPROVED", "pending", 1], queryFn: () => services.applications({ status: "APPROVED", certification: "pending", page: 1 }), enabled: canDecide });
  const payments = useQuery({ queryKey: ["payment-desk"], queryFn: () => services.paymentDesk(), enabled: canPay });
  const contracts = useQuery({ queryKey: ["admin-contracts"], queryFn: () => services.adminContracts(), enabled: canContract });
  const requests = useQuery({ queryKey: ["admin-company-training"], queryFn: () => services.adminCompanyTrainingRequests(), enabled: canTraining });
  if (summary.isLoading) return <p>載入中…</p>;
  if (!summary.data) return <ErrorText message="無法載入工作總覽" />;
  const data = summary.data;
  const pendingContracts = (contracts.data ?? []).filter((item) => item.status === "ISSUED").length;
  const awaiting = payments.data?.awaitingReconciliation.length ?? 0;
  const pendingRequests = (requests.data ?? []).filter((item) => item.status === "SUBMITTED").length;
  const person = session.user;
  const roleLabel = person ? userRoleLabels[person.role as keyof typeof userRoleLabels]?.label ?? person.role : "";
  const cases = [
    canPay ? { label: "未核案件", hint: "業者選了方案、等確認後產生匯款單", to: "/admin/payments/reconciliation", count: payments.data?.awaitingQuote.length ?? 0 } : null,
    canPay ? { label: "未核付款", hint: "業者已上傳繳費單據、等核帳", to: "/admin/payments/reconciliation", count: awaiting } : null,
    canReview ? { label: "審查中申請", hint: "數字是已送出、還沒核定或退件。清單從已送件開始。", to: "/admin/applications", count: data.submitted + data.initialReview + data.secondReview + data.finalReview } : null,
    canReview ? { label: "未核申請", hint: "已送件、尚未開始審", to: "/admin/applications", count: data.submitted } : null,
    canReview ? { label: "未核補件", hint: "退回後等業者補資料", to: "/admin/applications/need-supplement", count: data.needSupplement } : null,
    canReview ? { label: "未核複審", hint: "停在複審中的案件", to: "/admin/applications/second-review", count: data.secondReview } : null,
    canReview ? { label: "案件總覽", hint: "從已送件進入各審查階段", to: "/admin/applications" } : null,
    canContract ? { label: "合約總覽", hint: "待回傳、已簽約與續約", to: "/admin/contracts", count: pendingContracts } : null,
    canDecide ? { label: "證書總覽", hint: "待發證與已發證", to: "/admin/certificates", count: toCertify.data?.meta.total } : null,
    canUsers ? { label: "會員總覽", hint: "業者資料與聯絡方式", to: "/admin/organizations" } : null,
    canUsers ? { label: "寄信", hint: "指定一位、全部業者，以及自動通知內容", to: "/admin/notifications" } : null,
    canContract ? { label: "範本管理", hint: "合約範本。證書範本在電子證書。", to: "/admin/contracts/templates" } : canDecide ? { label: "範本管理", hint: "證書範本", to: "/admin/certificates/templates" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const learning = canTraining ? [
    { label: "媒材管理", hint: "基礎課影片、教材與題庫", to: "/admin/training/basic" },
    { label: "專案報名", hint: "業者提出的專班申請", to: "/admin/training/company-requests", count: pendingRequests },
    { label: "專案會員", hint: "課程梯次與出席名單", to: "/admin/courses" },
    { label: "證書管理", hint: "一般課結訓證書", to: "/admin/training/certificates" },
  ] : [];
  const manage = [
    canReports ? { label: "營運報表", hint: "固定報表與自訂匯出", to: "/admin/reports" } : null,
    canUsers ? { label: "權限", hint: "員工帳號與功能勾選", to: "/admin/permissions" } : null,
    canCms ? { label: "內容管理", hint: "前台頁面、消息、常見問題與課程介紹", to: "/admin/studio" } : null,
    canAudit ? { label: "歷程紀錄", hint: "不可修改的操作紀錄", to: "/admin/audit-logs" } : null,
    canUsers ? { label: "設定", hint: "附件大小、客服按鈕、郵件與金鑰", to: "/admin/settings" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <p className="text-xl font-semibold">{person?.displayName ?? "內部人員"}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{roleLabel} · {person?.email ?? "尚未登入"}。系統目前沒有另外的人員編號。</p>
      </Card>
      {cases.length ? <TileSection title="案件" hint="有數字的是待處理件數。沒有的是總覽入口。" items={cases} /> : null}
      {learning.length ? <TileSection title="教育訓練" hint="媒材、專班報名、上課名單與訓練證書。" items={learning} /> : null}
      {manage.length ? <TileSection title="管理" hint="報表、權限、前台、紀錄與串接。" items={manage} /> : null}
      {cases.length + learning.length + manage.length === 0 ? <Empty title="這個帳號沒有工作總覽項目" body="請管理員在權限裡勾選要使用的功能。" /> : null}
    </div>
  );
}

function TileSection({ title, hint, items }: { title: string; hint: string; items: Array<{ label: string; hint: string; to: string; count?: number }> }) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} hint={hint} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => <WorkTile key={item.label} {...item} />)}
      </div>
    </section>
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
              <td className="p-3"><OrgLink name={item.organizationName} organizationId={item.organizationId} /></td>
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
        <DataTable columns={["編號", "業者", "類別", "承辦", ...(part === "issued" ? ["證書編號", "核發日", "到期日"] : []), "案件最後更新", "操作"]}>
          {items.map((item) => (
            <tr key={item.id} className={tableRowClass}>
              <td className="p-3 font-medium whitespace-nowrap">{item.applicationNo}</td>
              <td className="p-3"><OrgLink name={item.organizationName} organizationId={item.organizationId} /></td>
              <td className="p-3">{item.categoryName}</td>
              <td className="p-3">{item.assignedToName ?? "—"}</td>
              {part === "issued" ? <td className="p-3 break-all">{item.certificateNo || "—"}</td> : null}
              {part === "issued" ? <td className="p-3 whitespace-nowrap">{item.issuedOnDate || "—"}</td> : null}
              {part === "issued" ? <td className="p-3 whitespace-nowrap">{item.validUntilDate || "—"}</td> : null}
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
        description={<><OrgLink name={item.organizationName} organizationId={item.organizationId} /> · {item.categoryName}</>}
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
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const [months, setMonths] = useState("12");
  const [untilTouched, setUntilTouched] = useState(false);
  const [form, setForm] = useState({
    certificateNo: application.certificateNo ?? "",
    issuedOnDate: application.issuedOnDate ?? "",
    validUntilDate: application.validUntilDate ?? "",
    templateKey: application.templateKey ?? matched[0]?.key ?? "",
  });
  const [message, setMessage] = useState<Notice>(null);
  useEffect(() => {
    if (!setting.data || application.certificateNo) return;
    setMonths(String(setting.data.certificateTermMonths));
    setForm((current) => {
      if (current.issuedOnDate) return current;
      const issued = taipeiDateString();
      return { ...current, issuedOnDate: issued, validUntilDate: certificateDefaultUntil(issued, setting.data.certificateTermMonths) };
    });
  }, [setting.data, application.certificateNo]);
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
      <Field label="預設效期（月）" hint="只在還沒發過的證書帶出到期日。到期日是核發日往後這個月數的前一天，仍可改。已核發的證書不會被改。">
        <div className="flex flex-wrap items-center gap-2">
          <TextInput className="w-28" inputMode="numeric" value={months} onChange={(event) => {
            const next = event.target.value;
            setMonths(next);
            const count = Number(next);
            if (!untilTouched && form.issuedOnDate && Number.isInteger(count) && count >= 1 && count <= 36) {
              setForm({ ...form, validUntilDate: certificateDefaultUntil(form.issuedOnDate, count) });
            }
          }} />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const count = Number(months);
              if (!setting.data || !Number.isInteger(count) || count < 1 || count > 36) {
                setMessage(failNotice("證書效期請填 1 到 36 個月"));
                return;
              }
              try {
                await services.saveOperationSetting({ certificateTermMonths: count, expectedVersion: setting.data.version });
                setMessage("已儲存預設效期。已核發的證書沒有改。");
                await client.invalidateQueries({ queryKey: ["operation-setting"] });
              } catch (error) {
                setMessage(failNotice(error instanceof ClientError ? error.message : "無法儲存預設效期"));
              }
            }}
          >
            儲存預設
          </Button>
        </div>
      </Field>
      <Field label="證書編號"><TextInput value={form.certificateNo} onChange={(event) => setForm({ ...form, certificateNo: event.target.value })} /></Field>
      <Field label="核發日"><TextInput type="date" value={form.issuedOnDate} onChange={(event) => {
        const issuedOnDate = event.target.value;
        const count = Number(months);
        setForm({
          ...form,
          issuedOnDate,
          validUntilDate: !untilTouched && Number.isInteger(count) && count >= 1 ? certificateDefaultUntil(issuedOnDate, count) : form.validUntilDate,
        });
      }} /></Field>
      <Field label="到期日"><TextInput type="date" value={form.validUntilDate} onChange={(event) => { setUntilTouched(true); setForm({ ...form, validUntilDate: event.target.value }); }} /></Field>
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
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-4">
        <p className="text-sm">上課資料。這門課自己的教材，業者報名後可在資源下載取得。請用 PDF、JPEG 或 PNG。</p>
        {courseId ? (
          <label className="btn mt-3 inline-block cursor-pointer rounded-md px-3 py-2 text-sm">選擇上課資料
            <input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                await services.uploadCourseMaterial(courseId, file);
                await existing.refetch();
                setError(null);
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "上傳失敗");
              }
            }} />
          </label>
        ) : <p className="mt-2 text-sm">先儲存課程，再上傳上課資料。</p>}
        {course?.materialName ? <p className="mt-2 text-sm">目前：{course.materialName}</p> : null}
      </div>
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
        <DataTable columns={["報名人", "Email", "完課狀態", "認可時數", "出席登錄", ""]}>
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
      <td className="p-3 font-medium"><OrgLink name={row.userName} userId={row.userId} /></td>
      <td className="p-3">{row.userEmail}</td>
      <td className="p-3"><Badge tone={labels.completion[row.completion].tone}>{labels.completion[row.completion].label}</Badge></td>
      <td className="p-3 whitespace-nowrap">{row.quizPassed ? `${row.recognizedMinutes} 分鐘` : "尚未計入"}</td>
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
        description="前台註冊的業者資料。點查看信件，可以看到寄給這一家的手動信和系統信。"
        actions={<Link to="/admin/imports" className="btn rounded-md px-3 py-2 text-sm no-underline">資料匯入</Link>}
      />
      <SectionHeader
        title="業者列表"
        hint={rows.data ? `共 ${rows.data.length} 家` : undefined}
        actions={<TextInput className="w-56" placeholder="搜尋名稱或統編" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋業者" />}
      />
      {(rows.data?.length ?? 0) === 0 && !rows.isLoading ? <Empty title="沒有符合的業者" body="換個關鍵字，或確認業者已在前台註冊。" /> : (
        <DataTable columns={["業者", "統編", "聯絡人", "電話", "信件"]}>
          {rows.data?.map((org) => (
            <tr key={org.id} className={tableRowClass}>
              <td className="p-3 font-medium"><OrgLink name={org.organizationName} organizationId={org.id} /></td>
              <td className="p-3">{org.taxId}</td>
              <td className="p-3">{org.contactName}</td>
              <td className="p-3">{org.contactPhone}</td>
              <td className="p-3"><Link className="text-[var(--link)]" to={`/admin/organizations/${org.id}`}>查看信件</Link></td>
            </tr>
          ))}
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
