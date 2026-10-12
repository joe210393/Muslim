import { applicationStatusLabels, contractStatusLabels } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { authorizedResources, renewalRules } from "../../content/site-content";
import { Badge, Button, Card, Empty, PageHeader, PendingNote } from "../../components/ui";
import { ClientError } from "../../services/types";

export function SupplementPage() {
  const services = useServices();
  const query = useQuery({ queryKey: ["applications", "NEED_SUPPLEMENT"], queryFn: () => services.applications({ status: "NEED_SUPPLEMENT", page: 1 }) });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="補件" lede="只列出待補件案件。補完後會回到要求補件時的審查階段。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {(query.data?.items.length ?? 0) === 0 && !query.isLoading ? <Empty title="目前沒有待補件" body="若審查人員要求補件，案件會出現在這裡。" /> : null}
      <div className="space-y-3">
        {query.data?.items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/portal/applications/${item.id}/edit`}>{item.applicationNo}</Link>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.categoryName}</p>
              </div>
              <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RenewalPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["certifications"], queryFn: () => services.certifications() });
  const contracts = useQuery({ queryKey: ["contracts", "mine"], queryFn: () => services.myContracts() });
  const [message, setMessage] = useState("");
  const renewable = contracts.data?.filter((item) => item.status === "SIGNED" || item.status === "RENEWED" || item.status === "NOT_RENEWED") ?? [];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="續約" lede="已簽署的合約可以在這裡登記已續約或未續約。費用、到期提醒與是否重新現場複審仍待確認。" />
      <PendingNote />
      <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">
        {renewalRules.map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
      {renewable.length === 0 && !contracts.isLoading ? <Empty title="還沒有可登記的合約" body="簽署完成的合約會出現在這裡。" /> : null}
      {renewable.map((item) => (
        <Card key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link to={`/portal/contracts/${item.id}`}>{item.contractNo}</Link>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.title}</p>
            </div>
            <Badge tone={contractStatusLabels[item.status].tone}>{contractStatusLabels[item.status].label}</Badge>
          </div>
          {item.status === "SIGNED" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void decide(item.id, item.version, "RENEWED")}>登記已續約</Button>
              <Button variant="secondary" onClick={() => void decide(item.id, item.version, "NOT_RENEWED")}>登記未續約</Button>
            </div>
          ) : null}
        </Card>
      ))}
      {message ? <p className="text-sm">{message}</p> : null}
      {(query.data ?? []).map((item) => (
        <Card key={item.id}>
          <p>{item.certificateNo}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.applicationNo} · {item.issuedOnDate} 至 {item.validUntilDate} · {item.validityLabel}</p>
        </Card>
      ))}
    </div>
  );

  async function decide(id: string, expectedVersion: number, decision: "RENEWED" | "NOT_RENEWED") {
    try {
      await services.recordRenewal(id, { decision, expectedVersion });
      setMessage(decision === "RENEWED" ? "已登記為已續約" : "已登記為未續約");
      await client.invalidateQueries({ queryKey: ["contracts", "mine"] });
    } catch (error) {
      setMessage(error instanceof ClientError ? error.message : "登記失敗");
    }
  }
}

export function ResourcePage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="授權資源" lede="簽約後才提供的菜單、規範與標章圖檔都還沒有。清單先留位置，不放未授權的標章。" />
      <PendingNote />
      {authorizedResources.map((item) => (
        <div key={item.title} className="flex items-center justify-between gap-4 border-t border-[var(--line)] py-4">
          <h2 className="text-xl">{item.title}</h2>
          <p className="text-sm text-[var(--muted)]">{item.status}</p>
        </div>
      ))}
    </div>
  );
}

