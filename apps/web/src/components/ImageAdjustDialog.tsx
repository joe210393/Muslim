import { useEffect, useRef, useState } from "react";
import { Button, ErrorText, Modal } from "./ui";

type Crop = { x: number; y: number; w: number; h: number };

function clampCrop(x: number, y: number, w: number, h: number, width: number, height: number): Crop {
  const nextW = Math.min(Math.max(w, Math.min(48, width)), width);
  const nextH = Math.min(Math.max(h, Math.min(48, height)), height);
  return {
    w: nextW,
    h: nextH,
    x: Math.min(Math.max(0, x), width - nextW),
    y: Math.min(Math.max(0, y), height - nextH),
  };
}

function canvasSize(naturalWidth: number, naturalHeight: number, rotation: number) {
  return rotation % 180 === 0
    ? { width: naturalWidth, height: naturalHeight }
    : { width: naturalHeight, height: naturalWidth };
}

export function ImageAdjustDialog({
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
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<Crop | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; px: number; py: number; crop: Crop } | null>(null);
  const file = files[index];
  const size = natural ? canvasSize(natural.width, natural.height, rotation) : null;

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      sourceRef.current = image;
      setRotation(0);
      setNatural({ width: image.naturalWidth, height: image.naturalHeight });
      setUrl(objectUrl);
      setError(null);
    };
    image.onerror = () => setError("這張照片讀取失敗");
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    if (!natural) return;
    const box = canvasSize(natural.width, natural.height, rotation);
    const next = clampCrop(0, 0, box.width, box.height, box.width, box.height);
    cropRef.current = next;
    setCrop(next);
  }, [rotation, natural]);

  if (!file) return null;
  const frame = Math.max(240, Math.min(440, window.innerWidth - 64));
  const scale = size ? Math.min(frame / Math.max(size.width, size.height), 2) : 1;

  function moveCrop(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || !size) return;
    const dx = (event.clientX - drag.px) / scale;
    const dy = (event.clientY - drag.py) / scale;
    const next = drag.mode === "move"
      ? clampCrop(drag.crop.x + dx, drag.crop.y + dy, drag.crop.w, drag.crop.h, size.width, size.height)
      : clampCrop(drag.crop.x, drag.crop.y, drag.crop.w + dx, drag.crop.h + dy, size.width, size.height);
    cropRef.current = next;
    setCrop(next);
  }

  async function finish(nextFile: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUse(nextFile);
      if (index + 1 >= files.length) onClose();
      else {
        setUrl(null);
        setNatural(null);
        setCrop(null);
        setIndex((value) => value + 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "調整失敗");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCrop() {
    const image = sourceRef.current;
    const current = cropRef.current;
    const currentFile = files[index];
    if (!image || !current || !currentFile || !natural || busy) return;
    const rotated = canvasSize(natural.width, natural.height, rotation);
    const stage = document.createElement("canvas");
    stage.width = rotated.width;
    stage.height = rotated.height;
    const stageContext = stage.getContext("2d");
    if (!stageContext) {
      setError("無法調整照片");
      return;
    }
    stageContext.translate(rotated.width / 2, rotated.height / 2);
    stageContext.rotate((rotation * Math.PI) / 180);
    stageContext.drawImage(image, -natural.width / 2, -natural.height / 2);
    const outputW = Math.max(1, Math.round(Math.min(current.w, 2000)));
    const outputH = Math.max(1, Math.round(Math.min(current.h, 2000)));
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("無法裁切");
      return;
    }
    context.drawImage(stage, current.x, current.y, current.w, current.h, 0, 0, outputW, outputH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("無法裁切");
      return;
    }
    const base = currentFile.name.replace(/\.[^.]+$/, "") || "photo";
    await finish(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <Modal title="調整照片" onClose={onClose} wide>
      <div>
        <p className="text-sm text-[var(--muted)]">第 {index + 1} 張，共 {files.length} 張。可先旋轉。拖曳白框移動範圍，拖右下角縮小後裁切。</p>
        {error ? <div className="mt-3"><ErrorText message={error} /></div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" type="button" onClick={() => setRotation((value) => (value + 270) % 360)}>左轉</Button>
          <Button variant="secondary" type="button" onClick={() => setRotation((value) => (value + 90) % 360)}>右轉</Button>
          {size ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const next = clampCrop(0, 0, size.width, size.height, size.width, size.height);
                cropRef.current = next;
                setCrop(next);
              }}
            >
              重設裁切
            </Button>
          ) : null}
        </div>
        {url && size && crop ? (
          <div className="relative mx-auto mt-4 touch-none overflow-hidden bg-black" style={{ width: Math.round(size.width * scale), height: Math.round(size.height * scale) }}>
            <img
              src={url}
              alt=""
              className="absolute left-1/2 top-1/2 max-h-none max-w-none"
              draggable={false}
              style={{
                width: Math.round((natural?.width ?? 0) * scale),
                height: Math.round((natural?.height ?? 0) * scale),
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              }}
            />
            <div
              role="slider"
              aria-label="裁切範圍"
              aria-valuemin={0}
              aria-valuemax={size.width}
              aria-valuenow={Math.round(crop.x)}
              className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_999px_rgba(16,32,51,0.55)]"
              style={{ left: crop.x * scale, top: crop.y * scale, width: crop.w * scale, height: crop.h * scale }}
              onPointerDown={(event) => {
                if (!cropRef.current) return;
                event.preventDefault();
                dragRef.current = { mode: "move", px: event.clientX, py: event.clientY, crop: cropRef.current };
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
              }}
              onPointerMove={moveCrop}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            >
              <button
                type="button"
                aria-label="調整裁切大小"
                className="absolute -bottom-2 -right-2 h-7 w-7 cursor-nwse-resize touch-none rounded-full border-2 border-[var(--accent-deep)] bg-white"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!cropRef.current) return;
                  dragRef.current = { mode: "resize", px: event.clientX, py: event.clientY, crop: cropRef.current };
                  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                }}
                onPointerMove={moveCrop}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
              />
            </div>
          </div>
        ) : <p className="mt-4 text-sm">正在讀取照片…</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!crop || busy} onClick={() => void confirmCrop()}>{busy ? "處理中…" : "使用這張"}</Button>
          <Button variant="secondary" disabled={busy} type="button" onClick={() => void finish(file)}>直接使用原檔</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </div>
      </div>
    </Modal>
  );
}
