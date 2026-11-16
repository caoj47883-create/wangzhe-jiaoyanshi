# -*- coding: utf-8 -*-
"""Refresh the bundled hero tier snapshot to the S45 November 2026 meta.

This is intentionally a small curated overlay: only heroes whose tier moved in
the current high-rank meta are changed. Everything else keeps its existing
tier, so the 133-hero roster, counters, builds and other datasets are untouched.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "next" / "src" / "data" / "data.json"
BACKUP = ROOT / ".tmp-data-s45-backup.json"

LANE_ORDER = ["T0", "T0.5", "T1", "T2", "T3"]
RANK = {"T0": 0, "T0.5": 0.5, "T1": 1, "T2": 2, "T3": 3}

# lane -> hero -> new tier.  Heroes not listed keep their existing tier.
MOVES = {
    "farm": {
        "敖隐": "T0.5",
        "元流之子(射手)": "T0.5",
        "百里守约": "T0.5",
        "艾琳": "T1",
        "戈娅": "T1",
        "莱西奥": "T1",
        "苍": "T1",
        "蚩奼": "T1",
        "卢雅那": "T1",
        "伽罗": "T2",
        "狄仁杰": "T2",
        "孙权": "T2",
        "孙尚香": "T2",
        "后羿": "T2",
        "虞姬": "T2",
        "鲁班七号": "T2",
        "蒙犽": "T2",
        "黄忠": "T2",
        "马可波罗": "T2",
        "李元芳": "T2",
        "公孙离": "T3",
    },
    "jungle": {
        "镜": "T0",
        "裴擒虎": "T0",
        "马超": "T0",
        "暃": "T0.5",
        "赵云": "T0.5",
        "阿古朵": "T0.5",
        "露娜": "T0.5",
        "云缨": "T1",
        "宫本武藏": "T1",
        "六耳": "T3",
    },
    "mid": {
        "海月": "T0",
        "大乔": "T0",
        "嫦娥": "T0",
        "女娲": "T0.5",
        "沈梦溪": "T0.5",
        "诸葛亮": "T0.5",
        "王维": "T0.5",
        "甄姬": "T2",
    },
    "clash": {
        "关羽": "T0",
        "司空震": "T0.5",
        "马超": "T0.5",
        "元歌": "T0.5",
        "项羽": "T0.5",
        "哪吒": "T0.5",
        "影": "T1",
        "花木兰": "T1",
        "夏侯惇": "T2",
    },
    "roam": {
        "鲁班大师": "T0",
        "项羽": "T0",
        "苏烈": "T0",
        "盾山": "T0",
        "少司缘": "T0.5",
        "张飞": "T0.5",
    },
}

# Preferred display order for the top end of each lane (others are appended in
# their original order).
ORDER = {
    "farm": ["元流之子(射手)", "敖隐", "百里守约", "艾琳", "戈娅", "莱西奥", "苍", "蚩奼", "卢雅那", "公孙离"],
    "jungle": ["镜", "裴擒虎", "马超", "暃", "赵云", "阿古朵", "露娜", "云缨", "宫本武藏", "六耳"],
    "mid": ["海月", "大乔", "嫦娥", "女娲", "沈梦溪", "诸葛亮", "王维", "甄姬"],
    "clash": ["关羽", "司空震", "马超", "元歌", "项羽", "哪吒", "影", "花木兰", "夏侯惇"],
    "roam": ["鲁班大师", "项羽", "苏烈", "盾山", "少司缘", "张飞"],
}


def main():
    if not BACKUP.exists():
        shutil.copy2(DATA_PATH, BACKUP)
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    heroes = {h["name"]: h for h in data["heroes"]}

    for lane, moves in MOVES.items():
        old_list = data["tiers"].get(lane, [])
        members = []
        for group in old_list:
            for name in group["heroes"]:
                if name not in members:
                    members.append(name)

        # Make implicit lane membership explicit, then apply the overlay.
        old_tier = {}
        for group in old_list:
            for name in group["heroes"]:
                old_tier[name] = group["tier"]
        for name in members:
            h = heroes[name]
            h.setdefault("tiers", {})
            h["tiers"].setdefault(lane, old_tier[name])

        for name, tier in moves.items():
            if name not in heroes:
                raise SystemExit(f"unknown hero: {name}")
            h = heroes[name]
            h.setdefault("tiers", {})
            h["tiers"][lane] = tier
            if lane not in h.setdefault("lanes", []):
                h["lanes"].append(lane)
            if name not in members:
                members.append(name)

        by_tier = {}
        for name in members:
            tier = heroes[name]["tiers"].get(lane, old_tier.get(name, "T3"))
            by_tier.setdefault(tier, []).append(name)

        preferred = ORDER.get(lane, [])
        for tier, names in by_tier.items():
            names.sort(key=lambda n: (preferred.index(n) if n in preferred else len(preferred), members.index(n)))

        data["tiers"][lane] = [
            {"tier": tier, "heroes": by_tier[tier]}
            for tier in LANE_ORDER
            if by_tier.get(tier)
        ]

    # Recompute each hero's headline tier/rank from its lane tiers.
    for h in data["heroes"]:
        tiers = h.get("tiers") or {}
        if not tiers:
            continue
        best = min(tiers.values(), key=lambda t: RANK.get(t, 99))
        h["tier"] = best
        h["rank"] = RANK.get(best, 3)

    data["season"] = "S45"
    # Use the same date-style namespace as the hot-update manifest so this
    # bundled snapshot wins over the older 2026.11.06.103 runtime cache.
    data["version"] = "2026.11.16.1"
    data["snapshot"] = "2026-11-16"

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("updated", DATA_PATH)
    print("heroes", len(data["heroes"]), "season", data["season"], "version", data["version"])
    for lane in ("clash", "jungle", "mid", "farm", "roam"):
        print(lane, [(g["tier"], len(g["heroes"])) for g in data["tiers"][lane]])
    print("公孙离", heroes["公孙离"].get("tier"), heroes["公孙离"].get("tiers"))


if __name__ == "__main__":
    main()
