/**
 * 语音桥：优先走 Android 原生 AppBridge（系统 SpeechRecognizer），
 * 浏览器/开发环境退化为 Web Speech API，便于桌面预览。
 *
 * 原生回调协议：
 *   window.__voiceEvent(id, type, payload)
 *   type: ready / start / partial / final / end / rms / error
 *   payload: JSON 字符串，例如 {results:[{text, confidence}], rms: 6, code, message}
 */

const entries = new Map();
let installed = false;

function getNative() {
  return typeof window !== "undefined" ? window.AppBridge : null;
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function cleanup(entry) {
  if (!entry) return;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entries.delete(entry.id);
}

function dispatch(entry, type, data) {
  const h = entry.handlers || {};
  if (type === "ready") {
    entry.ready = true;
    h.onReady?.();
    if (entry.released) {
      // 用户在权限弹窗期间已经松手：拿到麦克风后立即收尾
      try {
        getNative()?.voiceStop?.(entry.id);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  if (type === "start") {
    entry.started = true;
    h.onStart?.();
    return;
  }
  if (type === "partial") {
    entry.lastResults = data.results || [];
    h.onPartial?.(entry.lastResults, data);
    return;
  }
  if (type === "rms") {
    h.onRms?.(Number(data.rms) || 0);
    return;
  }
  if (type === "final") {
    if (entry.finished) return;
    entry.finished = true;
    cleanup(entry);
    h.onFinal?.(data.results || [], data);
    return;
  }
  if (type === "error") {
    if (entry.finished) return;
    entry.finished = true;
    cleanup(entry);
    h.onError?.(data);
  }
}

function install() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  window.__voiceEvent = (id, type, payload) => {
    const entry = entries.get(id);
    if (!entry) return;
    dispatch(entry, type, parsePayload(payload));
  };
}

export function voiceSupported() {
  if (typeof window === "undefined") return false;
  if (getNative()?.voiceStart) return true;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @param {{onReady?:Function,onStart?:Function,onPartial?:Function,onFinal?:Function,onError?:Function,onRms?:Function}} handlers
 * @returns {{id:string, stop:Function, cancel:Function}|null}
 */
export function startVoice(handlers = {}) {
  install();
  if (!voiceSupported()) {
    handlers.onError?.({ code: "unsupported", message: "当前环境不支持语音输入，请用键盘输入" });
    return null;
  }
  const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const entry = {
    id,
    handlers,
    released: false,
    finished: false,
    cancelled: false,
    mode: "native",
    ready: false,
    started: false,
    lastResults: [],
    timer: null,
  };
  entries.set(id, entry);

  const fail = (code, message) => {
    if (!entry.finished) {
      entry.finished = true;
      cleanup(entry);
      handlers.onError?.({ code, message });
    }
  };

  entry.timer = setTimeout(() => {
    if (entry.finished) return;
    try {
      getNative()?.voiceCancel?.(id);
    } catch {
      /* ignore */
    }
    fail("timeout", "语音识别超时，请再试一次");
  }, 25000);

  const native = getNative();
  if (native?.voiceStart) {
    entry.mode = "native";
    try {
      native.voiceStart(id);
    } catch (e) {
      fail("start_failed", "语音启动失败：" + (e?.message || e));
      return null;
    }
  } else {
    entry.mode = "web";
    startWebSpeech(entry, fail);
  }

  return {
    id,
    stop() {
      if (entry.finished || entry.released) return;
      entry.released = true;
      if (entry.mode === "native") {
        try {
          getNative()?.voiceStop?.(id);
        } catch {
          /* ignore */
        }
      } else if (entry.rec) {
        try {
          entry.rec.stop();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      if (entry.finished) return;
      entry.finished = true;
      entry.cancelled = true;
      cleanup(entry);
      if (entry.mode === "native") {
        try {
          getNative()?.voiceCancel?.(id);
        } catch {
          /* ignore */
        }
      } else if (entry.rec) {
        try {
          entry.rec.abort();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

function startWebSpeech(entry, fail) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    fail("unsupported", "当前浏览器不支持语音识别");
    return;
  }
  let rec;
  try {
    rec = new SR();
  } catch (e) {
    fail("start_failed", "语音识别初始化失败");
    return;
  }
  entry.rec = rec;
  rec.lang = "zh-CN";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 5;

  const collect = (event) => {
    const results = [];
    for (let i = 0; i < event.results.length; i++) {
      const alt = event.results[i];
      for (let j = 0; j < alt.length; j++) {
        const item = alt[j];
        if (item?.transcript) {
          results.push({ text: item.transcript, confidence: item.confidence || 0 });
        }
      }
    }
    return results;
  };

  rec.onstart = () => dispatch(entry, "start", {});
  rec.onresult = (event) => {
    const results = collect(event);
    const isFinal = [...event.results].some((r) => r.isFinal);
    if (isFinal) {
      dispatch(entry, "final", { results });
    } else {
      dispatch(entry, "partial", { results });
    }
  };
  rec.onerror = (event) => {
    const map = {
      "not-allowed": "permission",
      "service-not-allowed": "permission",
      "no-speech": "no_match",
      "audio-capture": "audio",
      network: "network",
      aborted: "cancelled",
    };
    dispatch(entry, "error", {
      code: map[event.error] || "asr_error",
      message:
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "没有麦克风权限"
          : event.error === "no-speech"
            ? "没有听到声音，再说一次"
            : "语音识别失败：" + event.error,
    });
  };
  rec.onend = () => {
    if (entry.finished) return;
    dispatch(entry, "final", { results: entry.lastResults });
  };

  try {
    rec.start();
  } catch (e) {
    fail("start_failed", "麦克风启动失败");
  }
}
