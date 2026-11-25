import type { SystemConnection } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useServices, useSession } from "../../app/session";
import { AdminPageHeader, Button, Card, ErrorText, Field, NoticeText, SelectInput, TextInput, failNotice, type Notice } from "../../components/ui";
import { ClientError } from "../../services/types";

export function SystemSettingsPage() {
  const services = useServices();
  const session = useSession();
  const client = useQueryClient();
  const features = new Set(session.user?.featureKeys ?? []);
  const canUsers = features.has("users.manage");
  const canPayments = features.has("payments.manage");
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const connection = useQuery({
    queryKey: ["system-connection"],
    queryFn: () => services.systemConnection(),
    enabled: canUsers,
  });
  const [mb, setMb] = useState("10");
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [supportLabel, setSupportLabel] = useState("客服");
  const [supportUrl, setSupportUrl] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [ecpayEnv, setEcpayEnv] = useState<"stage" | "production">("stage");
  const [ecpayMerchantId, setEcpayMerchantId] = useState("");
  const [ecpayHashKey, setEcpayHashKey] = useState("");
  const [ecpayHashIv, setEcpayHashIv] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const [dueDays, setDueDays] = useState("14");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!setting.data) return;
    setMb(String(setting.data.attachmentMaxMb));
    setDueDays(String(setting.data.paymentDueDays));
    setBankName(setting.data.remitBankName);
    setAccountNo(setting.data.remitAccountNo);
    setAccountName(setting.data.remitAccountName);
  }, [setting.data]);

  useEffect(() => {
    if (!connection.data) return;
    setSupportEnabled(connection.data.supportEnabled);
    setSupportLabel(connection.data.supportLabel);
    setSupportUrl(connection.data.supportUrl);
    setSmtpHost(connection.data.smtpHost);
    setSmtpPort(String(connection.data.smtpPort));
    setSmtpUser(connection.data.smtpUser);
    setSmtpFrom(connection.data.smtpFrom);
    setEcpayEnv(connection.data.ecpayEnv);
    setEcpayMerchantId(connection.data.ecpayMerchantId);
  }, [connection.data]);

  if (setting.isLoading || (canUsers && connection.isLoading)) return <p>載入中…</p>;
  if (!setting.data) return <ErrorText message="無法載入設定" />;
  if (canUsers && !connection.data) return <ErrorText message="無法載入系統連線設定" />;
  const current = connection.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="設定"
        description="可隨時重新設定收款銀行、帳號與戶名。儲存後，業者端尚未繳清的匯款單會顯示最新帳戶。附件、客服、郵件與金鑰依權限顯示。"
      />
      <NoticeText notice={notice} />
      {canPayments ? (
        <Card>
          <h2 className="text-lg font-semibold">收款帳戶（可重新設定）</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            核准方案時產生的匯款單會帶這裡的銀行／帳號／戶名。可隨時修改後再按儲存；清空並儲存則業者端顯示「待管理員設定」。繳費期限變更不回寫已產生單據的到期日。
          </p>
          {setting.data.remitBankName || setting.data.remitAccountNo || setting.data.remitAccountName ? (
            <p className="mt-3 rounded-md bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
              目前已儲存：{setting.data.remitBankName || "（銀行未填）"}　{setting.data.remitAccountNo || "（帳號未填）"}　{setting.data.remitAccountName || "（戶名未填）"}
            </p>
          ) : (
            <p className="mt-3 rounded-md bg-[var(--panel)] px-3 py-2 text-sm text-[var(--warning,#8a5a00)]">尚未設定收款帳戶。</p>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="繳費期限（天）" required hint="核准當天起算，到第 N 天台北時間 23:59 為止。可填 1 到 90。">
              <TextInput inputMode="numeric" value={dueDays} onChange={(event) => setDueDays(event.target.value)} />
            </Field>
            <Field label="收款銀行" hint="含分行與銀行代碼，例如「○○銀行 ○○分行（代碼 000）」。">
              <TextInput value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="可重新輸入覆蓋" />
            </Field>
            <Field label="帳號" hint="只填數字與 -。">
              <TextInput inputMode="numeric" value={accountNo} onChange={(event) => setAccountNo(event.target.value)} placeholder="可重新輸入覆蓋" />
            </Field>
            <Field label="戶名">
              <TextInput value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="可重新輸入覆蓋" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button disabled={busy} onClick={() => void saveRemittance()}>儲存收款帳戶</Button>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => {
                setBankName("");
                setAccountNo("");
                setAccountName("");
                setNotice(null);
              }}
            >
              清空欄位
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => void reloadRemittance()}>
              還原已儲存內容
            </Button>
          </div>
        </Card>
      ) : null}
      {canUsers ? (
        <Card>
          <Field label="附件大小（MB）" required hint="預設 10 MB。臨時要加大就改這裡，儲存後新的上傳立刻用新的上限。已上傳的檔案不會被刪。可填 1 到 200。">
            <TextInput inputMode="numeric" value={mb} onChange={(event) => setMb(event.target.value)} />
          </Field>
          <div className="mt-4">
            <Button disabled={busy} onClick={() => void saveSize()}>儲存附件大小</Button>
          </div>
        </Card>
      ) : null}
      {canUsers && current ? (
        <>
          <Card>
            <h2 className="text-lg font-semibold">客服按鈕</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">打開並填好連結後，前台右下角出現按鈕。可以連站內頁，或連到 https 的客服、LINE 網址。沒有勾選或沒有連結時，前台不顯示按鈕。</p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={supportEnabled} onChange={(event) => setSupportEnabled(event.target.checked)} />
                顯示客服按鈕
              </label>
              <Field label="按鈕文字" required>
                <TextInput value={supportLabel} onChange={(event) => setSupportLabel(event.target.value)} />
              </Field>
              <Field label="連結" hint="例如 /contact，或 https 開頭的客服網址。">
                <TextInput value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} />
              </Field>
              <Button disabled={busy} onClick={() => void saveConnection({ supportEnabled, supportLabel, supportUrl }, "客服連結已更新")}>儲存客服</Button>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">郵件 SMTP</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">畫面上是目前正在使用的伺服器。主機留空再儲存，就改回沿用環境設定。填了主機並儲存後，之後的信改由這一組伺服器寄出。密碼在下面的金鑰區更換。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="SMTP 主機">
                <TextInput value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} />
              </Field>
              <Field label="埠" required>
                <TextInput inputMode="numeric" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} />
              </Field>
              <Field label="帳號">
                <TextInput value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} />
              </Field>
              <Field label="寄件者">
                <TextInput value={smtpFrom} onChange={(event) => setSmtpFrom(event.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Button disabled={busy} onClick={() => void saveMail()}>儲存郵件伺服器</Button>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">金鑰與密碼</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {current.smtpPasswordSet ? "郵件密碼目前已設定。" : "郵件密碼尚未設定。"}
              {current.ecpayHashKeySet ? " 綠界 HashKey 已設定。" : " 綠界 HashKey 尚未設定。"}
              {current.ecpayHashIvSet ? " HashIV 已設定。" : " HashIV 尚未設定。"}
              留空就不會改掉現有的密碼或金鑰。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="SMTP 密碼" hint="Gmail 應用程式密碼可以含空白，儲存時會去掉空白。">
                <TextInput type="password" value={smtpPassword} autoComplete="new-password" onChange={(event) => setSmtpPassword(event.target.value)} />
              </Field>
              <Field label="綠界環境">
                <SelectInput aria-label="綠界環境" value={ecpayEnv} onChange={(event) => setEcpayEnv(event.target.value as "stage" | "production")}>
                  <option value="stage">測試商店</option>
                  <option value="production">正式商店</option>
                </SelectInput>
              </Field>
              <Field label="綠界商店代號">
                <TextInput value={ecpayMerchantId} onChange={(event) => setEcpayMerchantId(event.target.value)} />
              </Field>
              <Field label="綠界 HashKey">
                <TextInput type="password" value={ecpayHashKey} autoComplete="new-password" onChange={(event) => setEcpayHashKey(event.target.value)} />
              </Field>
              <Field label="綠界 HashIV">
                <TextInput type="password" value={ecpayHashIv} autoComplete="new-password" onChange={(event) => setEcpayHashIv(event.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Button disabled={busy} onClick={() => void saveSecrets()}>儲存金鑰與密碼</Button>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">其他串接開關</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">媒體儲存、線上簽署等是否啟用，仍在員工頁。</p>
            <p className="mt-3"><Link to="/admin/permissions?tab=integrations">前往串接開關</Link></p>
          </Card>
        </>
      ) : null}
      {!canPayments && !canUsers ? <ErrorText message="這個帳號沒有設定權限" /> : null}
    </div>
  );

  async function reloadRemittance() {
    const fresh = await client.fetchQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
    setDueDays(String(fresh.paymentDueDays));
    setBankName(fresh.remitBankName);
    setAccountNo(fresh.remitAccountNo);
    setAccountName(fresh.remitAccountName);
    setNotice("已還原為目前已儲存的收款帳戶");
  }

  async function saveSize() {
    if (!setting.data) return;
    const count = Number(mb);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      setNotice(failNotice("附件大小請填 1 到 200 的整數"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const latest = await client.fetchQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
      await services.saveOperationSetting({ attachmentMaxMb: count, expectedVersion: latest.version });
      setNotice(`附件單檔上限已改為 ${count} MB`);
      await client.invalidateQueries({ queryKey: ["operation-setting"] });
      await client.invalidateQueries({ queryKey: ["public-config"] });
    } catch (error) {
      setNotice(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  async function saveRemittance() {
    if (!setting.data) return;
    const days = Number(dueDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      setNotice(failNotice("繳費期限請填 1 到 90 的整數"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const latest = await client.fetchQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
      await services.saveOperationSetting({
        paymentDueDays: days,
        remitBankName: bankName.trim(),
        remitAccountNo: accountNo.trim(),
        remitAccountName: accountName.trim(),
        expectedVersion: latest.version,
      });
      setNotice("收款帳戶已重新設定並儲存");
      await client.invalidateQueries({ queryKey: ["operation-setting"] });
      await client.invalidateQueries({ queryKey: ["my-payments"] });
      await client.invalidateQueries({ queryKey: ["payment-desk"] });
    } catch (error) {
      setNotice(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  async function saveMail() {
    const port = Number(smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setNotice(failNotice("SMTP 埠請填 1 到 65535"));
      return;
    }
    await saveConnection({
      smtpHost: smtpHost.trim(),
      smtpPort: port,
      smtpUser: smtpUser.trim(),
      smtpFrom: smtpFrom.trim(),
    }, "郵件伺服器已更新");
  }

  async function saveSecrets() {
    await saveConnection({
      ...(smtpPassword.trim() ? { smtpPassword } : {}),
      ecpayEnv,
      ecpayMerchantId: ecpayMerchantId.trim(),
      ...(ecpayHashKey.trim() ? { ecpayHashKey } : {}),
      ...(ecpayHashIv.trim() ? { ecpayHashIv } : {}),
    }, "金鑰與密碼已更新");
    setSmtpPassword("");
    setEcpayHashKey("");
    setEcpayHashIv("");
  }

  async function saveConnection(patch: Partial<SystemConnection> & { smtpPassword?: string; ecpayHashKey?: string; ecpayHashIv?: string }, done: string) {
    if (!connection.data) return;
    setBusy(true);
    setNotice(null);
    try {
      const latest = await client.fetchQuery({ queryKey: ["system-connection"], queryFn: () => services.systemConnection() });
      await services.saveSystemConnection({ ...patch, expectedVersion: latest.version });
      setNotice(done);
      await client.invalidateQueries({ queryKey: ["system-connection"] });
      await client.invalidateQueries({ queryKey: ["site-content"] });
    } catch (error) {
      setNotice(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }
}
