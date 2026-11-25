import { CONTRACT_RENEWAL_WINDOW_DAYS, applicationStatusLabels, attachmentIsRequired, attachmentIsVisible, fieldIsRequired, fieldIsVisible, isContractRenewalDue, layoutCertificateRowsHtml, minutesToHourLabel, reviewTargets, splitCertificateFields, validateSubmit, VERIFICATION_EXCLUSIVE, VERIFICATION_PICK_KEYS, type ApplicationDetail, type CategoryField } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { AttachmentImages } from "../../components/AttachmentImages";
import { ImageAdjustDialog } from "../../components/ImageAdjustDialog";
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, scrollToPageTop, SectionHeader, SelectInput, TextArea, TextInput, WorkTile } from "../../components/ui";
import { describeSubmitIssue, issueAnchorId, stepForIssuePath, validateApplicationStep } from "../../lib/application-steps";
import { formatBytes, formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";

export function PortalHome() {
  const services = useServices();
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => services.summary() });
  const organization = useQuery({ queryKey: ["organization"], queryFn: () => services.organization() });
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: () => services.myPayments() });
  const contracts = useQuery({ queryKey: ["contracts", "mine"], queryFn: () => services.myContracts() });
  const operation = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const basic = useQuery({ queryKey: ["basic-training"], queryFn: () => services.basicTrainingStatus() });
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const learning = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const certificates = useQuery({ queryKey: ["certifications"], queryFn: () => services.certifications() });
  if (summary.isLoading) return <p>載入中…</p>;
  if (summary.error || !summary.data) return <ErrorText message="無法載入總覽" />;
  const data = summary.data;
  const paymentRows = payments.data?.payments ?? [];
  const quoted = paymentRows.filter((row) => row.status === "QUOTED").length;
  const unpaid = paymentRows.filter((row) => row.status === "PENDING").length;
  const voidPayments = paymentRows.filter((row) => row.status === "VOID").length;
  const awaitingContract = (contracts.data ?? []).filter((item) => item.status === "ISSUED").length;
  const reminderDays = operation.data?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const expiring = (contracts.data ?? []).filter((item) => item.status === "SIGNED" && isContractRenewalDue(item.signedAt, new Date(), reminderDays)).length;
  const tiles = [
    { label: "未核案件", hint: "已申請方案、等管理員確認", to: "/portal/payments", count: quoted },
    { label: "未付款", hint: "匯款單已產生，請繳費並上傳單據", to: "/portal/payments", count: unpaid },
    { label: "未送件", hint: "還在草稿，尚未送出", to: "/portal/applications?status=DRAFT", count: data.draft },
    { label: "未補資料", hint: "審查退回，等你補件", to: "/portal/supplements", count: data.needSupplement },
    { label: "複審未過", hint: "目前停在複審中的案件", to: "/portal/applications?status=SECOND_REVIEW", count: data.secondReview },
    { label: "已核定", hint: "審查通過、狀態為已核定的案件", to: "/portal/applications?status=APPROVED", count: data.approved },
    { label: "核發證書", hint: "已經發出去的電子證書", to: "/portal/certifications", count: certificates.data?.length ?? 0 },
    { label: "案件查詢（一年內）", hint: "查看自己的驗證申請", to: "/portal/applications", count: undefined },
    { label: "合約", hint: "尚未上傳蓋章的合約", to: "/portal/contracts", count: awaitingContract },
    { label: "即將到期", hint: "效期剩餘約兩個月內", to: "/portal/renewals", count: expiring },
    { label: "歷史記錄", hint: "數字是已核定加已退件。點進去看全部申請", to: "/portal/applications", count: data.approved + data.rejected },
    { label: "未成立", hint: voidPayments > 0 ? "方案不核准或逾期未繳費，要重新申請" : "已退件、沒有進入後續流程", to: voidPayments > 0 ? "/portal/payments" : "/portal/applications?status=REJECTED", count: data.rejected + voidPayments },
  ];
  const published = (courses.data ?? []).filter((course) => course.status === "PUBLISHED");
  const training = [
    { label: "線上學習", hint: "只列出線上課程", to: "/portal/training/online", count: published.filter((course) => course.delivery === "ONLINE").length },
    { label: "實體課程報名", hint: "只列出線下課程", to: "/portal/training/offline", count: published.filter((course) => course.delivery === "OFFLINE").length },
    { label: "線上測驗", hint: "看完課程後才能開始", to: "/portal/training/quiz", count: (learning.data ?? []).filter((row) => row.quizReady).length },
    { label: "時數證明", hint: "通過測驗的課程與總時數", to: "/portal/training/hours", count: (learning.data ?? []).filter((row) => row.quizPassed).length },
    { label: "資源下載", hint: "每一門課自己的上課資料", to: "/portal/training/materials" },
  ];
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <p className="text-xl font-semibold">{organization.data?.organizationName ?? "業者"}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">統編 {organization.data?.taxId ?? "尚未填寫"}。系統目前沒有另外的會員編號。</p>
      </Card>
      {basic.data && basic.data.policy.requireBasicBeforeApply && !basic.data.passed ? (
        <Card className="space-y-2">
          <p className="font-medium">請先完成基礎教育訓練</p>
          <p className="text-sm text-[var(--muted)]">通過內容與測驗後，才能建立驗證申請。</p>
          <Link className="btn btn-primary inline-flex rounded-md px-3 py-2 text-sm no-underline" to="/portal/training/online">前往基礎教育訓練</Link>
        </Card>
      ) : null}
      <section className="space-y-3">
        <SectionHeader title="案件" hint="數字是目前狀態的件數。點進去進到對應清單。" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((item) => <WorkTile key={item.label} {...item} />)}
        </div>
      </section>
      <section className="space-y-3">
        <SectionHeader title="教育訓練" hint="數字是目前看得到的課程或可測驗的件數。" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {training.map((item) => <WorkTile key={item.label} {...item} />)}
        </div>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const services = useServices();
  const query = useQuery({ queryKey: ["organization"], queryFn: () => services.organization() });
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ organizationName: "", contactName: "", contactPhone: "", contactEmail: "", address: "" });
  useEffect(() => {
    if (query.data) setForm({ organizationName: query.data.organizationName, contactName: query.data.contactName ?? "", contactPhone: query.data.contactPhone ?? "", contactEmail: query.data.contactEmail ?? "", address: query.data.address ?? "" });
  }, [query.data]);
  if (query.isLoading) return <p>載入中…</p>;
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-semibold">業者資料</h1>
      <p className="text-sm text-[var(--muted)]">統一編號 {query.data?.taxId ?? "—"}。修改這裡不會回寫已送出的申請快照。</p>
      <Field label="業者名稱"><TextInput value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></Field>
      <Field label="聯絡人"><TextInput value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></Field>
      <Field label="電話"><TextInput value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></Field>
      <Field label="Email"><TextInput value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} /></Field>
      <Field label="地址"><TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
      <Button onClick={async () => {
        const saved = await services.updateOrganization({ ...form, contactName: form.contactName || null, contactPhone: form.contactPhone || null, contactEmail: form.contactEmail || null, address: form.address || null });
        setMessage(`已儲存，更新時間 ${formatTaipei(saved.updatedAt)}`);
      }}>儲存業者資料</Button>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
    </Card>
  );
}

export function AccountPage() {
  const services = useServices();
  const [form, setForm] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card className="max-w-md space-y-3">
      <h1 className="text-xl font-semibold">帳號設定</h1>
      <Field label="目前密碼"><TextInput type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></Field>
      <Field label="新密碼"><TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
      <Field label="確認新密碼"><TextInput type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></Field>
      <Button onClick={async () => {
        try {
          const result = await services.changePassword(form.currentPassword, form.password, form.confirmPassword);
          setMessage(result.message);
        } catch (error) {
          setMessage(error instanceof ClientError ? error.message : "更新失敗");
        }
      }}>修改密碼</Button>
      {message ? <p className="text-sm">{message}</p> : null}
    </Card>
  );
}

export function ApplicationListPage() {
  const services = useServices();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const requested = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(Object.hasOwn(applicationStatusLabels, requested) ? requested : "");
  useEffect(() => {
    setStatus(Object.hasOwn(applicationStatusLabels, requested) ? requested : "");
  }, [requested]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; applicationNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["applications", q, status], queryFn: () => services.applications({ q, status, page: 1 }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-semibold">驗證申請</h1><Link to="/portal/applications/new" className="btn btn-primary rounded-md px-3 py-2 text-sm no-underline">新增申請</Link></div>
      <div className="flex flex-wrap gap-2">
        <TextInput className="max-w-xs" placeholder="搜尋案件編號" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋" />
        <SelectInput className="max-w-xs" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="狀態">
          <option value="">全部狀態</option>
          {Object.entries(applicationStatusLabels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </SelectInput>
      </div>
      {query.isLoading ? <p>載入中…</p> : null}
      {error ? <ErrorText message={error} /> : null}
      {(query.data?.items.length ?? 0) === 0 && !query.isLoading ? <Empty title="沒有案件" body="可以新增一筆草稿。" /> : null}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left"><tr><th className="p-3">案件編號</th><th className="p-3">類別</th><th className="p-3">更新時間</th><th className="p-3">狀態</th><th className="p-3">操作</th></tr></thead>
          <tbody>
            {query.data?.items.map((item) => (
              <tr key={item.id} className="border-t border-stone-100">
                <td className="p-3"><Link className="text-[var(--link)]" to={item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT" ? `/portal/applications/${item.id}/edit` : `/portal/applications/${item.id}`}>{item.applicationNo}</Link></td>
                <td className="p-3">{item.categoryName}</td>
                <td className="p-3">{formatTaipei(item.updatedAt)}</td>
                <td className="p-3"><Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge></td>
                <td className="p-3">{item.status === "DRAFT" ? <Button variant="danger" onClick={() => setPendingDelete({ id: item.id, applicationNo: item.applicationNo })}>刪除草稿</Button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingDelete ? (
        <Modal title="刪除草稿" onClose={() => setPendingDelete(null)}>
          <p className="text-sm">刪除 {pendingDelete.applicationNo} 後不能復原。已送出的案件不能刪。</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={async () => {
              try {
                await services.deleteDraft(pendingDelete.id);
                setPendingDelete(null);
                setError(null);
                await client.invalidateQueries({ queryKey: ["applications"] });
                await client.invalidateQueries({ queryKey: ["summary"] });
              } catch (reason) {
                setPendingDelete(null);
                setError(reason instanceof ClientError ? reason.message : "刪除失敗");
              }
            }}>確認刪除</Button>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>取消</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function NewApplicationPage() {
  const services = useServices();
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  const basic = useQuery({ queryKey: ["basic-training"], queryFn: () => services.basicTrainingStatus() });
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const blocked = Boolean(basic.data?.policy.requireBasicBeforeApply && !basic.data.passed);
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-semibold">新增申請</h1>
      {blocked ? (
        <div className="space-y-2 text-sm">
          <p>請先完成基礎教育訓練（內容與測驗）後再建立申請。</p>
          <Link className="text-[var(--link)]" to="/portal/enrollments">前往基礎教育訓練</Link>
        </div>
      ) : (
        <>
          <Field label="申請類別" hint="建立後會取得案件編號。未確認的類別在正式環境不能送件。">
            <SelectInput value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">請選擇</option>
              {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.code} {category.name}</option>)}
            </SelectInput>
          </Field>
          {error ? <ErrorText message={error} /> : null}
          <Button disabled={!categoryId} onClick={async () => {
            try {
              const created = await services.createApplication(categoryId);
              navigate(`/portal/applications/${created.id}/edit`);
            } catch (reason) {
              setError(reason instanceof ClientError ? reason.message : "建立失敗");
            }
          }}>建立草稿</Button>
        </>
      )}
    </Card>
  );
}

export function ApplicationEditPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["application", applicationId], queryFn: () => services.application(applicationId) });
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [pendingStep, setPendingStep] = useState<{ next: number; issues: { path: string; message: string }[] } | null>(null);
  const [adjust, setAdjust] = useState<{ key: string; files: File[] } | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  const uploadLimit = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const maxFileLabel = `${uploadLimit.data?.attachmentMaxMb ?? 10} MB`;
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);
  useEffect(() => {
    if (!focusPath) return;
    const node = document.getElementById(issueAnchorId(focusPath));
    if (node) {
      node.scrollIntoView({ block: "center" });
      const control = node.matches("input, textarea, select, button") ? node : node.querySelector("input, textarea, select, button");
      if (control instanceof HTMLElement) control.focus({ preventScroll: true });
    }
    setFocusPath(null);
  }, [focusPath, step]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  if (query.isLoading) return <p>載入中…</p>;
  if (query.isError || !draft) return <ErrorText message="找不到申請或沒有權限" />;
  const steps = ["申請類別", "業者與聯絡資料", "申請內容", "附件資料", "線上預覽", "確認送件"];
  const previewStep = 4;
  const confirmStep = 5;
  const supplements = (draft.fieldReviews ?? []).filter((item) => item.needsSupplement);
  function supplementFor(key: string) {
    return supplements.find((item) => item.key === key);
  }
  async function save() {
    if (!draft) return false;
    try {
      const saved = await services.updateApplication(draft.id, {
        expectedVersion: draft.version,
        categoryId: draft.categoryId,
        organizationName: draft.organizationName,
        taxId: draft.taxId,
        contactName: draft.contactName,
        contactPhone: draft.contactPhone,
        contactEmail: draft.contactEmail,
        organizationAddress: draft.organizationAddress,
        siteName: draft.siteName,
        siteAddress: draft.siteAddress,
        applicationDescription: draft.applicationDescription,
        declarationAccepted: draft.declarationAccepted,
        formData: draft.formData,
      });
      setDirty(false);
      setMessage(`已儲存草稿。版本 ${saved.version}，時間 ${formatTaipei(saved.updatedAt)}`);
      await client.invalidateQueries({ queryKey: ["application", applicationId] });
    } catch (reason) {
      setError(reason instanceof ClientError ? `${reason.message}${reason.fieldErrors ? "：" + reason.fieldErrors.map((item) => item.message).join("、") : ""}` : "儲存失敗");
      return false;
    }
    return true;
  }
  async function openStep(next: number, force = false) {
    if (!draft) return;
    if (next > step && !force) {
      const issues = validateApplicationStep(step, draft);
      if (issues.length > 0) {
        setPendingStep({ next, issues });
        return;
      }
    }
    setPendingStep(null);
    if (next === confirmStep && !previewed) {
      setError("請先打開線上預覽，確認內容後再送件。");
      return;
    }
    if ((next === previewStep || next === confirmStep) && dirty) {
      const saved = await save();
      if (!saved) return;
    }
    setError(null);
    if (next === previewStep) setPreviewed(true);
    setStep(next);
    scrollToPageTop();
  }
  function goToIssue(path: string) {
    setPendingStep(null);
    setError(null);
    setStep(stepForIssuePath(path));
    setFocusPath(path);
  }
  const categoryName = categories.data?.find((category) => category.id === draft.categoryId)?.name ?? draft.categoryName;
  const submitIssues = validateSubmit({
    organizationName: draft.organizationName,
    taxId: draft.taxId,
    contactName: draft.contactName,
    contactPhone: draft.contactPhone,
    contactEmail: draft.contactEmail,
    organizationAddress: draft.organizationAddress,
    siteName: draft.siteName,
    siteAddress: draft.siteAddress,
    applicationDescription: draft.applicationDescription,
    declarationAccepted: draft.declarationAccepted,
    formData: draft.formData,
  }, draft.definition, draft.attachments.map((item) => item.requirementKey));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{steps.map((label, index) => <button key={label} className={`btn rounded-full px-3 py-1 text-sm ${index === step ? "is-selected" : ""}`} type="button" aria-pressed={index === step} disabled={index === confirmStep && !previewed} onClick={() => void openStep(index)}>{index + 1}. {label}</button>)}</div>
      <p className="text-sm text-[var(--muted)]">案件 {draft.applicationNo} · 版本 {draft.version} · {draft.configurationStatus === "DEMO" ? "此類別為示範設定" : "類別已確認"}</p>
      {supplements.length ? <Card className="space-y-1 text-sm"><p className="font-medium">審查請補這些項目</p>{supplements.map((item) => <p key={item.key}>{reviewTargets(draft.definition).find((target) => target.key === item.key)?.label ?? item.key}：{item.publicComment}</p>)}</Card> : null}
      {step === 0 ? (
        <Field id={issueAnchorId("categoryId")} label="類別" hint="只有未送件草稿可以改類別，不相容的額外欄位會被清掉。">
          <CategorySelect value={draft.categoryId} disabled={draft.status !== "DRAFT"} onChange={(categoryId) => { setDraft({ ...draft, categoryId }); setDirty(true); }} />
          {supplementFor("category") ? <p className="text-sm">審查請補件：{supplementFor("category")?.publicComment}</p> : null}
        </Field>
      ) : null}
      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field id={issueAnchorId("organizationName")} required label="業者名稱">{supplementFor("organizationName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("organizationName")?.publicComment}</p> : null}<TextInput value={draft.organizationName ?? ""} onChange={(event) => { setDraft({ ...draft, organizationName: event.target.value }); setDirty(true); }} /></Field>
          <Field id={issueAnchorId("taxId")} label="統一編號" hint="沒有統編可以留空。有填的話暫定 8 位數字。">{supplementFor("taxId") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("taxId")?.publicComment}</p> : null}<TextInput value={draft.taxId ?? ""} onChange={(event) => { setDraft({ ...draft, taxId: event.target.value }); setDirty(true); }} /></Field>
          <Field id={issueAnchorId("contactName")} required label="聯絡人">{supplementFor("contactName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactName")?.publicComment}</p> : null}<TextInput value={draft.contactName ?? ""} onChange={(event) => { setDraft({ ...draft, contactName: event.target.value }); setDirty(true); }} /></Field>
          <Field id={issueAnchorId("contactPhone")} required label="電話">{supplementFor("contactPhone") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactPhone")?.publicComment}</p> : null}<TextInput value={draft.contactPhone ?? ""} onChange={(event) => { setDraft({ ...draft, contactPhone: event.target.value }); setDirty(true); }} /></Field>
          <Field id={issueAnchorId("contactEmail")} required label="Email">{supplementFor("contactEmail") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactEmail")?.publicComment}</p> : null}<TextInput value={draft.contactEmail ?? ""} onChange={(event) => { setDraft({ ...draft, contactEmail: event.target.value }); setDirty(true); }} /></Field>
          <Field id={issueAnchorId("organizationAddress")} required label="地址">{supplementFor("organizationAddress") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("organizationAddress")?.publicComment}</p> : null}<TextInput value={draft.organizationAddress ?? ""} onChange={(event) => { setDraft({ ...draft, organizationAddress: event.target.value }); setDirty(true); }} /></Field>
        </div>
      ) : null}
      {step === 2 ? (
        <ApplicationContentStep draft={draft} setDraft={setDraft} setDirty={setDirty} supplementFor={supplementFor} />
      ) : null}
      {step === 3 ? (
        <div className="space-y-3">
          {draft.definition.fields.some((field) => field.key === "mealBreakfast") && draft.definition.attachmentRequirements.filter((requirement) => requirement.group !== "checklist" && attachmentIsVisible(requirement, draft.formData)).length === 0 ? <p className="text-sm text-[var(--muted)]">請先回到申請內容，勾選這次要驗證的項目。勾了以後，這裡才出現要上傳的檔案。</p> : null}
          {draft.definition.attachmentRequirements.filter((requirement) => requirement.group !== "checklist" && attachmentIsVisible(requirement, draft.formData)).map((requirement) => {
            const files = draft.attachments.filter((item) => item.requirementKey === requirement.key && !item.capturedOnSite);
            const needed = attachmentIsRequired(requirement, draft.formData);
            const image = requirement.accept === "image";
            return (
              <Card key={requirement.key} id={issueAnchorId(`attachments.${requirement.key}`)}>
                <p className="font-medium">{needed ? <span className="text-[var(--danger)]">* </span> : null}{requirement.label}</p>
                {supplementFor(`attachment:${requirement.key}`) ? <p className="text-sm">審查請補件：{supplementFor(`attachment:${requirement.key}`)?.publicComment}</p> : null}
                <p className="text-xs text-[var(--muted)]">{image ? "只接受 JPEG、PNG。選好後可旋轉、裁切，或直接使用原檔。" : "PDF、JPEG、PNG、MP4、WebM。照片可先旋轉、裁切。"}單檔 {maxFileLabel}。可一次選擇多個檔案。{requirement.helpText}</p>
                {files.length === 0 ? <p className="text-sm text-[var(--muted)]">尚未上傳</p> : files.map((file) => (
                  <div key={file.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {file.mimeType === "application/pdf" ? <OpenPdfButton fileId={file.fileId} name={file.originalName} /> : <span>{file.originalName}</span>}
                    <span className="text-[var(--muted)]">{formatBytes(file.sizeBytes)}</span>
                    <button className="text-[var(--link)]" type="button" onClick={async () => { await services.removeAttachment(draft.id, file.id); await client.invalidateQueries({ queryKey: ["application", applicationId] }); }}>移除</button>
                  </div>
                ))}
                <AttachmentImages files={files} />
                <FileChooser
                  label={image ? "選擇照片" : "選擇檔案"}
                  accept={image ? "image/jpeg,image/png" : "application/pdf,image/jpeg,image/png,video/mp4,video/webm"}
                  multiple
                  ariaLabel={requirement.label}
                  onFiles={async (selected) => {
                    try {
                      const saved = await save();
                      if (!saved) return;
                      const photos = selected.filter((file) => file.type.startsWith("image/"));
                      const docs = selected.filter((file) => !file.type.startsWith("image/"));
                      for (const file of docs) await services.upload(draft.id, requirement.key, file);
                      if (photos.length > 0) {
                        setAdjust({ key: requirement.key, files: photos });
                        if (docs.length > 0) setMessage("文件已上傳。照片請先調整再使用。");
                        return;
                      }
                      setMessage("附件已上傳");
                      await client.invalidateQueries({ queryKey: ["application", applicationId] });
                    } catch (reason) {
                      setError(reason instanceof ClientError ? reason.message : "上傳失敗");
                    }
                  }}
                />
              </Card>
            );
          })}
        </div>
      ) : null}
      {step === previewStep ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">這是送件前的線上預覽，還沒送出。照片和文字都照目前草稿顯示。確認沒問題後，再進到確認送件。</p>
          <ApplicationPreview item={draft} categoryName={categoryName} />
        </div>
      ) : null}
      {step === confirmStep ? (
        <Card className="space-y-2 text-sm">
          <p>線上預覽已看過。送出後會留下這一版內容。</p>
          {supplementFor("declarationAccepted") ? <p>審查請補件：{supplementFor("declarationAccepted")?.publicComment}</p> : null}
          <label id={issueAnchorId("declarationAccepted")} className="flex scroll-mt-24 items-center gap-2"><input type="checkbox" checked={draft.declarationAccepted} onChange={(event) => { setDraft({ ...draft, declarationAccepted: event.target.checked }); setDirty(true); }} /><span><span className="text-[var(--danger)]">* </span>我確認以上資料可作為本次送件內容</span></label>
          {submitIssues.length ? (
            <div className="space-y-1 text-[var(--danger)]">
              <p>還有必填項目沒完成，不能送件。點項目會回到要填的位置。</p>
              {submitIssues.map((issue, index) => {
                const described = describeSubmitIssue(issue.path, issue.message, draft.definition);
                return (
                  <p key={`${issue.path}-${index}`}>
                    <button type="button" className="text-left underline" onClick={() => goToIssue(issue.path)}>{described.text}</button>
                  </p>
                );
              })}
            </div>
          ) : <p>必填項目都有了，可以送件。</p>}
          <Button disabled={submitIssues.length > 0} onClick={() => { if (submitIssues.length === 0) setConfirm(true); }}>送出申請</Button>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void save()}>儲存草稿</Button>
        {draft.status === "DRAFT" ? <Button variant="danger" onClick={() => setDeleteOpen(true)}>刪除草稿</Button> : null}
        {step > 0 ? <Button variant="ghost" onClick={() => void openStep(step - 1)}>上一步</Button> : null}
        {step < confirmStep ? <Button variant="ghost" onClick={() => void openStep(step + 1)}>{step === previewStep ? "下一步：確認送件" : "下一步"}</Button> : null}
      </div>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
      {pendingStep ? (
        <Modal title="還有必填沒完成" onClose={() => setPendingStep(null)}>
          <p className="text-sm">這一頁還有必填項目。可以先略過，送件前仍要補齊。</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {pendingStep.issues.map((issue) => <li key={issue.path}>{issue.message}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void openStep(pendingStep.next, true)}>略過，先繼續</Button>
            <Button variant="ghost" onClick={() => setPendingStep(null)}>留在這一步</Button>
          </div>
        </Modal>
      ) : null}
      {adjust ? (
        <ImageAdjustDialog
          files={adjust.files}
          onClose={() => {
            setAdjust(null);
            void client.invalidateQueries({ queryKey: ["application", applicationId] });
          }}
          onUse={async (file) => {
            await services.upload(draft.id, adjust.key, file);
            setMessage("照片已上傳，可以在下方查看。");
            await client.invalidateQueries({ queryKey: ["application", applicationId] });
          }}
        />
      ) : null}
      {deleteOpen ? (
        <Modal title="刪除草稿" onClose={() => setDeleteOpen(false)}>
          <p className="text-sm">刪除 {draft.applicationNo} 後不能復原。</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={async () => {
              try {
                await services.deleteDraft(draft.id);
                setDeleteOpen(false);
                navigate("/portal/applications");
              } catch (reason) {
                setDeleteOpen(false);
                setError(reason instanceof ClientError ? reason.message : "刪除失敗");
              }
            }}>確認刪除</Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button>
          </div>
        </Modal>
      ) : null}
      {confirm ? (
        <Modal title="確認送件" onClose={() => setConfirm(false)}>
          <p className="text-sm">送件後會建立不可覆寫的快照。若資料不完整，狀態不會改變。</p>
          <div className="mt-3 flex gap-2">
            <Button disabled={submitIssues.length > 0} onClick={async () => {
              if (submitIssues.length > 0) return;
              try {
                await save();
                const latest = await services.application(draft.id);
                const result = latest.status === "NEED_SUPPLEMENT"
                  ? await services.resubmit(latest.id, latest.version, crypto.randomUUID())
                  : await services.submit(latest.id, latest.version, crypto.randomUUID());
                setConfirm(false);
                setMessage(`已完成送件，目前狀態為${applicationStatusLabels[result.status].label}`);
                await client.invalidateQueries({ queryKey: ["application", applicationId] });
              } catch (reason) {
                setConfirm(false);
                setError(reason instanceof ClientError ? `${reason.message}${reason.fieldErrors ? "：" + reason.fieldErrors.map((item) => item.message).join("、") : ""}` : "送件失敗");
              }
            }}>確認送出</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>返回修改</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function FileChooser({ label, accept, multiple, ariaLabel, onFiles }: { label: string; accept: string; multiple: boolean; ariaLabel: string; onFiles: (files: File[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pressed, setPressed] = useState(false);
  return (
    <div className="mt-3">
      <Button
        type="button"
        aria-pressed={pressed}
        aria-label={`${label}：${ariaLabel}`}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        onChange={(event) => {
          const selected = [...(event.target.files ?? [])];
          event.target.value = "";
          if (selected.length) void onFiles(selected);
        }}
      />
    </div>
  );
}

export function OpenPdfButton({ fileId, name }: { fileId: string; name: string }) {
  return (
    <button
      className="btn mt-2 rounded-md px-3 py-1 text-sm"
      type="button"
      onClick={() => {
        const userId = sessionStorage.getItem("mf-demo-user");
        if (userId) localStorage.setItem("mf-demo-user-handoff", JSON.stringify({ userId, at: Date.now() }));
        window.open(`/files/${fileId}`, "_blank", "width=960,height=720");
      }}
    >
      查看 {name}
    </button>
  );
}

export function FileWindowPage() {
  const { fileId = "" } = useParams();
  const services = useServices();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let active = true;
    const handoff = localStorage.getItem("mf-demo-user-handoff");
    if (handoff && !sessionStorage.getItem("mf-demo-user")) {
      try {
        const parsed = JSON.parse(handoff) as { userId?: string; at?: number };
        if (parsed.userId && parsed.at && Date.now() - parsed.at < 30_000) sessionStorage.setItem("mf-demo-user", parsed.userId);
        localStorage.removeItem("mf-demo-user-handoff");
      } catch {
        localStorage.removeItem("mf-demo-user-handoff");
      }
    }
    void services.download(fileId).then((downloaded) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(downloaded.blob);
      setUrl(objectUrl);
      setName(downloaded.name);
      document.title = downloaded.name;
    }).catch((reason) => {
      if (active) setError(reason instanceof ClientError ? reason.message : "無法開啟檔案");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, services]);
  if (error) return <p className="p-6">{error}</p>;
  if (!url) return <p className="p-6">開啟檔案中…</p>;
  return <iframe title={name} src={url} className="fixed inset-0 h-screen w-screen border-0 bg-white" />;
}

function fieldText(item: ApplicationDetail, key: string) {
  const field = item.definition.fields.find((entry) => entry.key === key);
  const raw = item.formData[key];
  if (!field || raw === undefined || raw === null || raw === "") return "";
  if (field.inputType === "select") return field.options?.find((option) => option.value === String(raw))?.label ?? String(raw);
  if (field.inputType === "checkbox") return raw === true ? "已勾選" : "未勾選";
  return String(raw);
}

function setChecked(formData: ApplicationDetail["formData"], key: string, checked: boolean) {
  const next = { ...formData, [key]: checked };
  if (checked) {
    for (const [left, right] of VERIFICATION_EXCLUSIVE) {
      if (key === left) next[right] = false;
      if (key === right) next[left] = false;
    }
  }
  return next;
}

function DefinitionField({ field, draft, setDraft, setDirty, supplementFor }: { field: CategoryField; draft: ApplicationDetail; setDraft: (value: ApplicationDetail) => void; setDirty: (value: boolean) => void; supplementFor: (key: string) => { publicComment: string } | undefined }) {
  const write = (value: string | number | boolean) => {
    setDraft({ ...draft, formData: { ...draft.formData, [field.key]: value } });
    setDirty(true);
  };
  return (
    <Field id={issueAnchorId(`formData.${field.key}`)} required={fieldIsRequired(field, draft.formData)} label={field.label} hint={field.helpText}>
      {supplementFor(field.key) ? <p className="mb-1 text-sm">審查請補件：{supplementFor(field.key)?.publicComment}</p> : null}
      {field.inputType === "textarea" ? <TextArea value={String(draft.formData[field.key] ?? "")} onChange={(event) => write(event.target.value)} /> : null}
      {field.inputType === "select" ? <SelectInput value={String(draft.formData[field.key] ?? "")} onChange={(event) => write(event.target.value)}><option value="">請選擇</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectInput> : null}
      {field.inputType === "checkbox" ? <input type="checkbox" checked={draft.formData[field.key] === true} onChange={(event) => { setDraft({ ...draft, formData: setChecked(draft.formData, field.key, event.target.checked) }); setDirty(true); }} /> : null}
      {field.inputType !== "textarea" && field.inputType !== "select" && field.inputType !== "checkbox" ? <TextInput type={field.inputType === "number" ? "number" : field.inputType === "date" ? "date" : "text"} value={String(draft.formData[field.key] ?? "")} onChange={(event) => write(field.inputType === "number" ? Number(event.target.value) : event.target.value)} /> : null}
    </Field>
  );
}

function ApplicationContentStep({ draft, setDraft, setDirty, supplementFor }: { draft: ApplicationDetail; setDraft: (value: ApplicationDetail) => void; setDirty: (value: boolean) => void; supplementFor: (key: string) => { publicComment: string } | undefined }) {
  const certificate = splitCertificateFields(draft.definition.fields);
  const picks = new Set<string>(VERIFICATION_PICK_KEYS);
  const rest = certificate.rest.filter((field) => fieldIsVisible(field, draft.formData) && !picks.has(field.key));
  const pickFields = certificate.rest.filter((field) => picks.has(field.key));
  return (
    <div className="space-y-3">
      <Field id={issueAnchorId("siteName")} required label="單位名稱（中文）" hint="印在證書上的名稱。">{supplementFor("siteName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("siteName")?.publicComment}</p> : null}<TextInput value={draft.siteName ?? ""} onChange={(event) => { setDraft({ ...draft, siteName: event.target.value }); setDirty(true); }} /></Field>
      {certificate.nameEn ? <DefinitionField field={certificate.nameEn} draft={draft} setDraft={setDraft} setDirty={setDirty} supplementFor={supplementFor} /> : null}
      <Field id={issueAnchorId("siteAddress")} required label="單位地址（中文）" hint="印在證書上的地址。">{supplementFor("siteAddress") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("siteAddress")?.publicComment}</p> : null}<TextInput value={draft.siteAddress ?? ""} onChange={(event) => { setDraft({ ...draft, siteAddress: event.target.value }); setDirty(true); }} /></Field>
      {certificate.addressEn ? <DefinitionField field={certificate.addressEn} draft={draft} setDraft={setDraft} setDirty={setDirty} supplementFor={supplementFor} /> : null}
      <Field id={issueAnchorId("applicationDescription")} required label="申請說明" hint="申請表沒有獨立的說明欄。這裡留給審查閱讀，送件仍要填。">{supplementFor("applicationDescription") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("applicationDescription")?.publicComment}</p> : null}<TextArea value={draft.applicationDescription ?? ""} onChange={(event) => { setDraft({ ...draft, applicationDescription: event.target.value }); setDirty(true); }} /></Field>
      {pickFields.length ? (
        <Card className="space-y-2">
          <p className="font-medium">驗證項目</p>
          <p className="text-sm text-[var(--muted)]">可複選。早餐、午餐、晚餐、飲品、點心各自勾。旅宿含早餐與不含早餐只能擇一。體驗活動含食用品與不含食用品只能擇一。沒勾的附件不會出現。</p>
          {pickFields.map((field) => (
            <label key={field.key} id={issueAnchorId(`formData.${field.key}`)} className="flex scroll-mt-24 items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.formData[field.key] === true} onChange={(event) => { setDraft({ ...draft, formData: setChecked(draft.formData, field.key, event.target.checked) }); setDirty(true); }} />
              {field.label}
            </label>
          ))}
        </Card>
      ) : null}
      {rest.map((field) => <DefinitionField key={field.key} field={field} draft={draft} setDraft={setDraft} setDirty={setDirty} supplementFor={supplementFor} />)}
    </div>
  );
}

export function ApplicationPreview({ item, categoryName }: { item: ApplicationDetail; categoryName: string }) {
  const certificate = splitCertificateFields(item.definition.fields);
  const rows: Array<[string, string]> = [
    ["申請類別", categoryName],
    ["業者名稱", item.organizationName ?? ""],
    ["統一編號", item.taxId ?? ""],
    ["聯絡人", item.contactName ?? ""],
    ["電話", item.contactPhone ?? ""],
    ["Email", item.contactEmail ?? ""],
    ["地址", item.organizationAddress ?? ""],
    ["單位名稱（中文）", item.siteName ?? ""],
    ...(certificate.nameEn ? [[certificate.nameEn.label, fieldText(item, certificate.nameEn.key)] as [string, string]] : []),
    ["單位地址（中文）", item.siteAddress ?? ""],
    ...(certificate.addressEn ? [[certificate.addressEn.label, fieldText(item, certificate.addressEn.key)] as [string, string]] : []),
    ["申請說明", item.applicationDescription ?? ""],
    ...certificate.rest.filter((field) => fieldIsVisible(field, item.formData)).map((field) => [field.label, fieldText(item, field.key)] as [string, string]),
  ];
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className={label === "申請說明" || (value ?? "").length > 40 ? "sm:col-span-2" : ""}>
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="whitespace-pre-wrap text-sm">{value || "未填"}</p>
            </div>
          ))}
        </div>
      </Card>
      {(() => {
        const requirements = item.definition.attachmentRequirements.filter((requirement) => requirement.group !== "checklist" && attachmentIsVisible(requirement, item.formData));
        const legacyChecklist = item.definition.attachmentRequirements.filter((requirement) => requirement.group === "checklist" && item.attachments.some((file) => file.requirementKey === requirement.key && !file.capturedOnSite));
        if (requirements.length === 0 && legacyChecklist.length === 0) return null;
        return (
          <>
            {requirements.length ? (
              <Card className="space-y-4">
                <h2 className="font-medium">附件與照片</h2>
                {requirements.map((requirement) => {
                  const files = item.attachments.filter((file) => file.requirementKey === requirement.key && !file.capturedOnSite);
                  return (
                    <div key={requirement.key}>
                      <p className="text-sm">{requirement.label}{files.length === 0 ? "：尚未上傳" : ""}</p>
                      {files.filter((file) => file.mimeType === "application/pdf").map((file) => <OpenPdfButton key={file.id} fileId={file.fileId} name={file.originalName} />)}
                      {files.filter((file) => file.mimeType !== "application/pdf" && !file.mimeType.startsWith("image/")).map((file) => <p key={file.id} className="text-sm text-[var(--muted)]">{file.originalName}</p>)}
                      <AttachmentImages files={files} />
                    </div>
                  );
                })}
              </Card>
            ) : null}
            {legacyChecklist.length ? (
              <Card className="space-y-4">
                <h2 className="font-medium">舊版檢查表照片</h2>
                {legacyChecklist.map((requirement) => {
                  const files = item.attachments.filter((file) => file.requirementKey === requirement.key && !file.capturedOnSite);
                  return (
                    <div key={requirement.key}>
                      <p className="text-sm">{requirement.label}</p>
                      <AttachmentImages files={files} />
                    </div>
                  );
                })}
              </Card>
            ) : null}
          </>
        );
      })()}
    </div>
  );
}

function CategorySelect({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const services = useServices();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  return <SelectInput disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>;
}

export function ApplicationDetailPage() {
  const { applicationId = "" } = useParams();
  const services = useServices();
  const application = useQuery({ queryKey: ["application", applicationId], queryFn: () => services.application(applicationId) });
  const events = useQuery({ queryKey: ["events", applicationId], queryFn: () => services.events(applicationId) });
  if (application.isLoading) return <p>載入中…</p>;
  if (!application.data) return <ErrorText message="找不到案件" />;
  const item = application.data;
  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{item.applicationNo}</h1>
        <Button className="no-print" variant="secondary" onClick={() => window.print()}>列印</Button>
      </div>
      <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
      <ApplicationPreview item={item} categoryName={item.categoryName} />
      {(item.fieldReviews ?? []).some((review) => review.needsSupplement) ? (
        <Card className="space-y-1 text-sm">
          <p className="font-medium">審查請補這些項目</p>
          {(item.fieldReviews ?? []).filter((review) => review.needsSupplement).map((review) => <p key={review.key}>{reviewTargets(item.definition).find((target) => target.key === review.key)?.label ?? review.key}：{review.publicComment}</p>)}
        </Card>
      ) : null}
      <Card>
        <h2 className="font-medium">歷程與公開意見</h2>
        {(events.data ?? []).length === 0 ? <p className="text-sm text-[var(--muted)]">尚無送審紀錄。</p> : events.data?.map((event) => <p key={event.id} className="mt-2 text-sm">{formatTaipei(event.createdAt)} {event.actorName} {event.action} {event.publicComment ?? ""}</p>)}
      </Card>
    </div>
  );
}

export function LearningPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const passed = (rows.data ?? []).filter((row) => row.quizPassed && row.recognizedMinutes > 0);
  const total = passed.reduce((sum, row) => sum + row.recognizedMinutes, 0);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">我的學習紀錄</h1>
      <p className="text-sm">通過測驗的認可時數合計 {minutesToHourLabel(total)}。這份時數用課程的認證分鐘，不把線上影片的觀看秒數換算進來。取消的報名不計入。</p>
      {(rows.data ?? []).map((row) => (
        <Card key={row.id}>
          <p className="font-medium">{row.courseTitle}</p>
          <p className="text-sm">{row.delivery === "ONLINE" ? `已看 ${row.watchedSeconds} 秒` : `出席 ${labels.attendance[row.attendanceStatus].label} · ${row.attendedHoursLabel}`} · 認可：{row.quizPassed ? minutesToHourLabel(row.recognizedMinutes) : "尚未計入"} · <Badge tone={labels.completion[row.completion].tone}>{labels.completion[row.completion].label}</Badge></p>
          {row.trainingCertificateNo ? <p className="text-sm">訓練證書 {row.trainingCertificateNo} · {row.trainingCertificateIssuedOn} 至 {row.trainingCertificateValidUntil}</p> : null}
        </Card>
      ))}
    </div>
  );
}

export function CertificationPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["certifications"], queryFn: () => services.certifications() });
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">電子證書</h1>
      <p className="text-sm text-[var(--muted)]">只列出已經核發的證書。已核定、尚未發證的案件在工作總覽的「已核定」。</p>
      {message ? <p className="text-sm">{message}</p> : null}
      {rows.isLoading ? <p>載入中…</p> : null}
      {!rows.isLoading && (rows.data ?? []).length === 0 ? <Empty title="尚無證書資料" body="管理員發證後才會出現，可以預覽與下載 PDF。" /> : null}
      {rows.data?.map((item) => (
        <Card key={item.id} className="space-y-2">
          <p className="font-medium">{item.certificateNo}</p>
          <p className="text-sm text-[var(--muted)]">
            {item.templateTitle ?? "驗證證書"} · 案件 {item.applicationNo} · {item.issuedOnDate} 至 {item.validUntilDate} · {item.validityLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!item.bodyHtml}
              onClick={() => setPreview({ title: item.templateTitle ?? item.certificateNo, html: item.bodyHtml ?? "" })}
            >
              預覽
            </Button>
            <Button
              type="button"
              disabled={busyId === item.applicationId || !item.hasDocument}
              onClick={async () => {
                setBusyId(item.applicationId);
                setMessage("");
                try {
                  const file = await services.certificationDocument(item.applicationId);
                  const url = URL.createObjectURL(file.blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = file.name;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  setMessage(error instanceof ClientError ? error.message : "無法下載證書");
                } finally {
                  setBusyId(null);
                }
              }}
            >
              下載 PDF
            </Button>
          </div>
        </Card>
      ))}
      {preview ? (
        <Modal title={preview.title} onClose={() => setPreview(null)} wide>
          <div className="certificate-sheet contract-body-view max-w-3xl border border-[var(--line)] bg-white text-sm" dangerouslySetInnerHTML={{ __html: layoutCertificateRowsHtml(preview.html) }} />
        </Modal>
      ) : null}
    </div>
  );
}
