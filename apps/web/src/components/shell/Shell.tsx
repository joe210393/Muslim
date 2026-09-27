import { homePathForRole, type UserRole } from "@mf/contracts";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useServices, useSession } from "../../app/session";
import { Button } from "../ui";

const portalNav = [
  ["/portal", "總覽"],
  ["/portal/applications", "我的申請"],
  ["/portal/applications/new", "新增申請"],
  ["/portal/enrollments", "課程報名"],
  ["/portal/learning-records", "我的學習紀錄"],
  ["/portal/certifications", "驗證紀錄"],
  ["/portal/profile", "業者資料"],
  ["/portal/account", "帳號設定"],
];

const adminNav = [
  ["/admin", "工作總覽"],
  ["/admin/applications", "案件管理"],
  ["/admin/courses", "課程管理"],
  ["/admin/users", "會員管理"],
  ["/admin/organizations", "業者資料"],
  ["/admin/imports", "資料匯入"],
  ["/admin/audit-logs", "操作紀錄"],
];

export function Shell({ area }: { area: "public" | "portal" | "admin" }) {
  const services = useServices();
  const session = useSession();
  const navigate = useNavigate();
  const links = area === "portal" ? portalNav : area === "admin" ? adminNav.filter((item) => session.user?.role === "ADMIN" || !["/admin/users", "/admin/organizations", "/admin/imports", "/admin/audit-logs"].includes(item[0]!)) : [];
  return (
    <div className="min-h-screen bg-[#f3f6f4] text-[#1c2421]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-base font-semibold text-[#0e5c4a]">穆斯林友善驗證申請暨審核</Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/guide">申請說明</Link>
            <Link to="/courses">課程</Link>
            {session.user ? <Link to={homePathForRole(session.user.role as UserRole)}>進入作業</Link> : <Link to="/login">登入</Link>}
          </nav>
        </div>
      </header>
      {services.mode === "mock" ? <DemoBar /> : null}
      <div className={area === "public" ? "" : "mx-auto grid max-w-6xl gap-4 px-4 py-4 md:grid-cols-[200px_1fr]"}>
        {area !== "public" ? (
          <aside className="no-print flex gap-2 overflow-auto md:flex-col">
            {links.map(([href, label]) => (
              <NavLink key={href} to={href ?? "/"} end={href === "/portal" || href === "/admin"} className={({ isActive }) => `rounded-md px-3 py-2 text-sm ${isActive ? "bg-[#0e5c4a] text-white" : "bg-white text-stone-700"}`}>
                {label}
              </NavLink>
            ))}
            <Button variant="ghost" onClick={async () => { await services.logout(); await session.setUser(null); navigate("/"); }}>登出</Button>
          </aside>
        ) : null}
        <main className={area === "public" ? "mx-auto max-w-6xl px-4 py-6" : "min-w-0"}>
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
    <div className="no-print bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <strong>展示模式：使用模擬資料</strong>
        <span>重整後仍保留在這個瀏覽器。正式 API 不會提供角色切換。</span>
        {services.demoAccounts().map((account) => (
          <button
            key={account.email}
            className="rounded border border-amber-700 px-2 py-1"
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
        <button className="rounded border border-amber-700 px-2 py-1" type="button" onClick={async () => { await services.resetDemo?.(); sessionStorage.removeItem("mf-demo-user"); await session.setUser(null); location.reload(); }}>
          重設展示資料
        </button>
      </div>
    </div>
  );
}

export function Guard({ allow }: { allow: Array<"APPLICANT" | "CASE_OFFICER" | "ADMIN"> }) {
  const session = useSession();
  if (session.loading) return <p>載入中…</p>;
  if (!session.user) return <p>請先<Link className="text-[#0e5c4a]" to="/login">登入</Link>。</p>;
  if (!allow.includes(session.user.role as "APPLICANT")) return <p>你沒有此頁面的權限。</p>;
  return <Outlet />;
}
