import { useMemo, useState } from "react";
import { PageHead, SectionHead } from "../components/common.jsx";
import { Icon } from "../components/icons.jsx";
import { useApp } from "../lib/store.js";

const CANYON_MAP = "/map/canyon.jpg";
const SOURCE_URL = "https://www.bilibili.com/video/BV1S7BiYDEuC";

/* 地图底图是 900×500，覆盖层沿用同一套坐标。 */
const LANES = [
  {
    id: "clash",
    label: "对抗路",
    role: "战士 / 坦克",
    icon: "shield",
    kicker: "一条长线，先抢线再决定传送",
    summary:
      "对抗路不是“守住就行”。你先算线权，才有资格拿空间之灵、开传送阵、帮中路；没有线权，塔下补刀比硬接更值。",
    formula: "线权 → 空间之灵 → 传送阵 → 带线牵制",
    routeNote: "蓝方 → 左路抢线 → 空间之灵 → 传送阵 → 中路",
    routeExtra: "有线权再从河道进敌方野区；没线权就收线回塔。",
    path: "M 165 445 C 135 390 135 310 155 240 C 180 150 270 75 390 55 C 520 35 650 40 735 55",
    path2: "M 245 215 C 305 240 355 275 415 300 C 465 320 515 320 560 300",
    nodes: [
      { x: 165, y: 445, label: "蓝方", kind: "base" },
      { x: 735, y: 55, label: "红方", kind: "base" },
      { x: 250, y: 330, label: "抢线", kind: "tower" },
      { x: 235, y: 205, label: "空间之灵", kind: "resource" },
      { x: 390, y: 95, label: "传送阵", kind: "portal" },
    ],
    points: [
      "0–4 分钟：第一波线先到先抢；1:00 空间之灵首刷，之后每 60 秒刷一次到 4:00，击杀才开传送阵。能拿就拿，别为一个野怪交闪。",
      "4–10 分钟：空间之灵还活着就继续控；传送阵开了再看小地图，优先传发育路或龙团；没线权就塔下发育，别硬接。",
      "10 分钟后：边线是 131/41 的牵制位，带线前先确认敌方视野和队友位置。",
    ],
  },
  {
    id: "jungle",
    label: "打野",
    role: "节奏 / 控资源",
    icon: "swords",
    kicker: "30 秒定开局，1 分钟看中路",
    summary:
      "打野的强弱不在刷得多快，而在“什么时候出现在哪”。先判断敌方红开还是蓝开，1:00 前后看中路有没有线权，再决定帮中、反蹲还是转边。",
    formula: "30s 开野 → 1:00 中路窗口 → 2:00 Buff → 4:00 龙",
    routeNote: "蓝方 → 蓝/红开 → 1:00 中路窗口 → 4 分钟暴君",
    routeExtra: "同边开镜像推断敌方位置；不同边开，敌方动向相反。",
    path: "M 165 445 C 205 405 235 375 280 345 C 325 315 370 285 420 255 C 460 230 495 215 530 200",
    path2: "M 280 345 C 330 375 390 390 450 375 C 510 360 550 325 585 285",
    nodes: [
      { x: 165, y: 445, label: "蓝方", kind: "base" },
      { x: 280, y: 345, label: "蓝/红开", kind: "buff" },
      { x: 395, y: 275, label: "1:00 中路", kind: "tower" },
      { x: 470, y: 235, label: "2:00 Buff", kind: "buff" },
      { x: 585, y: 285, label: "4:00 暴君", kind: "objective" },
    ],
    points: [
      "30 秒决定红/蓝开；1:00 前后刷完半片野区，先看中路有没有线权。",
      "1:00 中路线权窗口：中路先清线就帮中清线/反蹲，没线权就回半区或转边；中路线权决定第一波河道视野和资源。",
      "1:30 刷完第一轮，2:00 带 Buff 是第一个强势点；2 分钟看线权，弱线抓身位靠前的敌人，强线配合队友进敌方野区。",
      "4 分钟必争暴君；拿龙后推塔/入侵/换线，别原地回家。",
    ],
  },
  {
    id: "mid",
    label: "中路",
    role: "线权 / 转边",
    icon: "spark",
    kicker: "谁先清完线，谁先动",
    summary:
      "中路兵线最短，4 分钟前一波 4 个兵；先清线的人先有资格转边。别在中路站着看，清完线就去帮有线权的一边，或者先占河道视野。",
    formula: "清线 → 先动 → 转边 → 河道视野",
    routeNote: "蓝方 → 中路清线 → 转发育路 → 河道视野",
    routeExtra: "转对抗路可以坐传送阵，少走河道，降低被蹲风险。",
    path: "M 165 445 L 250 380 L 340 315 L 435 245 L 535 170 L 635 100 L 735 55",
    path2: "M 435 245 C 490 285 550 310 610 310",
    nodes: [
      { x: 165, y: 445, label: "蓝方", kind: "base" },
      { x: 250, y: 380, label: "清线", kind: "tower" },
      { x: 380, y: 295, label: "先动", kind: "buff" },
      { x: 530, y: 190, label: "转边", kind: "portal" },
      { x: 500, y: 250, label: "河道视野", kind: "resource" },
    ],
    points: [
      "0–4 分钟：中路先到线就有先动权；4 分钟前一波 4 个兵，清完线再决定帮哪边，别原地等兵。",
      "1:00 打野第一波节奏会看中路：你先清线，他就能帮中/反蹲；你没线权，别硬压河道。",
      "4–10 分钟：线优直接转发育路以多打少；转对抗路可坐传送阵，少走河道。",
      "10 分钟后：站住河道视野，先给视野再开团，别第一个露头。",
      "当前版本中路没有河道之灵，别按旧攻略在河道等资源。",
    ],
  },
  {
    id: "farm",
    label: "发育路",
    role: "射手 / 推塔",
    icon: "target",
    kicker: "先活下来，再谈输出",
    summary:
      "发育路的钱和塔都要，但顺序别反：先抢线、抢 30 秒红隼，再靠龙团和推塔把优势变成地图优势。",
    formula: "抢线 → 红隼 → 4:00 暴君 → 推塔",
    routeNote: "蓝方 → 下路抢线 → 红隼 → 4 分钟暴君 → 推塔",
    routeExtra: "没有辅助视野时别独自压线；4 分钟龙团提前靠，不要最后才到。",
    path: "M 165 445 C 230 470 310 485 395 480 C 495 475 575 450 640 405 C 700 360 735 290 735 210 C 735 145 735 90 735 55",
    path2: "M 395 480 C 450 455 505 415 550 370 C 585 335 610 300 630 265",
    nodes: [
      { x: 165, y: 445, label: "蓝方", kind: "base" },
      { x: 300, y: 470, label: "抢线", kind: "tower" },
      { x: 650, y: 430, label: "红隼", kind: "resource" },
      { x: 585, y: 300, label: "4:00 暴君", kind: "objective" },
      { x: 700, y: 220, label: "推塔", kind: "tower" },
    ],
    points: [
      "0–4 分钟：抢线权；30 秒红隼刷新，全局只有一次、125 金币全队分，能抢就抢；辅助不在就塔下补刀。",
      "4 分钟暴君团：提前靠，3–5 人 rua 龙，别让打野单开。",
      "8–9 分钟第二条暴君；10 分钟前只做推进和发育，别乱接团。",
    ],
  },
  {
    id: "roam",
    label: "游走",
    role: "视野 / 开团",
    icon: "users",
    kicker: "先让队友舒服，再谈开团",
    summary:
      "游走的路线不是“到处逛”，而是帮线权、守野区、占河道视野。你先把视野做出来，队友才敢压、打野才敢进。",
    formula: "帮抢线 → 守野 → 河道视野 → 开团/保排",
    routeNote: "蓝方 → 中路帮线 → 守野 → 河道视野 → 开团/保排",
    routeExtra: "别一个人进敌方野区；先和打野/中路形成两人视野，再往深处走。",
    path: "M 165 445 L 250 380 L 340 315 L 430 250 L 520 190 L 610 130 L 680 90",
    path2: "M 430 250 C 380 230 330 220 280 215 M 430 250 C 485 280 525 315 555 350",
    nodes: [
      { x: 165, y: 445, label: "蓝方", kind: "base" },
      { x: 250, y: 380, label: "帮抢线", kind: "tower" },
      { x: 345, y: 315, label: "守野", kind: "buff" },
      { x: 470, y: 230, label: "河道视野", kind: "resource" },
      { x: 610, y: 130, label: "开团/保排", kind: "objective" },
    ],
    points: [
      "0–4 分钟：先帮中路抢线，再看自家打野红/蓝开；30 秒红隼可以帮发育路抢。",
      "4 分钟龙团先占河道视野；谁线权谁先动，别一个人进敌方野区。",
      "10 分钟后：保排/开团二选一，先给视野再开，别追残血。",
      "当前版本没有中路河道之灵；游走别按旧版本在河道等刷。",
    ],
  },
];

const FORMULAS = [
  {
    key: "线权",
    title: "先看线，再看人",
    lines: ["线优：敌方资源 → 中立 → 自家", "55 开：先拿自家", "线劣：放资源，换半图"],
  },
  {
    key: "打野",
    title: "1 分钟看中路",
    lines: ["30 秒决定红/蓝开", "1:00 中路先清线就帮中", "1:30 刷完 → 2:00 带 Buff"],
  },
  {
    key: "龙团",
    title: "4 分钟分水岭",
    lines: ["3–5 人 rua 龙，别单开", "拿龙 → 推塔/入侵/换线", "8–9 分第二条，10 分双龙"],
  },
  {
    key: "终结",
    title: "20 分钟龙王",
    lines: ["优势不拖，均势逼团", "黑暗暴君 → 131/41", "压高地后再拿主宰"],
  },
];

const COLLECTION = [
  { index: "01", title: "总纲 · 24 分钟", sub: "线权、资源、半区、时间点一次讲完", tag: "本篇" },
  { index: "02", title: "打野 · KPL 打野", sub: "开局路线、1:00 中路窗口、抓人时间", tag: "合集" },
  { index: "03", title: "对抗路 · 对线细节", sub: "抢线、空间之灵、传送阵和支援时机", tag: "合集" },
  { index: "04", title: "中路 · 线权与转线", sub: "先动一步，帮双边打出优势", tag: "合集" },
  { index: "05", title: "发育路 · 一诺", sub: "发育节奏、输出位置、团战站位", tag: "合集" },
  { index: "06", title: "游走 · 视野与开团", sub: "保排、开团、野区防守", tag: "合集" },
];

function openExternal(url) {
  if (window.AppBridge?.openExternal) window.AppBridge.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function openSource() {
  openExternal(SOURCE_URL);
}

function openCollection(item) {
  if (item.index === "01") {
    openSource();
    return;
  }
  const keyword = encodeURIComponent(`王者教科书 ${item.title.split("·")[0].trim()}`);
  openExternal(`https://search.bilibili.com/all?keyword=${keyword}`);
}

function FormulaMap({ lane }) {
  return (
    <div className="fm-map-canvas">
      <img src={CANYON_MAP} alt="王者峡谷地图" draggable={false} />
      <svg className="fm-map-svg" viewBox="0 0 900 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <marker id="fm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <g className="fm-old-label-cover" aria-hidden="true">
          <rect x="290" y="98" width="112" height="38" rx="8" />
          <rect x="174" y="192" width="112" height="36" rx="8" />
          <rect x="472" y="222" width="110" height="36" rx="8" />
          <rect x="540" y="284" width="108" height="36" rx="8" />
        </g>
        <g className="fm-route-ghosts">
          {LANES.filter((x) => x.id !== lane.id).map((x) => (
            <path key={x.id} d={x.path} />
          ))}
        </g>
        <g className="fm-route">
          <path className="fm-route-glow" d={lane.path} />
          <path className="fm-route-line" d={lane.path} markerEnd="url(#fm-arrow)" />
          <path className="fm-route-line fm-route-alt" d={lane.path2} />
        </g>
        <g className="fm-nodes">
          {lane.nodes.map((node) => (
            <g key={`${node.x}-${node.y}-${node.label}`} className={`fm-node fm-node-${node.kind}`} transform={`translate(${node.x},${node.y})`}>
              <circle r={node.kind === "base" ? 13 : node.kind === "objective" ? 11 : 8} />
              <text y={-16}>{node.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function Formula() {
  const { back } = useApp();
  const [laneId, setLaneId] = useState("clash");
  const lane = useMemo(() => LANES.find((x) => x.id === laneId) || LANES[0], [laneId]);

  return (
    <div className="page formula-page">
      <PageHead
        eyebrow="FORMULA"
        title="公式化打法"
        sub="按分路拆公式，打开地图看路线"
        onBack={back}
      />
      <div className="page-inner formula-inner">
        <section className="fm-hero">
          <p className="fm-kicker">王者教科书 · 24 分钟总纲</p>
          <h2>先看你走哪条路，再看这条路怎么赢</h2>
          <p>
            线权、资源、半区、时间点，最后都要落到你的分路上。别把「去哪」当第一步——先算线，再决定去哪。
          </p>
          <div className="fm-chain">
            <span>线权</span><i>→</i><span>资源</span><i>→</i><span>半区</span><i>→</i><span>塔 / 龙</span>
          </div>
        </section>

        <div className="fm-lane-tabs" role="tablist" aria-label="选择分路">
          {LANES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === lane.id}
              className={`fm-lane-tab ${item.id === lane.id ? "on" : ""}`}
              onClick={() => setLaneId(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <section className="fm-board">
          <div className="fm-board-head">
            <div>
              <p className="fm-board-kicker">{lane.role}</p>
              <h3>{lane.label} · 路线图</h3>
            </div>
            <div className="fm-legend">
              <span><i className="dot dot-blue" />当前路线</span>
              <span><i className="dot dot-line" />其他分路</span>
            </div>
          </div>
          <FormulaMap lane={lane} />
          <div className="fm-board-foot">
            <p>{lane.routeNote}</p>
            <span>蓝方视角 · 红方镜像</span>
          </div>
        </section>

        <section className="fm-lane-card">
          <div className="fm-lane-card-head">
            <div>
              <p className="fm-lane-kicker">{lane.kicker}</p>
              <h2>{lane.label}公式</h2>
            </div>
            <span className="fm-lane-role">{lane.role}</span>
          </div>
          <p className="fm-lane-summary">{lane.summary}</p>
          <div className="fm-lane-formula">{lane.formula}</div>
          <ul className="fm-points">
            {lane.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
          <p className="fm-lane-extra">{lane.routeExtra}</p>
        </section>

        <section className="fm-section">
          <SectionHead title="通用公式" sub="换哪条路都用得上" />
          <div className="fm-formula-grid">
            {FORMULAS.map((item) => (
              <article className="fm-formula-card" key={item.key}>
                <span>{item.key}</span>
                <h3>{item.title}</h3>
                {item.lines.map((line) => <p key={line}>{line}</p>)}
              </article>
            ))}
          </div>
        </section>

        <section className="fm-section">
          <SectionHead title="王者教科书合集" sub="按位置继续看" />
          <div className="fm-collection">
            {COLLECTION.map((item) => (
              <button type="button" className="fm-collection-row" key={item.index} onClick={() => openCollection(item)}>
                <span className="fm-collection-index">{item.index}</span>
                <div className="fm-collection-main">
                  <strong>{item.title}</strong>
                  <p>{item.sub}</p>
                </div>
                <span className={`fm-collection-tag ${item.tag === "本篇" ? "is-now" : ""}`}>{item.tag}</span>
                <Icon name={item.tag === "本篇" ? "arrowUpRight" : "chevronRight"} />
              </button>
            ))}
          </div>
        </section>

        <p className="fm-source">
          整理自 B 站「神奇教学在这里」《两个月万字稿，用24分钟提升全体王者荣耀玩家的理解》及公开文字稿。
          资源名称与刷新时间已按 2026-11 当前版本核对：中路无河道之灵，发育路红隼、对抗路空间之灵；打野 1:00 中路线权窗口为当前节奏补充。
          地图底图来自公开攻略素材，路线为分路示意；具体数值以游戏内为准。
        </p>
        <button type="button" className="fm-source-btn" onClick={openSource}>
          <Icon name="arrowUpRight" />
          打开原视频
        </button>
      </div>
    </div>
  );
}
