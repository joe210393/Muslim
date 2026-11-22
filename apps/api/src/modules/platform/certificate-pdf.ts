import { CONTRACT_PAGE_HEIGHT, CONTRACT_PAGE_WIDTH, paintCertificate, pngPagesToPdf, type CertificatePagePainter } from "@mf/contracts";
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import path from "node:path";

let fontReady = false;

function ensureFont(repoRoot: string) {
  if (fontReady) return;
  GlobalFonts.registerFromPath(path.join(repoRoot, "apps/web/public/fonts/NotoSansTC-Subset.otf"), "NotoSansTC");
  fontReady = true;
}

function drawFit(context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, image: Image, x: number, y: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  context.drawImage(image, x, y, w, h);
  return h;
}

export async function renderCertificatePdf(
  repoRoot: string,
  input: { body: string; logo?: Uint8Array | null; signature?: Uint8Array | null },
) {
  ensureFont(repoRoot);
  const logo = input.logo ? await loadImage(Buffer.from(input.logo)) : null;
  const signature = input.signature ? await loadImage(Buffer.from(input.signature)) : null;
  const canvas = createCanvas(CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
  context.fillStyle = "#1a1916";
  const painter: CertificatePagePainter = {
    fillText(text, x, y, size) {
      context.font = `${size}px NotoSansTC`;
      context.fillStyle = "#1a1916";
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillText(text, x, y);
    },
    measureText(text, size) {
      context.font = `${size}px NotoSansTC`;
      return context.measureText(text).width;
    },
    drawLogo(centerX, topY, maxW, maxH) {
      if (!logo) return 0;
      const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
      const w = logo.width * scale;
      drawFit(context, logo, centerX - w / 2, topY, maxW, maxH);
      return logo.height * scale;
    },
    drawAuditorSignature(x, topY, maxW, maxH) {
      if (!signature) return 0;
      return drawFit(context, signature, x, topY, maxW, maxH);
    },
    drawSignatureLine(x, y, width) {
      context.save();
      context.strokeStyle = "#1a1916";
      context.lineWidth = 1.5;
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + width, y);
      context.stroke();
      context.restore();
    },
  };
  paintCertificate(painter, { body: input.body });
  return pngPagesToPdf([canvas.toBuffer("image/png")]);
}
