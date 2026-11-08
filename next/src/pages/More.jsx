import { PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import { useApp } from "../lib/store.js";
import { COACHES, COMPS, DATA, HEROES, STATS } from "../lib/data.js";
import { APP_VERSION } from "../lib/config.js";
import { currentDataVersion } from "../lib/update.js";

export default function More() {
  const { navigate, recents, favorites } = useApp();

  const item = (icon, color, title, sub, onClick) => (
    <button className="row" onClick={onClick}>
      <span
        className="avatar"
        style={{ width: 36, height: 36, display: "grid", placeItems: "center", background: color[0], color: color[1] }}
      >
        <Icon name={icon} style={{ width: 17, height: 17 }} />
      </span>
      <span className="grow">
        <span className="title">{title}</span>
        <span className="sub">{sub}</span>
      </span>
      <span className="chev">
        <Icon name="chevronRight" />
      </span>
    </button>
  );

  return (
    <div className="page">
      <PageHead eyebrow="MORE" title="更多" sub="内容库 · 我的 · 设置" />
      <div className="page-inner" style={{ paddingTop: 4 }}>
        <div className="card card-dark card-pad" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="brand-mark">王</div>
            <div>
              <div className="h3">王者教研室</div>
              <div className="tiny faint" style={{ marginTop: 2 }}>
                V{APP_VERSION} · 数据 {currentDataVersion()}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="num" style={{ fontSize: "1.3rem", color: "var(--gold-2)", fontWeight: 700 }}>
                {STATS.heroes}
              </div>
              <div className="tiny faint">英雄数据</div>
            </div>
          </div>
        </div>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">内容库</h2>
          </div>
          <div className="list">
            {item("spark", ["var(--gold-soft)", "var(--gold)"], "AI 问答", "结合本版本数据回答 · 需配置外部接口", () => navigate("ai"))}
            {item("users", ["var(--gold-soft)", "var(--gold)"], "五黑阵容", `${COMPS.length} 套体系 · 思路 / 弱点 / Ban 位`, () => navigate("comps"))}
            {item("book", ["var(--blue-soft)", "var(--blue)"], "名师课堂", `${COACHES.length} 位 KPL 选手与高人气主播`, () => navigate("coaches"))}
            {item("search", ["var(--surface-2)", "var(--muted)"], "全局搜索", "英雄 / 阵容 / 名师，一次搜全站", () => navigate("search"))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">我的</h2>
          </div>
          <div className="list">
            {item(
              "heart",
              ["var(--red-soft)", "var(--red)"],
              "我的收藏",
              `${favorites.length} 位英雄 · 最近浏览 ${recents.length} 条`,
              () => navigate("favorites")
            )}
            {item("settings", ["var(--surface-2)", "var(--muted)"], "设置", "主题 · 字号 · 数据清理", () => navigate("settings"))}
          </div>
        </section>

        <p className="footer tiny faint" style={{ textAlign: "center", marginTop: 26, lineHeight: 1.9, fontFamily: "var(--mono)" }}>
          数据来自公开资料整理 · 仅供学习参考
          <br />
          {HEROES.length} HEROES · {STATS.comps} COMPS · {STATS.coaches} COACHES
        </p>
      </div>
    </div>
  );
}
