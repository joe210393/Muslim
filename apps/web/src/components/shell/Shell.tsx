import { homePathForRole, userRoleLabels, type UserRole } from "@mf/contracts";
import { useEffect, useState } from "react";
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

const adminNav: Array<{ href: string; label: string; anyOf?: string[]; children?: Array<{ href: string; label: string }> }> = [
  { href: "/admin", label: "工作總覽" },
  { href: "/admin/cms", label: "內容管理", anyOf: ["cms.edit"], children: cmsPages },
  { href: "/admin/applications", label: "案件審查", anyOf: ["applications.review", "applications.decide"] },
  { href: "/admin/site-reviews", label: "現場複審", anyOf: ["applications.review", "applications.decide"] },
  { href: "/admin/organizations", label: "會員管理", anyOf: ["users.manage"] },
  { href: "/admin/contracts", label: "合約管理", anyOf: ["contracts.issue"], children: contractPages },
  { href: "/admin/payments", label: "方案與付款", anyOf: ["payments.manage"], children: paymentPages },
  { href: "/admin/courses", label: "教育訓練管理", anyOf: ["training.manage"] },
  { href: "/admin/reports", label: "報表", anyOf: ["reports.export"] },
  { href: "/admin/permissions", label: "員工", anyOf: ["users.manage"] },
  { href: "/admin/audit-logs", label: "操作紀錄", anyOf: ["audit.view"] },
];

export function Shell({ area }: { area: "public" | "portal" | "admin" }) {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    "/admin/cms": location.pathname.startsWith("/admin/cms"),
    "/admin/contracts": location.pathname.startsWith("/admin/contracts"),
    "/admin/payments": location.pathname.startsWith("/admin/payments"),
  }));
  const allowed = new Set(session.user?.featureKeys ?? []);
  const visible = (items: Array<{ href: string; label: string; anyOf?: string[]; children?: Array<{ href: string; label: string }> }>) => items.filter((item) => !item.anyOf || item.anyOf.some((key) => allowed.has(key)));
  useEffect(() => {
    setOpenGroups((current) => ({
      ...current,
      ...(location.pathname.startsWith("/admin/cms") ? { "/admin/cms": true } : {}),
      ...(location.pathname.startsWith("/admin/contracts") ? { "/admin/contracts": true } : {}),
      ...(location.pathname.startsWith("/admin/payments") ? { "/admin/payments": true } : {}),
    }));
  }, [location.pathname]);
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
              {links.map((item) => {
                const children = "children" in item && Array.isArray(item.children) ? item.children as Array<{ href: string; label: string }> : [];
                return children.length ? (
                <div key={item.href} className="space-y-2">
                  <button
                    className={`btn w-full rounded-md px-3 py-2 text-left text-sm ${location.pathname.startsWith(item.href) ? "is-selected" : ""}`}
                    type="button"
                    aria-expanded={Boolean(openGroups[item.href])}
                    onClick={() => {
                      const next = !openGroups[item.href];
                      setOpenGroups((current) => ({ ...current, [item.href]: next }));
                      const first = children[0];
                      if (next && first && !location.pathname.startsWith(item.href)) navigate(first.href);
                    }}
                  >
                    {item.label}
                  </button>
                  {openGroups[item.href] ? children.map((child) => (
                    <NavLink key={child.href} to={child.href} end={child.href === "/admin/payments"} className={({ isActive }) => `btn block rounded-md px-3 py-2 text-left text-sm no-underline md:ml-3 ${isActive ? "is-selected" : ""}`}>{child.label}</NavLink>
                  )) : null}
                </div>
              ) : (
                <NavLink key={item.href} to={item.href} end={item.href === "/portal" || item.href === "/admin"} className={({ isActive }) => `btn rounded-md px-3 py-2 text-left text-sm no-underline ${isActive ? "is-selected" : ""}`}>
                  {item.label}
                </NavLink>
              );
              })}
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
