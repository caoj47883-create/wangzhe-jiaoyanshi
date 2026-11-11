/**
 * 英雄语音匹配：把 ASR 的 N-best 文本映射到 133 个英雄名。
 *
 * 设计原则：
 * 1. 这是“封闭词表 + 短句槽位”问题，不是通用自然语言理解；
 * 2. 拼音优先，字符相似度兜底，允许 ASR 近音错字（张亮 -> 张良）；
 * 3. 单字英雄（镜/曜/铠/瑶/澜/影/暃）只在原文精确出现时才自动采用；
 * 4. 优先选择更长的命中（“鲁班大师”不能被“鲁班”抢走）。
 */
import { pinyin } from "pinyin-pro";
import { HEROES } from "./data.js";

const ALIASES = {
  "东皇太一": ["东皇", "东皇太乙", "太一"],
  "张良": ["张亮", "张梁"],
  "鬼谷子": ["鬼谷", "鬼谷子"],
  "盾山": ["盾山"],
  "蔡文姬": ["文姬", "蔡文"],
  "鲁班七号": ["鲁班", "小鲁班", "鲁班七"],
  "鲁班大师": ["鲁班大师", "大师"],
  "马超": ["马超"],
  "吕布": ["吕布", "奉先"],
  "张飞": ["张飞", "翼德"],
  "关羽": ["关羽", "云长"],
  "赵云": ["赵云", "子龙"],
  "韩信": ["韩信", "兵仙"],
  "李白": ["李白", "青莲剑仙"],
  "诸葛亮": ["诸葛", "孔明", "诸葛亮"],
  "司马懿": ["司马", "司马懿"],
  "貂蝉": ["貂蝉"],
  "王昭君": ["昭君", "王昭君"],
  "西施": ["西施"],
  "杨玉环": ["杨玉环", "玉环", "贵妃"],
  "武则天": ["武则天", "女帝"],
  "上官婉儿": ["婉儿", "上官"],
  "不知火舞": ["火舞", "不知火"],
  "娜可露露": ["露露", "娜可"],
  "橘右京": ["橘右京", "橘京"],
  "宫本武藏": ["宫本", "武藏"],
  "铠": ["铠", "凯"],
  "曜": ["曜", "耀"],
  "镜": ["镜", "静"],
  "瑶": ["瑶", "摇", "姚"],
  "澜": ["澜", "蓝"],
  "影": ["影"],
  "暃": ["暃", "飞"],
  "云缨": ["云缨", "云樱"],
  "姬小满": ["小满", "姬小满"],
  "戈娅": ["戈娅", "戈雅"],
  "海月": ["海月"],
  "赵怀真": ["怀真", "赵怀真"],
  "莱西奥": ["莱西奥", "莱西"],
  "亚连": ["亚连", "亚莲"],
  "朵莉亚": ["朵莉亚", "朵莉"],
  "少司缘": ["少司缘", "司缘"],
  "大司命": ["大司命", "司命"],
  "元流之子(法师)": ["元流之子", "元流法师", "元法"],
  "元流之子(坦克)": ["元流之子", "元流坦克", "元坦"],
  "元流之子(射手)": ["元流之子", "元流射手", "元射"],
  "元流之子(辅助)": ["元流之子", "元流辅助", "元辅"],
  "元流之子(刺客)": ["元流之子", "元流刺客", "元刺"],
  "公孙离": ["公孙离", "阿离"],
  "公孙离": ["公孙离", "阿离"],
  "孙尚香": ["孙尚香", "大小姐", "香香"],
  "马可波罗": ["马可", "马可波罗", "马克"],
  "狄仁杰": ["狄仁杰", "狄大人"],
  "虞姬": ["虞姬"],
  "黄忠": ["黄忠"],
  "伽罗": ["伽罗"],
  "成吉思汗": ["成吉思汗", "狼狗"],
  "后羿": ["后羿"],
  "艾琳": ["艾琳"],
  "蒙犽": ["蒙犽", "蒙牙"],
  "阿古朵": ["阿古朵"],
  "桑启": ["桑启"],
  "太乙真人": ["太乙", "太乙真人"],
  "明世隐": ["明世隐", "小明"],
  "鬼谷子": ["鬼谷子"],
  "大乔": ["大乔"],
  "小乔": ["小乔"],
  "孙膑": ["孙膑", "孙滨"],
  "庄周": ["庄周", "鱼"],
  "刘禅": ["刘禅", "刘婵"],
  "蔡文姬": ["蔡文姬"],
  "牛魔": ["牛魔", "牛"],
  "张飞": ["张飞"],
  "项羽": ["项羽"],
  "白起": ["白起"],
  "夏侯惇": ["夏侯", "夏侯惇"],
  "程咬金": ["程咬金", "咬金"],
  "廉颇": ["廉颇"],
  "苏烈": ["苏烈"],
  "猪八戒": ["猪八戒", "八戒"],
  "嫦娥": ["嫦娥"],
  "刘邦": ["刘邦"],
  "哪吒": ["哪吒", "哪咤"],
  "杨戬": ["杨戬", "二郎神"],
  "雅典娜": ["雅典娜"],
  "露娜": ["露娜", "月光"],
  "花木兰": ["花木兰", "木兰"],
  "达摩": ["达摩"],
  "曹操": ["曹操"],
  "典韦": ["典韦"],
  "刘备": ["刘备"],
  "李信": ["李信"],
  "盘古": ["盘古"],
  "曜": ["曜"],
  "蒙恬": ["蒙恬"],
  "阿轲": ["阿轲", "阿珂"],
  "兰陵王": ["兰陵王", "兰陵"],
  "娜可露露": ["娜可露露"],
  "裴擒虎": ["裴擒虎", "老虎", "裴擒"],
  "百里玄策": ["玄策", "百里玄策"],
  "百里守约": ["守约", "百里守约"],
  "云中君": ["云中君", "云中"],
  "上官婉儿": ["上官婉儿"],
  "司马懿": ["司马懿"],
  "元歌": ["元歌"],
  "露娜": ["露娜"],
  "镜": ["镜"],
  "澜": ["澜"],
  "暃": ["暃"],
  "赵怀真": ["赵怀真"],
  "姬小满": ["姬小满"],
  "亚连": ["亚连"],
  "朵莉亚": ["朵莉亚"],
  "海诺": ["海诺"],
  "少司缘": ["少司缘"],
  "元流之子(法师)": ["元流之子"],
  "大司命": ["大司命"],
  "敖隐": ["敖隐", "敖影"],
  "影": ["影"],
  "空空儿": ["空空儿", "空空"],
  "元流之子(射手)": ["元流之子"],
  "苍": ["苍"],
  "阿古朵": ["阿古朵"],
  "孙权": ["孙权"],
  "曹操": ["曹操"],
  "刘备": ["刘备"],
  "关羽": ["关羽"],
  "张飞": ["张飞"],
  "赵云": ["赵云"],
  "马超": ["马超"],
  "黄忠": ["黄忠"],
  "吕布": ["吕布"],
  "貂蝉": ["貂蝉"],
  "董卓": ["董卓"],
  "袁绍": ["袁绍"],
  "公孙瓒": ["公孙瓒"],
};

const PUNCT_RE = /[\s,，、。．.;；:：!！?？"'“”‘’（）()\[\]【】<>《》·\-—_/\\|+*=~`]+/g;
const FUZZY_INITIALS = new Set(["zh", "ch", "sh"]);
const INITIAL_CONFUSION = new Set(["n/l", "f/h", "r/l"]);

export const SINGLE_CHAR_HEROES = new Set(["铠", "曜", "镜", "瑶", "澜", "影", "暃"]);

const normalizeText = (value) => String(value || "").toLowerCase().replace(PUNCT_RE, "");
const normalizeSyllable = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/ü/g, "v")
    .replace(/\s+/g, "");

function toPinyinArray(text) {
  try {
    return pinyin(text, { toneType: "none", type: "array" })
      .map(normalizeSyllable)
      .filter(Boolean);
  } catch {
    return [];
  }
}

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
    const add = (text, kind, weight = 1) => {
      const norm = normalizeText(text);
      if (!norm) return;
      const old = variants.get(norm);
      if (old && old.weight >= weight) return;
      variants.set(norm, {
        text,
        norm,
        pinyin: toPinyinArray(text),
        kind,
        weight,
      });
    };
    add(name, "name", 1);
    const baseMatch = name.match(/^(.+?)[（(]/);
    if (baseMatch) add(baseMatch[1], "base", 0.94);
    for (const alias of ALIASES[name] || []) add(alias, "alias", 0.97);
    list.push({ name, variants: [...variants.values()] });
  }
  // 有些外号会以“鲁班”同时命中七号/大师，保留更长的命中由 postFilter 处理。
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
      if (other.variantNorm.length > candidate.variantNorm.length && other.variantNorm.includes(candidate.variantNorm)) {
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

/** 调试用：直接按名字命中一个英雄的词典项。 */
export function heroLexiconSize() {
  return getLexicon().length;
}
