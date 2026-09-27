import { applicationStatusLabels, courseStatusLabels, userRoleLabels, type CourseStatus, type UserRole } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, SelectInput, TextArea, TextInput } from "../../components/ui";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";

export function AdminHome() {
  const services = useServices();
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => services.summary() });
  if (summary.isLoading) return <p>載入中…</p>;
  if (!summary.data) return <ErrorText message="無法載入工作總覽" />;
  const data = summary.data;
  const cards = [["待派案", data.submitted], ["初審", data.initialReview], ["複審", data.secondReview], ["待核定", data.finalReview], ["待補件", data.needSupplement]];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">工作總覽</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{cards.map(([label, count]) => <Card key={String(label)}><p className="text-sm text-stone-500">{label}</p><p className="text-2xl font-semibold">{count}</p></Card>)}</div>
      <Card><h2 className="font-medium">近期課程</h2>{data.upcoming.map((course) => <p key={course.id} className="text-sm">{course.title} · {formatTaipei(course.startsAt)}</p>)}</Card>
    </div>
  );
}

export function AdminApplicationList() {
  const services = useServices();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["admin-applications", q, status], queryFn: () => services.applications({ q, status, page: 1 }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">案件管理</h1>
        <Button variant="secondary" onClick={async () => downloadText("applications.csv", await services.exportApplications())}>匯出 CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <TextInput placeholder="編號或業者" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋案件" />
        <SelectInput value={status} onChange={(event) => setStatus(event.target.value)} aria-label="狀態篩選"><option value="">全部</option>{Object.entries(applicationStatusLabels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</SelectInput>
      </div>
      {(query.data?.items.length ?? 0) === 0 ? <Empty title="沒有符合的案件" body="調整篩選，或確認你只能看到指派給自己的案件。" /> : null}
      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="min-w-full text-sm"><thead><tr className="text-left"><th className="p-3">編號</th><th className="p-3">業者</th><th className="p-3">類別</th><th className="p-3">承辦</th><th className="p-3">狀態</th></tr></thead>
          <tbody>{query.data?.items.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><Link className="text-[#0e5c4a]" to={`/admin/applications/${item.id}`}>{item.applicationNo}</Link></td><td className="p-3">{item.organizationName}</td><td className="p-3">{item.categoryName}</td><td className="p-3">{item.assignedToName ?? "未派案"}</td><td className="p-3"><Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminApplicationDetail() {
  const { applicationId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const application = useQuery({ queryKey: ["application", applicationId], queryFn: () => services.application(applicationId) });
  const events = useQuery({ queryKey: ["events", applicationId], queryFn: () => services.events(applicationId) });
  const session = useSession();
  const users = useQuery({ queryKey: ["staff-options"], queryFn: () => services.users(), enabled: session.user?.role === "ADMIN" });
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  if (!application.data) return application.isLoading ? <p>載入中…</p> : <ErrorText message="找不到案件" />;
  const item = application.data;
  const actions = availableActions(item.status, session.user?.role ?? "");
  async function run(action: string) {
    try {
      await services.review(item.id, { action, expectedVersion: item.version, requestId: crypto.randomUUID(), publicComment: comment, internalNote: note });
      setPending(null);
      setError(null);
      await client.invalidateQueries({ queryKey: ["application", applicationId] });
      await client.invalidateQueries({ queryKey: ["events", applicationId] });
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "動作失敗");
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{item.applicationNo}</h1>
      <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
      <Card className="text-sm"><p>業者 {item.organizationName} · 統編 {item.taxId}</p><p>場所 {item.siteName} / {item.siteAddress}</p><p>{item.applicationDescription}</p><p>表單版本 {item.formVersion} · {item.configurationStatus === "DEMO" ? "示範設定" : "已確認"}</p></Card>
      <Card>
        <h2 className="font-medium">附件</h2>
        {item.attachments.map((file) => <button key={file.id} className="mt-1 block text-sm text-[#0e5c4a]" type="button" onClick={async () => { const downloaded = await services.download(file.fileId); const url = URL.createObjectURL(downloaded.blob); const link = document.createElement("a"); link.href = url; link.download = downloaded.name; link.click(); }}>{file.originalName}</button>)}
        {item.attachments.length === 0 ? <p className="text-sm text-stone-500">沒有附件。</p> : null}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-medium">派案與審查</h2>
        <p className="text-xs text-stone-500">不能用下拉直接改狀態。郵件若為模擬，不會顯示成已寄出。</p>
        {session.user?.role === "ADMIN" ? (
          <>
            <Field label="指派承辦"><SelectInput value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">選擇</option>{(users.data ?? []).filter((user) => user.role !== "APPLICANT" && user.isActive).map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</SelectInput></Field>
            <Button variant="secondary" onClick={async () => { try { await services.assign(item.id, assignee, item.version, crypto.randomUUID()); await client.invalidateQueries({ queryKey: ["application", applicationId] }); } catch (reason) { setError(reason instanceof ClientError ? reason.message : "派案失敗"); } }}>指派承辦</Button>
          </>
        ) : <p className="text-sm text-stone-500">派案、核定與退件由管理員執行。承辦可提出審查意見。</p>}
        <Field label="公開意見"><TextArea value={comment} onChange={(event) => setComment(event.target.value)} /></Field>
        <Field label="內部註記"><TextArea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">{actions.map((action) => <Button key={action.code} onClick={() => setPending(action.code)}>{action.label}</Button>)}</div>
        {item.status === "APPROVED" ? <CertificationForm applicationId={item.id} /> : null}
      </Card>
      <Card><h2 className="font-medium">歷程</h2>{events.data?.map((event) => <p key={event.id} className="mt-2 text-sm">{formatTaipei(event.createdAt)} {event.actorName} {event.action} {event.publicComment ?? ""} {event.internalNote ? `（內部：${event.internalNote}）` : ""}</p>)}</Card>
      {error ? <ErrorText message={error} /> : null}
      {pending ? <Modal title="確認審查動作" onClose={() => setPending(null)}><p className="text-sm">將執行 {pending}。若版本已變，系統會拒絕覆蓋。</p><Button className="mt-3" onClick={() => void run(pending)}>確認執行</Button></Modal> : null}
    </div>
  );
}

function availableActions(status: string, role: string) {
  const adminOnly = new Set(["APPROVE", "REJECT"]);
  const actions = status === "SUBMITTED" ? [{ code: "START_REVIEW", label: "開始初審" }]
    : status === "INITIAL_REVIEW" ? [{ code: "PASS_INITIAL", label: "初審通過" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : status === "SECOND_REVIEW" ? [{ code: "PASS_SECOND", label: "複審通過" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : status === "FINAL_REVIEW" ? [{ code: "APPROVE", label: "核定" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : [];
  return role === "ADMIN" ? actions : actions.filter((action) => !adminOnly.has(action.code) && status !== "FINAL_REVIEW");
}

function CertificationForm({ applicationId }: { applicationId: string }) {
  const services = useServices();
  const [form, setForm] = useState({ certificateNo: "", issuedOnDate: "", validUntilDate: "" });
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2 border-t pt-3">
      <h3 className="font-medium">人工登錄證書</h3>
      <Field label="證書編號"><TextInput value={form.certificateNo} onChange={(event) => setForm({ ...form, certificateNo: event.target.value })} /></Field>
      <Field label="核發日"><TextInput type="date" value={form.issuedOnDate} onChange={(event) => setForm({ ...form, issuedOnDate: event.target.value })} /></Field>
      <Field label="到期日"><TextInput type="date" value={form.validUntilDate} onChange={(event) => setForm({ ...form, validUntilDate: event.target.value })} /></Field>
      <Button onClick={async () => { try { const saved = await services.saveCertification(applicationId, form); setMessage(`已登錄 ${saved.certificateNo}，${saved.validityLabel}`); } catch (error) { setMessage(error instanceof ClientError ? error.message : "登錄失敗"); } }}>儲存證書資料</Button>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function CourseListPage() {
  const services = useServices();
  const courses = useQuery({ queryKey: ["courses", "manage"], queryFn: () => services.courses("manage") });
  return (
    <div className="space-y-3">
      <div className="flex justify-between"><h1 className="text-2xl font-semibold">課程管理</h1><Link className="rounded-md bg-[#0e5c4a] px-3 py-2 text-sm text-white" to="/admin/courses/new">新增課程</Link></div>
      {courses.data?.map((course) => <Card key={course.id}><div className="flex justify-between"><Link className="font-medium text-[#0e5c4a]" to={`/admin/courses/${course.id}/edit`}>{course.title}</Link><Badge tone={courseStatusLabels[course.status].tone}>{courseStatusLabels[course.status].label}</Badge></div><p className="text-sm">名額 {course.confirmedCount}/{course.capacity}</p><Link className="text-sm" to={`/admin/courses/${course.id}/enrollments`}>報名名單</Link></Card>)}
    </div>
  );
}

export function CourseFormPage() {
  const { courseId } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const existing = useQuery({ queryKey: ["course", courseId], queryFn: () => services.course(courseId ?? "", "manage"), enabled: Boolean(courseId) });
  const [error, setError] = useState<string | null>(null);
  const course = existing.data;
  const [form, setForm] = useState<{ title: string; description: string; location: string; startsAt: string; endsAt: string; registrationOpensAt: string; registrationClosesAt: string; capacity: number; durationMinutes: number; requiredAttendanceMinutes: number; status: CourseStatus }>({ title: "", description: "", location: "", startsAt: "", endsAt: "", registrationOpensAt: "", registrationClosesAt: "", capacity: 20, durationMinutes: 180, requiredAttendanceMinutes: 120, status: "DRAFT" });
  const value = course ? { title: course.title, description: course.description, location: course.location, startsAt: toLocal(course.startsAt), endsAt: toLocal(course.endsAt), registrationOpensAt: toLocal(course.registrationOpensAt), registrationClosesAt: toLocal(course.registrationClosesAt), capacity: course.capacity, durationMinutes: course.durationMinutes, requiredAttendanceMinutes: course.requiredAttendanceMinutes, status: course.status } : form;
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-semibold">{courseId ? "編輯課程" : "新增課程"}</h1>
      {(["title", "location"] as const).map((key) => <Field key={key} label={key === "title" ? "名稱" : "地點"}><TextInput value={course ? value[key] : form[key]} onChange={(event) => setForm({ ...value, [key]: event.target.value })} /></Field>)}
      <Field label="說明"><TextArea value={course ? value.description : form.description} onChange={(event) => setForm({ ...value, description: event.target.value })} /></Field>
      <Field label="開始"><TextInput type="datetime-local" value={course && !form.startsAt ? value.startsAt : form.startsAt || value.startsAt} onChange={(event) => setForm({ ...value, startsAt: event.target.value })} /></Field>
      <Field label="結束"><TextInput type="datetime-local" value={form.endsAt || value.endsAt} onChange={(event) => setForm({ ...value, endsAt: event.target.value })} /></Field>
      <Field label="報名開始"><TextInput type="datetime-local" value={form.registrationOpensAt || value.registrationOpensAt} onChange={(event) => setForm({ ...value, registrationOpensAt: event.target.value })} /></Field>
      <Field label="報名截止"><TextInput type="datetime-local" value={form.registrationClosesAt || value.registrationClosesAt} onChange={(event) => setForm({ ...value, registrationClosesAt: event.target.value })} /></Field>
      <Field label="名額"><TextInput type="number" value={form.capacity || value.capacity} onChange={(event) => setForm({ ...value, capacity: Number(event.target.value) })} /></Field>
      <Field label="課程分鐘"><TextInput type="number" value={form.durationMinutes || value.durationMinutes} onChange={(event) => setForm({ ...value, durationMinutes: Number(event.target.value) })} /></Field>
      <Field label="完課分鐘" hint="已有出席紀錄時，初版不允許改門檻。"><TextInput type="number" value={form.requiredAttendanceMinutes || value.requiredAttendanceMinutes} onChange={(event) => setForm({ ...value, requiredAttendanceMinutes: Number(event.target.value) })} /></Field>
      <Field label="狀態"><SelectInput value={form.status || value.status} onChange={(event) => setForm({ ...value, status: event.target.value as CourseStatus })}>{Object.entries(courseStatusLabels).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</SelectInput></Field>
      {error ? <ErrorText message={error} /> : null}
      <Button onClick={async () => {
        const payload = { ...(course ? value : form), ...form, startsAt: new Date(form.startsAt || value.startsAt).toISOString(), endsAt: new Date(form.endsAt || value.endsAt).toISOString(), registrationOpensAt: new Date(form.registrationOpensAt || value.registrationOpensAt).toISOString(), registrationClosesAt: new Date(form.registrationClosesAt || value.registrationClosesAt).toISOString(), expectedVersion: course?.version };
        try {
          const saved = await services.saveCourse(payload, courseId);
          navigate(`/admin/courses/${saved.id}/edit`);
        } catch (reason) {
          setError(reason instanceof ClientError ? reason.message : "儲存失敗");
        }
      }}>儲存課程</Button>
    </Card>
  );
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
    <div className="space-y-3">
      <div className="flex justify-between"><h1 className="text-2xl font-semibold">報名名單</h1><Button variant="secondary" onClick={async () => downloadText("enrollments.csv", await services.exportEnrollments(courseId))}>匯出名單</Button></div>
      {(rows.data ?? []).map((row) => <AttendanceRow key={row.id} row={row} onSaved={() => client.invalidateQueries({ queryKey: ["enrollments", courseId] })} />)}
      {(rows.data?.length ?? 0) === 0 ? <Empty title="還沒有報名" body="公開課程後，業者可以自行報名。" /> : null}
    </div>
  );
}

function AttendanceRow({ row, onSaved }: { row: Awaited<ReturnType<ReturnType<typeof useServices>["courseEnrollments"]>>[number]; onSaved: () => void }) {
  const services = useServices();
  const [status, setStatus] = useState(row.attendanceStatus);
  const [minutes, setMinutes] = useState(row.attendedMinutes);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card className="space-y-2">
      <p className="font-medium">{row.userName} · {row.userEmail}</p>
      <p className="text-sm">完課狀態：{labels.completion[row.completion].label}</p>
      <div className="flex flex-wrap gap-2">
        <SelectInput value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="出席狀態">{Object.entries(labels.attendance).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</SelectInput>
        <TextInput type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="分鐘數" />
        <Button onClick={async () => { try { await services.attendance(row.id, { expectedVersion: row.version, attendanceStatus: status, attendedMinutes: minutes }); setMessage("已登錄出席"); onSaved(); } catch (error) { setMessage(error instanceof ClientError ? error.message : "登錄失敗"); } }}>儲存出席</Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </Card>
  );
}

export function UsersPage() {
  const services = useServices();
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => services.users() });
  const [form, setForm] = useState({ email: "", displayName: "", password: "", role: "CASE_OFFICER" as const });
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">會員與帳號</h1>
      <Card className="grid gap-2 md:grid-cols-2">
        <Field label="Email"><TextInput value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="名稱"><TextInput value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
        <Field label="密碼"><TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <Field label="角色"><SelectInput value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "CASE_OFFICER" })}><option value="CASE_OFFICER">承辦人</option><option value="ADMIN">管理員</option></SelectInput></Field>
        <Button onClick={async () => { await services.createUser(form); setMessage("已建立內部帳號"); await client.invalidateQueries({ queryKey: ["users"] }); }}>新增內部帳號</Button>
      </Card>
      {message ? <p className="text-sm">{message}</p> : null}
      {users.data?.map((user) => (
        <Card key={user.id} className="flex flex-wrap items-center justify-between gap-2">
          <div><p>{user.displayName}</p><p className="text-sm text-stone-500">{user.email} · {user.organizationName ?? "無組織"} · {userRoleLabels[user.role as UserRole]?.label ?? user.role}</p></div>
          {user.role !== "APPLICANT" ? <Button variant="secondary" onClick={async () => { await services.updateUser(user.id, { isActive: !user.isActive }); await client.invalidateQueries({ queryKey: ["users"] }); }}>{user.isActive ? "停用" : "啟用"}</Button> : <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "啟用" : "停用"}</Badge>}
        </Card>
      ))}
    </div>
  );
}

export function OrganizationsPage() {
  const services = useServices();
  const [q, setQ] = useState("");
  const rows = useQuery({ queryKey: ["organizations", q], queryFn: () => services.organizations(q) });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">業者資料</h1>
      <TextInput placeholder="搜尋名稱或統編" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋業者" />
      {rows.data?.map((org) => <Card key={org.id}><p className="font-medium">{org.organizationName}</p><p className="text-sm">統編 {org.taxId} · {org.contactName} · {org.contactPhone}</p></Card>)}
    </div>
  );
}

export function ImportsPage() {
  const services = useServices();
  const [type, setType] = useState<"ORGANIZATIONS" | "APPLICATION_DRAFTS">("ORGANIZATIONS");
  const [csv, setCsv] = useState("organizationName,taxId,contactName,contactPhone,contactEmail,address");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof services.importPreview>> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">資料匯入</h1>
      <p className="text-sm text-stone-600">先預覽。有錯誤不會寫入；確認後整批成功或整批不匯入。不能用 CSV 直接建立已核定案件。</p>
      <SelectInput value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ORGANIZATIONS">業者資料</option><option value="APPLICATION_DRAFTS">驗證草稿</option></SelectInput>
      <Button variant="secondary" onClick={async () => downloadText(`${type}.csv`, await services.importTemplate(type))}>下載範本</Button>
      <TextArea value={csv} onChange={(event) => setCsv(event.target.value)} aria-label="CSV 內容" />
      <Button onClick={async () => setPreview(await services.importPreview(type, csv))}>預覽</Button>
      {preview ? <Card>{preview.rows.map((row) => <p key={row.rowNumber} className="text-sm">第 {row.rowNumber} 列 {row.ok ? "可匯入" : row.messages.join("、")}</p>)}<Button className="mt-2" disabled={preview.errorCount > 0} onClick={async () => { const result = await services.importCommit(preview.id, crypto.randomUUID()); setMessage(`已匯入 ${result.committed ?? 0} 筆`); }}>確認匯入</Button></Card> : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function AuditPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["audit"], queryFn: () => services.audit() });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">操作紀錄</h1>
      {rows.data?.map((row) => <Card key={row.id}><p className="text-sm">{formatTaipei(row.createdAt)} · {row.actorName ?? "系統"} · {row.action} · {row.entityType}</p></Card>)}
      {(rows.data?.length ?? 0) === 0 ? <Empty title="尚無紀錄" body="登入、送件、派案與出席更正會記在這裡。" /> : null}
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
