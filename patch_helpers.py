# -*- coding: utf-8 -*-
import os
import re
BASE = os.path.dirname(os.path.abspath(__file__))
java_path = os.path.join(BASE, "app", "src", "com", "wangzhe", "jiaoyanshi", "MainActivity.java")
js = open(os.path.join(BASE, "tools", "page-helpers.js"), encoding="utf-8").read()
src = open(java_path, encoding="utf-8").read()

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

# chunk the *original* js by characters (so escape sequences never split)
chunks = [js[i:i+60] for i in range(0, len(js), 60)]
lines = ["    private static final String PAGE_HELPERS_JS ="]
for i, c in enumerate(chunks):
    lit = '"' + esc(c) + '"'
    lines.append(("            " + lit) if i == 0 else ("            + " + lit))
block = "\n".join(lines) + ";\n"
pat = re.compile(r'    private static final String PAGE_HELPERS_JS =.*?;\n(?=\n    private void injectPageHelpers)', re.S)
assert pat.search(src), "block not found"
src2 = pat.sub(lambda m: block, src, count=1)
open(java_path, "w", encoding="utf-8", newline="\n").write(src2)
print("patched, chunks:", len(chunks), "js chars:", len(js))
