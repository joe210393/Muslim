import { applicationStatusLabels, contractStatusLabels, ecpayMethodLabel, formatTwd, paymentStatusLabels } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { authorizedResources, renewalRules } from "../../content/site-content";
import { Badge, Button, Card, ContentImage, Empty, PageHeader, PendingNote } from "../../components/ui";
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
      <PageHeader eyebrow="業者會員區" title="續約" lede="已繳回蓋章 PDF 的合約可以在這裡登記已續約或未續約。費用、到期提醒與是否重新現場複審仍待確認。" />
      <PendingNote />
      <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">
        {renewalRules.map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
      {renewable.length === 0 && !contracts.isLoading ? <Empty title="還沒有可登記的合約" body="上傳蓋章 PDF 後的合約會出現在這裡。" /> : null}
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
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["my-payments"], queryFn: () => services.myPayments() });
  if (query.isLoading) return <p>載入中…</p>;
  if (!query.data) return <p>無法載入方案與付款</p>;
  const rows = query.data.payments;
  const plans = query.data.plans;
  const unlocked = query.data.serviceUnlocked;
  const usedPlanIds = new Set(rows.map((row) => row.planId));
  const appliedRows = rows.filter((row) => row.status === "PENDING" || row.status === "QUOTED" || row.status === "PAID_PENDING");
  const approvedRows = rows.filter((row) => row.status === "PAID");
  const selectablePlans = [...plans]
    .filter((plan) => !usedPlanIds.has(plan.id))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
  const detailPlan = plans.find((item) => item.id === detailPlanId) ?? null;
  const payRow = async (paymentId: string, planName: string) => {
    setPayingId(paymentId);
    try {
      await services.markPaidPending(paymentId);
      setMessage(`「${planName}」已送出付款，等待核帳。`);
      await client.invalidateQueries({ queryKey: ["my-payments"] });
    } catch (error) {
      setMessage(error instanceof ClientError ? error.message : "無法付款");
    } finally {
      setPayingId(null);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="方案與付款" lede="列表樣式與後台方案管理一致。可看已申請、已通過與尚可選擇的方案；已選過的不能再選。" />
      {message ? <p className="text-sm">{message}</p> : null}
      <Card className="space-y-2">
        <p className="font-medium">{unlocked ? "已開通" : appliedRows.some((row) => row.status === "PAID_PENDING") ? "待核帳" : appliedRows.length ? "待付款" : "尚未開通"}</p>
        <p className="text-sm text-[var(--muted)]">
          {unlocked
            ? "已可使用教育訓練與合約。仍可另選尚未使用過的方案。請先完成基礎教育訓練，才能建立驗證申請。"
            : "請選擇方案並付款，核帳完成後才會開通。"}
        </p>
        {unlocked ? (
          <Link className="btn btn-primary inline-flex rounded-md px-3 py-2 text-sm no-underline" to="/portal/enrollments">前往基礎教育訓練</Link>
        ) : null}
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">已申請的方案</h2>
          <p className="text-sm text-[var(--muted)]">已選但尚未核帳完成：待付款或待核帳。</p>
        </div>
        {appliedRows.length === 0 ? (
          <Empty title="還沒有已申請方案" body="從下方「可選擇的方案」選一筆後會出現在這裡。" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">金額（未稅）</th>
                  <th className="p-3 font-medium">狀態</th>
                  <th className="p-3 font-medium">建立</th>
                  <th className="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {appliedRows.map((row) => {
                  const payable = row.status === "PENDING" || row.status === "QUOTED";
                  return (
                    <tr key={row.id} className="border-t border-[var(--line)]">
                      <td className="p-3">{row.planName}</td>
                      <td className="p-3">{formatTwd(row.amount)}</td>
                      <td className="p-3">{paymentStatusLabels[row.status].label}</td>
                      <td className="p-3">{formatTaipei(row.createdAt)}</td>
                      <td className="p-3">
                        {payable ? (
                          <button type="button" className="text-[var(--link)] underline disabled:opacity-50" disabled={payingId === row.id} onClick={() => void payRow(row.id, row.planName)}>
                            付款
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">已通過的方案</h2>
          <p className="text-sm text-[var(--muted)]">核帳完成、已開通相關功能的方案。</p>
        </div>
        {approvedRows.length === 0 ? (
          <Empty title="還沒有已通過方案" body="付款並完成核帳後會出現在這裡。" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">金額（未稅）</th>
                  <th className="p-3 font-medium">狀態</th>
                  <th className="p-3 font-medium">方式</th>
                  <th className="p-3 font-medium">建立</th>
                </tr>
              </thead>
              <tbody>
                {approvedRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--line)]">
                    <td className="p-3">{row.planName}</td>
                    <td className="p-3">{formatTwd(row.amount)}</td>
                    <td className="p-3">{paymentStatusLabels[row.status].label}</td>
                    <td className="p-3">{ecpayMethodLabel(row.paymentMethod)}</td>
                    <td className="p-3">{formatTaipei(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">可選擇的方案</h2>
          <p className="text-sm text-[var(--muted)]">尚未選過、目前對你開放的方案。</p>
        </div>
        {selectablePlans.length === 0 ? (
          <Empty title="沒有可選方案" body={plans.length === 0 ? "窗口尚未開放方案。" : "你看得到的方案都已選過。"} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">金額（未稅）</th>
                  <th className="p-3 font-medium">狀態</th>
                  <th className="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {selectablePlans.map((plan) => (
                  <tr key={plan.id} className="border-t border-[var(--line)]">
                    <td className="p-3">{plan.name}</td>
                    <td className="p-3">{formatTwd(plan.amount)}</td>
                    <td className="p-3">{plan.isActive ? "開放" : "關閉"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-3">
                        <button type="button" className="text-[var(--link)] underline" onClick={() => setDetailPlanId(plan.id)}>內容</button>
                        <button
                          type="button"
                          className="text-[var(--link)] underline"
                          onClick={async () => {
                            try {
                              await services.selectPlan({ planId: plan.id });
                              setMessage(`已選擇「${plan.name}」，請到「已申請的方案」付款。`);
                              await client.invalidateQueries({ queryKey: ["my-payments"] });
                            } catch (error) {
                              setMessage(error instanceof ClientError ? error.message : "無法選擇方案");
                            }
                          }}
                        >
                          選擇
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailPlan ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">{detailPlan.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{formatTwd(detailPlan.amount)}</p>
            </div>
            <button type="button" className="text-sm text-[var(--link)] underline" onClick={() => setDetailPlanId(null)}>關閉</button>
          </div>
          {detailPlan.description ? <p className="whitespace-pre-wrap text-sm leading-6">{detailPlan.description}</p> : <p className="text-sm text-[var(--muted)]">沒有說明文字。</p>}
          {(detailPlan.images ?? []).length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {detailPlan.images.map((image) => (
                <ContentImage key={image.id} src={image.imageUrl} className="h-40 w-full rounded-md object-cover" fallback={<div className="h-40 rounded-md bg-[var(--panel)]" />} />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

