import { useEffect, useState } from "react";
import { PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import { useApp } from "../lib/store.js";
import { AI_DEFAULT, APP_VERSION, DATA_BASE_EXAMPLE, LS_KEYS } from "../lib/config.js";
import { DATA } from "../lib/data.js";
import { getAiConfig, saveAiConfig, testAiConnection } from "../lib/ai.js";
import {
  checkForUpdates,
  currentDataVersion,
  getDataBase,
  getPatchData,
  getPatchInfo,
  hasRuntimeData,
  lastCheckedAt,
  reloadForNewData,
  restoreBuiltin,
  setDataBase,
} from "../lib/update.js";

const FONT_STEPS = [
  { label: "小", value: 0.92 },
  { label: "标准", value: 1 },
  { label: "大", value: 1.08 },
];

function fmtTime(ts) {
  if (!ts) return "从未";
  try {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (e) {
    return "未知";
  }
}

export default function Settings() {
  const { back, theme, setTheme, fontScale, setFontScale, favorites, recents, clearFavorites, clearRecents, showToast } = useApp();

  const [dataBase, setDataBaseInput] = useState(getDataBase());
  const [dataStatus, setDataStatus] = useState("");
  const [checking, setChecking] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [ai, setAi] = useState(getAiConfig());
  const [aiTest, setAiTest] = useState({ state: "", msg: "" });

  useEffect(() => {
    setDataBaseInput(getDataBase());
    setAi(getAiConfig());
  }, []);

  const patch = getPatchInfo();
  const patchData = getPatchData();
  const runtime = hasRuntimeData();
  const changes = (patchData && Array.isArray(patchData.changes) ? patchData.changes : []).slice(0, 40);

  const doSaveBase = () => {
    const v = setDataBase(dataBase);
    setDataBaseInput(v);
    showToast(v ? "数据源已保存" : "已清空数据源");
  };

  const doCheck = async () => {
    if (!getDataBase()) {
      setDataStatus("请先填写数据源地址并保存（见上方示例）");
      return;
    }
    setChecking(true);
    setDataStatus("正在检查…");
    try {
      const r = await checkForUpdates({ manual: true });
      if (r.status === "updated") {
        setDataStatus(`发现新数据 ${r.version}，正在重启界面…`);
        showToast("数据已更新");
        setTimeout(() => reloadForNewData(), 900);
      } else if (r.status === "latest") {
        setDataStatus("已是最新数据 · " + (r.version || ""));
      } else {
        setDataStatus(r.message || "检查失败");
      }
    } catch (e) {
      setDataStatus("检查失败：" + (e.message || e));
    } finally {
      setChecking(false);
    }
  };

  const doRestore = () => {
    restoreBuiltin();
    showToast("已恢复内置快照，正在重启…");
    setTimeout(() => reloadForNewData(), 700);
  };

  const doSaveAi = () => {
    const cfg = { ...ai, endpoint: (ai.endpoint || "").trim() };
    saveAiConfig(cfg);
    setAi(cfg);
    showToast(cfg.enabled ? "AI 设置已保存" : "AI 问答已关闭");
  };

  const doTestAi = async () => {
    saveAiConfig({ ...ai, enabled: true });
    setAiTest({ state: "loading", msg: "正在测试…" });
    try {
      const text = await testAiConnection();
      setAiTest({ state: "ok", msg: "连接成功：" + String(text).slice(0, 80) });
    } catch (e) {
      setAiTest({ state: "err", msg: "连接失败：" + (e.message || e) });
    }
  };

  return (
    <div className="page">
      <PageHead eyebrow="SETTINGS" title="设置" sub="主题 · 字号 · 数据 · AI" onBack={back} />
      <div className="page-inner" style={{ paddingTop: 6 }}>
        <section className="section" style={{ marginTop: 4 }}>
          <div className="section-head">
            <h2 className="h2">外观</h2>
            <span className="sub">同时适配暗夜 / 纸感两套主题</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <button
              className="card card-pad"
              onClick={() => setTheme("dark")}
              style={{ textAlign: "left", borderColor: theme === "dark" ? "var(--gold-line)" : "var(--line)", boxShadow: theme === "dark" ? "var(--glow-gold)" : "var(--shadow-sm)" }}
            >
              <div style={{ height: 54, borderRadius: 10, background: "linear-gradient(150deg,#141a24,#080a0e)", border: "1px solid #232d3b", display: "grid", placeItems: "center", marginBottom: 9 }}>
                <span style={{ fontFamily: "var(--serif)", fontWeight: 900, color: "#e7c98b", fontSize: 16 }}>暗夜</span>
              </div>
              <div className="row" style={{ padding: 0, gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>暗夜战术</span>
                {theme === "dark" ? (
                  <span style={{ marginLeft: "auto", color: "var(--gold)" }}>
                    <Icon name="check" style={{ width: 15, height: 15 }} />
                  </span>
                ) : null}
              </div>
              <div className="tiny faint">OKX 风格 · 电竞数据感</div>
            </button>
            <button
              className="card card-pad"
              onClick={() => setTheme("light")}
              style={{ textAlign: "left", borderColor: theme === "light" ? "var(--gold-line)" : "var(--line)" }}
            >
              <div style={{ height: 54, borderRadius: 10, background: "linear-gradient(150deg,#fbf7ef,#e9e0cf)", border: "1px solid #e6ddcd", display: "grid", placeItems: "center", marginBottom: 9 }}>
                <span style={{ fontFamily: "var(--serif)", fontWeight: 900, color: "#8a6226", fontSize: 16 }}>纸感</span>
              </div>
              <div className="row" style={{ padding: 0, gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>暖纸浅色</span>
                {theme === "light" ? (
                  <span style={{ marginLeft: "auto", color: "var(--gold)" }}>
                    <Icon name="check" style={{ width: 15, height: 15 }} />
                  </span>
                ) : null}
              </div>
              <div className="tiny faint">Airbnb 风格 · 阅读友好</div>
            </button>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">字号</h2>
            <span className="sub">正文与列表同步缩放</span>
          </div>
          <div className="seg" style={{ marginBottom: 10 }}>
            {FONT_STEPS.map((f) => (
              <button key={f.label} className={Math.abs(fontScale - f.value) < 0.01 ? "on" : ""} onClick={() => setFontScale(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="card card-pad">
            <p className="reading">
              示例：对面控制链密集时，优先考虑庄周、带净化；核心输出别选站桩型，被连环控就没得打。出装与铭文会随字号一起缩放。
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">数据与更新</h2>
            <span className="sub">联网热更新 · 失败自动用内置数据</span>
          </div>

          <div className="card card-pad" style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="small muted">当前数据版本</span>
              <span className="small num" style={{ color: "var(--gold-2)" }}>{currentDataVersion()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="small muted">数据快照</span>
              <span className="small num">{DATA.snapshot || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="small muted">数据来源</span>
              <span className="small">{runtime ? "联网更新" : "APK 内置"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="small muted">上次检查</span>
              <span className="small num">{fmtTime(lastCheckedAt())}</span>
            </div>
            {patch && patch.title ? (
              <div
                className="row"
                style={{ padding: "8px 0 0", gap: 6, cursor: "pointer" }}
                onClick={() => patch.sourceUrl && window.AppBridge && window.AppBridge.openExternal(patch.sourceUrl)}
              >
                <span className="grow">
                  <span className="title" style={{ color: "var(--gold-2)" }}>本版公告：{patch.title}</span>
                  <span className="sub">{patch.date || ""} · 点击查看原文</span>
                </span>
                <span className="chev"><Icon name="arrowUpRight" /></span>
              </div>
            ) : null}
          </div>

          <label className="tiny faint" style={{ display: "block", margin: "2px 0 4px" }}>数据源地址（GitHub Pages 发布目录）</label>
          <input
            value={dataBase}
            onChange={(e) => setDataBaseInput(e.target.value)}
            placeholder={DATA_BASE_EXAMPLE}
            spellCheck={false}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: "0.68rem", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={doSaveBase}>保存地址</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={checking} onClick={doCheck}>
              {checking ? "检查中…" : "检查更新"}
            </button>
          </div>
          {dataStatus ? <p className="tiny" style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.7 }}>{dataStatus}</p> : null}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowLog((v) => !v)}>
              {showLog ? "收起更新日志" : `更新日志${patchData && patchData.changes ? "（" + patchData.changes.length + " 条）" : ""}`}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={doRestore}>恢复内置数据</button>
          </div>
          {showLog ? (
            <div className="card card-pad" style={{ marginTop: 9, maxHeight: 260, overflow: "auto" }}>
              {changes.length ? (
                changes.map((c, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: i < changes.length - 1 ? "1px dashed var(--line)" : "none" }}>
                    <span className="tiny" style={{ color: "var(--gold-2)" }}>{c.name || c.type}</span>
                    <div className="tiny muted" style={{ lineHeight: 1.6 }}>{c.text || `${c.from || ""} → ${c.to || ""}`}</div>
                  </div>
                ))
              ) : (
                <p className="tiny faint" style={{ lineHeight: 1.8 }}>
                  还没有可展示的版本日志。发布数据时把公告抽取结果一起上传（manifest 里的 patches.json），这里会显示本版本英雄/装备改动。
                </p>
              )}
            </div>
          ) : null}
          <p className="tiny faint" style={{ marginTop: 8, lineHeight: 1.8 }}>
            地址示例：{DATA_BASE_EXAMPLE}（末尾带 /）。未填写或断网时继续使用 APK 内置数据，不影响使用。
          </p>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">AI 问答</h2>
            <span className="sub">外部 OpenAI 兼容接口 · Key 只存本机</span>
          </div>

          <div className="list" style={{ marginBottom: 9 }}>
            <button
              className="row"
              onClick={() => setAi((v) => ({ ...v, enabled: !v.enabled }))}
              aria-pressed={!!ai.enabled}
            >
              <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--gold-soft)", color: "var(--gold)" }}>
                <Icon name="spark" style={{ width: 16, height: 16 }} />
              </span>
              <span className="grow">
                <span className="title">启用 AI 问答</span>
                <span className="sub">在「更多 → AI 问答」里使用</span>
              </span>
              <span
                style={{ width: 44, height: 24, borderRadius: 999, background: ai.enabled ? "var(--gold)" : "var(--surface-3)", position: "relative", transition: "background .2s" }}
              >
                <span style={{ position: "absolute", top: 2, left: ai.enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: ai.enabled ? "#1a1408" : "var(--muted)", transition: "left .2s" }} />
              </span>
            </button>
          </div>

          <label className="tiny faint" style={{ display: "block", margin: "2px 0 4px" }}>接口地址（完整 /chat/completions URL）</label>
          <input
            value={ai.endpoint}
            onChange={(e) => setAi((v) => ({ ...v, endpoint: e.target.value }))}
            placeholder={AI_DEFAULT.endpoint}
            spellCheck={false}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: "0.66rem", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={ai.model}
              onChange={(e) => setAi((v) => ({ ...v, model: e.target.value }))}
              placeholder="模型，如 deepseek-chat / kimi-k2"
              spellCheck={false}
              style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: "0.7rem" }}
            />
          </div>
          <input
            value={ai.key}
            onChange={(e) => setAi((v) => ({ ...v, key: e.target.value }))}
            placeholder="API Key（sk-…）"
            type="password"
            spellCheck={false}
            autoComplete="off"
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: "0.7rem", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={doTestAi}>测试连接</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={doSaveAi}>保存 AI 设置</button>
          </div>
          {aiTest.state ? (
            <p className="tiny" style={{ marginTop: 8, lineHeight: 1.7, color: aiTest.state === "ok" ? "var(--green, #7fd18b)" : aiTest.state === "err" ? "var(--red)" : "var(--muted)" }}>
              {aiTest.msg}
            </p>
          ) : null}
          <p className="tiny faint" style={{ marginTop: 8, lineHeight: 1.8 }}>
            Key 仅保存在本机 WebView 存储中，不随数据更新上传；接口请求由 App 原生层直连（避免浏览器 CORS）。请使用你自己的 API Key，注意用量与费用。
          </p>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">数据</h2>
          </div>
          <div className="list">
            <button
              className="row"
              onClick={() => {
                if (!favorites.length) return showToast("收藏夹已经是空的");
                clearFavorites();
                showToast("已清空收藏");
              }}
            >
              <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--red-soft)", color: "var(--red)" }}>
                <Icon name="trash" style={{ width: 16, height: 16 }} />
              </span>
              <span className="grow">
                <span className="title">清空收藏</span>
                <span className="sub">当前收藏 {favorites.length} 位英雄</span>
              </span>
            </button>
            <button
              className="row"
              onClick={() => {
                if (!recents.length) return showToast("最近浏览已经是空的");
                clearRecents();
                showToast("已清空最近浏览");
              }}
            >
              <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                <Icon name="clock" style={{ width: 16, height: 16 }} />
              </span>
              <span className="grow">
                <span className="title">清空最近浏览</span>
                <span className="sub">当前记录 {recents.length} 条</span>
              </span>
            </button>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">关于</h2>
          </div>
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="small muted">应用版本</span>
              <span className="small num">V{APP_VERSION}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="small muted">数据版本</span>
              <span className="small num">{currentDataVersion()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="small muted">数据快照</span>
              <span className="small num">{DATA.snapshot || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="small muted">运行方式</span>
              <span className="small">纯本地 + 联网热更新</span>
            </div>
            <div className="divider" />
            <p className="tiny faint" style={{ lineHeight: 1.8 }}>
              本应用内容整理自公开资料，仅供学习交流使用；英雄原画版权归腾讯《王者荣耀》所有。卸载重装会清空收藏、浏览记录与已下载数据。
            </p>
          </div>
        </section>
        <p className="footer tiny faint" style={{ textAlign: "center", marginTop: 24, fontFamily: "var(--mono)" }}>
          KING'S STUDY · V{APP_VERSION} · DATA {currentDataVersion()}
        </p>
      </div>
    </div>
  );
}
