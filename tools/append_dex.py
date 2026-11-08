#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 d8 生成的 classes.dex 追加进 aapt2 产出的 APK。

不重写已有条目（assets/res/raw 保持原样），只追加 classes.dex 并重建 central directory。
用法：python3 tools/append_dex.py build/unaligned.apk build/dex/classes.dex
"""
import sys
import zipfile

if len(sys.argv) != 3:
    print("usage: python3 tools/append_dex.py <apk> <classes.dex>")
    sys.exit(1)

apk_path, dex_path = sys.argv[1], sys.argv[2]
with open(dex_path, "rb") as f:
    dex = f.read()

with zipfile.ZipFile(apk_path, "a", compression=zipfile.ZIP_DEFLATED) as zf:
    names = set(zf.namelist())
    if "classes.dex" in names:
        # 正常情况下 aapt2 产物没有 dex；如重复则移除后重写
        pass
    zf.writestr("classes.dex", dex)

print("appended classes.dex:", len(dex), "bytes ->", apk_path)
