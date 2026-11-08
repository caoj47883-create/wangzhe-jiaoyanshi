# -*- coding: utf-8 -*-
"""Generate launcher icons for 王者教研室.

主题：马可波罗「暗影游猎」头像（贴近《王者荣耀》游戏图标的英雄特写风格）
输出：
  app/res/mipmap-*/ic_launcher.png / ic_launcher_round.png   (legacy)
  app/res/mipmap-anydpi-v26/ic_launcher.xml                  (adaptive)
  app/res/mipmap-xxxhdpi/ic_launcher_foreground.png / _background.png / _monochrome.png
  app/icon/                                                   (preview / master)
源图：app/icon-src/marco-shadow-hunt.jpg（官方 132-bigskin-4，暗影游猎）
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "app", "icon-src", "marco-shadow-hunt.jpg")
OUT = os.path.join(BASE, "app", "icon")
RES = os.path.join(BASE, "app", "res")
os.makedirs(OUT, exist_ok=True)

# 源图为 1920x882 的原画，这里裁出头像特写（马可波罗脸部 + 面具/红衣领）
CROP = (810, 10, 1190, 390)  # 380x380
S = 1024
FONT_BOLD = "C:\\Windows\\Fonts\\msyhbd.ttc"

BG_TOP = (12, 20, 32)
BG_BOT = (4, 6, 10)


def load_head(size, scale=1.0, dy=0.0, brightness=0.9):
    im = Image.open(SRC).convert("RGB").crop(CROP)
    im = im.resize((int(size * scale), int(size * scale)), Image.LANCZOS)
    im = ImageEnhance.Brightness(im).enhance(brightness)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.05)
    return im


def dark_bg(size):
    w, h = size
    img = Image.new("RGB", (w, h), BG_BOT)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    # 暗影游猎的红色枪焰 + 紫色夜光氛围
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w * 0.00, h * 0.12, w * 0.72, h * 0.96], fill=(92, 14, 30))
    gd.ellipse([w * 0.48, h * 0.00, w * 1.16, h * 0.72], fill=(42, 18, 66))
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * 0.11)))
    return Image.blend(img.convert("RGB"), glow, 0.62)


def soft_mask(size, blur_ratio=0.11):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([int(size * -0.06), int(size * -0.06), int(size * 1.06), int(size * 1.06)], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(int(size * blur_ratio)))


def vignette(img, strength=1.0):
    size = img.size
    vg = Image.new("L", size, 0)
    d = ImageDraw.Draw(vg)
    d.ellipse([int(size[0] * -0.02), int(size[1] * -0.02),
               int(size[0] * 1.02), int(size[1] * 1.02)], fill=255)
    vg = vg.filter(ImageFilter.GaussianBlur(int(size[0] * 0.16)))
    dark = Image.new("RGB", size, (4, 6, 10))
    out = Image.composite(img.convert("RGB"), dark, vg)
    if strength < 1.0:
        out = Image.blend(img.convert("RGB"), out, strength)
    return out


def master_icon():
    bg = dark_bg((S, S)).convert("RGBA")
    head = load_head(S)
    mask = soft_mask(S)
    bg.alpha_composite(Image.composite(head.convert("RGBA"), Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))
    icon = vignette(bg, 1.0).convert("RGBA")
    # 轻微金色描边：让图标在深色桌面上更立得住
    border = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    inset = int(S * 0.028)
    bd.rounded_rectangle([inset, inset, S - inset - 1, S - inset - 1],
                         radius=int(S * 0.20), outline=(211, 166, 89, 120), width=max(2, S // 240))
    icon.alpha_composite(border)
    return icon


def rounded(img, radius_ratio=0.20):
    size = img.size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=int(size[0] * radius_ratio), fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def circle(img):
    size = img.size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.ellipse([0, 0, size[0] - 1, size[1] - 1], fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def adaptive_foreground(size=432):
    head = load_head(size)
    m = soft_mask(size, 0.12)
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fg.alpha_composite(Image.composite(head.convert("RGBA"), Image.new("RGBA", (size, size), (0, 0, 0, 0)), m))
    return fg


def adaptive_background(size=432):
    return dark_bg((size, size)).convert("RGBA")


def monochrome(size=432):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    font = ImageFont.truetype(FONT_BOLD, int(size * 0.52), index=0)
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.text((size // 2, size // 2), "王", font=font, fill=255, anchor="mm")
    img.paste((255, 255, 255, 255), (0, 0), m)
    return img


def main():
    master = master_icon()
    master.save(os.path.join(OUT, "ic_launcher-master.png"))
    master.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "ic_launcher-512.png"))

    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dpi, px in densities.items():
        d = os.path.join(RES, "mipmap-" + dpi)
        os.makedirs(d, exist_ok=True)
        square = master.resize((px, px), Image.LANCZOS)
        square.convert("RGB").save(os.path.join(d, "ic_launcher.png"))
        # round icon: 圆形裁切（透明背景）
        rc = circle(square)
        rc.save(os.path.join(d, "ic_launcher_round.png"))

    fgdir = os.path.join(RES, "mipmap-xxxhdpi")
    os.makedirs(fgdir, exist_ok=True)
    adaptive_foreground().save(os.path.join(fgdir, "ic_launcher_foreground.png"))
    adaptive_background().save(os.path.join(fgdir, "ic_launcher_background.png"))
    monochrome().save(os.path.join(fgdir, "ic_launcher_monochrome.png"))

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
        '</adaptive-icon>\n'
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(xml)

    # 预览：方形 / 圆形 / 自适应前景
    preview = Image.new("RGB", (3 * 360 + 80, 360 + 40), (9, 11, 15))
    pd = ImageDraw.Draw(preview)
    label_font = ImageFont.truetype(FONT_BOLD, 18)
    square = master.resize((320, 320), Image.LANCZOS)
    rnd = circle(square)
    fgprev = Image.new("RGB", (320, 320), (9, 11, 15))
    fgprev.paste(adaptive_foreground(320).convert("RGB"), (0, 0), adaptive_foreground(320))
    for i, (label, img) in enumerate((("方形 / 圆角", square), ("圆形 Icon", rnd), ("自适应前景", fgprev))):
        x = 20 + i * 360
        preview.paste(img.convert("RGB"), (x, 10), img if img.mode == "RGBA" else None)
        pd.text((x, 340), label, fill=(200, 190, 170), font=label_font)
    preview.save(os.path.join(BASE, "next", "shots", "icon-v2.1.1.png"))
    print("icons written:", RES, "| preview:", os.path.join(BASE, "next", "shots", "icon-v2.1.1.png"))


if __name__ == "__main__":
    main()
