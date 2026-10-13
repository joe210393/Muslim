import { applicationStatusLabels, contractStatusLabels, ecpayMethodLabel, formatTwd } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { authorizedResources, renewalRules } from "../../content/site-content";
import { Badge, Button, Card, Empty, PageHeader, PendingNote } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
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

export function PortalPaymentsPage() {
  const services = useServices();
  const [params] = useSearchParams();
  const [message, setMessage] = useState("");
  const query = useQuery({ queryKey: ["my-payments"], queryFn: () => services.myPayments() });
  const notice = params.get("ecpay") === "received" ? "已從綠界回到這個頁面。付款完成且檢查碼正確後，才會改成已付款。模擬付款不會入帳。" : params.get("ecpay") === "failed" ? "綠界回傳無法核對，這筆沒有改成已付款。" : "";
  if (query.isLoading) return <p>載入中…</p>;
  if (!query.data) return <p>無法載入付款紀錄</p>;
  const rows = query.data.payments;
  const plans = query.data.plans;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="已付款" lede="前往付款會依綠界全方位金流建立訂單。測試商店的卡號與後台見綠界文件。甲方註冊正式商店後，更換介接資訊即可。" />
      {notice ? <p className="text-sm">{notice}</p> : null}
      {message ? <p className="text-sm">{message}</p> : null}
      {rows.length === 0 ? <Empty title="還沒有付款紀錄" body="按下前往付款會先建立一筆待付款訂單。綠界通知付款成功後，這裡改成已付款。" /> : (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">時間</th><th className="p-3 font-medium">方案</th><th className="p-3 font-medium">金額</th><th className="p-3 font-medium">狀態</th><th className="p-3 font-medium">方式</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--line)]"><td className="p-3">{formatTaipei(row.paidAt)}</td><td className="p-3">{row.planName}</td><td className="p-3">{formatTwd(row.amount)}</td><td className="p-3">{row.status === "PAID" ? "已付款" : "待付款"}</td><td className="p-3">{ecpayMethodLabel(row.paymentMethod)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-xl">可前往付款的方案</h2>
        {plans.length === 0 ? <Empty title="目前沒有開放的方案" body="窗口建立方案並開放後，可以在這裡前往綠界付款。" /> : plans.map((plan) => (
          <Card key={plan.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg">{plan.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{formatTwd(plan.amount)}</p>
                {plan.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{plan.description}</p> : null}
              </div>
              <Button disabled={plan.amount < 1} onClick={async () => {
                try {
                  const checkout = await services.startCheckout(plan.id);
                  submitEcpay(checkout.action, checkout.fields);
                } catch (error) {
                  setMessage(error instanceof ClientError ? error.message : "無法前往綠界");
                }
              }}>前往付款</Button>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

function submitEcpay(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.acceptCharset = "UTF-8";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

