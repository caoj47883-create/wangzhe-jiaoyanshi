# -*- coding: utf-8 -*-
import json, io, sys
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
P = Path(r"D:\图吧工具箱\wangzhe-apk\next\src\data\data.json")
d = json.loads(P.read_text(encoding="utf-8"))
extra = {
 "early": ["鬼谷子","大乔"],
 "global": ["东皇太一","张良"],
 "doublec": ["盾山","关羽"],
 "wild": ["镜","澜"],
 "fat": ["马可波罗","伽罗"],
 "midcarry": ["关羽","吕布"],
 "revive": ["东皇太一","张良"],
 "rush": ["蔡文姬","大乔"],
}
for c in d["comps"]:
    if c["id"] in extra:
        picks=set(c["picks"].values())
        for b in extra[c["id"]]:
            if b not in picks and b not in c["bans"]:
                c["bans"].append(b)
P.write_text(json.dumps(d,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
from collections import Counter
print("comps",len(d["comps"]),"bans",Counter(len(c["bans"]) for c in d["comps"]))
print("3-bans",[c["id"] for c in d["comps"] if len(c["bans"])<4])