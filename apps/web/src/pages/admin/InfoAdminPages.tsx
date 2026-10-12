import { EditorialKind, REPORT_SOURCES, STAFF_FEATURES, reportFieldId, reportFieldsFor, sourceLabel, type ContentSlot, type ReportPreview, type ReportSource, type SavedReport } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/session";
import { siteReviewChecklist, standardReports } from "../../content/site-content";
import { Button, Card, ErrorText, Field, PageHeader, PendingNote, SectionNav, SelectInput, TextArea, TextInput } from "../../components/ui";
import { ClientError, type AdminEditorialEntry, type AdminSiteSlot, type EditorialUpdate, type EditorialWrite, type SiteSlotInput } from "../../services/types";

const COPY_LABELS: Partial<Record<ContentSlot, { subtitle: string; body: string }>> = {
  ABOUT: { subtitle: "第一段", body: "第二段" },
  NEWS_INTRO: { subtitle: "導言", body: "補充" },
  VERIFICATION: { subtitle: "導言", body: "朝拜時間說明" },
  FAQ: { subtitle: "導言", body: "補充" },
};

const CMS_PAGES: Record<string, { title: string; lede: string; part: string }> = {
  home: { title: "首頁", lede: "這一頁只改首頁。Hero、Banner 與重點分開。最新消息與教育訓練仍各顯示前五筆。", part: "HOME_HERO" },
  about: { title: "關於我們", lede: "這一頁只改關於我們。頁首可以上傳圖片與 YouTube 連結。", part: "page" },
  news: { title: "最新消息", lede: "每一則消息是一篇文章。文章可以上傳圖片與 YouTube 連結。", part: "list" },
  verification: { title: "驗證介紹", lede: "這一頁只改驗證介紹。頁首可以上傳圖片與 YouTube 連結。", part: "page" },
  faq: { title: "常見問題", lede: "這一頁只改常見問題。頁首可以上傳圖片與 YouTube 連結。", part: "page" },
};

export function CmsPage() {
  const { page = "" } = useParams();
  const config = CMS_PAGES[page];
  const services = useServices();
  const client = useQueryClient();
  const slots = useQuery({ queryKey: ["admin-site"], queryFn: () => services.adminSite() });
  const entries = useQuery({ queryKey: ["admin-editorial"], queryFn: () => services.adminEntries() });
  const [part, setPart] = useState(config?.part ?? "page");
  useEffect(() => { setPart(config?.part ?? "page"); }, [page, config?.part]);
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["admin-site"] });
    await client.invalidateQueries({ queryKey: ["admin-editorial"] });
    await client.invalidateQueries({ queryKey: ["site-content"] });
  }
  if (!config) return <p>找不到這個頁面。</p>;
  const slot = (id: ContentSlot) => slots.data?.find((item) => item.slot === id);
  const list = entries.data ?? [];
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="內容管理" title={config.title} lede={config.lede} />
      {slots.isLoading || entries.isLoading ? <p>載入中…</p> : null}
      {slots.error || entries.error ? <ErrorText message="無法載入內容" /> : null}
      {page === "home" ? (
        <>
          <SectionNav items={[{ id: "HOME_HERO", label: "Hero" }, { id: "HOME_BANNER", label: "Banner" }, { id: "points", label: "重點" }]} value={part} onChange={setPart} />
          {part === "points" ? <EntryDesk kind={EditorialKind.HOME_POINT} entries={list} onChanged={refresh} /> : null}
          {part !== "points" && slot(part as ContentSlot) ? <SlotEditor key={part} slot={slot(part as ContentSlot)!} mode="media" onSaved={refresh} /> : null}
        </>
      ) : null}
      {page === "about" ? <CopyAndList part={part} setPart={setPart} pageSlot={slot("ABOUT")} listLabel="重點" listKind={EditorialKind.ABOUT_FACT} entries={list} onSaved={refresh} /> : null}
      {page === "news" ? <EntryDesk kind={EditorialKind.NEWS} entries={list} onChanged={refresh} /> : null}
      {page === "verification" ? (
        <>
          <SectionNav items={[{ id: "page", label: "頁首" }, { id: "steps", label: "申請流程" }, { id: "fees", label: "費用" }, { id: "mail", label: "通知草稿" }]} value={part} onChange={setPart} />
          {part === "page" && slot("VERIFICATION") ? <SlotEditor key="VERIFICATION" slot={slot("VERIFICATION")!} mode="copy" onSaved={refresh} /> : null}
          {part === "steps" ? <EntryDesk kind={EditorialKind.VERIFICATION_STEP} entries={list} onChanged={refresh} /> : null}
          {part === "fees" ? <EntryDesk kind={EditorialKind.FEE} entries={list} onChanged={refresh} /> : null}
          {part === "mail" ? <EntryDesk kind={EditorialKind.EMAIL_DRAFT} entries={list} onChanged={refresh} /> : null}
        </>
      ) : null}
      {page === "faq" ? <CopyAndList part={part} setPart={setPart} pageSlot={slot("FAQ")} listLabel="問答" listKind={EditorialKind.FAQ} entries={list} onSaved={refresh} /> : null}
    </div>
  );
}

function CopyAndList({ part, setPart, pageSlot, listLabel, listKind, entries, onSaved }: { part: string; setPart: (id: string) => void; pageSlot?: AdminSiteSlot; listLabel: string; listKind: EditorialKind; entries: AdminEditorialEntry[]; onSaved: () => Promise<void> }) {
  return (
    <>
      <SectionNav items={[{ id: "page", label: "頁首" }, { id: "list", label: listLabel }]} value={part} onChange={setPart} />
      {part === "page" && pageSlot ? <SlotEditor key={pageSlot.slot} slot={pageSlot} mode="copy" onSaved={onSaved} /> : null}
      {part === "list" ? <EntryDesk kind={listKind} entries={entries} onChanged={onSaved} /> : null}
    </>
  );
}

function SlotEditor({ slot, onSaved, mode }: { slot: AdminSiteSlot; onSaved: () => Promise<void>; mode: "media" | "copy" }) {
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
    youtubeUrl: slot.youtubeUrl ?? "",
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
      youtubeUrl: slot.youtubeUrl ?? "",
      isPublished: slot.isPublished,
      expectedVersion: slot.version,
    });
  }, [slot]);
  const labels = COPY_LABELS[slot.slot] ?? { subtitle: "副標", body: "內文" };
  const name = slot.slot === "HOME_HERO" ? "首頁 Hero" : slot.slot === "HOME_BANNER" ? "首頁 Banner" : slot.title;
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
        <Field label={labels.subtitle}><TextInput value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></Field>
        <Field label={labels.body}><TextArea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field>
        {mode === "media" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="主按鈕文字"><TextInput value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} /></Field>
            <Field label="主按鈕路徑"><TextInput value={form.ctaHref} onChange={(event) => setForm({ ...form, ctaHref: event.target.value })} /></Field>
            <Field label="次按鈕文字"><TextInput value={form.secondaryCtaLabel} onChange={(event) => setForm({ ...form, secondaryCtaLabel: event.target.value })} /></Field>
            <Field label="次按鈕路徑"><TextInput value={form.secondaryCtaHref} onChange={(event) => setForm({ ...form, secondaryCtaHref: event.target.value })} /></Field>
          </div>
        ) : null}
        <Field label="YouTube 連結" hint="貼上 youtube.com 或 youtu.be 的影片網址。留白表示這一頁不放影片。"><TextInput value={form.youtubeUrl} placeholder="https://www.youtube.com/watch?v=" onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />發布</label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">儲存</Button>
          <label className="btn rounded-md px-4 py-2 text-sm">
            上傳圖片
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
        {slot.imageUrl ? <img src={slot.imageUrl} alt="" className="mt-3 h-36 w-full rounded-md object-cover" /> : <p className="text-sm text-[var(--muted)]">還沒有圖片。</p>}
        {message ? <p className="text-sm">{message}</p> : null}
      </form>
    </Card>
  );
}

const ENTRY_FIELDS: Record<EditorialKind, { title: string; summary?: string; body: string; note?: string; group?: boolean; date?: boolean; slug?: boolean; order?: boolean }> = {
  HOME_POINT: { title: "標題", body: "說明", order: true },
  ABOUT_FACT: { title: "標籤", body: "內容", order: true },
  NEWS: { title: "標題", summary: "摘要", body: "內文", date: true, slug: true },
  VERIFICATION_STEP: { title: "步驟", body: "說明", order: true },
  FEE: { title: "項目", summary: "計費", body: "金額", note: "退費", slug: true, order: true },
  FAQ: { title: "問題", body: "答案", group: true, order: true },
  EMAIL_DRAFT: { title: "主旨", summary: "寄送時機", body: "內文", order: true },
};

function EntryDesk({ kind, entries, onChanged }: { kind: EditorialKind; entries: AdminEditorialEntry[]; onChanged: () => Promise<void> }) {
  const mine = entries.filter((item) => item.kind === kind).sort((a, b) => (b.publishedOn ?? "").localeCompare(a.publishedOn ?? "") || a.sortOrder - b.sortOrder);
  const [picked, setPicked] = useState<string | "new" | null>(null);
  const active = picked ?? mine[0]?.id ?? "new";
  const selected = mine.find((item) => item.id === active) ?? null;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-2">
        <button type="button" className={`btn w-full rounded-md px-3 py-2 text-left text-sm ${active === "new" ? "is-selected" : ""}`} aria-pressed={active === "new"} onClick={() => setPicked("new")}>新增</button>
        <div className="max-h-[28rem] space-y-2 overflow-auto">
          {mine.map((item) => (
            <button key={item.id} type="button" className={`btn block w-full rounded-md px-3 py-2 text-left text-sm ${active === item.id ? "is-selected" : ""}`} aria-pressed={active === item.id} onClick={() => setPicked(item.id)}>
              <span className="block font-medium">{item.title}</span>
              <span className="block text-[var(--muted)]">{item.publishedOn || item.groupLabel || (item.isPublished ? "發布中" : "未發布")}</span>
            </button>
          ))}
        </div>
      </div>
      <EntryForm key={`${kind}-${active}`} kind={kind} entry={active === "new" ? null : selected} onSaved={async (id) => { setPicked(id); await onChanged(); }} onDeleted={async () => { setPicked("new"); await onChanged(); }} />
    </div>
  );
}

function EntryForm({ kind, entry, onSaved, onDeleted }: { kind: EditorialKind; entry: AdminEditorialEntry | null; onSaved: (id: string) => Promise<void>; onDeleted: () => Promise<void> }) {
  const services = useServices();
  const fields = ENTRY_FIELDS[kind];
  const [form, setForm] = useState<EditorialWrite>({
    kind,
    slug: entry?.slug ?? "",
    groupLabel: entry?.groupLabel ?? (kind === EditorialKind.FAQ ? "申請" : ""),
    title: entry?.title ?? "",
    summary: entry?.summary ?? "",
    body: entry?.body ?? "",
    note: entry?.note ?? "",
    youtubeUrl: entry?.youtubeUrl ?? "",
    publishedOn: entry?.publishedOn ?? (fields.date ? new Date().toISOString().slice(0, 10) : null),
    sortOrder: entry?.sortOrder ?? 1,
    isPublished: entry?.isPublished ?? true,
  });
  const [message, setMessage] = useState("");
  async function save() {
    const slug = fields.slug ? form.slug : entry?.slug || `item-${crypto.randomUUID().slice(0, 8)}`;
    const payload: EditorialWrite = { ...form, kind, slug, publishedOn: fields.date ? form.publishedOn : null, groupLabel: fields.group ? form.groupLabel : "", summary: fields.summary ? form.summary : "", note: fields.note ? form.note : "" };
    try {
      if (entry) {
        const update: EditorialUpdate = { ...payload, expectedVersion: entry.version };
        const saved = await services.updateEntry(entry.id, update);
        setMessage("已儲存");
        await onSaved(saved.id);
      } else {
        const saved = await services.createEntry(payload);
        setMessage("已新增");
        await onSaved(saved.id);
      }
    } catch (error) {
      setMessage(error instanceof ClientError ? error.message : "儲存失敗");
    }
  }
  return (
    <Card className="space-y-3">
      <h2 className="text-xl">{entry ? entry.title : "新增"}</h2>
      {fields.slug ? <Field label="代碼" hint="小寫英文、數字與連字號。消息的網址會用這個代碼，建立後不能改。"><TextInput value={form.slug} disabled={Boolean(entry)} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field> : null}
      {fields.date ? <Field label="日期"><TextInput type="date" value={form.publishedOn ?? ""} onChange={(event) => setForm({ ...form, publishedOn: event.target.value || null })} /></Field> : null}
      {fields.group ? <Field label="分類"><TextInput value={form.groupLabel} onChange={(event) => setForm({ ...form, groupLabel: event.target.value })} /></Field> : null}
      <Field label={fields.title}><TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
      {fields.summary ? <Field label={fields.summary}><TextInput value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field> : null}
      <Field label={fields.body}><TextArea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field>
      {kind === EditorialKind.NEWS ? (
        <>
          <Field label="YouTube 連結" hint="貼上 youtube.com 或 youtu.be 的影片網址。留白表示這篇文章不放影片。">
            <TextInput value={form.youtubeUrl} placeholder="https://www.youtube.com/watch?v=" onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })} />
          </Field>
          {entry ? (
            <div>
              <label className="btn inline-block cursor-pointer rounded-md px-3 py-2 text-sm">上傳圖片
                <input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const saved = await services.uploadEntryImage(entry.id, file);
                    setMessage("已更換圖片");
                    await onSaved(saved.id);
                  } catch (error) {
                    setMessage(error instanceof ClientError ? error.message : "上傳失敗");
                  }
                }} />
              </label>
              {entry.imageUrl ? <img src={entry.imageUrl} alt="" className="mt-3 h-48 w-full rounded-md object-cover" /> : <p className="mt-2 text-sm text-[var(--muted)]">還沒有圖片。</p>}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">先儲存文章，再上傳圖片。</p>}
        </>
      ) : null}
      {fields.note ? <Field label={fields.note}><TextInput value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field> : null}
      {fields.order ? <Field label="排序"><TextInput type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></Field> : null}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />發布</label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()}>儲存</Button>
        {entry ? <Button variant="danger" onClick={async () => { try { await services.deleteEntry(entry.id); await onDeleted(); } catch (error) { setMessage(error instanceof ClientError ? error.message : "刪除失敗"); } }}>刪除</Button> : null}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
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
  const [panel, setPanel] = useState<"template" | "issue" | "records">("records");
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
    <div className="space-y-4">
      <PageHeader eyebrow="內部後台" title="合約管理" lede="用上方切換範本、發出與單份合約。待簽署的可以改這一份；簽署後的 PDF 保留簽署當下的內容。" />
      <SectionNav items={[{ id: "records", label: "已發出" }, { id: "issue", label: "發給業者" }, { id: "template", label: "合約範本" }]} value={panel} onChange={(id) => setPanel(id as "template" | "issue" | "records")} />
      {panel === "template" && template.data ? (
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
      {panel === "issue" ? <Card>
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
      </Card> : null}
      {panel === "records" ? <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="max-h-[32rem] space-y-2 overflow-auto">
        {contracts.data?.map((item) => (
          <button key={item.id} type="button" className={`btn block w-full rounded-lg p-3 text-left ${selected === item.id ? "is-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span className="block font-medium">{item.contractNo}</span>
            <span className="block text-sm text-[var(--muted)]">{item.organizationName} · {item.status === "SIGNED" ? "已簽署" : item.status === "VOID" ? "已作廢" : "待簽署"}</span>
          </button>
        ))}
        {(contracts.data?.length ?? 0) === 0 ? <p className="text-sm text-[var(--muted)]">還沒有發出的合約。</p> : null}
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
      ) : <p className="text-sm text-[var(--muted)]">{selected ? "載入合約中…" : "從左邊選一份合約。"}</p>}
      </div> : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function ReportsPage() {
  const services = useServices();
  const [part, setPart] = useState("built");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="內部後台" title="報表" lede="既有報表維持原樣。自訂報表可以同時勾選案件、業者、訓練報名和合約，存下來之後在畫面上看表格、長條圖或圓餅圖。" />
      <SectionNav items={[{ id: "built", label: "既有報表" }, { id: "custom", label: "自訂報表" }]} value={part} onChange={setPart} />
      {part === "built" ? (
        <>
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
        </>
      ) : <CustomReports />}
    </div>
  );
}

function emptyPicked(): Record<ReportSource, string[]> {
  return { APPLICATION: [], ORGANIZATION: [], ENROLLMENT: [], CONTRACT: [] };
}

function pickedFrom(report: SavedReport | null) {
  const picked = emptyPicked();
  for (const selection of report?.selections ?? []) picked[selection.source] = [...selection.fieldKeys];
  return picked;
}

function selectionsFrom(picked: Record<ReportSource, string[]>) {
  return REPORT_SOURCES.map((item) => ({ source: item.key, fieldKeys: picked[item.key] })).filter((item) => item.fieldKeys.length > 0);
}

function CustomReports() {
  const services = useServices();
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ["saved-reports"], queryFn: () => services.savedReports() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState<ReportSource>("APPLICATION");
  const [picked, setPicked] = useState(emptyPicked);
  const [chartKind, setChartKind] = useState<SavedReport["chartKind"]>("table");
  const [chartField, setChartField] = useState("");
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selections = selectionsFrom(picked);
  const preview = useQuery({
    queryKey: ["report-preview", selections],
    queryFn: () => services.previewReport({ selections }),
    enabled: selections.length > 0,
  });
  const fields = reportFieldsFor(source);
  const fieldOptions = selections.flatMap((selection) => selection.fieldKeys.map((key) => {
    const field = reportFieldsFor(selection.source).find((item) => item.key === key);
    return { id: reportFieldId(selection.source, key), label: `${sourceLabel(selection.source)}／${field?.label ?? key}` };
  }));

  function load(report: SavedReport | null) {
    setSelectedId(report?.id ?? null);
    setName(report?.name ?? "");
    setPicked(pickedFrom(report));
    setChartKind(report?.chartKind ?? "table");
    setChartField(report?.chartField ?? "");
    setVersion(report?.version);
    setSaved(report);
    setMessage("");
    setError("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!name.trim() || selections.length === 0) {
      setError("請填名稱，並至少在一個來源勾選欄位");
      return;
    }
    const field = fieldOptions.some((option) => option.id === chartField) ? chartField : (fieldOptions[0]?.id ?? "");
    try {
      const next = await services.saveReport({ name, selections, chartKind, chartField: field, expectedVersion: version }, selectedId ?? undefined);
      setSelectedId(next.id);
      setVersion(next.version);
      setChartField(next.chartField);
      setSaved(next);
      setMessage("已儲存。離開這一頁再回來，欄位和圖表還在。");
      await queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.message : "儲存失敗");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        <Button onClick={() => load(null)}>新增報表</Button>
        {(reports.data ?? []).map((report) => (
          <button key={report.id} className={`btn block w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === report.id ? "is-selected" : ""}`} type="button" onClick={() => load(report)}>
            {report.name}
          </button>
        ))}
        {reports.data?.length === 0 ? <p className="text-sm text-[var(--muted)]">還沒有自訂報表。</p> : null}
      </div>
      <div className="space-y-4">
        <Card className="space-y-4">
          <Field label="報表名稱"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <SectionNav
            items={REPORT_SOURCES.map((item) => ({ id: item.key, label: picked[item.key].length ? `${item.label}（${picked[item.key].length}）` : item.label }))}
            value={source}
            onChange={(next) => setSource(next as ReportSource)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked[source].includes(field.key)}
                  onChange={(event) => setPicked((current) => ({
                    ...current,
                    [source]: event.target.checked ? [...current[source], field.key] : current[source].filter((key) => key !== field.key),
                  }))}
                />
                {field.label}
              </label>
            ))}
          </div>
          <p className="text-sm text-[var(--muted)]">換到下一個來源時，前面勾過的欄位會留著。密碼、登入憑證、簽名圖檔與合約全文不能選。案件只包含這個帳號看得到的案件。</p>
          {error ? <ErrorText message={error} /> : null}
          {message ? <p className="text-sm">{message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()}>儲存</Button>
            <Button disabled={!saved} onClick={async () => { if (!saved) return; downloadText(`${saved.name}.csv`, await services.exportReport(saved.id)); }}>下載 CSV</Button>
            <Button variant="danger" disabled={!saved} onClick={async () => {
              if (!saved) return;
              await services.deleteReport(saved.id);
              load(null);
              await queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
            }}>刪除</Button>
          </div>
        </Card>
        <ReportView
          preview={selections.length ? preview.data : undefined}
          loading={preview.isFetching}
          failed={preview.error instanceof ClientError ? preview.error.message : preview.error ? "無法顯示報表" : ""}
          chartKind={chartKind}
          chartField={fieldOptions.some((option) => option.id === chartField) ? chartField : (fieldOptions[0]?.id ?? "")}
          fieldOptions={fieldOptions}
          onChartKind={setChartKind}
          onChartField={setChartField}
        />
      </div>
    </div>
  );
}

const CHART_COLORS = ["#1f6eae", "#6aafe6", "#0c4f86", "#2f7d6d", "#a56b2a", "#6b4c9a", "#9a4d55", "#8ec0e4"];

function compactPoints(points: Array<{ label: string; count: number }>, limit: number) {
  if (points.length <= limit) return points;
  const rest = points.slice(limit).reduce((sum, point) => sum + point.count, 0);
  return [...points.slice(0, limit), { label: "其他", count: rest }];
}

function ReportView({
  preview,
  loading,
  failed,
  chartKind,
  chartField,
  fieldOptions,
  onChartKind,
  onChartField,
}: {
  preview?: ReportPreview;
  loading: boolean;
  failed: string;
  chartKind: SavedReport["chartKind"];
  chartField: string;
  fieldOptions: Array<{ id: string; label: string }>;
  onChartKind: (kind: SavedReport["chartKind"]) => void;
  onChartField: (field: string) => void;
}) {
  const [source, fieldKey] = chartField.split(".");
  const section = preview?.sections.find((item) => item.source === source);
  const group = section?.groups.find((item) => item.fieldKey === fieldKey);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionNav items={[{ id: "table", label: "表格" }, { id: "bar", label: "長條圖" }, { id: "pie", label: "圓餅圖" }]} value={chartKind} onChange={(next) => onChartKind(next as SavedReport["chartKind"])} />
        {chartKind === "table" ? null : (
          <Field label="統計欄位">
            <SelectInput value={chartField} onChange={(event) => onChartField(event.target.value)}>
              {fieldOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </SelectInput>
          </Field>
        )}
      </div>
      {failed ? <ErrorText message={failed} /> : null}
      {loading && !preview ? <p className="text-sm">載入報表…</p> : null}
      {!preview && !loading ? <p className="text-sm text-[var(--muted)]">勾選欄位後，這裡會顯示現有資料。</p> : null}
      {preview && chartKind === "table" ? preview.sections.map((item) => (
        <div key={item.source} className="space-y-2">
          <h2 className="text-base font-medium">{item.label}</h2>
          <p className="text-sm text-[var(--muted)]">共 {item.total} 筆{item.total > item.rows.length ? `，畫面顯示前 ${item.rows.length} 筆` : ""}。</p>
          <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>{item.columns.map((column) => <th key={column.key} className="p-3 font-medium">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {item.rows.map((row, index) => (
                  <tr key={`${item.source}-${index}`} className="border-t border-[var(--line)]">
                    {item.columns.map((column) => <td key={column.key} className="p-3">{row[column.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : null}
      {preview && chartKind !== "table" && group ? <CountChart kind={chartKind} title={fieldOptions.find((option) => option.id === chartField)?.label ?? group.label} points={group.points} /> : null}
    </Card>
  );
}

function CountChart({ kind, title, points }: { kind: "bar" | "pie"; title: string; points: Array<{ label: string; count: number }> }) {
  const shown = compactPoints(points, kind === "pie" ? 8 : 12);
  const total = shown.reduce((sum, point) => sum + point.count, 0);
  if (!total) return <p className="text-sm text-[var(--muted)]">這個欄位目前沒有資料。</p>;
  if (kind === "bar") {
    const max = Math.max(...shown.map((point) => point.count));
    return (
      <div className="space-y-3">
        <h2 className="text-base font-medium">{title}</h2>
        {shown.map((point) => (
          <div key={point.label} className="grid items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_3rem]">
            <span className="truncate">{point.label}</span>
            <div className="h-3 rounded-full bg-[var(--panel)]">
              <div className="h-3 rounded-full bg-[var(--accent-deep)]" style={{ width: `${(point.count / max) * 100}%` }} />
            </div>
            <span>{point.count}</span>
          </div>
        ))}
      </div>
    );
  }
  let cursor = 0;
  const stops = shown.map((point, index) => {
    const start = cursor;
    cursor += (point.count / total) * 100;
    return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium">{title}</h2>
      <div className="flex flex-wrap items-center gap-6">
        <div className="h-48 w-48 rounded-full border border-[var(--line)]" style={{ background: `conic-gradient(${stops.join(",")})` }} />
        <ul className="space-y-2 text-sm">
          {shown.map((point, index) => (
            <li key={point.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span>{point.label}</span>
              <span className="text-[var(--muted)]">{point.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeatureChecks({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {STAFF_FEATURES.map((feature) => {
        const checked = selected.includes(feature.key);
        return (
          <label key={feature.key} className={`btn flex items-center gap-2 rounded-md px-3 py-2 text-sm ${checked ? "is-selected" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(event.target.checked ? [...selected, feature.key] : selected.filter((key) => key !== feature.key))}
            />
            {feature.label}
          </label>
        );
      })}
    </div>
  );
}

export function PermissionsPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["access"], queryFn: () => services.accessSettings() });
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("staff");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [integrationKey, setIntegrationKey] = useState("");
  const [form, setForm] = useState({ email: "", displayName: "", password: "", features: [] as string[] });
  const accounts = (query.data?.accounts ?? []).filter((account) => `${account.displayName} ${account.email}`.toLowerCase().includes(keyword.trim().toLowerCase()));
  const selected = accounts.find((account) => account.id === selectedId) ?? query.data?.accounts.find((account) => account.id === selectedId);
  const integration = query.data?.integrations.find((item) => item.key === integrationKey) ?? query.data?.integrations[0];
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="內部後台" title="員工" lede="這裡只管理公司員工。建立帳號時一併勾選這個人能用的功能。業者請用前台註冊，功能固定，不會出現在這份名單。" />
      <SectionNav items={[{ id: "staff", label: "員工與權限" }, { id: "integrations", label: "串接" }]} value={tab} onChange={setTab} />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入設定"} /> : null}
      {tab === "staff" && query.data ? (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2 lg:sticky lg:top-4">
            <TextInput placeholder="搜尋姓名或 Email" value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label="搜尋員工" />
            <button type="button" className={`btn w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === "new" ? "is-selected" : ""}`} aria-pressed={selectedId === "new"} onClick={() => setSelectedId("new")}>新增員工</button>
            <div className="max-h-[28rem] space-y-2 overflow-auto">
              {accounts.map((account) => (
                <button key={account.id} type="button" className={`btn block w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === account.id ? "is-selected" : ""}`} aria-pressed={selectedId === account.id} onClick={() => setSelectedId(account.id)}>
                  <span className="block font-medium">{account.displayName}</span>
                  <span className="block text-[var(--muted)]">{account.email}</span>
                </button>
              ))}
              {accounts.length === 0 ? <p className="text-sm text-[var(--muted)]">沒有符合的員工。</p> : null}
            </div>
          </div>
          {selectedId === "new" ? (
            <Card className="space-y-3">
              <h2 className="text-xl">建立員工帳號</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Email"><TextInput value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
                <Field label="名稱"><TextInput value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
                <Field label="密碼"><TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
              </div>
              <FeatureChecks selected={form.features} onChange={(features) => setForm({ ...form, features })} />
              <Button onClick={async () => {
                try {
                  await services.createUser(form);
                  setForm({ email: "", displayName: "", password: "", features: [] });
                  setMessage("已建立員工帳號，並套用勾選的功能");
                  await client.invalidateQueries({ queryKey: ["access"] });
                  await client.invalidateQueries({ queryKey: ["users"] });
                } catch (error) {
                  setMessage(error instanceof ClientError ? error.message : "建立失敗");
                }
              }}>建立帳號</Button>
            </Card>
          ) : selected ? (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{selected.displayName}</h2>
                  <p className="text-sm text-[var(--muted)]">{selected.email} · {selected.isActive ? "啟用" : "停用"}</p>
                </div>
                <Button variant="secondary" onClick={async () => {
                  try {
                    await services.updateUser(selected.id, { isActive: !selected.isActive });
                    setMessage(selected.isActive ? "已停用這個員工" : "已重新啟用");
                    await client.invalidateQueries({ queryKey: ["access"] });
                    await client.invalidateQueries({ queryKey: ["users"] });
                  } catch (error) {
                    setMessage(error instanceof ClientError ? error.message : "更新失敗");
                  }
                }}>{selected.isActive ? "停用" : "啟用"}</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {selected.features.map((feature) => (
                  <label key={feature.featureKey} className={`btn flex items-center gap-2 rounded-md px-3 py-2 text-sm ${feature.enabled ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      aria-label={`${selected.email} ${feature.label}`}
                      onChange={async (event) => {
                        try {
                          await services.updateFeature({ userId: selected.id, featureKey: feature.featureKey, enabled: event.target.checked });
                          setMessage(`已更新 ${selected.email} 的功能`);
                          await client.invalidateQueries({ queryKey: ["access"] });
                          await client.invalidateQueries({ queryKey: ["me"] });
                        } catch (error) {
                          setMessage(error instanceof ClientError ? error.message : "更新失敗");
                        }
                      }}
                    />
                    {feature.label}
                  </label>
                ))}
              </div>
            </Card>
          ) : <p className="text-sm text-[var(--muted)]">從左邊選擇員工，或新增一位。</p>}
        </div>
      ) : null}
      {tab === "integrations" && integration ? (
        <Card key={`${integration.key}-${integration.enabled}-${integration.provider}-${integration.note}`}>
          <SectionNav items={(query.data?.integrations ?? []).map((item) => ({ id: item.key, label: item.label }))} value={integration.key} onChange={setIntegrationKey} />
          <form className="mt-4 space-y-3" onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await services.updateIntegration({
                key: integration.key,
                provider: String(data.get("provider") ?? ""),
                note: String(data.get("note") ?? ""),
                enabled: data.get("enabled") === "on",
              });
              setMessage("串接設定已更新");
              await client.invalidateQueries({ queryKey: ["access"] });
            } catch (error) {
              setMessage(error instanceof ClientError ? error.message : "更新失敗");
            }
          }}>
            <h2 className="text-xl">{integration.label}</h2>
            <Field label="服務方式"><TextInput name="provider" defaultValue={integration.provider} /></Field>
            <Field label="說明"><TextInput name="note" defaultValue={integration.note} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={integration.enabled} />啟用</label>
            <p className="text-sm text-[var(--muted)]">金流沒有服務商金鑰時不會扣款。</p>
            <Button type="submit">儲存這項串接</Button>
          </form>
        </Card>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
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
