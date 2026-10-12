import { EditorialKind, loginRequestSchema, registerRequestSchema, courseStatusLabels } from "@mf/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { CourseCalendar } from "../../components/CourseCalendar";
import { Badge, Button, Card, ContentImage, ErrorText, Field, PageHeader, PageMedia, TextInput } from "../../components/ui";
import { formatTaipei, labels } from "../../lib/format";
import { ClientError, type SiteSlot } from "../../services/types";
import { useEffect, useState, type ReactNode } from "react";

const PREVIEW_LIMIT = 5;

export function HomePage() {
  const services = useServices();
  const content = useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const gallery = (content.data?.entries ?? []).filter((item) => item.kind === EditorialKind.HOME_GALLERY && item.imageUrl).sort((a, b) => a.sortOrder - b.sortOrder);
  const points = (content.data?.entries ?? []).filter((item) => item.kind === EditorialKind.HOME_POINT).sort((a, b) => a.sortOrder - b.sortOrder);
  const news = (content.data?.entries ?? []).filter((item) => item.kind === EditorialKind.NEWS).sort((a, b) => (b.publishedOn ?? "").localeCompare(a.publishedOn ?? "") || a.sortOrder - b.sortOrder);
  const courseItems = courses.data ?? [];
  return (
    <div className="space-y-12">
      {content.isLoading ? <p>載入中…</p> : null}
      {content.error ? <ErrorText message="無法載入首頁內容" /> : null}
      <HomeGallery slides={gallery} />
      {content.data?.hero ? <Hero slot={content.data.hero} /> : null}
      {content.data?.hero?.youtubeUrl ? <PageMedia youtubeUrl={content.data.hero.youtubeUrl} /> : null}
      {content.data?.banner ? <Banner slot={content.data.banner} /> : null}
      {content.data?.banner?.youtubeUrl ? <PageMedia youtubeUrl={content.data.banner.youtubeUrl} /> : null}
      <div className="grid gap-8 border-t border-[var(--line)] pt-10 md:grid-cols-3">
        {points.map((point, index) => (
          <section key={point.id}>
            <p className="text-sm text-[var(--muted)]">0{index + 1}</p>
            <h2 className="mt-2 text-2xl">{point.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{point.body}</p>
          </section>
        ))}
      </div>
      <div className="grid gap-10 md:grid-cols-2">
        <PreviewList title="最新消息" count={news.length} empty="目前沒有消息。" more={news.length > PREVIEW_LIMIT ? "/news" : null}>
          {news.slice(0, PREVIEW_LIMIT).map((item) => (
            <Link key={item.id} to={`/news/${item.slug}`} className="block border-t border-[var(--line)] py-4">
              <p className="text-sm text-[var(--muted)]">{item.publishedOn}</p>
              <h3 className="mt-1 text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
            </Link>
          ))}
        </PreviewList>
        <PreviewList title="教育訓練" count={courseItems.length} empty="目前沒有課程。" more={courseItems.length > PREVIEW_LIMIT ? "/courses" : null}>
          {courseItems.slice(0, PREVIEW_LIMIT).map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="block border-t border-[var(--line)] py-4">
              <p className="text-sm text-[var(--muted)]">{formatTaipei(course.startsAt)} · {course.location}</p>
              <h3 className="mt-1 text-xl">{course.title}</h3>
            </Link>
          ))}
        </PreviewList>
      </div>
    </div>
  );
}

function PreviewList({ title, count, empty, more, children }: { title: string; count: number; empty: string; more: string | null; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-3xl">{title}</h2>
      {count === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">{empty}</p> : <div className="mt-4">{children}</div>}
      {more ? <Link to={more} className="btn mt-4 inline-block rounded-md px-4 py-2 text-sm no-underline">更多</Link> : null}
    </section>
  );
}

function HomeGallery({ slides }: { slides: Array<{ id: string; title: string; imageUrl: string | null }> }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 5000);
    return () => window.clearInterval(timer);
  }, [count]);
  if (!count) return null;
  const current = slides[index % count];
  if (!current?.imageUrl) return null;
  return (
    <section aria-label="首頁圖庫" className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <img src={current.imageUrl} alt={current.title} className="h-72 w-full object-cover md:h-96" />
      {count > 1 ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button type="button" className="btn rounded-md px-3 py-2 text-sm" onClick={() => setIndex((item) => (item - 1 + count) % count)}>上一張</button>
          <div className="flex gap-2">
            {slides.map((slide, slideIndex) => (
              <button key={slide.id} type="button" aria-label={`第 ${slideIndex + 1} 張`} aria-pressed={slideIndex === index % count} className={`h-2.5 w-2.5 rounded-full ${slideIndex === index % count ? "bg-[var(--accent-deep)]" : "bg-[var(--surface)]"}`} onClick={() => setIndex(slideIndex)} />
            ))}
          </div>
          <button type="button" className="btn rounded-md px-3 py-2 text-sm" onClick={() => setIndex((item) => (item + 1) % count)}>下一張</button>
        </div>
      ) : null}
    </section>
  );
}

function Hero({ slot }: { slot: SiteSlot }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[#6aafe6] text-[var(--ink)]">
      <div className="grid md:grid-cols-[1.4fr_0.9fr]">
        <div className="px-6 py-12 md:px-12 md:py-16">
          <p className="text-sm tracking-wide">{slot.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight text-[var(--ink)] md:text-5xl">{slot.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink)]">{slot.subtitle}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink)]">{slot.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SiteLink href={slot.ctaHref} label={slot.ctaLabel} primary />
            <SiteLink href={slot.secondaryCtaHref} label={slot.secondaryCtaLabel} />
          </div>
        </div>
        <ContentImage src={slot.imageUrl} className="h-full min-h-64 w-full object-cover" fallback={<div className="hidden min-h-64 border-l border-[#8ec0e4] bg-[#cadbe9] md:block" />} />
      </div>
    </section>
  );
}

function Banner({ slot }: { slot: SiteSlot }) {
  return (
    <section className="grid items-center gap-8 border-y border-[var(--line)] py-10 md:grid-cols-[280px_1fr]">
      <ContentImage src={slot.imageUrl} className="h-48 w-full rounded-md object-cover" fallback={<div className="h-48 rounded-md bg-[#cadbe9]" />} />
      <div>
        <p className="text-sm text-[var(--muted)]">{slot.eyebrow}</p>
        <h2 className="mt-2 text-3xl">{slot.title}</h2>
        <p className="mt-4 leading-8">{slot.subtitle}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{slot.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SiteLink href={slot.ctaHref} label={slot.ctaLabel} primary />
          <SiteLink href={slot.secondaryCtaHref} label={slot.secondaryCtaLabel} />
        </div>
      </div>
    </section>
  );
}

function SiteLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  if (!label || !href.startsWith("/")) return null;
  const className = primary
    ? "btn btn-primary rounded-md px-4 py-2 text-sm no-underline"
    : "btn rounded-md px-4 py-2 text-sm no-underline";
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
  const [view, setView] = useState<"list" | "calendar">("list");
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const filtered = (courses.data ?? []).filter((course) => course.title.includes(q) || course.location.includes(q) || course.description.includes(q));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="教育訓練" title="課程" lede="每一梯次有介紹、圖片與影片。可切換列表或月曆。" />
        <div className="flex gap-2">
          <button type="button" className={`btn rounded-md px-3 py-2 text-sm ${view === "list" ? "is-selected" : ""}`} aria-pressed={view === "list"} onClick={() => setView("list")}>列表</button>
          <button type="button" className={`btn rounded-md px-3 py-2 text-sm ${view === "calendar" ? "is-selected" : ""}`} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>月曆</button>
        </div>
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
