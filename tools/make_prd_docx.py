# -*- coding: utf-8 -*-
"""把 PRD Markdown 转成排版好的 Word 文档（封面 / 目录 / 标题 / 表格 / 截图 / 页眉页脚）。

用法：
    python tools/make_prd_docx.py "docs/PRD-王者教研室-V2.1.1.md" "王者教研室-PRD-v2.1.1.docx"
"""
import os
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_CN = "微软雅黑"
FONT_MONO = "Consolas"
GOLD = RGBColor(0xB8, 0x89, 0x3D)
GOLD_LIGHT = RGBColor(0xD3, 0xA6, 0x59)
DARK = RGBColor(0x1B, 0x1C, 0x20)
GRAY = RGBColor(0x71, 0x6B, 0x5F)
LIGHT_GRAY = RGBColor(0x98, 0xA1, 0xAE)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)


# --------------------------------------------------------------------------- utils
def set_run_font(run, name=FONT_CN, size=None, bold=None, color=None):
    run.font.name = name
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), name)
    rFonts.set(qn("w:hAnsi"), name)
    rFonts.set(qn("w:eastAsia"), FONT_CN if name != FONT_MONO else FONT_CN)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color


def shade_cell(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    tcPr.append(shd)


def cell_margins(cell, top=40, bottom=40, left=80, right=80):
    tcPr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for tag, val in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        el = OxmlElement("w:" + tag)
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tcPr.append(mar)


def row_no_split(row):
    trPr = row._tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    trPr.append(cant)


def row_header_repeat(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    trPr.append(tblHeader)


def para_bottom_border(paragraph, color="B8893D", size=8, space=2):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), str(space))
    bottom.set(qn("w:color"), color)
    pBdr.append(bottom)
    pPr.append(pBdr)


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_end)
    set_run_font(run, size=8.5, color=LIGHT_GRAY)


# --------------------------------------------------------------------------- inline
TOKEN_RE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)")


def add_inline(paragraph, text, size=10.5, color=DARK, base_bold=False):
    for token in TOKEN_RE.split(text):
        if not token:
            continue
        if token.startswith("**") and token.endswith("**") and len(token) > 4:
            run = paragraph.add_run(token[2:-2])
            set_run_font(run, size=size, bold=True, color=color)
        elif token.startswith("`") and token.endswith("`") and len(token) > 2:
            run = paragraph.add_run(token[1:-1])
            set_run_font(run, name=FONT_MONO, size=size - 0.5, color=RGBColor(0x8A, 0x5B, 0x1F))
        elif token.startswith("[") and "](" in token:
            m = re.match(r"\[([^\]]+)\]\(([^)]+)\)", token)
            label, url = m.group(1), m.group(2)
            run = paragraph.add_run(label)
            set_run_font(run, size=size, color=RGBColor(0x2F, 0x5D, 0x8A))
            tail = paragraph.add_run("（" + url + "）")
            set_run_font(tail, size=size - 1.5, color=LIGHT_GRAY)
        elif token.startswith("*") and token.endswith("*") and len(token) > 2:
            run = paragraph.add_run(token[1:-1])
            set_run_font(run, size=size, bold=base_bold, color=color)
            run.italic = True
        else:
            run = paragraph.add_run(token)
            set_run_font(run, size=size, bold=base_bold, color=color)


# --------------------------------------------------------------------------- tables
def add_table(doc, rows, header=True):
    ncols = max(len(r) for r in rows)
    rows = [r + [""] * (ncols - len(r)) for r in rows]
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True

    # 列宽：按内容长度分配，限制范围
    content_w = 16.2
    weights = []
    for c in range(ncols):
        max_len = max(len(re.sub(r"[`*\[\]()]", "", r[c])) if c < len(r) else 0 for r in rows)
        weights.append(max(4, min(max_len, 30)))
    total = sum(weights)
    widths = [max(1.6, content_w * w / total) for w in weights]
    scale = content_w / sum(widths)
    widths = [w * scale for w in widths]

    for ri, row in enumerate(rows):
        row_obj = table.rows[ri]
        row_no_split(row_obj)
        if ri == 0 and header:
            row_header_repeat(row_obj)
        for ci, text in enumerate(row):
            cell = row_obj.cells[ci]
            cell.width = Cm(widths[ci])
            cell_margins(cell)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.line_spacing = 1.15
            if ri == 0 and header:
                shade_cell(cell, "0F172A")
                add_inline(p, text, size=8.8, color=WHITE, base_bold=True)
            else:
                if ri % 2 == 0:
                    shade_cell(cell, "FAF7F2")
                add_inline(p, text, size=8.8, color=DARK)
    # 表格后间距
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(2)
    return table


# --------------------------------------------------------------------------- document setup
def setup_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name = FONT_CN
    normal.font.size = Pt(10.5)
    normal.paragraph_format.line_spacing = 1.4
    normal.paragraph_format.space_after = Pt(3)
    rPr = normal.element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), FONT_CN)
    rFonts.set(qn("w:hAnsi"), FONT_CN)
    rFonts.set(qn("w:eastAsia"), FONT_CN)

    for name, size, color, before, after in (
        ("Heading 1", 16, GOLD, 20, 8),
        ("Heading 2", 13, DARK, 14, 5),
        ("Heading 3", 11.5, DARK, 10, 4),
    ):
        st = doc.styles[name]
        st.font.name = FONT_CN
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = color
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
        rPr = st.element.get_or_add_rPr()
        rFonts = rPr.find(qn("w:rFonts"))
        if rFonts is None:
            rFonts = OxmlElement("w:rFonts")
            rPr.append(rFonts)
        rFonts.set(qn("w:ascii"), FONT_CN)
        rFonts.set(qn("w:hAnsi"), FONT_CN)
        rFonts.set(qn("w:eastAsia"), FONT_CN)


def setup_page(doc):
    sec = doc.sections[0]
    sec.page_width = Cm(21)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(1.9)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)
    sec.different_first_page_header_footer = True

    header = sec.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = hp.add_run("王者教研室 · 产品需求文档（PRD v1.0）")
    set_run_font(run, size=8, color=LIGHT_GRAY)

    footer = sec.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = fp.add_run("V2.1.1 基线 · V2.2 规划　　第 ")
    set_run_font(r1, size=8.5, color=LIGHT_GRAY)
    add_page_number(fp)
    r2 = fp.add_run(" 页")
    set_run_font(r2, size=8.5, color=LIGHT_GRAY)


# --------------------------------------------------------------------------- cover
def add_cover(doc):
    band = doc.add_table(rows=1, cols=1)
    band.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = band.rows[0].cells[0]
    cell.width = Cm(16.6)
    shade_cell(cell, "0B1220")
    cell_margins(cell, top=300, bottom=260, left=320, right=300)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("王者教研室")
    set_run_font(run, size=30, bold=True, color=GOLD_LIGHT)

    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(4)
    run = p2.add_run("产品需求文档 · PRD")
    set_run_font(run, size=17, bold=True, color=WHITE)

    p3 = cell.add_paragraph()
    run = p3.add_run("ANDROID  ·  离线优先  ·  BP 决策  ·  数据热更新  ·  AI 助手")
    set_run_font(run, size=8.5, color=LIGHT_GRAY)

    doc.add_paragraph()
    title = doc.add_paragraph()
    title.paragraph_format.space_before = Pt(16)
    title.paragraph_format.space_after = Pt(2)
    run = title.add_run("王者教研室 App\n产品需求文档")
    set_run_font(run, size=25, bold=True, color=DARK)
    title.paragraph_format.line_spacing = 1.25

    sub = doc.add_paragraph()
    run = sub.add_run("以 V2.1.1 为基线 · 含 V2.2 规划")
    set_run_font(run, size=11, color=GRAY)

    line = doc.add_paragraph()
    para_bottom_border(line, color="D3A659", size=12, space=6)
    line.paragraph_format.space_after = Pt(10)

    meta = [
        ("文档版本", "PRD v1.0"),
        ("对应产品版本", "V2.1.1（已发布基线）+ V2.2（规划中）"),
        ("更新日期", "2026-11-07"),
        ("文档状态", "基线已实现；规划部分待评审"),
        ("平台", "Android 6.0+（系统 WebView ≥ 111）"),
        ("分发方式", "个人侧载 APK（不上架应用商店）"),
        ("维护人", "产品 / 独立开发（个人项目）"),
    ]
    table = doc.add_table(rows=len(meta), cols=2)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for i, (k, v) in enumerate(meta):
        row = table.rows[i]
        row_no_split(row)
        c0, c1 = row.cells
        c0.width = Cm(4.0)
        c1.width = Cm(12.4)
        shade_cell(c0, "F6F1E6")
        cell_margins(c0)
        cell_margins(c1)
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_before = Pt(2)
        p0.paragraph_format.space_after = Pt(2)
        r = p0.add_run(k)
        set_run_font(r, size=9, bold=True, color=GRAY)
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_before = Pt(2)
        p1.paragraph_format.space_after = Pt(2)
        r = p1.add_run(v)
        set_run_font(r, size=9, color=DARK)

    doc.add_paragraph()
    summary = doc.add_paragraph()
    summary.paragraph_format.left_indent = Cm(0.2)
    summary.paragraph_format.space_before = Pt(8)
    r = summary.add_run("摘要　")
    set_run_font(r, size=10.5, bold=True, color=GOLD)
    r = summary.add_run(
        "本文档以已发布的 V2.1.1 为基线，描述产品定位、用户场景、信息架构、功能与非功能需求、"
        "数据与热更新机制、技术方案、发布流程与路线图；V2.2 规划部分标注优先级，作为下一阶段开发与验收依据。"
    )
    set_run_font(r, size=10.5, color=DARK)
    summary.paragraph_format.line_spacing = 1.5

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# --------------------------------------------------------------------------- TOC
def add_toc(doc, toc_entries):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(6)
    h.paragraph_format.space_after = Pt(10)
    run = h.add_run("目录")
    set_run_font(run, size=20, bold=True, color=DARK)
    para_bottom_border(h, color="D3A659", size=10, space=4)

    for level, text in toc_entries:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.4 * (level - 1))
        p.paragraph_format.space_after = Pt(0 if level == 2 else 1)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.line_spacing = Pt(13 if level == 1 else 10)
        if level == 1:
            run = p.add_run(text)
            set_run_font(run, size=9.8, bold=True, color=DARK)
        else:
            run = p.add_run(text)
            set_run_font(run, size=8.4, color=GRAY)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# --------------------------------------------------------------------------- markdown
def parse_markdown(doc, md_path):
    base_dir = os.path.dirname(md_path)
    with open(md_path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    i = 0
    started = False
    while i < len(lines):
        line = lines[i]
        if not started:
            if line.startswith("## "):
                started = True
            else:
                i += 1
                continue

        stripped = line.strip()

        # 标题
        if line.startswith("## "):
            p = doc.add_heading(level=1)
            add_inline(p, line[3:].strip(), size=16, color=GOLD, base_bold=True)
            para_bottom_border(p, color="E6DDCD", size=6, space=2)
            i += 1
            continue
        if line.startswith("### "):
            p = doc.add_heading(level=2)
            add_inline(p, line[4:].strip(), size=13, color=DARK, base_bold=True)
            i += 1
            continue
        if line.startswith("#### "):
            p = doc.add_heading(level=3)
            add_inline(p, line[5:].strip(), size=11.5, color=DARK, base_bold=True)
            i += 1
            continue

        # 代码块
        if stripped.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            box = doc.add_table(rows=1, cols=1)
            box.style = "Table Grid"
            box.alignment = WD_TABLE_ALIGNMENT.CENTER
            row_no_split(box.rows[0])
            cell = box.rows[0].cells[0]
            cell.width = Cm(16.2)
            shade_cell(cell, "F5F6F8")
            cell_margins(cell, top=80, bottom=80, left=140, right=120)
            first = True
            for cl in code_lines:
                p = cell.paragraphs[0] if first else cell.add_paragraph()
                first = False
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.05
                run = p.add_run(cl)
                set_run_font(run, name=FONT_MONO, size=7.8, color=RGBColor(0x33, 0x33, 0x33))
            sp = doc.add_paragraph()
            sp.paragraph_format.space_after = Pt(2)
            continue

        # 图片
        m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
        if m:
            alt, rel = m.group(1), m.group(2)
            path = rel if os.path.isabs(rel) else os.path.normpath(os.path.join(base_dir, rel))
            if os.path.exists(path):
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(2)
                run = p.add_run()
                run.add_picture(path, width=Cm(15.6))
            i += 1
            # 可选斜体图注
            while i < len(lines) and not lines[i].strip():
                i += 1
            if i < len(lines):
                cap = lines[i].strip()
                if cap.startswith("*") and cap.endswith("*") and len(cap) > 2:
                    cp = doc.add_paragraph()
                    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    cp.paragraph_format.space_after = Pt(6)
                    run = cp.add_run(cap[1:-1])
                    set_run_font(run, size=8.5, color=GRAY)
                    i += 1
            continue

        # 表格
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|?$", lines[i + 1].strip()):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                raw = lines[i].strip()
                if re.match(r"^\|[\s:|-]+\|?$", raw):
                    i += 1
                    continue
                cells = [c.strip() for c in raw.strip("|").split("|")]
                rows.append(cells)
                i += 1
            add_table(doc, rows)
            continue

        # 分隔线
        if stripped in ("---", "***", "___"):
            p = doc.add_paragraph()
            para_bottom_border(p, color="E6DDCD", size=6, space=2)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            i += 1
            continue

        # 引用
        if stripped.startswith("> "):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.5)
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(stripped[2:])
            set_run_font(run, size=9.5, color=GRAY)
            run.italic = True
            i += 1
            continue

        # 列表
        m = re.match(r"^(\s*)([-*])\s+(.*)$", line)
        if m:
            indent = len(m.group(1))
            text = m.group(3)
            level = min(2, indent // 2)
            # 验收项：☐ / ☑ 单独排版，避免和项目符号叠加
            if text.startswith("[ ] ") or text.startswith("[x] "):
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.7 + 0.5 * level)
                p.paragraph_format.first_line_indent = Cm(-0.45)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.line_spacing = 1.3
                mark = "☐ " if text.startswith("[ ]") else "☑ "
                add_inline(p, mark + text[4:], size=10.2, color=DARK)
                i += 1
                continue
            styles = ["List Bullet", "List Bullet 2", "List Bullet 3"]
            try:
                p = doc.add_paragraph(style=styles[level])
            except KeyError:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.6 + 0.5 * level)
                p.add_run("• ")
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.3
            add_inline(p, text, size=10.2, color=DARK)
            i += 1
            continue

        m = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if m:
            level = min(2, len(m.group(1)) // 2)
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.7 + 0.5 * level)
            p.paragraph_format.first_line_indent = Cm(-0.5)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.35
            add_inline(p, m.group(2) + ". " + m.group(3), size=10.2, color=DARK)
            i += 1
            continue

        # 普通段落
        if stripped:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.45
            add_inline(p, stripped, size=10.5, color=DARK)
        i += 1


# --------------------------------------------------------------------------- main
def main():
    md_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "docs", "PRD-王者教研室-V2.1.1.md"))
    out_path = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, "..", "王者教研室-PRD-v2.1.1.docx"))

    with open(md_path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    toc_entries = []
    for line in lines:
        if line.startswith("## "):
            toc_entries.append((1, line[3:].strip()))
        elif line.startswith("### "):
            toc_entries.append((2, line[4:].strip()))

    doc = Document()
    setup_page(doc)
    setup_styles(doc)
    add_cover(doc)
    add_toc(doc, toc_entries)
    parse_markdown(doc, md_path)

    doc.core_properties.title = "王者教研室 App 产品需求文档（PRD）"
    doc.core_properties.subject = "V2.1.1 基线 + V2.2 规划"
    doc.core_properties.author = "王者教研室项目"
    doc.core_properties.comments = "个人项目 PRD，非商业发布材料"
    doc.save(out_path)
    print("saved:", out_path, "| paragraphs:", len(doc.paragraphs), "| tables:", len(doc.tables))


if __name__ == "__main__":
    main()
