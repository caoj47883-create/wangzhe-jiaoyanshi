/**
 * 从英雄语音词库生成 sherpa-onnx 热词文件。
 *
 * 用法：
 *   node scripts/build-asr-hotwords.mjs [tokens.txt] [输出文件]
 *
 * 热词文件格式：一行一个短语，按模型 tokens.txt 切成单字 token，空格分隔。
 * 只收录长度 >= 2 的纯中文词条，避免单字热词造成过度偏置。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const nextDir = path.resolve(here, "..");
const defaultTokens = path.resolve(
  nextDir,
  "..",
  "toolchain",
  "asr",
  "sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30",
  "sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30",
  "tokens.txt",
);
const tokensPath = process.argv[2] || defaultTokens;
const outputPath = process.argv[3] || path.join(nextDir, "src", "data", "asr-hotwords.txt");

const lexicon = JSON.parse(
  fs.readFileSync(path.join(nextDir, "src", "data", "hero-voice-lexicon.json"), "utf8"),
);

if (!fs.existsSync(tokensPath)) {
  console.error(`找不到 tokens.txt：${tokensPath}`);
  process.exit(1);
}

const vocab = new Set();
for (const line of fs.readFileSync(tokensPath, "utf8").split(/\r?\n/)) {
  const text = line.trim();
  if (!text) continue;
  const token = text.split(/\s+/)[0];
  if (token) vocab.add(token);
}

const seen = new Set();
const lines = [];
const skipped = [];
for (const entry of lexicon.entries || []) {
  for (const term of entry.terms || []) {
    const text = String(term?.text || "").trim();
    if ([...text].length < 2) continue;
    if (!/^[\u3400-\u9fff]+$/.test(text)) continue;
    const chars = [...text];
    if (!chars.every((c) => vocab.has(c))) {
      skipped.push(text);
      continue;
    }
    const line = chars.join(" ");
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      output: outputPath,
      hotwords: lines.length,
      skipped: skipped.length,
      skippedSample: skipped.slice(0, 8),
    },
    null,
    2,
  ),
);
