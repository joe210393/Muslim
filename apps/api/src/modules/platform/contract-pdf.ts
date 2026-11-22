import { CONTRACT_PAGE_HEIGHT, CONTRACT_PAGE_WIDTH, paintContract, pngPagesToPdf, type ContractPainter } from "@mf/contracts";
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import path from "node:path";

let fontReady = false;

function ensureFont(repoRoot: string) {
  if (fontReady) return;
  GlobalFonts.registerFromPath(path.join(repoRoot, "apps/web/public/fonts/NotoSansTC-Subset.otf"), "NotoSansTC");
  fontReady = true;
}

type SealImages = {
  company?: Image | null;
  person?: Image | null;
};

function makePainter(repoRoot: string, pages: Uint8Array[], seals: SealImages = {}) {
  ensureFont(repoRoot);
  let canvas = createCanvas(CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
  let context = canvas.getContext("2d");
  const clear = () => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
    context.fillStyle = "#1a1916";
    context.strokeStyle = "#1a1916";
  };
  clear();
  const painter: ContractPainter = {
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
    strokeRect(x, y, width, height, lineWidth = 2) {
      context.strokeStyle = "#111111";
      context.lineWidth = lineWidth;
      context.strokeRect(x, y, width, height);
    },
    fillRect(x, y, width, height, color) {
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
      context.fillStyle = "#1a1916";
    },
    drawSeal(x, y, size, kind) {
      const image = kind === "company" ? seals.company : seals.person;
      if (image) {
        context.drawImage(image, x, y, size, size);
        return;
      }
      const radius = size / 2;
      const cx = x + radius;
      const cy = y + radius;
      context.save();
      context.strokeStyle = kind === "company" ? "#b91c1c" : "#9f1239";
      context.fillStyle = kind === "company" ? "rgba(185, 28, 28, 0.08)" : "rgba(159, 18, 57, 0.08)";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
      context.stroke();
      context.font = `${Math.max(18, Math.floor(size * 0.14))}px NotoSansTC`;
      context.fillStyle = context.strokeStyle;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(kind === "company" ? "公司大章" : "負責人小章", cx, cy);
      context.restore();
    },
    newPage() {
      pages.push(canvas.toBuffer("image/png"));
      canvas = createCanvas(CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
      context = canvas.getContext("2d");
      clear();
    },
  };
  return { painter, finish: () => {
    pages.push(canvas.toBuffer("image/png"));
    return pngPagesToPdf(pages);
  } };
}

async function imagesFromBytes(input?: {
  company?: { bytes: Uint8Array; mimeType: string } | null;
  person?: { bytes: Uint8Array; mimeType: string } | null;
}): Promise<SealImages> {
  const company = input?.company ? await loadImage(Buffer.from(input.company.bytes)) : null;
  const person = input?.person ? await loadImage(Buffer.from(input.person.bytes)) : null;
  return { company, person };
}

/** 業者下載用：依合約快照產生待蓋章 PDF（不含線上簽名）。 */
export async function renderIssuedContractPdf(
  repoRoot: string,
  input: { title: string; contractNo: string; body: string },
  sealBytes?: {
    company?: { bytes: Uint8Array; mimeType: string } | null;
    person?: { bytes: Uint8Array; mimeType: string } | null;
    layout?: {
      companySealX: number;
      companySealY: number;
      personSealX: number;
      personSealY: number;
    };
  },
) {
  const pages: Uint8Array[] = [];
  const seals = await imagesFromBytes(sealBytes);
  const { painter, finish } = makePainter(repoRoot, pages, seals);
  paintContract(painter, { ...input, mode: "unsigned", sealLayout: sealBytes?.layout });
  return finish();
}
