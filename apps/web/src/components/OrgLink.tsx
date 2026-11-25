import { applicationStatusLabels, contractStatusLabels, formatTwd, paymentStatusLabels, type OrganizationLookup } from "@mf/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { useServices } from "../app/session";
import { formatTaipei } from "../lib/format";
import { ClientError } from "../services/types";
import { Badge, ErrorText, Modal, cx } from "./ui";

/** 後台任何出現業者名稱的地方：點下去看帳號、統編與聯絡資料。沒有可查的編號時只顯示文字。 */
export function OrgLink({ name, className, ...lookup }: OrganizationLookup & { name: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const key = lookup.organizationId ? { organizationId: lookup.organizationId } : lookup.userId ? { userId: lookup.userId } : lookup.applicationId ? { applicationId: lookup.applicationId } : null;
  if (!key) return <span className={className}>{name}</span>;
  return (
    <>
      <button
        type="button"
        className={cx("text-left text-[var(--link)] underline decoration-dotted underline-offset-2 hover:decoration-solid", className)}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {name}
      </button>
      {open
        ? createPortal(
            <div onClick={(event) => event.stopPropagation()}>
              <OrgProfileModal lookup={key} onClose={() => setOpen(false)} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function OrgProfileModal({ lookup, onClose }: { lookup: OrganizationLookup; onClose: () => void }) {
  const services = useServices();
  const profile = useQuery({ queryKey: ["organization-profile", lookup], queryFn: () => services.organizationProfile(lookup), retry: false });
  const data = profile.data;
  return (
    <Modal title={data?.organization.organizationName ?? "業者資料"} onClose={onClose} wide>
      {profile.isLoading ? <p className="text-sm text-[var(--muted)]">載入中…</p> : null}
      {profile.error ? <ErrorText message={profile.error instanceof ClientError ? profile.error.message : "無法載入業者資料"} /> : null}
      {data ? (
        <div className="space-y-5 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Item label="統一編號" value={data.organization.taxId} />
            <Item label="聯絡人" value={data.organization.contactName} />
            <Item label="電話" value={data.organization.contactPhone} />
            <Item label="聯絡 Email" value={data.organization.contactEmail} />
            <Item label="地址" value={data.organization.address} wide />
            <Item label="建立時間" value={formatTaipei(data.organization.createdAt)} />
            <Item label="資料更新" value={formatTaipei(data.organization.updatedAt)} />
          </dl>
          <Block title={`帳號（${data.accounts.length}）`} empty="這家業者還沒有業者帳號。">
            {data.accounts.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{user.email}</span>
                  <span className="ml-2 text-[var(--muted)]">{user.displayName}</span>
                </span>
                <span className="flex items-center gap-2 text-[var(--muted)]">
                  <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "啟用" : "停用"}</Badge>
                  {formatTaipei(user.createdAt)} 建立
                </span>
              </li>
            ))}
          </Block>
          <Block title={`申請案件（${data.applications.length}）`} empty={data.applicationsLimited ? "沒有你可以看的案件。" : "還沒有申請案件。"} note={data.applicationsLimited ? "只列出你可以看的案件。" : undefined}>
            {data.applications.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link className="font-medium text-[var(--link)] underline" to={`/admin/applications/${app.id}`} onClick={onClose}>{app.applicationNo}</Link>
                <span className="text-[var(--muted)]">{app.categoryName}</span>
                <Badge tone={applicationStatusLabels[app.status].tone}>{applicationStatusLabels[app.status].label}</Badge>
              </li>
            ))}
          </Block>
          <Block title={`方案與付款（${data.payments.length}）`} empty="還沒有選過方案。">
            {data.payments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{row.planName}</span>
                <span className="text-[var(--muted)]">{row.amount === 0 ? "免費" : formatTwd(row.amount)} · {formatTaipei(row.createdAt)}</span>
                <Badge tone={paymentStatusLabels[row.status].tone}>{paymentStatusLabels[row.status].label}</Badge>
              </li>
            ))}
          </Block>
          <Block title={`合約（${data.contracts.length}）`} empty="還沒有合約。">
            {data.contracts.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link className="font-medium text-[var(--link)] underline" to={`/admin/contracts/issued/${row.id}`} onClick={onClose}>{row.contractNo}</Link>
                <span className="text-[var(--muted)]">{row.title}</span>
                <Badge tone={contractStatusLabels[row.status].tone}>{contractStatusLabels[row.status].label}</Badge>
              </li>
            ))}
          </Block>
        </div>
      ) : null}
    </Modal>
  );
}

function Item({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </div>
  );
}

function Block({ title, empty, note, children }: { title: string; empty: string; note?: string; children: ReactNode[] }) {
  return (
    <section>
      <h3 className="border-b border-[var(--line)] pb-1 font-medium">{title}</h3>
      {note ? <p className="mt-1 text-xs text-[var(--muted)]">{note}</p> : null}
      {children.length === 0 ? <p className="py-2 text-[var(--muted)]">{empty}</p> : <ul className="divide-y divide-[var(--line)]">{children}</ul>}
    </section>
  );
}
