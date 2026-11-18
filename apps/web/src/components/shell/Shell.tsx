import { homePathForRole, userRoleLabels, type UserRole } from "@mf/contracts";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useServices, useSession } from "../../app/session";
import { brand } from "../../content/site-content";

const publicNav = [
  ["/", "首頁"],
  ["/about", "關於我們"],
  ["/news", "最新消息"],
  ["/verification", "驗證介紹"],
  ["/courses", "教育訓練"],
  ["/faq", "常見問題"],
  ["/contact", "聯絡我們"],
];

const portalNav: Array<{ href: string; label: string; anyOf?: string[] }> = [
  { href: "/portal", label: "工作總覽" },
  { href: "/portal/applications", label: "驗證申請", anyOf: ["applications.create"] },
  { href: "/portal/supplements", label: "補件", anyOf: ["applications.create"] },
  { href: "/portal/enrollments", label: "教育訓練" },
  { href: "/portal/contracts", label: "合約", anyOf: ["contracts.sign"] },
  { href: "/portal/certifications", label: "電子證書" },
  { href: "/portal/renewals", label: "續約" },
  { href: "/portal/payments", label: "已付款" },
  { href: "/portal/resources", label: "授權資源" },
  { href: "/portal/profile", label: "業者資料" },
];

const cmsPages = [
  { href: "/admin/cms/home", label: "首頁" },
  { href: "/admin/cms/about", label: "關於我們" },
  { href: "/admin/cms/news", label: "最新消息" },
  { href: "/admin/cms/verification", label: "驗證介紹" },
  { href: "/admin/cms/faq", label: "常見問題" },
];

const contractPages = [
  { href: "/admin/contracts/issued", label: "已發出" },
  { href: "/admin/contracts/issue", label: "發給業者" },
  { href: "/admin/contracts/templates", label: "合約範本" },
];

const paymentPages = [
  { href: "/admin/payments/plans", label: "方案內容" },
  { href: "/admin/payments", label: "本月成交" },
  { href: "/admin/payments/record", label: "登錄付款" },
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
  { href: "/admin/courses", label: "課程梯次" },
  { href: "/admin/training/company-requests", label: "專班申請" },
  { href: "/admin/training/certificates", label: "一般課證書" },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "工作總覽" },
  { href: "/admin/cms", label: "內容管理", anyOf: ["cms.edit"], children: cmsPages },
  { href: "/admin/applications", label: "案件審查", anyOf: ["applications.review", "applications.decide"] },
  { href: "/admin/organizations", label: "會員管理", anyOf: ["users.manage"] },
  { href: "/admin/contracts", label: "合約管理", anyOf: ["contracts.issue"], children: contractPages },
  { href: "/admin/payments", label: "方案與付款", anyOf: ["payments.manage"], children: paymentPages },
  {
    href: "/admin/training",
    label: "教育訓練",
    anyOf: ["training.manage"],
    matchPrefixes: ["/admin/training", "/admin/courses"],
    children: trainingPages,
  },
  { href: "/admin/reports", label: "報表", anyOf: ["reports.export"] },
  { href: "/admin/permissions", label: "員工", anyOf: ["users.manage"] },
  { href: "/admin/audit-logs", label: "操作紀錄", anyOf: ["audit.view"] },
];

function pathMatches(pathname: string, item: { href: string; matchPrefixes?: string[] }) {
  const prefixes = item.matchPrefixes?.length ? item.matchPrefixes : [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || (prefix !== "/" && pathname.startsWith(prefix)));
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
}: {
  items: Array<NavChild | NavItem>;
  depth: number;
  openGroups: Record<string, boolean>;
  setOpenGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  pathname: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const indent = depth === 0 ? "" : depth === 1 ? "md:ml-3" : "md:ml-6";
  return (
    <>
      {items.map((item) => {
        const children = item.children ?? [];
        const active = pathMatches(pathname, item);
        if (children.length) {
          const open = Boolean(openGroups[item.href]);
          return (
            <div key={item.href} className={`space-y-2 ${indent}`}>
              <button
                className={`btn w-full rounded-md px-3 py-2 text-left text-sm ${active ? "is-selected" : ""}`}
                type="button"
                aria-expanded={open}
                onClick={() => {
                  const next = !open;
                  setOpenGroups((current) => ({ ...current, [item.href]: next }));
                  const first = firstLeafHref(item);
                  if (next && first && !active) navigate(first);
                }}
              >
                {item.label}
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
        return (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/admin/payments" || item.href === "/admin/courses" || item.href === "/portal" || item.href === "/admin"}
            className={({ isActive }) => `btn block rounded-md px-3 py-2 text-left text-sm no-underline ${indent} ${isActive ? "is-selected" : ""}`}
          >
            {item.label}
          </NavLink>
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
  const basicGroupActive = ["/admin/training/basic", "/admin/training/question-bank", "/admin/training/policy"].some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );
  const trainingSectionActive = location.pathname.startsWith("/admin/training") || location.pathname.startsWith("/admin/courses");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    "/admin/cms": location.pathname.startsWith("/admin/cms"),
    "/admin/contracts": location.pathname.startsWith("/admin/contracts"),
    "/admin/payments": location.pathname.startsWith("/admin/payments"),
    "/admin/training": trainingSectionActive,
    "/admin/training/basic-group": basicGroupActive,
  }));
  const allowed = new Set(session.user?.featureKeys ?? []);
  const visible = (items: NavItem[]) => items.filter((item) => !item.anyOf || item.anyOf.some((key) => allowed.has(key)));
  useEffect(() => {
    setOpenGroups((current) => ({
      ...current,
      ...(location.pathname.startsWith("/admin/cms") ? { "/admin/cms": true } : {}),
      ...(location.pathname.startsWith("/admin/contracts") ? { "/admin/contracts": true } : {}),
      ...(location.pathname.startsWith("/admin/payments") ? { "/admin/payments": true } : {}),
      ...(trainingSectionActive ? { "/admin/training": true } : {}),
      ...(basicGroupActive ? { "/admin/training/basic-group": true } : {}),
    }));
  }, [location.pathname, trainingSectionActive, basicGroupActive]);
  const links = area === "portal" ? visible(portalNav) : area === "admin" ? visible(adminNav) : publicNav.map(([href, label]) => ({ href: href ?? "/", label: label ?? "" }));
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link to={area === "public" || !session.user ? "/" : homePathForRole(session.user.role as UserRole)} className="text-[var(--ink)] no-underline">
            <span className="serif block text-xl">{brand.name}</span>
            <span className="mt-1 block text-sm font-medium">{session.user ? session.user.email : "尚未登入"}</span>
            {session.user ? <span className="block text-xs text-[var(--muted)]">{userRoleLabels[session.user.role as UserRole]?.label ?? "請重新登入"}</span> : null}
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {area === "public" ? links.map((item) => (
              <NavLink key={item.href} to={item.href} end={item.href === "/"} className={({ isActive }) => `btn rounded-md px-3 py-2 no-underline ${isActive ? "is-selected" : ""}`}>{item.label}</NavLink>
            )) : (
              <>
                <span className="text-sm text-[var(--muted)]">{area === "portal" ? "業者會員區" : "內部後台"}</span>
                <Link className="btn rounded-md px-3 py-2 no-underline" to="/">前台</Link>
              </>
            )}
            {session.user ? <Link className="no-underline text-[var(--ink)]" to={homePathForRole(session.user.role as UserRole)}>進入作業</Link> : <Link className="no-underline text-[var(--ink)]" to="/login">註冊／登入</Link>}
          </nav>
        </div>
      </header>
      {services.mode === "mock" ? <DemoBar /> : null}
      <div className={area === "public" ? "" : "mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[220px_minmax(0,1fr)]"}>
        {area !== "public" ? (
          <aside className="no-print">
            <p className="mb-3 text-sm text-[var(--muted)]">{area === "portal" ? "業者會員區" : "內部後台"}</p>
            <div className="flex gap-2 overflow-auto md:flex-col">
              <NavTree
                items={links}
                depth={0}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
                pathname={location.pathname}
                navigate={navigate}
              />
              <Link className="btn rounded-md px-3 py-2 text-left text-sm no-underline" to="/">前台</Link>
              <button className="btn rounded-md px-3 py-2 text-left text-sm" type="button" onClick={async () => { await services.logout(); await session.setUser(null); navigate("/"); }}>登出</button>
            </div>
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
