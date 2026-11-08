import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Empty, PageHead, TierBadge } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { COMPS, LANES, laneLabel, hero, tierFor } from "../lib/data.js";
import { shareImage } from "../lib/share.js";
import { useApp } from "../lib/store.js";

/* 流派筛选与原站 zm 保持一致：style 包含关键词即归入；「其他」= 不属于任何关键词 */
const STYLE_FILTERS = ["全部", "养猪流", "速推流", "四保一", "强开", "单带", "消耗", "控制", "其他"];
const STYLE_KEYS = ["养猪流", "速推流", "四保一", "强开", "单带", "消耗", "控制"];
/* 分路明细 / 分享文案采用 BP 视角顺序：对抗路 → 打野 → 中路 → 发育路 → 游走 */
const LANE_ORDER = ["clash", "jungle", "mid", "farm", "roam"];

function filterComps(list, key) {
  if (key === "全部") return list;
  if (key === "其他") return list.filter((c) => !STYLE_KEYS.some((k) => c.style.includes(k)));
  return list.filter((c) => c.style.includes(key));
}

function compNo(id) {
  const i = COMPS.findIndex((c) => c.id === id);
  return String(i + 1).padStart(2, "0");
}

const CSS = `
.wc-intro { margin: 2px 0 12px; font-size: .76rem; line-height: 1.78; color: var(--muted); }
.wc-sticky {
  position: sticky; top: 0; z-index: 7;
  margin: 0 -18px 0; padding: 8px 18px 7px;
  background: var(--bg);
}
.wc-search {
  display: flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 11px;
  border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface); box-shadow: var(--shadow-sm);
}
.wc-search > svg { width: 14px; height: 14px; color: var(--faint); flex-shrink: 0; }
.wc-search input { flex: 1; min-width: 0; font-size: .72rem; color: var(--ink); }
.wc-search input::placeholder { color: var(--faint); }
.wc-clear {
  width: 20px; height: 20px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 50%; background: var(--surface-2); color: var(--muted);
}
.wc-clear svg { width: 11px; height: 11px; }
.wc-filters { margin-top: 7px; }
.wc-result {
  display: flex; align-items: center; gap: 6px;
  margin: 8px 0 10px; font-family: var(--mono); font-size: .6rem;
  letter-spacing: .05em; color: var(--faint);
}
.wc-result b { font-size: .8rem; font-weight: 700; color: var(--gold-2); }
.wc-result-tag {
  font-family: var(--sans); font-size: .6rem; color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px;
}
.wc-reset {
  margin-left: auto; font-size: .6rem; color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px;
}
.wc-list { display: flex; flex-direction: column; gap: 10px; }
.wc-card {
  position: relative; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--radius-lg);
  background: var(--surface); box-shadow: var(--shadow-sm);
  transition: border-color .2s ease, box-shadow .2s ease;
}
.wc-card.open { border-color: var(--gold-line); box-shadow: var(--shadow); }
.wc-head {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 12px 12px 11px 13px; text-align: left; cursor: pointer;
}
.wc-head:focus-visible { outline: 2px solid var(--gold-line); outline-offset: -2px; }
.wc-avs { display: flex; align-items: center; flex-shrink: 0; }
.wc-av { border-radius: 50%; line-height: 0; flex-shrink: 0; }
.wc-av .avatar { border: 2px solid var(--surface); }
.wc-av + .wc-av { margin-left: -10px; }
.wc-av:active { transform: scale(.92); }
.wc-head-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.wc-style-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.wc-style {
  flex: 1; min-width: 0;
  font-family: var(--mono); font-size: .5rem; letter-spacing: .14em; color: var(--faint);
  line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wc-ban-count {
  flex-shrink: 0; padding: 1px 6px;
  font-family: var(--mono); font-size: .46rem; letter-spacing: .07em;
}
.wc-name {
  font-family: var(--serif); font-size: 1rem; font-weight: 900; letter-spacing: .02em;
  color: var(--ink); line-height: 1.25;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wc-chip-row { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.wc-chip-row .pill { padding: 2px 6px; font-size: .52rem; }
.wc-tail {
  flex-shrink: 0; display: flex; flex-direction: column;
  align-items: center; gap: 1px; align-self: center;
}
.wc-idx { font-family: var(--mono); font-size: .48rem; letter-spacing: .06em; color: var(--faint); }
.wc-chev { display: grid; place-items: center; color: var(--gold); transition: transform .24s ease; }
.wc-chev svg { width: 14px; height: 14px; }
.wc-card.open .wc-chev { transform: rotate(90deg); }
.wc-body { border-top: 1px solid var(--line-2); padding: 0 13px 13px; animation: wc-rise .22s ease; }
@keyframes wc-rise { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.wc-lanes {
  margin-top: 10px; padding: 2px 10px;
  border: 1px solid var(--line-2); border-radius: var(--radius-md);
  background: var(--surface-2);
}
.wc-lane { display: flex; align-items: center; gap: 9px; padding: 6px 0; }
.wc-lane + .wc-lane { border-top: 1px dashed var(--line); }
.wc-lane-label {
  width: 42px; flex-shrink: 0;
  font-family: var(--mono); font-size: .54rem; letter-spacing: .05em; color: var(--faint);
}
.wc-lane-hero { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1; text-align: left; }
.wc-lane-hero:active { opacity: .65; }
.wc-lane-hero .avatar { border: 1px solid var(--line); }
.wc-lane-name { font-family: var(--serif); font-size: .8rem; font-weight: 700; color: var(--ink-2); }
.wc-lane .tier-badge { margin-left: auto; font-size: .5rem; padding: 2px 6px; }
.wc-sec { margin-top: 13px; }
.wc-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.wc-tag {
  font-family: var(--mono); font-size: .54rem; font-weight: 700;
  letter-spacing: .18em; color: var(--muted);
}
.wc-tag.gold { color: var(--gold-2); }
.wc-tag.red { color: var(--red); }
.wc-rule { flex: 1; height: 1px; background: var(--line-2); }
.wc-text { font-size: .78rem; line-height: 1.82; color: var(--ink-2); }
.wc-weak {
  margin-top: 12px; padding: 9px 11px;
  border-left: 2px solid var(--red);
  border-radius: 0 10px 10px 0;
  background: linear-gradient(90deg, var(--red-soft), transparent 84%);
}
.wc-weak .wc-sec-head { margin-bottom: 4px; }
.wc-weak .wc-text { font-size: .75rem; color: var(--muted); }
.wc-ban-row { display: flex; flex-wrap: wrap; gap: 6px; }
.wc-ban {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px 3px 3px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface-2); color: var(--ink-2); font-size: .66rem;
}
.wc-ban:active { border-color: var(--gold-line); }
.wc-ban .avatar { border: 1px solid var(--line); }
.wc-actions { display: flex; gap: 8px; margin-top: 14px; }
.wc-action { flex: 1; min-width: 0; }
.wc-action:disabled { opacity: .55; }
.wc-hint { margin-top: 9px; font-size: .56rem; letter-spacing: .03em; color: var(--faint); text-align: center; }
.wc-empty { padding-top: 22px; }
.wc-empty p { line-height: 1.8; }
.wc-empty-sub { margin-top: 3px; font-size: .64rem; color: var(--faint); }
.wc-empty .btn { margin: 14px auto 0; }
.wc-page-foot {
  margin-top: 20px; padding-top: 14px;
  border-top: 1px dashed var(--line-2);
  text-align: center; font-family: var(--mono); font-size: .55rem;
  letter-spacing: .16em; line-height: 1.9; color: var(--faint);
}
.wc-flash { animation: wc-pulse 2.2s ease; }
@keyframes wc-pulse {
  0% { box-shadow: 0 0 0 0 var(--gold-line), var(--shadow); }
  16% { box-shadow: 0 0 0 3px var(--gold-line), var(--shadow); }
  100% { box-shadow: var(--shadow-sm); }
}
@media (prefers-reduced-motion: reduce) {
  .wc-body, .wc-flash { animation: none; }
}
`;

export default function Comps({ params }) {
  const { back, navigate, pushRecent, showToast, theme, setTheme } = useApp();
  const focus = params?.focus || null;
  const firstId = COMPS[0]?.id || null;
  const [active, setActive] = useState("全部");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(() => (COMPS.some((c) => c.id === focus) ? focus : firstId));
  const [sheet, setSheet] = useState(null);
  const [flash, setFlash] = useState(null);
  const [sharingId, setSharingId] = useState(null);
  const cardRefs = useRef({});

  const filtered = useMemo(() => {
    const list = filterComps(COMPS, active);
    const k = query.trim().toLowerCase();
    if (!k) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(k) || LANES.some((l) => c.picks[l.lane].toLowerCase().includes(k))
    );
  }, [active, query]);

  // 筛选/搜索变化后：保持当前展开项，否则默认展开第一条
  useEffect(() => {
    setOpenId((prev) => {
      if (!filtered.length) return null;
      if (prev && filtered.some((c) => c.id === prev)) return prev;
      return filtered[0].id;
    });
  }, [filtered]);

  // 首页点入的 focus 阵容：自动展开 + 滚动到卡片并高亮
  useEffect(() => {
    if (!focus || !COMPS.some((c) => c.id === focus)) return undefined;
    setOpenId(focus);
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
    setActive("全部");
    setQuery("");
  };

  const share = async (comp) => {
    if (sharingId) return;
    setSharingId(comp.id);
    try {
      await shareImage({
        kind: "comp",
        title: comp.name,
        subtitle: comp.style,
        heroNames: LANES.map((l) => comp.picks[l.lane]),
        lines: [
          {
            label: "分路",
            text: LANE_ORDER.map((lane) => `${laneLabel(lane)} ${comp.picks[lane]}`).join(" · "),
          },
          { label: "思路", text: comp.idea },
          { label: "弱点", text: comp.weak },
          { label: "Ban位", text: comp.bans.join("、") },
        ],
      });
      showToast("已生成分享图");
    } catch (e) {
      showToast("分享图生成失败");
    } finally {
      setSharingId(null);
    }
  };

  const hasFilter = active !== "全部" || query.trim().length > 0;

  return (
    <div className="page">
      <style>{CSS}</style>
      <PageHead
        eyebrow="FIVE-MAN COMPS"
        title="五黑阵容"
        sub={`${COMPS.length} 套体系 · 点开看思路与 Ban 位`}
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
        <p className="wc-intro">
          共 {COMPS.length} 套五黑阵容，含养猪流、速推流等流派；点开看思路、弱点与推荐 Ban 位。
        </p>

        <div className="wc-sticky">
          <div className="wc-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜阵容名 / 英雄名…"
              enterKeyHint="search"
              aria-label="搜索阵容"
            />
            {query ? (
              <button type="button" className="wc-clear" onClick={() => setQuery("")} aria-label="清空搜索">
                <Icon name="x" />
              </button>
            ) : null}
          </div>
          <div className="filters wc-filters">
            {STYLE_FILTERS.map((f) => (
              <button
                type="button"
                key={f}
                className={`chip ${active === f ? "on" : ""}`}
                onClick={() => setActive(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="wc-result">
          <span>
            <b>{filtered.length}</b> 套阵容
          </span>
          {active !== "全部" ? <span className="wc-result-tag">{active}</span> : null}
          {query.trim() ? <span className="wc-result-tag">“{query.trim()}”</span> : null}
          {hasFilter ? (
            <button type="button" className="wc-reset" onClick={resetAll}>
              清除
            </button>
          ) : null}
        </div>

        {filtered.length ? (
          <div className="wc-list">
            {filtered.map((c) => {
              const open = openId === c.id;
              const toggle = () => setOpenId(open ? null : c.id);
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    cardRefs.current[c.id] = el;
                  }}
                  className={`wc-card ${open ? "open" : ""} ${flash === c.id ? "wc-flash" : ""}`}
                >
                  <div
                    className="wc-head"
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                  >
                    <span className="wc-avs">
                      {LANES.map((l) => (
                        <button
                          type="button"
                          className="wc-av"
                          key={l.lane}
                          title={`${c.picks[l.lane]} · ${laneLabel(l.lane)}`}
                          aria-label={`查看英雄 ${c.picks[l.lane]}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openHero(c.picks[l.lane]);
                          }}
                        >
                          <Avatar name={c.picks[l.lane]} size={30} />
                        </button>
                      ))}
                    </span>
                    <span className="wc-head-main">
                      <span className="wc-style-row">
                        <span className="wc-style">{c.style}</span>
                        <span className="pill red wc-ban-count">BAN {c.bans.length}</span>
                      </span>
                      <span className="wc-name">{c.name}</span>
                      <span className="wc-chip-row">
                        {c.style.split(" · ").map((s) => (
                          <span className="pill" key={s}>
                            {s}
                          </span>
                        ))}
                        <span className="pill">五黑</span>
                      </span>
                    </span>
                    <span className="wc-tail">
                      <span className="wc-idx">{compNo(c.id)}</span>
                      <span className="wc-chev">
                        <Icon name="chevronRight" />
                      </span>
                    </span>
                  </div>

                  {open ? (
                    <div className="wc-body">
                      <div className="wc-lanes">
                        {LANE_ORDER.map((lane) => {
                          const name = c.picks[lane];
                          const tier = tierFor(hero(name), lane);
                          return (
                            <div className="wc-lane" key={lane}>
                              <span className="wc-lane-label">{laneLabel(lane)}</span>
                              <button type="button" className="wc-lane-hero" onClick={() => openHero(name)}>
                                <Avatar name={name} size={28} />
                                <span className="wc-lane-name">{name}</span>
                              </button>
                              <TierBadge tier={tier} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="wc-sec">
                        <div className="wc-sec-head">
                          <span className="wc-tag gold">思路</span>
                          <span className="wc-rule" />
                        </div>
                        <p className="reading wc-text">{c.idea}</p>
                      </div>

                      <div className="wc-weak">
                        <div className="wc-sec-head">
                          <span className="wc-tag red">弱点</span>
                          <span className="wc-rule" />
                        </div>
                        <p className="wc-text">{c.weak}</p>
                      </div>

                      <div className="wc-sec">
                        <div className="wc-sec-head">
                          <span className="wc-tag">推荐 BAN 位</span>
                          <span className="wc-rule" />
                        </div>
                        <div className="wc-ban-row">
                          {c.bans.map((b) => (
                            <button type="button" className="wc-ban" key={b} onClick={() => openHero(b)}>
                              <Avatar name={b} size={22} />
                              <span>{b}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="wc-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm wc-action"
                          onClick={() => share(c)}
                          disabled={sharingId === c.id}
                        >
                          <Icon name="share" />
                          {sharingId === c.id ? "生成中…" : "分享这套阵容"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-dark btn-sm wc-action"
                          onClick={() => navigate("bp", { compId: c.id })}
                        >
                          <Icon name="swords" />
                          去 BP 练这套
                        </button>
                      </div>
                      <p className="wc-hint">点头像可查看该英雄的克制链与针对出装</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>
            <p>{query.trim() ? `没有匹配「${query.trim()}」的阵容` : `「${active}」流派暂无收录阵容`}</p>
            <p className="wc-empty-sub">可切换其他流派，或查看全部 {COMPS.length} 套体系</p>
            <button type="button" className="btn btn-dark btn-sm" onClick={resetAll}>
              清空筛选，看全部
            </button>
          </Empty>
        )}

        <p className="wc-page-foot">
          阵容与 Ban 位整理自公开资料
          <br />
          实战请按对手与自队英雄池调整
        </p>
      </div>

      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
