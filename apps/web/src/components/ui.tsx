import { clsx } from "clsx";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
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

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-sm leading-6 text-[var(--muted)]">{hint}</span> : null}
      {error ? <span className="block text-sm text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

const control = "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-28", className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={cx("inline-flex rounded px-2 py-0.5 text-xs font-medium", toneClass(tone))}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5", className)}>{children}</section>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
      <p className="font-medium text-[var(--ink)]">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1916]/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl">{title}</h2>
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
