import { useMemo, useState } from "react";
import { Avatar, PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { hero, laneLabel, tierFor } from "../lib/data.js";
import { useApp } from "../lib/store.js";

const relTime = (ts) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
};

export default function Favorites() {
  const { back, favorites, recents } = useApp();
  const [tab, setTab] = useState(favorites.length ? "fav" : "recent");
  const [sheet, setSheet] = useState(null);

  const favHeroes = useMemo(() => favorites.map((n) => hero(n)).filter((h) => h.id || h.name), [favorites]);
  const recentHeroes = useMemo(() => recents.filter((r) => r.type === "hero" && hero(r.name).id), [recents]);

  return (
    <div className="page">
      <PageHead eyebrow="MY LIBRARY" title="我的收藏" sub="收藏英雄 · 最近浏览" onBack={back} />
      <div className="page-inner" style={{ paddingTop: 6 }}>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={tab === "fav" ? "on" : ""} onClick={() => setTab("fav")}>
            收藏 {favHeroes.length ? favHeroes.length : ""}
          </button>
          <button className={tab === "recent" ? "on" : ""} onClick={() => setTab("recent")}>
            最近浏览 {recentHeroes.length ? recentHeroes.length : ""}
          </button>
        </div>

        {tab === "fav" ? (
          favHeroes.length ? (
            <div className="hero-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "18px 8px" }}>
              {favHeroes.map((h) => (
                <button key={h.name} className="hg" onClick={() => setSheet(h.name)}>
                  <span className="ava" style={{ width: 60, height: 60 }}>
                    <Avatar name={h.name} size={54} ring={h.tier === "T0"} />
                  </span>
                  <span className="nm">{h.name}</span>
                  <span className="tiny faint" style={{ fontSize: ".52rem" }}>
                    {laneLabel(h.lane)} · {tierFor(h, h.lane)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Icon name="heart" style={{ width: 34, height: 34, color: "var(--faint)", marginBottom: 12 }} />
              <div>还没有收藏英雄</div>
              <div style={{ marginTop: 4 }}>在英雄详情页点「收藏」，之后就能在这里快速找到。</div>
            </div>
          )
        ) : recentHeroes.length ? (
          <div className="list">
            {recentHeroes.map((r) => {
              const h = hero(r.name);
              return (
                <button className="row" key={r.name + r.ts} onClick={() => setSheet(r.name)}>
                  <Avatar name={r.name} size={38} />
                  <span className="grow">
                    <span className="title">
                      {r.name}
                      <span className="pill gold" style={{ marginLeft: 8, padding: "1px 7px", fontSize: ".52rem" }}>
                        {tierFor(h, h.lane)}
                      </span>
                    </span>
                    <span className="sub">
                      {laneLabel(h.lane)} · {h.tags.slice(0, 2).join(" / ")}
                    </span>
                  </span>
                  <span className="tiny faint">{relTime(r.ts)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <Icon name="clock" style={{ width: 34, height: 34, color: "var(--faint)", marginBottom: 12 }} />
            <div>还没有浏览记录</div>
            <div style={{ marginTop: 4 }}>打开任意英雄详情后，会自动记录在这里。</div>
          </div>
        )}
      </div>
      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
