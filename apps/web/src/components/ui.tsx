import { clsx } from "clsx";
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router";
import { toneClass } from "../lib/format";
import { youtubeVideoId, type StatusTone } from "@mf/contracts";
import { contentStatus } from "../content/site-content";

export function cx(...values: Array<string | false | undefined>) {
  return clsx(values);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "secondary" }) {
  const styles = {
    primary: "btn btn-primary",
    secondary: "btn",
    ghost: "btn border-transparent bg-transparent shadow-[0_3px_0_transparent] hover:bg-[var(--panel)]",
    danger: "btn btn-danger",
  }[variant];
  return (
    <button
      className={cx("inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50", styles, className)}
      {...props}
    />
  );
}

/** group：內含按鈕、編輯器或多個控制項時使用；label 會把點擊轉給第一個按鈕。 */
export function Field({ label, error, children, hint, required, group = false, id }: { label: string; error?: string; hint?: string; required?: boolean; group?: boolean; id?: string; children: ReactNode }) {
  const body = (
    <>
      <span className="font-medium text-[var(--ink)]">{required ? <span className="text-[var(--danger)]">* </span> : null}{label}</span>
      {children}
      {hint ? <span className="block text-sm leading-6 text-[var(--muted)]">{hint}</span> : null}
      {error ? <span className="block text-sm text-[var(--danger)]">{error}</span> : null}
    </>
  );
  if (group) return <div id={id} className="block scroll-mt-24 space-y-1.5 text-sm" role="group" aria-label={label}>{body}</div>;
  return <label id={id} className="block scroll-mt-24 space-y-1.5 text-sm">{body}</label>;
}

const control = "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...props} />;
}

function EyeIcon({ crossed }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {crossed ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        className={cx(control, "pr-11", className)}
        {...props}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted)] hover:text-[var(--ink)]"
        aria-label={visible ? "隱藏密碼" : "顯示密碼"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  );
});

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-28", className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={cx("inline-flex rounded px-2 py-0.5 text-xs font-medium", toneClass(tone))}>{children}</span>;
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("scroll-mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5", className)}>{children}</section>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
      <p className="font-medium text-[var(--ink)]">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

let openModals = 0;

function useBodyScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    if (openModals === 0) {
      root.style.setProperty("--scrollbar-gap", `${window.innerWidth - root.clientWidth}px`);
      root.classList.add("modal-open");
    }
    openModals += 1;
    return () => {
      openModals -= 1;
      if (openModals === 0) root.classList.remove("modal-open");
    };
  }, []);
}

export function scrollToPageTop() {
  window.scrollTo({ top: 0 });
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-[#1a1916]/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className={cx("max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5", wide ? "max-w-5xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-sm text-[var(--ink)] underline" onClick={onClose} type="button">關閉</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ message }: { message: string }) {
  return <p className="rounded-md border border-[#e4c4bc] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{message}</p>;
}

export function SuccessText({ message }: { message: string }) {
  return <p className="rounded-md border border-[#b9d6c2] bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]" role="status">{message}</p>;
}

export type Notice = string | { tone: "error"; text: string } | null;

export function failNotice(text: string): Notice {
  return { tone: "error", text };
}

export function NoticeText({ notice }: { notice: Notice | undefined }) {
  if (!notice) return null;
  return typeof notice === "string" ? <SuccessText message={notice} /> : <ErrorText message={notice.text} />;
}

export function confirmDelete(subject: string) {
  return window.confirm(`確定刪除「${subject}」？刪除後無法復原。`);
}

export function SectionNav({ items, value, onChange }: { items: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={value === item.id} className={cx("btn rounded-md px-3 py-2 text-sm", value === item.id && "is-selected")} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? <p className="text-sm font-medium text-[var(--muted)]">{eyebrow}</p> : null}
      <h1 className="mt-2 text-4xl leading-tight text-[var(--ink)]">{title}</h1>
      {lede ? <p className="mt-4 text-base leading-7 text-[var(--muted)]">{lede}</p> : null}
    </header>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, hint, actions }: { title: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-medium text-[var(--ink)]">{title}</h2>
        {hint ? <p className="text-sm text-[var(--muted)]">{hint}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function WorkTile({ label, hint, to, count }: { label: string; hint: string; to: string; count?: number }) {
  return (
    <Link to={to} className="flex min-h-28 flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] no-underline hover:border-[var(--accent-deep)]">
      <span className="flex items-start justify-between gap-3">
        <span className="text-base font-medium">{label}</span>
        {count && count > 0 ? <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-sm font-semibold text-[var(--warn)]">{count}</span> : null}
      </span>
      <span className="mt-3 text-sm leading-5 text-[var(--muted)]">{hint}</span>
    </Link>
  );
}

export function StatCard({ label, value, hint, to, active, onClick, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; to?: string; active?: boolean; onClick?: () => void; tone?: "warning" | "danger" }) {
  const body = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={cx("mt-1 text-3xl font-semibold", tone === "warning" ? "text-[var(--warn)]" : tone === "danger" ? "text-[var(--danger)]" : "text-[var(--ink)]")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </>
  );
  const className = cx(
    "block rounded-lg border p-4 text-left text-[var(--ink)] no-underline transition",
    active ? "border-[var(--accent-deep)] bg-[#0e6b3a]/12" : "border-[var(--line)] bg-[var(--surface)]",
    (to || onClick) && "hover:border-[var(--accent-deep)]",
  );
  if (to) return <Link to={to} className={className}>{body}</Link>;
  if (onClick) return <button type="button" className={className} onClick={onClick}>{body}</button>;
  return <div className={className}>{body}</div>;
}

export const tableRowClass = "border-t border-[var(--line)]";

export function DataTable({ columns, children }: { columns: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--line)] text-[var(--muted)]">
          <tr>{columns.map((column, index) => <th key={index} className="p-3 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return <p className="text-sm text-[var(--muted)]">共 {total} 筆</p>;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button variant="secondary" disabled={page <= 1} onClick={() => { onChange(page - 1); scrollToPageTop(); }}>上一頁</Button>
      <span>第 {page} / {totalPages} 頁，共 {total} 筆</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => { onChange(page + 1); scrollToPageTop(); }}>下一頁</Button>
    </div>
  );
}

export function ContentImage({ src, className, fallback = null }: { src?: string | null; className: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

export function PageMedia({ imageUrl, youtubeUrl }: { imageUrl?: string | null; youtubeUrl?: string }) {
  const videoId = youtubeVideoId(youtubeUrl ?? "");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;
  if (!showImage && !videoId) return null;
  return (
    <div className={`grid gap-4 ${showImage && videoId ? "md:grid-cols-2" : ""}`}>
      {showImage ? <img src={imageUrl ?? ""} alt="" className="h-64 w-full rounded-md object-cover" onError={() => setImageFailed(true)} /> : null}
      {videoId ? (
        <iframe
          className="aspect-video w-full rounded-md"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube 影片"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : null}
    </div>
  );
}

export function PendingNote() {
  return (
    <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
      <strong className="font-medium">{contentStatus.label}。</strong>
      {contentStatus.note}
    </p>
  );
}
