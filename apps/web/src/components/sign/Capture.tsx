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
      setCameraError("這台裝置沒有開相機。可以改上傳一張本人正面照片。");
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
        <label className="rounded-md border border-[var(--ink)] px-4 py-2 text-sm">
          改上傳人像
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (preview) URL.revokeObjectURL(preview);
              setPreview(file ? URL.createObjectURL(file) : null);
              onChange(file);
            }}
          />
        </label>
      </div>
      {cameraError ? <p className="text-sm text-[var(--danger,#7a261c)]">{cameraError}</p> : null}
    </div>
  );
}

export function SignaturePad({ onChange }: { onChange: (file: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 720 * ratio;
    canvas.height = 220 * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1a1916";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="h-44 w-full touch-none rounded-md border border-[var(--ink)] bg-white"
        onPointerDown={(event) => {
          const context = canvasRef.current?.getContext("2d");
          if (!context) return;
          drawing.current = true;
          canvasRef.current?.setPointerCapture(event.pointerId);
          const next = point(event);
          context.beginPath();
          context.moveTo(next.x, next.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = canvasRef.current?.getContext("2d");
          if (!context) return;
          const next = point(event);
          context.lineTo(next.x, next.y);
          context.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          exportInk();
        }}
      />
      <Button type="button" variant="secondary" onClick={clear}>清除簽名</Button>
    </div>
  );
}
