// Formula page visual smoke test (lane-based + original canyon map).
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
await sleep(700);

const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, name) }); console.log("shot:", name); };
const openFormula = async () => {
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll(".quick-row")).find((b) => b.textContent.includes("公式化打法"));
    if (!row) throw new Error("formula entry not found");
    row.click();
  });
  await sleep(500);
  await page.evaluate(async () => {
    const img = document.querySelector(".fm-map-canvas img");
    if (img && img.decode) await img.decode().catch(() => {});
  });
};
const clickLane = async (i) => {
  await page.evaluate((n) => {
    const tabs = document.querySelectorAll(".fm-lane-tab");
    if (!tabs[n]) throw new Error("lane tab not found");
    tabs[n].click();
  }, i);
  await sleep(260);
};

await openFormula();
console.log("formula metrics:", JSON.stringify(await page.evaluate(() => {
  const r = document.querySelector(".fm-map-canvas")?.getBoundingClientRect();
  const img = document.querySelector(".fm-map-canvas img");
  return {
    bodyW: document.body.scrollWidth,
    viewW: window.innerWidth,
    map: r ? { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) } : null,
    mapLoaded: img ? img.naturalWidth : 0,
    title: document.querySelector(".page-head .h1")?.textContent,
    tabs: Array.from(document.querySelectorAll(".fm-lane-tab")).map((b) => b.textContent.trim()),
  };
})));

await shot("formula-lane-clash-dark.png");
await clickLane(1); await shot("formula-lane-jungle-dark.png");
await clickLane(2); await shot("formula-lane-mid-dark.png");
await clickLane(3); await shot("formula-lane-farm-dark.png");
await clickLane(4); await shot("formula-lane-roam-dark.png");
await clickLane(0);

await page.evaluate(() => { document.querySelector(".page").scrollTo({ top: 540, behavior: "instant" }); });
await sleep(260);
await shot("formula-lane-detail-dark.png");
await page.evaluate(() => { document.querySelector(".page").scrollTo({ top: 1220, behavior: "instant" }); });
await sleep(260);
await shot("formula-formulas-dark.png");
await page.evaluate(() => { document.querySelector(".page").scrollTo({ top: 1780, behavior: "instant" }); });
await sleep(260);
await shot("formula-collection-dark.png");

await page.evaluate(() => {
  const KEY = "wzjs.v2.state";
  const old = JSON.parse(localStorage.getItem(KEY) || "{}");
  localStorage.setItem(KEY, JSON.stringify({ ...old, theme: "light" }));
});
await page.reload({ waitUntil: "networkidle0" });
await sleep(550);
await openFormula();
await shot("formula-lane-clash-light.png");
await clickLane(2); await shot("formula-lane-mid-light.png");
await page.evaluate(() => { document.querySelector(".page").scrollTo({ top: 540, behavior: "instant" }); });
await sleep(260);
await shot("formula-lane-detail-light.png");

console.log("errors:", JSON.stringify(errors));
await browser.close();
server.close();
if (errors.length) process.exitCode = 1;
