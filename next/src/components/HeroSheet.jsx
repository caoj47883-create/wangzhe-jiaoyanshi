import { useEffect, useMemo, useState } from "react";
import { Avatar, HeroArt, Sheet, TierBadge } from "../components/common.jsx";
import { Icon } from "./icons.jsx";
import { countersAgainst, countersBy, hero, laneLabel, tierFor } from "../lib/data.js";
import { useApp } from "../lib/store.js";
import { shareImage } from "../lib/share.js";

/** 英雄详情弹层：梯度 / 词条 / 克制关系 / 出装入口 */
export default function HeroSheet({ name, laneCtx, onClose }) {
  const { navigate, isFav, toggleFav, pushRecent, registerCloser, showToast } = useApp();
  const h = hero(name);
  const lane = laneCtx || h.lane;
  const tier = tierFor(h, lane);
  const against = countersAgainst(name).slice(0, 4);
  const beats = countersBy(name).slice(0, 3);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    pushRecent("hero", name);
    const off = registerCloser(onClose);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const doShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareImage({
        kind: "hero",
        title: name,
        subtitle: `${laneLabel(lane)} · ${tier} · ${h.tags.slice(0, 3).join(" / ")}`,
        heroNames: [name],
        lines: [
          { label: "克制他 → 你可以拿", text: against.map((c) => c.hero).join("、") || "暂无记录" },
          { label: "他能克制", text: beats.map((c) => c.hero).join("、") || "暂无记录" },
        ],
      });
      showToast("已生成分享图");
    } catch (e) {
      showToast("分享图生成失败");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-art">
        <HeroArt name={name} className="art" />
        <div className="veil" />
        <div className="handle" />
        <button className="close" onClick={onClose} aria-label="关闭">
          <Icon name="x" />
        </button>
        <div className="title">
          <h2>{name}</h2>
          <div className="pills">
            <span className={`pill ${tier === "T0" ? "gold" : ""}`}>{tier}</span>
            {h.lanes.map((l) => (
              <span className="pill" key={l}>
                {laneLabel(l)}
              </span>
            ))}
            {h.tags.slice(0, 3).map((t) => (
              <span className="pill" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="sheet-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`btn ${isFav(name) ? "btn-dark" : "btn-primary"} btn-sm`} onClick={() => toggleFav(name)}>
            <Icon name="heart" filled={isFav(name)} />
            {isFav(name) ? "已收藏" : "收藏"}
          </button>
          <button className="btn btn-dark btn-sm" onClick={() => navigate("items", { hero: name })}>
            <Icon name="shield" />
            看出装
          </button>
          <button className="btn btn-dark btn-sm" onClick={doShare} disabled={sharing}>
            <Icon name="share" />
            {sharing ? "生成中…" : "分享"}
          </button>
        </div>
        <div className="sheet-note">
          <span className="ico">
            <Icon name="spark" />
          </span>
          <span>「实战记录」整理自公开对局资料；标「推导」的条目按英雄特性词条推算，仅供参考，请结合阵容与操作水平判断。</span>
        </div>
        <div className="sub-head gold">
          <span className="tag">克制他 → 你可以拿</span>
          <span className="line" />
        </div>
        {against.length ? (
          against.map((c) => (
            <div className="counter-item" key={c.hero}>
              <Avatar name={c.hero} size={36} />
              <div>
                <div className="who">
                  <b>{c.hero}</b>
                  <span className="lane-tag">{laneLabel(hero(c.hero).lane)}</span>
                  {c.source === "derived" ? <span className="src">推导</span> : null}
                </div>
                <p className="reason">{c.reason}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="faint small" style={{ padding: "4px 2px 10px" }}>
            暂无明确克制记录。
          </p>
        )}
        <div className="sub-head blue">
          <span className="tag">他能克制 → 对面拿他小心</span>
          <span className="line" />
        </div>
        {beats.length ? (
          beats.map((c) => (
            <div className="counter-item" key={c.hero}>
              <Avatar name={c.hero} size={36} />
              <div>
                <div className="who">
                  <b>{c.hero}</b>
                  <span className="lane-tag">{laneLabel(hero(c.hero).lane)}</span>
                  {c.source === "derived" ? <span className="src">推导</span> : null}
                </div>
                <p className="reason">{c.reason}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="faint small" style={{ padding: "4px 2px 10px" }}>
            暂无记录。
          </p>
        )}
      </div>
    </Sheet>
  );
}
