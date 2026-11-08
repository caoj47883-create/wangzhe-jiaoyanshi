// 数据热更新：从 GitHub Pages 拉取 manifest + data.json，校验 sha256 后写入 localStorage，
// 下次启动时由 index.html 内联脚本在打包数据之前恢复（见 index.html）。
import { DATA } from "./data.js";
import { DEFAULT_DATA_BASE, LS_KEYS, UPDATE_INTERVAL_MS } from "./config.js";

const ls = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  },
};

export function normalizeBase(url) {
  let u = (url || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  if (!u.endsWith("/")) u += "/";
  return u;
}

export function getDataBase() {
  return normalizeBase(ls.get(LS_KEYS.dataBase) || DEFAULT_DATA_BASE);
}

export function setDataBase(url) {
  const v = normalizeBase(url);
  if (v) ls.set(LS_KEYS.dataBase, v);
  else ls.del(LS_KEYS.dataBase);
  return v;
}

export function getRuntimeManifest() {
  try {
    const raw = ls.get(LS_KEYS.runtimeManifest);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function currentDataVersion() {
  const m = getRuntimeManifest();
  return (m && m.dataVersion) || DATA.version || "内置";
}

export function currentDataSnapshot() {
  return DATA.snapshot || "";
}

export function getPatchInfo() {
  const m = getRuntimeManifest();
  return (m && m.patch) || null;
}

export function getPatchData() {
  try {
    const raw = ls.get(LS_KEYS.runtimePatches);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function lastCheckedAt() {
  const v = parseInt(ls.get(LS_KEYS.lastCheck) || "0", 10);
  return v || 0;
}

export function restoreBuiltin() {
  ls.del(LS_KEYS.runtimeData);
  ls.del(LS_KEYS.runtimeManifest);
  ls.del(LS_KEYS.runtimePatches);
  ls.del(LS_KEYS.lastCheck);
}

export function hasRuntimeData() {
  return !!ls.get(LS_KEYS.runtimeData);
}

/** 语义化版本比较：2026.11.05.1 > 2.0.3；非数字段按字符串比较。返回 -1/0/1 */
export function compareVersion(a, b) {
  const pa = String(a || "0").split(/[.\-+]/).filter(Boolean);
  const pb = String(b || "0").split(/[.\-+]/).filter(Boolean);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const xa = pa[i] || "0";
    const xb = pb[i] || "0";
    const na = /^\d+$/.test(xa);
    const nb = /^\d+$/.test(xb);
    if (na && nb) {
      const d = parseInt(xa, 10) - parseInt(xb, 10);
      if (d !== 0) return d > 0 ? 1 : -1;
    } else if (xa !== xb) {
      return xa > xb ? 1 : -1;
    }
  }
  return 0;
}

async function sha256Hex(buffer) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const digest = await window.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (e) {
    /* fall through */
  }
  return null;
}

async function fetchText(url) {
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now(), {
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}

/**
 * 检查并应用更新。
 * @returns {Promise<{status: 'no-base'|'throttled'|'latest'|'updated'|'error', version?: string, message?: string}>}
 */
export async function checkForUpdates({ manual = false } = {}) {
  const base = getDataBase();
  if (!base) return { status: "no-base" };

  if (!manual) {
    const last = lastCheckedAt();
    if (last && Date.now() - last < UPDATE_INTERVAL_MS && getRuntimeManifest()) {
      return { status: "throttled" };
    }
  }

  let manifest;
  try {
    const res = await fetchText(base + "manifest.json");
    manifest = await res.json();
  } catch (e) {
    return { status: "error", message: "拉取版本清单失败：" + (e.message || e) };
  }
  if (!manifest || !manifest.dataVersion || !manifest.files || !manifest.files["data.json"]) {
    return { status: "error", message: "版本清单格式不正确（缺少 dataVersion/files）" };
  }

  const current = currentDataVersion();
  if (compareVersion(manifest.dataVersion, current) <= 0) {
    ls.set(LS_KEYS.lastCheck, String(Date.now()));
    return { status: "latest", version: current };
  }

  const spec = manifest.files["data.json"];
  let text;
  try {
    if (/^https?:\/\//i.test(spec.url || "")) {
      const res = await fetch(spec.url, { cache: "no-store", credentials: "omit" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = await res.arrayBuffer();
      const hex = await sha256Hex(buf);
      if (spec.sha256 && hex && hex.toLowerCase() !== String(spec.sha256).toLowerCase()) {
        throw new Error("数据哈希校验失败（可能被篡改或上传不完整）");
      }
      text = new TextDecoder().decode(buf);
    } else {
      const res = await fetchText(base + spec.url);
      const buf = await res.arrayBuffer();
      const hex = await sha256Hex(buf);
      if (spec.sha256 && hex && hex.toLowerCase() !== String(spec.sha256).toLowerCase()) {
        throw new Error("数据哈希校验失败（可能被篡改或上传不完整）");
      }
      text = new TextDecoder().decode(buf);
    }
  } catch (e) {
    return { status: "error", message: "下载数据失败：" + (e.message || e) };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { status: "error", message: "数据 JSON 解析失败" };
  }
  if (!parsed || !Array.isArray(parsed.heroes) || parsed.heroes.length === 0) {
    return { status: "error", message: "数据内容不完整（heroes 为空）" };
  }

  // 可选：更新日志（公告抽取结果）
  let patchesText = null;
  const pSpec = manifest.files["patches.json"];
  if (pSpec) {
    try {
      const res = await fetchText(base + pSpec.url);
      const buf = await res.arrayBuffer();
      const hex = await sha256Hex(buf);
      if (!pSpec.sha256 || !hex || hex.toLowerCase() === String(pSpec.sha256).toLowerCase()) {
        patchesText = new TextDecoder().decode(buf);
      }
    } catch (e) {
      /* 更新日志失败不影响数据 */
    }
  }

  const ok = ls.set(LS_KEYS.runtimeData, text);
  if (!ok) return { status: "error", message: "本地存储空间不足，无法保存更新" };
  ls.set(LS_KEYS.runtimeManifest, JSON.stringify(manifest));
  if (patchesText) ls.set(LS_KEYS.runtimePatches, patchesText);
  ls.set(LS_KEYS.lastCheck, String(Date.now()));
  return { status: "updated", version: manifest.dataVersion, manifest };
}

/** 应用更新后重载页面：index.html 会在打包数据之前用 localStorage 的新数据覆盖。 */
export function reloadForNewData() {
  window.location.reload();
}
