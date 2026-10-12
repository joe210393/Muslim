import { EditorialKind } from "@mf/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/session";
import { contactContent, prayerSchedule } from "../../content/site-content";
import { Button, Card, ErrorText, Field, PageHeader, PageMedia, PendingNote, SectionNav, TextArea, TextInput } from "../../components/ui";
import type { EditorialEntry } from "../../services/types";

function usePublicSite() {
  const services = useServices();
  return useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
}

function ordered(entries: EditorialEntry[] | undefined, kind: EditorialKind) {
  return (entries ?? []).filter((item) => item.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "zh-Hant"));
}

export function AboutPage() {
  const content = usePublicSite();
  const page = content.data?.about;
  const facts = ordered(content.data?.entries, EditorialKind.ABOUT_FACT);
  if (content.isLoading) return <p>載入中…</p>;
  if (!page) return <ErrorText message="關於我們尚未發布" />;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={page.eyebrow} title={page.title} lede={page.subtitle} />
      <PageMedia imageUrl={page.imageUrl} youtubeUrl={page.youtubeUrl} />
      <PendingNote />
      <p className="max-w-3xl leading-7 text-[var(--muted)]">{page.body}</p>
      <div className="grid gap-6 md:grid-cols-3">
        {facts.map((fact) => (
          <Card key={fact.id}>
            <p className="text-sm text-[var(--muted)]">{fact.title}</p>
            <p className="mt-2 leading-7">{fact.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function NewsListPage() {
  const content = usePublicSite();
  const items = (content.data?.entries ?? []).filter((item) => item.kind === EditorialKind.NEWS).sort((a, b) => (b.publishedOn ?? "").localeCompare(a.publishedOn ?? ""));
  if (content.isLoading) return <p>載入中…</p>;
  return (
    <div className="space-y-8">
      <PageHeader title="最新消息" lede="一篇一篇閱讀。圖片與影片在各篇文章裡。" />
      {items.length === 0 ? <p className="text-sm text-[var(--muted)]">目前沒有消息。</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <Link to={`/news/${item.slug}`} className="block text-[var(--ink)] no-underline">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-48 w-full object-cover" /> : <div className="h-24 bg-[var(--panel)]" />}
              <div className="space-y-2 p-4">
                <p className="text-sm text-[var(--muted)]">{item.publishedOn}</p>
                <h2 className="text-2xl">{item.title}</h2>
                <p className="leading-7 text-[var(--muted)]">{item.summary}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug = "" } = useParams();
  const content = usePublicSite();
  const item = content.data?.entries.find((entry) => entry.kind === EditorialKind.NEWS && entry.slug === slug);
  if (content.isLoading) return <p>載入中…</p>;
  if (!item) return <PageHeader title="找不到這則消息" />;
  return (
    <article className="max-w-3xl space-y-6">
      <PageHeader eyebrow={item.publishedOn ?? ""} title={item.title} lede={item.summary} />
      <PageMedia imageUrl={item.imageUrl} youtubeUrl={item.youtubeUrl} />
      <p className="leading-8 whitespace-pre-wrap">{item.body}</p>
      <Link to="/news">返回消息列表</Link>
    </article>
  );
}

export function VerificationPage() {
  const content = usePublicSite();
  const page = content.data?.verification;
  const steps = ordered(content.data?.entries, EditorialKind.VERIFICATION_STEP);
  const fees = ordered(content.data?.entries, EditorialKind.FEE);
  const emails = ordered(content.data?.entries, EditorialKind.EMAIL_DRAFT);
  const [section, setSection] = useState("steps");
  if (content.isLoading) return <p>載入中…</p>;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={page?.eyebrow ?? "HALA 驗證"} title={page?.title ?? "驗證介紹"} lede={page?.subtitle ?? ""} />
      <PageMedia imageUrl={page?.imageUrl} youtubeUrl={page?.youtubeUrl} />
      <PendingNote />
      <SectionNav items={[{ id: "steps", label: "申請流程" }, { id: "fees", label: "費用項目" }, { id: "prayer", label: "朝拜時間" }, { id: "mail", label: "通知草稿" }]} value={section} onChange={setSection} />
      {section === "steps" ? <ol className="max-w-3xl space-y-6">
        {steps.map((step, index) => (
          <li key={step.id} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-[var(--line)] pt-6">
            <span className="text-sm text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-2xl">{step.title}</h2>
              <p className="mt-2 leading-7 text-[var(--muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol> : null}
      {section === "fees" ? <section className="space-y-4">
        <h2 className="text-3xl">費用項目</h2>
        <p className="max-w-3xl leading-7 text-[var(--muted)]">金額欄先留白。金流服務商確定前，這裡只用於核對收費結構。</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr><th className="p-3 font-medium">代碼</th><th className="p-3 font-medium">項目</th><th className="p-3 font-medium">計費</th><th className="p-3 font-medium">金額</th><th className="p-3 font-medium">退費</th></tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id} className="border-t border-[var(--line)]">
                  <td className="p-3">{fee.slug}</td>
                  <td className="p-3">{fee.title}</td>
                  <td className="p-3">{fee.summary}</td>
                  <td className="p-3">{fee.body}</td>
                  <td className="p-3">{fee.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section> : null}
      {section === "prayer" ? <section className="space-y-4">
        <h2 className="text-3xl">朝拜時間表</h2>
        <p className="max-w-3xl leading-7 text-[var(--muted)]">{page?.body || prayerSchedule.note}</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)]"><tr>{prayerSchedule.columns.map((column) => <th key={column} className="p-3 font-medium">{column}</th>)}</tr></thead>
            <tbody>{prayerSchedule.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={`${rowIndex}-${index}`} className="p-3">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section> : null}
      {section === "mail" ? <section className="space-y-3">
        <h2 className="text-3xl">通知信草稿</h2>
        {emails.map((mail) => (
          <Card key={mail.id}>
            <p className="text-sm text-[var(--muted)]">{mail.summary}</p>
            <h3 className="mt-1 text-xl">{mail.title}</h3>
            <p className="mt-2 leading-7 text-[var(--muted)]">{mail.body}</p>
          </Card>
        ))}
      </section> : null}
      <Link to="/login">登入後建立申請</Link>
    </div>
  );
}

export function FaqPage() {
  const content = usePublicSite();
  const page = content.data?.faq;
  const faqs = ordered(content.data?.entries, EditorialKind.FAQ);
  const groups = [...new Set(faqs.map((item) => item.groupLabel))];
  const [group, setGroup] = useState("");
  const active = group || groups[0] || "";
  const current = faqs.filter((item) => item.groupLabel === active);
  if (content.isLoading) return <p>載入中…</p>;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={page?.eyebrow ?? "公開前台"} title={page?.title ?? "常見問題"} lede={page?.subtitle ?? ""} />
      <PageMedia imageUrl={page?.imageUrl} youtubeUrl={page?.youtubeUrl} />
      <PendingNote />
      <SectionNav items={groups.map((item) => ({ id: item, label: item }))} value={active} onChange={setGroup} />
      <section className="space-y-4">
        {current.map((item) => (
          <div key={item.id} className="border-t border-[var(--line)] py-4">
            <h2 className="text-lg">{item.title}</h2>
            <p className="mt-2 leading-7 text-[var(--muted)]">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", topic: "驗證申請", message: "" });
  const [saved, setSaved] = useState(false);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <PageHeader eyebrow="公開前台" title={contactContent.title} lede={contactContent.inboxNote} />
        <PendingNote />
        <form className="max-w-xl space-y-4" onSubmit={(event) => {
          event.preventDefault();
          sessionStorage.setItem("mf-contact-draft", JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
          setSaved(true);
        }}>
          <Field label="姓名"><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
          <Field label="主題" hint="主題清單可再增刪">
            <TextInput value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
          </Field>
          <Field label="內容"><TextArea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></Field>
          <Button type="submit">暫存這份聯絡內容</Button>
          {saved ? <p className="text-sm leading-6">已暫存在這台瀏覽器，尚未寄出。</p> : null}
        </form>
      </div>
      <Card className="h-fit space-y-3 text-sm leading-7">
        <p>信箱 {contactContent.email}</p>
        <p>電話 {contactContent.phone}</p>
        <p>地址 {contactContent.address}</p>
        <p>時間 {contactContent.hours}</p>
      </Card>
    </div>
  );
}
