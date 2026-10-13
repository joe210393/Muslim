import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";

export function FaceCapture({ onChange }: { onChange: (file: Blob | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => () => stop(), []);

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function start() {
    setCameraError("");
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("無法開啟相機。請允許使用相機後，再按一次開啟相機。不能改上傳照片。");
    }
  }

  function shoot() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 120) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onChange(blob);
      stop();
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="space-y-3">
      <video ref={videoRef} className="max-h-72 w-full bg-[#1a1916]" autoPlay playsInline muted />
      {preview ? <img src={preview} alt="簽署時的人像預覽" className="max-h-72 w-full object-contain" /> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => void start()}>開啟相機</Button>
        <Button type="button" onClick={shoot}>拍攝人像</Button>
      </div>
      <p className="text-sm text-[var(--muted)]">請開啟相機拍攝。這裡不能改上傳照片。</p>
      {cameraError ? <p className="text-sm text-[var(--danger,#7a261c)]">{cameraError}</p> : null}
    </div>
  );
}

function prepareSignature(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return null;
  const cssWidth = parent.clientWidth;
  const cssHeight = parent.clientHeight;
  if (cssWidth < 2 || cssHeight < 2) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(cssWidth * ratio);
  const height = Math.round(cssHeight * ratio);
  const resized = canvas.width !== width || canvas.height !== height;
  if (resized) canvas.width = width;
  if (resized) canvas.height = height;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineWidth = 2.4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#1a1916";
  return { context, resized, cssWidth, cssHeight };
}

export function SignaturePad({ onChange }: { onChange: (file: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const prepared = prepareSignature(canvas);
      if (prepared?.resized && dirty.current) {
        dirty.current = false;
        onChange(null);
      }
    };
    fit();
    const parent = canvas.parentElement;
    const observer = new ResizeObserver(fit);
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [onChange]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const width = canvas.clientWidth || rect.width;
    const height = canvas.clientHeight || rect.height;
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), Math.max(width - 1, 0)),
      y: Math.min(Math.max(event.clientY - rect.top, 0), Math.max(height - 1, 0)),
    };
  }

  function exportInk() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if ((pixels[index] ?? 0) > 16) ink += 1;
    }
    if (ink < 80) {
      onChange(null);
      return;
    }
    canvas.toBlob((blob) => onChange(blob), "image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    prepareSignature(canvas);
    onChange(null);
  }

  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    exportInk();
  }

  return (
    <div className="space-y-3">
      <div className="relative h-64 w-full max-w-full overflow-hidden rounded-md border border-[var(--ink)] bg-white" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0 block touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            event.preventDefault();
            const prepared = canvasRef.current ? prepareSignature(canvasRef.current) : null;
            if (!prepared) return;
            drawing.current = true;
            dirty.current = true;
            const next = point(event);
            prepared.context.beginPath();
            prepared.context.moveTo(next.x, next.y);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            event.preventDefault();
            const context = canvasRef.current?.getContext("2d");
            if (!context) return;
            const next = point(event);
            context.lineTo(next.x, next.y);
            context.stroke();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
        />
      </div>
      <p className="text-sm text-[var(--muted)]">請在框內寫完姓名，包含最後一個字。框線裡面都可以簽。</p>
      <Button type="button" variant="secondary" onClick={clear}>清除簽名</Button>
    </div>
  );
}
