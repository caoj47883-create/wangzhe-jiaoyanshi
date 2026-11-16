# DESIGN.md — 王者教研室 V2.6

## Direction

克制、工具优先的「飞书工作台」：移动端信息密度高，但层级清楚；品牌只体现在标题与内容里，不用装饰性金色、玻璃、渐变或游戏化发光。

- Mode: Operate（完成 BP、查英雄、出装、看阵容）
- Reference: Feishu / ByteDance product surfaces — neutral ground, white work surfaces, one blue accent, compact rows.
- Signature move: the page title + one-line status at the top of each workspace, followed by a full-width working surface.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f6f7` | `#17181a` |
| `--surface` | `#ffffff` | `#232426` |
| `--surface-2` | `#f2f3f5` | `#2c2e31` |
| `--ink` | `#1f2329` | `#f0f1f2` |
| `--muted` | `#646a73` | `#a6a9ad` |
| `--faint` | `#8f959e` | `#7f838a` |
| `--line` | `#e5e6eb` | `#34363a` |
| `--blue` | `#3370ff` | `#4c88ff` |
| `--blue-soft` | `#e8f0ff` | `#1b2a44` |
| `--r` | `10px` | `10px` |

## Type

- System UI sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
- Page title `1.3rem / 600`; section title `0.96rem / 600`; body `0.8rem / 400`; caption `0.68rem`.
- Chinese copy uses `·` only as a separator inside metadata, never as decoration.

## Layout

- 390px reference width; 16px outer gutters; 10px card radius; 1px borders.
- Bottom nav is a persistent 56px surface bar on tab pages, hidden on sub-pages.
- Cards are work surfaces, not decorative containers: title row, optional metadata, then content.
- Lists use compact 44–56px rows with 1px separators; avoid nested cards unless the group is a distinct entity.
- Home: search → focus card → workbench list → comp rail → coach list → recent. No stats strip, no brand chrome.

## Components

- Primary button: solid blue, white text, 8px radius, 40px height.
- Secondary button: surface with 1px line.
- Chips: surface-2, 8px radius; active uses blue-soft + blue text.
- Empty state: dashed `--line` container on `--surface-2`; one short explanation + one action.
- Tags: 6px radius; neutral or blue-soft; red only for destructive/banned context.

## Motion

- 120–180ms ease-out for press/focus; no bounce or elastic easing.
- Pressed surface: `scale(.98)` or a background shift; no glow.
- Page transitions are immediate; no decorative parallax.

## Accessibility / quality floor

- All icon-only controls have `aria-label`; tab buttons expose `aria-current="page"`.
- Minimum text contrast on both themes; disabled controls use neutral text, not translucent blue.
- No horizontal overflow at 390px; bottom nav never covers the last scrollable row.
- Data-heavy screens must keep real values visible; never replace them with decorative placeholders.
