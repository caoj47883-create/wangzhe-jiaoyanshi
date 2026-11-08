import { useEffect, useRef, useState } from "react";
import { PageHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import { useApp } from "../lib/store.js";
import { APP_VERSION } from "../lib/config.js";
import { askAi, isAiReady } from "../lib/ai.js";
import { currentDataVersion, getPatchInfo } from "../lib/update.js";

const SUGGESTIONS = [
  "这个版本敖隐还能玩吗？",
  "对面东皇太一 + 张良，选什么打野？",
  "推荐一套适合五排的上分阵容",
  "新版本哪些装备被改了？",
];

export default function AiChat() {
  const { back, navigate, showToast } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const ready = isAiReady();
  const patch = getPatchInfo();

  useEffect(() => {
    if (endRef.current && endRef.current.scrollIntoView) {
      try {
        endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch (e) {
        /* ignore */
      }
    }
  }, [messages, busy]);

  const send = async (raw) => {
    const text = (raw != null ? raw : input).trim();
    if (!text || busy) return;
    if (!ready) {
      showToast("请先在设置里配置 AI 接口");
      navigate("settings");
      return;
    }
    setErr("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await askAi(text, history);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (e && e.code === "NO_CONFIG") {
        setErr("AI 未配置，请到「设置 → AI 问答」开启并填写接口与 Key。");
      } else {
        setErr("请求失败：" + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page ai-page">
      <PageHead eyebrow="AI LAB" title="AI 问答" sub={`数据版本 ${currentDataVersion()}${patch && patch.title ? " · " + patch.title : ""}`} onBack={back} />
      <div className="page-inner ai-inner" style={{ paddingTop: 6 }}>
        {!ready ? (
          <div className="card card-pad" style={{ marginTop: 4 }}>
            <div className="row" style={{ padding: 0, gap: 8 }}>
              <span className="avatar" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--gold-soft)", color: "var(--gold)" }}>
                <Icon name="spark" style={{ width: 17, height: 17 }} />
              </span>
              <span className="grow">
                <span className="title">AI 问答还没开启</span>
                <span className="sub">需要你自己的 OpenAI 兼容接口（如 DeepSeek / Kimi / 通义）</span>
              </span>
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("settings")}>
              去设置里填写接口
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="ai-intro">
            <div className="card card-dark card-pad">
              <div className="tiny eyebrow" style={{ color: "var(--gold-2)" }}>ASK THE DATA</div>
              <div className="h3" style={{ marginTop: 6 }}>问版本、问英雄、问反制</div>
              <p className="small muted" style={{ lineHeight: 1.8, marginTop: 6 }}>
                回答会结合本应用的数据版本（英雄梯度、克制、装备、本版公告），未覆盖的内容会说明不确定。
              </p>
            </div>
            <div className="ai-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ai-chip" onClick={() => send(s)} disabled={!ready || busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-thread">
            {messages.map((m, i) => (
              <div key={i} className={"ai-msg " + (m.role === "user" ? "ai-user" : "ai-assistant")}>
                <div className="ai-bubble">{m.content}</div>
              </div>
            ))}
            {busy ? (
              <div className="ai-msg ai-assistant">
                <div className="ai-bubble ai-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            {err ? <div className="ai-error">{err}</div> : null}
            <div ref={endRef} />
          </div>
        )}

        <div className="ai-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ready ? "问问这版本怎么打…（Enter 发送，Shift+Enter 换行）" : "请先在设置里配置 AI 接口"}
            rows={2}
            disabled={busy}
          />
          <button className="btn btn-primary ai-send" onClick={() => send()} disabled={busy || !input.trim()}>
            {busy ? "思考中" : "发送"}
          </button>
        </div>

        <p className="footer tiny faint" style={{ textAlign: "center", marginTop: 14, lineHeight: 1.8 }}>
          AI 生成内容仅供参考，具体以官方公告与游戏内为准 · V{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
