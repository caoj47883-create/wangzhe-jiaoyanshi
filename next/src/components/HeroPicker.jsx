import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./common.jsx";
import { Icon } from "./icons.jsx";
import { HEROES, LANES, hero, laneLabel, rankOf } from "../lib/data.js";
import { useApp } from "../lib/store.js";

/** 通用英雄选择器（BP / 出装 / 搜索等页面复用） */
export default function HeroPicker({ title = "选择英雄", exclude = [], onPick, onClose, subtitle }) {
  const [lane, setLane] = useState("all");
  const [q, setQ] = useState("");
  const { registerCloser } = useApp();

  // 安卓硬件返回键先关选择器
  useEffect(() => registerCloser(onClose), [onClose, registerCloser]);

  const list = useMemo(() => {
    const ex = new Set(exclude);
    return HEROES.filter((h) => !ex.has(h.name))
      .filter((h) => (lane === "all" ? true : h.lane === lane))
      .filter((h) => (q.trim() ? h.name.includes(q.trim()) || h.tags.some((t) => t.includes(q.trim())) : true))
      .sort((a, b) => rankOf(a.rank) - rankOf(b.rank))
      .slice(0, 80);
  }, [lane, q, exclude]);

  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: "18px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <p className="eyebrow">PICK A HERO</p>
            <h2 className="h-display h2" style={{ marginTop: 2 }}>
              {title}
            </h2>
            {subtitle ? <p className="tiny faint" style={{ marginTop: 3 }}>{subtitle}</p> : null}
          </div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="关闭">
            <Icon name="x" />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            <Icon name="search" style={{ width: 15, height: 15, color: "var(--faint)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索英雄名 / 词条"
              style={{ flex: 1, fontSize: "0.78rem", background: "transparent" }}
              autoFocus={false}
            />
            {q ? (
              <button onClick={() => setQ("")} aria-label="清空" style={{ color: "var(--faint)", display: "grid", placeItems: "center" }}>
                <Icon name="x" style={{ width: 14, height: 14 }} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="filters" style={{ marginTop: 10, paddingBottom: 10 }}>
          <button className={`chip ${lane === "all" ? "on" : ""}`} onClick={() => setLane("all")}>
            全部
          </button>
          {LANES.map((l) => (
            <button key={l.lane} className={`chip ${lane === l.lane ? "on" : ""}`} onClick={() => setLane(l.lane)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-body" style={{ paddingTop: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px 4px" }}>
          {list.map((h) => (
            <button
              key={h.name}
              onClick={() => onPick(h.name)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            >
              <span
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  padding: 2,
                  border: `1.5px solid ${h.tier === "T0" ? "var(--gold-line)" : "var(--line)"}`,
                  background: "var(--surface-2)",
                }}
              >
                <HeroAvatar name={h.name} />
              </span>
              <span className="tiny muted" style={{ fontSize: ".58rem" }}>
                {h.name}
              </span>
            </button>
          ))}
          {list.length === 0 ? <p className="empty" style={{ gridColumn: "1 / -1" }}>没有匹配的英雄。</p> : null}
        </div>
      </div>
    </Sheet>
  );
}

function HeroAvatar({ name }) {
  const h = hero(name);
  const [fail, setFail] = useState(false);
  if (!h.id || fail) {
    return (
      <span
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--serif)",
          fontWeight: 700,
          fontSize: 11,
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
