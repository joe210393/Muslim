import { useEffect, useRef, useState } from "react";
import { Button, ErrorText } from "./ui";

type Crop = { x: number; y: number; side: number };

function clampCrop(x: number, y: number, side: number, width: number, height: number): Crop {
  const maxSide = Math.min(width, height);
  const nextSide = Math.min(Math.max(side, Math.min(48, maxSide)), maxSide);
  return {
    side: nextSide,
    x: Math.min(Math.max(0, x), width - nextSide),
    y: Math.min(Math.max(0, y), height - nextSide),
  };
}

export function SquareCropDialog({
  files,
  onClose,
  onUse,
}: {
  files: File[];
  onClose: () => void;
  onUse: (file: File) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<Crop | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; px: number; py: number; crop: Crop } | null>(null);
  const file = files[index];

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const next = clampCrop((image.naturalWidth - Math.min(image.naturalWidth, image.naturalHeight)) / 2, (image.naturalHeight - Math.min(image.naturalWidth, image.naturalHeight)) / 2, Math.min(image.naturalWidth, image.naturalHeight), image.naturalWidth, image.naturalHeight);
      sourceRef.current = image;
      cropRef.current = next;
      setCrop(next);
      setSize({ width: image.naturalWidth, height: image.naturalHeight });
      setUrl(objectUrl);
      setError(null);
    };
    image.onerror = () => setError("這張照片讀取失敗");
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file) return null;
  const scale = size ? Math.min(440 / Math.max(size.width, size.height), 2) : 1;

  function moveCrop(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || !size) return;
    const dx = (event.clientX - drag.px) / scale;
    const dy = (event.clientY - drag.py) / scale;
    const next = drag.mode === "move"
      ? clampCrop(drag.crop.x + dx, drag.crop.y + dy, drag.crop.side, size.width, size.height)
      : clampCrop(drag.crop.x, drag.crop.y, drag.crop.side + dx, size.width, size.height);
    cropRef.current = next;
    setCrop(next);
  }

  async function confirmCrop() {
    const image = sourceRef.current;
    const current = cropRef.current;
    const currentFile = files[index];
    if (!image || !current || !currentFile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const output = Math.max(1, Math.round(Math.min(current.side, 1600)));
      const canvas = document.createElement("canvas");
      canvas.width = output;
      canvas.height = output;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("無法裁切");
      context.drawImage(image, current.x, current.y, current.side, current.side, 0, 0, output, output);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("無法裁切");
      const base = currentFile.name.replace(/\.[^.]+$/, "") || "photo";
      await onUse(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
      if (index + 1 >= files.length) onClose();
      else {
        setUrl(null);
        setSize(null);
        setCrop(null);
        setIndex((value) => value + 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "裁切失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1916]/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="裁成正方形">
      <div className="w-full max-w-xl rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-2xl">裁成正方形</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">第 {index + 1} 張，共 {files.length} 張。拖曳方框選擇位置，拖右下角調整大小。</p>
        {error ? <div className="mt-3"><ErrorText message={error} /></div> : null}
        {url && size && crop ? (
          <div className="relative mx-auto mt-4 overflow-hidden" style={{ width: Math.round(size.width * scale), height: Math.round(size.height * scale) }}>
            <img src={url} alt="" className="h-full w-full" draggable={false} />
            <div
              role="slider"
              aria-label="裁切範圍"
              aria-valuemin={0}
              aria-valuemax={size.width}
              aria-valuenow={Math.round(crop.x)}
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_999px_rgba(16,32,51,0.55)]"
              style={{ left: crop.x * scale, top: crop.y * scale, width: crop.side * scale, height: crop.side * scale }}
              onPointerDown={(event) => {
                if (!cropRef.current) return;
                dragRef.current = { mode: "move", px: event.clientX, py: event.clientY, crop: cropRef.current };
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* 沒有真實指標時仍可依後續事件移動 */ }
              }}
              onPointerMove={moveCrop}
              onPointerUp={() => { dragRef.current = null; }}
            >
              <button
                type="button"
                aria-label="調整正方形大小"
                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize bg-white"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!cropRef.current) return;
                  dragRef.current = { mode: "resize", px: event.clientX, py: event.clientY, crop: cropRef.current };
                  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* 沒有真實指標時仍可依後續事件調整 */ }
                }}
                onPointerMove={moveCrop}
                onPointerUp={() => { dragRef.current = null; }}
              />
            </div>
          </div>
        ) : <p className="mt-4 text-sm">正在讀取照片…</p>}
        <div className="mt-4 flex gap-2">
          <Button disabled={!crop || busy} onClick={() => void confirmCrop()}>{busy ? "處理中…" : "使用這個範圍"}</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </div>
      </div>
    </div>
  );
}
