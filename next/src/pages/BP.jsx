import { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  FavButton,
  HeroArt,
  PageHead,
  SectionHead,
  TierBadge,
} from "../components/common.jsx";
import HeroPicker from "../components/HeroPicker.jsx";
import HeroSheet from "../components/HeroSheet.jsx";
import { Icon } from "../components/icons.jsx";
import { LANES, hasHero, hero, laneLabel, tierFor } from "../lib/data.js";
import { banRecommendations, lineupInsights, parseHeroNames, pickRecommendations } from "../lib/engine.js";
import { matchVoiceResults } from "../lib/heroVoice.js";
import { useApp } from "../lib/store.js";
import { startVoice, voiceSupported } from "../lib/voice.js";

const MAX = 5;

const cleanNames = (list) =>
  Array.isArray(list)
    ? list.filter((n) => typeof n === "string" && hasHero(n)).slice(0, MAX)
    : [];

export default function BP() {
  const {
    navigate,
    showToast,
    pushRecent,
    lastBp,
    setLastBp,
    theme,
    setTheme,
  } = useApp();

  const pageRef = useRef(null);
  const [phase, setPhase] = useState(() => (cleanNames(lastBp?.enemyPicks).length ? "pick" : "ban"));
  const [bans, setBans] = useState(() => cleanNames(lastBp?.bans));
  const [picks, setPicks] = useState(() => cleanNames(lastBp?.enemyPicks));
  const [lane, setLane] = useState(() => (LANES.some((l) => l.lane === lastBp?.lane) ? lastBp.lane : "jungle"));
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState("");
  const [picker, setPicker] = useState(null);
  const [sheet, setSheet] = useState("");
  const [voiceState, setVoiceState] = useState("idle");
  const [voiceHint, setVoiceHint] = useState("");
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const voiceRef = useRef(null);

  /* 切换阶段回到顶部 */
  useEffect(() => {
    const el = pageRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  /* 离开页面时释放麦克风 */
  useEffect(() => {
    return () => {
      voiceRef.current?.cancel?.();
      voiceRef.current = null;
    };
  }, []);

  const recBans = useMemo(() => banRecommendations(bans, 12), [bans]);
  const combos = useMemo(() => recBans.filter((r) => r.fromBans.length >= 2), [recBans]);
  const others = useMemo(() => recBans.filter((r) => r.fromBans.length < 2), [recBans]);
  const recs = useMemo(() => (phase === "pick" ? pickRecommendations(picks, lane, 4) : []), [phase, picks, lane]);
  const insights = useMemo(() => (phase === "pick" ? lineupInsights(picks) : []), [phase, picks]);
  const selectedRow = useMemo(() => recs.find((r) => r.hero.name === selected) || null, [recs, selected]);

  const openSheet = (name) => {
    pushRecent("hero", name);
    setSheet(name);
  };

  const openPicker = (which) => {
    if (which === "ban" && bans.length >= MAX) {
      showToast("Ban 位已满 5 个，先移除一个");
      return;
    }
    if (which === "pick" && picks.length >= MAX) {
      showToast("敌方已选已满 5 个，先移除一个");
      return;
    }
    setPicker(which);
  };

  const addBan = (name) => {
    if (picks.includes(name)) {
      showToast(`${name} 已在敌方已选中，不能重复 Ban`);
      return;
    }
    setBans((list) => (list.includes(name) || list.length >= MAX ? list : [...list, name]));
  };

  const addPick = (name) => {
    if (bans.includes(name)) {
      showToast(`${name} 已被记录在 Ban 位，不能再选`);
      return;
    }
    setPicks((list) => (list.includes(name) || list.length >= MAX ? list : [...list, name]));
  };

  const removeBan = (name) => {
    setBans((list) => list.filter((n) => n !== name));
    showToast(`已移除 Ban 位：${name}`);
  };

  const removePick = (name) => {
    setPicks((list) => list.filter((n) => n !== name));
    if (selected === name) setSelected("");
    showToast(`已移除敌方已选：${name}`);
  };

  const doIdentify = () => {
    const raw = text.trim();
    if (!raw) {
      showToast("先输入或粘贴英雄名再识别");
      return;
    }
    const parsed = parseHeroNames(raw, MAX);
    const target = phase === "ban" ? bans : picks;
    const other = phase === "ban" ? picks : bans;
    const fresh = parsed.found.filter((n) => !target.includes(n) && !other.includes(n));
    const room = MAX - target.length;
    setUnknown(parsed.rest ? parsed.rest.slice(0, 18) : "");
    if (!fresh.length) {
      showToast(parsed.found.length ? "识别到的英雄已经在列表里了" : "没识别到英雄名，试试连打「马超吕布」");
      return;
    }
    if (room <= 0) {
      showToast((phase === "ban" ? "Ban 位" : "敌方已选") + "已满 5 个，先移除一个再填");
      return;
    }
    const add = fresh.slice(0, room);
    if (phase === "ban") setBans((list) => [...list, ...add]);
    else setPicks((list) => [...list, ...add]);
    setText("");
    showToast(fresh.length > room ? `${phase === "ban" ? "Ban 位" : "敌方已选"}已满，只填入 ${add.length} 个` : `已记录 ${add.length} 个${phase === "ban" ? " Ban" : "敌方已选"}`);
  };

  const fillNames = (names, action = phase, laneHint = "") => {
    const finalAction = action === "pick" ? "pick" : "ban";
    const target = finalAction === "ban" ? bans : picks;
    const other = finalAction === "ban" ? picks : bans;
    const unique = [...new Set(names)].filter((name) => typeof name === "string" && hasHero(name));
    const fresh = unique.filter((name) => !target.includes(name) && !other.includes(name));
    if (!fresh.length) {
      showToast(`识别到的英雄已经在${finalAction === "ban" ? " Ban 位" : "敌方已选"}里了`);
      return;
    }
    const room = MAX - target.length;
    if (room <= 0) {
      showToast(`${finalAction === "ban" ? "Ban 位" : "敌方已选"}已满 5 个，先移除一个再填`);
      return;
    }
    const add = fresh.slice(0, room);
    if (finalAction !== phase) setPhase(finalAction);
    if (laneHint) setLane(laneHint);
    if (finalAction === "ban") setBans([...target, ...add]);
    else setPicks([...target, ...add]);
    setText("");
    setUnknown("");
    setVoiceResult(null);
    setVoiceState("idle");
    showToast(`已填入 ${add.length} 个${finalAction === "ban" ? " Ban" : "敌方已选"}${finalAction !== phase ? `，已切到${finalAction === "ban" ? "禁用" : "选将"}阶段` : ""}`);
  };

  const handleVoiceFinal = (results) => {
    const result = matchVoiceResults(results, phase);
    setVoiceHint("");
    if (!result.candidates.length) {
      setVoiceState("idle");
      if (result.raw) {
        setText(result.raw);
        showToast("没听清英雄名，原话已填进输入框，可手动改");
      } else {
        showToast("没听清，再说一次");
      }
      return;
    }
    const strong = result.candidates.filter((c) => c.score >= 0.85);
    const weak = result.candidates.filter((c) => c.score < 0.85);
    const mixed = result.action === "mixed";
    if (!mixed && strong.length > 0 && strong.length <= 3 && weak.length === 0) {
      fillNames(strong.map((c) => c.name), result.action, result.lane);
      return;
    }
    const fillAction = mixed ? phase : result.action === "pick" ? "pick" : "ban";
    setVoiceResult({
      ...result,
      action: fillAction,
      mixed,
      selected: result.candidates.slice(0, Math.min(3, result.candidates.length)).map((c) => c.name),
    });
    setVoiceState("idle");
  };

  const beginVoice = () => {
    if (voiceRef.current) return;
    if (!voiceSupported()) {
      showToast("当前环境不支持语音输入，请用键盘输入");
      return;
    }
    setVoiceResult(null);
    setVoiceHint("");
    setVoiceLevel(0);
    setVoiceState("requesting");
    const session = startVoice({
      onReady: () => setVoiceState("listening"),
      onStart: () => setVoiceState("listening"),
      onPartial: (results) => {
        const raw = results?.[0]?.text || "";
        if (raw) setVoiceHint(raw);
        setVoiceState("listening");
      },
      onFinal: (results) => {
        voiceRef.current = null;
        setVoiceState("processing");
        handleVoiceFinal(results);
      },
      onError: (err) => {
        voiceRef.current = null;
        setVoiceState("idle");
        setVoiceHint("");
        if (err?.code !== "cancelled") showToast(err?.message || "语音识别失败");
      },
      onRms: (level) => setVoiceLevel(Number(level) || 0),
    });
    voiceRef.current = session;
    if (!session) setVoiceState("idle");
  };

  const stopVoice = () => {
    if (!voiceRef.current) return;
    voiceRef.current.stop();
    setVoiceState("processing");
  };

  const cancelVoice = () => {
    voiceRef.current?.cancel?.();
    voiceRef.current = null;
    setVoiceState("idle");
    setVoiceHint("");
    setVoiceResult(null);
  };

  const toggleVoiceCandidate = (name) => {
    setVoiceResult((result) => {
      if (!result) return result;
      const selected = result.selected.includes(name)
        ? result.selected.filter((n) => n !== name)
        : [...result.selected, name];
      return { ...result, selected };
    });
  };

  const applyVoiceResult = () => {
    if (!voiceResult) return;
    fillNames(voiceResult.selected, voiceResult.action, voiceResult.lane);
  };

  const reset = () => {
    setBans([]);
    setPicks([]);
    setSelected("");
    setText("");
    setUnknown("");
    setPicker(null);
    setSheet("");
    setPhase("ban");
    setLastBp(null);
    showToast("已重置本次 BP");
  };

  const toItems = () => {
    if (picks.length < 2) {
      showToast("先在敌方已选里记录至少 2 个英雄");
      return;
    }
    setLastBp({
      bans,
      enemyPicks: picks,
      lane,
      picks: selectedRow ? [selectedRow.hero.name] : recs[0] ? [recs[0].hero.name] : [],
    });
    navigate("items", { from: "bp" });
  };

  const banPickerOpen = picker === "ban";

  const batchBlock = (
    <>
      <form
        className="bp-batch"
        onSubmit={(e) => {
          e.preventDefault();
          doIdentify();
        }}
      >
        <span className="bp-input">
          <Icon name="search" className="ic" />
          <input
            value={text}
            maxLength={64}
            onChange={(e) => {
              setText(e.target.value);
              if (unknown) setUnknown("");
            }}
            placeholder="连打英雄名，如：马超吕布"
            aria-label="批量输入英雄名"
          />
          {text ? (
            <button type="button" className="bp-clear" aria-label="清空输入" onClick={() => setText("")}>
              <Icon name="x" />
            </button>
          ) : null}
        </span>
        <button
          type="button"
          className={`bp-mic ${voiceState === "listening" ? "on" : ""}`}
          aria-label="按住说话"
          title="按住说话"
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              /* ignore */
            }
            beginVoice();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            stopVoice();
          }}
          onPointerCancel={cancelVoice}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Icon name="mic" />
        </button>
        <button type="submit" className="btn btn-dark btn-sm bp-fill">
          <Icon name="spark" />
          识别填入
        </button>
      </form>
      {unknown ? (
        <p className="tiny faint bp-unknown">
          超出 5 个的部分未填入：{unknown}（一次最多记录 5 个{phase === "ban" ? " Ban" : "敌方已选"}）
        </p>
      ) : null}
      <p className="tiny faint bp-voice-help">按住麦克风说：「对面 ban 东皇太一」或「选马可波罗」</p>
    </>
  );

  const voiceStatus =
    voiceState !== "idle" ? (
      <div className={`bp-voice ${voiceState}`} role="status" aria-live="polite">
        <span className="bp-voice-dot" />
        <div className="bp-voice-copy">
          <b>
            {voiceState === "requesting"
              ? "等待麦克风权限…"
              : voiceState === "processing"
                ? "正在解析…"
                : "正在听… 松手结束"}
          </b>
          <span>{voiceHint || (voiceState === "requesting" ? "请在系统弹窗允许麦克风" : "说：对面 ban 东皇太一")}</span>
        </div>
        <span className="bp-voice-bars" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ opacity: voiceLevel ? 0.35 + Math.min(0.65, voiceLevel / 10) : 0.5 }} />
          ))}
        </span>
      </div>
    ) : null;

  const voicePanel = voiceResult?.candidates?.length ? (
    <div className="card bp-voice-result">
      <div className="bp-voice-result-head">
        <span className="tiny faint">听到「{voiceResult.raw || "…"}」</span>
        <button type="button" className="bp-clear" aria-label="收起语音结果" onClick={() => setVoiceResult(null)}>
          <Icon name="x" />
        </button>
      </div>
      <div className="bp-voice-chips">
        {voiceResult.candidates.map((candidate) => {
          const on = voiceResult.selected.includes(candidate.name);
          return (
            <button
              type="button"
              key={candidate.name}
              className={`bp-voice-chip ${on ? "on" : ""}`}
              onClick={() => toggleVoiceCandidate(candidate.name)}
            >
              <span>{candidate.name}</span>
              <em>{Math.round(candidate.score * 100)}%</em>
            </button>
          );
        })}
      </div>
      <div className="bp-voice-result-actions">
        {voiceResult.mixed ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!voiceResult.selected.length}
              onClick={() => fillNames(voiceResult.selected, "ban", voiceResult.lane)}
            >
              填入 Ban 位
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!voiceResult.selected.length}
              onClick={() => fillNames(voiceResult.selected, "pick", voiceResult.lane)}
            >
              填入敌方已选
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!voiceResult.selected.length}
            onClick={applyVoiceResult}
          >
            填入 {voiceResult.action === "pick" ? "敌方已选" : "Ban 位"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setVoiceResult(null);
            beginVoice();
          }}
        >
          重说
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="page bp-page" ref={pageRef}>
      <style>{CSS}</style>
      <PageHead
        eyebrow="LIVE DRAFT · S12"
        title="BP 助手"
        sub={phase === "ban" ? "记录敌方 Ban 位，推测他们想拿谁" : "录入敌方已选，按分路找反制英雄"}
        actions={
          <>
            <button
              className="icon-btn gold"
              aria-label="切换主题"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button className="btn btn-ghost btn-sm bp-reset" onClick={reset}>
              <Icon name="refresh" />
              重置
            </button>
          </>
        }
      />

      <div className="page-inner">
        {/* 两阶段 stepper */}
        <div className="card bp-stepper">
          <button
            type="button"
            className={`bp-step ${phase === "ban" ? "on" : "done"}`}
            onClick={() => setPhase("ban")}
          >
            <span className="idx">01</span>
            <span className="tt">
              <b>禁用 BAN</b>
              <em>ENEMY BANS</em>
            </span>
            <span className="cnt">{bans.length}/5</span>
          </button>
          <button
            type="button"
            className={`bp-step ${phase === "pick" ? "on" : ""}`}
            onClick={() => setPhase("pick")}
          >
            <span className="idx">02</span>
            <span className="tt">
              <b>选将 PICK</b>
              <em>COUNTER PICK</em>
            </span>
            <span className="cnt">{picks.length}/5</span>
          </button>
        </div>

        <div className="bp-meta">
          <span className="pill red">已 Ban {bans.length}/5</span>
          <span className="pill gold">敌方已选 {picks.length}/5</span>
          <span className="pill blue">推测 {recBans.length} 条</span>
        </div>

        {voiceStatus}
        {voicePanel}

        {phase === "ban" ? (
          <>
            <section className="section">
              <SectionHead title="敌方 Ban 位" sub="点空槽添加 · 点头像移除" />
              <SlotGrid names={bans} tone="ban" onAdd={() => openPicker("ban")} onRemove={removeBan} />
              {batchBlock}
            </section>

            <section className="section">
              <SectionHead title="推荐禁用" sub="对面可能想玩 · 由 Ban 位推测" />
              {!bans.length ? (
                <div className="card bp-empty">
                  <span className="bp-empty-ico">
                    <Icon name="target" />
                  </span>
                  <b>还看不出对面的意图</b>
                  <p>记录对面 1–5 个 Ban 位后，这里会推测他们可能想拿的英雄。连打输入或点上方空槽都能录入。</p>
                  <div className="bp-empty-row">
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => openPicker("ban")}>
                      <Icon name="plus" />
                      手动选一个
                    </button>
                  </div>
                </div>
              ) : !recBans.length ? (
                <div className="card bp-empty">
                  <span className="bp-empty-ico">
                    <Icon name="spark" />
                  </span>
                  <b>这几位 Ban 位没有明确的指向</b>
                  <p>对面 Ban 的英雄不一定有清晰的克制链，可以按版本梯度自己判断。</p>
                  <div className="bp-empty-row">
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate("strength")}>
                      <Icon name="crown" />
                      查看梯度榜
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {combos.length ? (
                    <>
                      <div className="sub-head gold">
                        <span className="tag">综合推测 · 至少 2 个 BAN 指向</span>
                        <span className="line" />
                      </div>
                      <div className="bp-combos">
                        {combos.map((r) => {
                          const h = hero(r.name);
                          return (
                            <button
                              type="button"
                              className="card card-dark bp-combo"
                              key={r.name}
                              onClick={() => openSheet(r.name)}
                            >
                              <Avatar name={r.name} size={54} ring />
                              <span className="grow">
                                <span className="bp-combo-top">
                                  <b>{r.name}</b>
                                  <TierBadge tier={h.tier} />
                                  <span className="pill gold">综合推测</span>
                                </span>
                                <span className="bp-combo-bans">
                                  <span className="tiny muted">对面 Ban 了</span>
                                  {r.fromBans.map((b) => (
                                    <span className="pill red" key={b}>
                                      {b}
                                    </span>
                                  ))}
                                </span>
                                <span className="bp-combo-why">这些 Ban 在为它清掉天敌 → 他们大概率想拿，优先抢或禁掉。</span>
                              </span>
                              <span className="chev">
                                详情
                                <Icon name="chevronRight" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}

                  {others.length ? (
                    <>
                      <div className="sub-head">
                        <span className="tag">其他可能想玩</span>
                        <span className="line" />
                      </div>
                      <div className="bp-rugs">
                        {others.map((r) => (
                          <button
                            type="button"
                            className="bp-rug"
                            key={r.name}
                            onClick={() => openSheet(r.name)}
                          >
                            <Avatar name={r.name} size={34} />
                            <span className="grow">
                              <span className="nm">{r.name}</span>
                              <span className="why">Ban「{r.fromBans[0]}」后可能想玩</span>
                            </span>
                            <span className="tier">{laneLabel(hero(r.name).lane)}</span>
                            <Icon name="chevronRight" className="bp-rug-chev" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                  <p className="tiny faint bp-foot-note">
                    推测逻辑：对面 Ban 掉某英雄 → 说明他们怕被这类英雄针对 → 大概率会拿该英雄能克制的角色。仅供参考。
                  </p>
                </>
              )}
            </section>

            <div className="bp-actions">
              <button type="button" className="btn btn-primary btn-block bp-cta" onClick={() => setPhase("pick")}>
                <Icon name="check" />
                禁用完毕，进入选将
                <Icon name="arrowRight" />
              </button>
              <p className="bp-actions-note">不记 Ban 也可以直接进入选将阶段</p>
            </div>
          </>
        ) : (
          <>
            <section className="section">
              <SectionHead title="敌方已选" sub="按对面实际阵容依次录入" />
              <SlotGrid names={picks} tone="pick" onAdd={() => openPicker("pick")} onRemove={removePick} />
              {bans.length ? (
                <div className="bp-banline">
                  <span className="tiny faint">已 Ban：</span>
                  {bans.map((b) => (
                    <span className="pill red" key={b}>
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
              {batchBlock}
            </section>

            {insights.length ? (
              <section className="section">
                <SectionHead title="阵容洞察" sub="根据敌方已选自动分析" />
                <div className="bp-tips">
                  {insights.map((t) => (
                    <div className="bp-tip" key={t.title}>
                      <span className="bp-tip-ico">
                        <Icon name="target" />
                      </span>
                      <span className="bp-tip-body">
                        <b>{t.title}</b>
                        <p>{t.detail}</p>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="section">
              <SectionHead title="我的分路" sub="按你要玩的位置给反制建议" />
              <div className="seg-wrap">
                <div className="seg">
                  {LANES.map((l) => (
                    <button key={l.lane} className={lane === l.lane ? "on" : ""} onClick={() => setLane(l.lane)}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="section">
              <SectionHead
                title="反制推荐"
                sub={picks.length ? `${laneLabel(lane)} · 命中 ${recs.length} 个` : "先录入敌方英雄"}
              />
              {!picks.length ? (
                <div className="card bp-empty">
                  <span className="bp-empty-ico">
                    <Icon name="swords" />
                  </span>
                  <b>先录入敌方已选英雄</b>
                  <p>点上方空槽依次选择对面已确定的英雄，我们会按你选的分路给出克制推荐。</p>
                  <div className="bp-empty-row">
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => openPicker("pick")}>
                      <Icon name="plus" />
                      添加敌方英雄
                    </button>
                  </div>
                </div>
              ) : !recs.length ? (
                <div className="card bp-empty">
                  <span className="bp-empty-ico">
                    <Icon name="target" />
                  </span>
                  <b>这个分路暂时没有高把握的反制位</b>
                  <p>可以换一个分路看看，或者去梯度榜按版本强度挑人。敌方已选越多，推荐越准。</p>
                  <div className="bp-empty-row">
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      onClick={() => navigate("strength", { lane })}
                    >
                      <Icon name="crown" />
                      查看{laneLabel(lane)}梯度
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bp-recs">
                  {recs.map((row, i) => {
                    const h = row.hero;
                    const on = selected === h.name;
                    const tier = tierFor(h, lane);
                    return (
                      <article className={`bp-rec ${on ? "on" : ""}`} key={h.name}>
                        <button type="button" className="bp-rec-main" onClick={() => openSheet(h.name)}>
                          <HeroArt name={h.name} className="bp-rec-art" />
                          <span className="bp-rec-body">
                            <span className="bp-rec-name">
                              <b>{h.name}</b>
                              <TierBadge tier={tier} />
                              {i === 0 && !selected ? <span className="pill gold">首位</span> : null}
                              {on ? <span className="pill green">已选</span> : null}
                            </span>
                            <span className="bp-hits">
                              {row.hits.slice(0, 2).map((hit) => (
                                <span className="bp-hit" key={hit.enemy}>
                                  <Icon name="check" className="ic" />
                                  <span className="txt">
                                    <b>克制「{hit.enemy}」</b> · {hit.reason}
                                  </span>
                                </span>
                              ))}
                              {row.hits.length > 2 ? (
                                <span className="bp-hit more">另有 {row.hits.length - 2} 个可压制目标</span>
                              ) : null}
                            </span>
                            {row.warnings.length ? (
                              <span className="bp-warn">
                                <Icon name="x" className="ic" />
                                <span className="txt">
                                  <b>被「{row.warnings[0].enemy}」反制</b> · {row.warnings[0].reason}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <div className="bp-rec-foot">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet(h.name)}>
                            <Icon name="search" />
                            详情
                          </button>
                          <FavButton name={h.name} plain />
                          <button
                            type="button"
                            className={`btn btn-sm bp-select ${on ? "btn-dark" : "btn-primary"}`}
                            onClick={() => setSelected(on ? "" : h.name)}
                          >
                            <Icon name={on ? "check" : "plus"} />
                            {on ? "已选为推荐" : "选它"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="bp-actions">
              {selectedRow ? (
                <div className="bp-picked">
                  已标记推荐：<b>{selectedRow.hero.name}</b> · {laneLabel(lane)}
                </div>
              ) : null}
              <button type="button" className="btn btn-primary btn-block bp-cta" onClick={toItems}>
                <Icon name="shield" />
                用这套进游戏 · 一键出装
                <Icon name="arrowRight" />
              </button>
              <p className="bp-actions-note">
                {picks.length < 2
                  ? "至少录入 2 个敌方英雄后再进入出装页"
                  : `将带上 ${picks.length} 个敌方英雄${selectedRow ? `，并标记推荐「${selectedRow.hero.name}」` : ""}进入出装页`}
              </p>
            </div>
          </>
        )}
      </div>

      {sheet ? <HeroSheet name={sheet} laneCtx={phase === "pick" ? lane : undefined} onClose={() => setSheet("")} /> : null}

      {picker ? (
        <HeroPicker
          title={banPickerOpen ? "添加敌方 Ban" : "添加敌方已选"}
          subtitle={banPickerOpen ? "点选后立即填入 Ban 位" : "按对面实际阵容依次录入"}
          exclude={banPickerOpen ? [...bans, ...picks] : [...picks, ...bans]}
          onPick={(name) => {
            if (banPickerOpen) addBan(name);
            else addPick(name);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function SlotGrid({ names, tone, onAdd, onRemove }) {
  return (
    <div className="bp-slots">
      {Array.from({ length: MAX }).map((_, i) => {
        const name = names[i];
        if (!name) {
          return (
            <button key={`empty-${i}`} type="button" className="bp-slot empty" onClick={onAdd} aria-label="添加英雄">
              <span className="bp-slot-plus">
                <Icon name="plus" />
              </span>
              <span className="bp-slot-name faint">空位</span>
            </button>
          );
        }
        return (
          <button
            key={name}
            type="button"
            className={`bp-slot filled ${tone}`}
            onClick={() => onRemove(name)}
            aria-label={`移除 ${name}`}
          >
            <span className="bp-slot-ava">
              <Avatar name={name} size={48} />
              <span className="bp-slot-x">
                <Icon name="x" />
              </span>
            </span>
            <span className="bp-slot-name">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- page style */
const CSS = `
.bp-page .bp-reset{height:36px;padding:0 12px;border-radius:999px;}
.bp-page .bp-stepper{display:flex;gap:4px;padding:6px;margin-top:14px;}
.bp-page .bp-step{flex:1;display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:14px;border:1px solid transparent;text-align:left;min-width:0;transition:background .18s ease,border-color .18s ease;}
.bp-page .bp-step .idx{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-family:var(--mono);font-size:.55rem;font-weight:700;color:var(--faint);background:var(--surface-2);border:1px solid var(--line);flex-shrink:0;}
.bp-page .bp-step .tt{display:flex;flex-direction:column;gap:1px;min-width:0;}
.bp-page .bp-step .tt b{font-size:.8rem;font-weight:800;letter-spacing:.02em;color:var(--muted);white-space:nowrap;}
.bp-page .bp-step .tt em{font-style:normal;font-family:var(--mono);font-size:.45rem;letter-spacing:.12em;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bp-page .bp-step .cnt{margin-left:auto;font-family:var(--mono);font-size:.58rem;color:var(--faint);flex-shrink:0;}
.bp-page .bp-step.on{background:var(--gold-soft);border-color:var(--gold-line);}
.bp-page .bp-step.on .idx{color:var(--gold-2);border-color:var(--gold-line);background:var(--surface);}
.bp-page .bp-step.on .tt b{color:var(--ink);}
.bp-page .bp-step.on .cnt{color:var(--gold);}
.bp-page .bp-step.done .idx{color:var(--green);border-color:color-mix(in srgb,var(--green) 34%,transparent);background:var(--green-soft);}
.bp-page .bp-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.bp-page .section{margin-top:20px;}
.bp-page .sub-head{margin:16px 0 9px;}

.bp-page .bp-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.bp-page .bp-slot{display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px 2px 9px;border-radius:14px;border:1px dashed var(--line);background:color-mix(in srgb,var(--surface) 42%,transparent);min-width:0;transition:transform .12s ease;}
.bp-page .bp-slot:active{transform:scale(.96);}
.bp-page .bp-slot.filled{border-style:solid;background:var(--surface);box-shadow:var(--shadow-sm);}
.bp-page .bp-slot-ava{position:relative;width:56px;height:56px;border-radius:50%;padding:2px;border:1.5px solid var(--line);background:var(--surface-2);display:block;}
.bp-page .bp-slot-ava .avatar{display:block;}
.bp-page .bp-slot.pick .bp-slot-ava{border-color:var(--gold-line);box-shadow:0 0 0 3px var(--gold-soft);}
.bp-page .bp-slot.ban .bp-slot-ava::after{content:"";position:absolute;inset:-1.5px;border-radius:50%;background:linear-gradient(135deg,transparent 44%,color-mix(in srgb,var(--red) 76%,transparent) 47%,color-mix(in srgb,var(--red) 76%,transparent) 53%,transparent 56%);pointer-events:none;}
.bp-page .bp-slot-x{position:absolute;top:-4px;right:-4px;width:17px;height:17px;border-radius:50%;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;color:var(--faint);z-index:1;}
.bp-page .bp-slot-x svg{width:9px;height:9px;}
.bp-page .bp-slot-name{max-width:100%;padding:0 2px;font-size:.57rem;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bp-page .bp-slot.empty .bp-slot-name{color:var(--faint);}
.bp-page .bp-slot-plus{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:var(--faint);background:color-mix(in srgb,var(--surface) 55%,transparent);border:1px solid var(--line);}
.bp-page .bp-slot-plus svg{width:17px;height:17px;}

.bp-page .bp-batch{display:flex;gap:8px;margin-top:10px;}
.bp-page .bp-input{flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--surface);}
.bp-page .bp-input .ic{width:14px;height:14px;color:var(--faint);flex-shrink:0;}
.bp-page .bp-input input{flex:1;min-width:0;font-size:.72rem;letter-spacing:.01em;}
.bp-page .bp-clear{display:grid;place-items:center;color:var(--faint);width:18px;height:18px;flex-shrink:0;}
.bp-page .bp-clear svg{width:12px;height:12px;}
.bp-page .bp-fill{flex-shrink:0;height:40px;padding:0 13px;border-radius:12px;}
.bp-page .bp-unknown{margin-top:8px;line-height:1.6;word-break:break-all;}

.bp-page .bp-combos{display:flex;flex-direction:column;gap:9px;}
.bp-page .bp-combo{display:flex;align-items:center;gap:11px;width:100%;padding:13px;border-radius:var(--radius-lg);text-align:left;}
.bp-page .bp-combo .grow{flex:1;min-width:0;display:block;}
.bp-page .bp-combo-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.bp-page .bp-combo-top b{font-family:var(--serif);font-size:1.12rem;font-weight:900;letter-spacing:.03em;line-height:1.2;}
.bp-page .bp-combo-bans{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:6px;}
.bp-page .bp-combo-why{display:block;margin-top:6px;font-size:.65rem;line-height:1.55;color:var(--muted);}
.bp-page .bp-combo .chev{display:flex;align-items:center;gap:1px;font-size:.56rem;letter-spacing:.04em;color:var(--muted);flex-shrink:0;}
.bp-page .bp-combo .chev svg{width:14px;height:14px;}

.bp-page .bp-rugs{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.bp-page .bp-rug{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:13px;background:var(--surface);border:1px solid var(--line);text-align:left;min-width:0;box-shadow:var(--shadow-sm);}
.bp-page .bp-rug:active{border-color:var(--gold-line);}
.bp-page .bp-rug .grow{flex:1;min-width:0;display:block;}
.bp-page .bp-rug .nm{display:block;font-size:.78rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bp-page .bp-rug .why{display:block;margin-top:2px;font-size:.53rem;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bp-page .bp-rug .tier{flex-shrink:0;font-family:var(--mono);font-size:.52rem;color:var(--faint);}
.bp-page .bp-rug-chev{flex-shrink:0;color:var(--faint);width:12px;height:12px;}

.bp-page .bp-empty{padding:20px 16px;text-align:center;}
.bp-page .bp-empty-ico{width:44px;height:44px;margin:0 auto 10px;border-radius:14px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold-line);}
.bp-page .bp-empty-ico svg{width:20px;height:20px;}
.bp-page .bp-empty b{display:block;font-family:var(--serif);font-size:.98rem;letter-spacing:.02em;}
.bp-page .bp-empty p{margin:6px auto 0;max-width:290px;font-size:.68rem;line-height:1.65;color:var(--muted);}
.bp-page .bp-empty-row{display:flex;gap:8px;justify-content:center;margin-top:12px;}
.bp-page .bp-foot-note{margin-top:12px;line-height:1.6;}
.bp-page .bp-banline{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:10px;}

.bp-page .bp-tips{display:flex;flex-direction:column;gap:7px;}
.bp-page .bp-tip{display:flex;gap:9px;padding:10px 12px;border-radius:12px;background:var(--blue-soft);border:1px solid color-mix(in srgb,var(--blue) 26%,transparent);}
.bp-page .bp-tip-ico{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:color-mix(in srgb,var(--blue) 15%,transparent);color:var(--blue);flex-shrink:0;}
.bp-page .bp-tip-ico svg{width:12px;height:12px;}
.bp-page .bp-tip-body{flex:1;min-width:0;}
.bp-page .bp-tip-body b{display:block;font-size:.72rem;color:var(--blue);}
.bp-page .bp-tip-body p{margin-top:2px;font-size:.64rem;line-height:1.55;color:var(--muted);}

.bp-page .seg-wrap{position:relative;top:auto;}
.bp-page .bp-recs{display:flex;flex-direction:column;gap:9px;}
.bp-page .bp-rec{border-radius:var(--radius-lg);border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow-sm);overflow:hidden;transition:border-color .18s ease;}
.bp-page .bp-rec.on{border-color:var(--gold-line);box-shadow:var(--shadow),var(--glow-gold);}
.bp-page .bp-rec-main{display:flex;gap:11px;width:100%;padding:12px 12px 9px;text-align:left;}
.bp-page .bp-rec-art{width:74px;height:74px;border-radius:13px;object-fit:cover;object-position:50% 18%;flex-shrink:0;background:var(--surface-2);}
.bp-page .hero-fallback.bp-rec-art{width:74px;height:74px;font-size:1.2rem;display:grid;place-items:center;}
.bp-page .bp-rec-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
.bp-page .bp-rec-name{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.bp-page .bp-rec-name b{font-family:var(--serif);font-size:1.04rem;font-weight:900;letter-spacing:.03em;line-height:1.2;}
.bp-page .bp-hits{display:flex;flex-direction:column;gap:3px;}
.bp-page .bp-hit{display:flex;gap:5px;align-items:flex-start;font-size:.65rem;line-height:1.5;color:var(--muted);}
.bp-page .bp-hit .ic{width:12px;height:12px;color:var(--green);flex-shrink:0;margin-top:2px;}
.bp-page .bp-hit .txt{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.bp-page .bp-hit b{color:var(--ink-2);font-weight:700;}
.bp-page .bp-hit.more{color:var(--faint);font-size:.6rem;}
.bp-page .bp-warn{display:flex;gap:5px;align-items:flex-start;font-size:.63rem;line-height:1.5;color:var(--red);}
.bp-page .bp-warn .ic{width:12px;height:12px;flex-shrink:0;margin-top:2px;}
.bp-page .bp-warn .txt{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.bp-page .bp-warn b{font-weight:800;}
.bp-page .bp-rec-foot{display:flex;align-items:center;gap:7px;padding:8px 12px 11px;border-top:1px dashed var(--line-2);}
.bp-page .bp-rec-foot .bp-select{margin-left:auto;}
.bp-page .bp-rec-foot .fav-btn{flex-shrink:0;}

.bp-page .bp-actions{position:sticky;bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px));z-index:8;margin:24px 0 -30px;padding:16px 0 8px;background:linear-gradient(to top,var(--bg) 0,var(--bg) 91%,color-mix(in srgb,var(--bg) 94%,transparent) 96%,transparent 100%);}
.bp-page .bp-picked{display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:8px;font-size:.64rem;color:var(--muted);}
.bp-page .bp-picked b{font-family:var(--serif);font-size:.8rem;color:var(--gold);}
.bp-page .bp-cta{height:48px;border-radius:15px;font-size:.82rem;letter-spacing:.02em;}
.bp-page .bp-cta svg{width:16px;height:16px;}
.bp-page .bp-actions-note{margin-top:8px;text-align:center;font-size:.58rem;color:var(--faint);line-height:1.5;}
.bp-page .bp-voice-help{margin-top:7px;line-height:1.5;}
.bp-page .bp-mic{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);display:grid;place-items:center;flex-shrink:0;transition:transform .12s ease,background .18s ease,color .18s ease,box-shadow .18s ease;}
.bp-page .bp-mic svg{width:17px;height:17px;}
.bp-page .bp-mic:active{transform:scale(.94);}
.bp-page .bp-mic.on{color:#fff;background:linear-gradient(135deg,#df5d5d,#b72f3e);border-color:transparent;box-shadow:0 0 0 4px color-mix(in srgb,var(--red) 15%,transparent);animation:bp-mic-breathe 1.1s ease-in-out infinite;}
.bp-page .bp-voice{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 12px;border-radius:13px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow-sm);}
.bp-page .bp-voice-dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0;animation:bp-voice-pulse 1s ease-in-out infinite;}
.bp-page .bp-voice.requesting .bp-voice-dot{background:var(--gold);}
.bp-page .bp-voice.processing .bp-voice-dot{background:var(--blue);}
.bp-page .bp-voice-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.bp-page .bp-voice-copy b{font-size:.72rem;color:var(--ink);}
.bp-page .bp-voice-copy span{font-size:.62rem;line-height:1.45;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bp-page .bp-voice-bars{display:flex;align-items:center;gap:2px;width:32px;height:20px;flex-shrink:0;}
.bp-page .bp-voice-bars i{display:block;flex:1;border-radius:2px;background:var(--red);animation:bp-voice-bar .8s ease-in-out infinite;}
.bp-page .bp-voice.requesting .bp-voice-bars i,.bp-page .bp-voice.processing .bp-voice-bars i{background:var(--gold);}
.bp-page .bp-voice-bars i:nth-child(1){height:6px;animation-delay:-.2s;}
.bp-page .bp-voice-bars i:nth-child(2){height:13px;animation-delay:-.45s;}
.bp-page .bp-voice-bars i:nth-child(3){height:19px;animation-delay:-.1s;}
.bp-page .bp-voice-bars i:nth-child(4){height:11px;animation-delay:-.35s;}
.bp-page .bp-voice-bars i:nth-child(5){height:7px;animation-delay:-.55s;}
.bp-page .bp-voice-result{margin-top:10px;padding:12px;border-radius:14px;}
.bp-page .bp-voice-result-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
.bp-page .bp-voice-result-head span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bp-page .bp-voice-chips{display:flex;gap:6px;flex-wrap:wrap;}
.bp-page .bp-voice-chip{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 9px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink-2);font-size:.66rem;font-weight:700;transition:border-color .15s ease,background .15s ease;}
.bp-page .bp-voice-chip em{font-style:normal;font-family:var(--mono);font-size:.5rem;color:var(--faint);font-weight:400;}
.bp-page .bp-voice-chip.on{border-color:var(--gold-line);background:var(--gold-soft);color:var(--gold-2);}
.bp-page .bp-voice-chip.on em{color:var(--gold);}
.bp-page .bp-voice-result-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:10px;flex-wrap:wrap;}
@keyframes bp-voice-pulse{0%,100%{transform:scale(.85);opacity:.65;}50%{transform:scale(1.2);opacity:1;}}
@keyframes bp-voice-bar{0%,100%{transform:scaleY(.45);}50%{transform:scaleY(1);}}
@keyframes bp-mic-breathe{0%,100%{box-shadow:0 0 0 4px color-mix(in srgb,var(--red) 15%,transparent);}50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--red) 7%,transparent);}}
`;
