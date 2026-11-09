import { useEffect, useState } from "react";
import { useServices } from "../app/session";

export function AttachmentImages({ files }: { files: Array<{ fileId: string; mimeType: string; originalName: string }> }) {
  const services = useServices();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = files.filter((file) => file.mimeType.startsWith("image/")).map((file) => file.fileId).join("|");
  useEffect(() => {
    let stop = false;
    const created: string[] = [];
    const images = files.filter((file) => file.mimeType.startsWith("image/"));
    void (async () => {
      for (const file of images) {
        try {
          const downloaded = await services.download(file.fileId);
          if (stop || !downloaded.blob.type.startsWith("image/")) continue;
          const url = URL.createObjectURL(downloaded.blob);
          if (stop) {
            URL.revokeObjectURL(url);
            return;
          }
          created.push(url);
          setUrls((current) => ({ ...current, [file.fileId]: url }));
        } catch {
          // 下載失敗時保留檔名，不擋其他照片。
        }
      }
    })();
    return () => {
      stop = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
    // 只在照片檔案編號改變時重新下載。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey, services]);
  const images = files.filter((file) => file.mimeType.startsWith("image/"));
  if (!images.length) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((file) => urls[file.fileId]
        ? <img key={file.fileId} src={urls[file.fileId]} alt={file.originalName} className="h-36 w-full rounded-md border border-[var(--line)] object-cover" />
        : <p key={file.fileId} className="text-sm text-[var(--muted)]">圖片載入中…</p>)}
    </div>
  );
}
