#!/usr/bin/env bash
# 王者教研室 · Linux / macOS / GitHub Actions 构建脚本
#
# 前置：
#   - JDK 17（javac / java / jar 在 PATH 或 JAVA_HOME）
#   - Android SDK：build-tools 34.0.0 + platform android-34（ANDROID_HOME）
#   - 已执行 `cd next && pnpm install && pnpm build` 生成 next/dist
#   - 签名（可选）：app/keystore/wangzhe.jks，以及环境变量
#       ANDROID_KEY_ALIAS / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_PASSWORD
#     未提供签名时输出未签名 APK（仅用于测试）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
BUILD="$ROOT/build/ci"
DIST="$ROOT/dist"

: "${ANDROID_HOME:?请设置 ANDROID_HOME 指向 Android SDK}"
BT="${ANDROID_BUILD_TOOLS:-$ANDROID_HOME/build-tools/34.0.0}"
PLATFORM="${ANDROID_PLATFORM:-$ANDROID_HOME/platforms/android-34}"
ANDROID_JAR="$PLATFORM/android.jar"

for bin in "$BT/aapt2" "$BT/zipalign" "$BT/apksigner"; do
  [ -x "$bin" ] || { echo "缺少 $bin"; exit 2; }
done
[ -f "$ANDROID_JAR" ] || { echo "缺少 $ANDROID_JAR"; exit 2; }
[ -f "$ROOT/next/dist/index.html" ] || { echo "缺少 next/dist，请先执行 pnpm build"; exit 2; }

VERSION="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$APP/AndroidManifest.xml" | head -n1)"
VERSION="${VERSION:-dev}"
APK_NAME="wangzhe-jiaoyanshi-$VERSION"

rm -rf "$BUILD" "$DIST"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$APP/assets" "$APP/res/raw" "$DIST"

echo "==> 打包网页资源"
rm -rf "$APP/assets/site"
cp -r "$ROOT/next/dist" "$APP/assets/site"
( cd "$ROOT/next/dist" && jar cMf "$APP/res/raw/site.zip" . )
echo "    site.zip: $(wc -c < "$APP/res/raw/site.zip") bytes"

echo "==> aapt2 compile"
"$BT/aapt2" compile --dir "$APP/res" -o "$BUILD/res.zip"

echo "==> aapt2 link"
"$BT/aapt2" link \
  -o "$BUILD/unaligned.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$BUILD/gen" \
  --min-sdk-version 23 --target-sdk-version 34 \
  --auto-add-overlay \
  "$BUILD/res.zip"

echo "==> javac"
mapfile -t SOURCES < <(find "$APP/src" "$BUILD/gen" -name '*.java')
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
  -Xlint:-options -d "$BUILD/classes" "${SOURCES[@]}"

echo "==> d8"
mapfile -t CLASSES < <(find "$BUILD/classes" -name '*.class')
if [ -x "$BT/d8" ]; then
  "$BT/d8" --release --min-api 23 --lib "$ANDROID_JAR" --output "$BUILD/dex" "${CLASSES[@]}"
else
  java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 23 \
    --lib "$ANDROID_JAR" --output "$BUILD/dex" "${CLASSES[@]}"
fi

echo "==> 追加 classes.dex"
python3 "$ROOT/tools/append_dex.py" "$BUILD/unaligned.apk" "$BUILD/dex/classes.dex"

echo "==> zipalign"
"$BT/zipalign" -f -p 4 "$BUILD/unaligned.apk" "$BUILD/aligned.apk"

echo "==> apksigner"
KS="$APP/keystore/wangzhe.jks"
if [ -f "$KS" ] && [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ]; then
  ALIAS="${ANDROID_KEY_ALIAS:-wangzhe}"
  KEY_PASS="${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}"
  "$BT/apksigner" sign \
    --ks "$KS" --ks-key-alias "$ALIAS" \
    --ks-pass "pass:$ANDROID_KEYSTORE_PASSWORD" \
    --key-pass "pass:$KEY_PASS" \
    --out "$DIST/$APK_NAME.apk" "$BUILD/aligned.apk"
  "$BT/apksigner" verify --print-certs "$DIST/$APK_NAME.apk"
  echo "==> OK: $DIST/$APK_NAME.apk"
else
  cp "$BUILD/aligned.apk" "$DIST/$APK_NAME-unsigned.apk"
  echo "==> 未配置签名，已输出未签名 APK: $DIST/$APK_NAME-unsigned.apk"
fi
