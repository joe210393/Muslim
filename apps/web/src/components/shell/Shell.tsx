import { homePathForRole, userRoleLabels, type PlatformFeatureKey, type UserRole } from "@mf/contracts";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import { useServices, useSession } from "../../app/session";
import { brand } from "../../content/site-content";
import { AdminPageHeader } from "../ui";

const publicNav = [
  ["/", "首頁"],
  ["/about", "關於我們"],
  ["/news", "最新消息"],
  ["/verification", "驗證介紹"],
  ["/courses", "教育訓練"],
  ["/faq", "常見問題"],
  ["/contact", "聯絡我們"],
];

const cmsPages = [
  { href: "/admin/cms/home", label: "首頁" },
  { href: "/admin/cms/about", label: "關於我們" },
  { href: "/admin/cms/news", label: "最新消息" },
  { href: "/admin/cms/verification", label: "驗證介紹" },
  { href: "/admin/cms/faq", label: "常見問題" },
];

const contractPages: NavChild[] = [
  { href: "/admin/contracts", label: "合約管理", matchPrefixes: ["/admin/contracts/issued"] },
  { href: "/admin/contracts/issue", label: "發送合約" },
  { href: "/admin/contracts/templates", label: "合約範本" },
  { href: "/admin/contracts/seals", label: "大小章" },
];

const paymentPages: NavChild[] = [
  { href: "/admin/payments/plans", label: "方案內容" },
  { href: "/admin/payments/reconciliation", label: "核帳", matchPrefixes: ["/admin/payments/reconciliation", "/admin/payments/accounting"] },
  { href: "/admin/payments", label: "本月成交" },
  { href: "/admin/payments/record", label: "登錄付款" },
];

const applicationPages = [
  { href: "/admin/applications", label: "已送件" },
  { href: "/admin/applications/initial-review", label: "初審中" },
  { href: "/admin/applications/need-supplement", label: "待補件" },
  { href: "/admin/applications/second-review", label: "複審中" },
  { href: "/admin/applications/final-review", label: "待核定" },
  { href: "/admin/applications/approved", label: "已核定" },
  { href: "/admin/applications/rejected", label: "已退件" },
];

const certificatePages = [
  { href: "/admin/certificates", label: "待發證" },
  { href: "/admin/certificates/issued", label: "已發證" },
  { href: "/admin/certificates/templates", label: "證書範本" },
];

type NavChild = {
  href: string;
  label: string;
  children?: NavChild[];
  matchPrefixes?: string[];
};

type NavItem = {
  href: string;
  label: string;
  anyOf?: string[];
  children?: NavChild[];
  matchPrefixes?: string[];
};

const basicTrainingPages: NavChild[] = [
  { href: "/admin/training/basic", label: "基礎課" },
  { href: "/admin/training/question-bank", label: "題庫" },
  { href: "/admin/training/policy", label: "門檻設定" },
];

const trainingPages: NavChild[] = [
  {
    href: "/admin/training/basic-group",
    label: "基礎課程",
    matchPrefixes: ["/admin/training/basic", "/admin/training/question-bank", "/admin/training/policy"],
    children: basicTrainingPages,
  },
  { href: "/admin/courses", label: "課程梯次", matchPrefixes: ["/admin/courses"] },
  { href: "/admin/training/company-requests", label: "專班申請" },
  { href: "/admin/training/certificates", label: "一般課證書" },
];

type NavSection = { title?: string; numbered?: boolean; items: NavItem[] };

const portalSections: NavSection[] = [
  { items: [{ href: "/portal", label: "工作總覽" }] },
  {
    title: "流程",
    numbered: true,
    items: [
      { href: "/portal/payments", label: "方案與付款" },
      { href: "/portal/contracts", label: "合約", anyOf: ["contracts.sign"], matchPrefixes: ["/portal/contracts"] },
      { href: "/portal/enrollments", label: "教育訓練", matchPrefixes: ["/portal/enrollments", "/portal/learning-records"] },
      {
        href: "/portal/applications-group",
        label: "驗證申請",
        anyOf: ["applications.create"],
        matchPrefixes: ["/portal/applications", "/portal/supplements"],
        children: [
          { href: "/portal/applications", label: "我的申請", matchPrefixes: ["/portal/applications"] },
          { href: "/portal/supplements", label: "補件" },
        ],
      },
      { href: "/portal/certifications", label: "電子證書" },
      { href: "/portal/renewals", label: "續約" },
    ],
  },
  {
    title: "帳戶與資源",
    items: [
      { href: "/portal/profile", label: "業者資料", matchPrefixes: ["/portal/profile", "/portal/account"] },
      { href: "/portal/resources", label: "授權資源" },
    ],
  },
];

const adminSections: NavSection[] = [
  { items: [{ href: "/admin", label: "工作總覽" }] },
  {
    title: "流程",
    numbered: true,
    items: [
      { href: "/admin/payments", label: "方案與付款", anyOf: ["payments.manage"], children: paymentPages },
      { href: "/admin/contracts", label: "合約", anyOf: ["contracts.issue"], children: contractPages },
      {
        href: "/admin/training",
        label: "教育訓練",
        anyOf: ["training.manage"],
        matchPrefixes: ["/admin/training", "/admin/courses"],
        children: trainingPages,
      },
      {
        href: "/admin/applications",
        label: "案件審查",
        anyOf: ["applications.review", "applications.decide"],
        matchPrefixes: ["/admin/applications"],
        children: applicationPages,
      },
      {
        href: "/admin/certificates",
        label: "電子證書",
        anyOf: ["applications.decide"],
        matchPrefixes: ["/admin/certificates"],
        children: certificatePages,
      },
    ],
  },
  {
    title: "管理",
    items: [
      { href: "/admin/cms", label: "內容管理", anyOf: ["cms.edit"], children: cmsPages },
      { href: "/admin/audit-logs", label: "操作紀錄", anyOf: ["audit.view"] },
      { href: "/admin/reports", label: "報表", anyOf: ["reports.export"] },
      { href: "/admin/permissions", label: "員工", anyOf: ["users.manage"] },
      { href: "/admin/organizations", label: "會員管理", anyOf: ["users.manage"] },
    ],
  },
];

function pathMatches(pathname: string, item: { href: string; matchPrefixes?: string[] }) {
  const prefixes = item.matchPrefixes?.length ? item.matchPrefixes : [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || (prefix !== "/" && pathname.startsWith(prefix)));
}

const sectionsByArea: Record<"public" | "portal" | "admin", NavSection[]> = { public: [], portal: portalSections, admin: adminSections };

function activeGroups(sections: NavSection[], pathname: string) {
  const open: Record<string, boolean> = {};
  const walk = (items: Array<NavChild | NavItem>) => {
    for (const item of items) {
      if (!item.children?.length) continue;
      if (pathMatches(pathname, item)) open[item.href] = true;
      walk(item.children);
    }
  };
  for (const section of sections) walk(section.items);
  return open;
}

export type NavFromState = { navFrom?: string };

function navPathFor(area: "public" | "portal" | "admin", pathname: string, state: unknown) {
  const from = (state as NavFromState | null)?.navFrom;
  return typeof from === "string" && from.startsWith(`/${area}/`) ? from : pathname;
}

function currentNavLabel(sections: NavSection[], pathname: string): string | null {
  const walk = (items: Array<NavChild | NavItem>): string | null => {
    for (const item of items) {
      if (item.children?.length) {
        const found = walk(item.children);
        if (found) return found;
      } else if (pathname === item.href || (item.matchPrefixes && pathMatches(pathname, item))) {
        return item.label;
      }
    }
    return null;
  };
  for (const section of sections) {
    const found = walk(section.items);
    if (found) return found;
  }
  return null;
}

function firstLeafHref(item: NavChild | NavItem): string | null {
  if (item.children?.length) {
    for (const child of item.children) {
      const found = firstLeafHref(child);
      if (found) return found;
    }
    return null;
  }
  return item.href.endsWith("-group") ? null : item.href;
}

function NavTree({
  items,
  depth,
  openGroups,
  setOpenGroups,
  pathname,
  navigate,
  numbered = false,
}: {
  items: Array<NavChild | NavItem>;
  depth: number;
  openGroups: Record<string, boolean>;
  setOpenGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  pathname: string;
  navigate: ReturnType<typeof useNavigate>;
  numbered?: boolean;
}) {
  const indent = depth === 0 ? "" : "ml-3";
  return (
    <>
      {items.map((item, index) => {
        const children = item.children ?? [];
        const active = pathMatches(pathname, item);
        const label = numbered ? <><span className="mr-2 inline-block w-4 text-center text-xs font-semibold text-[var(--muted)]">{index + 1}</span>{item.label}</> : item.label;
        if (children.length) {
          const open = Boolean(openGroups[item.href]);
          return (
            <div key={item.href} className={`space-y-1 ${indent}`}>
              <button
                className={`nav-item flex items-center justify-between text-sm ${active ? "is-open" : ""}`}
                type="button"
                aria-expanded={open}
                onClick={() => {
                  const next = !open;
                  setOpenGroups((current) => ({ ...current, [item.href]: next }));
                  const first = firstLeafHref(item);
                  if (next && first && !active) navigate(first);
                }}
              >
                <span>{label}</span>
                <span aria-hidden="true" className="text-xs text-[var(--muted)]">{open ? "▾" : "▸"}</span>
              </button>
              {open ? (
                <NavTree
                  items={children}
                  depth={depth + 1}
                  openGroups={openGroups}
                  setOpenGroups={setOpenGroups}
                  pathname={pathname}
                  navigate={navigate}
                />
              ) : null}
            </div>
          );
        }
        const selected = pathname === item.href || Boolean(item.matchPrefixes && active);
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={selected ? "page" : undefined}
            className={`nav-item block text-sm ${indent} ${selected ? "is-selected" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function Shell({ area }: { area: "public" | "portal" | "admin" }) {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const sections = sectionsByArea[area];
  const navPath = navPathFor(area, location.pathname, location.state);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => activeGroups(sections, navPath));
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = new Set(session.user?.featureKeys ?? []);
  const visible = (items: NavItem[]) => items.filter((item) => !item.anyOf || item.anyOf.some((key) => allowed.has(key)));
  useEffect(() => {
    setOpenGroups((current) => ({ ...current, ...activeGroups(sections, navPath) }));
    setMenuOpen(false);
  }, [navPath, sections]);
  const links = publicNav.map(([href, label]) => ({ href: href ?? "/", label: label ?? "" }));
  const navGroups = sections.map((section) => ({ ...section, items: visible(section.items) })).filter((section) => section.items.length > 0);
  return (
    <div className={`min-h-screen bg-[var(--bg)] text-[var(--ink)] ${area === "public" ? "" : "app-area"}`}>
      <ScrollRestoration />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link to={area === "public" || !session.user ? "/" : homePathForRole(session.user.role as UserRole)} className="text-[var(--ink)] no-underline">
            <span className="serif block text-xl">{brand.name}</span>
            <span className="mt-1 block text-sm font-medium">{session.user ? session.user.email : "尚未登入"}</span>
            {session.user ? <span className="block text-xs text-[var(--muted)]">{userRoleLabels[session.user.role as UserRole]?.label ?? "請重新登入"}</span> : null}
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {area === "public" ? links.map((item) => (
              <NavLink key={item.href} to={item.href} end={item.href === "/"} className={({ isActive }) => `btn rounded-md px-3 py-2 no-underline ${isActive ? "is-selected" : ""}`}>{item.label}</NavLink>
            )) : (
              <>
                <span className="text-sm text-[var(--muted)]">{area === "portal" ? "業者會員區" : "內部後台"}</span>
                <Link className="btn rounded-md px-3 py-2 no-underline" to="/">前台</Link>
              </>
            )}
            {session.user ? (
              <>
                {area === "public" ? <Link className="btn rounded-md px-3 py-2 no-underline" to={homePathForRole(session.user.role as UserRole)}>進入作業</Link> : null}
                <button
                  className="btn rounded-md px-3 py-2"
                  type="button"
                  onClick={async () => {
                    await services.logout();
                    await session.setUser(null);
                    navigate("/");
                  }}
                >
                  登出
                </button>
              </>
            ) : (
              <Link className="btn rounded-md px-3 py-2 no-underline" to="/login">註冊／登入</Link>
            )}
          </nav>
        </div>
      </header>
      {services.mode === "mock" ? <DemoBar /> : null}
      <div className={area === "public" ? "" : "mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[220px_minmax(0,1fr)]"}>
        {area !== "public" ? (
          <aside className="no-print md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pb-4">
            <button
              className="btn flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm md:hidden"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="area-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>選單：{currentNavLabel(navGroups, navPath) ?? (area === "portal" ? "業者會員區" : "內部後台")}</span>
              <span aria-hidden="true">{menuOpen ? "▴" : "▾"}</span>
            </button>
            <nav id="area-menu" className={`${menuOpen ? "flex" : "hidden"} mt-3 flex-col gap-4 md:mt-0 md:flex md:gap-5`} aria-label={area === "portal" ? "業者會員區選單" : "內部後台選單"}>
                {navGroups.map((section, index) => (
                  <div key={section.title ?? index} className={`flex flex-col gap-1 ${index > 0 ? "border-t border-[var(--line)] pt-4" : ""}`}>
                    {section.title ? <p className="px-1 text-xs font-semibold tracking-wide text-[var(--muted)]">{section.title}</p> : null}
                    <NavTree
                      items={section.items}
                      depth={0}
                      openGroups={openGroups}
                      setOpenGroups={setOpenGroups}
                      pathname={navPath}
                      navigate={navigate}
                      numbered={section.numbered}
                    />
                  </div>
                ))}
              </nav>
          </aside>
        ) : null}
        <main className={area === "public" ? "mx-auto max-w-6xl px-5 py-12" : "min-w-0"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DemoBar() {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  if (!services.switchDemoUser || !services.demoAccounts || !services.resetDemo) return null;
  return (
    <div className="no-print border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm text-[var(--ink)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <strong className="font-medium">展示資料</strong>
        <span className="text-[var(--muted)]">只存在這個瀏覽器。正式 API 沒有角色切換。</span>
        {services.demoAccounts().map((account) => (
          <button
            key={account.email}
            className={`btn rounded-md px-2 py-1 ${session.user?.email === account.email ? "is-selected" : ""}`}
            aria-pressed={session.user?.email === account.email}
            type="button"
            onClick={async () => {
              const user = await services.switchDemoUser!(account.email);
              session.setUser(user);
              navigate(homePathForRole(user.role as UserRole));
            }}
          >
            {account.label}
          </button>
        ))}
        <button className="btn rounded-md px-2 py-1" type="button" onClick={async () => { await services.resetDemo?.(); sessionStorage.removeItem("mf-demo-user"); await session.setUser(null); location.reload(); }}>
          重設展示資料
        </button>
      </div>
    </div>
  );
}

export function Guard({ allow }: { allow: Array<"APPLICANT" | "CASE_OFFICER" | "ADMIN"> }) {
  const session = useSession();
  if (session.loading) return <p>載入中…</p>;
  if (!session.user) return <p>請先<Link to="/login">登入</Link>。</p>;
  if (!allow.includes(session.user.role as "APPLICANT")) return <p>你沒有此頁面的權限。</p>;
  return <Outlet />;
}

export function FeatureGuard({ anyOf }: { anyOf: PlatformFeatureKey[] }) {
  const session = useSession();
  const allowed = session.user?.featureKeys ?? [];
  if (!anyOf.some((key) => allowed.includes(key))) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="你沒有此功能" description="這個頁面需要另外開通的功能權限。需要使用請聯絡管理員到「員工」開通。" />
        <Link className="btn inline-block rounded-md px-3 py-2 text-sm no-underline" to={session.user ? homePathForRole(session.user.role as UserRole) : "/"}>回到工作總覽</Link>
      </div>
    );
  }
  return <Outlet />;
}
