# 最终版哈希复核报告（3ADF5352…，V2.0.1 版本文案修正后）

- 验收人：qa-verifier（独立复核）
- 时间：2026-11-04 20:32–20:38（UTC+8）
- 对象：`<repo>\dist\wangzhe-jiaoyanshi-v2.0.1.apk`
- 方法：只读；**唯一写入文件为本报告**；证据 `%TEMP%\qa-final\{audit,final-web}.json`、`settings-version.png`；APK 解压 assets 起 `http://127.0.0.1:8770` 供 Edge 加载。
- 前置：旧 hash `49609E27…` 已作废，本报告只针对最终 hash `3ADF5352…`。

## 一、结论

**PASS —— 最终版可交付。** 真实文件 size/SHA256 与 lead 提供完全一致；仅 `data.json` 版本字符串改动引起的重构建未引入任何异常；S1 版本文案已修正为 **V2.0.1**；G1 冷启动返回键、BP 综合推测、0 console/0 external 均通过。

## 二、逐项复核

| 项 | 结果 | 证据 |
|---|---|---|
| 文件哈希 | **PASS** | size=**5,031,189 B**；SHA256=**3ADF53522166CABEEB5EC1FD6C7D473E921E9A57E51F0B68992C7C73A2C8B36D**（自算，与 lead 一致）；根目录副本 `<repo>\王者教研室-v2.0.1.apk` 同 size/同 SHA256（已同步，无旧 hash 残留） |
| ZIP | PASS | 294 条目、294 唯一、`testzip()=None` |
| 对齐 | PASS | `zipalign -c -p 4` exit 0 |
| 签名/可覆盖 | PASS | apksigner（min23~max34）：**v1/v2/v3 全 true**；证书 SHA-256 `a2bcaa5a1bb99fb2d5c46e49b856af805b46767273f7f9011569444efb3eac91`（与 V2.0.0/V1 相同，可覆盖安装） |
| badging | PASS | `com.wangzhe.jiaoyanshi`、**versionCode=3 / versionName=2.0.1**、label **王者教研室**、minSdk **23** / targetSdk **34**、仅 INTERNET 权限 |
| provider | PASS | `.ShareProvider`、`com.wangzhe.jiaoyanshi.share`、`exported=false`、`grantUriPermissions=true` |
| assets 文件数/一致性 | PASS | `assets/site` **274 文件 / 5,304,269 B**；与 `next/dist` 274 文件 **缺失 0 / 多余 0 / SHA256 差异 0** |
| 内容残留 | PASS | 条目名扫描 Kimi/sdk-seed/statics.kimi → 0 命中；无旧 mockup/heroimg |
| 版本字符串（S1 修复） | PASS | 打包 JS 含 `"2.0.1"`（`Hp="2.0.1"`，快照 2026-11-04），**不含 `"2.0.0"`**；浏览器实测「更多」页顶栏 `王者教研室 **V2.0.1** · 数据快照 2026-11-04`；「设置」页关于区同样显示 **V2.0.1**、无 V2.0.0 |
| helper 三方一致 | PASS | tools/page-helpers.js == Java 字面量 == 新 APK classes.dex 字符串池：**4025 B / SHA256 0c2560e8…**（byte-equal） |
| G1 冷启动返回键 | PASS | 从**新 APK dex** 提取内嵌 helper 后按真实 onPageFinished 顺序注入：`__studyBack` 函数未被覆盖、`__appBack` 为 function、首页调用 false；冷启动打开 HeroSheet → `(__appBack||__studyBack)()`=**true** 且弹层消失（before=true → after=false） |
| BP 回归 | PASS | 连打 5 个 Ban→「识别填入」→ 5/5 + 出现「**综合推测**」 |
| 网络/错误 | PASS | 119 个请求全部本地（**0 external**）、HTTP≥400=0、**console error=0、pageerror=0** |

## 三、缺陷 / 备注

- **【严重】无；【一般】无新增。**
- **备注（不影响交付）**：`next/package.json` 的 `version` 仍显示 2.0.0（该文件不参与 APK 打包，APK 内版本由 `data.json` 驱动，实际显示 2.0.1 正确）。如需源码侧整洁可下次顺手同步，无需重新打包。
- 继承项（本轮未改，沿用 V2.0.1 验收结论）：分享图 PNG ~2MB 体量、无真机验证 ACTION_SEND 真实分享面板/真实硬件返回键。

## 四、最终结论

**最终 APK（size=5,031,189 B，SHA256=`3ADF53522166CABEEB5EC1FD6C7D473E921E9A57E51F0B68992C7C73A2C8B36D`，versionCode 3 / versionName 2.0.1）通过极速复核：静态/签名/assets 与上一版一致（仅版本文案修正），V2.0.1 文案显示正确，G1 修复仍有效，无回归、无新增安全/功能问题 —— PASS，可交付（可覆盖安装 V2.0.0/V1）。**
