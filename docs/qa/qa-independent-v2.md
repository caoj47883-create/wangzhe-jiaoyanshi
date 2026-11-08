# V2.0 APK 独立验收报告（暗夜战术 UI 改版 + 分享图/设置/收藏）

- 验收人：qa-verifier（独立验收，未参与 V2 开发）
- 时间：2026-11-04 20:08–20:45（UTC+8）
- 对象：`<repo>\dist\wangzhe-jiaoyanshi-v2.0.0.apk`
  - size = **5,031,191 B**；SHA256 = **3C9A06AF6F2AC630856B0576AEBF5A70A0DF027797F59221D564C043418C5D34**（与 lead 提供一致，已自行复核）
- 方法：只读。**唯一写入文件为本报告**；未修改源码/APK。证据：`%TEMP%\qa-v2\{assets-audit,e2e,e2e-focused,e2e-bpcarry}.json`、`server 127.0.0.1:8768`（从 APK 提取的 assets/site，非工程 site-local）。
- 环境：Windows 10；无 Android 设备/模拟器；Edge 156 headless 390×844 DPR2；`window.AppBridge` 桩记录 `saveAndShareImage`/`openExternal`。
- 证据链说明：APK 内 `assets/site` 与 `next/dist` **274 个文件逐字节全等**（0 缺失/0 多余/0 差异），因此「在解压出的 APK assets 上跑通」等价于 APK 运行内容；V1 的 `site-local/` 已不再参与 V2 打包（未使用旧 8765 服务）。

## 一、结论

**PASS（V2.0 可交付，可覆盖安装覆盖 V1）。** 没有会导致「装不上/白屏/崩溃/分享崩溃/数据丢失」的【严重】问题。
发现 **一般缺陷 1 项**（新引入的硬件返回键冷启动弹层失效）、**建议 6 项**。

> 关键已知问题（非阻塞，已确认可复现）：**冷启动后第一次打开的弹层（如英雄详情 HeroSheet、英雄选择器），按硬件返回键不会关闭弹层**，会走「再按一次退出」提示；一旦进入过任意子页面（导航栈变化后）返回键恢复正常。根因是 V2 新增的 `App.jsx` 自定义 `window.__studyBack` 被 shell 在 `onPageFinished` 注入的旧版 helper 覆盖（详见缺陷 G1）。弹层自带「关闭」按钮，不影响功能可用性；建议 V2.0.1 修掉。

## 二、检查项与结果

### 1) APK 静态

| 项 | 结果 | 证据 |
|---|---|---|
| ZIP 完整性 | PASS | Python zipfile：**294 条目**、294 唯一、`testzip()=None` |
| 对齐 | PASS | `zipalign -c -p 4` exit 0；`resources.arsc` stored（未压缩） |
| 签名/可覆盖升级 | PASS | `apksigner verify`（min23~max34）：**v1/v2/v3 全 true**；证书 SHA-256 `a2bcaa5a1bb99fb2d5c46e49b856af805b46767273f7f9011569444efb3eac91`、SHA-1 `7e48ccac…` 与 V1 **完全相同** → 可覆盖安装 |
| badging | PASS | `com.wangzhe.jiaoyanshi`、**versionCode=2 / versionName=2.0.0**、minSdk **23** / targetSdk **34**、label **王者教研室**、仅 INTERNET 权限、非 debuggable |
| Manifest provider | PASS | `aapt2 xmltree`：`<provider android:name=".ShareProvider" android:exported="false" android:authorities="com.wangzhe.jiaoyanshi.share" android:grantUriPermissions="true">`；组件类 `com.wangzhe.jiaoyanshi.ShareProvider` 存在于 dex |
| DEX 新符号 | PASS | `dexdump`：`ShareProvider`、`MainActivity$AppBridge.saveAndShareImage`、`handleDoubleBackExit`、`isWebViewTooOld`、`plainResponse(4参)`、`__studyBack`（Java 注入 JS 串）均存在；`classes.dex` 20,400B 与 `build/dex` 同哈希 `8adadd44…` |

### 2) assets 审计

| 项 | 结果 | 证据 |
|---|---|---|
| 文件数/体积 | PASS | `assets/site` **274 文件 / 5,304,118 B（≈5.06MB）**：`assets/` 2、`avatar/` **133**、`heroart/` **130**、`fonts/` **7**、根 `index.html`+`favicon.png` |
| 与 Vite 产物一致 | PASS | `next/dist` 274 文件 vs APK 274：缺失 0、多余 0、SHA256 差异 0 |
| 必需文件 | PASS | `index.html`、`assets/index-CRjcsIu0.js`（529,059B）、`assets/style-x8cI-c_n.css`（48,828B）、`favicon.png` 全在；heroart 130（3 个新英雄缺原画由前端兜底）、avatar 133、fonts 7（serif0-4 + mono-5/6） |
| 旧版/mockup 残留 | PASS | 无 `heroimg/`、无 V1 JS/CSS、无 `mockup*`/psd/fig；`public/mockup` 未进包 |
| Kimi/外部依赖 | PASS | 全文本扫描 `sdk-seed`/`statics.kimi`/`kimi.com`/`kimi.ai`/`game.gtimg.cn`/`fonts.googleapis`/`gstatic` → **0 命中**；无外部请求 |
| 构建产物语法 | PASS | 打包 JS 经 `vite build target=es2019`：可选链 `?.`=0、`??`=0、`?.=`/`||=`=0、`.at(`=0、`structuredClone`=0 → Chrome 87 可解析 |
| index.html | PASS | `<html data-theme="dark">`、内联主题/字号首屏预置脚本（防闪烁）、`/assets/...` 绝对路径（appassets.local 根域成立） |

### 3) Web 包运行验证（Edge headless 390×844，AppBridge 桩）

| 项 | 结果 | 证据 |
|---|---|---|
| 首屏 | PASS | title=王者教研室；h1 font=`"Noto Serif SC",…`；`document.fonts.status=loaded`（Noto 10 face）；33 张 heroart/avatar 全部 `naturalWidth>0`、0 broken；主题 dark；localStorage 默认状态正确 |
| 5 Tab | PASS | 首页/英雄/BP/出装/更多 全部渲染（各有实际内容）；图片 0 broken、0 external |
| BP 流程 | PASS | 连打输入「东皇太一、张良、海月、老夫子、宫本武藏」→「识别填入」→ **5/5 Ban、推测 12 条、出现「综合推测 · 至少 2 个 BAN 指向」**（公孙离/六耳/关羽/敖隐/裴擒虎/镜/马超，含"这些 Ban 在为它清掉天敌"解释）→「禁用完毕，进入选将」→ 选将阶段录入敌方公孙离 → 按分路出现 **4 条反制推荐**（六耳/裴擒虎/赵云/镜，含克制理由）→ CTA「用这套进游戏 · 一键出装」存在（<2 名敌方时按设计弹提示"至少录入 2 个敌方英雄"） |
| 出装 | PASS | 英雄选择器可打开（80 个头像可点）；选中公孙离后渲染 **基础出装 6/6 件**（急速战靴/闪电匕首/无尽战刃/破晓/泣血之刃/名刀）、**针对性装备**、**铭文推荐**（4 页）、**实战提示**；"分享出装图" → bridge 收到 `data:image/png;base64,…`，**长度 2,066,138**（>100KB）、filename `wzjs-…png` |
| GP→出装数据带入 | **部分验证** | 一键出装在 ≥2 敌方时才放行（代码有 gating）；本次自动化只成功录入 1 名敌方（第 2 次选择器交互未成功），故「BP 阵容带入出装页」未完成端到端验证。已确认：选择器/推荐/CTA 均正常、无异常报错。属**未完成项**，非 FAIL |
| 阵容 | PASS | 五黑阵容 30 张卡片；首张自动展开显示 **思路 / 弱点 / 推荐 BAN 位 / 五人分路**；「分享这套阵容」→ bridge 收到 PNG dataURL **长度 2,244,894** |
| 名师 | PASS | 名师课堂 51 位、平台筛选；点「去主页」→ bridge 收到 `https://www.douyin.com/search/张大仙?type=user`（openExternal 正确） |
| 设置-主题 | PASS | 点「纸感」→ `data-theme="light"`、body 背景 `rgb(244,239,229)`，localStorage theme=light；可切回暗夜 |
| 设置-字号 | PASS | 字号「小/标准/大」；点「大」→ `--fs-scale=1.08`、body 17.28px、localStorage fontScale=1.08 持久化 |
| 收藏/最近 | PASS | 英雄详情（云缨）点「收藏」→ localStorage `favorites:["云缨"]`、`recents:[{type:"hero",name:"云缨"}]`；「更多→我的收藏」页显示「云缨 打野 · T0.5」、收藏 1 / 最近浏览 1 |
| `__studyBack` | **部分 FAIL** | 首页返回 false ✓；进入子页（更多→设置）后返回 true 且回到「更多」页 ✓；**冷启动后首次打开 HeroSheet 弹层：返回 false 且弹层仍在 ✗**（详见 G1） |
| 网络/错误 | PASS | 339 个请求全部本地（0 external）、HTTP≥400 = 0；console error = 0、pageerror = 0、图片 0 broken |

### 4) 源码审查

| 项 | 结果 | 证据/说明 |
|---|---|---|
| `share.js` canvas 分享 | PASS | 1080×1440 canvas；`loadImg` 均取同源 `/avatar/*.webp`（同源无 CORS taint，e2e 实际 toDataURL 成功亦证明）；图片加载失败降级为色块；`toDataURL('image/png')`；失败走 `<a download>` 兜底 |
| 分享落盘/Intent | PASS | `doSaveAndShare`：dataURL 逗号分割→`Base64.decode`→写 `cacheDir/share/<sanitized>.png`→`content://…share/share/…` + `ACTION_SEND image/png` + `EXTRA_STREAM` + **FLAG_GRANT_READ_URI_PERMISSION** + chooser；异常 Toast 兜底 |
| ShareProvider 安全 | PASS | 路径仅取 `/share/<name>` 且拒绝 `..`、`/`、`\`（路径穿越已封）；`openFile` 强制 `MODE_READ_ONLY`；`exported=false`、`grantUriPermissions=true`（仅授权目标可读）；文件仅来自 app 私有 cache/share；`getType` 默认 image/png |
| JS bridge 守卫 | PASS | `openExternal` / `saveAndShareImage` 均校验 `webView!=null && isLocalUrl(webView.getUrl())`，远程兜底页无法滥用 |
| `App.jsx` 返回键 | **FAIL（G1）** | 89-108 行用 `window.__studyBack`（closers→stack→false），但 shell 在 `onPageFinished` 用旧 helper 覆盖同名函数；helper 只认文本 `‹/←/</〈/《`，V2 新 UI 的返回按钮是无文本 icon（`aria-label="返回"`），故 helper 版本恒 false；Closers 仅在 stack.length 变化时重新注册 → 冷启动弹层失效 |
| `store.js` | PASS | localStorage 读写均 try/catch（隐私模式/quota 不崩）；状态白名单字段持久化 |
| XSS | PASS | 仅 `icons.jsx` 使用 `dangerouslySetInnerHTML`（来源为源码内静态 SVG path 常量，非用户输入）；文案均由 React 转义；无 `eval`/`new Function`/`fetch`/`XHR`/`innerHTML` 用户数据 |
| Hooks/内存 | PASS（未见严重） | 未发现明显 hooks 依赖错误；`useEffect` 清理/`registerCloser` 注销成对；分享图 CACHE 为 Map 常驻（最多 133 头像 + 少量，可接受） |
| 绝对路径 base=/ | PASS | `vite base="/"` + appassets.local 根域：e2e 从站点根提供服务，`/assets/...`、`/avatar/...`、`/heroart/...`、`/fonts/...` 全部命中（与 APK 拦截 `site`+path 映射一致） |

### 5) 兼容性

| 项 | 结果 | 说明 |
|---|---|---|
| minSdk 23 API | PASS | V2 新增 Java：ContentProvider/ParcelFileDescriptor/Base64/FileOutputStream/Intent.createChooser/FLAG_GRANT_READ_URI_PERMISSION 均为 API 1；V1 已有的 SDK_INT 守卫（26/29）与 87 版本门槛保留；未引入 >23 无守卫 API |
| JS 语法（Chrome≥87） | PASS | 产物 target es2019，无 `?.`/`??`/ES2020+ 语法（见 2)） |
| CSS 能力 | 部分（建议） | 产物 CSS 含 `color-mix()` 9 处、`inset` 15 处、`backdrop-filter` 5 处、无 `dvh`；`inset`/`backdrop-filter` ≥Chrome 87 可用，但 `color-mix()` 需 Chrome 111+——启动门槛 87 时 87–110 设备会丢弃这些声明（视觉轻微退化，不白屏/不崩）。见建议 D2 |
| canvas.toDataURL | PASS | e2e 实际生成 2MB PNG 并经 bridge 回传成功 |

## 三、缺陷清单

### 【严重】无
未发现导致装不上/白屏/崩溃/分享崩溃/数据丢失的问题。

### 【一般】

**G1. V2 冷启动后首次弹层，硬件返回键失效（新引入回归）**
- 现象：冷启动 → 「英雄」Tab → 点英雄打开 HeroSheet（或 BP/出装页打开英雄选择器）→ 按硬件返回，`window.__studyBack()` 返回 **false**，弹层不关闭，改为「再按一次退出」提示。经过任意一次子页导航后恢复正常（e2e：更多→设置后 `__studyBack()`=true 并回到更多页）。
- 根因：① `next/src/App.jsx:89-108` 在 `useEffect`（依赖 `[stack.length, back]`）中定义 `window.__studyBack`（先关 closers 再退栈）；② shell 在 `onPageFinished` 注入的 `PAGE_HELPERS_JS`（MainActivity.java:302-379）**无条件覆盖**同名 `window.__studyBack`，其实现只找可见按钮文本 `‹/←/</〈/《`；③ V2 新 UI 的返回按钮是 `<button className="icon-btn back" aria-label="返回">`（无文本符号），helper 恒返回 false；④ Tab 切换 `goTab` 不改变 `stack.length`，App effect 不会重新注册 → 冷启动窗口期内弹层返回键失效。
- 修法（任一）：a) shell helper 改为 `if (typeof window.__studyBack !== 'function') { /* 安装旧 fallback */ }` 不覆盖 App 版本；b) App 改名为 `window.__appBack`，Java 调用 `(window.__appBack||window.__studyBack)`；c) helper 的 findBackButton 增加 `[aria-label="返回"],[aria-label="关闭"]` 选择器（可立即缓解，但仍属双实现竞态）。
- 影响：不阻塞交付（弹层有「关闭」按钮；短暂窗口后恢复），但属真实 UX 回归，建议 V2.0.1 修复。

### 【建议】

- **D1. 分享图缓存无清理**：`doSaveAndShare` 每次写 `cacheDir/share/*.png`（本次单张约 2.0–2.2MB），从不删除旧文件。长期分享会累积（系统可能自愿清 cache，但应用无主动策略）。建议启动/分享时保留最近 N 张或清理 >7 天文件。
- **D2. WebView 版本门槛与 CSS 能力不匹配**：启动门槛 87，但 `color-mix()` 需 Chrome 111+（9 处）。建议把门槛提到 111，或为 color-mix 属性加 `@supports` 回退（87–110 不会崩，仅个别颜色/半透明效果退化）。
- **D3. 分享 dataURL 无大小/前缀校验**：`saveAndShareImage` 只校验本地页 + 逗号后 Base64；未限制长度、未校验 `data:image/png` 前缀；1080×1440 PNG 的 base64 约 2.7MB，低内存机型 `Base64.decode` 理论上可能 OOM（`catch (Exception)` 捕获不到 Error）。建议加长度上限（如 ≤8MB）与前缀校验。
- **D4. 分享文件名可预测**：前端用 `wzjs-${Date.now()}.png`，同毫秒重复分享会覆盖同名文件（影响极小）。
- **D5. 内置 `window.__renderShareImage` 调试钩子**（share.js:207-209）随生产包发布，无实际风险，可仅 dev 构建保留。
- **D6. `next/mockup-shots`、`next/shots`、`next/design` 等设计/截图目录仍在工程内**：不参与 assets 打包（已确认），但建议归档以免误打包（V2 包内已确认 0 残留）。

## 四、残余风险

1. **无 Android 真机/模拟器**：`ShareProvider` 的 URI 授权 → `ACTION_SEND` 系统分享面板、真实硬件返回键、WebView canvas 内存行为等未在 Android OS 实测；e2e 用 bridge 桩证明前端数据正确（PNG dataURL >2MB、filename .png），原生落盘/分享为静态审查 + 与既有 V1 相同的可靠模式。建议真机冒烟：分享出装/阵容到微信或相册、点开分享图预览、返回键关闭弹层（含冷启动弹层）、浅色主题下截图观感。
2. **分享图体量**：2MB+/张，分享到部分 IM 可能被压缩或较慢；可考虑 JPEG 或降低画布分辨率（非缺陷）。
3. **WebView 87–110 的视觉退化**（D2）；**最小支持 Android 6 设备上整体仍是“提示升级”策略**（沿用 V1 版本门槛页）。
4. **Play 上架/版权**：targetSdk 34 低于 Play 当前目标 API 门槛、需 AAB；英雄原画/主播资料版权归腾讯等，仅建议个人侧载使用（沿用 V1 结论，未变）。
5. **冷启动窗口期的返回键语义**（G1）可能被用户感知为“返回键有时不灵”，建议尽快出 V2.0.1。

## 五、未完成 / 跳过项

- **BP→出装数据带入端到端**：受「≥2 名敌方已选」gating 与自动化选择器交互限制，未完整走通；已验证选择器可打开/选人、反制推荐 4 条、CTA 与提示文案均正常，未发现异常（非 FAIL，列为未完成）。
- 未在真实 Android 设备安装/运行（环境限制）。
- 未覆盖全部 133 英雄详情页逐页渲染（抽样：英雄列表 37 图全加载、HeroSheet 云缨详情/收藏正常）。
- 未做长时压力/内存测试（分享图 Map 缓存、30 阵容滚动）。

## 六、结论与交付建议

- **V2.0 APK（SHA256 `3C9A06AF…C5D34`）静态合规、assets 与 Vite 产物逐字节一致、5 Tab / BP / 出装 / 阵容 / 名师 / 设置 / 收藏 / 分享 bridge 主流程均通过，无严重问题，可交付侧载安装并覆盖 V1（同签名）。**
- 唯一一般缺陷 **G1（冷启动弹层硬件返回键失效）** 建议 V2.0.1 修复；D1/D2/D3 建议下轮顺手处理。
