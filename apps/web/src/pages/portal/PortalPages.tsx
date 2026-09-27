import { applicationStatusLabels, type ApplicationDetail } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useServices } from "../../app/session";
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, count]) => <Card key={String(label)}><p className="text-sm text-stone-500">{label}</p><p className="text-2xl font-semibold">{count}</p></Card>)}</div>
      <Card>
        <h2 className="font-medium">待辦案件</h2>
        {(apps.data?.items ?? []).filter((item) => item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT").slice(0, 5).map((item) => (
          <Link key={item.id} className="mt-2 block text-sm text-[#0e5c4a]" to={item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT" ? `/portal/applications/${item.id}/edit` : `/portal/applications/${item.id}`}>{item.applicationNo} · {applicationStatusLabels[item.status].label}</Link>
        ))}
      </Card>
      <Card>
        <h2 className="font-medium">近期課程</h2>
        {data.upcoming.length === 0 ? <p className="text-sm text-stone-500">目前沒有即將開始的公開課程。</p> : data.upcoming.map((course) => <p key={course.id} className="text-sm">{course.title} · {formatTaipei(course.startsAt)} · {course.location}</p>)}
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
      <p className="text-sm text-stone-500">統一編號 {query.data?.taxId ?? "—"}。修改這裡不會回寫已送出的申請快照。</p>
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
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-semibold">我的申請</h1><Link to="/portal/applications/new" className="rounded-md bg-[#0e5c4a] px-3 py-2 text-sm text-white">新增申請</Link></div>
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
                <td className="p-3"><Link className="text-[#0e5c4a]" to={item.status === "DRAFT" || item.status === "NEED_SUPPLEMENT" ? `/portal/applications/${item.id}/edit` : `/portal/applications/${item.id}`}>{item.applicationNo}</Link></td>
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
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  if (query.isLoading || !draft) return <p>載入中…</p>;
  if (query.isError) return <ErrorText message="找不到申請或沒有權限" />;
  const steps = ["申請類別", "業者與聯絡資料", "申請內容", "附件資料", "確認送件"];
  async function save() {
    if (!draft) return;
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
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{steps.map((label, index) => <button key={label} className={`rounded-full px-3 py-1 text-sm ${index === step ? "bg-[#0e5c4a] text-white" : "bg-white"}`} type="button" onClick={() => setStep(index)}>{index + 1}. {label}</button>)}</div>
      <p className="text-sm text-stone-500">案件 {draft.applicationNo} · 版本 {draft.version} · {draft.configurationStatus === "DEMO" ? "此類別為示範設定" : "類別已確認"}</p>
      {step === 0 ? (
        <Field label="類別" hint="只有未送件草稿可以改類別，不相容的額外欄位會被清掉。">
          <CategorySelect value={draft.categoryId} disabled={draft.status !== "DRAFT"} onChange={(categoryId) => { setDraft({ ...draft, categoryId }); setDirty(true); }} />
        </Field>
      ) : null}
      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="業者名稱"><TextInput value={draft.organizationName ?? ""} onChange={(event) => { setDraft({ ...draft, organizationName: event.target.value }); setDirty(true); }} /></Field>
          <Field label="統一編號" hint="暫定 8 位數字"><TextInput value={draft.taxId ?? ""} onChange={(event) => { setDraft({ ...draft, taxId: event.target.value }); setDirty(true); }} /></Field>
          <Field label="聯絡人"><TextInput value={draft.contactName ?? ""} onChange={(event) => { setDraft({ ...draft, contactName: event.target.value }); setDirty(true); }} /></Field>
          <Field label="電話"><TextInput value={draft.contactPhone ?? ""} onChange={(event) => { setDraft({ ...draft, contactPhone: event.target.value }); setDirty(true); }} /></Field>
          <Field label="Email"><TextInput value={draft.contactEmail ?? ""} onChange={(event) => { setDraft({ ...draft, contactEmail: event.target.value }); setDirty(true); }} /></Field>
          <Field label="地址"><TextInput value={draft.organizationAddress ?? ""} onChange={(event) => { setDraft({ ...draft, organizationAddress: event.target.value }); setDirty(true); }} /></Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <Field label="場所名稱"><TextInput value={draft.siteName ?? ""} onChange={(event) => { setDraft({ ...draft, siteName: event.target.value }); setDirty(true); }} /></Field>
          <Field label="場所地址"><TextInput value={draft.siteAddress ?? ""} onChange={(event) => { setDraft({ ...draft, siteAddress: event.target.value }); setDirty(true); }} /></Field>
          <Field label="申請說明"><TextArea value={draft.applicationDescription ?? ""} onChange={(event) => { setDraft({ ...draft, applicationDescription: event.target.value }); setDirty(true); }} /></Field>
          {draft.definition.fields.map((field) => (
            <Field key={field.key} label={`${field.label}${field.requiredOnSubmit ? "（送件必填）" : ""}`} hint={field.helpText}>
              {field.inputType === "textarea" ? <TextArea value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: event.target.value } }); setDirty(true); }} /> : null}
              {field.inputType === "select" ? <SelectInput value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: event.target.value } }); setDirty(true); }}><option value="">請選擇</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectInput> : null}
              {field.inputType !== "textarea" && field.inputType !== "select" ? <TextInput type={field.inputType === "number" ? "number" : field.inputType === "date" ? "date" : "text"} value={String(draft.formData[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, formData: { ...draft.formData, [field.key]: field.inputType === "number" ? Number(event.target.value) : event.target.value } }); setDirty(true); }} /> : null}
            </Field>
          ))}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3">
          {draft.definition.attachmentRequirements.map((requirement) => {
            const file = draft.attachments.find((item) => item.requirementKey === requirement.key);
            return (
              <Card key={requirement.key}>
                <p className="font-medium">{requirement.label}{requirement.requiredOnSubmit ? "（送件必要）" : "（選填）"}</p>
                <p className="text-xs text-stone-500">PDF、JPEG、PNG，單檔 10 MiB。{requirement.helpText}</p>
                {file ? <p className="text-sm">{file.originalName} · {formatBytes(file.sizeBytes)}</p> : <p className="text-sm text-stone-500">尚未上傳</p>}
                <input className="mt-2 block text-sm" type="file" accept="application/pdf,image/jpeg,image/png" aria-label={requirement.label} onChange={async (event) => {
                  const selected = event.target.files?.[0];
                  if (!selected) return;
                  try {
                    await save();
                    await services.upload(draft.id, requirement.key, selected);
                    setMessage("附件已上傳");
                    await client.invalidateQueries({ queryKey: ["application", applicationId] });
                  } catch (reason) {
                    setError(reason instanceof ClientError ? reason.message : "上傳失敗");
                  }
                }} />
              </Card>
            );
          })}
        </div>
      ) : null}
      {step === 4 ? (
        <Card className="space-y-2 text-sm">
          <p>場所：{draft.siteName || "未填"}</p>
          <p>說明：{draft.applicationDescription || "未填"}</p>
          <p>附件：{draft.attachments.length} 個</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.declarationAccepted} onChange={(event) => { setDraft({ ...draft, declarationAccepted: event.target.checked }); setDirty(true); }} />我確認以上資料可作為本次送件內容</label>
          <Button onClick={() => setConfirm(true)}>送出申請</Button>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void save()}>儲存草稿</Button>
        {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>上一步</Button> : null}
        {step < 4 ? <Button variant="ghost" onClick={() => setStep(step + 1)}>下一步</Button> : null}
      </div>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
      {confirm ? (
        <Modal title="確認送件" onClose={() => setConfirm(false)}>
          <p className="text-sm">送件後會建立不可覆寫的快照。若資料不完整，狀態不會改變。</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={async () => {
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
      <Card>
        <p>{item.categoryName}</p>
        <p>場所：{item.siteName} / {item.siteAddress}</p>
        <p>說明：{item.applicationDescription}</p>
        <p>聯絡人：{item.contactName} {item.contactPhone}</p>
      </Card>
      <Card>
        <h2 className="font-medium">歷程與公開意見</h2>
        {(events.data ?? []).length === 0 ? <p className="text-sm text-stone-500">尚無送審紀錄。</p> : events.data?.map((event) => <p key={event.id} className="mt-2 text-sm">{formatTaipei(event.createdAt)} {event.actorName} {event.action} {event.publicComment ?? ""}</p>)}
      </Card>
    </div>
  );
}

export function EnrollmentPage() {
  const services = useServices();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const [cancelId, setCancelId] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">課程報名</h1>
      <p className="text-sm text-stone-500">取消規則暫定為報名截止前，待確認。</p>
      {(rows.data ?? []).map((row) => (
        <Card key={row.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{row.courseTitle}</p>
            <Badge tone={labels.enrollment[row.status].tone}>{labels.enrollment[row.status].label}</Badge>
          </div>
          <p className="text-sm">{formatTaipei(row.startsAt)} · {row.location}</p>
          {row.status === "CONFIRMED" ? <Button variant="secondary" onClick={() => setCancelId(row.id)}>取消報名</Button> : null}
        </Card>
      ))}
      {(rows.data?.length ?? 0) === 0 ? <Empty title="尚未報名" body="可從公開課程頁報名。" /> : null}
      {cancelId ? <Modal title="取消報名" onClose={() => setCancelId(null)}><p className="text-sm">確定取消這筆報名？名額會釋放。</p><Button className="mt-3" onClick={async () => { await services.cancelEnrollment(cancelId); setCancelId(null); await client.invalidateQueries({ queryKey: ["learning"] }); }}>確認取消</Button></Modal> : null}
    </div>
  );
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
      <h1 className="text-2xl font-semibold">驗證紀錄</h1>
      <p className="text-sm text-stone-500">證書由管理員人工登錄，系統不自動產製，也不會自動換證。</p>
      {(rows.data ?? []).length === 0 ? <Empty title="尚無證書資料" body="核定後才會出現人工登錄的紀錄。" /> : null}
      {rows.data?.map((item) => <Card key={item.id}><p className="font-medium">{item.certificateNo}</p><p className="text-sm">案件 {item.applicationNo} · {item.issuedOnDate} 至 {item.validUntilDate} · {item.validityLabel}</p></Card>)}
    </div>
  );
}
