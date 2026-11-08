import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { Avatar as _Avatar } from "../components/common.jsx";
import { COACHES, COMPS, HEROES, hero, laneLabel, rankOf, tierFor } from "../lib/data.js";
import { useApp } from "../lib/store.js";

const HOT_HEROES = ["镜", "海月", "公孙离", "关羽", "女娲", "东皇太一"];
const HOT_COMPS = ["KPL 经典运营", "狂暴养猪流"];

export default function Search({ params }) {
  const { back, navigate, pushRecent } = useApp();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [sheet, setSheet] = useState(params.hero || null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (params.hero) {
      setSheet(params.hero);
      pushRecent("hero", params.hero);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.hero]);

  const kw = q.trim();
  const results = useMemo(() => {
    if (!kw) return { heroes: [], comps: [], coaches: [] };
    const heroes = HEROES.filter((h) => h.name.includes(kw) || h.tags.some((t) => t.includes(kw)))
      .sort((a, b) => rankOf(a.rank) - rankOf(b.rank))
      .slice(0, 12);
    const comps = COMPS.filter(
      (c) => c.name.includes(kw) || c.style.includes(kw) || Object.values(c.picks).some((p) => p.includes(kw)) || c.idea.includes(kw)
    ).slice(0, 8);
    const coaches = COACHES.filter(
      (c) => c.name.includes(kw) || c.desc.includes(kw) || c.heroes.some((h) => h.includes(kw))
    ).slice(0, 8);
    return { heroes, comps, coaches };
  }, [kw]);

  const total = results.heroes.length + results.comps.length + results.coaches.length;
  const show = (k) => kind === "all" || kind === k;

  const openHero = (name) => {
    pushRecent("hero", name);
    setSheet(name);
  };

  return (
    <div className="page">
      <PageHead eyebrow="SEARCH" title="搜索" sub="英雄 · 阵容 · 名师，一次搜全站" onBack={back} />
      <div className="page-inner" style={{ paddingTop: 8 }}>
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 14 }}
        >
          <Icon name="search" style={{ width: 17, height: 17, color: "var(--faint)" }} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜英雄名 / 词条 / 阵容流派 / 主播"
            style={{ flex: 1, fontSize: "0.82rem", background: "transparent" }}
          />
          {q ? (
            <button onClick={() => setQ("")} aria-label="清空" style={{ color: "var(--faint)", display: "grid", placeItems: "center" }}>
              <Icon name="x" style={{ width: 15, height: 15 }} />
            </button>
          ) : null}
        </div>

        <div className="filters" style={{ marginTop: 12 }}>
          {[
            ["all", "全部"],
            ["hero", "英雄"],
            ["comp", "阵容"],
            ["coach", "名师"],
          ].map(([k, label]) => (
            <button key={k} className={`chip ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>

        {!kw ? (
          <div style={{ marginTop: 20 }}>
            <div className="section-head">
              <h2 className="h2">热门搜索</h2>
              <span className="sub">试试这些</span>
            </div>
            <div className="filters" style={{ flexWrap: "wrap", gap: 8 }}>
              {HOT_HEROES.map((n) => (
                <button key={n} className="chip" onClick={() => setQ(n)}>
                  {n}
                </button>
              ))}
              {HOT_COMPS.map((n) => (
                <button key={n} className="chip" onClick={() => setQ(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="section-head" style={{ marginTop: 26 }}>
              <h2 className="h2">快捷入口</h2>
            </div>
            <div className="list">
              <button className="row" onClick={() => navigate("comps")}>
                <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--gold-soft)", color: "var(--gold)" }}>
                  <Icon name="users" style={{ width: 16, height: 16 }} />
                </span>
                <span className="grow">
                  <span className="title">全部五黑阵容</span>
                  <span className="sub">30 套体系 · 带思路与 Ban 位</span>
                </span>
                <span className="chev">
                  <Icon name="chevronRight" />
                </span>
              </button>
              <button className="row" onClick={() => navigate("coaches")}>
                <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--blue-soft)", color: "var(--blue)" }}>
                  <Icon name="book" style={{ width: 16, height: 16 }} />
                </span>
                <span className="grow">
                  <span className="title">名师课堂</span>
                  <span className="sub">51 位 KPL 选手与主播</span>
                </span>
                <span className="chev">
                  <Icon name="chevronRight" />
                </span>
              </button>
            </div>
          </div>
        ) : total === 0 ? (
          <div className="empty" style={{ marginTop: 30 }}>
            <Icon name="search" style={{ width: 32, height: 32, color: "var(--faint)", marginBottom: 12 }} />
            <div>没有找到「{kw}」</div>
            <div style={{ marginTop: 4 }}>换个英雄名、词条或阵容流派试试。</div>
          </div>
        ) : (
          <div style={{ paddingBottom: 10 }}>
            {show("hero") && results.heroes.length ? (
              <section className="section" style={{ marginTop: 18 }}>
                <div className="section-head">
                  <h2 className="h2">英雄</h2>
                  <span className="sub">{results.heroes.length} 个结果</span>
                </div>
                <div className="hero-grid" style={{ gap: "16px 6px" }}>
                  {results.heroes.map((h) => (
                    <button key={h.name} className="hg" onClick={() => openHero(h.name)}>
                      <span className="ava" style={{ width: 56, height: 56 }}>
                        <_Avatar name={h.name} size={50} ring={h.tier === "T0"} />
                      </span>
                      <span className="nm">{h.name}</span>
                      <span className="tiny faint" style={{ fontSize: ".5rem" }}>
                        {laneLabel(h.lane)} · {tierFor(h, h.lane)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {show("comp") && results.comps.length ? (
              <section className="section">
                <div className="section-head">
                  <h2 className="h2">阵容</h2>
                  <span className="sub">{results.comps.length} 套</span>
                </div>
                <div className="list">
                  {results.comps.map((c) => (
                    <button key={c.id} className="row" onClick={() => navigate("comps", { focus: c.id })}>
                      <span style={{ display: "flex", gap: 3 }}>
                        {Object.values(c.picks).slice(0, 3).map((p) => (
                          <Avatar key={p} name={p} size={30} />
                        ))}
                      </span>
                      <span className="grow">
                        <span className="title">{c.name}</span>
                        <span className="sub">{c.style}</span>
                      </span>
                      <span className="chev">
                        <Icon name="chevronRight" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {show("coach") && results.coaches.length ? (
              <section className="section">
                <div className="section-head">
                  <h2 className="h2">名师</h2>
                  <span className="sub">{results.coaches.length} 位</span>
                </div>
                <div className="list">
                  {results.coaches.map((c) => (
                    <button key={c.name} className="row" onClick={() => navigate("coaches", { focus: c.name })}>
                      <span className="coach-ava" style={{ width: 34, height: 34, marginBottom: 0, fontSize: ".9rem" }}>
                        {c.name.slice(0, 1)}
                      </span>
                      <span className="grow">
                        <span className="title">
                          {c.name}
                          {c.pro ? (
                            <span className="pill gold" style={{ marginLeft: 6, padding: "1px 6px", fontSize: ".5rem" }}>
                              KPL
                            </span>
                          ) : null}
                        </span>
                        <span className="sub">{c.heroes.slice(0, 3).join(" / ")}</span>
                      </span>
                      <span className="chev">
                        <Icon name="chevronRight" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
      {sheet ? <HeroSheet name={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
