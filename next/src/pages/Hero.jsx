import { useEffect, useMemo, useState } from "react";
import { PageHead, TierBadge } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import HeroArtCard from "../components/HeroArtCard.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { HEROES, LANES, TIERS, hero, laneLabel, rankOf, tierFor } from "../lib/data.js";
import { useApp } from "../lib/store.js";

const TIER_FILTERS = ["all", "T0", "T0.5", "T1", "T2", "T3"];

export default function HeroPage({ params }) {
  const { navigate, theme, setTheme, pushRecent } = useApp();
  const [lane, setLane] = useState(params.lane || "jungle");
  const [filter, setFilter] = useState("all");
  const [sheet, setSheet] = useState(params.hero || null);

  useEffect(() => {
    if (params.hero) {
      setSheet(params.hero);
      pushRecent("hero", params.hero);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.hero]);

  const tiers = useMemo(() => TIERS[lane] || [], [lane]);
  const t0 = tiers.find((t) => t.tier === "T0");
  const rest = tiers.filter((t) => t.tier !== "T0");
  const show = (t) => filter === "all" || filter === t;

  const openHero = (name) => {
    pushRecent("hero", name);
    setSheet(name);
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="TIER LIST · S12"
        title="英雄强度"
        sub={`${laneLabel(lane)}梯度 · ${HEROES.length} 英雄 · 点英雄看克制链`}
        actions={
          <>
            <button className="icon-btn" aria-label="搜索" onClick={() => navigate("search")}>
              <Icon name="search" />
            </button>
            <button className="icon-btn gold" aria-label="主题" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </>
        }
      />
      <div className="page-inner" style={{ paddingTop: 0 }}>
        <div className="seg-wrap">
          <div className="seg">
            {LANES.map((l) => (
              <button key={l.lane} className={lane === l.lane ? "on" : ""} onClick={() => setLane(l.lane)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filters" style={{ marginBottom: 4 }}>
          {TIER_FILTERS.map((f) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "全部" : f}
            </button>
          ))}
        </div>

        {t0 && show("T0") ? (
          <section className="section">
            <div className="section-head">
              <TierBadge tier="T0" />
              <span className="small muted">非 Ban 必选 · 版本答案</span>
              <span className="more" style={{ marginLeft: "auto", padding: "2px 8px" }}>
                {t0.heroes.length} PICKS
              </span>
            </div>
            <div className="rail">
              {t0.heroes.map((n) => (
                <HeroArtCard key={n} name={n} lane={lane} onOpen={openHero} />
              ))}
            </div>
          </section>
        ) : null}

        {rest.map((t) =>
          show(t.tier) ? (
            <section className="section" key={t.tier}>
              <div className="section-head">
                <TierBadge tier={t.tier} />
                <span className="small muted">
                  {t.tier === "T0.5" ? "强势轮换" : t.tier === "T1" ? "主流可用" : t.tier === "T2" ? "counter 位 / 绝活" : "其余英雄"}
                </span>
                <span className="more" style={{ marginLeft: "auto", padding: "2px 8px" }}>
                  {t.heroes.length}
                </span>
              </div>
              <div className="hero-grid">
                {t.heroes.map((n) => {
                  const h = hero(n);
                  const tier = tierFor(h, lane);
                  return (
                    <button className={`hg ${tier === "T0" ? "t0" : ""}`} key={n} onClick={() => openHero(n)}>
                      <span className="ava">
                        <AvatarEl name={n} />
                      </span>
                      <span className="nm">{n}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null
        )}

        <p className="footer tiny faint" style={{ textAlign: "center", marginTop: 26, letterSpacing: "0.2em", fontFamily: "var(--mono)" }}>
          梯度为人工整理 · 当前赛季环境 · 仅供参考
        </p>
      </div>
      {sheet ? <HeroSheet name={sheet} laneCtx={lane} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function AvatarEl({ name }) {
  const h = hero(name);
  const [fail, setFail] = useState(false);
  if (!h.id || fail) {
    return (
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          fontFamily: "var(--serif)",
          fontWeight: 700,
          fontSize: 12,
          color: "var(--gold-2)",
          background: "linear-gradient(150deg, #2a3140, #141922)",
        }}
      >
        {name.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={`/avatar/${h.id}.webp`}
      alt={name}
      loading="lazy"
      draggable={false}
      onError={() => setFail(true)}
      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
    />
  );
}
