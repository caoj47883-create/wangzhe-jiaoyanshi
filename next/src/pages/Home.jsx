import { useMemo, useState } from "react";
import { BrandHeader, HeroArt, SectionHead, Avatar } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { COACHES, COMPS, HEROES, LANES, SEASON, laneLabel, hero } from "../lib/data.js";
import { useApp } from "../lib/store.js";

const dayIndex = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
};

export default function Home() {
  const { navigate, goTab, recents } = useApp();
  const [sheet, setSheet] = useState(null);

  const feature = useMemo(() => {
    const pool = HEROES.filter((h) => h.art && h.tier === "T0");
    const list = pool.length ? pool : HEROES.filter((h) => h.art);
    return list[dayIndex() % list.length];
  }, []);

  const tools = [
    { tab: "bp", icon: "swords", title: "BP 助手", sub: "记录敌方 Ban/Pick，实时反制", badge: "实时", primary: true },
    { page: "formula", icon: "route", title: "公式化打法", sub: "五个分路、线权与路线图" },
    { tab: "strength", icon: "crown", title: "英雄强度", sub: "按分路看当前版本梯度" },
    { tab: "items", icon: "shield", title: "针对出装", sub: "敌方阵容、装备与铭文" },
    { page: "comps", icon: "users", title: "阵容库", sub: `${COMPS.length} 套 · 五黑 / 双排 / 三排 / 娱乐` },
  ];

  const recentHeroes = recents.filter((r) => r.type === "hero").slice(0, 8);

  return (
    <div className="page">
      <div className="page-inner">
        <BrandHeader onSearch={() => navigate("search")} />

        <button className="home-search" onClick={() => navigate("search")}>
          <Icon name="search" />
          <span>搜索英雄、阵容或主播</span>
        </button>

        <section className="home-focus" aria-label="版本焦点">
          <div className="focus-media">
            <HeroArt name={feature.name} className="art" />
            <span className="focus-label">本周版本焦点</span>
          </div>
          <div className="focus-body">
            <div className="focus-meta">
              <span className="focus-dot" />
              <span>{SEASON} · {laneLabel(feature.lane)} {feature.tier}</span>
            </div>
            <h2 className="focus-title">{feature.name}</h2>
            <p className="focus-desc">
              {feature.tags.slice(0, 2).join(" / ")}。查看其克制关系，以及当前版本能压制的对手。
            </p>
            <div className="focus-tags">
              {feature.tags.slice(0, 3).map((t) => <span className="pill" key={t}>{t}</span>)}
            </div>
            <div className="focus-actions">
              <button className="btn btn-primary" onClick={() => setSheet(feature.name)}>
                查看英雄详情
              </button>
              <button className="btn" onClick={() => goTab("strength")}>
                打开梯度榜
              </button>
            </div>
          </div>
        </section>

        <section className="quick-panel" aria-label="常用入口">
          <div className="quick-panel-head">
            <h2>常用入口</h2>
          </div>
          {tools.map((t) => (
            <button
              key={t.title}
              className={`quick-row ${t.primary ? "is-primary" : ""}`}
              onClick={() => (t.tab ? goTab(t.tab) : navigate(t.page))}
            >
              <span className="quick-ico"><Icon name={t.icon} /></span>
              <span className="quick-copy">
                <span className="quick-title">
                  {t.title}
                  {t.badge ? <span className="quick-badge">{t.badge}</span> : null}
                </span>
                <span className="quick-sub">{t.sub}</span>
              </span>
              <span className="quick-chev"><Icon name="chevronRight" /></span>
            </button>
          ))}
        </section>

        <section className="section">
          <SectionHead title="本周阵容" sub="五黑 / 双排 / 三排 / 娱乐" onMore={() => navigate("comps")} />
          <div className="rail">
            {COMPS.slice(0, 6).map((c) => (
              <button className="comp-card" key={c.id} onClick={() => navigate("comps", { focus: c.id })}>
                <div className="comp-avatars">
                  {LANES.map((l) => <Avatar key={l.lane} name={c.picks[l.lane]} size={28} />)}
                </div>
                <div className="name">{c.name}</div>
                <div className="style">{c.style}</div>
                <div className="row">
                  {c.style.split(" · ").map((s) => <span className="pill" key={s}>{s}</span>)}
                  <span className="pill red">Ban {c.bans.length}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHead title="名师课堂" sub={`三个栏目 · ${COACHES.length} 位`} onMore={() => navigate("coaches")} />
          <div className="list">
            {COACHES.slice(0, 4).map((c) => (
              <button className="row" key={c.name} onClick={() => navigate("coaches", { focus: c.name })}>
                <img
                  className="coach-ava coach-img"
                  src={c.avatar ? `/${c.avatar}` : "/coaches/_default.jpg"}
                  alt={c.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/coaches/_default.jpg";
                  }}
                />
                <span className="grow">
                  <span className="title">{c.name}</span>
                  <span className="sub">{c.heroes.slice(0, 2).join(" · ")}</span>
                </span>
                <span className="pill blue">{c.platform === "douyin" ? "抖音" : "B站"}{c.pro ? " · KPL" : ""}</span>
                <span className="chev"><Icon name="chevronRight" /></span>
              </button>
            ))}
          </div>
        </section>

        {recentHeroes.length > 0 ? (
          <section className="section">
            <SectionHead title="最近查看" sub="继续上次的研究" onMore={() => navigate("favorites")} />
            <div className="rail">
              {recentHeroes.map((r) => (
                <button
                  key={r.name}
                  onClick={() => setSheet(r.name)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 auto" }}
                >
                  <Avatar name={r.name} size={48} ring={hero(r.name).tier === "T0"} />
                  <span className="tiny muted">{r.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
