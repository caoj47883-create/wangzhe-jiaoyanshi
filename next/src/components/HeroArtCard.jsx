import { useState } from "react";
import { Avatar, BrandHeader, FavButton, HeroArt, SectionHead } from "../components/common.jsx";
import { Icon } from "./icons.jsx";
import { hero, laneLabel, tierFor } from "../lib/data.js";
import { useApp } from "../lib/store.js";

/** 英雄原画卡（首页/搜索/阵容详情复用） */
export default function HeroArtCard({ name, lane, onOpen, size = 158, showFav = true }) {
  const { navigate, pushRecent } = useApp();
  const h = hero(name);
  const tier = tierFor(h, lane);
  const open = () => {
    pushRecent("hero", name);
    if (onOpen) onOpen(name);
    else navigate("search", { hero: name });
  };
  return (
    <button className="hero-card" style={{ flexBasis: size }} onClick={open}>
      <HeroArt name={name} className="art" />
      <span className="grad" />
      <span className="corner">
        <span className={`tier-badge ${tier === "T0" ? "t0" : tier === "T0.5" ? "t05" : "t1"}`}>{tier}</span>
      </span>
      {showFav ? <FavButton name={name} className="fav" /> : null}
      <span className="info">
        <span className="name">{name}</span>
        <span className="tags">
          {h.tags.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </span>
      </span>
    </button>
  );
}
