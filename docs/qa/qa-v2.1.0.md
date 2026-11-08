# V2.1.0 独立验收报告（数据热更新 + AI 问答 + 固定端口）

- 验收人：qa-verifier（独立验收，未参与开发）
- 时间：2026-11-05 18:40–19:35（UTC+8）
- 对象：`<repo>\dist\wangzhe-jiaoyanshi-v2.1.0.apk`（根目录副本 `<repo>\王者教研室-v2.1.0-联网版.apk`，两者同哈希）
- 方法：只读；**唯一写入文件为本报告**；证据在 `%TEMP%\qa-v210\{setup,e2e}.json`、`embedded-helpers.js`、`yaml-check.json`。浏览器等价环境：APK `res/raw/site.zip` 解压后用 `python -m http.server 8775` 服务，`tools/mock_pages.mjs`（`pipeline/out/publish`，8774）模拟 GitHub Pages CORS + OpenAI 兼容接口 + `/bad/v1` 篡改路由；Edge headless 390×844；`window.AppBridge` 桩模拟 Java 桥（aiChat 走真实 fetch → `__aiReply`）。
- 证据链：`res/raw/site.zip`（4,892,070 B）解出 274 文件，与 `next/dist`、APK `assets/site` **三方逐字节全等**，因此 E2E 覆盖的就是 APK 实际内置网页。
- 基线：V2.0.3 纯本地版（已交付）；本轮新增 A 数据热更新、B AI 问答、C 固定端口 17653~17664。

## 一、结论

**PASS —— V2.1.0 可交付，可覆盖安装旧版。**
- **严重问题 0**；未发现装不上/白屏/崩溃/数据丢失类问题；任务列出的核心链路全部独立复现通过：**自动更新到 2026.11.05.1、哈希篡改被拒且已装数据不变、恢复内置回 2.0.3、AI 问答（Mock 接口）回复、无配置提示、固定端口逻辑、G1 返回键、全量回归、0 console error / 0 外部请求**。
- 一般缺陷 **0**；建议项 8 条（见第三节），均为加固/文档/文案级别。

## 二、逐项 PASS/FAIL

### 1) APK 静态

| 项 | 结果 | 证据 |
|---|---|---|
| size/SHA256 | **PASS** | size=**9,942,431 B**；SHA256=**D08A176A01429B5DB1D24E6E045895CC949700AFA462731C87A4AC9C585767C7**（自算，与 lead 一致）；根目录副本同哈希 |
| ZIP | PASS | **296 条目 / 296 唯一 / testzip=None**；`zipalign -c -p 4` exit 0 |
| 签名 | PASS | apksigner（min23~max34）：**v1/v2/v3 全 true**；证书 SHA-256 `a2bcaa5a1bb99fb2d5c46e49b856af805b46767273f7f9011569444efb3eac91`（同旧版，可覆盖） |
| badging | PASS | `com.wangzhe.jiaoyanshi` / **versionCode=6 / versionName=2.1.0** / label **王者教研室** / minSdk **23** / targetSdk **34** / 仅 INTERNET 权限 |
| manifest | PASS | provider `.ShareProvider`（`com.wangzhe.jiaoyanshi.share`，exported=false，grantUriPermissions=true）；`android:networkSecurityConfig=@res/xml/network_security_config.xml`（base 禁明文，仅放行 127.0.0.1/localhost）；`usesCleartextTraffic=false` |
| res/raw | PASS | `res/raw/site.zip` 存在（4,892,070 B）；`res/xml/network_security_config.xml` 在包内 |
| assets | PASS | `assets/site` 274 文件，与 `next/dist` **274/274 逐字节全等**（0 缺/0 多/0 diff） |
| DEX | PASS | 含 `aiChat`、`__aiReply`、`readStreamText`、`HTTP_PORT_START`、`cleanupShareDir`、`saveAndShareImage`、`ShareProvider`；源码审查确认 `HTTP_PORT_START=17653`、`HTTP_PORT_TRIES=12`（17653–17664，失败才退回随机端口） |
| web bundle | PASS | JS 内含 `wzjs.runtimeData`、`wzjs.dataBase`、`__checkForUpdates`、`哈希校验失败`、`恢复内置数据`、AI/数据更新设置文案；index.html 含「bundle 前从 localStorage 恢复 `__RUNTIME_DATA__`」与主题/字号预置内联脚本 |

### 2) 数据热更新 E2E（重点，独立复现）

前置：localStorage 设 `wzjs.dataBase=http://127.0.0.1:8774/wzjs/v1/`、`wzjs.aiConfig`，清 `wzjs.runtime*` 后 reload。

| 场景 | 结果 | 证据 |
|---|---|---|
| 启动自动检查→更新→整页 reload | **PASS** | `wzjs.runtimeManifest.dataVersion=2026.11.05.1`；`wzjs.runtimeData.version=2026.11.05.1`（长度 165,905 字符）；`publishedAt=2026-11-05T18:37:43+0800`；`lastUpdateCheck` 已写入；页面自动 reload 后生效 |
| 首页标识 | PASS | 首页出现「王者教研室 **V2.1.0** ...」版本 pill（`V2.1.0` 文本可见） |
| 更多页 | PASS | 文本含「V2.1.0 · 数据 **2026.11.05.1**」 |
| 设置→数据与更新 | PASS | 同时命中：`2026.11.05.1`、数据来源「**联网更新**」、`本版公告：11月5日版本更新公告`（manifest.patch.title 经 UTF-8 校验为「11月5日版本更新公告」）、`更新日志（10 条）`；展开更新日志后可看到本版英雄/装备调整明细（patches.json changes=10，页面渲染多条改动） |
| 哈希篡改被拒 | **PASS** | 切到 `…/bad/v1/` 后 `window.__checkForUpdates({manual:true})` 返回 `{status:"error", message:"下载数据失败：数据哈希校验失败（可能被篡改或上传不完整）"}`；已装 `wzjs.runtimeManifest` 仍为 2026.11.05.1（**数据版本未被篡改覆盖**） |
| 恢复内置 | **PASS** | 清 `wzjs.runtimeData/runtimeManifest/runtimePatches/lastUpdateCheck` + 清空 dataBase → reload → 设置页显示「当前数据版本 **2.0.3**、数据来源 **APK 内置**、本版公告消失、无联网更新痕迹」 |
| manifest/数据格式校验（源码） | PASS | `checkForUpdates` 校验 `dataVersion/files["data.json"]`、`heroes` 非空、JSON 解析失败/HTTP 失败/离线均返回 error 且**不改动已装数据**；仅 `JSON.parse`，无 eval/脚本执行 |
| 6h 节流 | PASS（源码） | `UPDATE_INTERVAL_MS=6h`；非 manual 且 lastCheck 在 6h 内且有 runtimeManifest → `throttled`；启动 1.8s 后自动检查 |

### 3) AI 问答 E2E（Mock OpenAI 兼容接口）

| 场景 | 结果 | 证据 |
|---|---|---|
| 更多→AI 问答页面 | PASS | 页面标题「AI LAB · AI 问答」、建议 chip、「问版本/问英雄/问反制」引导、数据版本 2.0.3 展示 |
| 配置后发送 | **PASS** | 点建议 chip（推荐阵容类）+「发送」→ 页面出现 **`【Mock AI】我收到了你的问题：…`** 回复；AppBridge 桩记录 `aiChat(id, endpoint, key, body)` 被调用 1 次：endpoint=`http://127.0.0.1:8774/ai/v1/chat/completions`、`hasKey=true`、bodyLen=1088（**Java 桥路径真实走通**） |
| 未配置时 | **PASS** | 清空/关闭 aiConfig 后：页面显示「**AI 问答还没开启** · 需要你自己的 OpenAI 兼容接口（如 DeepSeek / Kimi / 通义）· 去设置里填写接口」，输入框占位「请先在设置里配置 AI 接口」 |
| 错误处理 | PASS | 前端 90s 超时与后端 15s/90s 超时对齐；接口返回非 2xx → `__aiReply(id,false,"接口返回 HTTP …")`；空回复 → 「AI 返回内容为空」；无 console error |

### 4) Java / 安全审查

| 项 | 结果 | 证据 |
|---|---|---|
| aiChat 前置校验 | PASS | 仅 `isLocalUrl(webView.getUrl())`（本地 HTTP origin 或 appassets fallback origin）页面可调用；endpoint 必须 `http(s)://` 开头，否则直接错误回调 |
| Key 处理 | PASS | 仅放在 `Authorization: Bearer <key>` 请求头；**无任何日志打印**；Key 不进入数据包/不放宽 CSP；仅存本机 localStorage |
| 超时/线程 | PASS | connect 15000ms、read 90000ms；独立线程 `wzjs-ai`；`finally` 中 disconnect；异常 → 错误回调（`网络请求失败：…`） |
| 回调安全 | PASS | 仅 `window.__aiReply` 且参数经 `JSONObject.quote()` 转义后 `evaluateJavascript`；无任意代码注入 |
| 网络策略 | PASS | `network_security_config`：全局禁明文、只放行 127.0.0.1/localhost（本地静态服务所需）；生产 AI 接口须 https，符合设计 |
| 数据更新安全 | PASS | manifest/数据均为 JSON 解析 + `crypto.subtle` SHA-256 校验后才写入 localStorage；无 eval/动态脚本；`ls.set` 失败返回「本地存储空间不足，无法保存更新」；`restoreBuiltin` 仅删 4 个 runtime key，不动收藏/设置 |
| 分享/返回键（沿用 V2.0.1） | PASS | `saveAndShareImage` 前缀+16MB 校验、cache 清理保留 20/7 天、provider 路径穿越防护；onBackPressed 优先 `__appBack||__studyBack`；helper 只在无 handler 时安装 fallback |

### 5) 回归 + G1

| 项 | 结果 | 证据 |
|---|---|---|
| 5 Tab | PASS | 首页/英雄/BP/出装/更多 均渲染（内容各不同） |
| BP 综合推测 | PASS | 连打 5 个 Ban→「识别填入」→ 5/5 +「综合推测」 |
| 出装分享 bridge | PASS | 选英雄→分享→bridge 收到 `data:image/png;base64,iV…`，长度 **2,066,138**，文件名 `wzjs-1793875475298-wzpe.png` |
| 主题/字号 | PASS | 纸感→`data-theme=light`；字号「大」→`--fs-scale=1.08` |
| G1 冷启动弹层返回键 | **PASS** | 注入 APK 内嵌 helper（4097 B，Java==tools==dex 三方一致）：`__studyBack` 未被覆盖、`__appBack` 为 function、首页返回 false；冷启动打开英雄详情后 `(__appBack||__studyBack)()`=true 且弹层关闭（before=true → after=false） |
| 网络/错误 | PASS | 全程 398 个请求：**0 外部请求**（全部 127.0.0.1:8774/8775）、0 HTTP≥400、**0 console error / 0 pageerror** |

### 6) 管线 / 文档 sanity

| 项 | 结果 | 证据 |
|---|---|---|
| 发布包版本 | PASS | `pipeline/out/publish/manifest.json`：`dataVersion=2026.11.05.1`、`minAppVersion=2.0.3`、patch.title=「11月5日版本更新公告」、patch.id=812092 |
| sha256 一致 | PASS | data.json（282,035 B）sha256=manifest 值 ✓；patches.json（2,941 B）sha256=manifest 值 ✓；patches.changes=10 |
| YAML | PASS | `update-data.yml` 结构解析成功：top keys `name/on/permissions/jobs`，jobs=[update]，8 steps（checkout/setup-python/Playwright/fetch/detect/render/extract/publish/commit 流程齐全）✅（环境无 PyYAML，使用自带无依赖子集解析器验证结构，未跳过） |
| 文档一致性 | PASS（有可优化点） | 根 README 正确记录最终 size=9,942,431、SHA256=D08A176A…、vc6/2.1.0，并明确「AI 需用户自备 Key、Key 只存本机、请求由 Java 直连」「数据源需自建 GitHub Pages（pipeline/github-pages/README 含建仓/开 Pages/填地址步骤）」；`docs/ONLINE_UPDATE_ARCHITECTURE.md §13` 已记录 V2.1.0 实际实现。§1/§8 是早期「服务端网关」方案论证，与最终直连实现口径不同（见建议 S6） |

## 三、缺陷清单

### 【严重】无
### 【一般】无

### 【建议】
- **S1. `minAppVersion` / `schemaVersion` 未强制校验**：manifest 有这两个字段，但 `checkForUpdates` 未据此拒绝低版本 App 的更新包。当前 data 兼容，无实际影响；建议补校验（App < minAppVersion 时提示升级 App，不应用数据）。
- **S2. SHA-256 校验存在“静默跳过”分支**：`sha256Hex()` 在 `crypto.subtle` 不可用时返回 null，此时 `if (spec.sha256 && hex && …)` 会跳过哈希比对直接应用更新（依赖 HTTPS 传输安全兜底）。App 页面 origin 为 `http://127.0.0.1`（Chromium 视为可信源，`crypto.subtle` 可用，本次篡改测试已实证生效），实际风险低；建议改为「无法计算哈希则拒绝更新」。
- **S3. 更新写 localStorage 非事务**：先写 runtimeData 再写 runtimeManifest；若 manifest 写入因 quota 失败（data 已写成功），会出现“数据已是新版、版本号显示旧版”的错位。建议先写 manifest 或失败时回滚 runtimeData。
- **S4. `aiChat` 响应体无大小上限**：`readStreamText` 全量读入内存再回传；恶意/异常接口可返回超大响应造成内存压力。建议加最大读取字节数（如 4MB）并截断报错。
- **S5. AI endpoint 无主机/协议白名单以外的限制**：任意 http(s) 地址可配（含内网/局域网），且 HttpURLConnection 默认跟随重定向。属“用户自填接口”的固有灵活性，建议在设置页加一句提示（仅填可信接口，勿填内网地址）。
- **S6. 架构文档口径可优化**：`docs/ONLINE_UPDATE_ARCHITECTURE.md` 头部仍写「适用 V2.0.3 纯本地架构」，§1/§8 论证的是「App 不直连、Key 只在网关」，而 §13 记录的实际 V2.1.0 是「App 直连 + 用户自备 Key 存本机」。建议在 §1/§8 加“最终实现见 §13”的交叉引用并更新头部版本，避免误读（无夸大：README 与 App 设置页文案均明确需用户自备 Key）。
- **S7. 固定端口回退随机端口的副作用可提示**：12 个端口全被占用时退回随机端口，当次 origin 变化会导致收藏/设置/已更新数据“看起来丢失”（下次拿到固定端口又会恢复）。建议该场景 Toast 提示用户。
- **S8. 启动 Toast 文案**：`onCreate` Toast 仍为「王者教研室 V2.1.0 · 纯本地版」，而本版已含联网热更新/AI（README 写作“联网版”）。仅文案，建议改「本地内置 + 联网增强」。

## 四、残余风险

1. **无真机/模拟器**：Java 本地 HTTP 服务（17653 固定端口）、WebView localStorage origin 持久化、AppBridge.aiChat 真实网络与 TLS（network_security_config 阻断非本地明文）、系统分享面板等未在 Android OS 实测；浏览器等价环境已覆盖前端逻辑与桥接契约（stub aiChat 走真实 fetch→`__aiReply`）。
2. **未真实部署 GitHub Pages**：用本地 mock 复现 CORS/静态托管/篡改路由；真实 Pages 的 CDN 缓存、跨域头、HTTPS 证书链未验证（GitHub Pages 默认满足 CORS `*` 与 HTTPS）。
3. **AI 依赖用户自备 Key**：Key 明文存 WebView localStorage（设置页已告知“只存本机”）；设备被 root/调试备份时可能泄露；不同厂商接口兼容性（OpenAI 兼容子集）需实测。
4. **本地 HTTP 服务**：仅绑 127.0.0.1、只读静态站点、路径穿越已封；同机其他 App 理论上可读该静态资源（不含 localStorage/Key），风险可接受。
5. **数据源信任模型**：数据仅做 SHA-256 完整性校验（manifest 自身未签名），若数据仓库被完全接管，可推任意合法 JSON 数据（不含脚本执行能力）；二期可加签名。
6. **架构文档/端口回退/版本号文案**：见 S6–S8，非功能阻塞。

## 五、未完成/跳过

- 未在 Android 真机安装运行（环境无设备）；APK 的 Java 侧 HTTP 服务/固定端口/桥接为源码审查 + 浏览器等价验证。
- 未真实部署 GitHub Pages/Actions（用 mock 服务器 + 结构解析替代）。
- 未逐页回归 133 英雄详情（抽样：英雄列表、HeroSheet、BP、出装分享、阵容/名师入口均通过）。

## 六、最终结论

**PASS，可交付。** V2.1.0 APK（size 9,942,431 B，SHA256 `D08A176A…67C7`，versionCode 6 / versionName 2.1.0，同签名）在静态、资源、热更新（成功/篡改拒绝/恢复内置）、AI 问答（桥接路径）、固定端口与持久化逻辑（源码）、安全加固、G1 与全量回归上均通过独立验证；0 console error / 0 外部请求；无严重/一般缺陷，8 条建议可在后续小版本或文档中处理。
