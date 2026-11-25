import { loginRequestSchema, registerRequestSchema, courseStatusLabels } from "@mf/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { CourseCalendar } from "../../components/CourseCalendar";
import { Badge, Button, Card, ErrorText, Field, PageHeader, PageMedia, PasswordInput, TextInput } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { ClientError } from "../../services/types";
import { useState } from "react";

/** 前台「教育訓練」頁的課程清單小區塊。 */
export function CourseCatalog() {
  const services = useServices();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const filtered = (courses.data ?? []).filter((course) => course.title.includes(q) || course.location.includes(q) || course.description.includes(q));
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button type="button" className={`btn rounded-md px-3 py-2 text-sm ${view === "list" ? "is-selected" : ""}`} aria-pressed={view === "list"} onClick={() => setView("list")}>列表</button>
        <button type="button" className={`btn rounded-md px-3 py-2 text-sm ${view === "calendar" ? "is-selected" : ""}`} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>月曆</button>
      </div>
      <TextInput placeholder="搜尋課程、介紹或地點" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋課程" />
      {courses.isLoading ? <p>載入中…</p> : null}
      {filtered.length === 0 && !courses.isLoading ? <p className="text-sm text-[var(--muted)]">沒有符合的課程。</p> : null}
      {view === "calendar" ? <CourseCalendar courses={filtered} /> : (
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((course) => (
            <article key={course.id} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <Link to={`/courses/${course.id}`} className="block text-[var(--ink)] no-underline">
                {course.imageUrl ? <img src={course.imageUrl} alt="" className="h-48 w-full object-cover" /> : <div className="h-24 bg-[var(--panel)]" />}
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-2xl">{course.title}</h2>
                    <Badge tone={courseStatusLabels[course.status].tone}>{courseStatusLabels[course.status].label}</Badge>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">{course.description}</p>
                  <p className="text-sm text-[var(--muted)]">{formatTaipei(course.startsAt)} · {course.delivery === "ONLINE" ? "線上課程" : course.location}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function CourseDetailPage() {
  const { courseId = "" } = useParams();
  const services = useServices();
  const session = useSession();
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => services.course(courseId) });
  const [message, setMessage] = useState<string | null>(null);
  if (course.isLoading) return <p>載入中…</p>;
  if (course.isError || !course.data) return <ErrorText message="找不到課程" />;
  const item = course.data;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練" title={item.title} lede={item.description} />
      <PageMedia imageUrl={item.imageUrl} youtubeUrl={item.youtubeUrl} />
      {item.isDemo ? <Badge tone="warning">示範課程</Badge> : null}
      <Card>
        <p>時間：{formatTaipei(item.startsAt)} 至 {formatTaipei(item.endsAt)}</p>
        <p>{item.delivery === "ONLINE" ? "線上課程。報名後在教育訓練觀看影片，看完時間的三分之二才算通過。" : `地點：${item.location}`}</p>
        <p>課程 {item.durationMinutes} 分鐘{item.delivery === "OFFLINE" ? `，完課門檻 ${item.requiredAttendanceMinutes} 分鐘（示範規則，不作為申請資格的硬性阻擋）` : ""}</p>
        <p>名額 {item.capacity}，剩餘 {item.remainingSeats}。額滿時不提供候補。</p>
        <p>報名期間：{formatTaipei(item.registrationOpensAt)} 至 {formatTaipei(item.registrationClosesAt)}</p>
      </Card>
      {message ? <ErrorText message={message} /> : null}
      {session.user?.role === "APPLICANT" ? (
        <Button onClick={async () => {
          try {
            await services.enroll(item.id);
            setMessage(null);
            await course.refetch();
            alertCompleted("已完成報名，可在課程報名頁查看。");
          } catch (error) {
            setMessage(error instanceof ClientError ? error.message : "報名失敗");
          }
        }}>報名此梯次</Button>
      ) : <Link to="/login" className="text-sm text-[var(--link)]">登入後報名</Link>}
    </div>
  );
}

function alertCompleted(message: string) {
  const node = document.getElementById("flash");
  if (node) node.textContent = message;
}

export function LoginPage() {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(loginRequestSchema) });
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">登入</h1>
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          const user = await services.login(values.email, values.password);
          await session.setUser(user);
          navigate(user.role === "APPLICANT" ? "/portal" : "/admin");
        } catch (reason) {
          setError(reason instanceof ClientError ? reason.message : "登入失敗");
        }
      })}>
        <Field label="Email" error={form.formState.errors.email?.message}><TextInput type="email" {...form.register("email")} /></Field>
        <Field label="密碼" error={form.formState.errors.password?.message}><PasswordInput {...form.register("password")} /></Field>
        {error ? <ErrorText message={error} /> : null}
        <Button type="submit">登入</Button>
      </form>
      <div className="flex justify-between text-sm"><Link to="/forgot-password">忘記密碼</Link><Link to="/register">註冊業者帳號</Link></div>
      {services.mode === "mock" ? <p className="text-xs text-[var(--muted)]">展示帳號 applicant01@example.test、officer.lin@example.test、admin@example.test，密碼為本地示範用 Demo1234!。正式環境不會顯示這段。</p> : null}
    </Card>
  );
}

export function RegisterPage() {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(registerRequestSchema) });
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h1 className="text-xl font-semibold">註冊業者</h1>
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          const user = await services.register(values);
          await session.setUser(user);
          navigate("/portal");
        } catch (reason) {
          setError(reason instanceof ClientError ? reason.message : "註冊失敗");
        }
      })}>
        <Field label="聯絡人" error={form.formState.errors.displayName?.message}><TextInput {...form.register("displayName")} /></Field>
        <Field label="Email" error={form.formState.errors.email?.message}><TextInput type="email" {...form.register("email")} /></Field>
        <Field label="密碼" error={form.formState.errors.password?.message}><PasswordInput {...form.register("password")} /></Field>
        <Field label="確認密碼" error={form.formState.errors.confirmPassword?.message}><PasswordInput {...form.register("confirmPassword")} /></Field>
        <Field label="業者名稱" error={form.formState.errors.organizationName?.message}><TextInput {...form.register("organizationName")} /></Field>
        <Field label="統一編號" hint="暫定 8 位數字，海外規則待確認" error={form.formState.errors.taxId?.message}><TextInput {...form.register("taxId")} /></Field>
        {error ? <ErrorText message={error} /> : null}
        <Button type="submit">建立帳號</Button>
      </form>
    </Card>
  );
}

export function ForgotPage() {
  const services = useServices();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">忘記密碼</h1>
      <Field label="Email"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Button onClick={async () => {
        const result = await services.forgot(email);
        setMessage(result.message);
        setDemoUrl(result.demoResetUrl ?? null);
      }}>送出</Button>
      {message ? <p className="text-sm">{message}</p> : null}
      {demoUrl ? <Link className="block text-sm text-[var(--link)]" to={demoUrl}>展示模式重設連結（正式環境不會出現）</Link> : null}
    </Card>
  );
}

export function ResetPage() {
  const services = useServices();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">重設密碼</h1>
      <Field label="新密碼"><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
      <Field label="確認密碼"><PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
      <Button onClick={async () => {
        try {
          const result = await services.reset(params.get("token") ?? "", password, confirmPassword);
          setMessage(result.message);
        } catch (error) {
          setMessage(error instanceof ClientError ? error.message : "重設失敗");
        }
      }}>更新密碼</Button>
      {message ? <p className="text-sm">{message}</p> : null}
      <Link to="/login" className="text-sm text-[var(--link)]">返回登入</Link>
    </Card>
  );
}
