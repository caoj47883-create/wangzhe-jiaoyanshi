import { hero } from "./data.js";

/* ------------------------------------------------------------------ canvas 分享图生成 */
const CACHE = new Map();

function loadImg(url) {
  if (CACHE.has(url)) return CACHE.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  CACHE.set(url, p);
  return p;
}

const W = 1080;
const H = 1440;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const chars = String(text || "").split("");
  let line = "";
  let lines = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = ch;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

/**
 * 生成分享图。
 * @param {{kind:'comp'|'build'|'hero', title:string, subtitle?:string, heroNames?:string[],
 *          tags?:string[], lines?:{label:string,text:string}[]}} data
 * @returns {Promise<string>} dataURL (image/png)
 */
export async function renderShareImage(data) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 背景
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d1118");
  bg.addColorStop(0.5, "#0a0d13");
  bg.addColorStop(1, "#14100b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.15, 0, 40, W * 0.15, 0, W * 0.9);
  glow.addColorStop(0, "rgba(211,166,89,0.2)");
  glow.addColorStop(1, "rgba(211,166,89,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 顶部品牌
  ctx.fillStyle = "#d3a659";
  ctx.font = "700 26px 'Space Mono', monospace";
  ctx.fillText("COUNTER-PICK LAB · 王者教研室", 72, 96);
  ctx.fillStyle = "rgba(243,239,230,0.42)";
  ctx.font = "400 22px 'Space Mono', monospace";
  ctx.fillText(`S12 · ${data.kind === "comp" ? "FIVE-MAN COMP" : data.kind === "build" ? "ITEM BUILD" : "HERO"}`, 72, 136);

  // 主标题
  ctx.fillStyle = "#f3efe6";
  ctx.font = "900 74px 'Noto Serif SC', 'Songti SC', serif";
  wrapText(ctx, data.title, 72, 250, W - 144, 88, 2);

  if (data.subtitle) {
    ctx.fillStyle = "rgba(211,166,89,0.85)";
    ctx.font = "700 30px 'Noto Sans SC', sans-serif";
    wrapText(ctx, data.subtitle, 72, 360, W - 144, 42, 2);
  }

  // 英雄头像行
  const names = (data.heroNames || []).filter(Boolean).slice(0, 5);
  if (names.length) {
    const size = 150;
    const gap = 26;
    const totalW = names.length * size + (names.length - 1) * gap;
    let x = (W - totalW) / 2;
    const y = 470;
    for (const n of names) {
      const h = hero(n);
      const img = h.id ? await loadImg(`/avatar/${h.id}.webp`) : null;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      if (img) {
        ctx.drawImage(img, x, y, size, size);
      } else {
        ctx.fillStyle = "#1c2633";
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(211,166,89,0.55)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#e9e2d4";
      ctx.font = "600 26px 'Noto Sans SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n, x + size / 2, y + size + 46);
      ctx.textAlign = "left";
      x += size + gap;
    }
  }

  // 花纹分隔
  const lineY = names.length ? 700 : 470;
  ctx.strokeStyle = "rgba(211,166,89,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, lineY);
  ctx.lineTo(W - 72, lineY);
  ctx.stroke();

  // 内容行
  let y = lineY + 74;
  for (const line of data.lines || []) {
    ctx.fillStyle = "rgba(211,166,89,0.9)";
    ctx.font = "700 26px 'Space Mono', monospace";
    ctx.fillText(line.label, 72, y);
    ctx.fillStyle = "rgba(233,226,212,0.86)";
    ctx.font = "400 30px 'Noto Sans SC', 'PingFang SC', sans-serif";
    y = wrapTextReturn(ctx, line.text, 72, y + 44, W - 144, 44, 3) + 54;
    if (y > H - 140) break;
  }

  // 底部
  ctx.fillStyle = "rgba(243,239,230,0.35)";
  ctx.font = "400 24px 'Space Mono', monospace";
  ctx.fillText("数据来自公开资料整理 · 仅供学习参考", 72, H - 64);

  return canvas.toDataURL("image/png");
}

function wrapTextReturn(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text || "").split("");
  let line = "";
  let lines = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = ch;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

/** 分享/保存图片：优先走 Android 原生 bridge，否则浏览器下载 */
export function shareImageDataUrl(dataUrl, filename = "wzjs-share.png") {
  const bridge = typeof window !== "undefined" ? window.AppBridge : null;
  if (bridge && typeof bridge.saveAndShareImage === "function") {
    try {
      bridge.saveAndShareImage(dataUrl, filename);
      return true;
    } catch (e) {
      /* fall through */
    }
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
  return false;
}

export async function shareImage(data) {
  const url = await renderShareImage(data);
  const rand = Math.random().toString(36).slice(2, 6);
  return shareImageDataUrl(url, `wzjs-${Date.now()}-${rand}.png`);
}

// 调试/验收用：在控制台可直接生成分享图预览
if (typeof window !== "undefined") {
  window.__renderShareImage = renderShareImage;
}
