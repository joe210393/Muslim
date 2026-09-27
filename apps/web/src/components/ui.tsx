import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { toneClass } from "../lib/format";
import type { StatusTone } from "@mf/contracts";

export function cx(...values: Array<string | false | undefined>) {
  return clsx(values);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "secondary" }) {
  const styles = {
    primary: "bg-[#0e5c4a] text-white hover:bg-[#0b493b]",
    secondary: "bg-white text-[#0e5c4a] border border-[#0e5c4a]",
    ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
    danger: "bg-rose-700 text-white hover:bg-rose-800",
  }[variant];
  return (
    <button
      className={cx("inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50", styles, className)}
      {...props}
    />
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-stone-500">{hint}</span> : null}
      {error ? <span className="block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

const control = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e5c4a]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={control} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-28")} {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={control} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", toneClass(tone))}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl border border-stone-200 bg-white p-4 shadow-sm", className)}>{children}</section>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
      <p className="font-medium text-stone-800">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-sm text-stone-500" onClick={onClose} type="button">關閉</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ message }: { message: string }) {
  return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{message}</p>;
}
