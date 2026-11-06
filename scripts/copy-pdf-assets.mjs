// Copies the pdf.js worker, CMaps and standard fonts into /public so the
// browser can load them from our own domain (no CDN dependency).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let root;
try {
  root = dirname(require.resolve("pdfjs-dist/package.json"));
} catch {
  console.warn("[copy-pdf-assets] pdfjs-dist not installed yet, skipping");
  process.exit(0);
}
const pub = join(process.cwd(), "public", "pdfjs");
mkdirSync(pub, { recursive: true });
const worker = ["build/pdf.worker.min.mjs", "build/pdf.worker.mjs"].find((p) => existsSync(join(root, p)));
if (worker) cpSync(join(root, worker), join(pub, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
  if (existsSync(join(root, dir))) cpSync(join(root, dir), join(pub, dir), { recursive: true });
}
console.log("[copy-pdf-assets] copied pdf.js assets to public/pdfjs");
