import bundled from "../data/data.json";

// 优先使用联网热更新的数据（index.html 内联脚本在 bundle 之前从 localStorage 恢复）。
// 数据更新后整页 reload，因此这里只读一次即可，无需处理运行时替换。
const runtime =
  typeof window !== "undefined" && window.__RUNTIME_DATA__ && Array.isArray(window.__RUNTIME_DATA__.heroes)
    ? window.__RUNTIME_DATA__
    : null;

export const DATA = runtime && runtime.heroes.length ? runtime : bundled;
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
