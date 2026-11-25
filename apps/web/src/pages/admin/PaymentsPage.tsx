import { formatTwd, paymentDecisionLabels, paymentStatusLabels, type PaymentDecision, type PaymentDesk, type PaymentItem, type ServicePlanItem } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useServices } from "../../app/session";
import { OrgLink } from "../../components/OrgLink";
import { ReceiptPreview } from "../../components/ReceiptPreview";
import { AdminPageHeader, Button, Card, ContentImage, DataTable, Empty, Field, Modal, SelectInput, StatCard, TextArea, TextInput, NoticeText, failNotice, tableRowClass, type Notice } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { ClientError } from "../../services/types";

const paymentPartLabels = { plans: "方案內容", reconciliation: "報價與核帳", month: "本月成交", record: "登錄付款" } as const;

const paymentPartHints: Record<keyof typeof paymentPartLabels, string> = {
  plans: "業者可選多個方案；處理中或已核帳的不能重複申請，未成立的可重新申請。還沒有人選過的方案可以刪除。匯款帳戶與繳費期限在「設定」修改。",
  reconciliation: "未核案件 → 未付款（已產生匯款單）→ 未核付款 → 核帳完成才開通教育訓練與合約。",
  month: "本月已核帳完成的付款。",
  record: "業者線下付款時在這裡登錄，登錄後到「報價與核帳」的未核付款完成。",
};

export function PaymentsPage() {
  const services = useServices();
  const client = useQueryClient();
  const location = useLocation();
  const part: keyof typeof paymentPartLabels = location.pathname.endsWith("/plans")
    ? "plans"
    : location.pathname.endsWith("/reconciliation") || location.pathname.endsWith("/accounting")
      ? "reconciliation"
      : location.pathname.endsWith("/record")
        ? "record"
        : "month";
  const [message, setMessage] = useState<Notice>(null);
  const desk = useQuery({ queryKey: ["payment-desk"], queryFn: () => services.paymentDesk() });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["payment-desk"] });
  };
  if (desk.isLoading) return <p>載入中…</p>;
  if (!desk.data) return <p>無法載入方案與付款</p>;
  const data = desk.data;
  return (
    <div className="space-y-4">
      <AdminPageHeader title={paymentPartLabels[part]} description={paymentPartHints[part]} />
      <NoticeText notice={message} />
      {part === "month" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label={`${data.monthLabel}成交`} value={`${data.dealCount} 筆`} />
            <StatCard label={`${data.monthLabel}已核帳`} value={formatTwd(data.paidAmount)} />
          </div>
          {data.payments.length === 0 ? <Empty title="這個月還沒有核帳完成" body="核帳完成後，會出現在這裡。" /> : (
            <DataTable columns={["核帳時間", "業者", "方案", "金額"]}>
              {data.payments.map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  <td className="p-3 whitespace-nowrap">{formatTaipei(row.accountingConfirmedAt ?? row.paidAt)}</td>
                  <td className="p-3"><OrgLink name={row.organizationName} organizationId={row.organizationId} /></td>
                  <td className="p-3">{row.planName}</td>
                  <td className="p-3 whitespace-nowrap">{formatTwd(row.amount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      ) : null}
      {part === "plans" ? <PlansPart plans={data.plans} applicants={data.applicantUsers} onMessage={setMessage} onSaved={refresh} /> : null}
      {part === "reconciliation" ? <ReconciliationPart data={data} onMessage={setMessage} onSaved={refresh} /> : null}
      {part === "record" ? <RecordPart organizations={data.organizations} plans={data.plans} onMessage={setMessage} onSaved={refresh} /> : null}
    </div>
  );
}

type DeskTab = "QUOTED" | "PENDING" | "PAID_PENDING" | "VOID";

const deskTabHints: Record<DeskTab, string> = {
  QUOTED: "業者選了方案，確認沒問題後核准，系統會在業者端產生匯款單。免費方案核准即開通。",
  PENDING: "已產生匯款單、等業者繳費上傳單據。超過繳費期限會自動改為未成立並鎖定上傳。",
  PAID_PENDING: "業者已上傳繳費單據。核對入帳後按「完成核帳」，才會開通教育訓練與合約。",
  VOID: "不核准或逾期的紀錄。業者要重新申請才會再產生新的匯款單。",
};

function ReconciliationPart({ data, onMessage, onSaved }: { data: PaymentDesk; onMessage: (message: Notice) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  const lists: Record<DeskTab, PaymentItem[]> = {
    QUOTED: data.awaitingQuote,
    PENDING: data.awaitingPayment,
    PAID_PENDING: data.awaitingReconciliation,
    VOID: data.recentVoid,
  };
  const [tab, setTab] = useState<DeskTab>(() => (["QUOTED", "PAID_PENDING", "PENDING", "VOID"] as DeskTab[]).find((key) => lists[key].length > 0) ?? "QUOTED");
  const [pending, setPending] = useState<{ row: PaymentItem; decision: PaymentDecision } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PaymentItem | null>(null);
  const rows = lists[tab];
  async function approve(row: PaymentItem) {
    setBusyId(row.id);
    try {
      const saved = await services.reviewPayment({ paymentId: row.id, expectedStatus: "QUOTED", decision: "APPROVE_QUOTE", note: "" });
      onMessage(saved.status === "PAID" ? `免費方案已核准，${row.organizationName} 已開通。` : `已核准，${row.organizationName} 的匯款單 ${saved.slipNo ?? ""} 已產生，期限 ${formatTaipei(saved.dueAt)}。`);
      await onSaved();
    } catch (error) {
      onMessage(failNotice(error instanceof ClientError ? error.message : "無法核准"));
    } finally {
      setBusyId(null);
    }
  }
  async function reconcile(row: PaymentItem) {
    setBusyId(row.id);
    try {
      await services.confirmReconciliation({ paymentId: row.id });
      onMessage(`已核帳完成，${row.organizationName} 可使用教育訓練與合約；通過基礎教育訓練後才能驗證申請。`);
      await onSaved();
    } catch (error) {
      onMessage(failNotice(error instanceof ClientError ? error.message : "無法完成核帳"));
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="付款階段">
        {(Object.keys(lists) as DeskTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === key ? "border-[var(--accent-deep)] bg-[var(--accent-deep)]" : "border-[var(--line)] bg-[var(--surface)]"}`}
            style={tab === key ? { color: "#fffaf3" } : undefined}
            onClick={() => setTab(key)}
          >
            {paymentStatusLabels[key].label}（{lists[key].length}）
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">{deskTabHints[tab]}</p>
      {rows.length === 0 ? <Empty title={`沒有${paymentStatusLabels[tab].label}`} body="有新資料時會出現在這裡。" /> : (
        <DataTable columns={tab === "VOID" ? ["業者", "方案", "金額", "未成立時間", "原因"] : ["業者", "方案", "金額", tab === "QUOTED" ? "申請時間" : tab === "PENDING" ? "繳費期限" : "上傳時間", "匯款單號", "操作"]}>
          {rows.map((row) => (
            <tr key={row.id} className={tableRowClass}>
              <td className="min-w-[10rem] p-3 font-medium"><OrgLink name={row.organizationName} organizationId={row.organizationId} /></td>
              <td className="min-w-[8rem] p-3">{row.planName}</td>
              <td className="p-3 whitespace-nowrap">{row.amount === 0 ? "免費" : formatTwd(row.amount)}</td>
              {tab === "VOID" ? (
                <>
                  <td className="p-3 whitespace-nowrap">{formatTaipei(row.voidedAt)}</td>
                  <td className="p-3">{row.voidReason || "—"}</td>
                </>
              ) : (
                <>
                  <td className="p-3 whitespace-nowrap">{formatTaipei(tab === "QUOTED" ? row.createdAt : tab === "PENDING" ? row.dueAt : row.paidAt)}</td>
                  <td className="p-3 whitespace-nowrap">{row.slipNo ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {tab === "QUOTED" ? (
                        <>
                          <Button disabled={busyId === row.id} onClick={() => void approve(row)}>核准並產生匯款單</Button>
                          <Button variant="ghost" disabled={busyId === row.id} onClick={() => setPending({ row, decision: "REJECT_QUOTE" })}>不核准</Button>
                        </>
                      ) : null}
                      {tab === "PENDING" ? <Button variant="ghost" disabled={busyId === row.id} onClick={() => setPending({ row, decision: "VOID" })}>改為未成立</Button> : null}
                      {tab === "PAID_PENDING" ? (
                        <>
                          {row.receiptUploaded ? <Button variant="ghost" onClick={() => setViewing(row)}>看單據</Button> : <span className="self-center text-sm text-[var(--muted)]">人工登錄</span>}
                          <Button disabled={busyId === row.id} onClick={() => void reconcile(row)}>完成核帳</Button>
                          {row.receiptUploaded ? <Button variant="ghost" disabled={busyId === row.id} onClick={() => setPending({ row, decision: "RETURN_RECEIPT" })}>退回重傳</Button> : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </DataTable>
      )}
      {viewing ? <ReceiptPreview paymentId={viewing.id} title={`繳費單據：${viewing.organizationName} · ${viewing.planName}`} onClose={() => setViewing(null)} /> : null}
      {pending ? (
        <ReasonModal
          row={pending.row}
          decision={pending.decision}
          onClose={() => setPending(null)}
          onDone={async (text) => {
            setPending(null);
            onMessage(text);
            await onSaved();
          }}
          onError={(text) => onMessage(failNotice(text))}
        />
      ) : null}
    </div>
  );
}

function ReasonModal({ row, decision, onClose, onDone, onError }: {
  row: PaymentItem;
  decision: PaymentDecision;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const services = useServices();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = decision === "RETURN_RECEIPT" ? "業者會看到原因並可重新上傳；繳費期限不會延長。" : "業者會看到原因，這筆的上傳會鎖定，要重新申請。";
  return (
    <Modal title={`${paymentDecisionLabels[decision]}：${row.organizationName}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">{row.planName} · {row.amount === 0 ? "免費" : formatTwd(row.amount)}</p>
        <Field label="原因" hint={hint}><TextArea rows={3} value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={decision === "RETURN_RECEIPT" ? "primary" : "danger"}
            disabled={busy || note.trim().length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await services.reviewPayment({ paymentId: row.id, expectedStatus: row.status, decision, note });
                await onDone(decision === "RETURN_RECEIPT" ? `已退回 ${row.organizationName} 的單據。` : `${row.organizationName} 的「${row.planName}」已改為未成立。`);
              } catch (error) {
                onError(error instanceof ClientError ? error.message : "無法處理");
                setBusy(false);
              }
            }}
          >
            確定{paymentDecisionLabels[decision]}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>取消</Button>
        </div>
      </div>
    </Modal>
  );
}

function PlansPart({
  plans,
  applicants,
  onMessage,
  onSaved,
}: {
  plans: ServicePlanItem[];
  applicants: Array<{ id: string; displayName: string; email: string; organizationName: string | null }>;
  onMessage: (message: Notice) => void;
  onSaved: () => Promise<void>;
}) {
  const services = useServices();
  const [editor, setEditor] = useState<"new" | ServicePlanItem | null>(null);
  async function removePlan(plan: ServicePlanItem) {
    if (!window.confirm(`確定刪除「${plan.name}」？已有業者選過或付過的方案不能刪，可以改成不開放。`)) return;
    try {
      await services.deletePlan(plan.id);
      if (editor && editor !== "new" && editor.id === plan.id) setEditor(null);
      onMessage("已刪除方案。");
      await onSaved();
    } catch (error) {
      onMessage(failNotice(error instanceof ClientError ? error.message : "無法刪除方案"));
    }
  }
  const sorted = [...plans].sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
  useEffect(() => {
    if (!editor || editor === "new") return;
    const fresh = plans.find((item) => item.id === editor.id);
    if (fresh && fresh !== editor) setEditor(fresh);
  }, [plans, editor]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">方案列表</h2>
          <p className="text-sm text-[var(--muted)]">未指定使用者＝全體可見；有指定＝只有名單內帳號看得到。</p>
        </div>
        <Button onClick={() => setEditor("new")}>＋ 新增方案</Button>
      </div>
      {sorted.length === 0 ? (
        <Empty title="還沒有方案" body="按右上角「＋ 新增方案」建立第一筆。" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">方案名稱</th>
                <th className="p-3 font-medium">金額（未稅）</th>
                <th className="p-3 font-medium">狀態</th>
                <th className="p-3 font-medium">可見範圍</th>
                <th className="p-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((plan) => (
                <tr key={plan.id} className="border-t border-[var(--line)]">
                  <td className="p-3">{plan.name}</td>
                  <td className="p-3">{plan.amount === 0 ? "免費" : formatTwd(plan.amount)}</td>
                  <td className="p-3">{plan.isActive ? "開放" : "關閉"}</td>
                  <td className="p-3">{plan.visibilityLabel}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button type="button" className="text-[var(--link)] underline" onClick={() => setEditor(plan)}>編輯</button>
                    <button type="button" className="ml-3 text-[var(--danger)] underline" onClick={() => void removePlan(plan)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editor ? (
        <PlanEditorModal
          plan={editor === "new" ? null : editor}
          applicants={applicants}
          onClose={() => setEditor(null)}
          onMessage={onMessage}
          onSaved={async () => {
            await onSaved();
            setEditor(null);
          }}
          onKeepOpen={async () => {
            await onSaved();
          }}
        />
      ) : null}
    </div>
  );
}

function PlanEditorModal({
  plan,
  applicants,
  onClose,
  onMessage,
  onSaved,
  onKeepOpen,
}: {
  plan: ServicePlanItem | null;
  applicants: Array<{ id: string; displayName: string; email: string; organizationName: string | null }>;
  onClose: () => void;
  onMessage: (message: Notice) => void;
  onSaved: () => Promise<void>;
  onKeepOpen: () => Promise<void>;
}) {
  const services = useServices();
  const creating = !plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [free, setFree] = useState(plan ? plan.amount === 0 : false);
  const [amount, setAmount] = useState(plan ? String(plan.amount) : "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>(plan?.visibleUserIds ?? []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(plan?.name ?? "");
    setFree(plan ? plan.amount === 0 : false);
    setAmount(plan ? String(plan.amount) : "");
    setDescription(plan?.description ?? "");
    setIsActive(plan?.isActive ?? true);
    setVisibleUserIds(plan?.visibleUserIds ?? []);
  }, [plan]);
  function toggleUser(userId: string) {
    setVisibleUserIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }
  return (
    <Modal title={creating ? "新增方案" : "編輯方案"} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <Field label="方案名稱"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={free} onChange={(event) => { const next = event.target.checked; setFree(next); setAmount(next ? "0" : amount === "0" ? "" : amount); }} />免費</label>
        <Field label="金額（新台幣元，未稅）" hint="勾選免費後金額固定為 0。若只給特定業者，請在下方指定可見使用者。選了之後仍走現有的付款與核帳。">
          <TextInput inputMode="numeric" value={free ? "0" : amount} disabled={free} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="方案說明" hint="申請對象、效期、備註與規範重點。最多 4000 字。">
          <TextArea rows={8} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />開放給業者</label>
        <div className="space-y-2 border-t border-[var(--line)] pt-3">
          <p className="text-sm font-medium">可見使用者</p>
          <p className="text-sm text-[var(--muted)]">不勾任何人＝全體可見。勾選後只有這些業者帳號看得到。</p>
          {applicants.length === 0 ? <p className="text-sm text-[var(--muted)]">目前沒有業者帳號可指定。</p> : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--line)] p-2">
              {applicants.map((user) => (
                <label key={user.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={visibleUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} />
                  <span>{user.displayName}（{user.email}）{user.organizationName ? ` · ${user.organizationName}` : ""}</span>
                </label>
              ))}
            </div>
          )}
          {visibleUserIds.length > 0 ? (
            <button type="button" className="text-sm text-[var(--link)] underline" onClick={() => setVisibleUserIds([])}>清除指定（改回全體可見）</button>
          ) : null}
        </div>
        {!creating && plan ? (
          <div className="space-y-2 border-t border-[var(--line)] pt-3">
            <p className="text-sm font-medium">說明圖片</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(plan.images ?? []).map((image) => (
                <div key={image.id} className="space-y-2">
                  <ContentImage src={image.imageUrl} className="h-32 w-full rounded-md object-cover" fallback={<div className="h-32 rounded-md bg-[var(--panel)]" />} />
                  <button
                    type="button"
                    className="text-sm text-[var(--link)] underline"
                    onClick={async () => {
                      if (!window.confirm("確定移除這張說明圖？")) return;
                      try {
                        await services.removePlanImage(plan.id, image.id);
                        onMessage("已移除圖片。");
                        await onKeepOpen();
                      } catch (error) {
                        onMessage(failNotice(error instanceof ClientError ? error.message : "無法移除圖片"));
                      }
                    }}
                  >
                    移除這張
                  </button>
                </div>
              ))}
            </div>
            <label className="btn inline-flex cursor-pointer">
              上傳說明圖
              <input
                className="hidden"
                type="file"
                accept="image/jpeg,image/png"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    await services.uploadPlanImage(plan.id, file);
                    onMessage("已上傳說明圖。");
                    await onKeepOpen();
                  } catch (error) {
                    onMessage(failNotice(error instanceof ClientError ? error.message : "無法上傳圖片"));
                  }
                }}
              />
            </label>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">先儲存方案後，才能上傳說明圖片。</p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            disabled={busy}
            onClick={async () => {
              const parsed = free ? 0 : Number(amount);
              if (!free && (!Number.isInteger(parsed) || parsed < 1)) {
                onMessage(failNotice("請填大於 0 的金額，或勾選免費"));
                return;
              }
              setBusy(true);
              try {
                if (creating) {
                  await services.createPlan({ name, amount: parsed, description, paymentUrl: "", isActive, visibleUserIds });
                  onMessage("已新增方案。");
                } else if (plan) {
                  await services.updatePlan(plan.id, {
                    name,
                    amount: parsed,
                    description,
                    paymentUrl: plan.paymentUrl,
                    isActive,
                    visibleUserIds,
                    expectedVersion: plan.version,
                  });
                  onMessage("已儲存方案。");
                }
                await onSaved();
              } catch (error) {
                onMessage(failNotice(error instanceof ClientError ? error.message : creating ? "無法新增方案" : "無法儲存方案"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {creating ? "新增" : "儲存"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>取消</Button>
          {!creating && plan ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`確定刪除「${plan.name}」？已有業者選過或付過的方案不能刪，可以改成不開放。`)) return;
                setBusy(true);
                try {
                  await services.deletePlan(plan.id);
                  onMessage("已刪除方案。");
                  await onSaved();
                } catch (error) {
                  onMessage(failNotice(error instanceof ClientError ? error.message : "無法刪除方案"));
                  setBusy(false);
                }
              }}
            >
              刪除方案
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function RecordPart({ organizations, plans, onMessage, onSaved }: { organizations: Array<{ id: string; organizationName: string }>; plans: ServicePlanItem[]; onMessage: (message: Notice) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [note, setNote] = useState("");
  const plan = plans.find((item) => item.id === planId);
  return (
    <Card className="space-y-3">
      <h2 className="font-medium">登錄已收款（待核帳）</h2>
      <p className="text-sm leading-6 text-[var(--muted)]">用於線下已收款。登錄後仍要到「核帳」完成，才會開通業者功能。</p>
      <Field label="業者">
        <SelectInput value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.organizationName}</option>)}
        </SelectInput>
      </Field>
      <Field label="方案">
        <SelectInput value={planId} onChange={(event) => setPlanId(event.target.value)}>
          {plans.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatTwd(item.amount)}</option>)}
        </SelectInput>
      </Field>
      <Field label="備註"><TextInput value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      <Button disabled={!organizationId || !plan} onClick={async () => {
        try {
          await services.recordPayment({ organizationId, planId, note });
          setNote("");
          onMessage(plan ? `已登錄 ${formatTwd(plan.amount)}，請到核帳完成。` : "已登錄。");
          await onSaved();
        } catch (error) {
          onMessage(failNotice(error instanceof ClientError ? error.message : "無法登錄付款"));
        }
      }}>登錄待核帳</Button>
    </Card>
  );
}
