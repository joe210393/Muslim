import { formatTwd, paymentStatusLabels, type PaymentItem, type ServicePlanItem } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useServices } from "../../app/session";
import { AdminPageHeader, Badge, Button, Card, ContentImage, DataTable, Empty, Field, Modal, SelectInput, StatCard, TextArea, TextInput, NoticeText, failNotice, tableRowClass, type Notice } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { ClientError } from "../../services/types";

const paymentPartLabels = { plans: "方案內容", reconciliation: "核帳", month: "本月成交", record: "登錄付款" } as const;

const paymentPartHints: Record<keyof typeof paymentPartLabels, string> = {
  plans: "業者可選多個方案，已選過的不能再選。未指定可見使用者時全體可見。",
  reconciliation: "核帳完成才開通教育訓練與合約；業者通過基礎教育訓練後才能建立驗證申請。",
  month: "本月已核帳完成的付款。",
  record: "業者線下付款時在這裡登錄，登錄後到「核帳」完成。",
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
                  <td className="p-3">{row.organizationName}</td>
                  <td className="p-3">{row.planName}</td>
                  <td className="p-3 whitespace-nowrap">{formatTwd(row.amount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      ) : null}
      {part === "plans" ? <PlansPart plans={data.plans} applicants={data.applicantUsers} onMessage={setMessage} onSaved={refresh} /> : null}
      {part === "reconciliation" ? <ReconciliationPart rows={data.awaitingReconciliation} onMessage={setMessage} onSaved={refresh} /> : null}
      {part === "record" ? <RecordPart organizations={data.organizations} plans={data.plans} onMessage={setMessage} onSaved={refresh} /> : null}
    </div>
  );
}

function ReconciliationPart({ rows, onMessage, onSaved }: { rows: PaymentItem[]; onMessage: (message: Notice) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  if (rows.length === 0) return <Empty title="沒有待核帳款項" body="業者完成付款或人工登錄後，會出現在這裡。" />;
  return (
    <DataTable columns={["業者", "方案", "金額", "付款時間", "狀態", "操作"]}>
      {rows.map((row) => (
        <tr key={row.id} className={tableRowClass}>
          <td className="p-3 font-medium">{row.organizationName}</td>
          <td className="p-3">{row.planName}</td>
          <td className="p-3 whitespace-nowrap">{formatTwd(row.amount)}</td>
          <td className="p-3 whitespace-nowrap">{formatTaipei(row.paidAt)}</td>
          <td className="p-3"><Badge tone={paymentStatusLabels[row.status].tone}>{paymentStatusLabels[row.status].label}</Badge></td>
          <td className="p-3">
            <Button onClick={async () => {
              try {
                await services.confirmReconciliation({ paymentId: row.id });
                onMessage(`已核帳完成，${row.organizationName} 可使用教育訓練與合約；通過基礎教育訓練後才能驗證申請。`);
                await onSaved();
              } catch (error) {
                onMessage(failNotice(error instanceof ClientError ? error.message : "無法完成核帳"));
              }
            }}>完成核帳</Button>
          </td>
        </tr>
      ))}
    </DataTable>
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
  const [editor, setEditor] = useState<"new" | ServicePlanItem | null>(null);
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
                  <td className="p-3">{formatTwd(plan.amount)}</td>
                  <td className="p-3">{plan.isActive ? "開放" : "關閉"}</td>
                  <td className="p-3">{plan.visibilityLabel}</td>
                  <td className="p-3">
                    <button type="button" className="text-[var(--link)] underline" onClick={() => setEditor(plan)}>編輯</button>
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
  const [amount, setAmount] = useState(String(plan?.amount ?? 0));
  const [description, setDescription] = useState(plan?.description ?? "");
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>(plan?.visibleUserIds ?? []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(plan?.name ?? "");
    setAmount(String(plan?.amount ?? 0));
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
        <Field label="金額（新台幣元，未稅）"><TextInput inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
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
              setBusy(true);
              try {
                if (creating) {
                  await services.createPlan({ name, amount: Number(amount), description, paymentUrl: "", isActive, visibleUserIds });
                  onMessage("已新增方案。");
                } else if (plan) {
                  await services.updatePlan(plan.id, {
                    name,
                    amount: Number(amount),
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
