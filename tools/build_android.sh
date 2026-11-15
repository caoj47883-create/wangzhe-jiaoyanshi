#!/usr/bin/env bash
# 王者教研室 · Linux / macOS / GitHub Actions 构建脚本（V2.4.9+，含 sherpa-onnx 离线 ASR）
#
# 前置：
#   - JDK 17（javac / java / jar 在 PATH 或 JAVA_HOME）
#   - Android SDK：build-tools 34.0.0 + platform android-34（ANDROID_HOME）
#   - 已执行 `cd next && pnpm install && pnpm build` 生成 next/dist
#   - curl / unzip / tar / python3 可用；首次构建会下载 sherpa-onnx 运行时和模型
#   - 签名（可选）：app/keystore/wangzhe.jks，以及环境变量
#       ANDROID_KEY_ALIAS / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_PASSWORD
#     未提供签名时输出未签名 APK（仅用于测试）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
BUILD="$ROOT/build/ci"
DIST="$ROOT/dist"
ASR_CACHE="${WZJS_ASR_CACHE:-$ROOT/.asr-cache}"
SHERPA_VERSION="${SHERPA_ONNX_VERSION:-2.0.1}"
MODEL_NAME="${SHERPA_ONNX_MODEL:-sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30}"
ASR_JAR="$ASR_CACHE/sherpa-onnx-jvm-$SHERPA_VERSION.jar"
ASR_AAR="$ASR_CACHE/sherpa-onnx-$SHERPA_VERSION.aar"
ASR_AAR_DIR="$ASR_CACHE/aar-$SHERPA_VERSION"
MODEL_ARCHIVE="$ASR_CACHE/$MODEL_NAME.tar.bz2"
MODEL_DIR="$ASR_CACHE/$MODEL_NAME"

: "${ANDROID_HOME:?请设置 ANDROID_HOME 指向 Android SDK}"
BT="${ANDROID_BUILD_TOOLS:-$ANDROID_HOME/build-tools/34.0.0}"
PLATFORM="${ANDROID_PLATFORM:-$ANDROID_HOME/platforms/android-34}"
ANDROID_JAR="$PLATFORM/android.jar"

for bin in "$BT/aapt2" "$BT/zipalign" "$BT/apksigner"; do
  [ -x "$bin" ] || { echo "缺少 $bin"; exit 2; }
done
[ -f "$ANDROID_JAR" ] || { echo "缺少 $ANDROID_JAR"; exit 2; }
[ -f "$ROOT/next/dist/index.html" ] || { echo "缺少 next/dist，请先执行 pnpm build"; exit 2; }
[ -f "$ROOT/next/src/data/asr-hotwords.txt" ] || {
  echo "缺少 next/src/data/asr-hotwords.txt，请先运行 node scripts/build-asr-hotwords.mjs"; exit 2;
}

VERSION="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$APP/AndroidManifest.xml" | head -n1)"
VERSION="${VERSION:-dev}"
APK_NAME="wangzhe-jiaoyanshi-$VERSION"

fetch() {
  local url="$1" out="$2"
  if [ -s "$out" ]; then
    echo "    cached: $(basename "$out")"
    return
  fi
  echo "    download: $url"
  curl -L --fail --retry 3 --retry-delay 2 -o "$out" "$url"
}

echo "==> 准备 sherpa-onnx 运行时"
mkdir -p "$ASR_CACHE"
fetch "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$SHERPA_VERSION/sherpa-onnx-jvm-$SHERPA_VERSION.jar" "$ASR_JAR"
fetch "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$SHERPA_VERSION/sherpa-onnx-$SHERPA_VERSION.aar" "$ASR_AAR"
if [ ! -d "$ASR_AAR_DIR/jni/arm64-v8a" ]; then
  rm -rf "$ASR_AAR_DIR"
  mkdir -p "$ASR_AAR_DIR"
  unzip -q "$ASR_AAR" -d "$ASR_AAR_DIR"
fi
for abi in arm64-v8a armeabi-v7a; do
  for lib in libonnxruntime.so libsherpa-onnx-jni.so libsherpa-onnx-c-api.so libsherpa-onnx-cxx-api.so; do
    [ -f "$ASR_AAR_DIR/jni/$abi/$lib" ] || { echo "AAR 缺少 jni/$abi/$lib"; exit 2; }
  done
done

echo "==> 准备离线中文 ASR 模型"
fetch "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$MODEL_NAME.tar.bz2" "$MODEL_ARCHIVE"
if [ ! -f "$MODEL_DIR/tokens.txt" ]; then
  rm -rf "$MODEL_DIR"
  mkdir -p "$MODEL_DIR"
  tar -xjf "$MODEL_ARCHIVE" -C "$MODEL_DIR"
fi
MODEL_ROOT="$(dirname "$(find "$MODEL_DIR" -name tokens.txt -type f -print -quit)")"
[ -n "$MODEL_ROOT" ] && [ -f "$MODEL_ROOT/tokens.txt" ] || { echo "模型 tokens.txt 未找到"; exit 2; }
for name in encoder.int8.onnx decoder.onnx joiner.int8.onnx tokens.txt; do
  [ -f "$MODEL_ROOT/$name" ] || { echo "模型缺少 $name"; exit 2; }
done
echo "    model: $MODEL_ROOT"

rm -rf "$BUILD" "$DIST"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$APP/assets" "$APP/res/raw" "$DIST"

echo "==> 打包网页资源"
rm -rf "$APP/assets/site"
cp -r "$ROOT/next/dist" "$APP/assets/site"
( cd "$ROOT/next/dist" && jar cMf "$APP/res/raw/site.zip" . )
echo "    site.zip: $(wc -c < "$APP/res/raw/site.zip") bytes"

echo "==> 复制 ASR 模型到 res/raw"
cp "$MODEL_ROOT/encoder.int8.onnx" "$APP/res/raw/asr_encoder.onnx"
cp "$MODEL_ROOT/decoder.onnx" "$APP/res/raw/asr_decoder.onnx"
cp "$MODEL_ROOT/joiner.int8.onnx" "$APP/res/raw/asr_joiner.onnx"
cp "$MODEL_ROOT/tokens.txt" "$APP/res/raw/asr_tokens.txt"
cp "$ROOT/next/src/data/asr-hotwords.txt" "$APP/res/raw/asr_hotwords.txt"
ls -lh "$APP/res/raw" | sed 's/^/    /'

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
  -classpath "$ASR_JAR" \
  -Xlint:-options -d "$BUILD/classes" "${SOURCES[@]}"

echo "==> d8"
mapfile -t CLASSES < <(find "$BUILD/classes" -name '*.class')
if [ -x "$BT/d8" ]; then
  "$BT/d8" --release --min-api 23 --lib "$ANDROID_JAR" --output "$BUILD/dex" \
    "${CLASSES[@]}" "$ASR_JAR"
else
  java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 23 \
    --lib "$ANDROID_JAR" --output "$BUILD/dex" "${CLASSES[@]}" "$ASR_JAR"
fi

echo "==> 追加 classes.dex"
python3 "$ROOT/tools/append_dex.py" "$BUILD/unaligned.apk" "$BUILD/dex/classes.dex"

echo "==> 追加 sherpa-onnx native libraries（arm64-v8a + armeabi-v7a）"
python3 "$ROOT/tools/append_native.py" "$BUILD/unaligned.apk" "$ASR_AAR_DIR/jni"

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
