import type { ReactNode } from "react";

export type CaseJump = { id: string; label: string };

export function CaseLayout({ main, panel, jumps }: { main: ReactNode; panel: ReactNode; jumps: CaseJump[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-4">{main}</div>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pb-4" aria-label="案件操作">
        {jumps.length > 0 ? (
          <nav className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm" aria-label="段落">
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">段落</p>
            <ul className="space-y-1">
              {jumps.map((jump) => (
                <li key={jump.id}>
                  <button
                    className="block w-full rounded px-2 py-1.5 text-left text-[var(--ink)] hover:bg-[var(--panel)]"
                    type="button"
                    onClick={() => document.getElementById(jump.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {jump.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {panel}
      </aside>
    </div>
  );
}

export function CaseFacts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="shrink-0 text-[var(--muted)]">{label}</dt>
          <dd className="min-w-0 text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
