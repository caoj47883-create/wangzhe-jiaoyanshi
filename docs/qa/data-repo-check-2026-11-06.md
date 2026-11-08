# 数据仓库检查报告（2026-11-06）

对象：`https://github.com/caoj47883-create/wzjs-data`（本地克隆 `D:\wzjs-data`）
方式：只读检查 + 修复管线与数据后发布（推送 2 个提交）、用真实 GitHub Pages 做 App 端到端验证。

## 一、发现的问题

### 1)【严重】线上数据停留在 10 月 29 日，不是最新版本
- 检查时线上 `manifest.json`：`dataVersion=2026.11.06.3`，但 `patch.id=811767`（10月29日版本更新公告）、`data.snapshot=2026-10-29`。
- 实际最新公告是 **11月5日版本更新公告（tid=812092，发布时间 2026-11-04 17:36）**；App 用户拿不到 11/5 的敖隐/艾琳/雅典娜等调整，时效性失效。
- 历史里还发生过一次「11/5 数据被 10/29 数据覆盖」的回归（提交 `0bd2b89`），后来虽然加了 tid 守卫（`06d9361`），但守卫只能防止继续降级，救不回已经过期的数据。

**根因（两个叠加）**：
1. 官网静态新闻页 `pvp.qq.com/web201706/newsindex.shtml` 被 CDN 缓存到旧版本（实测 `Last-Modified: Wed, 28 Oct 2026`，页面里最新公告只到 10 月底）；
2. 旧版 `pipeline/fetch_sources.py` 是「先解析静态页、失败才用 CMC 接口」，且 CMC 接口频道号写成了 `1770`（不是公告频道）。于是 CI 每次拿到 10/29 作为「最新」，守卫又会跳过所有 tid 更小的公告 → 数据冻结在 10/29。

### 2)【一般】CI 缺少手动补发/强制修正入口
- `workflow_dispatch` 没有输入参数，检测逻辑卡住时只能改代码/等官网恢复，不能人工指定公告 tid 重新发布。

### 3)【一般】`minAppVersion` 与热更新能力不匹配
- 旧 manifest `minAppVersion=2.0.3`，但联网热更新/设置页是 V2.1.0 才有的能力。

### 4)【建议】发布/换行一致性、旧版本堆积
- 仓库已加 `.gitattributes * -text`（正确，避免换行转换破坏 sha256）；但 Windows 本地跑管线会写入 CRLF，产生无意义 diff（本次修正提交时已还原 3 个旧 release 的换行噪音）。
- 历史 release（含 10/29 过期数据）仍保留在 `wzjs/v1/releases/`；当前 manifest 不引用它们，不影响 App，仅仓库体积略大。

## 二、已做的修复（已推送到仓库）

提交 1 `ae85a98`：
- `pipeline/fetch_sources.py`：
  - 公告源改为**官方 CMC 接口优先**（`serviceId=18`，公告频道 `chanid=1762`，带官网签名），静态页解析只作兜底（并标注「可能滞后」）；
  - 实测接口返回最新：`812092 11月5日版本更新公告 2026-11-04 17:36:24`。
- `.github/workflows/update-data.yml`：
  - `workflow_dispatch` 新增 `tid`（指定公告）与 `force`（允许重发/修正）输入；
  - `patch.date` 改用公告实际发布时间（不再用 runner 当天日期）；
  - `--min-app-version 2.1.0`；
  - 保留 tid 递增守卫 + 版本号防回退逻辑。
- **重新发布正确数据** `2026.11.06.4`：
  - patch = 812092「11月5日版本更新公告」，patch.date = 2026-11-04，data.snapshot = 2026-11-04；
  - data.json 282,035 B / sha256 `da207701…`；patches.json 5,253 B / sha256 `ee978718…`；
  - manifest 内 sha256 与线上文件逐字节复核通过。

提交 2 `ae2e996`：同步仓库内 `pipeline/github-pages/update-data.yml` 模板，保持与 workflow 一致。

## 三、验证结果（真实 GitHub Pages，非 mock）

线上（`https://caoj47883-create.github.io/wzjs-data/wzjs/v1/`）：
- `manifest.json`：`dataVersion=2026.11.06.4`、`patch.id=812092`、`patch.date=2026-11-04`、`minAppVersion=2.1.0`；
- `Access-Control-Allow-Origin: *`，`Cache-Control: max-age=600`（App 端带 `_t` 破缓存，正常）；
- data.json / patches.json 线上字节 sha256 均与 manifest 一致。

用 V2.1.0 的 APK 内置网页（`res/raw/site.zip` 解出）做真实端到端：
- localStorage 数据源填线上地址 → 启动自动检查 → 下载并校验通过 → 整页 reload；
- 更多页：`V2.1.0 · 数据 2026.11.06.4`；
- 设置页：当前数据版本 `2026.11.06.4`、快照 `2026-11-04`、数据来源「联网更新」、本版公告「11月5日版本更新公告」、更新日志 10 条；
- 0 console error、0 外部请求（仅 127.0.0.1 本地服务 + caoj47883-create.github.io）。

## 四、后续建议

1. **以后让 CI 发布**（Linux runner，天然 LF），少在 Windows 本地 publish，避免 CRLF diff。
2. 想让 11/5 更新日志更详细（LLM 抽取约 34 条而不是规则 10 条）：在 GitHub Actions 页面手动跑一次 `wzjs-data-update`，`tid=812092`、`force=true`（仓库已配置 `LLM_API_KEY` secrets 的话）。版本号会自动 ≥ 当前。
3. 历史 release 目录可保留（回滚用）；若想瘦身，可只保留最近 3 个版本。
4. 后续新公告：每 6 小时自动检测；若某天检测没动，先看 Actions 日志里 `via CMC api` 行是否报错（接口 token/参数变更时），必要时用 `tid + force` 手动补发。
5. 官网静态页会滞后属于正常现象；现在已改成接口优先，不建议再依赖页面解析作为主路径。

---

## 五、LLM 重抽（2026-11-06 02:14，已执行）

- 触发方式：通过 GitHub Actions 手动 dispatch `wzjs-data-update`（`tid=812092`、`force=true`，运行 ID 42082327784，全部步骤 success，耗时约 1 分钟）。
- 结果：发布新版本 **2026.11.06.103**（patch 812092 / 11月5日版本更新公告 / 快照 2026-11-04 / minApp 2.1.0），Actions 已提交并部署（远端 commit `47646e4`，message `data: 2026-11-06 patch 812092`）。
- 抽取质量：`patches.json` 从规则抽取 10 条 → **LLM（deepseek-chat）抽取 25 条**，每条带 `field / direction / impact` 字段，例：
  - 敖隐「一技能基础伤害 270~540(+0.7额外Ad) → 200~400(+0.6额外Ad)」，direction=nerf，impact=「一技能伤害降低」。
- 线上校验：data.json 282,037 B / patches.json 21,721 B，sha256 与 manifest 一致；`Access-Control-Allow-Origin: *`。
- App 端到端（真实 Pages）：自动更新到 2026.11.06.103；设置页显示 11月5日公告、快照 2026-11-04、**更新日志（25 条）**；0 console error、0 外部请求。
- 注意：本地克隆 `D:\wzjs-data` 仍停在 `ae2e996`（当前网络到 github.com 的 git 通道被阻断，fetch 失败）；远端已由 Actions 更新。网络恢复后执行 `git fetch && git reset --hard origin/main` 同步即可。
