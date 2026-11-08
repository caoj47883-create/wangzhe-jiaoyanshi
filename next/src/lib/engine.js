import {
  COUNTERS, DATA, HEROES, ITEM_RULES, ITEMS, RUNES, BUILDS, hero, hasHero, laneLabel, rankOf, tierFor,
} from "./data.js";

const tagCount = (names, tags) => {
  let n = 0;
  for (const t of tags) for (const name of names) if (hero(name).tags.includes(t)) n += 1;
  return n;
};

/* ---------------------------------------------------------------- 英雄克制 */
export function heroCounters(name) {
  return COUNTERS.against[name] || [];
}
export function heroCountersBy(name) {
  return COUNTERS.by[name] || [];
}

/* ---------------------------------------------------------------- BP 引擎 */
/** Parse a pasted string like "马超吕布夏侯惇甄姬苍" into known hero names (max 5). */
export function parseHeroNames(text, max = 5) {
  const names = HEROES.map((h) => h.name).sort((a, b) => b.length - a.length);
  let rest = String(text || "").replace(/[\s,，、.。;；/]+/g, "");
  const found = [];
  while (rest.length > 0 && found.length < max) {
    const hit = names.find((n) => rest.startsWith(n) && !found.includes(n));
    if (hit) {
      found.push(hit);
      rest = rest.slice(hit.length);
    } else {
      rest = rest.slice(1);
    }
  }
  return { found, rest };
}

/**
 * Ban 阶段推测：对面 Ban 掉某个英雄，说明可能想玩该英雄克制的英雄。
 * 返回 [{name, fromBans:[...]}]，按支持 Ban 数降序、强度升序。
 */
export function banRecommendations(bans, limit = 12) {
  const map = new Map();
  for (const b of bans) {
    for (const c of heroCountersBy(b)) {
      if (bans.includes(c.hero)) continue;
      if (!map.has(c.hero)) map.set(c.hero, []);
      const arr = map.get(c.hero);
      if (!arr.includes(b)) arr.push(b);
    }
  }
  return [...map.entries()]
    .map(([name, fromBans]) => ({ name, fromBans }))
    .filter((x) => hasHero(x.name))
    .sort((a, b) => b.fromBans.length - a.fromBans.length || rankOf(hero(a.name).tier) - rankOf(hero(b.name).tier))
    .slice(0, limit);
}

/**
 * Pick 阶段反制：给定敌方已选英雄和我的分路，返回该分路可拿的反制英雄。
 * hits: 命中的敌方英雄（该英雄克制他）；warnings: 敌方反制我的点。
 */
export function pickRecommendations(enemyPicks, lane, limit = 4) {
  const enemies = enemyPicks.filter(Boolean);
  const rows = [];
  for (const h of HEROES) {
    if (h.lane !== lane || enemies.includes(h.name)) continue;
    const againstList = COUNTERS.against[h.name] || [];
    const byList = COUNTERS.by[h.name] || [];
    const hits = enemies
      .map((e) => {
        const hit = byList.find((c) => c.hero === e);
        return hit ? { enemy: e, reason: hit.reason } : null;
      })
      .filter(Boolean);
    const warnings = enemies
      .map((e) => {
        const w = againstList.find((c) => c.hero === e);
        return w ? { enemy: e, reason: w.reason } : null;
      })
      .filter(Boolean);
    if (hits.length > 0) rows.push({ hero: h, hits, warnings });
  }
  rows.sort((a, b) => b.hits.length - a.hits.length || a.warnings.length - b.warnings.length || rankOf(a.hero.tier) - rankOf(b.hero.tier));
  return rows.slice(0, limit);
}

/** 阵容分析提示（敌方选人后） */
export function lineupInsights(enemyPicks) {
  const names = enemyPicks.filter(Boolean);
  const c = (tags) => tagCount(names, tags);
  const out = [];
  if (c(["控制", "点控", "嘲讽", "压制"]) >= 3) {
    out.push({ title: "对面控制链密集", detail: "优先考虑庄周、带净化；核心输出别选站桩型，被连环控就没得打。" });
  }
  if (c(["回复"]) >= 2) {
    out.push({ title: "对面回复能力强", detail: "制裁之刃、梦魇之牙尽早出，团战先秒带回复的英雄，别打消耗战。" });
  }
  if (c(["坦克", "前排"]) >= 2) {
    out.push({ title: "对面偏肉", detail: "拿吕布、典韦、马可波罗这类真伤英雄，或者百分比伤害的鲁班、娜可露露。" });
  }
  if (c(["无位移", "脆皮", "站桩", "站撸"]) >= 2) {
    out.push({ title: "对面脆皮多、腿短", detail: "兰陵王、阿轲隐身切 C，孙策、鬼谷子强开，先秒后排再回头打前排。" });
  }
  if (c(["隐身"]) >= 1) {
    out.push({ title: "对面有隐身单位", detail: "守约放眼、辅助多探草，C 位别单人带线过深，关键路口留控制技能。" });
  }
  if (c(["手长"]) + c(["超远程"]) >= 2) {
    out.push({ title: "对面消耗/手长阵容", detail: "别跟对面磨血量，选强开突脸阵容一波冲散，或者绕后切后排。" });
  }
  if (c(["强开"]) >= 2) {
    out.push({ title: "对面强开能力强", detail: "站位别太密，庄周、张飞反手保护，C 位留闪现等位移保命。" });
  }
  return out;
}

/* ---------------------------------------------------------------- 出装引擎 */
function magicSources(names) {
  return names
    .map((n) => hero(n))
    .filter((h) => h.lane === "mid" || h.tags.includes("消耗") || h.tags.includes("法伤"))
    .length;
}

function runeRecommendations(lane, tagCounter) {
  const pool = [...(RUNES[lane] || [])];
  const score = (r) => {
    const tank = tagCounter(["坦克", "前排", "护盾"]);
    const burst = tagCounter(["爆发", "突进", "隐身"]);
    const heal = tagCounter(["回复"]);
    if (["farm", "jungle", "clash"].includes(lane)) {
      if (r.name.includes("攻速") && tank >= 2) return 3;
      if (r.name.includes("吸血") && (heal >= 2 || burst >= 2)) return 2.5;
      if (r.name.includes("无双") && tank === 0) return 2;
      if (r.name.includes("半肉") && burst >= 2) return 3;
    }
    if (lane === "mid") {
      if (r.name.includes("88") && tank >= 2) return 3;
      if (r.name.includes("法吸") && heal >= 2) return 2;
      if (r.name.includes("工具人") && burst >= 3) return 2.5;
    }
    if (lane === "roam") {
      if (r.name.includes("开团") && tagCounter(["手长"]) + tagCounter(["消耗"]) >= 2) return 3;
      if (r.name.includes("肉坦") && burst >= 2) return 2.5;
    }
    return r === (RUNES[lane] || [])[0] ? 1.5 : 1;
  };
  return pool.sort((a, b) => score(b) - score(a));
}

/**
 * 针对出装：我的英雄（可空）+ 敌方阵容 → 基础出装 / 针对性装备 / 铭文 / 提示。
 */
export function itemPlan(myHeroName, enemyNames) {
  const me = myHeroName ? hero(myHeroName) : null;
  const lane = me ? me.lane : null;
  const enemies = enemyNames.filter((n) => hasHero(n));
  const tagCounter = (tags) => tagCount(enemies, tags);

  const base = (BUILDS[lane] || []).map((n) => ITEMS[n]).filter(Boolean);
  const counter = [];
  const used = new Set(base.map((i) => i.name));
  if (lane) {
    for (const rule of ITEM_RULES) {
      if (Math.max(...rule.when.map((t) => tagCounter([t]))) < rule.min) continue;
      for (const it of rule.items) {
        if (it.lanes && !it.lanes.includes(lane)) continue;
        if (used.has(it.name)) continue;
        used.add(it.name);
        counter.push({ item: ITEMS[it.name], reason: it.reason });
      }
    }
  }
  if (magicSources(enemies) >= 2 && !used.has("魔女斗篷")) {
    const name = lane === "farm" || lane === "jungle" ? "破魔刀" : "魔女斗篷";
    counter.push({ item: ITEMS[name], reason: "对方法伤来源多，补一件魔抗装防止被秒" });
  }
  const notes = [];
  if (tagCounter(["回复"]) >= 2) notes.push("重伤装优先级最高，别拖到最后一件");
  if (tagCounter(["坦克"]) + tagCounter(["前排"]) >= 2) notes.push("穿透装提前到第三件，不然中期打不动人");
  if (tagCounter(["爆发"]) + tagCounter(["突进"]) >= 2) notes.push("保命装比输出装重要，活着才有输出");

  return {
    lane,
    base: base.slice(0, 6),
    counter: counter.slice(0, 4),
    inscriptions: lane ? runeRecommendations(lane, tagCounter).slice(0, 4) : [],
    notes: notes.length ? notes : ["按常规出装即可，留意对面经济最高的点针对性调整"],
    insights: lineupInsights(enemies),
  };
}

/** 阵容克制提示：我的英雄是否被对面某英雄克制 */
export function matchupWarnings(myHeroName, enemyNames) {
  const h = hero(myHeroName);
  const against = COUNTERS.against[h.name] || [];
  return enemyNames
    .map((e) => against.find((c) => c.hero === e))
    .filter(Boolean)
    .map((c) => ({ enemy: c.hero, reason: c.reason, source: c.source }));
}

export const engineDebug = { tagCount };
