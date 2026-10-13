import { ecpayMethodLabel, formatTwd, type ServicePlanItem } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useServices } from "../../app/session";
import { Button, Card, Empty, Field, SectionNav, SelectInput, TextArea, TextInput } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { ClientError } from "../../services/types";

export function PaymentsPage() {
  const services = useServices();
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const part = location.pathname.endsWith("/plans") ? "plans" : location.pathname.endsWith("/record") ? "record" : "month";
  const [message, setMessage] = useState("");
  const desk = useQuery({ queryKey: ["payment-desk"], queryFn: () => services.paymentDesk() });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["payment-desk"] });
  };
  if (desk.isLoading) return <p>載入中…</p>;
  if (!desk.data) return <p>無法載入方案與付款</p>;
  const data = desk.data;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">方案與付款</h1>
      <p className="text-sm leading-6 text-[var(--muted)]">建立方案與金額後，業者會被導到綠界全方位金流付款頁。目前用綠界文件上的測試商店。甲方註冊正式商店後，改 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV，並把 ECPAY_ENV 設成 production。模擬付款不會把訂單改成已付款。</p>
      <SectionNav
        value={part}
        onChange={(next) => navigate(next === "plans" ? "/admin/payments/plans" : next === "record" ? "/admin/payments/record" : "/admin/payments")}
        items={[{ id: "plans", label: "方案內容" }, { id: "month", label: "本月成交" }, { id: "record", label: "登錄付款" }]}
      />
      {message ? <p className="text-sm">{message}</p> : null}
      {part === "month" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><p className="text-sm text-[var(--muted)]">{data.monthLabel}成交</p><p className="text-3xl font-semibold">{data.dealCount} 筆</p></Card>
            <Card><p className="text-sm text-[var(--muted)]">{data.monthLabel}付款</p><p className="text-3xl font-semibold">{formatTwd(data.paidAmount)}</p></Card>
          </div>
          <p className="text-sm text-[var(--muted)]">以台北時間的這個月計算。明細最多列出 100 筆，筆數與金額是整月合計。</p>
          {data.payments.length === 0 ? <Empty title="這個月還沒有成交" body="登錄付款後，筆數與金額會出現在這裡。" /> : (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">時間</th><th className="p-3 font-medium">業者</th><th className="p-3 font-medium">方案</th><th className="p-3 font-medium">金額</th><th className="p-3 font-medium">方式</th></tr></thead>
                <tbody>{data.payments.map((row) => <tr key={row.id} className="border-t border-[var(--line)]"><td className="p-3">{formatTaipei(row.paidAt)}</td><td className="p-3">{row.organizationName}</td><td className="p-3">{row.planName}</td><td className="p-3">{formatTwd(row.amount)}</td><td className="p-3">{ecpayMethodLabel(row.paymentMethod)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      {part === "plans" ? <PlansPart plans={data.plans} onMessage={setMessage} onSaved={refresh} /> : null}
      {part === "record" ? <RecordPart organizations={data.organizations} plans={data.plans} onMessage={setMessage} onSaved={refresh} /> : null}
    </div>
  );
}

function PlansPart({ plans, onMessage, onSaved }: { plans: ServicePlanItem[]; onMessage: (message: string) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0");
  const [description, setDescription] = useState("");
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-medium">建立方案</h2>
        <Field label="方案名稱"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="金額（新台幣元）"><TextInput inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="方案內容" hint="這段文字會出現在業者的付款頁。最多 4000 字。"><TextArea rows={8} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Button onClick={async () => {
          try {
            await services.createPlan({ name, amount: Number(amount), description, paymentUrl: "", isActive: true });
            setName("");
            setAmount("0");
            setDescription("");
            onMessage("已建立方案。業者付款頁會看到這段內容。");
            await onSaved();
          } catch (error) {
            onMessage(error instanceof ClientError ? error.message : "無法建立方案");
          }
        }}>建立方案</Button>
      </Card>
      {plans.length === 0 ? <Empty title="還沒有方案" body="寫好名稱、金額與方案內容。開放後，業者付款頁會看到同一段文字。" /> : plans.map((plan) => <PlanEditor key={plan.id} plan={plan} onMessage={onMessage} onSaved={onSaved} />)}
    </div>
  );
}

function PlanEditor({ plan, onMessage, onSaved }: { plan: ServicePlanItem; onMessage: (message: string) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  const [name, setName] = useState(plan.name);
  const [amount, setAmount] = useState(String(plan.amount));
  const [description, setDescription] = useState(plan.description);
  const [paymentUrl, setPaymentUrl] = useState(plan.paymentUrl);
  const [isActive, setIsActive] = useState(plan.isActive);
  useEffect(() => {
    setName(plan.name);
    setAmount(String(plan.amount));
    setDescription(plan.description);
    setPaymentUrl(plan.paymentUrl);
    setIsActive(plan.isActive);
  }, [plan]);
  return (
    <Card className="space-y-3">
      <Field label="方案名稱"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="金額（新台幣元）"><TextInput inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Field label="方案內容" hint="這段文字會出現在業者的付款頁。最多 4000 字。"><TextArea rows={8} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />開放給業者</label>
      <Button variant="secondary" onClick={async () => {
        try {
          await services.updatePlan(plan.id, { name, amount: Number(amount), description, paymentUrl, isActive, expectedVersion: plan.version });
          onMessage("已儲存方案。");
          await onSaved();
        } catch (error) {
          onMessage(error instanceof ClientError ? error.message : "無法儲存方案");
        }
      }}>儲存這一筆</Button>
    </Card>
  );
}

function RecordPart({ organizations, plans, onMessage, onSaved }: { organizations: Array<{ id: string; organizationName: string }>; plans: ServicePlanItem[]; onMessage: (message: string) => void; onSaved: () => Promise<void> }) {
  const services = useServices();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [note, setNote] = useState("");
  const plan = plans.find((item) => item.id === planId);
  return (
    <Card className="space-y-3">
      <h2 className="font-medium">登錄已付款</h2>
      <p className="text-sm leading-6 text-[var(--muted)]">這是登錄已經收到的款項。金額沿用方案上的數字，不會向第三方送出扣款。</p>
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
          onMessage(plan ? `已登錄 ${formatTwd(plan.amount)}。這筆會計入本月成交。` : "已登錄。");
          await onSaved();
        } catch (error) {
          onMessage(error instanceof ClientError ? error.message : "無法登錄付款");
        }
      }}>登錄已付款</Button>
    </Card>
  );
}
