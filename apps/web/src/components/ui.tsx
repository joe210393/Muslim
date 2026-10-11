import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { toneClass } from "../lib/format";
import type { StatusTone } from "@mf/contracts";
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
    primary: "bg-[var(--accent)] text-[#fffcf7] hover:bg-[#142820]",
    secondary: "bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink)]",
    ghost: "bg-transparent text-[var(--ink)] hover:bg-[#ebe6dc]",
    danger: "bg-[var(--danger)] text-[#fffcf7] hover:bg-[#641f17]",
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

export function PageHeader({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? <p className="text-sm font-medium text-[var(--muted)]">{eyebrow}</p> : null}
      <h1 className="mt-2 text-4xl leading-tight text-[var(--ink)]">{title}</h1>
      {lede ? <p className="mt-4 text-base leading-7 text-[var(--muted)]">{lede}</p> : null}
    </header>
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
