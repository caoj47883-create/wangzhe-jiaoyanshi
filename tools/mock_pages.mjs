/**
 * 本地模拟 GitHub Pages + 外部 AI 接口（仅用于端到端验证，不参与发布）
 * 用法：node tools/mock_pages.mjs <publishDir> [port]
 *  - GET /wzjs/v1/**        正常发布包（带 CORS，模拟 GitHub Pages）
 *  - GET /bad/v1/**         数据版本更高但 sha256 错误（用于验证哈希校验拒绝更新）
 *  - POST /ai/v1/chat/completions   模拟 OpenAI 兼容接口
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8774);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function fileType(p) {
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const u = new URL(req.url, "http://127.0.0.1");
    let p = decodeURIComponent(u.pathname);

    // 模拟 AI 接口
    if (p === "/ai/v1/chat/completions" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let question = "";
        try {
          const j = JSON.parse(body);
          const last = j.messages[j.messages.length - 1];
          question = (last && last.content) || "";
        } catch (e) {
          /* ignore */
        }
        const content =
          "【Mock AI】我收到了你的问题：" +
          String(question).slice(0, 60) +
          "。\n\n建议：\n1. 对线期先稳线权，别硬拼；\n2. 中期跟打野控龙，别单带；\n3. 团战优先保后排，等对面强开技能交完再反手。";
        res.writeHead(200, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
      });
      return;
    }

    if (p.startsWith("/bad/v1/")) {
      p = p.slice("/bad".length); // /v1/...
      if (p === "/v1/manifest.json") {
        const m = readJson("manifest.json");
        m.dataVersion = "2099.01.01.1";
        m.files["data.json"].sha256 = "0".repeat(64);
        m.patch = { id: "bad", title: "哈希错误测试", date: "2099-01-01" };
        res.writeHead(200, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(m));
        return;
      }
      p = p.replace(/^\/v1\//, "/");
    } else if (p.startsWith("/wzjs/v1/")) {
      p = p.slice("/wzjs/v1".length); // /...
    } else {
      res.writeHead(404, { ...CORS, "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }

    const file = path.join(ROOT, p.replace(/^\/+/, ""));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { ...CORS, "Content-Type": "text/plain" });
      res.end("not found: " + p);
      return;
    }
    res.writeHead(200, { ...CORS, "Content-Type": fileType(file) });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log("mock pages+ai server on http://127.0.0.1:" + PORT);
  });
