import { applicationStatusLabels, attachmentIsRequired, fieldIsRequired, reviewTargets, validateSubmit, type ApplicationDetail } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useServices } from "../../app/session";
import { AttachmentImages } from "../../components/AttachmentImages";
import { TrainingPage } from "./TrainingPage";
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, SelectInput, TextArea, TextInput } from "../../components/ui";
import { formatBytes, formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";

export function PortalHome() {
  const services = useServices();
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => services.summary() });
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => services.applications({ page: 1 }) });
  if (summary.isLoading) return <p>載入中…</p>;
  if (summary.error) return <ErrorText message="無法載入總覽" />;
  const data = summary.data!;
  const cards = [
    ["草稿", data.draft],
    ["審核中", data.submitted + data.initialReview + data.secondReview + data.finalReview],
    ["待補件", data.needSupplement],
    ["已核定", data.approved],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">總覽</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, count]) => <Card key={String(label)}><p className="text-sm text-[var(--muted)]">{label}</p><p className="text-2xl font-semibold">{count}</p></Card>)}</div>
      <Card>
        <h2 className="font-medium">待辦案件</h2>
        {(apps.data?.items ?? []).filter((item) => item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT").slice(0, 5).map((item) => (
          <Link key={item.id} className="mt-2 block text-sm text-[var(--link)]" to={item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT" ? `/portal/applications/${item.id}/edit` : `/portal/applications/${item.id}`}>{item.applicationNo} · {applicationStatusLabels[item.status].label}</Link>
        ))}
      </Card>
      <Card>
        <h2 className="font-medium">近期課程</h2>
        {data.upcoming.length === 0 ? <p className="text-sm text-[var(--muted)]">目前沒有即將開始的公開課程。</p> : data.upcoming.map((course) => <p key={course.id} className="text-sm">{course.title} · {formatTaipei(course.startsAt)} · {course.location}</p>)}
      </Card>
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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
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
      {(query.data?.items.length ?? 0) === 0 && !query.isLoading ? <Empty title="沒有案件" body="可以新增一筆草稿。" /> : null}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left"><tr><th className="p-3">案件編號</th><th className="p-3">類別</th><th className="p-3">更新時間</th><th className="p-3">狀態</th></tr></thead>
          <tbody>
            {query.data?.items.map((item) => (
              <tr key={item.id} className="border-t border-stone-100">
                <td className="p-3"><Link className="text-[var(--link)]" to={item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT" ? `/portal/applications/${item.id}/edit` : `/portal/applications/${item.id}`}>{item.applicationNo}</Link></td>
                <td className="p-3">{item.categoryName}</td>
                <td className="p-3">{formatTaipei(item.updatedAt)}</td>
                <td className="p-3"><Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NewApplicationPage() {
  const services = useServices();
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-semibold">新增申請</h1>
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
    </Card>
  );
}

export function ApplicationEditPage() {
  const { applicationId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["application", applicationId], queryFn: () => services.application(applicationId) });
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  if (query.isLoading || !draft) return <p>載入中…</p>;
  if (query.isError) return <ErrorText message="找不到申請或沒有權限" />;
  const steps = ["申請類別", "業者與聯絡資料", "申請內容", "附件資料", "檢查表照片", "線上預覽", "確認送件"];
  const previewStep = 5;
  const confirmStep = 6;
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
  async function openStep(next: number) {
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
        <Field label="類別" hint="只有未送件草稿可以改類別，不相容的額外欄位會被清掉。">
          <CategorySelect value={draft.categoryId} disabled={draft.status !== "DRAFT"} onChange={(categoryId) => { setDraft({ ...draft, categoryId }); setDirty(true); }} />
          {supplementFor("category") ? <p className="text-sm">審查請補件：{supplementFor("category")?.publicComment}</p> : null}
        </Field>
      ) : null}
      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field required label="業者名稱">{supplementFor("organizationName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("organizationName")?.publicComment}</p> : null}<TextInput value={draft.organizationName ?? ""} onChange={(event) => { setDraft({ ...draft, organizationName: event.target.value }); setDirty(true); }} /></Field>
          <Field label="統一編號" hint="沒有統編可以留空。有填的話暫定 8 位數字。">{supplementFor("taxId") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("taxId")?.publicComment}</p> : null}<TextInput value={draft.taxId ?? ""} onChange={(event) => { setDraft({ ...draft, taxId: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="聯絡人">{supplementFor("contactName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactName")?.publicComment}</p> : null}<TextInput value={draft.contactName ?? ""} onChange={(event) => { setDraft({ ...draft, contactName: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="電話">{supplementFor("contactPhone") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactPhone")?.publicComment}</p> : null}<TextInput value={draft.contactPhone ?? ""} onChange={(event) => { setDraft({ ...draft, contactPhone: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="Email">{supplementFor("contactEmail") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("contactEmail")?.publicComment}</p> : null}<TextInput value={draft.contactEmail ?? ""} onChange={(event) => { setDraft({ ...draft, contactEmail: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="地址">{supplementFor("organizationAddress") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("organizationAddress")?.publicComment}</p> : null}<TextInput value={draft.organizationAddress ?? ""} onChange={(event) => { setDraft({ ...draft, organizationAddress: event.target.value }); setDirty(true); }} /></Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <Field required label="單位名稱（中文）" hint="印在證書上的名稱。">{supplementFor("siteName") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("siteName")?.publicComment}</p> : null}<TextInput value={draft.siteName ?? ""} onChange={(event) => { setDraft({ ...draft, siteName: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="單位地址（中文）" hint="印在證書上的地址。">{supplementFor("siteAddress") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("siteAddress")?.publicComment}</p> : null}<TextInput value={draft.siteAddress ?? ""} onChange={(event) => { setDraft({ ...draft, siteAddress: event.target.value }); setDirty(true); }} /></Field>
          <Field required label="申請說明" hint="申請表沒有獨立的說明欄。這裡留給審查閱讀，送件仍要填。">{supplementFor("applicationDescription") ? <p className="mb-1 text-sm">審查請補件：{supplementFor("applicationDescription")?.publicComment}</p> : null}<TextArea value={draft.applicationDescription ?? ""} onChange={(event) => { setDraft({ ...draft, applicationDescription: event.target.value }); setDirty(true); }} /></Field>
          {draft.definition.fields.map((field) => (
            <Field key={field.key} required={fieldIsRequired(field, draft.formData)} label={field.label} hint={field.helpText}>
              {supplementFor(field.key) ? <p className="mb-1 text-sm">審查請補件：{supplementFor(field.key)?.publicComment}</p> : null}
              {field.inputType === "textarea" ? <TextArea value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: event.target.value } }); setDirty(true); }} /> : null}
              {field.inputType === "select" ? <SelectInput value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: event.target.value } }); setDirty(true); }}><option value="">請選擇</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectInput> : null}
              {field.inputType === "checkbox" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.formData[field.key] === true} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: event.target.checked } }); setDirty(true); }} />{field.label}</label> : null}
              {field.inputType !== "textarea" && field.inputType !== "select" && field.inputType !== "checkbox" ? <TextInput type={field.inputType === "number" ? "number" : field.inputType === "date" ? "date" : "text"} value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: field.inputType === "number" ? Number(event.target.value) : event.target.value } }); setDirty(true); }} /> : null}
            </Field>
          ))}
        </div>
      ) : null}
      {step === 3 || step === 4 ? (
        <div className="space-y-3">
          {step === 4 ? <p className="text-sm text-[var(--muted)]">依這一類的正式檢查表，每一項上傳一張照片。</p> : null}
          {draft.definition.attachmentRequirements.filter((requirement) => (requirement.group === "checklist") === (step === 4)).map((requirement) => {
            const files = draft.attachments.filter((item) => item.requirementKey === requirement.key && !item.capturedOnSite);
            const needed = attachmentIsRequired(requirement, draft.formData);
            const image = requirement.accept === "image";
            return (
              <Card key={requirement.key}>
                <p className="font-medium">{needed ? <span className="text-[var(--danger)]">* </span> : null}{requirement.label}</p>
                {supplementFor(`attachment:${requirement.key}`) ? <p className="text-sm">審查請補件：{supplementFor(`attachment:${requirement.key}`)?.publicComment}</p> : null}
                <p className="text-xs text-[var(--muted)]">{image ? "只接受 JPEG、PNG。" : "PDF、JPEG、PNG。"}單檔 10 MiB。{requirement.multiple ? "可上傳多張。" : ""}{requirement.helpText}</p>
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
                  accept={image ? "image/jpeg,image/png" : "application/pdf,image/jpeg,image/png"}
                  multiple={requirement.multiple}
                  ariaLabel={requirement.label}
                  onFiles={async (selected) => {
                    try {
                      await save();
                      for (const file of selected) await services.upload(draft.id, requirement.key, file);
                      setMessage(image ? "照片已上傳，可以在下方查看。" : "附件已上傳");
                      await client.invalidateQueries({ queryKey: ["application", applicationId] });
                    } catch (reason) {
                      setError(reason instanceof ClientError ? reason.message : "上傳失敗");
                    }
                  }}
                />
              </Card>
            );
          })}
          {step === 4 && draft.definition.attachmentRequirements.every((requirement) => requirement.group !== "checklist") ? <p className="text-sm">這一版表單還沒有檢查表照片。新建立的草稿才有。</p> : null}
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
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.declarationAccepted} onChange={(event) => { setDraft({ ...draft, declarationAccepted: event.target.checked }); setDirty(true); }} /><span><span className="text-[var(--danger)]">* </span>我確認以上資料可作為本次送件內容</span></label>
          {submitIssues.length ? (
            <div className="space-y-1 text-[var(--danger)]">
              <p>還有必填項目沒完成，不能送件。</p>
              {submitIssues.map((issue) => <p key={issue.path}>{issue.message}</p>)}
            </div>
          ) : <p>必填項目都有了，可以送件。</p>}
          <Button disabled={submitIssues.length > 0} onClick={() => { if (submitIssues.length === 0) setConfirm(true); }}>送出申請</Button>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void save()}>儲存草稿</Button>
        {step > 0 ? <Button variant="ghost" onClick={() => void openStep(step - 1)}>上一步</Button> : null}
        {step < confirmStep ? <Button variant="ghost" onClick={() => void openStep(step + 1)}>{step === previewStep ? "下一步：確認送件" : "下一步"}</Button> : null}
      </div>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
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

export function ApplicationPreview({ item, categoryName }: { item: ApplicationDetail; categoryName: string }) {
  const rows: Array<[string, string]> = [
    ["申請類別", categoryName],
    ["業者名稱", item.organizationName ?? ""],
    ["統一編號", item.taxId ?? ""],
    ["聯絡人", item.contactName ?? ""],
    ["電話", item.contactPhone ?? ""],
    ["Email", item.contactEmail ?? ""],
    ["地址", item.organizationAddress ?? ""],
    ["單位名稱（中文）", item.siteName ?? ""],
    ["單位地址（中文）", item.siteAddress ?? ""],
    ["申請說明", item.applicationDescription ?? ""],
    ...item.definition.fields.map((field) => [field.label, fieldText(item, field.key)] as [string, string]),
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
      {(["application", "checklist"] as const).map((group) => {
        const requirements = item.definition.attachmentRequirements.filter((requirement) => (requirement.group === "checklist") === (group === "checklist"));
        if (requirements.length === 0) return null;
        return (
      <Card key={group} className="space-y-4">
        <h2 className="font-medium">{group === "checklist" ? "檢查表照片" : "附件與照片"}</h2>
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
        );
      })}
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

export function EnrollmentPage() {
  return <TrainingPage />;
}

export function LearningPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const total = (rows.data ?? []).filter((row) => row.countsTowardTotal).reduce((sum, row) => sum + row.attendedMinutes, 0);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">我的學習紀錄</h1>
      <p className="text-sm">已完成時數合計 {Math.round((total / 60) * 10) / 10} 小時。未登錄顯示待登錄，取消的報名不計入。</p>
      {(rows.data ?? []).map((row) => (
        <Card key={row.id}>
          <p className="font-medium">{row.courseTitle}</p>
          <p className="text-sm">出席：{labels.attendance[row.attendanceStatus].label} · {row.attendedHoursLabel} · <Badge tone={labels.completion[row.completion].tone}>{labels.completion[row.completion].label}</Badge></p>
        </Card>
      ))}
    </div>
  );
}

export function CertificationPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["certifications"], queryFn: () => services.certifications() });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">電子證書</h1>
      <p className="text-sm text-[var(--muted)]">證書由管理員人工登錄，系統不自動產製，也不會自動換證。</p>
      {(rows.data ?? []).length === 0 ? <Empty title="尚無證書資料" body="核定後才會出現人工登錄的紀錄。" /> : null}
      {rows.data?.map((item) => <Card key={item.id}><p className="font-medium">{item.certificateNo}</p><p className="text-sm">案件 {item.applicationNo} · {item.issuedOnDate} 至 {item.validUntilDate} · {item.validityLabel}</p></Card>)}
    </div>
  );
}
