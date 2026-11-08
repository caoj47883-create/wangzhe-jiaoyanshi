// App 内 AI 问答：本地数据 RAG 上下文 + 外部 OpenAI 兼容接口（经 Java 桥转发，避免 CORS）
import { AI_DEFAULT, LS_KEYS } from "./config.js";
import { COMPS, DATA, HEROES, ITEMS, countersAgainst, countersBy, laneLabel, tierFor } from "./data.js";
import { currentDataVersion, getPatchData, getPatchInfo } from "./update.js";

export function getAiConfig() {
  try {
    const raw = localStorage.getItem(LS_KEYS.ai);
    if (!raw) return { ...AI_DEFAULT };
    return { ...AI_DEFAULT, ...JSON.parse(raw) };
  } catch (e) {
    return { ...AI_DEFAULT };
  }
}

export function saveAiConfig(cfg) {
  try {
    localStorage.setItem(LS_KEYS.ai, JSON.stringify({ ...AI_DEFAULT, ...cfg }));
    return true;
  } catch (e) {
    return false;
  }
}

export function isAiReady() {
  const cfg = getAiConfig();
  return !!(cfg.enabled && cfg.endpoint);
}

/** 找出问题里提到的英雄（按名字长度倒序匹配，避免「元流之子」被拆开） */
function mentionedHeroes(question) {
  const q = question || "";
  const hits = HEROES.filter((h) => q.includes(h.name)).sort((a, b) => b.name.length - a.name.length);
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    if (seen.has(h.name)) continue;
    if (out.some((x) => x.name.includes(h.name))) continue; // 已命中更长的英雄名
    seen.add(h.name);
    out.push(h);
  }
  return out.slice(0, 4);
}

function heroBlock(h) {
  const parts = [`${h.name}（${(h.lanes || [h.lane]).map(laneLabel).join("/")}，梯度 ${tierFor(h, h.lane)}）`];
  if (h.tags && h.tags.length) parts.push("特点：" + h.tags.join("、"));
  const can = countersAgainst(h.name).slice(0, 6).map((x) => (typeof x === "string" ? x : x.name || "")).filter(Boolean);
  const weak = countersBy(h.name).slice(0, 6).map((x) => (typeof x === "string" ? x : x.name || "")).filter(Boolean);
  if (can.length) parts.push("克制（能打）：" + can.join("、"));
  if (weak.length) parts.push("被克制：" + weak.join("、"));
  return parts.join("；");
}

function itemBlock(name) {
  const it = ITEMS[name];
  if (!it) return "";
  const bits = [];
  if (it.price) bits.push("价格" + it.price);
  if (Array.isArray(it.stats)) bits.push(it.stats.join("、"));
  if (it.desc) bits.push(it.desc);
  if (it.note) bits.push(it.note);
  return `${name}：${bits.join("；") || "装备"}`;
}

/** 组装发给模型的本地数据上下文（RAG 的「检索」部分） */
export function buildContext(question) {
  const lines = [];
  lines.push("【数据版本】" + currentDataVersion());
  const patch = getPatchInfo();
  if (patch && patch.title) lines.push(`【版本公告】${patch.title}（${patch.date || ""}）`);
  lines.push("【数据快照日期】" + (DATA.snapshot || "未知"));

  const hs = mentionedHeroes(question);
  if (hs.length) {
    lines.push("【英雄】");
    hs.forEach((h) => lines.push("- " + heroBlock(h)));
    const pd = getPatchData();
    if (pd && Array.isArray(pd.changes)) {
      const names = new Set(hs.map((h) => h.name));
      const changes = pd.changes.filter((c) => c.type === "hero" && names.has(c.name)).slice(0, 12);
      if (changes.length) {
        lines.push("【本版改动】");
        changes.forEach((c) => lines.push("- " + (c.name || "") + "：" + (c.text || `${c.from} → ${c.to}`)));
      }
    }
  }

  const itemNames = Object.keys(ITEMS).filter((n) => (question || "").includes(n)).slice(0, 4);
  if (itemNames.length) {
    lines.push("【装备】");
    itemNames.forEach((n) => {
      const b = itemBlock(n);
      if (b) lines.push("- " + b);
    });
  }

  if (/阵容|五黑|上分|体系|开黑/.test(question || "") || COMPS.some((c) => (question || "").includes(c.name))) {
    lines.push("【阵容（部分）】");
    COMPS.slice(0, 6).forEach((c) => {
      if (c.name.includes("KPL")) return;
      const picks = Object.values(c.picks || {}).filter(Boolean).join("/");
      lines.push(`- ${c.name}（${c.style || ""}）：${picks}。思路：${(c.idea || "").slice(0, 80)}；弱点：${(c.weak || "").slice(0, 60)}`);
    });
  }

  lines.push("【说明】以上为应用内置/热更新数据；未列出的英雄可基于通用理解回答，但要说明不确定。");
  return lines.join("\n").slice(0, 6500);
}

function parseReply(raw) {
  if (!raw) return "";
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return String(raw).slice(0, 8000);
  }
  const content =
    (obj && obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.content) ||
    (obj && obj.content) ||
    "";
  return String(content).trim();
}

function bridgeCall(cfg, body) {
  return new Promise((resolve, reject) => {
    const id = "ai" + Date.now() + Math.random().toString(36).slice(2, 6);
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete window.__aiReply;
      fn(arg);
    };
    const timer = setTimeout(() => finish(reject, new Error("AI 请求超时（90 秒）")), 92000);
    window.__aiReply = (rid, ok, payload) => {
      if (rid !== id) return;
      if (!ok) return finish(reject, new Error(payload || "AI 请求失败"));
      const text = parseReply(payload);
      if (!text) return finish(reject, new Error("AI 返回内容为空"));
      finish(resolve, text);
    };
    try {
      window.AppBridge.aiChat(id, cfg.endpoint, cfg.key || "", JSON.stringify(body));
    } catch (e) {
      finish(reject, e);
    }
  });
}

async function directCall(cfg, body) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = "Bearer " + cfg.key;
  const res = await fetch(cfg.endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("接口返回 HTTP " + res.status + (t ? "：" + t.slice(0, 160) : ""));
  }
  const data = await res.json();
  const text = parseReply(data);
  if (!text) throw new Error("AI 返回内容为空");
  return text;
}

/**
 * 发起一次 AI 问答。
 * @param {string} question
 * @param {Array<{role:string,content:string}>} history 最近对话
 */
export async function askAi(question, history = []) {
  const cfg = getAiConfig();
  if (!cfg.enabled) {
    const err = new Error("AI 问答未开启，请先到「设置 → AI 问答」开启并填写接口");
    err.code = "NO_CONFIG";
    throw err;
  }
  if (!cfg.endpoint) {
    const err = new Error("请先在「设置 → AI 问答」填写接口地址");
    err.code = "NO_CONFIG";
    throw err;
  }
  const context = buildContext(question);
  const system =
    "你是《王者荣耀》数据助手，服务于一个个人数据工具「王者教研室」。回答要求：\n" +
    "1. 优先使用下面提供的本地数据；数据里没有的内容可以基于通用版本理解回答，但要说明不确定性。\n" +
    "2. 回答简洁、分点，给出可执行建议（对线/出装/克制/团战）；总字数控制在 500 字以内。\n" +
    "3. 不要编造不存在的英雄、装备或数值；涉及具体数值时注明来源或说明是经验判断。\n" +
    "4. 用中文回答。\n\n" +
    "【本地数据上下文】\n" +
    context;
  const messages = [{ role: "system", content: system }, ...history.slice(-6), { role: "user", content: question }];
  const body = { model: cfg.model || AI_DEFAULT.model, messages, temperature: Number(cfg.temperature || 0.4), stream: false };
  if (window.AppBridge && typeof window.AppBridge.aiChat === "function") {
    return bridgeCall(cfg, body);
  }
  return directCall(cfg, body);
}

/** 测试接口连通性 */
export async function testAiConnection() {
  const cfg = getAiConfig();
  if (!cfg.endpoint) throw new Error("请先填写接口地址");
  const body = {
    model: cfg.model || AI_DEFAULT.model,
    messages: [{ role: "user", content: "回复两个字：可用" }],
    temperature: 0,
    stream: false,
  };
  if (window.AppBridge && typeof window.AppBridge.aiChat === "function") {
    return bridgeCall(cfg, body);
  }
  return directCall(cfg, body);
}
