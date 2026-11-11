// V2.3.0 BP 语音输入 MVP 自测：用 mock AppBridge 模拟原生 ASR 回调。
// 用法：node tools/test_voice_v230.mjs
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
const PORT = 8801;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=2", "--hide-scrollbars"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(() => {
  window.__voiceCalls = [];
  window.AppBridge = {
    voiceStart(id) {
      window.__voiceCalls.push(["start", id]);
      window.__voiceLastId = id;
    },
    voiceStop(id) {
      window.__voiceCalls.push(["stop", id]);
    },
    voiceCancel(id) {
      window.__voiceCalls.push(["cancel", id]);
    },
  };
});
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 30000 });
await sleep(800);

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name) });
  console.log("shot:", name);
}

async function clickTab(index) {
  await page.evaluate((i) => document.querySelectorAll(".tab")[i].click(), index);
  await sleep(450);
}

async function resetBp() {
  await page.evaluate(() => document.querySelector(".bp-reset")?.click());
  await sleep(350);
}

async function switchPhase(phase) {
  await page.evaluate((p) => {
    const index = p === "pick" ? 1 : 0;
    document.querySelectorAll(".bp-step")[index]?.click();
  }, phase);
  await sleep(350);
}

async function typeAndSubmit(value) {
  await page.evaluate((v) => {
    const input = document.querySelector(".bp-input input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.closest("form")?.requestSubmit();
  }, value);
  await sleep(350);
}

async function holdStart(text) {
  const id = await page.evaluate(() => {
    const mic = document.querySelector(".bp-mic");
    if (!mic) throw new Error("mic button not found");
    mic.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 12,
        isPrimary: true,
        pointerType: "touch",
      }),
    );
    return window.__voiceLastId || null;
  });
  if (!id) throw new Error("voiceStart was not called");
  await page.evaluate((requestId) => window.__voiceEvent(requestId, "ready", "{}"), id);
  await page.evaluate(
    ({ requestId, value }) =>
      window.__voiceEvent(requestId, "partial", JSON.stringify({ results: [{ text: value, confidence: 0 }] })),
    { requestId: id, value: text },
  );
  await page.evaluate((requestId) => window.__voiceEvent(requestId, "rms", JSON.stringify({ rms: 7 })), id);
  await sleep(250);
  return id;
}

async function finishHold(id, text) {
  await page.evaluate(() => {
    document.querySelector(".bp-mic")?.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 12, pointerType: "touch" }),
    );
  });
  await page.evaluate(
    ({ requestId, value }) =>
      window.__voiceEvent(requestId, "final", JSON.stringify({ results: [{ text: value, confidence: 0 }] })),
    { requestId: id, value: text },
  );
  await sleep(420);
}

async function speak(text, finalText = text) {
  const id = await holdStart(text);
  await finishHold(id, finalText);
  return id;
}

async function bans() {
  return page.evaluate(() => [...document.querySelectorAll(".bp-slot.filled .bp-slot-name")].map((el) => el.textContent));
}
async function panelInfo() {
  return page.evaluate(() => {
    const panel = document.querySelector(".bp-voice-result");
    return panel
      ? {
          chips: [...panel.querySelectorAll(".bp-voice-chip")].map((el) => el.textContent.trim()),
          buttons: [...panel.querySelectorAll(".bp-voice-result-actions button")].map((el) => el.textContent.trim()),
        }
      : null;
  });
}

const report = {};
await clickTab(2);
await page.waitForSelector(".bp-page", { timeout: 5000 });
report.before = await page.evaluate(() => ({
  mic: !!document.querySelector(".bp-mic"),
  help: document.querySelector(".bp-voice-help")?.textContent || "",
}));

// 0. 键盘精确识别回归：Ban 阶段 / 选将阶段
await typeAndSubmit("东皇太一 张良");
report.textBan = await bans();
await resetBp();
await switchPhase("pick");
await typeAndSubmit("马可波罗");
report.textPick = await page.evaluate(() =>
  [...document.querySelectorAll(".bp-slot.filled .bp-slot-name")].map((el) => el.textContent),
);

// 1. 纯 Ban，两个英雄自动填入
await resetBp();
await switchPhase("ban");
await speak("对面 ban 东皇太一，还 ban 了张良");
report.autoBan = await bans();
report.autoPanel = await panelInfo();
await shot("v2.3.0-voice-auto.png");

// 2. 切到选将阶段，五形态元流之子 → 应弹候选面板而不是自动填
await resetBp();
await switchPhase("pick");
await speak("对面选了元流之子");
report.ambiguousPicks = await page.evaluate(() => document.querySelectorAll(".bp-slot.filled").length);
report.ambiguousPanel = await panelInfo();
await shot("v2.3.0-voice-candidates.png");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await sleep(180);
await shot("v2.3.0-voice-candidates-light.png");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await sleep(120);

// 3. 候选面板点击后填入
await page.evaluate(() => document.querySelector(".bp-voice-chip")?.click());
await page.evaluate(() => {
  const button = [...document.querySelectorAll(".bp-voice-result-actions button")].find((el) =>
    el.textContent.includes("填入"),
  );
  button?.click();
});
await sleep(350);
report.afterChipFill = await page.evaluate(() => ({
  picks: [...document.querySelectorAll(".bp-slot.filled .bp-slot-name")].map((el) => el.textContent),
  panel: !!document.querySelector(".bp-voice-result"),
}));

// 4. 混合意图 → 两个动作按钮
await resetBp();
await switchPhase("ban");
await speak("ban 盾山，然后选马可波罗");
report.mixedPanel = await panelInfo();
await shot("v2.3.0-voice-mixed.png");

// 5. 完全没听清 → 原话落回输入框
await resetBp();
await speak("对面 ban 经济");
report.noMatch = await page.evaluate(() => ({
  input: document.querySelector(".bp-input input")?.value || "",
  panel: !!document.querySelector(".bp-voice-result"),
}));

// 5b. 词库回归：外号、ASR 错字、单字英雄、元流形态
report.aliases = {};
for (const [say, phase, expected] of [
  ["ban 张亮", "ban", ["张良"]],
  ["ban 姚", "ban", ["瑶"]],
  ["ban 鲁班", "ban", ["鲁班七号"]],
  ["ban 鲁班大师", "ban", ["鲁班大师"]],
  ["打野镜", "ban", ["镜"]],
  ["对面 ban 六耳", "ban", ["六耳"]],
  ["ban 空空", "ban", ["空空儿"]],
  ["ban 敖影", "ban", ["敖隐"]],
  ["ban 苍", "ban", ["苍"]],
  ["选 元射", "pick", ["元流之子(射手)"]],
]) {
  await resetBp();
  await switchPhase(phase);
  await speak(say);
  report.aliases[say] = await page.evaluate(() =>
    [...document.querySelectorAll(".bp-slot.filled .bp-slot-name")].map((el) => el.textContent),
  );
  if (JSON.stringify(report.aliases[say]) !== JSON.stringify(expected)) {
    errors.push(`alias mismatch: ${say} => ${JSON.stringify(report.aliases[say])}, expected ${JSON.stringify(expected)}`);
  }
}

// 6. 按住说话时的状态条、音量条
await resetBp();
await switchPhase("ban");
const holdId = await holdStart("对面 ban 东皇太一");
report.listening = await page.evaluate(() => {
  const status = document.querySelector(".bp-voice");
  return {
    visible: !!status,
    text: status?.textContent || "",
    bars: status ? [...status.querySelectorAll(".bp-voice-bars i")].length : 0,
  };
});
await shot("v2.3.0-voice-listening.png");
await finishHold(holdId, "对面 ban 东皇太一");
report.listeningAfter = await page.evaluate(() => ({
  status: !!document.querySelector(".bp-voice"),
  bans: [...document.querySelectorAll(".bp-slot.filled .bp-slot-name")].map((el) => el.textContent),
}));

report.errors = errors;
console.log(JSON.stringify(report, null, 2));

await browser.close();
server.close();
