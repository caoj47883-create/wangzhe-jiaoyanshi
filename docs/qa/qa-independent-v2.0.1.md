# V2.0.1 增量补验报告（G1 返回键修复 + 分享安全/清理 + WebView 111 门槛）

- 验收人：qa-verifier（独立验收）
- 时间：2026-11-04 20:15–20:30（UTC+8）
- 对象：`<repo>\dist\wangzhe-jiaoyanshi-v2.0.1.apk`
  - size = **5,031,189 B**；SHA256 = **49609E27EF190AD3AEFDC94FFB98ABADA14AD0C4AC81024F8409038C6BDDD8ED**（与 lead 提供一致，自行复核）
- 方法：只读。**唯一写入文件为本报告**；证据在 `%TEMP%\qa-v201\{audit,g1-test}.json`、`embedded-helpers.js`；从 APK 解压 assets 起 `http://127.0.0.1:8769` 供 Edge 加载（未用旧 site-local/8765）。
- 对照基线：V2.0.0（SHA256 3C9A06AF…，已验收 PASS，一般缺陷 G1 + 建议 D1/D2/D3/D4）。

## 一、结论

**PASS —— V2.0.1 可交付，可覆盖安装 V2.0.0/V1。** 严重问题 **0**；V2.0.0 遗留的 1 项一般缺陷 **G1 已修复并经独立复现**；D1/D2/D3/D4 四项建议均已按要求处理且验证通过；快速回归无新问题。
仅 1 项**建议**（非阻塞）：前端「关于/更多」页版本文案仍显示 **V2.0.0**（APK 已是 2.0.1，来源 `next/src/data/data.json` 的 `version` 未同步）。

## 二、修复项 PASS/FAIL

### 1) APK 静态（相对 V2.0.0 的增量）

| 项 | 结果 | 证据 |
|---|---|---|
| ZIP/对齐 | PASS | **294 条目**、294 唯一、`testzip()=None`；`zipalign -c -p 4` exit 0 |
| 版本 | PASS | `aapt2 badging`：`versionCode='3' versionName='2.0.1'`、package 不变、label **王者教研室**、minSdk **23** / targetSdk **34** |
| 签名/可覆盖 | PASS | apksigner（min23~max34）：**v1/v2/v3 全 true**；证书 SHA-256 `a2bcaa5a1bb99fb2d5c46e49b856af805b46767273f7f9011569444efb3eac91` 与 V2.0.0/V1 **相同** |
| provider | PASS | xmltree：`.ShareProvider`、`authorities=com.wangzhe.jiaoyanshi.share`、`exported=false`、`grantUriPermissions=true` |
| 新方法/字符串入 DEX | PASS | 新 dex 含 `cleanupShareDir`、`saveAndShareImage`、字符串 `"image too large"`、`"unsupported image format"`、`"data:image/png;base64,"`、`__appBack`；onBackPressed 注入串为 `var f=window.__appBack||window.__studyBack` |
| 内嵌 helper 三方一致 | PASS | `tools/page-helpers.js` == Java 字面量还原 == APK `classes.dex` 字符串池：**4025 B / SHA256 0c2560e8bd462d261bef88b37c8664a6eb8cab64c5c30735f6e5521f439de4d9**（三方 byte-equal）；含 `typeof window.__studyBack !== 'function'` 守卫与 `[aria-label="返回"/"关闭"]` 选择器 |

### 2) assets 审计

| 项 | 结果 | 证据 |
|---|---|---|
| 文件数/体积 | PASS | `assets/site` **274 文件 / 5,304,269 B**（heroart 130、avatar 133、fonts 7、index+ favicon、1 js + 1 css） |
| 与 Vite 产物一致 | PASS | 与 `next/dist` 274 文件：缺失 0 / 多余 0 / SHA256 差异 0 |
| 残留/外链 | PASS | 无 Kimi/sdk-seed/statics.kimi/kimi.com/kimi.ai/game.gtimg.cn/fonts.googleapis/gstatic 命中；无 heroimg/旧 V1、无 mockup |
| 语法 | PASS | 产物 JS `?.`=0、`??`=0、`.at(`=0（vite target es2019，Chrome 111 门槛内可解析） |

### 3) G1 重点：冷启动弹层返回键（独立复现）

用 **APK 内 Java 内嵌 PAGE_HELPERS_JS**（从 MainActivity.java 提取、与 dex/tools 三方一致的同一内容）模拟真实 `onPageFinished` 注入顺序，Edge 390×844：

| 场景 | 结果 | 证据 |
|---|---|---|
| 注入前后 handler 不被覆盖 | PASS | 注入前 `__appBack:function`、`__studyBack:function`（App handler 长度 152 chars）；注入后 `studyBackFuncUnchanged=true`（helper 的 `typeof window.__studyBack !== 'function'` 守卫生效，**不再覆盖**） |
| 首页返回 | PASS | `__appBack()`=false、`__studyBack()`=false（不消费，进入双击退出逻辑） |
| 冷启动（先注入 helper 再开弹层，真实顺序） | PASS | 英雄 Tab→打开 HeroSheet 后 `(__appBack||__studyBack)()`=**true**，600ms 后弹层消失（`sheetAfter=false`） |
| 迟注入（先开弹层再注入 helper，lead 同款模拟） | PASS | `ret=true`、`studyBackFuncUnchanged=true`、弹层消失 |
| 正常导航返回 | PASS | 更多→设置（导航栈深度 2）→ 调用后 =true，返回「更多」页（`isMore=true`） |
| helper 幂等 | PASS | 连续注入两次无副作用（`__studyHelpersInstalled` 守卫） |

### 4) 分享安全与清理（D1/D3/D4）

| 项 | 结果 | 证据 |
|---|---|---|
| D3 前缀校验 | PASS | `doSaveAndShare`：`dataUrl` 必须以 `"data:image/png;base64,"` 开头否则抛 `unsupported image format`；长度 > 16,000,000 拒绝（`image too large`）；异常 Toast 兜底 |
| D3 与前端格式匹配 | PASS | `share.js` 用 `canvas.toDataURL("image/png")`；浏览器实测 bridge 收到的前缀精确为 `data:image/png;base64,iV…`（匹配 Java 校验前缀），长度 2,066,138（<16MB） |
| D1 缓存清理 | PASS | 新增 `cleanupShareDir(dir, keep)`：按 `lastModified` 降序排序，**保留最近 20 张**、删除 **>7 天**旧图；`keep`（刚生成的新文件）显式跳过；调用点在写盘成功后、构造分享 URI 之前（`cleanupShareDir(dir, file)`），不会误删待分享文件 |
| D4 文件名防覆盖 | PASS | 前端实测 filename=`wzjs-1793794695757-gmv0.png`（`wzjs-{ts}-{rand}.png`）；Java 侧再做 `[^A-Za-z0-9._-]→_` 清洗并补 `.png` |
| provider 安全（沿用） | PASS | exported=false + grantUriPermissions=true、openFile 只读、路径穿越（`..`/`/`/`\`）拒绝、文件仅 app 私有 cache/share |

### 5) 其他修复

| 项 | 结果 | 证据 |
|---|---|---|
| D2 WebView 门槛 87→111 | PASS | `isWebViewTooOld()`：`Integer.parseInt(group) < 111`；UA 为 null/无 Chrome token 时不拦截（不会误伤正常设备）；门槛与 CSS `color-mix()`（需 Chrome 111+）一致 |

## 三、快速回归（APK 解压 assets + 内嵌 helper 注入）

| 项 | 结果 | 证据 |
|---|---|---|
| 5 Tab | PASS | 首页/英雄/BP/出装/更多 均渲染（内容非空） |
| BP 流程 | PASS | 连打 5 个 Ban →「识别填入」→ 5/5 且出现「**综合推测**」 |
| 出装+分享 | PASS | 选英雄后分享 → bridge 收到合法 PNG dataURL（2,066,138 chars、前缀匹配、文件名含随机串） |
| 阵容/名师 | PASS | 五黑阵容 30 卡；从阵容页返回键=**true** 且回到「更多」；名师外链桥沿用（V2.0.0 已验证） |
| 主题/字号 | PASS | 纸感→`data-theme=light`；字号「大」→`--fs-scale=1.08` |
| 网络/错误 | PASS | 340 个请求全部本地（0 external）；console error 0、pageerror 0 |

## 四、缺陷清单

### 【严重】无

### 【建议】
- **S1（新发现，非阻塞）版本文案不同步**：APK `versionName=2.0.1`，但前端「更多/设置」页显示 **V2.0.0**（`More.jsx:37`、`Settings.jsx:130/147` 读取 `next/src/data/data.json` 的 `version`；`next/package.json` 仍 2.0.0）。建议把 data.json/package.json 的 version 同步为 2.0.1 后重打包（仅文案，不影响功能/安装）。
- **S2（继承风险，非本轮引入）**：`saveAndShareImage` 的 `Base64.decode`/写盘发生在 UI 线程（runOnUiThread），2MB 图通常毫秒级无感；若未来画布更大可考虑工作线程。
- **S3（继承）**：分享图仍为 PNG ~2MB/张，部分 IM 会二次压缩、分享耗时略高（可接受）。

### 未完成项（与 V2.0.0 相同，非 FAIL）
- **BP→出装数据带入端到端**：仍受「≥2 名敌方已选」gating 与自动化交互限制未完整走通；本版未改动该链路（代码无变更），V2.0.0 已验证选择器/推荐/CTA 正常。
- 未在真实 Android 设备验证：ShareProvider URI 授权→`ACTION_SEND` 真实分享面板、真实硬件返回键、cache 清理跨天行为（均为静态审查 + 浏览器等价环境）。

## 五、残余风险

1. **无真机/模拟器**：G1 的 Java→JS 回调链在浏览器等价环境已验证，但真实 Android `evaluateJavascript` 回调时序、分享面板、直接卸载/覆盖升级安装未实测；建议真机冒烟：冷启动开英雄详情按返回（应关闭弹层）、首页双击返回退出、分享出装图到微信/相册、覆盖安装 V2.0.0→V2.0.1 保留数据。
2. **WebView 111 门槛**：低于 Chrome 111 的设备会看到「版本过低」引导页（符合 D2 决策）；Android 6/7 老设备基本都会被引导升级。
3. **Play 上架/版权**：targetSdk 34 低于 Play 当前门槛、需 AAB；英雄原画/主播资料版权属腾讯等，建议仅个人侧载（沿用结论）。
4. **版本文案 V2.0.0（S1）** 可能与用户认知的 2.0.1 不一致，建议下版同步。

## 六、最终结论

**V2.0.1（SHA256 `49609E27…DDD8ED`）通过独立补验：G1 修复有效（冷启动/迟注入弹层返回键均关闭、首页返回 false、不再覆盖 App handler），D1/D2/D3/D4 全部落实，静态/签名/assets/回归无回归问题；仅 1 项版本文案建议。可交付并覆盖安装。**
