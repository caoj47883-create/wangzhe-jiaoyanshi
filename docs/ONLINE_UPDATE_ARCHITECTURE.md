# 王者教研室 · 数据时效性方案（联网 API + RAG 定时更新）

> 版本：2026-11-05 · 适用 V2.1.0（纯本地 + GitHub Pages 热更新 + AI 问答）。**最终实现见 §13**；§1/§8 保留的是「服务端网关」方案论证，与最终「App 直连 + 用户自备 Key」不同。
> 目标：保留纯本地的启动速度与离线可用性，同时让**英雄调整、装备改动、版本机制、梯度/克制数据**在赛季中持续更新。

---

## 0. 一句话结论

**手机端只做"拉取 + 校验 + 热切换"，不做大模型调用。**
"联网 + RAG" 放在**服务端/CI 的定时管线**里：官方公告与数据源 → RAG 抽取 → 结构化校验 → 人工审核 → 发布成带版本号的 JSON 包 → App 启动时增量拉取、验签后原子替换。

```
┌────────────────────────── 服务端 / CI（每天或版本日触发） ──────────────────────────┐
│                                                                                    │
│  官方数据源                         RAG 管线                        发布物            │
│  ├ 英雄列表 herolist.json  ─┐      ┌─────────────────────┐      ┌────────────────┐  │
│  ├ 装备列表 item.json      ─┼────► │ 采集/清洗 → 切片向量化│ ───► │ data.json       │  │
│  ├ 版本更新公告（列表+正文）─┤      │ 检索 → LLM 结构化抽取 │      │ patches.json    │  │
│  └ 英雄技能/机制页（可选）  ─┘      │ 校验 → 人工审核 → 发布│      │ manifest.json   │  │
│                                    └─────────────────────┘      │ +sha256/签名    │  │
│                                                                  └───────┬────────┘  │
└──────────────────────────────────────────────────────────────────────────┼───────────┘
                                                                           │ HTTPS
┌────────────────────────────── 手机端（纯本地架构保留） ───────────────────▼───────────┐
│  V2.0.3 已有：res/raw/site.zip → files/site → 127.0.0.1 本地 HTTP → WebView             │
│  新增：files/data/<ver>/  ← 校验通过的数据包（本地 HTTP 路由 /data/** 提供）             │
│        UpdateManager（Java）：启动/每日检查 manifest → 下载 → 验签 → 原子切换 → 刷新 UI   │
│  兜底：无网/校验失败/服务器挂了 → 继续使用内置快照，功能完全可用                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 为什么不让 App 直接调大模型 API？
> 注：本节是早期方案论证（自建网关、Key 不上手机）。V2.1.0 实际实现为「App 内 Java 桥直连用户自备的 OpenAI 兼容接口」（见 §13），未自建网关；如后续要多人共享 Key/限流，再按本节升级为网关方案。


| 方案 | 问题 |
| --- | --- |
| App 内嵌 LLM Key 直连 | Key 必然泄露（APK 可反编译）；不同用户设备/网络导致超时、失败；无法控制成本；生成内容每次不一样，数据不可复现 |
| 每次启动现算数据 | 慢（秒级~分钟级）、耗电、费流量；离线即废；输出不符合 JSON Schema 时 UI 崩溃 |
| 本地小模型 | 手机端算力/包体不现实（几 GB 模型），且中文游戏数值理解质量差 |
| **服务端 RAG + App 拉 JSON**（推荐） | 一次生成、全员复用；可校验、可审核、可回滚；App 端零大模型依赖，保持纯本地体验 |

> AI 问答（"这版本 X 英雄怎么玩"）可以作为**可选功能**后加：App 调你自己的网关 → 网关做 RAG + 限流 + 缓存，Key 只在服务器。

---

## 2. 数据分层：哪些要联网更新？

| 层 | 内容 | 更新频率 | 谁产生 |
| --- | --- | --- | --- |
| **基础数据** | 英雄 ID/名称/分路/定位、装备 ID/名称/价格/属性 | 新英雄/新装备时 | 官方 JSON 自动同步 |
| **版本数据** | 版本号、公告日期、英雄/装备/机制改动明细（from→to） | 每次公告 | RAG 抽取 + 审核 |
| **策略数据**（你的核心资产） | 梯度 T0~T3、克制关系、出装/铭文、阵容思路、名师内容 | 改动后重算 | 规则引擎 + RAG 生成建议 + 人工校准 |
| **文案/解读** | "为什么这样改""这版本怎么应对" | 随版本 | RAG 基于公告生成，标注来源 |
| **公告原文** | 更新公告全文（供 App 内"版本日志"展示、AI 问答检索） | 每次公告 | 采集 + 渲染 |

App 包内保留一份**内置快照**（当前 V2.0.3 的 data.json），联网数据只覆盖变化部分或整包替换，永远可回滚。

---

## 3. 官方数据源（已实测，2026-11-05）

| 数据 | 接口/页面 | 现状 |
| --- | --- | --- |
| 英雄列表 | `https://pvp.qq.com/web201605/js/herolist.json` | ✅ 200，133 个英雄，字段：ename/cname/title/hero_type/roles/skin_name |
| 装备列表 | `https://pvp.qq.com/web201605/js/item.json` | ✅ 200，115 件装备，字段：item_id/item_name/item_type/price/des1 |
| 公告列表 | `https://apps.game.qq.com/cmc/cross?serviceId=18&filter=channel&sortby=sIdxTime&source=web_pc&limit=12&logic=or&typeids=1,2&chanid=1770&start=0&withtop=yes&exclusiveChannel=4&exclusiveChannelSign=<md5>&time=<ts>` | ✅ 200，`exclusiveChannelSign = md5(token + source + "18" + timestamp)`，token 见官网 `newsindex.js`；也可直接解析 `https://pvp.qq.com/web201706/newsindex.shtml` 的静态列表 |
| 公告正文 | 详情页 `https://pvp.qq.com/web201706/newsdetail.shtml?G_Biz=18&tid=<tid>` | ⚠️ 正文由 `fillnewsgicp` JS 渲染，**需无头浏览器**（已实测可完整渲染出"英雄调整/装备调整/共鸣调整"明细）或逆向其内容接口 |
| 英雄机制/数值 | 英雄详情页 `https://pvp.qq.com/web201605/herodetail/<id>.shtml` | 可选，用于 RAG 知识库（技能描述、数值） |
| 营地/KPL 数据 | 第三方 | 可选补充，注意合规与频率 |

**时效性判断**：每 10 分钟~1 小时轮询公告列表即可（列表轻量）；发现新 `tid` 才触发正文渲染 + RAG 流程，成本可控。

---

## 4. 更新协议（App ⇄ 服务端）

### 4.1 发布目录结构（静态文件，放对象存储/CDN）

```
https://data.example.com/wzjs/v1/
├── manifest.json                 # 入口：版本、文件清单、哈希、签名
├── releases/
│   └── 2026.11.05.1/
│       ├── data.json             # 完整数据包（英雄/装备/梯度/克制/阵容/机制）
│       ├── patches.json          # 版本改动明细 + 公告原文 + 来源
│       └── release.json          # 发布说明（日期、摘要、审核人）
└── latest.json → 同 manifest.json（可选，便于 CDN 缓存）
```

### 4.2 manifest.json 示例

```json
{
  "schemaVersion": 1,
  "dataVersion": "2026.11.05.1",
  "engineVersion": "1.0.0",
  "minAppVersion": "2.0.3",
  "publishedAt": "2026-11-05T10:30:00+08:00",
  "patch": {
    "id": "812092",
    "title": "11月5日版本更新公告",
    "date": "2026-11-04",
    "sourceUrl": "https://pvp.qq.com/web201706/newsdetail.shtml?G_Biz=18&tid=812092"
  },
  "files": {
    "data.json":    { "sha256": "…", "size": 289000, "url": "releases/2026.11.05.1/data.json" },
    "patches.json": { "sha256": "…", "size": 41000,  "url": "releases/2026.11.05.1/patches.json" }
  },
  "signature": {
    "alg": "RSA-SHA256",
    "keyId": "wzjs-data-v1",
    "value": "base64…"
  }
}
```

### 4.3 App 更新流程

1. **启动后异步**（不阻塞首屏）：`GET manifest.json`（超时 5s，失败静默）。
2. 比较 `dataVersion` 与本地记录；相同 → 结束。
3. `minAppVersion > 当前` → 提示"需更新 App"，不更新数据。
4. 下载 `files` 中变化的文件（先 `data.json`，支持只下变更文件）。
5. 校验：`sha256` + 大小 + **RSA 验签**（公钥内置 APK，私钥仅在发布机）。
6. 写入 `files/data/<dataVersion>/` → 写 `current` 指针（原子 rename）→ 保留最近 3 个版本。
7. 通知页面：`webView.evaluateJavascript("window.__dataUpdated && window.__dataUpdated('2026.11.05.1')")`；页面重新 `fetch('/data/data.json')` 并刷新状态，无需重启。
8. 失败处理：保留旧数据；连续失败 3 次后 24h 内不再重试；设置页可手动"检查更新"。
9. 回滚：设置页"恢复内置数据"→ 删除 `current` 指针，重新用 APK 内置快照。

### 4.4 定时策略

| 触发 | 行为 |
| --- | --- |
| App 启动 | 若距上次检查 > 6 小时，异步检查 manifest |
| 前台恢复 | 距上次 > 24 小时检查 |
| 手动 | 设置 → 数据与更新 → 检查更新 |
| 服务端 | 公告轮询发现新 tid → 跑 RAG → 发布（见第 5 节） |

App 端不需要 WorkManager/定时唤醒（省电、免 AndroidX）：启动检查足够覆盖"用户打开 App 就看到最新"。

---

## 5. RAG 管线设计（服务端/CI）

### 5.1 流程图

```
[1] 采集             [2] 知识库              [3] 抽取                     [4] 校验/审核        [5] 发布
官方 JSON/公告 ──► 公告正文清洗 ──► 分块 ──► 向量化(可选) ──┐
                    英雄/装备机制文档 ──► 检索 top-k ──────────┤
                    历史版本 data.json ──► 变更实体定位 ───────┤
                                                               ▼
                                              LLM 结构化输出(JSON Schema)
                                                               │
                         ┌─────────────────────────────────────┤
                         ▼                                     ▼
                规则校验：白名单/数值/diff 上限          人工审核（PR / 审核页）
                         │                                     │
                         └──────────────► 合并生成新 data.json ◄┘
                                                               │
                                                    发布到 CDN + manifest 签名
```

### 5.2 每一步做法

**① 采集（Python，每天 cron）**
- 拉取 `herolist.json` / `item.json` → 与本地基础数据对比，发现新英雄/新装备直接告警+入库。
- 拉取公告列表，记录最新 `tid`；与 `state.json` 比对，有新公告才继续。
- 用无头浏览器（Playwright/Puppeteer）渲染公告正文，提取纯文本 + 结构（"英雄调整/装备调整/机制调整/问题修复"分节）。
- 保存原始快照到 `snapshots/2026-11-05/`，便于追溯与重跑。

**② 知识库（可选但推荐）**
- 文档集：本次+历史公告、英雄技能页文本、装备描述、你已有的 data.json 旧版本。
- 切片：按"英雄/装备/机制条目"切（每块 300~800 字），保留标题、版本号、来源 URL。
- 向量：`bge-m3`（本地）或 `text-embedding-3-small`（API）；存 SQLite+FAISS/Chroma（批量跑，无需托管向量库）。
- 检索目的：抽取时给 LLM 提供"这个英雄上版本是什么数值、机制是什么"，避免只根据一段公告瞎改。

**③ LLM 结构化抽取（核心）**
- 模型：DeepSeek / Kimi / Qwen，temperature 0.1~0.2，JSON Mode。
- Prompt 骨架：
  ```
  你是王者荣耀数据整理助手。以下是官方版本更新公告和该英雄/装备的历史数据。
  只提取公告中明确写出的改动，不要推测；每条改动必须给出原文引用（evidence）。
  输出严格 JSON（schema 见下），未提及的字段不要输出。
  ```
- 输出 Schema（示例）：
  ```json
  {
    "patchId": "812092",
    "date": "2026-11-04",
    "changes": [
      {
        "type": "hero|item|mechanic|system",
        "name": "敖隐",
        "scope": "技能/装备/机制",
        "field": "一技能基础伤害",
        "from": "270~540(+0.7额外Ad)",
        "to": "200~400(+0.6额外Ad)",
        "direction": "buff|nerf|adjust",
        "impact": "前期伤害下降，中后期Ad收益略降",
        "evidence": "一技能：基础伤害：270~540(+0.7额外Ad) → 200~400(+0.6额外Ad)",
        "sourceUrl": "https://pvp.qq.com/..."
      }
    ],
    "sections": { "英雄调整": ["敖隐", "艾琳"], "装备调整": [], "机制调整": [] }
  }
  ```

**④ 规则校验 + 策略数据重算（防止幻觉/数据崩坏）**
- 英雄/装备名必须在官方列表白名单内；数值格式与旧值可解析（支持范围、百分比、Ad/Ap 系数）。
- 每条改动必须有 `evidence` 原文引用（在公告正文中可检索到）。
- 变更数量上限：单次英雄改动 > 30 个时强制人工审核。
- 策略数据不是让 LLM 直接生成全部：用**规则引擎**基于改动推梯度/克制（例如"基础伤害↓ + 移速↓ → 对线强度下调半档"），LLM 只负责写"为什么/怎么应对"的解读文案。
- 输出 diff（`data.before.json` vs `data.after.json`），人工审核差异（review 页面或 GitHub PR）。
- 审核通过才允许发布；发布产物记录 `reviewBy`、`evidence` 链接。

**⑤ 发布（CI/脚本）**
- 版本号：`YYYY.MM.DD.N`（日期+当日序号）。
- 生成 `data.json` / `patches.json` / `release.json`；计算 sha256；私钥签名 manifest。
- 上传对象存储/CDN，CDN 刷新；App 下次启动自动更新。

### 5.3 定时调度方案（任选其一）

| 方案 | 成本 | 适合 |
| --- | --- | --- |
| **GitHub Actions cron** + GitHub Releases/Pages + jsDelivr | 免费 | MVP 首选；代码与数据都在仓库，PR 即审核 |
| 腾讯云函数 SCF（定时触发）+ COS + CDN | 几元/月 | 国内访问快、稳定；需备案域名（COS 默认域名可用但有限制） |
| 自建 VPS + cron + Nginx | 30~60 元/月 | 完全可控，可跑 Playwright |
| Cloudflare Workers + R2 | 免费额度高 | 海外访问好；国内速度一般 |

> 建议：**MVP 用 GitHub Actions（cron 每 6 小时）**；用户量起来后迁到腾讯云 COS+CDN。

---

## 6. App 端改造（基于 V2.0.3 纯本地架构）

### 6.1 数据文件从"打包进 JS"改为"运行时读取"

现状：`data.json` 被 Vite 打包进 JS，更新数据需重新发 APK。
改造：
- 把 `next/src/data/data.json` 从 `import` 改为运行时 `fetch('/data/data.json')`；
- 本地 HTTP 服务（已有）新增路由：
  - `/data/manifest.json` → 优先 `files/data/current/manifest.json`，否则内置 `files/site/data/manifest.json`
  - `/data/data.json` → 同理
  - `/data/patches.json` → 同理
- 页面启动先 `fetch('/data/data.json')`，失败则用内置兜底（`window.__DATA_FALLBACK__` 或再请求 `/data/builtin.json`）。

### 6.2 Java `UpdateManager`（新类，约 200~300 行）

```java
// 伪代码
void checkForUpdatesAsync(boolean manual) {
  if (!manual && now - lastCheck < 6h) return;
  Thread t = new Thread(() -> {
    try {
      ManifestDTO m = httpGetJson(API + "manifest.json");
      if (m.dataVersion.equals(currentVersion())) return;
      if (compareVersion(m.minAppVersion, appVersion()) > 0) { toast("请更新 App 以获取最新数据"); return; }
      for (FileSpec f : m.files) {
        byte[] data = httpGetBytes(API + f.url);
        if (sha256(data) != f.sha256) throw new IOException("hash mismatch");
        writeAtomic(filesDir + "/data/" + m.dataVersion + "/" + f.name, data);
      }
      if (!verifySignature(m)) throw new IOException("bad signature");
      writeCurrentPointer(m.dataVersion);   // 原子 rename
      runOnUiThread(() -> webView.evaluateJavascript("window.__dataUpdated && window.__dataUpdated('" + m.dataVersion + "')", null));
    } catch (Exception e) { log(e); if (manual) toast("检查更新失败：" + e.getMessage()); }
  }).start();
}
```

需要 `INTERNET` 权限（已有）+ 仅 HTTPS（`network_security_config` 保持明文禁止，只放行 127.0.0.1）。

### 6.3 JS bridge 新增接口

- `AppBridge.checkForUpdates()` → 手动检查
- `AppBridge.getUpdateState()` → 返回 `{currentVersion, lastCheck, status}`（设置页展示）
- `AppBridge.restoreBuiltinData()` → 删除 current 指针，回到内置快照

### 6.4 UI 改造（设置 → 数据与更新）

- 当前数据版本 + 公告日期 + "已是最新 / 有新版本"
- 「检查更新」按钮（失败显示原因）
- 「更新日志」：读 `patches.json`，展示本版本英雄/装备调整 + 来源链接
- 「恢复内置数据」兜底
- 首页数据角标可显示 `数据 2026.11.05`（替换现在写死的"数据快照 2026-11-04"）

### 6.5 签名与密钥

- 生成 RSA-2048 密钥对：`keytool -genkeypair ...` 或 `openssl genrsa`；
- 公钥放 App（`res/raw/data_pub.pem`），私钥只在发布机/CI Secret；
- 发布脚本用私钥对 `manifest.json` 规范化后的字节签名（RSA-SHA256）；
- App 用 `Signature.getInstance("SHA256withRSA")` 验签；验签失败一律拒绝更新。
- MVP 可先只做 SHA256 + HTTPS，二期加签名（迁移成本低）。

---

## 7. 服务端 API 设计（只读 + 可选管理）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/wzjs/v1/manifest.json` | 当前最新版本清单（CDN 缓存 5min，带 ETag） |
| GET | `/wzjs/v1/releases/<ver>/data.json` | 数据包（不可变，长缓存） |
| GET | `/wzjs/v1/releases/<ver>/patches.json` | 版本改动/公告摘要 |
| GET | `/wzjs/v1/health` | 健康检查 |
| POST | `/wzjs/v1/admin/publish` | 可选：审核后触发发布（token 鉴权） |
| POST | `/wzjs/v1/admin/refresh` | 可选：手动触发采集+RAG（token 鉴权） |

只读数据不需要登录；写接口用 Bearer token + IP 白名单 + 限流。

---

## 8. 可选功能：App 内 AI 问答（二期）
> 注：本节是早期方案论证（自建网关、Key 不上手机）。V2.1.0 实际实现为「App 内 Java 桥直连用户自备的 OpenAI 兼容接口」（见 §13），未自建网关；如后续要多人共享 Key/限流，再按本节升级为网关方案。


```
App → 你的网关(POST /ai/chat, 带 App 令牌) → 检索(向量库: 公告/机制/数据)
    → LLM(流式) → 返回；网关做限流/缓存/成本统计
```
- Key 只在网关；App 不接触模型厂商；
- 常见问题缓存（同问题 1 小时内复用）；
- 回答强制带来源（公告链接/数据版本），避免胡说；
- 成本估算：按 1 问 2k tokens、DeepSeek 价格约 0.001~0.003 元/问；每日限 20 问/用户。

---

## 9. 成本与周期估算（个人自用规模）

| 项 | 费用 | 说明 |
| --- | --- | --- |
| 数据托管 | 0~10 元/月 | GitHub 免费 / COS 几 GB 几毛钱 |
| 函数/CI | 0 元（Actions 免费额度）或 几元/月 | 每天跑几次 |
| LLM（RAG 抽取+文案） | 每次版本 0.2~1 元 | 只处理改动实体，不重算全量 |
| 总 | **≈0~15 元/月** | 不含 AI 问答流量 |

实现周期：
- **P0 数据热更新（手动发布）**：0.5~1 天 → 你以后改数据不用重发 APK。
- **P1 半自动 RAG**：2~3 天 → 公告抓取 + 抽取 + diff + 审核脚本。
- **P2 定时自动**：+1~2 天 → cron + 发布 + 通知。
- **P3 AI 问答（可选）**：+2~3 天 → 网关 + RAG + 限流。

---

## 10. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 官方接口/签名 token 变更 | 双通道：接口 + 解析官网静态页；失败告警；保留人工录入入口 |
| 公告正文前端渲染改版 | 无头浏览器选择器多套兜底；正文落快照，可人工补录 |
| LLM 幻觉/瞎改数值 | 强制 evidence 引用 + 白名单 + diff 上限 + 人工审核；数据发布可回滚 |
| 数据包把 App 搞崩 | App 端 schema 校验 + 版本不兼容拒收 + 保留 3 版本 + 内置兜底 |
| CDN/域名被墙或失效 | 多个下载源（主 CDN + 备用 raw URL）；失败静默用内置 |
| 审核成本高 | 只让 LLM 处理"有明确数值改动"的实体；解读文案可批量生成后抽查 |
| 合规 | 只抓公开公告，注明来源，控制频率；个人非商业用途；不转售官方内容 |

---

## 11. MVP 验收标准

1. 发布机执行 `pipeline/publish_release.py` 生成新版本目录 + manifest。
2. 上传到任意静态托管（GitHub Pages 即可）。
3. App 启动检测到新 `dataVersion`，下载、sha256 校验通过，设置页显示新版本号。
4. 断网启动 → 正常用内置数据；再联网启动 → 自动更新。
5. 首页显示"数据 2026.11.05"；更新日志能看到本版本英雄改动（含来源链接）。
6. 校验失败（篡改 manifest）→ App 拒绝更新，仍用旧数据。

---

## 12. 下一步（需要你拍板）

1. **托管选哪个？** GitHub Pages/Releases（免费最快）→ 还是 腾讯云 COS+CDN（国内稳）？
2. **公告正文采集**用无头浏览器（简单、稳）还是继续逆向官方内容接口（快、但可能变）？建议先用无头浏览器，接口作为备用。
3. **是否需要 App 内 AI 问答**（要额外网关+费用），还是先只做数据自动更新？
4. **数据源范围**：只抓官网公告，还是也接营地/KPL 数据（需处理第三方合规）？

确定后我可以直接落地 P0：数据运行时加载 + UpdateManager + 设置页更新 UI + 发布脚本，一天内给你可用的联网热更新版本。

---

## 13. 实施状态（2026-11-05，V2.1.0）

已落地（本仓库当前版本）：

| 能力 | 实现 | 入口 |
| --- | --- | --- |
| 数据热更新 | `next/src/lib/config.js`、`update.js`、`index.html` 内联恢复脚本、`data.js` 运行时数据优先 | 设置 → 数据与更新 |
| 发布管线 | `pipeline/fetch_sources.py`、`fetch_article.mjs` / `fetch_article_playwright.py`、`extract_patch.py`、`publish_release.py` | `pipeline/README.md` |
| GitHub Pages | `pipeline/github-pages/README.md`、`publish_to_pages.ps1`、`update-data.yml`（定时 Actions 模板） | 数据仓库 `wzjs/v1/` |
| AI 问答 | `next/src/lib/ai.js` + `pages/AiChat.jsx` + Java `AppBridge.aiChat` 直连外部 OpenAI 兼容接口 | 更多 → AI 问答；设置 → AI 问答 |
| 状态持久化 | 本地 HTTP 端口固定为 17653~17664（localStorage 按 origin 隔离，固定端口才能跨启动保留收藏/设置/热更新数据） | `MainActivity.startHttpServer` |

验证方式：浏览器等价环境 E2E 已通过（自动更新到 2026.11.05.1、sha256 校验、篡改哈希拒绝更新、恢复内置数据、AI mock 接口回复、0 console error / 0 external）。
仍需真机验证：Java 原生 AI 请求（含真实厂商接口）、真实 GitHub Pages 部署后的拉取、覆盖安装后的状态保留。

下一步操作：按 `pipeline/github-pages/README.md` 建数据仓库 → 手动发布一次 → App 设置里填地址验证 → 再启用 Actions 自动更新。
