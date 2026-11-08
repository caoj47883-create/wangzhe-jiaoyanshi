// 应用级配置（构建期常量 + localStorage 键名）
export const APP_VERSION = "2.2.0";

export const LS_KEYS = {
  dataBase: "wzjs.dataBase", // GitHub Pages 数据源根地址
  runtimeData: "wzjs.runtimeData", // 已下载的数据包（JSON 字符串）
  runtimeManifest: "wzjs.runtimeManifest", // 已下载的 manifest
  runtimePatches: "wzjs.runtimePatches", // 公告抽取结果（更新日志）
  lastCheck: "wzjs.lastUpdateCheck",
  ai: "wzjs.aiConfig",
  aiChat: "wzjs.aiChatHistory",
};

// 默认数据源为空：在「设置 → 数据与更新」里填入你的 GitHub Pages 地址后启用。
// 示例：https://yourname.github.io/wzjs-data/wzjs/v1/
export const DEFAULT_DATA_BASE = "";

export const DATA_BASE_EXAMPLE = "https://<用户名>.github.io/wzjs-data/wzjs/v1/";

export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 自动检查间隔 6 小时

export const AI_DEFAULT = {
  enabled: false,
  endpoint: "https://api.deepseek.com/v1/chat/completions",
  model: "deepseek-chat",
  key: "",
  temperature: 0.4,
};
