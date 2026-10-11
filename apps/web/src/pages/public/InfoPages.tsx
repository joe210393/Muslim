import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  aboutContent,
  contactContent,
  emailDrafts,
  faqs,
  feeItems,
  halaSteps,
  newsItems,
  prayerSchedule,
} from "../../content/site-content";
import { Button, Card, Field, PageHeader, PendingNote, TextArea, TextInput } from "../../components/ui";

export function AboutPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="公開前台" title={aboutContent.title} lede={aboutContent.paragraphs[0]} />
      <PendingNote />
      <p className="max-w-3xl leading-7 text-[var(--muted)]">{aboutContent.paragraphs[1]}</p>
      <div className="grid gap-6 md:grid-cols-3">
        {aboutContent.facts.map((fact) => (
          <Card key={fact.label}>
            <p className="text-sm text-[var(--muted)]">{fact.label}</p>
            <p className="mt-2 leading-7">{fact.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function NewsListPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="公開前台" title="最新消息" lede="列表已先建好。正式消息、圖片與影片由甲方替換，未核定的內容不應被當成公告。" />
      <PendingNote />
      <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {newsItems.map((item) => (
          <article key={item.slug} className="grid gap-2 py-6 md:grid-cols-[8rem_1fr]">
            <p className="text-sm text-[var(--muted)]">{item.date}</p>
            <div>
              <h2 className="text-2xl"><Link to={`/news/${item.slug}`}>{item.title}</Link></h2>
              <p className="mt-2 leading-7 text-[var(--muted)]">{item.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug = "" } = useParams();
  const item = newsItems.find((entry) => entry.slug === slug);
  if (!item) return <PageHeader title="找不到這則消息" />;
  return (
    <article className="max-w-3xl space-y-6">
      <PageHeader eyebrow={item.date} title={item.title} lede={item.summary} />
      <PendingNote />
      <p className="leading-8">{item.body}</p>
      <Link to="/news">返回消息列表</Link>
    </article>
  );
}

export function VerificationPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="HALA 驗證" title="驗證介紹" lede="申請順序依需求分析簡報整理。付款、現場複審與簽約尚未開放，避免把尚未核定的步驟做成可按的成功按鈕。" />
      <PendingNote />
      <ol className="max-w-3xl space-y-6">
        {halaSteps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-[var(--line)] pt-6">
            <span className="text-sm text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-2xl">{step.title}</h2>
              <p className="mt-2 leading-7 text-[var(--muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="space-y-4">
        <h2 className="text-3xl">費用項目</h2>
        <p className="max-w-3xl leading-7 text-[var(--muted)]">金額欄先留白。金流服務商確定前，這裡只用於核對收費結構。</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr><th className="p-3 font-medium">代碼</th><th className="p-3 font-medium">項目</th><th className="p-3 font-medium">計費</th><th className="p-3 font-medium">金額</th><th className="p-3 font-medium">退費</th></tr>
            </thead>
            <tbody>
              {feeItems.map((fee) => (
                <tr key={fee.code} className="border-t border-[var(--line)]">
                  <td className="p-3">{fee.code}</td>
                  <td className="p-3">{fee.item}</td>
                  <td className="p-3">{fee.basis}</td>
                  <td className="p-3">{fee.amount}</td>
                  <td className="p-3">{fee.refund}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-3xl">朝拜時間表</h2>
        <p className="max-w-3xl leading-7 text-[var(--muted)]">{prayerSchedule.note}</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)]"><tr>{prayerSchedule.columns.map((column) => <th key={column} className="p-3 font-medium">{column}</th>)}</tr></thead>
            <tbody>{prayerSchedule.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={`${rowIndex}-${index}`} className="p-3">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-3xl">通知信草稿</h2>
        {emailDrafts.map((mail) => (
          <Card key={mail.key}>
            <p className="text-sm text-[var(--muted)]">{mail.when}</p>
            <h3 className="mt-1 text-xl">{mail.subject}</h3>
            <p className="mt-2 leading-7 text-[var(--muted)]">{mail.body}</p>
          </Card>
        ))}
      </section>
      <Link to="/login">登入後建立申請</Link>
    </div>
  );
}

export function FaqPage() {
  const groups = [...new Set(faqs.map((item) => item.group))];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="公開前台" title="常見問題" lede="分類結構先依申請、費用、訓練、證書分開。正式問答可由甲方整批替換。" />
      <PendingNote />
      {groups.map((group) => (
        <section key={group} className="space-y-4">
          <h2 className="text-2xl">{group}</h2>
          {faqs.filter((item) => item.group === group).map((item) => (
            <div key={item.q} className="border-t border-[var(--line)] py-4">
              <h3 className="text-lg">{item.q}</h3>
              <p className="mt-2 leading-7 text-[var(--muted)]">{item.a}</p>
            </div>
          ))}
        </section>
      ))}
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
