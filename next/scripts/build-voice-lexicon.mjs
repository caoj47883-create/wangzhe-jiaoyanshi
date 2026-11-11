// 生成英雄语音词库：把 133 个英雄、别名/外号、ASR 常见错字和拼音
// 预编译成运行时可用的 JSON，避免每次启动在 WebView 里反复算拼音。
//
// 用法（在 next/ 下）：
//   node scripts/build-voice-lexicon.mjs
//   node scripts/build-voice-lexicon.mjs --check   # 只校验生成物是否最新
//
// 数据源：
//   src/data/data.json                英雄名单（热更新同一份数据）
//   src/data/hero-voice-aliases.json  人工维护的别名/外号/ASR 变体
// 产物：
//   src/data/hero-voice-lexicon.json  运行时词库
//   ../docs/VOICE_LEXICON.md          人工可读词库表
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "src", "data", "data.json");
const ALIASES_PATH = path.join(ROOT, "src", "data", "hero-voice-aliases.json");
const OUT_JSON = path.join(ROOT, "src", "data", "hero-voice-lexicon.json");
const OUT_MD = path.resolve(ROOT, "..", "docs", "VOICE_LEXICON.md");
const CHECK = process.argv.includes("--check");

const PUNCT_RE = /[\s,，、。．.;；:：!！?？"'“”‘’（）()\[\]【】<>《》·\-—_/\\|+*=~`]+/g;
const normalizeText = (value) => String(value || "").toLowerCase().replace(PUNCT_RE, "");
const normalizeSyllable = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/ü/g, "v")
    .replace(/[^a-z]/g, "");

function toPinyinArray(text) {
  return pinyin(text, { toneType: "none", type: "array" })
    .map(normalizeSyllable)
    .filter(Boolean);
}

const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ALIASES = JSON.parse(fs.readFileSync(ALIASES_PATH, "utf8"));
const heroNames = new Set(DATA.heroes.map((hero) => hero.name));
const unknownAliasKeys = Object.keys(ALIASES).filter((name) => !heroNames.has(name));
if (unknownAliasKeys.length) {
  throw new Error(`别名表里有不存在的英雄：${unknownAliasKeys.join("、")}`);
}

const entries = [];
const termOwners = new Map();

for (const hero of DATA.heroes) {
  const name = String(hero.name || "");
  if (!name) continue;
  const terms = new Map();
  const add = (text, kind, weight) => {
    const plain = String(text || "").trim();
    const norm = normalizeText(plain);
    if (!norm) return;
    const old = terms.get(norm);
    if (old && old.weight >= weight) return;
    const py = toPinyinArray(plain);
    if (!py.length) throw new Error(`无法生成拼音：${name} / ${plain}`);
    terms.set(norm, { text: plain, kind, weight, pinyin: py });
  };

  add(name, "name", 1);
  const base = name.match(/^(.+?)[（(]/)?.[1];
  if (base) add(base, "base", 0.94);
  const aliases = ALIASES[name];
  if (aliases !== undefined && !Array.isArray(aliases)) {
    throw new Error(`别名格式应为数组：${name}`);
  }
  for (const alias of aliases || []) add(alias, "alias", 0.97);

  const termList = [...terms.values()];
  for (const term of termList) {
    const owners = termOwners.get(term.text.toLowerCase()) || new Set();
    owners.add(name);
    termOwners.set(term.text.toLowerCase(), owners);
  }

  entries.push({
    name,
    lane: hero.lane || "",
    lanes: Array.isArray(hero.lanes) ? hero.lanes : [],
    singleChar: [...name].length === 1,
    terms: termList,
  });
}

const expectedHeroes = 133;
if (entries.length !== expectedHeroes) {
  throw new Error(`英雄数量异常：期望 ${expectedHeroes}，实际 ${entries.length}`);
}

const ambiguous = [];
for (const [text, owners] of termOwners) {
  if (owners.size > 1) ambiguous.push({ text, names: [...owners] });
}
const unexpectedAmbiguous = ambiguous.filter((item) => item.text !== "元流之子");
if (unexpectedAmbiguous.length) {
  throw new Error(
    `出现未预期的共享词条：${unexpectedAmbiguous
      .map((item) => `${item.text} => ${item.names.join("/")}`)
      .join("；")}`,
  );
}

const singleCharHeroes = entries.filter((entry) => entry.singleChar).map((entry) => entry.name);
const aliasTermCount = entries.reduce(
  (sum, entry) => sum + entry.terms.filter((term) => term.kind === "alias").length,
  0,
);

const lexicon = {
  schemaVersion: 1,
  sourceDataVersion: DATA.version || "",
  sourceSnapshot: DATA.snapshot || "",
  heroCount: entries.length,
  aliasTermCount,
  singleCharHeroes,
  ambiguous,
  entries,
};

const jsonText = JSON.stringify(lexicon, null, 2) + "\n";

const mdRows = entries
  .map((entry) => {
    const aliases = entry.terms.filter((term) => term.kind === "alias").map((term) => term.text);
    const py = entry.terms.find((term) => term.kind === "name")?.pinyin.join(" ") || "";
    return `| ${entry.name} | ${entry.lane} | ${entry.singleChar ? "是" : ""} | ${
      aliases.length ? aliases.join("、") : "—"
    } | ${py} |`;
  })
  .join("\n");

const mdText = `# 英雄语音词库

> 由 \`next/scripts/build-voice-lexicon.mjs\` 自动生成，请勿手改本文件。
> 手工维护别名请改 \`next/src/data/hero-voice-aliases.json\`，然后重新运行生成脚本。

- 数据版本：${lexicon.sourceDataVersion}（快照 ${lexicon.sourceSnapshot}）
- 英雄数：${lexicon.heroCount}
- 别名/ASR 变体：${lexicon.aliasTermCount} 条
- 单字英雄（只接受精确命中）：${lexicon.singleCharHeroes.join("、")}
- 共享词条：${lexicon.ambiguous.map((item) => `\`${item.text}\`（${item.names.length} 个形态）`).join("、")}

| 英雄 | 分路 | 单字 | 别名 / 外号 / ASR 变体 | 拼音 |
| --- | --- | --- | --- | --- |
${mdRows}
`;

if (CHECK) {
  const currentJson = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, "utf8") : "";
  const currentMd = fs.existsSync(OUT_MD) ? fs.readFileSync(OUT_MD, "utf8") : "";
  if (currentJson !== jsonText || currentMd !== mdText) {
    console.error("词库生成物不是最新，请运行：cd next && node scripts/build-voice-lexicon.mjs");
    process.exit(1);
  }
  console.log("词库生成物已是最新。");
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_JSON, jsonText, "utf8");
fs.writeFileSync(OUT_MD, mdText, "utf8");
console.log(
  `词库已生成：${entries.length} 英雄 / ${aliasTermCount} 个别名 / ${lexicon.ambiguous.length} 组共享词条`,
);
console.log(`  ${OUT_JSON}`);
console.log(`  ${OUT_MD}`);
