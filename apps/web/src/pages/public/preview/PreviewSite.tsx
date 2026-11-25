import { homePathForRole, SITE_BUILTIN_PAGES, siteBuiltinPage, userRoleLabels, type SiteBuiltinSlug, type UserRole } from "@mf/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useServices, useSession } from "../../../app/session";
import { SupportButton } from "../../../components/shell/Shell";
import { usePublishedPages, type Section } from "./preview-pages";
import { defaultSections } from "./site-defaults";
import { PreviewWidgetBody } from "./preview-widget-view";
import "../../../styles/preview.css";

function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · MuslimTW`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function SiteFrame() {
  const location = useLocation();
  const published = usePublishedPages();
  const nav: ReadonlyArray<readonly [string, string]> = [...SITE_BUILTIN_PAGES.map((page) => [page.path, page.name] as const), ...(published.data ?? []).filter((page) => page.inHeader).map((page) => [page.path, page.name] as const)];
  const session = useSession();
  const services = useServices();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="pv">
      <header className={`pv-header${open ? " is-open" : ""}`}>
        <Link to="/" className="pv-brand">
          <img src="/preview/logo.png" alt="MuslimTW" />
          <span className="pv-brand-text">
            <strong>MuslimTW</strong>
            <small>穆斯林友善驗證</small>
          </span>
        </Link>
        <button
          type="button"
          className={`pv-menu${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-controls="pv-site-nav"
          aria-label={open ? "關閉選單" : "打開選單"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="pv-menu-bars" aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
        <nav id="pv-site-nav" className={open ? "pv-nav open" : "pv-nav"} aria-label="前台">
          {nav.map(([href, label]) => (
            <NavLink key={href} to={href} end={href === "/"} onClick={() => setOpen(false)}>{label}</NavLink>
          ))}
          {session.user ? (
            <>
              <Link className="pv-login" to={homePathForRole(session.user.role as UserRole)} onClick={() => setOpen(false)}>
                {userRoleLabels[session.user.role as UserRole]?.label ?? "進入作業"}
              </Link>
              <button
                type="button"
                className="pv-login"
                onClick={async () => {
                  await services.logout();
                  await session.setUser(null);
                  setOpen(false);
                  navigate("/");
                }}
              >
                登出
              </button>
            </>
          ) : (
            <Link className="pv-login" to="/login" onClick={() => setOpen(false)}>業者登入</Link>
          )}
        </nav>
      </header>
      {open ? <button type="button" className="pv-nav-backdrop" aria-label="關閉選單" onClick={() => setOpen(false)} /> : null}
      <Outlet />
      <SupportButton />
      <footer className="pv-footer">
        <div className="pv-footer-grid">
          <div>
            <img className="logo" src="/preview/logo.png" alt="MuslimTW" />
            <p>用風景、餐食、旅宿與禮拜，說明台灣的穆斯林友善驗證。</p>
            <div className="pv-partners">
              <img src="/preview/partner-tourism.jpg" alt="交通部觀光署識別" />
              <img src="/preview/partner-center.png" alt="旅遊服務中心識別" />
            </div>
          </div>
          <div>
            <strong>瀏覽</strong>
            {nav.map(([href, label]) => <Link key={href} to={href}>{label}</Link>)}
          </div>
          <div>
            <strong>申請</strong>
            <Link to="/verification">看七類驗證</Link>
            <Link to="/login">業者登入後建立申請</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LivePublicLayout() {
  return <SiteFrame />;
}

export function PageFrame() {
  return <main className="pv-built"><Outlet /></main>;
}

export function PublishedPage() {
  const { slug = "" } = useParams();
  const published = usePublishedPages();
  const page = published.data?.find((item) => item.path === `/p/${slug}`);
  usePageTitle(page?.name ?? "頁面");
  if (published.isLoading) return <PageLoading />;
  if (published.error) return <p className="pv-section">頁面暫時無法載入，請稍後再試。</p>;
  if (!page) return <div className="pv-section"><p>找不到這個頁面，可能已經下架。</p><Link className="pv-btn primary" to="/">回首頁</Link></div>;
  return <BuiltSections sections={page.sections} backgroundImage={page.backgroundImage} />;
}

/** 頁首固定的頁：有發布過就用發布的版面，否則用預設版面（消息、問答等從現有資料產生）。 */
export function SitePageView({ slug }: { slug: SiteBuiltinSlug }) {
  const services = useServices();
  const published = usePublishedPages();
  const site = useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
  const page = published.data?.find((item) => item.slug === slug);
  usePageTitle(page?.name ?? siteBuiltinPage(slug)?.name ?? "頁面");
  if (published.isLoading || (!page && site.isLoading)) return <PageLoading />;
  if (published.error || (!page && site.error)) return <p className="pv-section" role="alert">頁面暫時無法載入，請稍後再試。</p>;
  return <BuiltSections sections={page?.sections ?? defaultSections(slug, site.data)} backgroundImage={page?.backgroundImage ?? ""} />;
}

function pageBackgroundStyle(backgroundImage: string | undefined): CSSProperties | undefined {
  if (!backgroundImage) return undefined;
  return {
    backgroundImage: `linear-gradient(rgba(244, 239, 230, 0.88), rgba(244, 239, 230, 0.92)), url(${JSON.stringify(backgroundImage)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };
}

function BuiltSections({ sections, backgroundImage = "" }: { sections: Section[]; backgroundImage?: string }) {
  return (
    <article className="pv-build pv-built-page" data-has-bg={backgroundImage ? "true" : undefined} style={pageBackgroundStyle(backgroundImage)}>
      {sections.filter((entry) => !entry.hidden).map((entry) => (
        <section key={entry.id} className={`pv-built-section${entry.style ? ` is-${entry.style}` : ""}`}>
          <div className="pv-build-columns">
            {entry.columns.map((col) => (
              <div key={col.id} className="pv-build-column" data-width={col.width}>
                {col.widgets.filter((item) => !item.hidden).map((item) => <PreviewWidgetBody key={item.id} item={item} />)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

function PageLoading() {
  return <p className="pv-section" aria-busy="true">載入中…</p>;
}
