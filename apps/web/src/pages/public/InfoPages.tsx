import { EditorialKind } from "@mf/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/session";
import { PageHeader, PageMedia } from "../../components/ui";

export function NewsDetailPage() {
  const { slug = "" } = useParams();
  const services = useServices();
  const content = useQuery({ queryKey: ["site-content", services.mode], queryFn: () => services.publicSite() });
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
