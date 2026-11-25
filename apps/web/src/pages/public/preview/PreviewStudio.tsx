import { SITE_BUILTIN_PAGES, SITE_SECTION_STYLES, siteBuiltinPage, siteListWidgetKinds, sitePageKindLabels, siteSectionStyleLabels, siteWidgetStyleOptions, type SiteBuiltinSlug, type SitePageItem, type SitePageKind, type SiteSectionStyle, type SiteWidgetStyle } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useServices } from "../../../app/session";
import { confirmDelete } from "../../../components/ui";
import { ClientError } from "../../../services/types";
import "../../../styles/preview.css";
import "../../../styles/preview-studio.css";
import {
  blankSections,
  blankTable,
  column,
  library,
  listItem,
  move,
  presets,
  safeLink,
  section,
  widget,
  widgetKinds,
  widths,
  type ListItem,
  type Section,
  type Widget,
  type WidgetKind,
  type Width,
} from "./preview-pages";
import { PreviewWidgetBody } from "./preview-widget-view";
import { defaultSections } from "./site-defaults";

type Selection = { kind: "section" | "column" | "widget"; id: string } | null;
type Target = { kind: "fixed"; slug: SiteBuiltinSlug } | { kind: "page"; id: string };
/** id 為 null 表示這一頁還沒存過，畫面是預設版面。base 是載入時的內容，用來判斷有沒有改過。 */
type Working = { id: string | null; slug: string; version: number; name: string; inHeader: boolean; backgroundImage: string; sections: Section[]; base: string };
type Notice = { tone: "ok" | "error"; text: string; stale?: boolean } | null;

const listKey = ["admin-site-pages"];

function snapshot(value: Pick<Working, "name" | "inHeader" | "backgroundImage" | "sections">) {
  return JSON.stringify([value.name, value.inHeader, value.backgroundImage, value.sections]);
}

function fromItem(item: SitePageItem): Working {
  const next = { id: item.id, slug: item.slug, version: item.version, name: item.name, inHeader: item.inHeader, backgroundImage: item.draftBackground, sections: item.draftSections };
  return { ...next, base: snapshot(next) };
}

function fromDefault(slug: SiteBuiltinSlug, site: Parameters<typeof defaultSections>[1]): Working {
  const next = { id: null, slug, version: 0, name: siteBuiltinPage(slug)?.name ?? slug, inHeader: false, backgroundImage: "", sections: defaultSections(slug, site) };
  return { ...next, base: snapshot(next) };
}

function errorText(error: unknown) {
  if (!(error instanceof ClientError)) return "操作失敗，請稍後再試";
  return error.fieldErrors?.[0]?.message ?? error.message;
}

export function SiteStudio() {
  const services = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: listKey, queryFn: () => services.adminSitePages() });
  const site = useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
  const pages = list.data ?? [];
  const [searchParams] = useSearchParams();
  const [target, setTarget] = useState<Target>(() => {
    const fixed = SITE_BUILTIN_PAGES.find((item) => item.slug === searchParams.get("page"));
    return { kind: "fixed", slug: fixed?.slug ?? "home" };
  });
  const [working, setWorking] = useState<Working | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [adding, setAdding] = useState<WidgetKind>("text");
  const [overId, setOverId] = useState<string | null>(null);
  const [showPages, setShowPages] = useState(() => !window.matchMedia("(max-width: 980px)").matches);
  const [showInspector, setShowInspector] = useState(true);
  const [frame, setFrame] = useState<"desktop" | "tablet" | "phone">("desktop");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [sheetWidth, setSheetWidth] = useState(0);
  const sheetObserver = useRef<ResizeObserver | null>(null);
  const measureSheet = (node: HTMLDivElement | null) => {
    sheetObserver.current?.disconnect();
    if (!node) return;
    sheetObserver.current = new ResizeObserver(([entry]) => setSheetWidth(entry?.contentRect.width ?? 0));
    sheetObserver.current.observe(node);
  };
  const headerCollapsed = frame !== "desktop" || (sheetWidth > 0 && sheetWidth < 900);
  useEffect(() => setHeaderMenuOpen(false), [frame]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ kind: "page" | "section" | "widget"; id: string; columnId: string } | null>(null);

  const record = recordFor(target);
  const fixedInfo = target.kind === "fixed" ? siteBuiltinPage(target.slug) : record ? siteBuiltinPage(record.slug) : undefined;
  const dirty = Boolean(working && snapshot(working) !== working.base);

  useEffect(() => {
    if (list.isLoading || site.isLoading) return;
    setWorking((current) => {
      if (record) {
        if (current?.id === record.id && current.version >= record.version) return current;
        return fromItem(record);
      }
      if (target.kind === "fixed") return current?.id === null && current.slug === target.slug ? current : fromDefault(target.slug, site.data);
      return null;
    });
  }, [record, target, list.isLoading, site.isLoading, site.data]);

  useEffect(() => {
    const previous = document.title;
    document.title = "頁面編輯 · MuslimTW";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function remember(saved: SitePageItem) {
    queryClient.setQueryData<SitePageItem[]>(listKey, (old) => {
      const rows = old ?? [];
      return rows.some((item) => item.id === saved.id) ? rows.map((item) => item.id === saved.id ? saved : item) : [...rows, saved];
    });
    setWorking(fromItem(saved));
    void queryClient.invalidateQueries({ queryKey: ["site-pages"] });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error), stale: error instanceof ClientError && error.status === 409 });
    } finally {
      setBusy(false);
    }
  }

  function recordFor(next: Target) {
    if (next.kind === "page") return pages.find((item) => item.id === next.id);
    return pages.find((item) => item.slug === next.slug);
  }

  function open(next: Target) {
    if (dirty && !window.confirm("這一頁還沒儲存，要放棄修改嗎？")) return;
    const nextRecord = recordFor(next);
    setWorking(nextRecord ? fromItem(nextRecord) : next.kind === "fixed" ? fromDefault(next.slug, site.data) : null);
    setTarget(next);
    setSelection(null);
    setNotice(null);
    if (window.matchMedia("(max-width: 980px)").matches) setShowPages(false);
  }

  function updateSections(recipe: (sections: Section[]) => Section[]) {
    setWorking((current) => current ? { ...current, sections: recipe(current.sections) } : current);
  }

  function updateSection(sectionId: string, recipe: (section: Section) => Section) {
    updateSections((sections) => sections.map((item) => item.id === sectionId ? recipe(item) : item));
  }

  async function saveDraft() {
    if (!working) return null;
    const saved = working.id === null
      ? await services.createSitePage({ slug: working.slug, name: working.name, kind: "PAGE", inHeader: false, backgroundImage: working.backgroundImage, sections: working.sections })
      : await services.updateSitePage(working.id, { expectedVersion: working.version, name: working.name, inHeader: working.inHeader, backgroundImage: working.backgroundImage, sections: working.sections });
    remember(saved);
    return saved;
  }

  if (list.isLoading || site.isLoading) return <p className="studio-loading">載入中…</p>;
  if (list.error) return <p className="studio-loading" role="alert">頁面清單載入失敗：{errorText(list.error)}</p>;
  if (site.error) return <p className="studio-loading" role="alert">網站內容載入失敗：{errorText(site.error)}</p>;

  const customPages = pages.filter((item) => !item.builtin);
  const headerNames = [...SITE_BUILTIN_PAGES.map((item) => item.name), ...customPages.filter((item) => item.inHeader && item.publishedAt).map((item) => item.name)];
  const sections = working?.sections ?? [];

  function locatedWidget(widgetId: string) {
    for (const entry of sections) {
      for (const col of entry.columns) {
        const found = col.widgets.find((item) => item.id === widgetId);
        if (found) return { section: entry, column: col, widget: found };
      }
    }
    return null;
  }

  function locatedColumn(columnId: string) {
    for (const entry of sections) {
      const found = entry.columns.find((item) => item.id === columnId);
      if (found) return { section: entry, column: found };
    }
    return null;
  }

  function applyPreset(sectionId: string, layout: Width[]) {
    updateSection(sectionId, (current) => {
      const kept = current.columns.map((item) => item.widgets);
      return { ...current, columns: layout.map((width, index) => column(width, kept[index] ?? [widget("text")])) };
    });
  }

  function dropSection(targetId: string) {
    const source = drag.current;
    if (!source || source.kind !== "section" || source.id === targetId) return;
    const from = sections.findIndex((item) => item.id === source.id);
    const to = sections.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    updateSections((current) => move(current, from, to));
    drag.current = null;
    setOverId(null);
  }

  function dropWidget(targetColumnId: string, targetWidgetId?: string) {
    const source = drag.current;
    if (!source || source.kind !== "widget") return;
    const fromColumn = sections.flatMap((item) => item.columns).find((item) => item.id === source.columnId);
    const widgetItem = fromColumn?.widgets.find((item) => item.id === source.id);
    if (!fromColumn || !widgetItem) return;
    updateSections((current) => current.map((entry) => ({
      ...entry,
      columns: entry.columns.map((col) => {
        let widgets = col.widgets.filter((item) => item.id !== source.id);
        if (col.id === targetColumnId) {
          const index = targetWidgetId ? widgets.findIndex((item) => item.id === targetWidgetId) : widgets.length;
          const at = index < 0 ? widgets.length : index;
          widgets = [...widgets.slice(0, at), widgetItem, ...widgets.slice(at)];
        }
        return { ...col, widgets };
      }),
    })));
    drag.current = null;
    setOverId(null);
  }

  async function dropPage(targetId: string) {
    const source = drag.current;
    drag.current = null;
    setOverId(null);
    if (!source || source.kind !== "page" || source.id === targetId) return;
    const from = customPages.findIndex((item) => item.id === source.id);
    const to = customPages.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = move(customPages, from, to);
    await run(async () => {
      const saved = await services.reorderSitePages({ items: next.map((item) => ({ id: item.id, expectedVersion: item.version })) });
      queryClient.setQueryData(listKey, saved);
      void queryClient.invalidateQueries({ queryKey: ["site-pages"] });
      setNotice({ tone: "ok", text: "頁首順序已更新" });
    });
  }

  async function addPage(kind: SitePageKind) {
    const name = newName.trim() || (kind === "PRODUCT" ? "新商品頁" : "新頁面");
    await run(async () => {
      const created = await services.createSitePage({ slug: newSlug.trim(), name, kind, inHeader: true, sections: blankSections(kind, name) });
      remember(created);
      setTarget({ kind: "page", id: created.id });
      setSelection(null);
      setNewName("");
      setNewSlug("");
      setNotice({ tone: "ok", text: `已新增「${created.name}」，網址 ${created.path}。發布後才會出現在前台。` });
    });
  }

  const selectedSection = sections.find((item) => selection?.kind === "section" && item.id === selection.id)
    ?? (selection?.kind === "column" ? locatedColumn(selection.id)?.section : null)
    ?? (selection?.kind === "widget" ? locatedWidget(selection.id)?.section : null)
    ?? null;
  const selectedColumn = selection?.kind === "column" ? locatedColumn(selection.id) : selection?.kind === "widget" ? locatedColumn(locatedWidget(selection.id)?.column.id ?? "") : null;
  const selectedWidget = selection?.kind === "widget" ? locatedWidget(selection.id) : null;
  const status = !record
    ? (dirty ? "有未儲存的修改" : "前台目前就是這個版面")
    : !record.publishedAt
      ? (fixedInfo ? "草稿未發布 · 前台仍是發布前的版面" : "未發布")
      : dirty || record.hasUnpublishedChanges ? "有未發布的修改" : "已發布";
  const title = working?.name ?? fixedInfo?.name ?? "頁面";
  const livePath = fixedInfo?.path ?? (record?.publishedAt ? record.path : undefined);

  return (
    <div className={`studio${showPages ? "" : " is-pages-collapsed"}${showInspector ? "" : " is-inspector-collapsed"}`}>
      <aside className="studio-side">
        <button className="studio-collapse" type="button" aria-expanded={showPages} onClick={() => setShowPages((value) => !value)}>{showPages ? "收合頁面" : "頁面"}</button>
        <img src="/preview/logo.png" alt="MuslimTW" />
        <p>草稿只有後台看得到。按「發布」後前台才會換成新內容。</p>
        <p className="studio-side-title">網站頁面</p>
        <nav aria-label="網站頁面">
          {SITE_BUILTIN_PAGES.map((item) => {
            const own = pages.find((row) => row.slug === item.slug);
            const current = own ? record?.id === own.id : target.kind === "fixed" && target.slug === item.slug;
            return (
              <div key={item.slug} className="studio-page-row">
                <span className="studio-grip" aria-hidden="true" />
                <button type="button" aria-current={current ? "page" : undefined} onClick={() => open({ kind: "fixed", slug: item.slug })}>{item.name}</button>
                <span className="studio-tags">{own ? (own.publishedAt ? (own.hasUnpublishedChanges ? "有草稿" : "已發布") : "草稿") : item.path}</span>
              </div>
            );
          })}
        </nav>
        <p className="studio-side-title">自訂頁（可拖曳排序）</p>
        <nav aria-label="自訂頁">
          {customPages.length === 0 ? <p className="studio-help">還沒有自訂頁。</p> : customPages.map((item) => (
            <div
              key={item.id}
              className={`studio-page-row${item.id === overId ? " is-over" : ""}`}
              onDragOver={(event) => {
                if (drag.current?.kind !== "page") return;
                event.preventDefault();
                setOverId(item.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                void dropPage(item.id);
              }}
            >
              <span className="studio-grip" draggable aria-label={`搬移${item.name}`} onDragStart={() => { drag.current = { kind: "page", id: item.id, columnId: "" }; }}>⋮⋮</span>
              <button type="button" aria-current={record?.id === item.id ? "page" : undefined} onClick={() => open({ kind: "page", id: item.id })}>{item.name}</button>
              <span className="studio-tags">{item.publishedAt ? (item.inHeader ? "頁首" : "已發布") : "未發布"}{item.kind === "PRODUCT" ? " · 商品" : ""}</span>
            </div>
          ))}
        </nav>
        <label className="studio-side-field">新頁面名稱<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="例如：交通資訊" /></label>
        <label className="studio-side-field">網址代碼<input value={newSlug} onChange={(event) => setNewSlug(event.target.value.toLowerCase())} placeholder="例如：transport" /></label>
        <p className="studio-help">網址會是 /p/代碼；只能用小寫英文、數字與連字號。</p>
        <div className="studio-side-actions">
          <button type="button" disabled={busy} onClick={() => void addPage("PAGE")}>加入一般頁</button>
          <button type="button" disabled={busy} onClick={() => void addPage("PRODUCT")}>加入商品內頁</button>
        </div>
        <p><Link to="/admin">回後台</Link></p>
      </aside>
      <main className="studio-main">
        <header className="studio-top">
          <div>
            <p className="pv-kicker">{status}{record?.updatedByName ? ` · 最後編輯 ${record.updatedByName}` : ""}</p>
            <h1>{title}</h1>
          </div>
          <div className="studio-actions">
            <div className="studio-choice" role="group" aria-label="預覽寬度">
              <button type="button" aria-pressed={frame === "desktop"} onClick={() => setFrame("desktop")}>電腦</button>
              <button type="button" aria-pressed={frame === "tablet"} onClick={() => setFrame("tablet")}>平板</button>
              <button type="button" aria-pressed={frame === "phone"} onClick={() => setFrame("phone")}>手機</button>
            </div>
            {livePath ? <a href={livePath} target="_blank" rel="noreferrer">看前台這一頁</a> : null}
            {working ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const created = section("新區塊", ["1/2", "1/2"]);
                    updateSections((current) => [...current, created]);
                    setSelection({ kind: "section", id: created.id });
                  }}
                >
                  加入區塊
                </button>
                <button type="button" disabled={busy || !dirty} onClick={() => void run(async () => { await saveDraft(); setNotice({ tone: "ok", text: "草稿已儲存，前台還沒有改變" }); })}>儲存草稿</button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={busy || (record ? !dirty && !record.hasUnpublishedChanges : false)}
                  onClick={() => void run(async () => {
                    const base = dirty || !record ? await saveDraft() : record;
                    if (!base) return;
                    remember(await services.publishSitePage(base.id, base.version));
                    setNotice({ tone: "ok", text: "已發布，前台已換成這個版本" });
                  })}
                >
                  發布
                </button>
              </>
            ) : null}
          </div>
        </header>
        {notice ? <p className={`studio-notice is-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}{notice.stale ? <> <button type="button" onClick={() => { void list.refetch(); setNotice(null); }}>重新載入</button></> : null}</p> : null}
        <div className="studio-scroll">
          {!working ? (
            <p className="studio-help">載入中…</p>
          ) : (
            <div ref={measureSheet} className={`studio-frame is-${frame}`}>
              <div className="pv studio-sheet pv-build" style={working.backgroundImage ? { backgroundImage: `linear-gradient(rgba(244, 239, 230, 0.88), rgba(244, 239, 230, 0.92)), url(${JSON.stringify(working.backgroundImage)})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "local" } : undefined}>
                <div className={`studio-site-header${headerCollapsed ? " is-collapsed" : ""}`}>
                  <strong>MuslimTW</strong>
                  {headerCollapsed ? (
                    <button type="button" className="studio-site-menu" aria-expanded={headerMenuOpen} aria-label={headerMenuOpen ? "關閉選單" : "打開選單"} onClick={() => setHeaderMenuOpen((value) => !value)}>
                      <span aria-hidden="true"><i /><i /><i /></span>
                    </button>
                  ) : null}
                  {!headerCollapsed || headerMenuOpen ? (
                    <nav aria-label="頁首示意">
                      {headerNames.map((name) => <span key={name}>{name}</span>)}
                      {!fixedInfo && working.inHeader && !record?.publishedAt ? <span>{working.name}（發布後）</span> : null}
                      <span className="studio-site-login">業者登入</span>
                    </nav>
                  ) : null}
                </div>
                <p className="studio-banner">下面是草稿。隱藏的區塊不會出現在前台。手機寬度時直欄改成上下排。</p>
                {sections.length === 0 ? <p className="studio-help">這一頁還沒有區塊，按上方「加入區塊」。</p> : null}
                {sections.map((entry, index) => (
                  <section
                    key={entry.id}
                    className={`studio-block${selectedSection?.id === entry.id ? " is-selected" : ""}${entry.id === overId ? " is-over" : ""}${entry.hidden ? " studio-hidden" : ""}`}
                    onDragOver={(event) => {
                      if (drag.current?.kind !== "section") return;
                      event.preventDefault();
                      setOverId(entry.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropSection(entry.id);
                    }}
                  >
                    <div
                      className="studio-block-bar"
                      draggable
                      onDragStart={() => { drag.current = { kind: "section", id: entry.id, columnId: "" }; setSelection({ kind: "section", id: entry.id }); }}
                      onClick={() => setSelection({ kind: "section", id: entry.id })}
                    >
                      <span>⋮⋮ {entry.name || "區塊"} · {entry.columns.map((item) => item.width).join(" + ")}{entry.style ? ` · ${siteSectionStyleLabels[entry.style]}` : ""}{entry.hidden ? " · 已隱藏" : ""}</span>
                      <span>
                        <button type="button" onClick={() => updateSections((current) => move(current, index, Math.max(0, index - 1)))}>上移</button>
                        <button type="button" onClick={() => updateSections((current) => move(current, index, Math.min(current.length - 1, index + 1)))}>下移</button>
                        <button type="button" onClick={() => updateSection(entry.id, (current) => ({ ...current, hidden: !current.hidden }))}>{entry.hidden ? "顯示" : "隱藏"}</button>
                      </span>
                    </div>
                    <div className="studio-columns pv-build-columns">
                      {entry.columns.map((col) => (
                        <div
                          key={col.id}
                          className={`studio-column pv-build-column${selectedColumn?.column.id === col.id ? " is-selected" : ""}`}
                          data-width={col.width}
                          onDragOver={(event) => {
                            if (drag.current?.kind !== "widget") return;
                            event.preventDefault();
                            setOverId(col.id);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            dropWidget(col.id);
                          }}
                        >
                          <button type="button" className="studio-column-label" onClick={() => setSelection({ kind: "column", id: col.id })}>{col.width}</button>
                          {col.widgets.map((item) => (
                            <article
                              key={item.id}
                              className={`studio-widget${selectedWidget?.widget.id === item.id ? " is-selected" : ""}${item.hidden ? " studio-hidden" : ""}${item.id === overId ? " is-over" : ""}`}
                              onClick={() => setSelection({ kind: "widget", id: item.id })}
                              onDragOver={(event) => {
                                if (drag.current?.kind !== "widget") return;
                                event.preventDefault();
                                event.stopPropagation();
                                setOverId(item.id);
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                dropWidget(col.id, item.id);
                              }}
                            >
                              <span
                                className="studio-grip"
                                draggable
                                aria-label={`搬移${item.title}`}
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  drag.current = { kind: "widget", id: item.id, columnId: col.id };
                                }}
                              >
                                ⋮⋮
                              </span>
                              <PreviewWidgetBody item={item} linkable={false} />
                            </article>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <aside className="studio-inspector">
        <button className="studio-collapse" type="button" aria-expanded={showInspector} onClick={() => setShowInspector((value) => !value)}>{showInspector ? "收合設定" : "設定"}</button>
        <div className="studio-inspector-body">
          {working ? (
            <div className="studio-panel">
              <h2>這一頁</h2>
              <p className="studio-panel-lead">先改頁名與背景。要改區塊內容，請在中間畫布點一下該區塊。</p>
              <label className="studio-field">
                <span className="studio-field-label">頁面名稱</span>
                <input value={working.name} maxLength={80} onChange={(event) => setWorking({ ...working, name: event.target.value })} />
              </label>
              {fixedInfo ? <p className="studio-help">固定頁 · 網址 {fixedInfo.path}{record ? "" : " · 還沒存過，按「儲存草稿」或「發布」後才會留下紀錄"}</p> : record ? (
                <>
                  <p className="studio-help">{sitePageKindLabels[record.kind]} · 網址 {record.path}</p>
                  <label className="studio-check">
                    <input type="checkbox" checked={working.inHeader} onChange={(event) => setWorking({ ...working, inHeader: event.target.checked })} />
                    放進頁首（發布後才會出現）
                  </label>
                </>
              ) : null}
              <div className="studio-field">
                <span className="studio-field-label">這一頁的背景圖</span>
                <p className="studio-help">只影響這一頁。不設就用全站預設底色。</p>
                {working.backgroundImage ? <img className="studio-bg-preview" src={working.backgroundImage} alt="" /> : <p className="studio-help">目前沒有背景圖。</p>}
                <label className="studio-field">
                  <span className="studio-field-label">圖片網址</span>
                  <input value={working.backgroundImage} placeholder="https:// 或 /preview/…" onChange={(event) => setWorking({ ...working, backgroundImage: event.target.value })} />
                </label>
                <label className="studio-field">
                  <span className="studio-field-label">從電腦上傳（JPEG、PNG）</span>
                  <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void run(async () => {
                      const saved = await services.uploadSitePageImage(file);
                      setWorking((current) => current ? { ...current, backgroundImage: saved.url } : current);
                      setNotice({ tone: "ok", text: "背景圖已上傳，記得儲存草稿。" });
                    });
                  }} />
                </label>
                {working.backgroundImage ? <button className="studio-go" type="button" onClick={() => setWorking({ ...working, backgroundImage: "" })}>清除背景圖</button> : null}
              </div>
              {record?.publishedAt || record ? (
                <div className="studio-panel-actions">
                  <p className="studio-field-label">頁面操作</p>
                  {record?.publishedAt ? (
                    <button className="studio-go" type="button" disabled={busy || dirty} title={dirty ? "先儲存或放棄修改" : undefined} onClick={() => void run(async () => { remember(await services.unpublishSitePage(record.id, working.version)); setNotice({ tone: "ok", text: fixedInfo ? "已取消發布，前台改回預設版面" : "已取消發布，前台不再顯示這一頁" }); })}>取消發布</button>
                  ) : null}
                  {record ? (
                    <button
                      className="studio-go"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const label = fixedInfo ? `${record.name}存過的版面（前台改回預設版面）` : record.name;
                        if (!confirmDelete(label)) return;
                        void run(async () => {
                          await services.deleteSitePage(record.id, record.version);
                          queryClient.setQueryData<SitePageItem[]>(listKey, (old) => (old ?? []).filter((item) => item.id !== record.id));
                          void queryClient.invalidateQueries({ queryKey: ["site-pages"] });
                          const next: Target = fixedInfo ? { kind: "fixed", slug: fixedInfo.slug } : { kind: "fixed", slug: "home" };
                          setWorking(fromDefault(next.slug, site.data));
                          setTarget(next);
                          setSelection(null);
                          setNotice({ tone: "ok", text: fixedInfo ? "已改回預設版面" : "頁面已刪除" });
                        });
                      }}
                    >
                      {fixedInfo ? "改回預設版面" : "刪除此頁"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedWidget ? (
            <div className="studio-panel">
              <WidgetSettings
                key={selectedWidget.widget.id}
                item={selectedWidget.widget}
                upload={(file) => services.uploadSitePageImage(file)}
                onChange={(patch) => updateSection(selectedWidget.section.id, (current) => ({
                  ...current,
                  columns: current.columns.map((col) => col.id === selectedWidget.column.id ? { ...col, widgets: col.widgets.map((entry) => entry.id === selectedWidget.widget.id ? { ...entry, ...patch } : entry) } : col),
                }))}
                onDelete={() => {
                  updateSection(selectedWidget.section.id, (current) => ({
                    ...current,
                    columns: current.columns.map((col) => col.id === selectedWidget.column.id ? { ...col, widgets: col.widgets.filter((entry) => entry.id !== selectedWidget.widget.id) } : col),
                  }));
                  setSelection({ kind: "column", id: selectedWidget.column.id });
                }}
              />
            </div>
          ) : selectedColumn && selection?.kind === "column" ? (
            <div className="studio-panel">
              <h2>選取中：直欄 {selectedColumn.column.width}</h2>
              <p className="studio-panel-lead">調整這一欄寬度，或加入小區塊。</p>
              <p className="studio-field-label">欄寬</p>
              <div className="studio-choice">
                {widths.map((width) => (
                  <button key={width} type="button" aria-pressed={selectedColumn.column.width === width} onClick={() => updateSection(selectedColumn.section.id, (current) => ({ ...current, columns: current.columns.map((item) => item.id === selectedColumn.column.id ? { ...item, width } : item) }))}>{width}</button>
                ))}
              </div>
              <label className="studio-field">
                <span className="studio-field-label">加入小區塊</span>
                <select value={adding} onChange={(event) => setAdding(event.target.value as WidgetKind)}>
                  {widgetKinds.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                </select>
              </label>
              <button
                className="studio-go"
                type="button"
                onClick={() => {
                  const created = widget(adding);
                  updateSection(selectedColumn.section.id, (current) => ({
                    ...current,
                    columns: current.columns.map((item) => item.id === selectedColumn.column.id ? { ...item, widgets: [...item.widgets, created] } : item),
                  }));
                  setSelection({ kind: "widget", id: created.id });
                }}
              >
                加進這一欄
              </button>
              <button
                className="studio-go"
                type="button"
                disabled={selectedColumn.section.columns.length < 2}
                onClick={() => {
                  updateSection(selectedColumn.section.id, (current) => ({ ...current, columns: current.columns.filter((item) => item.id !== selectedColumn.column.id) }));
                  setSelection({ kind: "section", id: selectedColumn.section.id });
                }}
              >
                刪除此欄
              </button>
            </div>
          ) : selectedSection && selection?.kind === "section" ? (
            <div className="studio-panel">
              <h2>選取中：區塊</h2>
              <p className="studio-panel-lead">改區塊名稱、樣式與欄寬組合。</p>
              <label className="studio-field"><span className="studio-field-label">區塊名稱</span><input value={selectedSection.name} onChange={(event) => updateSection(selectedSection.id, (current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="studio-field">
                <span className="studio-field-label">區塊樣式</span>
                <select value={selectedSection.style} onChange={(event) => updateSection(selectedSection.id, (current) => ({ ...current, style: event.target.value as SiteSectionStyle }))}>
                  {SITE_SECTION_STYLES.map((style) => <option key={style} value={style}>{siteSectionStyleLabels[style]}</option>)}
                </select>
              </label>
              <p className="studio-help">滿版適合輪播與橫幅大圖；色帶是一半圖、一半字。</p>
              <p className="studio-field-label">欄寬組合</p>
              <div className="studio-choice">
                {presets.map(([label, layout]) => (
                  <button key={label} type="button" onClick={() => applyPreset(selectedSection.id, layout)}>{label}</button>
                ))}
              </div>
              <button className="studio-go" type="button" disabled={selectedSection.columns.length >= 6} onClick={() => updateSection(selectedSection.id, (current) => ({ ...current, columns: [...current.columns, column("1/4")] }))}>加一欄四分之一</button>
              <button className="studio-go" type="button" onClick={() => { updateSections((current) => current.filter((item) => item.id !== selectedSection.id)); setSelection(null); }}>刪除此區塊</button>
            </div>
          ) : working ? <p className="studio-help">點中間畫布的區塊、直欄或小區塊，右邊會出現對應設定。隱藏的區塊只在編輯器看得到。</p> : null}
        </div>
      </aside>
    </div>
  );
}

function WidgetSettings({ item, upload, onChange, onDelete }: { item: Widget; upload: (file: File) => Promise<{ url: string }>; onChange: (patch: Partial<Widget>) => void; onDelete: () => void }) {
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const label = widgetKinds.find(([kind]) => kind === item.kind)?.[1] ?? "小區塊";
  const styles = siteWidgetStyleOptions[item.kind];
  async function pick(file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const saved = await upload(file);
      apply(saved.url);
      setNotice("圖片已上傳，記得儲存草稿。");
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setUploading(false);
    }
  }
  function insertLink() {
    const href = linkHref.trim();
    if (!safeLink(href)) {
      setNotice("連結請用 / 開頭的站內路徑，或 http(s) 網址。");
      return;
    }
    const area = bodyRef.current;
    const start = area?.selectionStart ?? item.body.length;
    const end = area?.selectionEnd ?? item.body.length;
    const picked = item.body.slice(start, end).replace(/[[\]\n]/g, "").trim() || "連結文字";
    onChange({ body: `${item.body.slice(0, start)}[${picked}](${href})${item.body.slice(end)}` });
    setLinkHref("");
    setNotice(start === end ? "已在游標位置加入「連結文字」，可以直接改字。記得儲存草稿。" : "已加上連結，記得儲存草稿。");
  }
  function changeTable(next: string[][]) {
    onChange({ table: next.length ? next : blankTable() });
  }
  const isList = siteListWidgetKinds.includes(item.kind);
  return (
    <>
      <h2>選取中：{label}</h2>
      {styles ? (
        <label>
          樣式
          <select value={item.style || styles[0]?.[0]} onChange={(event) => onChange({ style: event.target.value as SiteWidgetStyle })}>
            {styles.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
      ) : null}
      {item.kind === "heading" || item.kind === "banner" ? (
        <label>小字（標題上方）<input value={item.kicker} maxLength={80} onChange={(event) => onChange({ kicker: event.target.value })} /></label>
      ) : null}
      {item.kind === "text" ? (
        <>
          {item.style === "callout" ? <label>重點標題<input value={item.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} /></label> : null}
          <label>內文<textarea ref={bodyRef} value={item.body} maxLength={5000} onChange={(event) => onChange({ body: event.target.value })} /></label>
          <label>連結網址<input value={linkHref} placeholder="/faq 或 https://…" onChange={(event) => setLinkHref(event.target.value)} /></label>
          <button className="studio-go" type="button" onClick={insertLink}>把選取的文字加上連結</button>
          <p className="studio-help">先在內文選取要變成連結的字，填網址後按上面的按鈕。內文會寫成 [文字](網址)，前台顯示為底線連結。要拿掉連結，把方括號和括號裡的網址刪掉即可。</p>
        </>
      ) : item.kind === "product" || item.kind === "banner" ? (
        <>
          <label>標題<input value={item.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} /></label>
          <label>內文<textarea value={item.body} maxLength={5000} onChange={(event) => onChange({ body: event.target.value })} /></label>
        </>
      ) : item.kind === "table" ? (
        <label>表格標題<input value={item.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} /></label>
      ) : isList || item.kind === "courses" ? null : (
        <label>{item.kind === "image" ? "替代文字" : item.kind === "video" ? "影片說明" : item.kind === "button" ? "按鈕文字" : "標題"}<input value={item.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} /></label>
      )}
      {item.kind === "button" || item.kind === "heading" ? (
        <>
          <label>{item.kind === "button" ? "按鈕連結" : "標題連結"}<input value={item.link} placeholder="/faq 或 https://…" onChange={(event) => onChange({ link: event.target.value })} /></label>
          <p className="studio-help">站內頁用 / 開頭；外部網址會開新分頁。{item.kind === "button" ? "不填就只顯示按鈕樣式。" : "不填就是一般標題。"}</p>
        </>
      ) : null}
      {item.kind === "image" || item.kind === "product" || item.kind === "banner" ? (
        <>
          <label>圖片網址<input value={item.image} placeholder="https:// 或 /preview/…" onChange={(event) => onChange({ image: event.target.value })} /></label>
          <label>從電腦上傳圖片（JPEG、PNG）<input type="file" accept="image/jpeg,image/png" disabled={uploading} onChange={(event) => { void pick(event.target.files?.[0], (url) => onChange({ image: url })); event.target.value = ""; }} /></label>
          <div className="studio-thumbs">
            {library.map(([src, name]) => (
              <button key={src} type="button" aria-label={name} aria-pressed={item.image === src} onClick={() => onChange({ image: src })}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        </>
      ) : null}
      {item.kind === "video" ? (
        <>
          <label>影片網址<input value={item.image} placeholder="YouTube、Vimeo 或 mp4 網址" onChange={(event) => onChange({ image: event.target.value })} /></label>
          <p className="studio-help">YouTube 與 Vimeo 貼一般觀看網址即可。</p>
        </>
      ) : null}
      {item.kind === "table" ? (
        <>
          <div className="studio-table-editor">
            {item.table.map((row, rowIndex) => (
              <div key={rowIndex} className="studio-table-row">
                {row.map((cell, columnIndex) => (
                  <input
                    key={columnIndex}
                    aria-label={`第 ${rowIndex + 1} 列第 ${columnIndex + 1} 欄`}
                    value={cell}
                    onChange={(event) => changeTable(item.table.map((current, index) => index === rowIndex ? current.map((value, cellIndex) => cellIndex === columnIndex ? event.target.value : value) : current))}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="studio-table-actions">
            <button type="button" disabled={item.table.length >= 60} onClick={() => changeTable([...item.table, item.table[0]?.map(() => "") ?? [""]])}>加一列</button>
            <button type="button" disabled={(item.table[0]?.length ?? 0) >= 12} onClick={() => changeTable(item.table.map((row) => [...row, ""]))}>加一欄</button>
            <button type="button" disabled={item.table.length < 2} onClick={() => changeTable(item.table.slice(0, -1))}>刪除最後一列</button>
            <button type="button" disabled={(item.table[0]?.length ?? 0) < 2} onClick={() => changeTable(item.table.map((row) => row.slice(0, -1)))}>刪除最後一欄</button>
          </div>
          <p className="studio-help">第一列是表頭。手機上表格太寬時可以左右捲動。</p>
        </>
      ) : null}
      {isList ? <ListEditor item={item} uploading={uploading} onChange={(items) => onChange({ items })} onUpload={(file, apply) => void pick(file, apply)} /> : null}
      {item.kind === "courses" ? <p className="studio-help">前台這裡列出已公開的課程，訪客可搜尋並切換列表、月曆。課程內容在後台「教育訓練」修改。</p> : null}
      {item.kind === "product" ? <p className="studio-help">商品金額先不填。這格以後可以換成真正的商品。</p> : null}
      {notice ? <p className="studio-help" role="status">{notice}</p> : null}
      <button className="studio-go" type="button" onClick={onDelete}>刪除此小區塊</button>
    </>
  );
}

const listFields: Record<string, { name: string; kicker?: string; title: string; body?: string; image?: boolean; badge?: boolean; link?: boolean }> = {
  carousel: { name: "張", title: "替代文字", image: true },
  cards: { name: "張卡", kicker: "小字", title: "標題", body: "說明", image: true, badge: true, link: true },
  steps: { name: "步", title: "步驟名稱", body: "說明（可不填）" },
  faq: { name: "題", kicker: "分類", title: "問題", body: "答案" },
};

function ListEditor({ item, uploading, onChange, onUpload }: { item: Widget; uploading: boolean; onChange: (items: ListItem[]) => void; onUpload: (file: File | undefined, apply: (url: string) => void) => void }) {
  const fields = listFields[item.kind];
  if (!fields) return null;
  const items = item.items;
  const patch = (id: string, next: Partial<ListItem>) => onChange(items.map((entry) => entry.id === id ? { ...entry, ...next } : entry));
  return (
    <div className="studio-list-editor">
      <p>共 {items.length} {fields.name}</p>
      {items.map((entry, index) => (
        <fieldset key={entry.id} className="studio-list-item">
          <legend>第 {index + 1} {fields.name}</legend>
          {fields.kicker ? <label>{fields.kicker}<input value={entry.kicker} maxLength={80} onChange={(event) => patch(entry.id, { kicker: event.target.value })} /></label> : null}
          <label>{fields.title}<input value={entry.title} maxLength={200} onChange={(event) => patch(entry.id, { title: event.target.value })} /></label>
          {fields.body ? <label>{fields.body}<textarea value={entry.body} maxLength={5000} onChange={(event) => patch(entry.id, { body: event.target.value })} /></label> : null}
          {fields.image ? (
            <>
              <label>圖片網址<input value={entry.image} placeholder="https:// 或 /preview/…" onChange={(event) => patch(entry.id, { image: event.target.value })} /></label>
              <label>上傳圖片<input type="file" accept="image/jpeg,image/png" disabled={uploading} onChange={(event) => { onUpload(event.target.files?.[0], (url) => patch(entry.id, { image: url })); event.target.value = ""; }} /></label>
            </>
          ) : null}
          {fields.badge && item.style !== "place" && item.style !== "points" ? <label>標章圖（可不填）<input value={entry.badge} placeholder="/preview/seal-….png" onChange={(event) => patch(entry.id, { badge: event.target.value })} /></label> : null}
          {fields.link ? <label>連結（可不填）<input value={entry.link} placeholder="/verification 或 https://…" onChange={(event) => patch(entry.id, { link: event.target.value })} /></label> : null}
          <div className="studio-table-actions">
            <button type="button" disabled={index === 0} onClick={() => onChange(move(items, index, index - 1))}>上移</button>
            <button type="button" disabled={index === items.length - 1} onClick={() => onChange(move(items, index, index + 1))}>下移</button>
            <button type="button" onClick={() => onChange(items.filter((other) => other.id !== entry.id))}>刪除</button>
          </div>
        </fieldset>
      ))}
      <button className="studio-go" type="button" disabled={items.length >= 60} onClick={() => onChange([...items, listItem({ kicker: item.kind === "faq" ? items.at(-1)?.kicker ?? "" : "" })])}>加一{fields.name}</button>
      {item.kind === "faq" ? <p className="studio-help">同一個分類的問題會放在同一個分頁按鈕下。</p> : null}
    </div>
  );
}
