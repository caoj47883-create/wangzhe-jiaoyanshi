import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { artUrl, avatarUrl, DATA, hero, laneLabel } from "../lib/data.js";
import { useApp } from "../lib/store.js";
import { APP_VERSION } from "../lib/config.js";
import { Icon } from "./icons.jsx";

/* ---------------------------------------------------------------- 头像 */
export function Avatar({ name, size = 36, className = "", ring = false }) {
  const h = hero(name);
  const [fail, setFail] = useState(false);
  const style = { width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
  if (!h.id || fail) {
    return (
      <span
        className={`avatar ${className}`}
        style={{
          ...style,
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--serif)",
          fontWeight: 700,
          fontSize: Math.max(11, size * 0.34),
          color: "var(--gold-2)",
          background: "linear-gradient(150deg, #2a3140, #141922)",
          boxShadow: ring ? "0 0 0 2px var(--gold-line)" : undefined,
        }}
      >
        {String(name || "?").slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={avatarUrl(h)}
      alt={name}
      loading="lazy"
      draggable={false}
      onError={() => setFail(true)}
      className={`avatar ${className}`}
      style={{ ...style, boxShadow: ring ? "0 0 0 2px var(--gold-line)" : undefined }}
    />
  );
}

/* ---------------------------------------------------------------- 英雄原画（带兜底） */
export function HeroArt({ name, className = "", style, alt }) {
  const h = hero(name);
  const [fail, setFail] = useState(false);
  if (!h.id || fail) {
    return (
      <div className={`hero-fallback ${className}`} style={style}>
        {String(name || "").slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={artUrl(h)}
      alt={alt || name}
      className={className}
      style={style}
      loading="lazy"
      draggable={false}
      onError={() => setFail(true)}
    />
  );
}

/* ---------------------------------------------------------------- 梯度徽章 */
export function TierBadge({ tier, className = "" }) {
  const cls = { T0: "t0", "T0.5": "t05", T1: "t1", T2: "t2", T3: "t3" }[tier] || "t2";
  return <span className={`tier-badge ${cls} ${className}`}>{tier}</span>;
}

/* ---------------------------------------------------------------- 收藏按钮 */
export function FavButton({ name, className = "", plain = false }) {
  const { isFav, toggleFav } = useApp();
  const on = isFav(name);
  return (
    <button
      className={`fav-btn ${plain ? "plain" : ""} ${on ? "on" : ""} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleFav(name);
      }}
      aria-label={on ? "取消收藏" : "收藏"}
    >
      <Icon name="heart" filled={on} />
    </button>
  );
}

/* ---------------------------------------------------------------- 区块标题 */
export function SectionHead({ title, sub, moreLabel = "全部", onMore, iconName }) {
  return (
    <div className="section-head">
      <h2 className="h2">{title}</h2>
      {sub ? <span className="sub">{sub}</span> : null}
      {onMore ? (
        <button className="more" onClick={onMore}>
          {moreLabel}
          <Icon name={iconName || "chevronRight"} />
        </button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- 顶部栏 */
export function BrandHeader({ onSearch }) {
  const { theme, setTheme } = useApp();
  return (
    <header className="topbar">
      <div className="brand-mark">王</div>
      <div className="brand-text">
        <p className="eyebrow">COUNTER-PICK LAB</p>
        <h1 className="brand-title">
          王者教研室
          <span className="ver-pill">V{APP_VERSION}</span>
        </h1>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" aria-label="搜索" onClick={onSearch}>
          <Icon name="search" />
        </button>
        <button className="icon-btn gold" aria-label="切换主题" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </div>
    </header>
  );
}

export function PageHead({ eyebrow, title, sub, onBack, actions = null }) {
  return (
    <header className="page-head">
      {onBack ? (
        <button className="icon-btn back" aria-label="返回" onClick={onBack}>
          <Icon name="chevronLeft" />
        </button>
      ) : null}
      <div className="titles">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="h-display h1">{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}

/* ---------------------------------------------------------------- 底部 Tab */
const TABS = [
  { id: "home", icon: "home", label: "首页" },
  { id: "strength", icon: "crown", label: "英雄" },
  { id: "bp", icon: "swords", label: "BP" },
  { id: "items", icon: "shield", label: "出装" },
  { id: "more", icon: "grid", label: "更多" },
];

export function TabBar() {
  const { tab, goTab } = useApp();
  const [hidden, setHidden] = useState(false);
  const idx = TABS.findIndex((t) => t.id === tab);
  const tabIndex = idx < 0 ? 0 : idx;

  // iOS 式交互：下滑隐藏、上滑/回顶出现；切 Tab 时立即复位
  useEffect(() => {
    let lastY = 0;
    let ticking = false;
    const onScroll = (e) => {
      const el = e.target;
      if (!el || !el.classList || !el.classList.contains("page")) return;
      const y = el.scrollTop;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (y < 24) { setHidden(false); lastY = y; return; }
        const dy = y - lastY;
        if (dy > 10) setHidden(true);
        else if (dy < -10) setHidden(false);
        lastY = y;
      });
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  useEffect(() => { setHidden(false); }, [tab]);

  return (
    <nav className={`tabbar ${hidden ? "hidden" : ""}`} style={{ "--tab-index": tabIndex }} aria-label="主导航">
      <span className="tab-indicator" aria-hidden="true" />
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${tab === t.id ? "on" : ""}`}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => goTab(t.id)}
        >
          <span className="wrap">
            <Icon name={t.icon} />
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- 底部弹层 */
export function Sheet({ onClose, children, maskClassName = "" }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const host = typeof document !== "undefined" ? document.getElementById("overlay-root") : null;
  const node = (
    <div
      className={`sheet-mask ${maskClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
    >
      <div className="sheet" ref={bodyRef}>
        {children}
      </div>
    </div>
  );
  return host ? createPortal(node, host) : node;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

/* ---------------------------------------------------------------- 小工具 */
export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1900);
  };
  return { msg, show };
}
