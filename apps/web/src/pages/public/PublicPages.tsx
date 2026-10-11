import { loginRequestSchema, registerRequestSchema, courseStatusLabels } from "@mf/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { Badge, Button, Card, ErrorText, Field, PageHeader, TextInput } from "../../components/ui";
import { homeContent } from "../../content/site-content";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError, type SiteSlot } from "../../services/types";
import { useState } from "react";

export function HomePage() {
  const services = useServices();
  const content = useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
  return (
    <div className="space-y-12">
      {content.isLoading ? <p>載入中…</p> : null}
      {content.error ? <ErrorText message="無法載入首頁內容" /> : null}
      {content.data?.hero ? <Hero slot={content.data.hero} /> : null}
      {content.data?.banner ? <Banner slot={content.data.banner} /> : null}
      <div className="grid gap-8 border-t border-[var(--line)] pt-10 md:grid-cols-3">
        {homeContent.points.map((point, index) => (
          <section key={point.title}>
            <p className="text-sm text-[var(--muted)]">0{index + 1}</p>
            <h2 className="mt-2 text-2xl">{point.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{point.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function Hero({ slot }: { slot: SiteSlot }) {
  return (
    <section className="overflow-hidden rounded-lg bg-[#1c332c] text-[#f7f4ee]">
      <div className="grid md:grid-cols-[1.4fr_0.9fr]">
        <div className="px-6 py-12 md:px-12 md:py-16">
          <p className="text-sm tracking-wide">{slot.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight text-[#f7f4ee] md:text-5xl">{slot.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#f7f4ee]">{slot.subtitle}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e4ddd2]">{slot.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SiteLink href={slot.ctaHref} label={slot.ctaLabel} primary />
            <SiteLink href={slot.secondaryCtaHref} label={slot.secondaryCtaLabel} />
          </div>
        </div>
        {slot.imageUrl ? <img src={slot.imageUrl} alt="" className="h-full min-h-64 w-full object-cover" /> : <div className="hidden min-h-64 border-l border-[#34584c] md:block" />}
      </div>
    </section>
  );
}

function Banner({ slot }: { slot: SiteSlot }) {
  return (
    <section className="grid items-center gap-8 border-y border-[var(--line)] py-10 md:grid-cols-[280px_1fr]">
      {slot.imageUrl ? <img src={slot.imageUrl} alt="" className="h-48 w-full rounded-md object-cover" /> : <div className="h-48 rounded-md bg-[#e7e1d6]" />}
      <div>
        <p className="text-sm text-[var(--muted)]">{slot.eyebrow}</p>
        <h2 className="mt-2 text-3xl">{slot.title}</h2>
        <p className="mt-4 leading-8">{slot.subtitle}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{slot.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SiteLink href={slot.ctaHref} label={slot.ctaLabel} primary dark />
          <SiteLink href={slot.secondaryCtaHref} label={slot.secondaryCtaLabel} dark />
        </div>
      </div>
    </section>
  );
}

function SiteLink({ href, label, primary, dark }: { href: string; label: string; primary?: boolean; dark?: boolean }) {
  if (!label || !href.startsWith("/")) return null;
  const className = primary
    ? dark
      ? "rounded-md bg-[#1c332c] px-4 py-2 text-sm text-[#f7f4ee] no-underline"
      : "rounded-md bg-[#f7f4ee] px-4 py-2 text-sm text-[#1c332c] no-underline"
    : dark
      ? "rounded-md border border-[var(--ink)] px-4 py-2 text-sm text-[var(--ink)] no-underline"
      : "rounded-md border border-[#f7f4ee] px-4 py-2 text-sm text-[#f7f4ee] no-underline";
  return <Link to={href} className={className}>{label}</Link>;
}

export function GuidePage() {
  const services = useServices();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="驗證介紹" title="申請類別" lede="目前已知共 7 類。除第 1 類與廚房、餐廳相關外，其餘正式名稱、附件與審查細則尚未提供。" />
      {categories.isLoading ? <p>載入中…</p> : null}
      {categories.error ? <ErrorText message="無法載入類別" /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {categories.data?.map((category) => (
          <Card key={category.id}>
            <div className="flex items-center justify-between gap-2"><h2 className="font-medium">{category.name}</h2><Badge tone={labels.application.DRAFT.tone}>{category.latestVersion.configurationStatus === "DEMO" ? "示範設定" : "已確認"}</Badge></div>
            <p className="mt-2 text-sm text-[var(--muted)]">{category.description}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{category.latestVersion.definition.helpText}</p>
          </Card>
        ))}
      </div>
      <Link to="/login" className="inline-block text-sm text-[var(--link)]">登入後建立申請</Link>
    </div>
  );
}

export function CoursesPage() {
  const services = useServices();
  const [q, setQ] = useState("");
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const filtered = (courses.data ?? []).filter((course) => course.title.includes(q) || course.location.includes(q));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="教育訓練" title="課程列表" lede="可先看梯次與名額。月曆、題庫、及格分數與正式教材待甲方提供後替換。" />
      <TextInput placeholder="搜尋課程或地點" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋課程" />
      {courses.isLoading ? <p>載入中…</p> : null}
      {filtered.length === 0 && !courses.isLoading ? <p className="text-sm text-[var(--muted)]">沒有符合的課程。</p> : null}
      <div className="grid gap-3">
        {filtered.map((course) => (
          <Card key={course.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/courses/${course.id}`} className="font-medium text-[var(--link)]">{course.title}</Link>
              <Badge tone={courseStatusLabels[course.status].tone}>{courseStatusLabels[course.status].label}</Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{formatTaipei(course.startsAt)} · {course.location} · 剩餘 {course.remainingSeats} / {course.capacity}</p>
          </Card>
        ))}
      </div>
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
      <PageHeader eyebrow="教育訓練" title={item.title} />
      {item.isDemo ? <Badge tone="warning">示範課程</Badge> : null}
      <p className="text-sm leading-6 text-[var(--muted)]">{item.description}</p>
      <Card>
        <p>時間：{formatTaipei(item.startsAt)} 至 {formatTaipei(item.endsAt)}</p>
        <p>地點：{item.location}</p>
        <p>課程 {item.durationMinutes} 分鐘，完課門檻 {item.requiredAttendanceMinutes} 分鐘（示範規則，不作為申請資格的硬性阻擋）</p>
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
        <Field label="密碼" error={form.formState.errors.password?.message}><TextInput type="password" {...form.register("password")} /></Field>
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
        <Field label="密碼" error={form.formState.errors.password?.message}><TextInput type="password" {...form.register("password")} /></Field>
        <Field label="確認密碼" error={form.formState.errors.confirmPassword?.message}><TextInput type="password" {...form.register("confirmPassword")} /></Field>
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
      <Field label="新密碼"><TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
      <Field label="確認密碼"><TextInput type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
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
