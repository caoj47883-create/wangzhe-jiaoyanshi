import bundled from "../data/data.json";

// 优先使用联网热更新的数据（index.html 内联脚本在 bundle 之前从 localStorage 恢复）。
// 数据更新后整页 reload，因此这里只读一次即可，无需处理运行时替换。
const runtime =
  typeof window !== "undefined" && window.__RUNTIME_DATA__ && Array.isArray(window.__RUNTIME_DATA__.heroes)
    ? window.__RUNTIME_DATA__
    : null;

// 内置数据升级到新赛季后，旧的热更新缓存不能继续覆盖新版内置快照。
// 远端 manifest 使用日期版本号（如 2026.11.06.103），这里按同一规则比较。
const compareVersion = (a, b) => {
  const pa = String(a || "0").split(/[.\-+]/).filter(Boolean);
  const pb = String(b || "0").split(/[.\-+]/).filter(Boolean);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const xa = pa[i] || "0";
    const xb = pb[i] || "0";
    const na = /^\d+$/.test(xa);
    const nb = /^\d+$/.test(xb);
    if (na && nb) {
      const d = parseInt(xa, 10) - parseInt(xb, 10);
      if (d !== 0) return d > 0 ? 1 : -1;
    } else if (xa !== xb) {
      return xa > xb ? 1 : -1;
    }
  }
  return 0;
};

const runtimeIsNewer = runtime && compareVersion(runtime.version || runtime.dataVersion, bundled.version) > 0;
export const DATA = runtime && runtime.heroes.length && runtimeIsNewer ? runtime : bundled;
export const IS_RUNTIME_DATA = !!runtime;
export const LANES = DATA.lanes; // [{lane,label}]
export const LANE_META = DATA.laneMeta;
export const HEROES = DATA.heroes;
export const TIERS = DATA.tiers;
export const COMPS = DATA.comps;
export const COACHES = DATA.coaches;
export const ITEMS = DATA.items;
export const RUNES = DATA.runes;
export const BUILDS = DATA.builds;
export const ITEM_RULES = DATA.itemRules;
export const COUNTERS = DATA.counters;
export const STATS = DATA.stats;
export const SEASON = DATA.season || "S45";

const byName = new Map(HEROES.map((h) => [h.name, h]));
const nameSet = new Set(HEROES.map((h) => h.name));

export const hero = (name) =>
  byName.get(name) || { name, id: null, tags: [], lanes: [], lane: null, tiers: {}, tier: "T3", curated: false };

export const hasHero = (name) => nameSet.has(name);

export const laneLabel = (lane) => (LANE_META[lane] ? LANE_META[lane].label : lane || "");

export const tierFor = (h, lane) => (h.tiers && lane && h.tiers[lane]) || h.tier || "T3";

export const artUrl = (h) => (h && h.id ? `/heroart/${h.id}.webp` : null);
export const avatarUrl = (h) => (h && h.id ? `/avatar/${h.id}.webp` : null);

export const rankOf = (tier) => ({ T0: 0, "T0.5": 0.5, T1: 1, T2: 2 }[tier] ?? 3);

export const countersAgainst = (name) => (COUNTERS.against[name] || []);
export const countersBy = (name) => (COUNTERS.by[name] || []);

export const heroesOfLane = (lane) => HEROES.filter((h) => h.lane === lane);

export const searchHeroes = (q) => {
  const k = (q || "").trim();
  if (!k) return [];
  return HEROES.filter((h) => h.name.includes(k) || h.tags.some((t) => t.includes(k))).slice(0, 24);
};
