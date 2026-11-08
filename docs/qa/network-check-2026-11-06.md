# 网络恢复后核查报告（2026-11-06 16:15）

对象：
- 数据仓库 `caoj47883-create/wzjs-data`（本地 `D:\wzjs-data`）
- 线上数据 `https://caoj47883-create.github.io/wzjs-data/wzjs/v1/`
- 应用仓库文档 `<repo>\pipeline\github-pages\`

## 一、结论

**仓库本身、线上数据、GitHub Pages、Actions、README 全部正常；本地 git 已在代理辅助下同步到最新。**
唯一异常是**本机直连 `github.com:443` 仍不通**（不是仓库问题）：`api.github.com`、`codeload.github.com` 可直连，`github.com` 与 `raw.githubusercontent.com` 需要走本机 Clash 代理 `127.0.0.1:7897`。
本次用代理完成了 `git fetch` / 同步 / `git push --dry-run` 预检，未修改全局 git 配置。

## 二、仓库核查

| 项 | 结果 |
| --- | --- |
| 本地 HEAD / origin/main | `8102dcf` / `8102dcf`，**已同步**，工作区干净 |
| 最新提交 | `8102dcf` docs: add README；`47646e4` data: 2026-11-06 patch 812092；`ae2e996` workflow 模板同步；`ae85a98` 修复数据/采集源 |
| README | 数据仓库 `README.md` 存在，10,239 B，raw 可访问（HTTP 200）；本地 clone 已同步该文件 |
| workflow | `update-data.yml` 含 `workflow_dispatch` 的 `tid` / `force` 输入；守卫/版本逻辑正常 |
| 采集源 | `fetch_sources.py` 已改为 CMC 公告接口优先（`chanid=1762`），静态页仅兜底 |
| 临时文件 | 远端无 `oneoff-llm-reextract.yml` / `reextract.trigger` 等临时文件 |
| 仓库属性 | public、Pages 已开启、默认分支 main、最近推送 `2026-11-05T18:21:17Z` |

## 三、线上数据核查

- `dataVersion = 2026.11.06.103`
- `patch = 812092`「11月5日版本更新公告」· patchDate `2026-11-04` · `minAppVersion = 2.1.0`
- `data.json` 282,037 B，sha256 与 manifest **一致** ✔
- `patches.json` 21,721 B，sha256 与 manifest **一致** ✔
- `patches.changes = 25` 条，`llm._model = deepseek-chat`（LLM 重抽版本）
- CORS `Access-Control-Allow-Origin: *`，`Cache-Control: max-age=600`（App 用 `_t` 破缓存）

## 四、定时任务 / 新鲜度核查

- 最近两次 scheduled `wzjs-data-update`：`2026-11-05T23:39Z`、`2026-11-06T06:52Z`，
  **均 completed/success**；期间没有产生新的数据提交，说明它们检测到「最新 tid 812092 = 已发布 812092」后按守卫逻辑跳过（正常，不是失败）。
- 官方 CMC 公告接口当前最新仍是「11月5日版本更新公告 tid=812092」（截至 11/6 16:20 无更新公告），
  即没有漏发；等官方发新公告后，下一次 cron 会自动抓取并发布。

## 五、网络核查

| 目标 | 直连 | 走 Clash 127.0.0.1:7897 |
| --- | --- | --- |
| `github.com` (git/https) | ❌ TCP 443 超时（20.205.243.166） | ✅ HTTP 200 |
| `raw.githubusercontent.com` | ❌ curl 000 | ✅ 301/200 |
| `api.github.com` | ✅ HTTP 200 | ✅ |
| `codeload.github.com` | ✅ 301 | ✅ |
| `git fetch` / `git push --dry-run` | ❌ | ✅（本次已用代理完成 fetch 与同步） |

建议让 git 走代理（三选一）：

```powershell
# 1) 只给 github.com 配 git 代理（推荐）
git config --global http.https://github.com.proxy http://127.0.0.1:7897
git config --global https.https://github.com.proxy http://127.0.0.1:7897

# 2) 或者在 Clash Verge 开启「TUN 模式 / 系统代理」，让系统级生效

# 3) 或者每次命令临时带环境变量
$env:HTTPS_PROXY='http://127.0.0.1:7897'; git fetch origin
```

> 本次核查没有改动全局 git 配置；如需我直接帮你写入全局代理配置，说一声。

## 六、当前状态

- 线上数据：`2026.11.06.103`（11月5日公告，25 条 LLM 更新日志）——最新
- 本地数据仓库：与远端一致（`8102dcf`），README、workflow、pipeline 均为最新
- App：V2.1.0，数据源填 `https://caoj47883-create.github.io/wzjs-data/wzjs/v1/` 即可
- 下次更新：官方新公告发布后，最多 6 小时自动生效；急用可手动 dispatch `tid=新公告id&force=true`
