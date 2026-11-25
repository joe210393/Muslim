import { ecpayMethodLabel, formatTwd, paymentStatusLabels, type PaymentItem, type RemittanceInfo, type ServicePlanItem } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { ReceiptPreview } from "../../components/ReceiptPreview";
import { Badge, Card, ContentImage, Empty, PageHeader } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { downloadRemittanceSlipPdf } from "../../lib/remittance-slip-pdf";
import { ClientError } from "../../services/types";

const OPEN = new Set(["QUOTED", "PENDING", "PAID_PENDING", "PAID"]);

function StatusBadge({ row }: { row: PaymentItem }) {
  const label = paymentStatusLabels[row.status];
  return <Badge tone={label.tone}>{label.label}</Badge>;
}

export function PortalPaymentsPage() {
  const services = useServices();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["my-payments"], queryFn: () => services.myPayments() });
  if (query.isLoading) return <p>載入中…</p>;
  if (!query.data) return <p>無法載入方案與付款</p>;
  const { payments: rows, plans, serviceUnlocked: unlocked, remittance } = query.data;
  const openPlanIds = new Set(rows.filter((row) => OPEN.has(row.status)).map((row) => row.planId));
  const inProgress = rows.filter((row) => row.status === "QUOTED" || row.status === "PENDING" || row.status === "PAID_PENDING");
  const approvedRows = rows.filter((row) => row.status === "PAID");
  const voidRows = rows.filter((row) => row.status === "VOID");
  const selectablePlans = [...plans]
    .filter((plan) => !openPlanIds.has(plan.id))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
  const detailPlan = plans.find((item) => item.id === detailPlanId) ?? null;
  const refresh = () => client.invalidateQueries({ queryKey: ["my-payments"] });
  const apply = async (plan: Pick<ServicePlanItem, "id" | "name">, again = false) => {
    try {
      await services.selectPlan({ planId: plan.id });
      setMessage(`${again ? "已重新申請" : "已申請"}「${plan.name}」，等管理員確認後會產生匯款單。`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof ClientError ? error.message : "無法申請方案");
    }
  };
  const summary = unlocked
    ? { title: "已核帳（未申請）", body: "已可使用教育訓練與合約。請先完成基礎教育訓練，才能建立驗證申請。" }
    : inProgress.some((row) => row.status === "PAID_PENDING")
      ? { title: "未核付款", body: "已收到你的繳費單據，管理員核帳後開通教育訓練。" }
      : inProgress.some((row) => row.status === "PENDING")
        ? { title: "未付款", body: "匯款單已產生，請在期限內繳費並上傳單據；逾期會變成未成立。" }
        : inProgress.some((row) => row.status === "QUOTED")
          ? { title: "未核案件", body: "已收到方案申請，等管理員確認。確認後這裡會出現匯款單。" }
          : { title: "尚未申請", body: "從下方選擇方案送出申請。" };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="註冊報價與繳費" lede="選方案 → 管理員確認 → 產生匯款單 → 繳費並上傳單據 → 管理員核帳 → 開通教育訓練。" />
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <Card className="space-y-2">
        <p className="font-medium">{summary.title}</p>
        <p className="text-sm text-[var(--muted)]">{summary.body}</p>
        {unlocked ? <Link className="btn btn-primary inline-flex rounded-md px-3 py-2 text-sm no-underline" to="/portal/enrollments">前往基礎教育訓練</Link> : null}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">處理中的方案</h2>
        {inProgress.length === 0 ? (
          <Empty title="沒有處理中的方案" body="從下方「可選擇的方案」申請後會出現在這裡。" />
        ) : (
          <div className="space-y-3">
            {inProgress.map((row) => (
              <PaymentCard key={row.id} row={row} remittance={remittance} onDone={async (text) => { setMessage(text); await refresh(); }} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">已核帳的方案</h2>
        {approvedRows.length === 0 ? (
          <Empty title="還沒有已核帳方案" body="上傳繳費單據並經管理員核帳後會出現在這裡。" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm [&_th]:whitespace-nowrap">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">金額（未稅）</th>
                  <th className="p-3 font-medium">狀態</th>
                  <th className="p-3 font-medium">方式</th>
                  <th className="p-3 font-medium">核帳時間</th>
                </tr>
              </thead>
              <tbody>
                {approvedRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--line)]">
                    <td className="p-3">{row.planName}</td>
                    <td className="p-3 whitespace-nowrap">{row.amount === 0 ? "免費" : formatTwd(row.amount)}</td>
                    <td className="p-3"><StatusBadge row={row} /></td>
                    <td className="p-3">{row.paymentMethod === "TRANSFER" ? "匯款" : row.paymentMethod === "FREE" ? "免費" : ecpayMethodLabel(row.paymentMethod)}</td>
                    <td className="p-3 whitespace-nowrap">{formatTaipei(row.accountingConfirmedAt ?? row.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {voidRows.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">未成立</h2>
            <p className="text-sm text-[var(--muted)]">未成立的繳費不能再上傳單據。要繼續請重新申請，會重新等管理員確認並產生新的匯款單。</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm [&_th]:whitespace-nowrap">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">原因</th>
                  <th className="p-3 font-medium">時間</th>
                  <th className="p-3 font-medium">繳費單據</th>
                  <th className="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {voidRows.map((row) => {
                  const plan = plans.find((item) => item.id === row.planId);
                  const canReapply = Boolean(plan) && !openPlanIds.has(row.planId);
                  return (
                    <tr key={row.id} className="border-t border-[var(--line)]">
                      <td className="p-3">{row.planName}</td>
                      <td className="p-3">{row.voidReason || "—"}</td>
                      <td className="p-3 whitespace-nowrap">{formatTaipei(row.voidedAt)}</td>
                      <td className="p-3 text-[var(--muted)]">已鎖定</td>
                      <td className="p-3">
                        {canReapply && plan ? (
                          <button type="button" className="text-[var(--link)] underline" onClick={() => void apply(plan, true)}>重新申請</button>
                        ) : (
                          <span className="text-[var(--muted)]">{plan ? "已重新申請" : "方案已關閉"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">可選擇的方案</h2>
          <p className="text-sm text-[var(--muted)]">目前對你開放、沒有處理中或已核帳的方案。</p>
        </div>
        {selectablePlans.length === 0 ? (
          <Empty title="沒有可選方案" body={plans.length === 0 ? "窗口尚未開放方案。" : "你看得到的方案都已申請。"} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm [&_th]:whitespace-nowrap">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">方案名稱</th>
                  <th className="p-3 font-medium">金額（未稅）</th>
                  <th className="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {selectablePlans.map((plan) => (
                  <tr key={plan.id} className="border-t border-[var(--line)]">
                    <td className="p-3">{plan.name}</td>
                    <td className="p-3 whitespace-nowrap">{plan.amount === 0 ? "免費" : formatTwd(plan.amount)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-3">
                        <button type="button" className="text-[var(--link)] underline" onClick={() => setDetailPlanId(plan.id)}>內容</button>
                        <button type="button" className="text-[var(--link)] underline" onClick={() => void apply(plan)}>申請</button>
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
              <p className="mt-1 text-sm text-[var(--muted)]">{detailPlan.amount === 0 ? "免費" : formatTwd(detailPlan.amount)}</p>
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

function PaymentCard({ row, remittance, onDone }: { row: PaymentItem; remittance: RemittanceInfo; onDone: (message: string) => Promise<void> }) {
  const services = useServices();
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(false);
  const overdue = row.status === "PENDING" && row.dueAt !== null && new Date(row.dueAt).getTime() < Date.now();
  const accountReady = Boolean(remittance.bankName && remittance.accountNo && remittance.accountName);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      await services.uploadPaymentReceipt(row.id, file);
      await onDone(`已上傳「${row.planName}」的繳費單據，等管理員核帳。`);
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.message : "無法上傳單據");
      await onDone("");
    } finally {
      setBusy(false);
    }
  }
  async function downloadPdf() {
    setPdfBusy(true);
    setError("");
    try {
      const slip = row.slipNo ?? row.id.slice(0, 8);
      await downloadRemittanceSlipPdf(
        {
          slipNo: row.slipNo ?? "—",
          organizationName: row.organizationName,
          planName: row.planName,
          amountLabel: formatTwd(row.amount),
          dueAtLabel: formatTaipei(row.dueAt),
          bankName: remittance.bankName,
          accountNo: remittance.accountNo,
          accountName: remittance.accountName,
        },
        `匯款單-${slip}.pdf`,
      );
    } catch {
      setError("無法下載匯款單 PDF，請稍後再試");
    } finally {
      setPdfBusy(false);
    }
  }
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{row.planName}</p>
          <p className="text-sm text-[var(--muted)]">申請於 {formatTaipei(row.createdAt)}</p>
        </div>
        <StatusBadge row={row} />
      </div>
      {row.status === "QUOTED" ? <p className="text-sm text-[var(--muted)]">等管理員確認方案內容。確認後會自動產生匯款單。</p> : null}
      {row.status === "PENDING" || row.status === "PAID_PENDING" ? (
        <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--bg)] p-4" aria-label="匯款單">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] pb-2">
            <p className="font-medium">匯款單</p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--muted)]">單號 {row.slipNo ?? "—"}</p>
              <button type="button" className="btn btn-secondary rounded-md px-3 py-1.5 text-sm" disabled={pdfBusy} onClick={() => void downloadPdf()}>
                {pdfBusy ? "產生中…" : "下載 PDF"}
              </button>
            </div>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-[var(--muted)]">業者</dt><dd>{row.organizationName}</dd></div>
            <div><dt className="text-[var(--muted)]">方案</dt><dd>{row.planName}</dd></div>
            <div><dt className="text-[var(--muted)]">應繳金額（未稅）</dt><dd className="text-base font-semibold">{formatTwd(row.amount)}</dd></div>
            <div><dt className="text-[var(--muted)]">繳費期限</dt><dd className={overdue ? "text-[var(--danger)]" : ""}>{formatTaipei(row.dueAt)}</dd></div>
            <div><dt className="text-[var(--muted)]">收款銀行</dt><dd>{remittance.bankName || "待管理員設定"}</dd></div>
            <div><dt className="text-[var(--muted)]">帳號</dt><dd className="tabular-nums">{remittance.accountNo || "待管理員設定"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[var(--muted)]">戶名</dt><dd>{remittance.accountName || "待管理員設定"}</dd></div>
          </dl>
          {!accountReady ? <p className="mt-3 text-sm text-[var(--warning,#8a5a00)]">收款帳戶尚未設定，請先聯絡窗口確認後再匯款。</p> : null}
          {row.note.startsWith("單據退回") ? <p className="mt-3 text-sm text-[var(--danger)]">{row.note}</p> : null}
        </div>
      ) : null}
      {row.status === "PENDING" ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className={`btn btn-primary inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium ${busy || overdue ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            {busy ? "上傳中…" : "上傳繳費單據"}
            <input
              className="hidden"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy || overdue}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          <span className="text-sm text-[var(--muted)]">PDF、JPEG 或 PNG。逾期未上傳會改為未成立並鎖定。</span>
        </div>
      ) : null}
      {row.status === "PAID_PENDING" ? (
        <p className="text-sm">
          已上傳單據{row.receiptName ? `「${row.receiptName}」` : ""}，等管理員核帳。
          <button type="button" className="ml-2 text-[var(--link)] underline" onClick={() => setViewing(true)}>查看單據</button>
        </p>
      ) : null}
      {viewing ? <ReceiptPreview paymentId={row.id} title={`繳費單據：${row.planName}`} onClose={() => setViewing(false)} /> : null}
      {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
    </Card>
  );
}
