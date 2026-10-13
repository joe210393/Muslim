import { AUDIT_CATEGORIES, applicationStatusLabels, auditActionLabel, auditCategoryDetail, auditCategoryOf, auditEntityLabel, courseDeliveryLabels, courseStatusLabels, formatTwd, type CourseStatus } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { ApplicationReview } from "./ApplicationReview";
import { Badge, Button, Card, Empty, ErrorText, Field, SectionNav, SelectInput, TextArea, TextInput } from "../../components/ui";
import { PermissionsPage } from "./InfoAdminPages";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError } from "../../services/types";

export function AdminHome() {
  const services = useServices();
  const session = useSession();
  const canPay = session.user?.featureKeys.includes("payments.manage") ?? false;
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => services.summary() });
  const payments = useQuery({ queryKey: ["payment-desk"], queryFn: () => services.paymentDesk(), enabled: canPay });
  if (summary.isLoading) return <p>載入中…</p>;
  if (!summary.data) return <ErrorText message="無法載入工作總覽" />;
  const data = summary.data;
  const cards: Array<{ label: string; count: number; href: string }> = [
    { label: "待派案", count: data.submitted, href: "/admin/applications" },
    { label: "初審", count: data.initialReview, href: "/admin/applications?status=INITIAL_REVIEW" },
    { label: "複審", count: data.secondReview, href: "/admin/site-reviews" },
    { label: "待核定", count: data.finalReview, href: "/admin/applications?status=FINAL_REVIEW" },
    { label: "待補件", count: data.needSupplement, href: "/admin/applications?status=NEED_SUPPLEMENT" },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">工作總覽</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{cards.map((card) => <Card key={card.label}><Link className="text-sm text-[var(--muted)]" to={card.href}>{card.label}</Link><p className="text-2xl font-semibold">{card.count}</p></Card>)}</div>
      {payments.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card><Link className="text-sm text-[var(--muted)]" to="/admin/payments">{payments.data.monthLabel}成交</Link><p className="text-2xl font-semibold">{payments.data.dealCount} 筆</p></Card>
          <Card><Link className="text-sm text-[var(--muted)]" to="/admin/payments">{payments.data.monthLabel}付款</Link><p className="text-2xl font-semibold">{formatTwd(payments.data.paidAmount)}</p></Card>
        </div>
      ) : null}
      <Card><h2 className="font-medium">近期課程</h2>{data.upcoming.map((course) => <p key={course.id} className="text-sm">{course.title} · {formatTaipei(course.startsAt)}</p>)}</Card>
    </div>
  );
}

const caseReviewStatuses = [
  ["SUBMITTED", "已送件"],
  ["INITIAL_REVIEW", "初審中"],
  ["NEED_SUPPLEMENT", "待補件"],
  ["FINAL_REVIEW", "待核定"],
  ["APPROVED", "已核定"],
  ["REJECTED", "已退件"],
] as const;

export function AdminApplicationList() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const requested = params.get("status");
  const status = caseReviewStatuses.some(([id]) => id === requested) ? requested as (typeof caseReviewStatuses)[number][0] : "SUBMITTED";
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["admin-applications", q, status], queryFn: () => services.applications({ q, status, page: 1 }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">案件審查</h1>
        <Button variant="secondary" onClick={async () => downloadText("applications.csv", await services.exportApplications())}>匯出 CSV</Button>
      </div>
      <SectionNav items={caseReviewStatuses.map(([id, label]) => ({ id, label }))} value={status} onChange={(id) => setParams(id === "SUBMITTED" ? {} : { status: id })} />
      <TextInput placeholder="編號或業者" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋案件" />
      {(query.data?.items.length ?? 0) === 0 ? <Empty title="沒有符合的案件" body="這裡只看已送出的案件。草稿留在業者會員區，複審中的案件在現場複審。" /> : null}
      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="min-w-full text-sm"><thead><tr className="text-left"><th className="p-3">編號</th><th className="p-3">業者</th><th className="p-3">類別</th><th className="p-3">承辦</th><th className="p-3">狀態</th></tr></thead>
          <tbody>{query.data?.items.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><Link className="text-[var(--link)]" to={`/admin/applications/${item.id}`}>{item.applicationNo}</Link></td><td className="p-3">{item.organizationName}</td><td className="p-3">{item.categoryName}</td><td className="p-3">{item.assignedToName ?? "未派案"}</td><td className="p-3"><Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge></td></tr>)}</tbody>
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
  if (!application.data) return application.isLoading ? <p>載入中…</p> : <ErrorText message="找不到案件" />;
  const item = application.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{item.applicationNo}</h1>
        <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
      </div>
      {item.status === "SECOND_REVIEW" ? (
        <Card>
          <p>這件已完成初審，接下來在現場複審處理。</p>
          <Link className="mt-3 inline-block text-[var(--link)]" to={`/admin/site-reviews/${item.id}`}>前往現場複審</Link>
        </Card>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">下面是業者送件的同一份表。要補的項目在該欄後面勾選，並寫給業者看的公開意見。內部註記只有員工看得到。</p>
          <ApplicationReview item={item} onChanged={async () => { await client.invalidateQueries({ queryKey: ["application", applicationId] }); await client.invalidateQueries({ queryKey: ["events", applicationId] }); }} />
        </>
      )}
      {item.status === "APPROVED" ? <Card><CertificationForm applicationId={item.id} /></Card> : null}
      <Card><h2 className="font-medium">歷程</h2>{events.data?.map((event) => <p key={event.id} className="mt-2 text-sm">{formatTaipei(event.createdAt)} {event.actorName} {event.action} {event.publicComment ?? ""} {event.internalNote ? `（內部：${event.internalNote}）` : ""}</p>)}</Card>
    </div>
  );
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
      <div className="flex justify-between"><h1 className="text-2xl font-semibold">教育訓練管理</h1><Link className="btn btn-primary rounded-md px-3 py-2 text-sm no-underline" to="/admin/courses/new">新增課程</Link></div>
      {courses.data?.map((course) => <Card key={course.id}><div className="flex justify-between"><Link className="font-medium text-[var(--link)]" to={`/admin/courses/${course.id}/edit`}>{course.title}</Link><Badge tone={courseStatusLabels[course.status].tone}>{courseStatusLabels[course.status].label}</Badge></div><p className="text-sm">{courseDeliveryLabels[course.delivery].label} · 名額 {course.confirmedCount}/{course.capacity}</p><Link className="text-sm" to={`/admin/courses/${course.id}/enrollments`}>報名名單</Link></Card>)}
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
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{courseId ? "編輯課程" : "新增課程"}</h1>
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
      </div>
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
      {row.delivery === "ONLINE" ? <p className="text-sm">線上課程已看 {row.watchedSeconds} 秒，需 {row.passSeconds} 秒。通過由觀看時間計算。</p> : (
        <div className="flex flex-wrap gap-2">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="出席狀態">{Object.entries(labels.attendance).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</SelectInput>
          <TextInput type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="分鐘數" />
          <Button onClick={async () => { try { await services.attendance(row.id, { expectedVersion: row.version, attendanceStatus: status, attendedMinutes: minutes }); setMessage("已登錄出席"); onSaved(); } catch (error) { setMessage(error instanceof ClientError ? error.message : "登錄失敗"); } }}>儲存出席</Button>
        </div>
      )}
      {message ? <p className="text-sm">{message}</p> : null}
    </Card>
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
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">業者資料</h1>
      <TextInput placeholder="搜尋名稱或統編" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋業者" />
      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">業者</th><th className="p-3 font-medium">統編</th><th className="p-3 font-medium">聯絡人</th><th className="p-3 font-medium">電話</th></tr></thead>
          <tbody>{rows.data?.map((org) => <tr key={org.id} className="border-t border-[var(--line)]"><td className="p-3">{org.organizationName}</td><td className="p-3">{org.taxId}</td><td className="p-3">{org.contactName}</td><td className="p-3">{org.contactPhone}</td></tr>)}</tbody>
        </table>
      </div>
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
      <p className="text-sm text-[var(--muted)]">先預覽。有錯誤不會寫入；確認後整批成功或整批不匯入。不能用 CSV 直接建立已核定案件。</p>
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
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">操作紀錄</h1>
      <p className="text-sm text-[var(--muted)]">只保留最近 30 天。一頁最多 100 筆。</p>
      <SectionNav
        value={category}
        onChange={choose}
        items={[{ id: "ALL", label: "全部" }, ...AUDIT_CATEGORIES.map((item) => ({ id: item.key, label: item.label }))]}
      />
      <p className="text-sm text-[var(--muted)]">{auditCategoryDetail(category)}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">時間</th><th className="p-3 font-medium">人員</th><th className="p-3 font-medium">分類</th><th className="p-3 font-medium">動作</th><th className="p-3 font-medium">對象</th></tr></thead>
          <tbody>{items.map((row) => <tr key={row.id} className="border-t border-[var(--line)]"><td className="p-3">{formatTaipei(row.createdAt)}</td><td className="p-3">{row.actorName ?? "系統"}</td><td className="p-3">{AUDIT_CATEGORIES.find((item) => item.key === auditCategoryOf(row.action))?.label}</td><td className="p-3">{auditActionLabel(row.action)}</td><td className="p-3">{auditEntityLabel(row.entityType)}</td></tr>)}</tbody>
        </table>
      </div>
      {items.length === 0 ? <Empty title="尚無紀錄" body="這個分類在最近 30 天沒有操作。" /> : null}
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
