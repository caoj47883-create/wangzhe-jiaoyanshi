import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Empty, PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { COACHES } from "../lib/data.js";
import { useApp } from "../lib/store.js";

const PLATFORM_FILTERS = [
  { id: "all", label: "全部" },
  { id: "douyin", label: "抖音" },
  { id: "bilibili", label: "B站" },
];

const platformLabel = (platform) => (platform === "douyin" ? "抖音" : "B站");

const DOUYIN_COUNT = COACHES.filter((c) => c.platform === "douyin").length;
const BILI_COUNT = COACHES.filter((c) => c.platform === "bilibili").length;
const KPL_COUNT = COACHES.filter((c) => c.pro).length;

/** 各平台主页搜索地址（与原站一致） */
const homeUrl = (coach) =>
  coach.platform === "douyin"
    ? `https://www.douyin.com/search/${encodeURIComponent(coach.name)}?type=user`
    : `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(coach.name)}`;

const CSS = `
.co-intro { margin: 2px 0 12px; font-size: .76rem; line-height: 1.78; color: var(--muted); }
.co-stats { margin-bottom: 13px; }
.co-stats b { font-size: 1rem; }
.co-sticky {
  position: sticky; top: 0; z-index: 7;
  margin: 0 -18px 0; padding: 8px 18px 7px;
  background: var(--bg);
}
.co-filter-row { display: flex; align-items: center; gap: 7px; }
.co-filters { flex: 1; min-width: 0; }
.co-kpl { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; white-space: nowrap; }
.co-kpl svg { width: 11px; height: 11px; }
.co-kpl.on {
  color: var(--blue);
  border-color: color-mix(in srgb, var(--blue) 42%, transparent);
  background: var(--blue-soft);
  font-weight: 800;
}
.co-search {
  display: flex; align-items: center; gap: 7px;
  height: 34px; margin-top: 7px; padding: 0 11px;
  border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface); box-shadow: var(--shadow-sm);
}
.co-search > svg { width: 14px; height: 14px; color: var(--faint); flex-shrink: 0; }
.co-search input { flex: 1; min-width: 0; font-size: .72rem; color: var(--ink); }
.co-search input::placeholder { color: var(--faint); }
.co-clear {
  width: 20px; height: 20px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 50%; background: var(--surface-2); color: var(--muted);
}
.co-clear svg { width: 11px; height: 11px; }
.co-result {
  display: flex; align-items: center; gap: 6px;
  margin: 9px 0 10px; font-family: var(--mono); font-size: .6rem;
  letter-spacing: .05em; color: var(--faint);
}
.co-result b { font-size: .8rem; font-weight: 700; color: var(--gold-2); }
.co-result-tag {
  font-family: var(--sans); font-size: .6rem; color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px;
}
.co-reset {
  margin-left: auto; font-size: .6rem; color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px;
}
.co-list { display: flex; flex-direction: column; gap: 9px; }
.co-card {
  display: flex; gap: 11px; padding: 13px;
  border: 1px solid var(--line); border-radius: var(--radius-lg);
  background: var(--surface); box-shadow: var(--shadow-sm);
}
.co-ava-wrap { position: relative; flex-shrink: 0; align-self: flex-start; }
.co-ava-wrap .coach-ava { width: 44px; height: 44px; margin-bottom: 0; font-size: 1.05rem; }
.co-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid var(--surface);
}
.co-dot.douyin { background: var(--red); }
.co-dot.bilibili { background: var(--blue); }
.co-main { flex: 1; min-width: 0; }
.co-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.co-name {
  font-family: var(--serif); font-size: .95rem; font-weight: 900;
  letter-spacing: .02em; line-height: 1.2; color: var(--ink);
}
.co-kpl {
  font-family: var(--mono); font-size: .46rem; font-weight: 700;
  letter-spacing: .12em; color: var(--gold-2);
  background: var(--gold-soft); border: 1px solid var(--gold-line);
  border-radius: 4px; padding: 1px 5px;
}
.co-plat { padding: 2px 7px; font-size: .55rem; }
.co-dual {
  font-family: var(--mono); font-size: .46rem; letter-spacing: .06em;
  color: var(--teal); background: var(--teal-soft);
  border: 1px solid color-mix(in srgb, var(--teal) 32%, transparent);
  border-radius: 4px; padding: 1px 5px;
}
.co-go {
  margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
  padding: 5px 10px; border-radius: 999px;
  border: 1px solid var(--gold-line); background: var(--gold-soft);
  color: var(--gold-2); font-size: .62rem; font-weight: 800; white-space: nowrap;
}
.co-go svg { width: 11px; height: 11px; }
.co-go:active { transform: scale(.95); }
.co-desc {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin-top: 5px;
  font-size: .68rem; line-height: 1.62; color: var(--muted);
}
.co-heroes { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 7px; }
.co-hero-label {
  font-family: var(--mono); font-size: .48rem; letter-spacing: .1em; color: var(--faint);
}
.co-hero {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px 2px 2px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface-2); color: var(--ink-2); font-size: .62rem;
}
.co-hero:active { border-color: var(--gold-line); }
.co-hero .avatar { border: 1px solid var(--line); }
.co-tip {
  display: flex; gap: 10px; align-items: flex-start;
  margin-top: 18px; padding: 13px 14px;
  border: 1px dashed var(--line); border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
}
.co-tip-ico {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px;
  display: grid; place-items: center;
  background: var(--gold-soft); color: var(--gold);
}
.co-tip-ico svg { width: 14px; height: 14px; }
.co-tip b { font-family: var(--serif); font-size: .82rem; letter-spacing: .03em; }
.co-tip p { margin-top: 4px; font-size: .68rem; line-height: 1.72; color: var(--muted); }
.co-empty { padding-top: 20px; }
.co-empty .btn { margin: 14px auto 0; }
.co-page-foot {
  margin-top: 20px; padding-top: 14px;
  border-top: 1px dashed var(--line-2);
  text-align: center; font-family: var(--mono); font-size: .55rem;
  letter-spacing: .16em; line-height: 1.9; color: var(--faint);
}
.co-flash { animation: co-pulse 2.2s ease; }
@keyframes co-pulse {
  0% { box-shadow: 0 0 0 0 var(--gold-line), var(--shadow); }
  16% { box-shadow: 0 0 0 3px var(--gold-line), var(--shadow); }
  100% { box-shadow: var(--shadow-sm); }
}
@media (prefers-reduced-motion: reduce) {
  .co-flash { animation: none; }
}
`;

export default function Coaches({ params }) {
  const { back, pushRecent, showToast, theme, setTheme } = useApp();
  const focus = params?.focus || null;
  const [platform, setPlatform] = useState("all");
  const [kplOnly, setKplOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(null);
  const [flash, setFlash] = useState(null);
  const cardRefs = useRef({});

  const filtered = useMemo(() => {
    let list = COACHES;
    if (platform !== "all") list = list.filter((c) => c.platform === platform);
    if (kplOnly) list = list.filter((c) => c.pro);
    const k = query.trim().toLowerCase();
    if (k) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(k) || c.heroes.some((h) => h.toLowerCase().includes(k))
      );
    }
    return list;
  }, [platform, kplOnly, query]);

  // 首页点入的 focus 教练：滚动到卡片并高亮
  useEffect(() => {
    if (!focus || !COACHES.some((c) => c.name === focus)) return undefined;
    setFlash(focus);
    const scrollTimer = setTimeout(() => {
      const el = cardRefs.current[focus];
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 160);
    const flashTimer = setTimeout(() => setFlash(null), 2400);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(flashTimer);
    };
  }, [focus]);

  const openHero = (name) => {
    pushRecent("hero", name);
    setSheet(name);
  };

  const resetAll = () => {
    setPlatform("all");
    setKplOnly(false);
    setQuery("");
  };

  const openHome = (coach) => {
    const url = homeUrl(coach);
    try {
      if (window.AppBridge?.openExternal) {
        window.AppBridge.openExternal(url);
        return;
      }
    } catch (e) {
      /* 桥接异常时退回 window.open */
    }
    try {
      const win = window.open(url, "_blank");
      if (!win) showToast("若未跳转，请允许浏览器打开新窗口");
    } catch (e) {
      showToast("打开主页失败，请手动搜索该主播");
    }
  };

  const hasFilter = platform !== "all" || kplOnly || query.trim().length > 0;

  return (
    <div className="page">
      <style>{CSS}</style>
      <PageHead
        eyebrow="COACHES"
        title="名师课堂"
        sub={`KPL 选手 · 高人气主播 · ${COACHES.length} 位`}
        onBack={back}
        actions={
          <button
            className="icon-btn gold"
            aria-label="切换主题"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        }
      />

      <div className="page-inner" style={{ paddingTop: 0 }}>
        <p className="co-intro">
          共收录 {COACHES.length} 位；按主平台去重，双平台均有号的已在简介标注。信息来自公开资料整理，平台与主玩英雄可能随时间变动。
        </p>

        <div className="stats co-stats">
          <div className="cell">
            <b>{COACHES.length}</b>
            <span>位名师</span>
          </div>
          <div className="cell">
            <b>{DOUYIN_COUNT}</b>
            <span>抖音</span>
          </div>
          <div className="cell">
            <b>{BILI_COUNT}</b>
            <span>B站</span>
          </div>
          <div className="cell">
            <b>{KPL_COUNT}</b>
            <span>KPL</span>
          </div>
        </div>

        <div className="co-sticky">
          <div className="co-filter-row">
            <div className="filters co-filters">
              {PLATFORM_FILTERS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`chip ${platform === p.id ? "on" : ""}`}
                  onClick={() => setPlatform(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`chip co-kpl ${kplOnly ? "on" : ""}`}
              onClick={() => setKplOnly((v) => !v)}
              aria-pressed={kplOnly}
            >
              <Icon name="crown" />
              只看 KPL 选手
            </button>
          </div>
          <div className="co-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜主播名 / 擅长英雄…"
              enterKeyHint="search"
              aria-label="搜索主播"
            />
            {query ? (
              <button type="button" className="co-clear" onClick={() => setQuery("")} aria-label="清空搜索">
                <Icon name="x" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="co-result">
          <span>
            <b>{filtered.length}</b> 位主播
          </span>
          {platform !== "all" ? <span className="co-result-tag">{platformLabel(platform)}</span> : null}
          {kplOnly ? <span className="co-result-tag">KPL</span> : null}
          {query.trim() ? <span className="co-result-tag">“{query.trim()}”</span> : null}
          {hasFilter ? (
            <button type="button" className="co-reset" onClick={resetAll}>
              重置
            </button>
          ) : null}
        </div>

        {filtered.length ? (
          <div className="co-list">
            {filtered.map((c) => {
              const dual = c.desc.includes("双平台");
              return (
                <div
                  key={c.name}
                  ref={(el) => {
                    cardRefs.current[c.name] = el;
                  }}
                  className={`co-card ${flash === c.name ? "co-flash" : ""}`}
                >
                  <span className="co-ava-wrap">
                    <span className="coach-ava">{c.name.slice(0, 1)}</span>
                    <i className={`co-dot ${c.platform}`} />
                  </span>
                  <div className="co-main">
                    <div className="co-head">
                      <h3 className="co-name">{c.name}</h3>
                      {c.pro ? <span className="co-kpl">KPL</span> : null}
                      <span className={`pill ${c.platform === "douyin" ? "red" : "blue"} co-plat`}>
                        {platformLabel(c.platform)}
                      </span>
                      {dual ? <span className="co-dual">双平台</span> : null}
                      <button type="button" className="co-go" onClick={() => openHome(c)}>
                        去主页
                        <Icon name="arrowUpRight" />
                      </button>
                    </div>
                    <p className="co-desc">{c.desc}</p>
                    <div className="co-heroes">
                      <span className="co-hero-label">主玩</span>
                      {c.heroes.map((h) => (
                        <button type="button" className="co-hero" key={h} onClick={() => openHero(h)}>
                          <Avatar name={h} size={20} />
                          <span>{h}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>
            <p>{query.trim() ? `没有匹配「${query.trim()}」的主播` : "当前筛选下暂无主播"}</p>
            <button type="button" className="btn btn-dark btn-sm" onClick={resetAll}>
              清空筛选，看全部
            </button>
          </Empty>
        )}

        <div className="co-tip">
          <span className="co-tip-ico">
            <Icon name="book" />
          </span>
          <div>
            <b>怎么用这份名单</b>
            <p>先看 KPL 选手的 BP 与转线思路，再学绝活主播的对线细节；点「主玩」英雄可查看克制链与针对出装。</p>
          </div>
        </div>

        <p className="co-page-foot">
          名单整理自公开资料 · 平台与主玩英雄可能变动
          <br />
          仅作学习参考
        </p>
      </div>

      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
