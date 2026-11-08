import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  HeroArt,
  PageHead,
  SectionHead,
  TierBadge,
} from "../components/common.jsx";
import HeroPicker from "../components/HeroPicker.jsx";
import { Icon } from "../components/icons.jsx";
import { HEROES, LANES, hasHero, hero, laneLabel, tierFor } from "../lib/data.js";
import { itemPlan, matchupWarnings } from "../lib/engine.js";
import { shareImage } from "../lib/share.js";
import { useApp } from "../lib/store.js";

const MAX_ENEMY = 5;
const KIND_CLASS = { 物理: "phys", 法术: "magic", 鞋子: "boots", 防御: "def", 功能: "util" };

const cleanEnemies = (list) =>
  Array.isArray(list)
    ? list.filter((n) => typeof n === "string" && hasHero(n)).slice(0, MAX_ENEMY)
    : [];

const safeHero = (name) => (typeof name === "string" && hasHero(name) ? name : "");

export default function Items({ params }) {
  const { navigate, showToast, lastBp, lastItems, setLastItems, theme, setTheme } = useApp();

  const fromBp = params.from === "bp";
  const bp = fromBp ? lastBp : null;
  const bpLane = bp && LANES.some((l) => l.lane === bp.lane) ? bp.lane : null;
  const bpPicked = bp && Array.isArray(bp.picks) && bp.picks[0] ? safeHero(bp.picks[0]) : "";

  const [enemies, setEnemies] = useState(() => {
    if (bp) return cleanEnemies(bp.enemyPicks);
    if (lastItems && Array.isArray(lastItems.enemyPicks)) return cleanEnemies(lastItems.enemyPicks);
    return [];
  });
  /* 从 BP 进入时我的英雄留空（由用户确认），其余入口沿用上次浏览/英雄详情带入 */
  const [myHero, setMyHero] = useState(() =>
    safeHero(params.hero) || (bp ? "" : safeHero(lastItems?.hero))
  );
  const [picker, setPicker] = useState(null);
  const [sharing, setSharing] = useState(false);

  const me = myHero ? hero(myHero) : null;
  const plan = useMemo(() => (myHero ? itemPlan(myHero, enemies) : null), [myHero, enemies]);
  const warnings = useMemo(() => (myHero ? matchupWarnings(myHero, enemies) : []), [myHero, enemies]);
  const lane = plan?.lane || me?.lane || bpLane || "jungle";

  /* 记住上次浏览的出装，便于从其他入口回到本页时恢复 */
  useEffect(() => {
    setLastItems({ hero: myHero, enemyPicks: enemies, lane: me?.lane || bpLane || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myHero, enemies]);

  const hot = useMemo(() => {
    const pool = HEROES.filter((h) => h.tier === "T0" || h.tier === "T0.5");
    const prefer = bpLane ? pool.filter((h) => h.lane === bpLane) : [];
    return [...prefer, ...pool.filter((h) => !prefer.includes(h))].slice(0, 8);
  }, [bpLane]);

  const handlePick = (name) => {
    if (picker === "enemy") {
      if (enemies.includes(name) || name === myHero) {
        showToast("这个英雄已经在阵容里了");
        return;
      }
      if (enemies.length >= MAX_ENEMY) {
        showToast("敌方阵容已满 5 个");
        return;
      }
      setEnemies((list) => [...list, name]);
    } else {
      if (enemies.includes(name)) {
        showToast("不能选一个已经在敌方阵容里的英雄");
        return;
      }
      setMyHero(name);
    }
    setPicker(null);
  };

  const removeEnemy = (name) => {
    setEnemies((list) => list.filter((n) => n !== name));
    showToast(`已移除敌方英雄：${name}`);
  };

  const clearEnemies = () => {
    if (!enemies.length) return;
    setEnemies([]);
    showToast("已清空敌方阵容");
  };

  const doShare = async () => {
    if (!myHero || !plan || sharing) return;
    setSharing(true);
    try {
      await shareImage({
        kind: "build",
        title: `${myHero} 针对出装`,
        subtitle: enemies.length ? `敌方：${enemies.join(" / ")}` : `通用出装 · 未录入敌方阵容 · ${laneLabel(lane)}`,
        heroNames: [myHero],
        lines: [
          { label: "分路", text: laneLabel(lane) },
          { label: "基础出装", text: plan.base.map((i) => i.name).join(" · ") || "暂无" },
          {
            label: "针对性装备",
            text: plan.counter.length
              ? plan.counter.map((c) => `${c.item.name}（${c.reason}）`).join("；")
              : "对面阵容没有明显针对性装备需求",
          },
          { label: "铭文推荐", text: plan.inscriptions.map((r) => r.combo).join("；") || "暂无" },
          { label: "实战提示", text: plan.notes.join("；") || "按常规出装即可" },
        ],
      });
      showToast("已生成分享图");
    } catch (e) {
      showToast("分享图生成失败，请重试");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="page it-page">
      <style>{CSS}</style>
      <PageHead
        eyebrow="ITEM COUNTER · S12"
        title="针对出装"
        sub={myHero ? `${myHero} · ${laneLabel(lane)} · ${enemies.length} 名敌人` : "敌方阵容 · 基础出装 · 铭文与提示"}
        actions={
          <>
            <button
              className="icon-btn"
              aria-label="分享出装图"
              disabled={!myHero || sharing}
              onClick={doShare}
            >
              <Icon name="share" />
            </button>
            <button
              className="icon-btn gold"
              aria-label="切换主题"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </>
        }
      />

      <div className="page-inner">
        {bp ? (
          <div className="card card-dark it-banner">
            <div className="it-banner-top">
              <span className="it-banner-ico">
                <Icon name="swords" />
              </span>
              <span className="grow">
                <b>来自 BP 助手的阵容</b>
                <p>已自动带入 {enemies.length} 个敌方英雄</p>
                {bpLane || bpPicked ? (
                  <p className="it-banner-meta">
                    {bpLane ? `BP 分路：${laneLabel(bpLane)}` : ""}
                    {bpLane && bpPicked ? " · " : ""}
                    {bpPicked ? `BP 推荐：${bpPicked}` : ""}
                  </p>
                ) : null}
              </span>
              <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate("bp")}>
                <Icon name="chevronLeft" />
                返回 BP
              </button>
            </div>
            {!myHero && bpPicked ? (
              <button
                type="button"
                className="btn btn-primary btn-sm btn-block it-banner-cta"
                onClick={() => setMyHero(bpPicked)}
              >
                <Icon name="user" />
                使用 BP 推荐英雄：{bpPicked}
              </button>
            ) : null}
          </div>
        ) : null}

        <section className="section">
          <SectionHead
            title="敌方阵容"
            sub={`${enemies.length}/5 · 点空槽录入`}
            onMore={enemies.length ? clearEnemies : undefined}
            moreLabel="清空"
            iconName="trash"
          />
          <SlotGrid names={enemies} onAdd={() => setPicker("enemy")} onRemove={removeEnemy} />
          {!enemies.length ? (
            <p className="tiny faint it-hint">建议至少录入 2 个敌方英雄，针对性装备与阵容提示会更准确。</p>
          ) : null}
        </section>

        <section className="section">
          <SectionHead title="我的英雄" sub={myHero ? "点卡片可换英雄" : "选英雄后生成针对性出装"} />
          {myHero ? (
            <div className="card it-me">
              <button type="button" className="it-me-main" onClick={() => setPicker("me")}>
                <HeroArt name={myHero} className="it-me-art" />
                <span className="it-me-body">
                  <span className="it-me-name">
                    <b>{myHero}</b>
                    <TierBadge tier={tierFor(me, me.lane)} />
                  </span>
                  <span className="it-me-tags">
                    <span className="pill">{laneLabel(me.lane)}</span>
                    {me.tags.slice(0, 3).map((t) => (
                      <span className="pill" key={t}>
                        {t}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="it-me-swap">
                  换人
                  <Icon name="chevronRight" />
                </span>
              </button>
            </div>
          ) : (
            <button type="button" className="it-me-empty" onClick={() => setPicker("me")}>
              <span className="ico">
                <Icon name="user" />
              </span>
              <b>选择我的英雄</b>
              <span className="sub">选了英雄才能生成针对性出装；也可以从英雄详情页「看出装」直接进入。</span>
            </button>
          )}
        </section>

        {myHero && plan ? (
          <>
            {warnings.length ? (
              <section className="section">
                <div className="it-warnbox">
                  <div className="it-warnbox-head">
                    <Icon name="x" />
                    <b>对线与团战压力</b>
                  </div>
                  {warnings.map((w) => (
                    <div className="it-warn" key={w.enemy}>
                      <span className="it-warn-body">
                        <b>被「{w.enemy}」克制</b>
                        <p>{w.reason}</p>
                      </span>
                      <span className="it-src">{w.source === "curated" ? "实战" : "推导"}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {!enemies.length ? (
              <section className="section">
                <div className="it-hintbar">
                  <Icon name="target" />
                  <span>还没录入敌方阵容：针对性装备与阵容提示不会出现，建议先补全对面英雄。</span>
                </div>
              </section>
            ) : null}

            <section className="section">
              <SectionHead title="基础出装" sub={`${laneLabel(lane)} · ${plan.base.length}/6 件`} />
              <div className="it-builds">
                {plan.base.map((item, i) => (
                  <div className="it-itemcard" key={item.name}>
                    <div className="it-item-top">
                      <span className={`it-ico ${KIND_CLASS[item.kind] || "util"}`}>{item.name.slice(0, 1)}</span>
                      <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <b className="nm">{item.name}</b>
                    <span className="kind">{item.kind}</span>
                    <span className="desc">{item.desc}</span>
                  </div>
                ))}
                {plan.base.length < 6 ? (
                  <div className="it-itemcard ghost">
                    <div className="it-item-top">
                      <span className="it-ico util">
                        <Icon name="plus" />
                      </span>
                      <span className="idx">0{plan.base.length + 1}</span>
                    </div>
                    <b className="nm">视局势补</b>
                    <span className="kind">弹性</span>
                    <span className="desc">最后一件按对面成型情况与局势调整</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="section">
              <SectionHead
                title="针对性装备"
                sub={plan.counter.length ? `${plan.counter.length} 件 · 针对敌方阵容` : "暂无硬性针对需求"}
              />
              {plan.counter.length ? (
                <div className="it-counters">
                  {plan.counter.map((c) => (
                    <div className="it-counter" key={c.item.name}>
                      <span className={`it-ico big ${KIND_CLASS[c.item.kind] || "util"}`}>
                        {c.item.name.slice(0, 1)}
                      </span>
                      <span className="grow">
                        <span className="it-counter-top">
                          <b>{c.item.name}</b>
                          <span className="pill">{c.item.kind}</span>
                        </span>
                        <span className="reason">{c.reason}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card it-safe">
                  <span className="it-safe-ico">
                    <Icon name="shield" />
                  </span>
                  <span className="grow">
                    <b>对面阵容没有明显针对性装备需求</b>
                    <p>按基础出装走即可，留意对面经济最高的点，中期再决定保命装次序。</p>
                  </span>
                </div>
              )}
            </section>

            <section className="section">
              <SectionHead title="铭文推荐" sub="按分路与敌方词条排序" />
              <div className="it-runes">
                {plan.inscriptions.map((r) => (
                  <div className="it-rune" key={r.name}>
                    <span className="mark">
                      <Icon name="book" />
                    </span>
                    <span className="grow">
                      <b>{r.name}</b>
                      <span className="combo">{r.combo}</span>
                      <span className="desc">{r.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <SectionHead title="实战提示" sub="对线与团战注意事项" />
              <div className="card it-notes">
                {plan.notes.map((n) => (
                  <div className="it-note" key={n}>
                    <span className="ico">
                      <Icon name="spark" />
                    </span>
                    <span>{n}</span>
                  </div>
                ))}
                {plan.insights.map((t) => (
                  <div className="it-note blue" key={t.title}>
                    <span className="ico">
                      <Icon name="target" />
                    </span>
                    <span>
                      <b>{t.title}</b>
                      {t.detail}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="section">
            <div className="card it-preview">
              <span className="it-preview-ico">
                <Icon name="shield" />
              </span>
              <b>选好英雄，直接生成出装</b>
              <p>基础六件、针对性装备、铭文与实战提示都会按敌方阵容自动计算，还能一键生成分享图。</p>
              <div className="it-quick">
                {hot.map((h) => (
                  <button
                    key={h.name}
                    type="button"
                    className="it-quick-btn"
                    onClick={() => setMyHero(h.name)}
                  >
                    <Avatar name={h.name} size={40} />
                    <span>{h.name}</span>
                  </button>
                ))}
              </div>
              {!enemies.length ? <p className="it-preview-tip">也可以先录入敌方阵容，再回来选英雄。</p> : null}
            </div>
          </section>
        )}

        <div className="it-actions">
          <button
            type="button"
            className="btn btn-primary btn-block it-cta"
            disabled={!myHero || sharing}
            onClick={doShare}
          >
            <Icon name="share" />
            {sharing ? "正在生成分享图…" : "分享出装图"}
          </button>
          <p className="it-actions-note">
            {myHero
              ? `${myHero} · ${laneLabel(lane)}${enemies.length ? ` · 针对 ${enemies.length} 名敌人` : ""}`
              : "先选择我的英雄，再生成分享图"}
          </p>
        </div>
      </div>

      {picker ? (
        <HeroPicker
          title={picker === "me" ? "选择我的英雄" : "录入敌方英雄"}
          subtitle={
            picker === "me"
              ? "选择你要玩的英雄，按敌方阵容生成出装"
              : `还可以录入 ${MAX_ENEMY - enemies.length} 个`
          }
          exclude={picker === "me" ? enemies : [...enemies, myHero].filter(Boolean)}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function SlotGrid({ names, onAdd, onRemove }) {
  return (
    <div className="it-slots">
      {Array.from({ length: MAX_ENEMY }).map((_, i) => {
        const name = names[i];
        if (!name) {
          return (
            <button key={`empty-${i}`} type="button" className="it-slot empty" onClick={onAdd} aria-label="添加敌方英雄">
              <span className="it-slot-plus">
                <Icon name="plus" />
              </span>
              <span className="it-slot-name faint">空位</span>
            </button>
          );
        }
        return (
          <button
            key={name}
            type="button"
            className="it-slot filled"
            onClick={() => onRemove(name)}
            aria-label={`移除 ${name}`}
          >
            <span className="it-slot-ava">
              <Avatar name={name} size={48} />
              <span className="it-slot-x">
                <Icon name="x" />
              </span>
            </span>
            <span className="it-slot-name">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- page style */
const CSS = `
.it-page .section{margin-top:20px;}
.it-page .grow{flex:1;min-width:0;}

.it-page .it-banner{display:flex;flex-direction:column;gap:11px;padding:13px;margin-top:14px;border-radius:var(--radius-lg);}
.it-page .it-banner-top{display:flex;align-items:flex-start;gap:10px;}
.it-page .it-banner-ico{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);flex-shrink:0;}
.it-page .it-banner-ico svg{width:16px;height:16px;}
.it-page .it-banner b{display:block;font-family:var(--serif);font-size:.94rem;font-weight:900;letter-spacing:.02em;}
.it-page .it-banner p{margin-top:3px;font-size:.63rem;line-height:1.55;color:var(--muted);}
.it-page .it-banner .it-banner-meta{color:var(--gold-2);}
.it-page .it-banner .btn{flex-shrink:0;margin-top:1px;}
.it-page .it-banner-cta{width:100%;justify-content:center;}

.it-page .it-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.it-page .it-slot{display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px 2px 9px;border-radius:14px;border:1px dashed var(--line);background:color-mix(in srgb,var(--surface) 42%,transparent);min-width:0;transition:transform .12s ease;}
.it-page .it-slot:active{transform:scale(.96);}
.it-page .it-slot.filled{border-style:solid;background:var(--surface);box-shadow:var(--shadow-sm);}
.it-page .it-slot-ava{position:relative;width:56px;height:56px;border-radius:50%;padding:2px;border:1.5px solid var(--line);background:var(--surface-2);display:block;}
.it-page .it-slot-ava .avatar{display:block;}
.it-page .it-slot.filled .it-slot-ava{border-color:color-mix(in srgb,var(--red) 38%,transparent);box-shadow:0 0 0 3px var(--red-soft);}
.it-page .it-slot-x{position:absolute;top:-4px;right:-4px;width:17px;height:17px;border-radius:50%;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;color:var(--faint);z-index:1;}
.it-page .it-slot-x svg{width:9px;height:9px;}
.it-page .it-slot-name{max-width:100%;padding:0 2px;font-size:.57rem;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.it-page .it-slot.empty .it-slot-name{color:var(--faint);}
.it-page .it-slot-plus{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:var(--faint);background:color-mix(in srgb,var(--surface) 55%,transparent);border:1px solid var(--line);}
.it-page .it-slot-plus svg{width:17px;height:17px;}
.it-page .it-hint{margin-top:9px;line-height:1.55;}

.it-page .it-me{padding:12px;border-radius:var(--radius-lg);}
.it-page .it-me-main{display:flex;align-items:center;gap:12px;width:100%;text-align:left;}
.it-page .it-me-art{width:76px;height:76px;border-radius:14px;object-fit:cover;object-position:50% 18%;flex-shrink:0;background:var(--surface-2);}
.it-page .hero-fallback.it-me-art{width:76px;height:76px;font-size:1.3rem;display:grid;place-items:center;}
.it-page .it-me-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.it-page .it-me-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.it-page .it-me-name b{font-family:var(--serif);font-size:1.28rem;font-weight:900;letter-spacing:.03em;line-height:1.15;}
.it-page .it-me-tags{display:flex;gap:4px;flex-wrap:wrap;}
.it-page .it-me-tags .pill{font-size:.56rem;padding:3px 7px;}
.it-page .it-me-swap{display:flex;align-items:center;gap:2px;color:var(--muted);font-size:.62rem;flex-shrink:0;}
.it-page .it-me-swap svg{width:13px;height:13px;}

.it-page .it-me-empty{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;padding:20px 16px;border-radius:var(--radius-lg);border:1px dashed var(--gold-line);background:var(--gold-soft);text-align:center;}
.it-page .it-me-empty .ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--surface);color:var(--gold);border:1px solid var(--gold-line);margin-bottom:5px;}
.it-page .it-me-empty .ico svg{width:18px;height:18px;}
.it-page .it-me-empty b{font-family:var(--serif);font-size:1rem;letter-spacing:.02em;}
.it-page .it-me-empty .sub{max-width:285px;margin-top:2px;font-size:.63rem;line-height:1.6;color:var(--muted);}

.it-page .it-preview{display:flex;flex-direction:column;align-items:center;gap:5px;padding:20px 16px;text-align:center;}
.it-page .it-preview-ico{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold-line);margin-bottom:4px;}
.it-page .it-preview-ico svg{width:20px;height:20px;}
.it-page .it-preview b{font-family:var(--serif);font-size:1rem;letter-spacing:.02em;}
.it-page .it-preview p{max-width:300px;margin-top:4px;font-size:.66rem;line-height:1.65;color:var(--muted);}
.it-page .it-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 4px;width:100%;margin-top:14px;}
.it-page .it-quick-btn{display:flex;flex-direction:column;align-items:center;gap:5px;padding:2px;border-radius:12px;min-width:0;}
.it-page .it-quick-btn span{max-width:100%;font-size:.57rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.it-page .it-preview-tip{margin-top:10px;font-size:.58rem;color:var(--faint);}

.it-page .it-warnbox{padding:12px;border-radius:var(--radius-lg);background:var(--red-soft);border:1px solid color-mix(in srgb,var(--red) 26%,transparent);}
.it-page .it-warnbox-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--red);}
.it-page .it-warnbox-head svg{width:14px;height:14px;}
.it-page .it-warnbox-head b{font-size:.74rem;font-weight:800;letter-spacing:.02em;}
.it-page .it-warn{display:flex;align-items:flex-start;gap:8px;padding:7px 0;}
.it-page .it-warn + .it-warn{border-top:1px dashed color-mix(in srgb,var(--red) 22%,transparent);}
.it-page .it-warn-body{flex:1;min-width:0;}
.it-page .it-warn-body b{display:block;font-size:.72rem;color:var(--red);}
.it-page .it-warn-body p{margin-top:2px;font-size:.65rem;line-height:1.55;color:var(--ink-2);}
.it-page .it-src{flex-shrink:0;font-size:.5rem;color:var(--faint);border:1px solid var(--line);border-radius:4px;padding:1px 5px;background:var(--surface);}

.it-page .it-hintbar{display:flex;gap:9px;align-items:flex-start;padding:11px 12px;border-radius:var(--radius-md);background:var(--gold-soft);border:1px solid var(--gold-line);}
.it-page .it-hintbar svg{width:15px;height:15px;color:var(--gold);flex-shrink:0;margin-top:1px;}
.it-page .it-hintbar span{font-size:.65rem;line-height:1.6;color:var(--muted);}

.it-page .it-builds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.it-page .it-itemcard{display:flex;flex-direction:column;gap:5px;padding:10px;border-radius:14px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);min-width:0;}
.it-page .it-item-top{display:flex;align-items:center;justify-content:space-between;gap:4px;}
.it-page .it-ico{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-family:var(--serif);font-weight:900;font-size:.82rem;border:1px solid var(--line);flex-shrink:0;background:var(--surface-2);color:var(--ink-2);}
.it-page .it-ico.phys{color:var(--red);background:var(--red-soft);border-color:color-mix(in srgb,var(--red) 22%,transparent);}
.it-page .it-ico.magic{color:var(--blue);background:var(--blue-soft);border-color:color-mix(in srgb,var(--blue) 22%,transparent);}
.it-page .it-ico.boots{color:var(--green);background:var(--green-soft);border-color:color-mix(in srgb,var(--green) 22%,transparent);}
.it-page .it-ico.def{color:var(--teal);background:var(--teal-soft);border-color:color-mix(in srgb,var(--teal) 22%,transparent);}
.it-page .it-ico.util{color:var(--gold);background:var(--gold-soft);border-color:var(--gold-line);}
.it-page .it-ico svg{width:14px;height:14px;}
.it-page .it-itemcard .idx{font-family:var(--mono);font-size:.54rem;color:var(--faint);letter-spacing:.06em;}
.it-page .it-itemcard .nm{font-size:.75rem;font-weight:800;letter-spacing:.02em;line-height:1.25;}
.it-page .it-itemcard .kind{font-family:var(--mono);font-size:.48rem;letter-spacing:.14em;color:var(--gold);}
.it-page .it-itemcard .desc{font-size:.55rem;line-height:1.5;color:var(--faint);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em;}
.it-page .it-itemcard.ghost{border-style:dashed;box-shadow:none;background:transparent;}
.it-page .it-itemcard.ghost .nm{color:var(--muted);}

.it-page .it-counters{display:flex;flex-direction:column;gap:7px;}
.it-page .it-counter{display:flex;gap:11px;padding:11px 12px;border-radius:14px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);}
.it-page .it-ico.big{width:38px;height:38px;border-radius:11px;font-size:1.05rem;}
.it-page .it-counter-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.it-page .it-counter-top b{font-family:var(--serif);font-size:.9rem;letter-spacing:.02em;}
.it-page .it-counter .reason{display:block;margin-top:4px;font-size:.65rem;line-height:1.6;color:var(--muted);}

.it-page .it-safe{display:flex;gap:11px;padding:14px;align-items:flex-start;}
.it-page .it-safe-ico{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold-line);flex-shrink:0;}
.it-page .it-safe-ico svg{width:16px;height:16px;}
.it-page .it-safe b{font-family:var(--serif);font-size:.88rem;letter-spacing:.02em;}
.it-page .it-safe p{margin-top:4px;font-size:.65rem;line-height:1.6;color:var(--muted);}

.it-page .it-runes{display:flex;flex-direction:column;gap:7px;}
.it-page .it-rune{display:flex;gap:11px;padding:11px 12px;border-radius:14px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);}
.it-page .it-rune .mark{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);flex-shrink:0;border:1px solid var(--gold-line);}
.it-page .it-rune .mark svg{width:14px;height:14px;}
.it-page .it-rune b{display:block;font-family:var(--serif);font-size:.86rem;letter-spacing:.02em;}
.it-page .it-rune .combo{display:block;margin-top:3px;font-family:var(--mono);font-size:.56rem;line-height:1.5;color:var(--gold-2);}
.it-page .it-rune .desc{display:block;margin-top:3px;font-size:.63rem;line-height:1.55;color:var(--muted);}

.it-page .it-notes{padding:4px;}
.it-page .it-note{display:flex;gap:9px;align-items:flex-start;padding:10px 11px;}
.it-page .it-note + .it-note{border-top:1px solid var(--line-2);}
.it-page .it-note .ico{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);flex-shrink:0;}
.it-page .it-note .ico svg{width:12px;height:12px;}
.it-page .it-note > span:last-child{font-size:.67rem;line-height:1.6;color:var(--ink-2);min-width:0;}
.it-page .it-note b{display:block;margin-bottom:2px;font-size:.71rem;color:var(--ink);}
.it-page .it-note.blue .ico{background:var(--blue-soft);color:var(--blue);}
.it-page .it-note.blue > span:last-child{color:var(--muted);}

.it-page .it-actions{position:sticky;bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px));z-index:8;margin:24px 0 -30px;padding:16px 0 8px;background:linear-gradient(to top,var(--bg) 0,var(--bg) 91%,color-mix(in srgb,var(--bg) 94%,transparent) 96%,transparent 100%);}
.it-page .it-cta{height:48px;border-radius:15px;font-size:.82rem;}
.it-page .it-cta svg{width:16px;height:16px;}
.it-page .it-actions-note{margin-top:8px;text-align:center;font-size:.58rem;color:var(--faint);line-height:1.5;}
.it-page .btn:disabled{opacity:.42;box-shadow:none;pointer-events:none;}
.it-page .icon-btn:disabled{opacity:.42;pointer-events:none;}
`;
