"use client";

import type { OutlineRequest } from "./schema";

export interface ExtractedPage {
  n: number; // 1-based page number (0 for standalone images)
  text: string;
  image?: { media_type: "image/jpeg"; data: string };
  source: string; // file name
}

export interface Extracted {
  name: string;
  pages: ExtractedPage[];
  totalChars: number;
  pdfPages: number;
}

export const MAX_CHARS = Number(process.env.NEXT_PUBLIC_MAX_CHARS || 30000);
export const MAX_IMAGES = 12;
const MAX_BODY_BYTES = 4_000_000;

type Progress = (msg: string, ratio: number) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsPromise: Promise<any> | null = null;
async function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m: any) => {
    const lib = m.default ?? m;
    lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return lib;
  });
  return pdfjsPromise;
}

function cleanText(s: string) {
  return s
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Heuristic: text extraction produced garbage (missing ToUnicode maps etc.). */
function looksGarbled(s: string) {
  if (!s) return false;
  const chars = Array.from(s.replace(/\s/g, ""));
  if (chars.length < 20) return false;
  let bad = 0;
  for (const ch of chars) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0xfffd || (c >= 0xe000 && c <= 0xf8ff) || c < 0x20) bad++;
  }
  return bad / chars.length > 0.2;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.78): Promise<string> {
  const url = canvas.toDataURL("image/jpeg", quality);
  return url.slice(url.indexOf(",") + 1);
}

async function imageFileToJpeg(file: File, maxSide = 1568): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToJpeg(canvas, 0.85);
}

async function renderPdfPage(page: any, targetWidth = 1100): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2.5, targetWidth / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvasToJpeg(canvas, 0.72);
}

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const isImage = (f: File) => /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);

/** Reads PDFs (text per page; low-text pages rendered as images) and photos. */
export async function extractFiles(files: File[], onProgress: Progress): Promise<Extracted> {
  const pages: ExtractedPage[] = [];
  let pdfPages = 0;
  const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : `${files[0].name.replace(/\.[^.]+$/, "")} 외 ${files.length - 1}개`;

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (isPdf(file)) {
      onProgress(`${file.name} 여는 중`, 0.02);
      const pdfjs = await loadPdfjs();
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({
        data,
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
        isEvalSupported: false,
      }).promise;
      pdfPages += doc.numPages;
      for (let i = 1; i <= doc.numPages; i++) {
        onProgress(`${i} / ${doc.numPages}쪽 읽는 중`, i / doc.numPages);
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        let text = "";
        for (const item of tc.items as any[]) {
          if (typeof item.str !== "string") continue;
          text += item.str;
          text += item.hasEOL ? "\n" : " ";
        }
        text = cleanText(text);
        const garbled = looksGarbled(text);
        if (garbled) text = "";
        pages.push({ n: i, text, source: file.name });
        page.cleanup?.();
      }
      // render pages that have (almost) no text: scanned pages, slides that are images
      const lowText = pages.filter((p) => p.source === file.name && p.text.replace(/\s/g, "").length < 40);
      let rendered = 0;
      for (const p of lowText) {
        if (pages.filter((q) => q.image).length >= MAX_IMAGES) break;
        onProgress(`이미지로 된 ${p.n}쪽 읽는 중`, rendered / Math.max(1, lowText.length));
        const page = await doc.getPage(p.n);
        p.image = { media_type: "image/jpeg", data: await renderPdfPage(page) };
        rendered++;
      }
      await doc.destroy?.();
    } else if (isImage(file)) {
      onProgress(`${file.name} 사진 준비 중`, (fi + 1) / files.length);
      try {
        const data = await imageFileToJpeg(file);
        pages.push({ n: 0, text: "", image: { media_type: "image/jpeg", data }, source: file.name });
      } catch {
        throw new Error(`${file.name} 사진을 열 수 없어요. JPG나 PNG로 다시 시도해 주세요.`);
      }
    } else {
      throw new Error(`${file.name}: PDF, JPG, PNG 파일만 올릴 수 있어요.`);
    }
  }

  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);
  const hasImages = pages.some((p) => p.image);
  if (totalChars < 30 && !hasImages) throw new Error("파일에서 읽을 수 있는 글자를 찾지 못했어요.");
  return { name, pages, totalChars, pdfPages };
}

/** Builds the request for a page range (1-based, inclusive, PDF pages only). */
export function buildOutlineRequest(ex: Extracted, count: number, range?: { from: number; to: number }): OutlineRequest {
  const inRange = (p: ExtractedPage) => !range || p.n === 0 || (p.n >= range.from && p.n <= range.to);
  const chosen = ex.pages.filter(inRange);
  const req: OutlineRequest = {
    name: ex.name,
    count,
    pages: chosen.filter((p) => p.text).map((p) => ({ n: p.n, text: p.text })),
    images: chosen
      .filter((p) => p.image)
      .slice(0, MAX_IMAGES)
      .map((p) => ({ n: p.n, media_type: p.image!.media_type, data: p.image!.data })),
  };
  // keep the request under the serverless body limit
  while (JSON.stringify(req).length > MAX_BODY_BYTES && req.images.length > 0) req.images.pop();
  return req;
}

export function charsInRange(ex: Extracted, from: number, to: number) {
  return ex.pages.filter((p) => p.n >= from && p.n <= to).reduce((s, p) => s + p.text.length, 0);
}

/** Largest range starting at `from` that fits MAX_CHARS. */
export function fitRange(ex: Extracted, from = 1) {
  let total = 0;
  let to = from;
  for (const p of ex.pages.filter((q) => q.n >= from).sort((a, b) => a.n - b.n)) {
    if (total + p.text.length > MAX_CHARS && p.n > from) break;
    total += p.text.length;
    to = p.n;
  }
  return { from, to };
}
