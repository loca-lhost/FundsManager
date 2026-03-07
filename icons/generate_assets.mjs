import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputs = [path.join(root, "icons"), path.join(root, "frontend-lite", "public")];

const pwaSvg = await fs.readFile(path.join(root, "icons", "icon.svg"), "utf8");
const browserSvg = await fs.readFile(path.join(root, "icons", "favicon.svg"), "utf8");
const whiteSvg = await fs.readFile(path.join(root, "icons", "favicon-dark.svg"), "utf8");
const monoSvg = await fs.readFile(path.join(root, "icons", "icon-monochrome.svg"), "utf8");

function pageHtml({ size, transparent, svg, scale = 0.84, background = "", shadow = false }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: ${transparent ? "transparent" : "#0a2249"};
      }
      body {
        position: relative;
        display: grid;
        place-items: center;
      }
      .layer {
        position: absolute;
        inset: 0;
      }
      .symbol {
        position: relative;
        width: ${Math.round(scale * 100)}%;
        height: ${Math.round(scale * 100)}%;
        display: grid;
        place-items: center;
        ${shadow ? `filter: drop-shadow(0 ${Math.round(size * 0.03)}px ${Math.round(size * 0.06)}px rgba(4, 16, 42, 0.24));` : ""}
      }
      .symbol svg {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    ${background}
    <div class="symbol">${svg}</div>
  </body>
</html>`;
}

async function renderPng(page, { content, size, file, transparent = false }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(content);
  await page.screenshot({ path: file, omitBackground: transparent });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

const sizes = [
  { name: "favicon-16x16.png", size: 16, kind: "transparent", scale: 0.86 },
  { name: "favicon-32x32.png", size: 32, kind: "transparent", scale: 0.86 },
  { name: "icon-192.png", size: 192, kind: "app", scale: 1 },
  { name: "icon-512.png", size: 512, kind: "app", scale: 1 },
  { name: "icon-1024.png", size: 1024, kind: "app", scale: 1 },
  { name: "icon-2048.png", size: 2048, kind: "app", scale: 1 },
  { name: "icon-192-monochrome.png", size: 192, kind: "mono", scale: 0.88 },
  { name: "icon-512-monochrome.png", size: 512, kind: "mono", scale: 0.88 },
  { name: "icon-192-maskable.png", size: 192, kind: "maskable", scale: 0.7 },
  { name: "icon-512-maskable.png", size: 512, kind: "maskable", scale: 0.7 },
  { name: "icon-1024-maskable.png", size: 1024, kind: "maskable", scale: 0.7 },
  { name: "icon-2048-maskable.png", size: 2048, kind: "maskable", scale: 0.7 },
  { name: "apple-touch-icon.png", size: 180, kind: "apple", scale: 0.76 },
];

for (const outputDir of outputs) {
  for (const item of sizes) {
    let content;
    if (item.kind === "transparent") {
      content = pageHtml({ size: item.size, transparent: true, svg: browserSvg, scale: item.scale, shadow: false });
    } else if (item.kind === "app") {
      content = pageHtml({ size: item.size, transparent: false, svg: pwaSvg, scale: item.scale, shadow: false });
    } else if (item.kind === "mono") {
      content = pageHtml({ size: item.size, transparent: true, svg: monoSvg, scale: item.scale, shadow: false });
    } else if (item.kind === "maskable") {
      content = pageHtml({ size: item.size, transparent: false, svg: whiteSvg, scale: item.scale, shadow: false });
    } else {
      content = pageHtml({ size: item.size, transparent: false, svg: whiteSvg, scale: item.scale, shadow: false });
    }

    await renderPng(page, {
      content,
      size: item.size,
      file: path.join(outputDir, item.name),
      transparent: item.kind === "transparent" || item.kind === "mono",
    });
  }
}

await browser.close();
