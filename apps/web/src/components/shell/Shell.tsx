import { homePathForRole, type UserRole } from "@mf/contracts";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
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

const portalNav = [
  ["/portal", "工作總覽"],
  ["/portal/applications", "驗證申請"],
  ["/portal/supplements", "補件"],
  ["/portal/enrollments", "教育訓練"],
  ["/portal/contracts", "合約"],
  ["/portal/certifications", "電子證書"],
  ["/portal/renewals", "續約"],
  ["/portal/resources", "授權資源"],
  ["/portal/profile", "業者資料"],
];

const adminNav = [
  ["/admin", "工作總覽"],
  ["/admin/cms", "內容管理"],
  ["/admin/applications", "案件審查"],
  ["/admin/site-reviews", "現場複審"],
  ["/admin/organizations", "會員管理"],
  ["/admin/contracts", "合約管理"],
  ["/admin/courses", "教育訓練管理"],
  ["/admin/reports", "報表"],
  ["/admin/permissions", "權限管理"],
  ["/admin/audit-logs", "操作紀錄"],
];

const officerHidden = ["/admin/cms", "/admin/users", "/admin/permissions", "/admin/organizations", "/admin/contracts", "/admin/reports", "/admin/audit-logs"];

export function Shell({ area }: { area: "public" | "portal" | "admin" }) {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const links = area === "portal" ? portalNav : area === "admin" ? adminNav.filter((item) => session.user?.role === "ADMIN" || !officerHidden.includes(item[0]!)) : publicNav;
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="serif text-xl text-[var(--ink)] no-underline">{brand.name}</Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {area === "public" ? links.map(([href, label]) => (
              <NavLink key={href} to={href ?? "/"} end={href === "/"} className={({ isActive }) => `no-underline ${isActive ? "text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4" : "text-[var(--muted)]"}`}>{label}</NavLink>
            )) : <span className="text-sm text-[var(--muted)]">{area === "portal" ? "業者會員區" : "內部後台"}</span>}
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
              {links.map(([href, label]) => (
                <NavLink key={href} to={href ?? "/"} end={href === "/portal" || href === "/admin"} className={({ isActive }) => `rounded-md px-3 py-2 text-sm no-underline ${isActive ? "bg-[var(--accent)] text-[#fffcf7]" : "text-[var(--ink)]"}`}>
                  {label}
                </NavLink>
              ))}
              <button className="rounded-md px-3 py-2 text-left text-sm text-[var(--ink)]" type="button" onClick={async () => { await services.logout(); await session.setUser(null); navigate("/"); }}>登出</button>
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
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
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
        <button className="rounded-md border border-[var(--line)] px-2 py-1" type="button" onClick={async () => { await services.resetDemo?.(); sessionStorage.removeItem("mf-demo-user"); await session.setUser(null); location.reload(); }}>
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
