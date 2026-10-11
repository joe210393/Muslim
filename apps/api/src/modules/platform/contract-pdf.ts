import { CONTRACT_PAGE_HEIGHT, CONTRACT_PAGE_WIDTH, paintContract, pngPagesToPdf, type ContractPainter } from "@mf/contracts";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import path from "node:path";

let fontReady = false;

function ensureFont(repoRoot: string) {
  if (fontReady) return;
  GlobalFonts.registerFromPath(path.join(repoRoot, "apps/web/public/fonts/NotoSansTC-Subset.otf"), "NotoSansTC");
  fontReady = true;
}

export async function renderSignedPdf(
  repoRoot: string,
  input: {
    title: string;
    contractNo: string;
    body: string;
    signerName: string;
    signerTitle: string;
    signedAtLabel: string;
    signaturePng: Uint8Array;
    faceBytes: Uint8Array;
  },
) {
  ensureFont(repoRoot);
  const signature = await loadImage(Buffer.from(input.signaturePng));
  const face = await loadImage(Buffer.from(input.faceBytes));
  const pages: Uint8Array[] = [];
  let canvas = createCanvas(CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
  let context = canvas.getContext("2d");
  const clear = () => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
    context.fillStyle = "#1a1916";
  };
  clear();
  const painter: ContractPainter = {
    fillText(text, x, y, size) {
      context.font = `${size}px NotoSansTC`;
      context.fillText(text, x, y);
    },
    drawSignature(x, y, width, height) {
      context.drawImage(signature, x, y, width, height);
    },
    drawFace(x, y, width, height) {
      context.drawImage(face, x, y, width, height);
    },
    newPage() {
      pages.push(canvas.toBuffer("image/png"));
      canvas = createCanvas(CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
      context = canvas.getContext("2d");
      clear();
    },
  };
  paintContract(painter, input);
  pages.push(canvas.toBuffer("image/png"));
  return pngPagesToPdf(pages);
}
