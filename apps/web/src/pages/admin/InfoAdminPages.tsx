import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { siteReviewChecklist, standardReports } from "../../content/site-content";
import { Button, Card, ErrorText, Field, PageHeader, PendingNote, TextInput } from "../../components/ui";
import { ClientError, type AdminSiteSlot, type SiteSlotInput } from "../../services/types";

export function CmsPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-site"], queryFn: () => services.adminSite() });
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="內部後台" title="內容管理" lede="這裡改的是首頁 Hero 與 Banner，儲存後公開首頁會立刻用這份內容。其他說明頁仍可在內容檔替換。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入內容"} /> : null}
      {query.data?.map((slot) => (
        <SlotEditor
          key={slot.slot}
          slot={slot}
          onSaved={async () => client.invalidateQueries({ queryKey: ["admin-site"] })}
        />
      ))}
    </div>
  );
}

function SlotEditor({ slot, onSaved }: { slot: AdminSiteSlot; onSaved: () => Promise<void> }) {
  const services = useServices();
  const [form, setForm] = useState<SiteSlotInput>({
    eyebrow: slot.eyebrow,
    title: slot.title,
    subtitle: slot.subtitle,
    body: slot.body,
    ctaLabel: slot.ctaLabel,
    ctaHref: slot.ctaHref,
    secondaryCtaLabel: slot.secondaryCtaLabel,
    secondaryCtaHref: slot.secondaryCtaHref,
    isPublished: slot.isPublished,
    expectedVersion: slot.version,
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    setForm({
      eyebrow: slot.eyebrow,
      title: slot.title,
      subtitle: slot.subtitle,
      body: slot.body,
      ctaLabel: slot.ctaLabel,
      ctaHref: slot.ctaHref,
      secondaryCtaLabel: slot.secondaryCtaLabel,
      secondaryCtaHref: slot.secondaryCtaHref,
      isPublished: slot.isPublished,
      expectedVersion: slot.version,
    });
  }, [slot]);
  const name = slot.slot === "HOME_HERO" ? "首頁 Hero" : "首頁 Banner";
  return (
    <Card>
      <h2 className="text-2xl">{name}</h2>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await services.saveSite(slot.slot, form);
            setMessage("已儲存");
            await onSaved();
          } catch (error) {
            setMessage(error instanceof ClientError ? error.message : "儲存失敗");
          }
        }}
      >
        <Field label="眉題"><TextInput value={form.eyebrow} onChange={(event) => setForm({ ...form, eyebrow: event.target.value })} /></Field>
        <Field label="標題"><TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
        <Field label="副標"><TextInput value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></Field>
        <Field label="內文"><textarea className="min-h-28 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="主按鈕文字"><TextInput value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} /></Field>
          <Field label="主按鈕路徑"><TextInput value={form.ctaHref} onChange={(event) => setForm({ ...form, ctaHref: event.target.value })} /></Field>
          <Field label="次按鈕文字"><TextInput value={form.secondaryCtaLabel} onChange={(event) => setForm({ ...form, secondaryCtaLabel: event.target.value })} /></Field>
          <Field label="次按鈕路徑"><TextInput value={form.secondaryCtaHref} onChange={(event) => setForm({ ...form, secondaryCtaHref: event.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />發布到首頁</label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">儲存文字</Button>
          <label className="rounded-md border border-[var(--ink)] px-4 py-2 text-sm">
            更換圖片
            <input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await services.uploadSiteImage(slot.slot, file);
                setMessage("已更換圖片");
                await onSaved();
              } catch (error) {
                setMessage(error instanceof ClientError ? error.message : "上傳失敗");
              }
            }} />
          </label>
        </div>
        {slot.imageUrl ? <img src={slot.imageUrl} alt="" className="mt-3 h-36 w-full rounded-md object-cover" /> : null}
        {message ? <p className="text-sm">{message}</p> : null}
      </form>
    </Card>
  );
}

export function SiteReviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="內部後台" title="現場複審" lede="檢查項目依廚房與餐廳類申請推論。拍照、錄影與判定標準尚未核定，現場檔案仍請用案件附件歸檔。" />
      <PendingNote />
      <ol className="space-y-4">
        {siteReviewChecklist.map((item, index) => (
          <li key={item.key} className="border-t border-[var(--line)] pt-4">
            <h2 className="text-xl">{index + 1}. {item.label}</h2>
            <p className="mt-2 leading-7 text-[var(--muted)]">{item.detail}</p>
          </li>
        ))}
      </ol>
      <Link to="/admin/applications">回到案件審查</Link>
    </div>
  );
}

export function ContractAdminPage() {
  const services = useServices();
  const client = useQueryClient();
  const template = useQuery({ queryKey: ["contract-template"], queryFn: () => services.contractTemplate() });
  const contracts = useQuery({ queryKey: ["admin-contracts"], queryFn: () => services.adminContracts() });
  const organizations = useQuery({ queryKey: ["organizations", "contract"], queryFn: () => services.organizations() });
  const [draft, setDraft] = useState({ title: "", body: "", expectedVersion: 1 });
  const [organizationId, setOrganizationId] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!template.data) return;
    setDraft({ title: template.data.title, body: template.data.body, expectedVersion: template.data.version });
  }, [template.data]);
  const current = contracts.data?.find((item) => item.id === selected);
  const detail = useQuery({ queryKey: ["admin-contract", selected], queryFn: () => services.contract(selected), enabled: Boolean(selected) });
  const [issuedDraft, setIssuedDraft] = useState({ title: "", body: "", expectedVersion: 1 });
  useEffect(() => {
    if (!detail.data) return;
    setIssuedDraft({ title: detail.data.title, body: detail.data.body, expectedVersion: detail.data.version });
  }, [detail.data]);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="內部後台" title="合約管理" lede="先改範本，再發給業者。待簽署的合約可以改這一份的文字；簽署後的 PDF 保留簽署當下的內容。" />
      {template.data ? (
        <Card>
          <h2 className="text-2xl">合約範本</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">可用 {"{{organizationName}}"}、{"{{taxId}}"}、{"{{contractNo}}"}、{"{{issuedOn}}"}。正式法律文字之後直接貼上覆蓋。</p>
          <form className="mt-4 space-y-3" onSubmit={async (event) => {
            event.preventDefault();
            try {
              await services.saveContractTemplate(draft);
              setMessage("範本已儲存");
              await client.invalidateQueries({ queryKey: ["contract-template"] });
            } catch (error) {
              setMessage(error instanceof ClientError ? error.message : "儲存失敗");
            }
          }}>
            <Field label="標題"><TextInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <Field label="內文"><textarea className="min-h-64 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></Field>
            <Button type="submit">儲存範本</Button>
          </form>
        </Card>
      ) : null}
      <Card>
        <h2 className="text-2xl">發給業者</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async (event) => {
          event.preventDefault();
          try {
            const created = await services.issueContract(organizationId);
            setMessage(`已發出 ${created.contractNo}`);
            await client.invalidateQueries({ queryKey: ["admin-contracts"] });
          } catch (error) {
            setMessage(error instanceof ClientError ? error.message : "發出失敗");
          }
        }}>
          <Field label="業者">
            <select className="rounded-md border border-[var(--line)] bg-white px-3 py-2" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>
              <option value="">選擇業者</option>
              {organizations.data?.map((org) => <option key={org.id} value={org.id}>{org.organizationName}</option>)}
            </select>
          </Field>
          <Button type="submit">發出合約</Button>
        </form>
      </Card>
      <div className="space-y-3">
        {contracts.data?.map((item) => (
          <button key={item.id} type="button" className="block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-left" onClick={() => setSelected(item.id)}>
            <span className="font-medium">{item.contractNo}</span>
            <span className="ml-3 text-sm text-[var(--muted)]">{item.organizationName} · {item.status === "SIGNED" ? "已簽署" : item.status === "VOID" ? "已作廢" : "待簽署"}</span>
          </button>
        ))}
      </div>
      {current && detail.data ? (
        <Card>
          <h2 className="text-2xl">{detail.data.contractNo}</h2>
          {detail.data.status === "ISSUED" ? (
            <form className="mt-4 space-y-3" onSubmit={async (event) => {
              event.preventDefault();
              try {
                await services.saveContract(detail.data.id, issuedDraft);
                setMessage("這份合約已更新");
                await client.invalidateQueries({ queryKey: ["admin-contract", selected] });
                await client.invalidateQueries({ queryKey: ["admin-contracts"] });
              } catch (error) {
                setMessage(error instanceof ClientError ? error.message : "更新失敗");
              }
            }}>
              <Field label="標題"><TextInput value={issuedDraft.title} onChange={(event) => setIssuedDraft({ ...issuedDraft, title: event.target.value })} /></Field>
              <Field label="這一份的內文"><textarea className="min-h-48 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2" value={issuedDraft.body} onChange={(event) => setIssuedDraft({ ...issuedDraft, body: event.target.value })} /></Field>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">儲存這一份</Button>
                <Button type="button" variant="danger" onClick={async () => {
                  try {
                    await services.voidContract(detail.data.id, issuedDraft.expectedVersion);
                    setMessage("已作廢");
                    await client.invalidateQueries({ queryKey: ["admin-contracts"] });
                    await client.invalidateQueries({ queryKey: ["admin-contract", selected] });
                  } catch (error) {
                    setMessage(error instanceof ClientError ? error.message : "作廢失敗");
                  }
                }}>作廢</Button>
              </div>
            </form>
          ) : <pre className="mt-4 whitespace-pre-wrap text-sm leading-7">{detail.data.body}</pre>}
          {detail.data.status === "SIGNED" ? <Button className="mt-4" onClick={async () => downloadBlob(await services.contractDocument(detail.data.id))}>下載已簽名 PDF</Button> : null}
        </Card>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function ReportsPage() {
  const services = useServices();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="內部後台" title="報表" lede="可下載的報表會真正產生檔案。尚未具備資料的報表只列出欄位，不提供空檔下載。" />
      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">報表</th><th className="p-3 font-medium">欄位</th><th className="p-3 font-medium">狀態</th></tr></thead>
          <tbody>
            {standardReports.map((report) => (
              <tr key={report.name} className="border-t border-[var(--line)]">
                <td className="p-3">{report.name}</td>
                <td className="p-3">{report.fields}</td>
                <td className="p-3">{report.ready ? "可匯出現有資料" : "待資料齊全"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={async () => downloadText("applications.csv", await services.exportApplications())}>下載案件進度 CSV</Button>
        <Link to="/admin/imports">資料匯入</Link>
      </div>
    </div>
  );
}

export function PermissionsPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["access"], queryFn: () => services.accessSettings() });
  const [message, setMessage] = useState("");
  const roles = ["APPLICANT", "CASE_OFFICER", "ADMIN"] as const;
  const roleName = { APPLICANT: "業者", CASE_OFFICER: "承辦", ADMIN: "管理員" };
  const features = [...new Set(query.data?.features.map((item) => item.featureKey) ?? [])];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="內部後台" title="權限與串接" lede="勾選會立刻寫入並影響對應 API。金流沒有服務商金鑰時不會扣款。管理員的帳號管理不能關閉。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入設定"} /> : null}
      {query.data ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr><th className="p-3 font-medium">功能</th>{roles.map((role) => <th key={role} className="p-3 font-medium">{roleName[role]}</th>)}</tr>
            </thead>
            <tbody>
              {features.map((featureKey) => (
                <tr key={featureKey} className="border-t border-[var(--line)]">
                  <td className="p-3">{query.data.features.find((item) => item.featureKey === featureKey)?.label}</td>
                  {roles.map((role) => {
                    const cell = query.data.features.find((item) => item.featureKey === featureKey && item.role === role);
                    return (
                      <td key={role} className="p-3">
                        <input
                          type="checkbox"
                          checked={cell?.enabled ?? false}
                          aria-label={`${roleName[role]} ${cell?.label ?? featureKey}`}
                          onChange={async (event) => {
                            try {
                              await services.updateFeature({ role, featureKey, enabled: event.target.checked });
                              setMessage("權限已更新");
                              await client.invalidateQueries({ queryKey: ["access"] });
                            } catch (error) {
                              setMessage(error instanceof ClientError ? error.message : "更新失敗");
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="space-y-4">
        {query.data?.integrations.map((item) => (
          <Card key={`${item.key}-${item.enabled}-${item.provider}-${item.note}`}>
            <h2 className="text-xl">{item.label}</h2>
            <form className="mt-3 space-y-3" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await services.updateIntegration({
                  key: item.key,
                  provider: String(form.get("provider") ?? ""),
                  note: String(form.get("note") ?? ""),
                  enabled: form.get("enabled") === "on",
                });
                setMessage("串接設定已更新");
                await client.invalidateQueries({ queryKey: ["access"] });
              } catch (error) {
                setMessage(error instanceof ClientError ? error.message : "更新失敗");
              }
            }}>
              <Field label="服務方式"><TextInput name="provider" defaultValue={item.provider} /></Field>
              <Field label="說明"><TextInput name="note" defaultValue={item.note} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={item.enabled} />啟用</label>
              <Button type="submit">儲存這項串接</Button>
            </form>
          </Card>
        ))}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <Link to="/admin/users">建立內部帳號</Link>
    </div>
  );
}

async function downloadBlob(file: { blob: Blob; name: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
