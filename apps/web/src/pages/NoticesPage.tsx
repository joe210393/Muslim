import { DEFAULT_MAIL_TEMPLATES, notificationJobStatusLabels, type CustomerNoticeItem } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useServices } from "../app/session";
import { OrgLink } from "../components/OrgLink";
import { AdminPageHeader, Badge, Button, Card, DataTable, Empty, Field, NoticeText, SectionHeader, SelectInput, TextArea, TextInput, failNotice, tableRowClass } from "../components/ui";
import { formatTaipei } from "../lib/format";
import { ClientError } from "../services/types";

function noticeKind(type: string) {
  if (type === "MANUAL") return "手動";
  if (type === "RENEWAL") return "續約";
  if (type === "SUPPLEMENT_REQUEST") return "補件";
  return "流程";
}

function mailErrorHint(code: string | null | undefined) {
  if (!code) return null;
  if (code === "MAIL_DRIVER_CONSOLE") return "伺服器仍是測試寄信模式，沒有真正寄到信箱。請到「設定 → 郵件 SMTP」填主機並儲存密碼，或在 Zeabur 設 MAIL_DRIVER=smtp 與 SMTP_*。";
  if (code === "SMTP_ERROR") return "SMTP 連線或帳密失敗。請確認主機、埠 587、Gmail 應用程式密碼，並看垃圾郵件匣。";
  if (code === "SMTP_HOST_MISSING") return "還沒有 SMTP 主機。請在設定頁填寫後再寄。";
  if (code === "SMTP_PASSWORD_MISSING") return "已填帳號但還沒有郵件密碼。請到「設定 → 金鑰與密碼」儲存 SMTP 密碼。";
  if (code === "LOCAL_CATCHER") return "信進了本機收件匣，不是對方的 Gmail。";
  if (code === "INTEGRATION_DISABLED") return "系統串接裡的 Email 通知已停用。";
  return `失敗代碼：${code}`;
}

function NoticeList({ rows, loading, emptyBody, casePath, showRecipient }: { rows: CustomerNoticeItem[] | undefined; loading: boolean; emptyBody: string; casePath: (id: string) => string; showRecipient: boolean }) {
  if (loading) return <p>載入中…</p>;
  if (!rows?.length) return <Empty title="還沒有通知信" body={emptyBody} />;
  return (
    <div className="space-y-3">
      {rows.map((item) => {
        const hint = showRecipient ? mailErrorHint(item.lastErrorCode) : null;
        return (
          <Card key={item.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.subject}</p>
              <span className="flex items-center gap-2">
                <Badge tone="neutral">{noticeKind(item.type)}</Badge>
                <Badge tone={notificationJobStatusLabels[item.status].tone}>{notificationJobStatusLabels[item.status].label}</Badge>
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {formatTaipei(item.createdAt)}
              {item.applicationNo ? ` · 案件 ${item.applicationNo}` : ""}
              {showRecipient ? ` · ${item.recipientEmail}` : ""}
            </p>
            {hint ? <p className="text-sm text-[var(--danger)]">{hint}</p> : null}
            <p className="whitespace-pre-wrap text-sm">{item.body}</p>
            {item.applicationId ? <Link className="text-sm text-[var(--link)]" to={casePath(item.applicationId)}>查看案件</Link> : null}
          </Card>
        );
      })}
    </div>
  );
}

export function PortalNoticesPage() {
  const services = useServices();
  const rows = useQuery({ queryKey: ["notices"], queryFn: () => services.notices() });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">通知信</h1>
      <p className="text-sm text-[var(--muted)]">補件、案件下一步和續約提醒會出現在這裡。</p>
      <NoticeList rows={rows.data} loading={rows.isLoading} emptyBody="有新的步驟或續約提醒時，信會出現在這裡。" casePath={(id) => `/portal/applications/${id}`} showRecipient={false} />
    </div>
  );
}

function ApplicantPicker({
  applicants,
  taxByName,
  userId,
  onChange,
}: {
  applicants: Array<{ id: string; email: string; displayName: string; organizationName: string | null }>;
  taxByName: Map<string, string | null>;
  userId: string;
  onChange: (id: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [browse, setBrowse] = useState(false);
  const q = keyword.trim().toLowerCase();
  const selected = applicants.find((user) => user.id === userId);
  const matched = applicants.filter((user) => {
    if (!q) return browse;
    const taxId = user.organizationName ? taxByName.get(user.organizationName) ?? "" : "";
    return `${user.organizationName ?? ""} ${user.displayName} ${user.email} ${taxId}`.toLowerCase().includes(q);
  });
  const visible = browse ? matched : matched.slice(0, 20);
  const pick = (id: string) => {
    onChange(id);
    setKeyword("");
    setBrowse(false);
  };
  return (
    <div className="space-y-3">
      <SectionHeader
        title="收件業者"
        hint={selected ? `已選擇 ${selected.organizationName ?? selected.displayName} · ${selected.email}` : "先搜尋名稱、統編或 Email。想自己往下找再按「下拉名單」。"}
        actions={
          <>
            <TextInput className="w-56" placeholder="搜尋名稱、統編或 Email" value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label="搜尋業者" />
            <Button type="button" variant="secondary" onClick={() => setBrowse((open) => !open)}>{browse ? "收合名單" : "下拉名單"}</Button>
            {selected ? <Button type="button" variant="secondary" onClick={() => onChange("")}>清除</Button> : null}
          </>
        }
      />
      {q || browse ? (
        visible.length === 0 ? <Empty title="沒有符合的業者" body="換個名稱、統編或 Email。" /> : (
          <div className={browse ? "max-h-80 overflow-y-auto" : undefined}>
            <DataTable columns={["業者", "統編", "Email", ""]}>
              {visible.map((user) => {
                const taxId = user.organizationName ? taxByName.get(user.organizationName) ?? "" : "";
                return (
                  <tr key={user.id} className={tableRowClass}>
                    <td className="p-3 font-medium"><OrgLink name={user.organizationName ?? user.displayName} userId={user.id} /></td>
                    <td className="p-3">{taxId || "—"}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3 text-right">
                      <Button type="button" variant={user.id === userId ? "primary" : "secondary"} onClick={() => pick(user.id)}>{user.id === userId ? "已選擇" : "選擇"}</Button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            {!browse && matched.length > visible.length ? <p className="text-sm text-[var(--muted)]">還有 {matched.length - visible.length} 筆，請再縮小關鍵字，或改按「下拉名單」。</p> : null}
          </div>
        )
      ) : null}
    </div>
  );
}

export function AdminNoticesPage() {
  const services = useServices();
  const client = useQueryClient();
  const location = useLocation();
  const part = location.pathname.endsWith("/templates") ? "templates" : location.pathname.endsWith("/all") ? "all" : "one";
  const templates = useQuery({ queryKey: ["mail-templates"], queryFn: () => services.mailTemplates(), enabled: part === "templates" });
  const people = useQuery({ queryKey: ["users", "mail"], queryFn: () => services.users(), enabled: part !== "templates" });
  const orgs = useQuery({ queryKey: ["organizations", "mail"], queryFn: () => services.organizations(), enabled: part === "one" });
  const applicants = (people.data ?? []).filter((user) => user.role === "APPLICANT" && user.isActive);
  const taxByName = new Map((orgs.data ?? []).map((org) => [org.organizationName, org.taxId]));
  const audience = part === "all" ? "all" : "one";
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateKey, setTemplateKey] = useState("supplement");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [message, setMessage] = useState<ReturnType<typeof failNotice> | string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = templates.data?.find((item) => item.key === templateKey);
  useEffect(() => {
    if (!selected) return;
    setDraftSubject(selected.subject);
    setDraftBody(selected.body);
  }, [selected]);
  async function send() {
    setMessage(null);
    if (!subject.trim() || !body.trim()) {
      setMessage(failNotice("請填主旨和內文"));
      return;
    }
    if (audience === "one" && !userId) {
      setMessage(failNotice("請選擇一位業者"));
      return;
    }
    if (audience === "all" && !window.confirm(`寄給全部 ${applicants.length} 位業者？每人各一封。`)) return;
    setBusy(true);
    try {
      const result = await services.sendMail({ audience, userId: audience === "one" ? userId : undefined, subject: subject.trim(), body: body.trim() });
      setSubject("");
      setBody("");
      setUserId("");
      setMessage(
        result.failed
          ? `已建立 ${result.count} 封，其中 ${result.failed} 封沒有真正寄出。請到會員管理 → 該業者「查看信件」，看狀態是「僅模擬」還是「寄送失敗」，並依說明檢查 SMTP。`
          : result.local
            ? `已收下 ${result.count} 封，放在本機收件匣，還沒有進對方的 Gmail。`
            : `已寄出 ${result.count} 封。請到對方信箱查看，有時會在垃圾郵件。`,
      );
    } catch (error) {
      setMessage(failNotice(error instanceof ClientError ? error.message : "寄送失敗"));
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate() {
    if (!selected) return;
    if (!draftSubject.trim() || !draftBody.trim()) {
      setMessage(failNotice("請填主旨和內文"));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await services.saveMailTemplate(selected.key, { subject: draftSubject.trim(), body: draftBody.trim(), expectedVersion: selected.version });
      await client.invalidateQueries({ queryKey: ["mail-templates"] });
      setMessage("已儲存。之後的自動通知會用這份內容，已經寄出的信不會改。");
    } catch (error) {
      setMessage(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }
  function restore() {
    const fallback = DEFAULT_MAIL_TEMPLATES.find((item) => item.key === templateKey);
    if (!fallback) return;
    setDraftSubject(fallback.subject);
    setDraftBody(fallback.body);
  }
  const lookup = <Link className="btn rounded-md px-3 py-2 text-sm no-underline" to="/admin/organizations">到會員管理查信</Link>;
  if (part === "templates") {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="自動通知" description="補件、每一個流程下一步、續約提醒都會用這裡的文字。改完按儲存，只影響之後的信。已經寄出的不會改。" actions={lookup} />
        <Field label="哪一種信">
          <SelectInput value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} aria-label="通知種類">
            {(templates.data ?? DEFAULT_MAIL_TEMPLATES).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </SelectInput>
        </Field>
        <p className="text-sm text-[var(--muted)]">可代入：{selected?.hint ?? "載入中…"}</p>
        <Field label="主旨"><TextInput value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} aria-label="自動通知主旨" /></Field>
        <Field label="內文"><TextArea className="min-h-40" value={draftBody} onChange={(event) => setDraftBody(event.target.value)} aria-label="自動通知內文" /></Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !selected} onClick={() => void saveTemplate()}>儲存內容</Button>
          <Button type="button" variant="secondary" onClick={restore}>載入預設文字</Button>
        </div>
        <NoticeText notice={message} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={part === "one" ? "指定一位" : "全部業者"}
        description={part === "one" ? "只寄給這一位業者的登入 Email。寄出後若收件匣沒有，先看垃圾郵件。" : "啟用中的業者每人一封。送出前會再確認。寄出後若收件匣沒有，先看垃圾郵件。"}
        actions={lookup}
      />
      {part === "one" ? (
        <ApplicantPicker applicants={applicants} taxByName={taxByName} userId={userId} onChange={setUserId} />
      ) : (
        <SectionHeader title="收件範圍" hint={people.isLoading ? "載入中…" : `目前 ${applicants.length} 位啟用中的業者。`} />
      )}
      <Field label="主旨"><TextInput value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="主旨" /></Field>
      <Field label="內文"><TextArea value={body} onChange={(event) => setBody(event.target.value)} aria-label="內文" /></Field>
      <Button type="button" disabled={busy} onClick={() => void send()}>發送</Button>
      <NoticeText notice={message} />
    </div>
  );
}

export function OrganizationMailPage() {
  const { organizationId = "" } = useParams();
  const services = useServices();
  const [q, setQ] = useState("");
  const orgs = useQuery({ queryKey: ["organizations", ""], queryFn: () => services.organizations() });
  const rows = useQuery({ queryKey: ["org-notices", organizationId], queryFn: () => services.organizationNotices(organizationId), enabled: Boolean(organizationId) });
  const org = orgs.data?.find((item) => item.id === organizationId);
  const keyword = q.trim();
  const visible = (rows.data ?? []).filter((item) => !keyword || `${item.subject} ${item.body} ${item.recipientEmail} ${item.applicationNo ?? ""}`.includes(keyword));
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={org?.organizationName ?? "業者信件"}
        description="這一戶收到的手動信、補件、流程通知和續約提醒。"
        actions={<Link className="btn rounded-md px-3 py-2 text-sm no-underline" to="/admin/organizations">回會員管理</Link>}
      />
      <SectionHeader
        title="信件"
        hint={rows.data ? `${visible.length} 封` : undefined}
        actions={<TextInput className="w-56" placeholder="搜尋主旨或 Email" value={q} onChange={(event) => setQ(event.target.value)} aria-label="搜尋信件" />}
      />
      <NoticeList rows={rows.isLoading ? undefined : visible} loading={rows.isLoading} emptyBody="這一家還沒有收到信。" casePath={(id) => `/admin/applications/${id}`} showRecipient />
    </div>
  );
}
