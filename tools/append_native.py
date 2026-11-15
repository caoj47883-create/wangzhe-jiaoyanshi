#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 sherpa-onnx 的原生 .so 追加进 aapt2 产出的 APK。

以 ZIP_STORED 写入，保持 native 库未压缩；随后由 zipalign -p 完成页对齐。
不重写已有条目，避免破坏 aapt2 生成的 resources.arsc / assets。
用法：python3 tools/append_native.py build/unaligned.apk tools/asr-cache/aar/jni
"""
import os
import sys
import zipfile

if len(sys.argv) != 3:
    print("usage: python3 tools/append_native.py <apk> <jni-root>")
    sys.exit(1)

apk_path, jni_root = sys.argv[1], sys.argv[2]
libs = [
    "libonnxruntime.so",
    "libsherpa-onnx-jni.so",
    "libsherpa-onnx-c-api.so",
    "libsherpa-onnx-cxx-api.so",
]
abis = ["arm64-v8a", "armeabi-v7a"]
entries = []
for abi in abis:
    for lib in libs:
        path = os.path.join(jni_root, abi, lib)
        if not os.path.isfile(path):
            print("missing native lib:", path)
            sys.exit(2)
        entries.append((path, "lib/%s/%s" % (abi, lib)))

with zipfile.ZipFile(apk_path, "a", compression=zipfile.ZIP_STORED) as zf:
    names = set(zf.namelist())
    for path, arcname in entries:
        if arcname in names:
            print("skip existing:", arcname)
            continue
        zf.write(path, arcname, compress_type=zipfile.ZIP_STORED)
        print("added:", arcname, os.path.getsize(path), "bytes")

print("native libraries appended ->", apk_path)
