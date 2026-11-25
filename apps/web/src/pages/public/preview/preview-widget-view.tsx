import { siteInlineLinks } from "@mf/contracts";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CourseCatalog } from "../PublicPages";
import { safeLink, safeMediaUrl, videoEmbed, type ListItem, type Widget } from "./preview-pages";

/** linkable=false 用在編輯器裡，點按鈕只選取不跳頁。 */
export function PreviewWidgetBody({ item, linkable = true }: { item: Widget; linkable?: boolean }) {
  if (item.kind === "heading") {
    const Title = item.style === "small" ? "h3" : "h2";
    return (
      <div className={`pv-w-heading${item.style === "small" ? " is-small" : ""}`}>
        {item.kicker ? <p className="pv-kicker">{item.kicker}</p> : null}
        <Title><SiteAnchor href={item.link} linkable={linkable}>{item.title}</SiteAnchor></Title>
      </div>
    );
  }
  if (item.kind === "text") {
    if (item.style === "callout") {
      return (
        <aside className="pv-intro-aside">
          {item.title ? <strong>{item.title}</strong> : null}
          <span><RichText body={item.body} linkable={linkable} /></span>
        </aside>
      );
    }
    return <p className="pv-w-text"><RichText body={item.body} linkable={linkable} /></p>;
  }
  if (item.kind === "image") {
    const src = safeMediaUrl(item.image, "image");
    return src ? <img className={`pv-w-image${item.style === "natural" ? " pv-w-natural" : ""}`} src={src} alt={item.title} /> : <p className="pv-media-empty">還沒有圖片</p>;
  }
  if (item.kind === "video") return <VideoBlock item={item} />;
  if (item.kind === "table") return <TableBlock item={item} />;
  if (item.kind === "button") {
    const tone = item.style === "ghost" ? "ghost" : "primary";
    return <SiteButton href={item.link} className={`pv-btn ${tone}`} linkable={linkable}>{item.title}</SiteButton>;
  }
  if (item.kind === "product") {
    return (
      <div className="pv-product">
        {safeMediaUrl(item.image, "image") ? <img src={safeMediaUrl(item.image, "image")} alt={item.title} /> : null}
        <p className="pv-kicker">商品內頁示意</p>
        <h2>{item.title}</h2>
        <p>售價以後由商品決定</p>
        <p><RichText body={item.body} linkable={linkable} /></p>
      </div>
    );
  }
  if (item.kind === "banner") {
    const src = safeMediaUrl(item.image, "image");
    return (
      <div className="pv-page-hero">
        {src ? <img src={src} alt="" /> : null}
        <div>
          {item.kicker ? <p className="pv-kicker" style={{ color: "#f3d48a" }}>{item.kicker}</p> : null}
          <h1>{item.title}</h1>
          {item.body ? <p style={{ maxWidth: "40rem", lineHeight: 1.7 }}><RichText body={item.body} linkable={linkable} /></p> : null}
        </div>
      </div>
    );
  }
  if (item.kind === "carousel") return <Carousel items={item.items} />;
  if (item.kind === "cards") return <Cards item={item} linkable={linkable} />;
  if (item.kind === "steps") {
    return (
      <ol className="pv-steps">
        {item.items.map((step, index) => (
          <li key={step.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {step.body ? <><strong>{step.title}</strong><p className="pv-note"><RichText body={step.body} linkable={linkable} /></p></> : step.title}
          </li>
        ))}
      </ol>
    );
  }
  if (item.kind === "faq") return <Faq items={item.items} linkable={linkable} />;
  if (item.kind === "courses") {
    return linkable ? <CourseCatalog /> : <p className="pv-media-empty">這裡會列出已公開的課程，可切換列表與月曆。課程在後台「教育訓練」新增與修改。</p>;
  }
  return <p>{item.body}</p>;
}

function SiteAnchor({ href, linkable, children }: { href: string; linkable: boolean; children: ReactNode }) {
  const safe = safeLink(href);
  if (!safe) return <>{children}</>;
  if (!linkable) return <span className="pv-inline-link">{children}</span>;
  return safe.startsWith("/")
    ? <Link className="pv-inline-link" to={safe}>{children}</Link>
    : <a className="pv-inline-link" href={safe} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function SiteButton({ href, className, linkable, children }: { href: string; className: string; linkable: boolean; children: ReactNode }) {
  const safe = safeLink(href);
  if (!safe || !linkable) return <span className={className}>{children}</span>;
  return safe.startsWith("/")
    ? <Link className={className} to={safe}>{children}</Link>
    : <a className={className} href={safe} target="_blank" rel="noopener noreferrer">{children}</a>;
}

/** 把內文裡的 [文字](網址) 換成連結；網址不合規定時只留文字。 */
function RichText({ body, linkable }: { body: string; linkable: boolean }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const link of siteInlineLinks(body)) {
    if (link.index > cursor) parts.push(body.slice(cursor, link.index));
    parts.push(<SiteAnchor key={link.index} href={link.href} linkable={linkable}>{link.text}</SiteAnchor>);
    cursor = link.index + link.length;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return <>{parts}</>;
}

function Carousel({ items }: { items: ListItem[] }) {
  const slides = items.filter((item) => safeMediaUrl(item.image, "image"));
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 5600);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const current = slides[index % Math.max(slides.length, 1)];
  if (!current) return <p className="pv-media-empty">輪播還沒有圖片</p>;
  return (
    <div className="pv-stage">
      <div className="pv-hero">
        <img src={safeMediaUrl(current.image, "image")} alt={current.title} />
      </div>
      {slides.length > 1 ? (
        <div className="pv-stage-ui">
          <button type="button" aria-label="上一張" onClick={() => setIndex((value) => (value - 1 + slides.length) % slides.length)}>‹</button>
          <div className="pv-dots">
            {slides.map((slide, slideIndex) => (
              <button key={slide.id} type="button" className="pv-dot" aria-label={`第 ${slideIndex + 1} 張`} aria-current={slideIndex === index % slides.length} onClick={() => setIndex(slideIndex)} />
            ))}
          </div>
          <button type="button" aria-label="下一張" onClick={() => setIndex((value) => (value + 1) % slides.length)}>›</button>
        </div>
      ) : null}
    </div>
  );
}

function CardShell({ href, linkable, className, children }: { href: string; linkable: boolean; className: string; children: ReactNode }) {
  const safe = safeLink(href);
  if (!safe || !linkable) return <div className={className}>{children}</div>;
  return safe.startsWith("/")
    ? <Link className={className} to={safe}>{children}</Link>
    : <a className={className} href={safe} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function Cards({ item, linkable }: { item: Widget; linkable: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const style = item.style || "gallery";
  if (style === "bento" || style === "mosaic") {
    return (
      <div className={`pv-${style}`}>
        {item.items.map((card) => (
          <CardShell key={card.id} href={card.link} linkable={linkable} className="pv-card">
            {safeMediaUrl(card.image, "image") ? <img className="cover" src={safeMediaUrl(card.image, "image")} alt={card.title} /> : null}
            {safeMediaUrl(card.badge, "image") ? <img className="pv-seal" src={safeMediaUrl(card.badge, "image")} alt="" /> : null}
            <div className="pv-shade">
              <h3>{card.title}</h3>
              {card.body ? <p>{card.body}</p> : null}
            </div>
          </CardShell>
        ))}
      </div>
    );
  }
  if (style === "place") {
    return (
      <div className="pv-regions">
        {item.items.map((card) => (
          <CardShell key={card.id} href={card.link} linkable={linkable} className="pv-region">
            {safeMediaUrl(card.image, "image") ? <img src={safeMediaUrl(card.image, "image")} alt={card.title} /> : null}
            <span>{card.title}</span>
          </CardShell>
        ))}
      </div>
    );
  }
  if (style === "points") {
    return (
      <div className="pv-points">
        {item.items.map((card) => (
          <article key={card.id}>
            {safeMediaUrl(card.image, "image") ? <img className="pv-point-image" src={safeMediaUrl(card.image, "image")} alt="" /> : null}
            {card.kicker ? <p className="pv-kicker">{card.kicker}</p> : null}
            <h3><SiteAnchor href={card.link} linkable={linkable}>{card.title}</SiteAnchor></h3>
            {card.body ? <p className="pv-note"><RichText body={card.body} linkable={linkable} /></p> : null}
          </article>
        ))}
      </div>
    );
  }
  const current = open === null ? null : item.items[open];
  return (
    <>
      <div className="pv-gallery">
        {item.items.map((card, index) => {
          const body = (
            <>
              <span className="pv-gallery-photo">
                {safeMediaUrl(card.image, "image") ? <img src={safeMediaUrl(card.image, "image")} alt={card.title} /> : null}
                {safeMediaUrl(card.badge, "image") ? <img className="pv-gallery-seal" src={safeMediaUrl(card.badge, "image")} alt="" /> : null}
              </span>
              <h3>{card.title}</h3>
              {card.body ? <p>{card.body}</p> : null}
            </>
          );
          if (safeLink(card.link)) return <CardShell key={card.id} href={card.link} linkable={linkable} className="pv-gallery-item">{body}</CardShell>;
          return linkable
            ? <button key={card.id} type="button" className="pv-gallery-item" onClick={() => setOpen(index)}>{body}</button>
            : <div key={card.id} className="pv-gallery-item">{body}</div>;
        })}
      </div>
      {current ? (
        <div className="pv-lightbox" role="dialog" aria-modal="true" aria-label={current.title}>
          <button type="button" onClick={() => setOpen(null)} aria-label="關閉">×</button>
          <img src={safeMediaUrl(current.image, "image")} alt={current.title} />
        </div>
      ) : null}
    </>
  );
}

function Faq({ items, linkable }: { items: ListItem[]; linkable: boolean }) {
  const groups = [...new Set(items.map((item) => item.kicker))];
  const [group, setGroup] = useState(groups[0] ?? "");
  const active = groups.includes(group) ? group : groups[0] ?? "";
  return (
    <>
      {groups.length > 1 ? (
        <div className="pv-actions">
          {groups.map((name) => (
            <button key={name} type="button" className={name === active ? "pv-btn primary" : "pv-btn ghost"} aria-pressed={name === active} onClick={() => setGroup(name)}>{name || "其他"}</button>
          ))}
        </div>
      ) : null}
      <div className="pv-faq" style={{ marginTop: 18 }}>
        {items.filter((item) => item.kicker === active).map((item) => (
          <article key={item.id}>
            <h3>{item.title}</h3>
            <p className="pv-note"><RichText body={item.body} linkable={linkable} /></p>
          </article>
        ))}
      </div>
    </>
  );
}

function VideoBlock({ item }: { item: Widget }) {
  const embed = videoEmbed(item.image);
  return (
    <figure className="pv-media-block">
      {embed.mode === "iframe" ? (
        <iframe className="pv-media" src={embed.src} title={item.title || "影片"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : embed.mode === "file" ? (
        <video className="pv-media" src={embed.src} controls playsInline />
      ) : (
        <p className="pv-media-empty">還沒有影片。可貼 YouTube、Vimeo 或影片檔網址。</p>
      )}
      {item.title ? <figcaption>{item.title}</figcaption> : null}
    </figure>
  );
}

function TableBlock({ item }: { item: Widget }) {
  const [head, ...rows] = item.table.length ? item.table : [["項目", "說明"]];
  return (
    <figure className="pv-media-block">
      {item.title ? <figcaption>{item.title}</figcaption> : null}
      <div className="pv-table-wrap">
        <table className="pv-table">
          <thead>
            <tr>{head?.map((cell, index) => <th key={index}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
