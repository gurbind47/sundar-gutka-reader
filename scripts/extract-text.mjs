#!/usr/bin/env node
/**
 * Rebuild data/text-index.json from assets/sundar-gutka.pdf.
 *
 * Requires: python3 + pymupdf, and anvaad-js (npm i anvaad-js).
 * Usage: node scripts/extract-text.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "text-index.json");
const tmpAscii = join(root, "data", ".pages-ascii.json");

const py = `
import json, sys
try:
    import pymupdf
except ImportError:
    import fitz as pymupdf
pdf = sys.argv[1]
out = sys.argv[2]
d = pymupdf.open(pdf)
pages = [{"page": i, "ascii": p.get_text("text")} for i, p in enumerate(d, start=1)]
with open(out, "w", encoding="utf-8") as f:
    json.dump(pages, f, ensure_ascii=False)
print(len(pages))
`;

const pdfPath = join(root, "assets", "sundar-gutka.pdf");
mkdirSync(join(root, "data"), { recursive: true });

const r = spawnSync("python3", ["-c", py, pdfPath, tmpAscii], { encoding: "utf-8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log("Extracted ASCII for", (r.stdout || "").trim(), "pages");

let anvaad;
try {
  const require = createRequire(import.meta.url);
  anvaad = require("anvaad-js");
} catch {
  try {
    anvaad = await import("anvaad-js");
  } catch {
    console.error("Install anvaad-js first: npm i anvaad-js");
    process.exit(1);
  }
}

const pages = JSON.parse(readFileSync(tmpAscii, "utf8"));
const convert = anvaad.unicode || anvaad.default?.unicode;
const converted = pages.map((p) =>
  p.ascii
    .split(/\r?\n/)
    .map((line) => {
      try {
        return convert(line);
      } catch {
        return line;
      }
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
);

writeFileSync(
  outPath,
  JSON.stringify({ v: 1, pages: converted }, null, 0),
  "utf8"
);
console.log("Wrote", outPath, "(" + converted.length + " pages)");
console.log("Sample p.11:\n" + converted[10].slice(0, 200));
