import { useMemo, useState } from "react";
import { BrandHeader, HeroArt, SectionHead, Avatar } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { COACHES, COMPS, HEROES, LANES, laneLabel, STATS, hero, tierFor } from "../lib/data.js";
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
    { tab: "strength", icon: "crown", title: "英雄强度", sub: "T0–T3 · 分路梯度榜" },
    { tab: "bp", icon: "swords", title: "BP 助手", sub: "禁用推测 · 实时反制", dark: true },
    { tab: "items", icon: "shield", title: "针对出装", sub: "敌方阵容 · 装备铭文" },
    { page: "comps", icon: "users", title: "五黑阵容", sub: "30 套体系 · 含 Ban 位" },
  ];

  const recentHeroes = recents.filter((r) => r.type === "hero").slice(0, 8);

  return (
    <div className="page">
      <div className="page-inner" style={{ paddingTop: 0 }}>
        <BrandHeader onSearch={() => navigate("search")} />

        <section className="cover">
          <HeroArt name={feature.name} className="art" />
          <div className="veil" />
          <div className="grain" />
          <div className="cover-top">
            <span className="glass-pill">
              <span className="dot" />
              S12 · {laneLabel(feature.lane)} {feature.tier}
            </span>
            <span className="glass-pill ghost">META PICK</span>
          </div>
          <div className="cover-body">
            <div className="kicker">
              <span className="line" />
              <span>本周版本焦点</span>
            </div>
            <h2 className="cover-title">{feature.name}</h2>
            <p className="cover-desc">
              版本 {feature.tier} {laneLabel(feature.lane)} · {feature.tags.slice(0, 2).join(" / ")}。
              点开查看克制他的英雄，以及他能压制的对手。
            </p>
            <div className="cover-tags">
              {feature.tags.slice(0, 3).map((t) => (
                <span className="chip" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <div className="cover-foot">
              <button className="btn btn-primary" onClick={() => setSheet(feature.name)}>
                查看克制链
                <Icon name="arrowRight" />
              </button>
              <div className="meta">
                <b>{STATS.heroes} 英雄库</b>
                <span>1,000+ MATCHUPS</span>
              </div>
            </div>
          </div>
        </section>

        <section className="tools" style={{ marginTop: 18 }}>
          {tools.map((t) => (
            <button
              key={t.title}
              className={`tool ${t.dark ? "dark" : ""}`}
              onClick={() => (t.tab ? goTab(t.tab) : navigate(t.page))}
            >
              <span className="arrow">
                <Icon name="arrowRight" />
              </span>
              <span className="ico">
                <Icon name={t.icon} />
              </span>
              <h3>{t.title}</h3>
              <p>{t.sub}</p>
              {t.dark ? <span className="tag">LIVE DRAFT · 实时</span> : null}
            </button>
          ))}
        </section>

        <section className="stats" style={{ marginTop: 16 }}>
          <div className="cell">
            <b>{STATS.heroes}</b>
            <span>英雄</span>
          </div>
          <div className="cell">
            <b>1,000+</b>
            <span>克制关系</span>
          </div>
          <div className="cell">
            <b>{STATS.comps}</b>
            <span>套阵容</span>
          </div>
          <div className="cell">
            <b>{STATS.coaches}</b>
            <span>位名师</span>
          </div>
        </section>

        <section className="section">
          <SectionHead title="本周阵容" sub="五黑体系库" onMore={() => navigate("comps")} />
          <div className="rail">
            {COMPS.slice(0, 6).map((c) => (
              <button className="comp-card" key={c.id} onClick={() => navigate("comps", { focus: c.id })}>
                <div className="comp-avatars">
                  {LANES.map((l) => (
                    <Avatar key={l.lane} name={c.picks[l.lane]} size={33} />
                  ))}
                </div>
                <div className="name">{c.name}</div>
                <div className="style">{c.style}</div>
                <div className="row">
                  {c.style.split(" · ").map((s) => (
                    <span className="pill gold" key={s}>
                      {s}
                    </span>
                  ))}
                  <span className="pill red">Ban {c.bans.length}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHead title="名师课堂" sub="KPL 选手 · 高人气主播" onMore={() => navigate("coaches")} />
          <div className="rail">
            {COACHES.slice(0, 8).map((c) => (
              <button className="coach-card" key={c.name} onClick={() => navigate("coaches", { focus: c.name })}>
                <div className="coach-ava">{c.name.slice(0, 1)}</div>
                <div className="name">{c.name}</div>
                <div className="desc">{c.desc}</div>
                <span className={`pill ${c.platform === "douyin" ? "red" : "blue"}`}>
                  {c.platform === "douyin" ? "抖音" : "B站"}
                  {c.pro ? " · KPL" : ""}
                </span>
                <div className="row" style={{ marginTop: 8 }}>
                  {c.heroes.slice(0, 2).map((h) => (
                    <span className="pill blue" key={h}>
                      {h}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {recentHeroes.length > 0 ? (
          <section className="section">
            <SectionHead title="最近查看" sub="继续上次的研究" onMore={() => navigate("favorites")} moreLabel="更多" />
            <div className="rail">
              {recentHeroes.map((r) => (
                <button
                  key={r.name}
                  onClick={() => setSheet(r.name)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto" }}
                >
                  <Avatar name={r.name} size={54} ring={hero(r.name).tier === "T0"} />
                  <span className="tiny muted">{r.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <p className="footer tiny faint" style={{ textAlign: "center", marginTop: 28, letterSpacing: "0.2em", fontFamily: "var(--mono)" }}>
          V2.0 · 数据来自公开资料整理
        </p>
      </div>
      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
