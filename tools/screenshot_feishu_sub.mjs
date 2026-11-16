// Feishu-style subpage screenshots.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "next", "dist");
const SHOTS = path.join(ROOT, "next", "shots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 8815;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=2", "--hide-scrollbars"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 30000 });
await sleep(500);
const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, name) }); console.log("shot:", name); };
const tab = async (i) => { await page.evaluate((n) => document.querySelectorAll(".tab")[n].click(), i); await sleep(300); };
const openMore = async () => {
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(450);
  await tab(4);
};
const clickRow = async (label) => {
  const ok = await page.evaluate((text) => {
    const el = [...document.querySelectorAll(".row")].find((b) => b.textContent.includes(text));
    if (el) { el.click(); return true; }
    return false;
  }, label);
  await sleep(450);
  return ok;
};

await openMore();
console.log("settings?", await clickRow("设置"));
await shot("feishu-settings-dark.png");

await openMore();
console.log("coaches?", await clickRow("名师课堂"));
await shot("feishu-coaches-dark.png");

await openMore();
console.log("comps?", await clickRow("五黑阵容"));
await shot("feishu-comps-dark.png");

await openMore();
console.log("favorites?", await clickRow("我的收藏"));
await shot("feishu-favorites-dark.png");

await openMore();
console.log("search?", await clickRow("全局搜索"));
await shot("feishu-search-dark.png");

await openMore();
console.log("ai?", await clickRow("AI 问答"));
await shot("feishu-ai-dark.png");

console.log("errors:", JSON.stringify(errors));
await browser.close();
server.close();
if (errors.length) process.exitCode = 1;
