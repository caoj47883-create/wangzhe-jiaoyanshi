/**
 * 英雄语音匹配：把 ASR 的 N-best 文本映射到 133 个英雄名。
 *
 * 设计原则：
 * 1. 这是“封闭词表 + 短句槽位”问题，不是通用自然语言理解；
 * 2. 拼音优先，字符相似度兜底，允许 ASR 近音错字（张亮 -> 张良）；
 * 3. 单字英雄（镜/曜/铠/瑶/澜/影/暃/苍）只在原文精确出现时才自动采用；
 * 4. 优先选择更长的命中（“鲁班大师”不能被“鲁班”抢走）；
 * 5. 英雄别名/外号/ASR 变体来自 `src/data/hero-voice-lexicon.json`，
 *    由 `scripts/build-voice-lexicon.mjs` 从人工维护的别名表预生成。
 */
import { pinyin } from "pinyin-pro";
import { HEROES } from "./data.js";
import LEXICON_DATA from "../data/hero-voice-lexicon.json";

const PUNCT_RE = /[\s,，、。．.;；:：!！?？"'“”‘’（）()\[\]【】<>《》·\-—_/\\|+*=~`]+/g;
const FUZZY_INITIALS = new Set(["zh", "ch", "sh"]);
const BASE_SINGLE_CHAR_HEROES = ["铠", "曜", "镜", "瑶", "澜", "影", "暃"];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(PUNCT_RE, "");
}

function normalizeSyllable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ü/g, "v")
    .replace(/[^a-z]/g, "");
}

function toPinyinArray(text) {
  try {
    return pinyin(text, { toneType: "none", type: "array" })
      .map(normalizeSyllable)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const SINGLE_CHAR_HEROES = new Set([
  ...(Array.isArray(LEXICON_DATA?.singleCharHeroes) ? LEXICON_DATA.singleCharHeroes : []),
  ...BASE_SINGLE_CHAR_HEROES,
]);

export const HERO_VOICE_LEXICON_META = {
  heroCount: Number(LEXICON_DATA?.heroCount) || 0,
  aliasTermCount: Number(LEXICON_DATA?.aliasTermCount) || 0,
  sourceDataVersion: LEXICON_DATA?.sourceDataVersion || "",
};

const STATIC_ENTRIES = new Map(
  (Array.isArray(LEXICON_DATA?.entries) ? LEXICON_DATA.entries : [])
    .filter((entry) => entry && entry.name)
    .map((entry) => [entry.name, entry]),
);

function levenshtein(a, b, cost = (x, y) => (x === y ? 0 : 1)) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + cost(a[i - 1], b[j - 1]),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

function syllableCost(a, b) {
  if (a === b) return 0;
  const x = a.replace(/ü/g, "v");
  const y = b.replace(/ü/g, "v");
  if (x === y) return 0;
  if (FUZZY_INITIALS.has(x) && y === x[0]) return 0.35;
  if (FUZZY_INITIALS.has(y) && x === y[0]) return 0.35;
  if ((x === "n" && y === "l") || (x === "l" && y === "n")) return 0.4;
  if ((x === "f" && y === "h") || (x === "h" && y === "f")) return 0.4;
  if (x.length > 1 && y.length > 1) {
    if (x[0] === y[0]) return x.slice(1) === y.slice(1) ? 0.25 : 0.55;
    if (x.slice(1) === y.slice(1)) return 0.45;
  }
  return 1;
}

function charCost(a, b) {
  if (a === b) return 0;
  const left = a.codePointAt(0) || 0;
  const right = b.codePointAt(0) || 0;
  if (Math.abs(left - right) === 1) return 0.85;
  return 1;
}

/** 在 haystack 上滑动一个长度接近 needle 的窗口，取最高相似度。 */
function windowSimilarity(needle, haystack, cost, pad = 2) {
  const m = needle.length;
  if (!m || !haystack.length) return 0;
  let best = 0;
  for (let extra = -pad; extra <= pad; extra++) {
    const len = m + extra;
    if (len < 1 || len > haystack.length) continue;
    for (let start = 0; start + len <= haystack.length; start++) {
      const window = haystack.slice(start, start + len);
      const distance = levenshtein(needle, window, cost);
      const similarity = 1 - distance / Math.max(m, len);
      if (similarity > best) best = similarity;
      if (best >= 1) return 1;
    }
  }
  return Math.max(0, Math.min(1, best));
}

let LEXICON = null;

function buildLexicon() {
  const list = [];
  for (const hero of HEROES) {
    const name = String(hero?.name || "");
    if (!name) continue;
    const variants = new Map();
    const add = (text, kind, weight, precomputedPinyin) => {
      const norm = normalizeText(text);
      if (!norm) return;
      const old = variants.get(norm);
      if (old && old.weight >= weight) return;
      const py = Array.isArray(precomputedPinyin)
        ? precomputedPinyin.filter(Boolean)
        : toPinyinArray(text);
      if (!py.length) return;
      variants.set(norm, {
        text,
        norm,
        pinyin: py,
        kind,
        weight,
      });
    };

    const staticEntry = STATIC_ENTRIES.get(name);
    if (staticEntry && Array.isArray(staticEntry.terms)) {
      for (const term of staticEntry.terms) {
        if (!term?.text) continue;
        add(
          term.text,
          term.kind || "alias",
          Number(term.weight) || 1,
          Array.isArray(term.pinyin) ? term.pinyin : null,
        );
      }
    }

    // 热更新数据可能带来静态词库尚未覆盖的新英雄：至少保留本名。
    if (!variants.size) add(name, "name", 1);

    if ([...name].length === 1) SINGLE_CHAR_HEROES.add(name);
    list.push({ name, variants: [...variants.values()] });
  }
  return list;
}

function getLexicon() {
  if (!LEXICON) LEXICON = buildLexicon();
  return LEXICON;
}

function bestVariantFor(hero, normText, pinyinText, chars) {
  let best = null;
  for (const variant of hero.variants) {
    const exact = normText.includes(variant.norm);
    const pinyinSimilarity = exact
      ? 1
      : windowSimilarity(variant.pinyin, pinyinText, syllableCost, 2);
    const charSimilarity = exact
      ? 1
      : windowSimilarity([...variant.norm], chars, charCost, 2);

    if (!exact && variant.norm.length === 1) continue;
    if (!exact && pinyinSimilarity < 0.45 && charSimilarity < 0.5) continue;

    const base = exact
      ? 1
      : 0.72 * pinyinSimilarity + 0.2 * charSimilarity + 0.08 * variant.weight;
    if (!best || base > best.base) {
      best = {
        base,
        exact,
        variant: variant.text,
        variantNorm: variant.norm,
        variantPinyin: variant.pinyin,
        pinyinSimilarity,
        charSimilarity,
      };
    }
  }
  return best;
}

const LANE_RULES = [
  ["clash", /对抗路|对抗|边路|上单/],
  ["jungle", /打野|野区|野位|蓝领野/],
  ["mid", /中路|中单|法刺|法师/],
  ["farm", /发育路|发育|射手|下路/],
  ["support", /辅助|游走|游走位/],
];

function detectLane(raw) {
  for (const [lane, re] of LANE_RULES) {
    if (re.test(raw)) return lane;
  }
  return "";
}

function detectAction(raw) {
  const text = raw.toLowerCase();
  // “以抢代 ban”是选人，不是禁用
  if (/以抢代ban|先抢|抢下|抢到/.test(text)) return "pick";
  const hasBan = /ban|禁|搬|按掉|按了/.test(text);
  const hasPick = /选|拿|pick|一选/.test(text);
  if (hasBan && hasPick) return "mixed";
  if (hasBan) return "ban";
  if (hasPick) return "pick";
  return "";
}

function containsSequence(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    let same = true;
    for (let i = 0; i < needle.length; i++) {
      if (haystack[start + i] !== needle[i]) {
        same = false;
        break;
      }
    }
    if (same) return true;
  }
  return false;
}

function postFilter(candidates) {
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const filtered = sorted.filter((candidate, index) => {
    return !sorted.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      if (!other.exact) return false;
      if (
        other.variantNorm.length > candidate.variantNorm.length &&
        other.variantNorm.includes(candidate.variantNorm)
      ) {
        if (other.score >= candidate.score - 0.08) return true;
      }
      if (
        other.variantPinyin.length > candidate.variantPinyin.length &&
        containsSequence(other.variantPinyin, candidate.variantPinyin)
      ) {
        if (other.score >= candidate.score - 0.05) return true;
      }
      return false;
    });
  });
  return filtered.slice(0, 6);
}

/**
 * @param {Array<{text:string, confidence?:number}>} results ASR N-best
 * @param {'ban'|'pick'} phase 当前阶段，作为无动词时的默认意图
 * @param {{exclude?:string[]}} options
 */
export function matchVoiceResults(results, phase = "ban", options = {}) {
  const entries = (Array.isArray(results) ? results : [])
    .map((item) => ({
      text: String(item?.text || "").trim(),
      confidence: Number(item?.confidence) || 0,
    }))
    .filter((item) => item.text);
  const raw = entries.map((item) => item.text).join(" ").trim();
  const action = detectAction(raw) || (phase === "pick" ? "pick" : "ban");
  const lane = detectLane(raw);
  const exclude = new Set(options.exclude || []);
  if (!raw) return { raw: "", action, lane, candidates: [] };

  const merged = new Map();
  entries.forEach((item, index) => {
    const normText = normalizeText(item.text);
    if (!normText) return;
    const pinyinText = toPinyinArray(normText);
    const chars = [...normText];
    const rankPrior = Math.max(0.35, 1 - index * 0.1);
    const confidence = item.confidence > 0 ? Math.min(1, item.confidence) : rankPrior;

    for (const hero of getLexicon()) {
      if (exclude.has(hero.name)) continue;
      const match = bestVariantFor(hero, normText, pinyinText, chars);
      if (!match) continue;
      // 单字英雄：只接受原文精确命中，避免“经济”->镜这类事故
      if (SINGLE_CHAR_HEROES.has(hero.name) && !match.exact) continue;
      const score = 0.85 * match.base + 0.15 * Math.max(rankPrior, confidence);
      const previous = merged.get(hero.name);
      if (!previous || score > previous.score) {
        merged.set(hero.name, {
          name: hero.name,
          score,
          exact: match.exact,
          variant: match.variant,
          variantNorm: match.variantNorm,
          variantPinyin: match.variantPinyin,
          pinyinSimilarity: match.pinyinSimilarity,
          charSimilarity: match.charSimilarity,
          rawIndex: index,
        });
      }
    }
  });

  const candidates = postFilter([...merged.values()]).filter(
    (candidate) => candidate.score >= 0.8,
  );
  return {
    raw,
    action,
    lane,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      score: Math.round(candidate.score * 1000) / 1000,
    })),
  };
}

/** 调试用：返回当前实际使用的英雄词条数。 */
export function heroLexiconSize() {
  return getLexicon().length;
}

/** 调试用：词库元信息（英雄数、别名数、数据版本）。 */
export function heroLexiconStats() {
  return {
    ...HERO_VOICE_LEXICON_META,
    loadedHeroCount: getLexicon().length,
    singleCharHeroes: [...SINGLE_CHAR_HEROES],
  };
}
