/**
 * 뇌 지도 — dobbin 의 **전체 구조**를 뇌 모양으로 그린다 (v10 ㅈ′ · 2026-09-09).
 *
 * 한빈: *"신경 지도의 디자인은 두뇌의 형태로. 질문을 하면 어떤 신경이 밝아지고
 * 움직이고 반응하는지 동적으로. 깊이·구조가 너무 얕다 — 세부 신경도 모두.
 * 하네스와 dobbin 의 두뇌가 어디까지 구현됐는지 시각적으로."*
 *
 * 🔴 그리는 값은 전부 **서버가 잰 것**이다 (`/api/brainmap`) — 수는 서버
 *    등록부가 정본이므로 여기 적지 않는다 (적으면 낡는다 · 2026-09-11).
 *    색=상태 · 자리=영역(뇌간·전두·측두·두정·후두·언어·소뇌·겉질).
 *    말을 걸면 그 턴에 울린 신경이 **번쩍이고 신호가 사슬을 타고 흐른다**.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { onLive } from '../../web/liveSync';
import './brain.css';

type Node = {
  id: string; kind: string; sub?: string; region: string; status: string;
  stage?: number; stage_why?: string;
  order?: number; n?: number | null; hit?: number | null;
  miss?: Record<string, number>; mod?: string; why?: string;
  수용체?: string[]; 자극?: string[];
  label?: string; sse?: string | null; rc?: number | null;
  줄수?: number; 부름받음?: number; 부모?: string | null;
  target?: string; owner?: string; grade?: string; src?: string | null;
  // 🔴 서버가 이미 보내는데 화면이 **다시 계산**하던 칸 (2026-09-11 전수 대조)
  layer?: string | null; equip?: boolean; aim?: string;
};
type Edge = { a: string; b: string; kind: string; n?: number;
  /** "static" = 코드에 있다(정적 분석) — 실측된 이음과 다르다 */
  grade?: string };
type Region = { label: string; cx: number; cy?: number; hue: number; layer?: string | null };
type Layer = { label: string; cy: number; hue: number; why?: string };
type Map = {
  regions: Record<string, Region>; layers?: Record<string, Layer>;
  nodes: Node[]; edges: Edge[];
  built_at?: string; registry_error?: string | null;
  maturity?: { 단계: string[]; 셈: Record<string, number>; 합: number;
               손CLI?: number; 덮음?: { 기관: number; 전체: number } };
  counts?: { 뇌?: number; 조작?: number; 장비?: number; 전체?: number;
              장비파일?: number; 장비줄?: number; 탐침?: number };
  /** kind → [갈래, 설명] — 자국 띠의 정본 (서버 TRACE_LANES) */
  trace_lanes?: Record<string, [string, string]>;
  /** 🔴 `_밖` 은 영역이 아니라서 census Record 에서 분리됐다 (2026-09-11) */
  outside?: { 수?: number; 줄수?: number; 큰것?: [number, string][];
              이름밖?: number; 이름밖그림?: number;
              이름밖큰것?: [number, string][]; 왜?: string };
  matrix?: { 측정?: number; 자극?: number; 명중?: number; 오배선?: number;
             신경전체?: number; 문?: number; 문표시?: number;
             잰때?: string | null; 출처?: string };
  tally?: Record<string, number>;
  census?: Record<string, {
    칸: number; 그린모듈: number; 모듈: number; 딴데?: number; 줄수: number;
    성숙도: Record<string, number>; 왜: string; 갈래: string;
    판정?: Record<string, number>;
    큰것: [number, string][];
  }>;
};

/** 🔴 **자국 띠** — 한빈 2026-09-10: *"개발/편집/수정/활동신호 등을 **실시간**
 *  으로 안정성 있게 보여줘야 한다."*
 *
 *  지금까지 실시간은 **5.2초 번쩍임**뿐이었다. 화면을 안 보고 있었으면 그
 *  일은 **일어나지 않은 것과 같다** — 「실시간」이 곧 「휘발」이었다.
 *  SSE 를 시각과 함께 쌓아, 자리를 비웠다 와도 무슨 일이 있었는지 읽는다.
 *
 *  네 갈래는 한빈이 말한 그대로 가른다. 갈래를 못 정하는 kind 는 **버리지
 *  않고** 「활동」으로 둔다 — 안 보이는 것보다 갈래가 거친 것이 낫다. */
// 🔴 **갈래 표의 정본은 서버다** (`graph()["trace_lanes"]` · 2026-09-11).
// 전에는 여기 제 표를 들었다 — 없앤 `MOTOR_SSE` 와 같은 병: 서버가 새 kind 를
// 쏘면 화면은 모른 채 「활동」으로 뭉갠다. 받은 표가 없을 때의 마지막 물러섬만
// 남긴다 (첫 fetch 전 SSE 가 먼저 올 수 있다).
const LANE_FALLBACK: [string, string] = ['활동', ''];
type Trace = { at: string; lane: string; kind: string; what: string };

const W = 980, H = 700;
/** 뇌가 차지하는 세로 — 아래 나머지는 **장비 띠**다 (뇌가 아니다). */
const BRAIN_TOP = 24, BRAIN_BOT = 556, EQUIP_TOP = 586;

/* 🔴 **화면의 조작 표를 버렸다** (2026-09-10). 여기 `MOTOR_SSE` 라는 두 번째
   표를 들고 있어서, 서버가 이름을 고치자 **4개는 켤 노드가 없고 4개는 영영
   못 켜지는** 어긋남이 생겼다. 「같은 표를 두 곳에 두지 않는다」— 이제 서버가
   노드마다 `sse` 를 실어 보내고 화면은 그것으로만 잇는다. */


/** 영역이 차지하는 반지름 — **식구 수에서 받는다**. 손으로 적어 두면 신경이
 *  늘 때마다 겉선 밖으로 흐른다 (앞 판이 그랬다). */
function lobeR(n: number): [number, number] {
  const k = Math.sqrt(Math.max(n, 1));
  return [Math.min(122, 22 + k * 11), Math.min(80, 17 + k * 7.5)];
}

/** 이음 종류 → 그릴 꼴. 서버가 여덟 가지를 보낸다 (앞 판은 셋만 알았다). */
const EDGE_CLS: Record<string, string> = {
  '오배선': 'bad', '공급': 'feed', '사슬': 'chain',
  '부름': 'call', '검증': 'gate', '걸음': 'feed', '일함': 'call',
  '일으킴': 'act', '빚': 'debt', '위계': 'tree',
};

/** 이음 범례 — 무엇이 무엇인지 화면에 적는다 */
const EDGE_LEGEND: [string, string][] = [
  ['부름', '이 모듈이 저 모듈을 부른다 (코드에 있다)'],
  ['공급', '이 기관이 저 신경에 재료를 준다'],
  ['검증', '이 관문이 저 모듈을 잰다'],
  ['걸음', '이 일과에 속한 걸음이다'],
  ['일함', '이 걸음이 저 모듈을 만진다'],
  ['일으킴', '이 모듈이 저 자국을 남긴다'],
  ['빚', '이 할 일이 저 신경에 걸려 있다'],
  ['위계', '이 갈래에 속한 신경이다'],
  ['사슬', '답을 고르는 차례 — 앞이 이긴다'],
  ['오배선', '의도한 신경 대신 저 신경이 먹었다'],
];

const STATUS: Record<string, { c: string; t: string }> = {
  ok:       { c: '#3ecf8e', t: '의도대로 돈다' },
  part:     { c: '#e3b341', t: '일부만' },
  red:      { c: '#f0574a', t: '오배선 — 고칠 것' },
  dark:     { c: '#6b7280', t: '아직 못 잼' },
  idle:     { c: '#586074', t: '요즘 안 돌았다' },
  nomeas:   { c: '#7c8598', t: '재는 자가 없다' },
  unknown:  { c: '#4b5563', t: '모른다 (근거 없음)' },
  todo:     { c: '#8b5cf6', t: '선언만 — 빈칸' },
  planned:  { c: '#ff8ac4', t: '차례를 기다리는 할 일' },
  building: { c: '#ffd166', t: '지금 만드는 중' },
  fold:     { c: '#8fa6d8', t: '접혀 있다 — 눌러서 편다' },
};

/** ── 자비스 홀로그램 배치 (v15 · 한빈 2026-09-11) ──────────────────────
 *
 * *"실시간 신경 구현 디자인을 어벤져스 영화의 자비스 인터페이스를 참조하여."*
 * 색은 현재 파랑 계열 유지 — 가져온 것은 **형태 언어**다: 동심 링·호 구획·
 * 눈금·입자·발광·느린 회전.
 *
 * 층 3단 가로 띠 → **동심 링 3겹**: 구심(들어오는 길)=바깥 · 연합=가운데 ·
 * 원심(나가는 길)=안. 중심은 dobbin 코어. 영역(엽)은 링 위의 **호 구획** —
 * 각도 범위가 식구 수에 비례한다. 장비·서비스 띠는 그대로 아래 선반이다
 * (뇌가 아닌 것은 **모양**부터 다르다).
 *
 * 🔴 노드 좌표는 여전히 결정론이다 (황금비 저불일치 수열) — 같은 지도를
 *    다시 열어도 같은 자리. 서버 값 계약은 한 글자도 안 바꿨다.
 */
const CX = W / 2, CY = (BRAIN_TOP + BRAIN_BOT) / 2;
/** 층 → [안 반지름, 바깥 반지름]. 바깥 끝 258 ≤ 화면 여유 266. */
const RINGS: Record<string, [number, number]> = {
  '원심': [56, 104], '연합': [133, 197], '구심': [218, 258],
};
/** 장비 위성 호 — 뇌 링 밖 아래 반원. 아래 끝 290+334=624 ≤ 700. */
const EQUIP_RING: [number, number] = [288, 334];

type Lobe = { cx: number; cy: number; rx: number; ry: number; hue: number;
              label: string; n: number; equip: boolean;
              /** 호 구획 — 뇌 안 영역만 갖는다 (장비 선반은 없다) */
              arc?: { a0: number; a1: number; r0: number; r1: number } };

function lobes(nodes: Node[], regions: Record<string, Region>,
               _layers: Record<string, Layer>): Record<string, Lobe> {
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  const out: Record<string, Lobe> = {};
  // 층마다 그 층의 영역을 모아 링 위에서 각도를 배분한다
  const perLayer: Record<string, [string, number][]> = {};
  Object.entries(byR).forEach(([r, list]) => {
    const reg = regions[r]; if (!reg) return;
    const equip = list[0]?.equip ?? !reg.layer;
    if (equip || !reg.layer || !RINGS[reg.layer]) {
      // 🔴 **장비도 뇌를 중심으로** (한빈 2026-09-11: *"장비 부분 노드도
      //    뇌 디자인을 중심으로 배치를 달리해서 영역별로 구분해라"*).
      //    가로 줄에서 겹치던 것을 **바깥 하단 호**(위성 링)로 — 뇌 링과
      //    같은 문법이되 반지름이 달라 「뇌가 아니다」가 모양에서 읽힌다.
      (perLayer['장비'] ||= []).push([r, list.length]);
      return;
    }
    (perLayer[reg.layer] ||= []).push([r, list.length]);
  });
  Object.entries(perLayer).forEach(([layer, regs]) => {
    const equipRing = layer === '장비';
    const [r0, r1] = equipRing ? EQUIP_RING : RINGS[layer];
    // 서버의 cx(0~1) 차례를 지킨다 — 링이 바뀌어도 이웃 관계가 남는다
    regs.sort((a, b) => (regions[a[0]].cx ?? 0) - (regions[b[0]].cx ?? 0));
    const GAP = 0.10;                                   // 구획 사이 틈 (rad)
    const total = regs.reduce((a, [, n2]) => a + Math.max(n2, 3), 0);
    // 장비 호는 온바퀴가 아니라 **아래 반원**만 쓴다 (SVG 는 y 가 아래로 +)
    const sweep = equipRing ? Math.PI * 0.72 : Math.PI * 2;
    const avail = sweep - GAP * regs.length;
    // 링마다 시작각을 어긋내 구획 경계가 겹줄로 안 보이게
    let a = equipRing ? Math.PI * 0.14
          : -Math.PI / 2 + (layer === '연합' ? 0.35 : layer === '원심' ? 0.9 : 0);
    regs.forEach(([r, n2]) => {
      const span = avail * Math.max(n2, 3) / total;
      const mid = a + span / 2, rm = (r0 + r1) / 2;
      out[r] = { cx: CX + rm * Math.cos(mid), cy: CY + rm * Math.sin(mid),
                 rx: (r1 - r0) / 2, ry: (r1 - r0) / 2,
                 hue: regions[r].hue, label: regions[r].label,
                 n: byR[r].length, equip: equipRing,
                 arc: { a0: a, a1: a + span, r0, r1 } };
      a += span + GAP;
    });
  });
  return out;
}

/** 결정론 배치 — 호 구획 안에 황금비 저불일치 수열로 흩는다. */
function place(nodes: Node[], lb: ReturnType<typeof lobes>) {
  const pos: Record<string, { x: number; y: number }> = {};
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  Object.entries(byR).forEach(([r, list]) => {
    const L = lb[r]; if (!L) return;
    list.forEach((n, i) => {
      if (L.arc) {
        const { a0, a1, r0, r1 } = L.arc;
        const u = (i * 0.6180339887) % 1;             // 황금비 — 각도
        const v = (i * 0.7548776662) % 1;             // 플라스틱 수 — 반지름
        const th = a0 + (a1 - a0) * (0.09 + 0.82 * u);
        const rr = r0 + (r1 - r0) * (0.16 + 0.68 * v);
        pos[n.id] = { x: CX + rr * Math.cos(th), y: CY + rr * Math.sin(th) };
      } else {
        const a = i * 2.399963;                       // 황금각 (선반)
        const t = Math.sqrt((i + 0.5) / list.length);
        pos[n.id] = { x: L.cx + L.rx * 0.84 * t * Math.cos(a),
                      y: L.cy + L.ry * 0.82 * t * Math.sin(a) };
      }
    });
  });
  return pos;
}

/** 호 구획의 SVG path (도넛 조각). */
function arcPath(a0: number, a1: number, r0: number, r1: number): string {
  const p = (r: number, a: number) =>
    `${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a)).toFixed(1)}`;
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)} A${r1},${r1} 0 ${big} 1 ${p(r1, a1)} `
       + `L${p(r0, a1)} A${r0},${r0} 0 ${big} 0 ${p(r0, a0)} Z`;
}

/** 홀로그램 장식 입자 — 결정론 (매 렌더 같은 자리). */
function holoDots(): { x: number; y: number; r: number; o: number }[] {
  const out = [];
  for (let i = 0; i < 46; i++) {
    const th = (i * 2.399963) % (Math.PI * 2);
    const rr = 48 + ((i * 0.7548776662) % 1) * 214;
    out.push({ x: CX + rr * Math.cos(th), y: CY + rr * Math.sin(th),
               r: 0.7 + ((i * 0.618034) % 1) * 1.1,
               o: 0.12 + ((i * 0.324717) % 1) * 0.25 });
  }
  return out;
}

export function BrainMap() {
  const [m, setM] = useState<Map | null>(null);
  // 🔴 노드 **객체**를 잡으면 지도가 갱신돼도 상세칸이 옛 값을 보였다 (A18)
  //    — id 만 잡고 렌더마다 지금 지도에서 찾는다.
  const [pickId, setPickId] = useState<string | null>(null);
  const [reg, setReg] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [lit, setLit] = useState<string[]>([]);
  /** 자국 띠 — 갈래 표는 서버 `trace_lanes` 가 정본 (한빈 2026-09-10) */
  const [trace, setTrace] = useState<Trace[]>([]);
  // 🔴 **꺼지는 빛에 기대지 않는다.** 앞 판은 요약의 「신경 N개」를 번쩍임
  //    상태(lit)에서 셌는데, 5초 뒤 빛이 꺼지면 «0개»로 바뀌었다 (실측).
  //    그 턴에 울린 수는 **그때 붙잡아** 둔다.
  const [turn, setTurn] = useState<{ trace: string[]; refs: number;
                                     llm: boolean; level: string | null;
                                     organs: string[]; nerves: number;
                                     list: string[] } | null>(null);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<number | null>(null);

  // 🔴 **지도가 실시간이 아니었다** (2026-09-10 적대적 검토). 여기 의존성이
  //    빈 배열이라 **창을 열 때 한 번** 읽고 끝이었다 — 다시 읽는 길이 코드에
  //    하나도 없었다. 관문이 붉어져도, 신경을 달아도, 일과가 돌아도 새로고침
  //    전엔 화면이 그대로였고, 살아 있는 것은 번쩍임뿐이었다.
  //    한빈이 이 화면에 요구한 첫 항목이 *"실시간 개발 현황 파악"* 이다.
  const [at, setAt] = useState<string | null>(null);
  /** 마지막 fetch 실패 시각 — null 이면 정상 (F6 · 조용한 실패 금지) */
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    // 🔴 **몰아치기 막이 + 도는 중 막이** (2026-09-10). 신호마다 곧바로 읽었더니
    //    회귀 한 판(그때 76번 쏘던 것)에 4초짜리 요청이 쌓여 **서버를 때렸다**.
    //    ① 1.5초 안에 겹쳐 오는 신호는 한 번으로 접고
    //    ② 앞 요청이 도는 중이면 **또 부르지 않는다**.
    let inflight = false;
    let timer: number | null = null;
    const raw = () => {
      if (inflight) return;
      inflight = true;
      // 🔴 **타임아웃 없는 fetch 는 영구 잠금이다** (2026-09-11 적대 검토).
      //    요청 하나가 매달리면 inflight 가 영원히 true — SSE 도 심박도 전부
      //    즉시 반환해 그 탭의 지도는 다시는 안 갱신되는데 멀쩡해 보였다.
      const ab = new AbortController();
      const kill = window.setTimeout(() => ab.abort(), 20000);
      return fetch('/api/brainmap', { signal: ab.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => {
        if (dead || !j) return;
        setM(j as Map);
        setErr(null);
        // 🔴 fetch 시각이 아니라 **지은 시각** — 거짓 신선도 금지
        setAt(j?.built_at ? j.built_at.slice(5)
              : new Date().toLocaleTimeString('ko-KR',
                { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      })
        // 🔴 조용히 옛 지도를 두지 않는다 — 「못 읽었다」를 말한다
        .catch(() => { if (!dead) setErr(new Date()
          .toLocaleTimeString('ko-KR', { hour12: false })); })
        .finally(() => { window.clearTimeout(kill); inflight = false; });
    };
    const pull = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(raw, 1500);
    };
    raw();
    // 서버가 «지도가 바뀌었다» 고 쏘면 그때 다시 읽는다
    const off = onLive((ev: any) => {
      // 재접속 — 끊긴 사이 사건은 유실됐다 (SSE 재전송 없음). 다시 읽어 메운다.
      if (ev?.kind === 'brainmap-changed' || ev?.kind === 'reconnected') pull();
    });
    // 🔴 **느린 심박** — 쏘는 자가 놓친 변화(장부가 자란 것 따위)를 위해.
    //    60초는 사람이 화면을 보는 동안 한두 번 도는 값이다.
    const beat = window.setInterval(raw, 60000);
    return () => {
      dead = true;
      window.clearInterval(beat);
      if (timer) window.clearTimeout(timer);
      try { off?.(); } catch { /* 해제가 막혀도 화면은 산다 */ }
    };
  }, []);

  /** 자국은 이름(`판본`)으로 오고 노드 id 는 이름표가 붙었다(`신경:판본`).
   *  둘을 잇는다 — 안 이으면 말을 걸어도 아무 데도 안 켜진다. */
  const byName = useMemo(() => {
    const o: Record<string, string> = {};
    (m?.nodes || []).forEach(n => {
      if (n.label) o[n.label] ??= n.id;
      o[n.id] = n.id;
      if (n.sse) o[`sse:${n.sse}`] = n.id;
    });
    return o;
  }, [m]);
  // 말을 걸면 그 턴에 울린 신경이 번쩍인다
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as
        { fired?: string[]; trace?: string[]; refs?: number; llm?: boolean;
          level?: string | null } | string[] | undefined;
      const ids = Array.isArray(d) ? d : (d?.fired ?? []);
      const trace = Array.isArray(d) ? [] : (d?.trace ?? []);
      // 🔴 **기관 추측표를 버렸다** (2026-09-10). 여기 정규식 10줄로 «어느
      //    기관이 일했나»를 찍고 «지어낸 연출이 아니라 자국» 이라 적어 뒀는데,
      //    서버의 EVIDENCE 와 **3/10만 일치**했다 — 나머지 7은 화면의 창작이다.
      //    (`그거`·`관계`·`수단` 같은 흔한 말이 걸리면 초록이 됐다.)
      //    이제 자국의 «신경 «X» 발화» 를 **서버가 그린 공급 이음**으로 거슬러
      //    올린다 — 추측이 아니라 서버가 이미 그린 선을 따라가는 것이다.
      const firedNames = trace.flatMap(t =>
        [...String(t).matchAll(/신경 «([^»]+)» 발화/g)].map(x => x[1]));
      const nerveIds = [...new Set([...ids, ...firedNames])]
        .map(x => byName[x] || x);
      const organs = [...new Set(nerveIds.flatMap(nid =>
        (m?.edges || []).filter(e => e.kind === '공급' && e.b === nid)
          .map(e => e.a)))];
      if (!nerveIds.length && !organs.length) return;
      // 🔴 **접는다** — 신경과 기관 이름이 겹치면 「신경 2개」라 적고 1개만
      //    나열하던 어긋남이 여기서 났다.
      setLit([...new Set([...nerveIds, ...organs])]); setPulse(p => p + 1);
      setTurn({ trace, refs: (Array.isArray(d) ? 0 : d?.refs ?? 0),
                llm: Array.isArray(d) ? false : !!d?.llm,
                level: Array.isArray(d) ? null : (d?.level ?? null),
                // 🔴 목록도 그때 붙잡는다 — 살아 있는 lit 을 읽으면 5.2초 뒤
                //    빈 괄호가 되고, 다음 사건이 앞 턴 괄호에 섞였다 (A4)
                organs, nerves: nerveIds.length, list: nerveIds });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLit([]), 5200);
    };
    window.addEventListener('dobbin:fired', on as EventListener);
    // 🔴 **실시간** (v11 D1 · 한빈 «대화하거나 판단할 때 실시간으로»).
    //    답이 끝난 뒤가 아니라 **생각하는 도중** 켠다 — SSE 의 `thinking`
    //    걸음이 0.4초 안에 온다. 대화가 아닐 때(자율 걸음)도 같은 통로다.
    const off = onLive((ev: any) => {
      // 재접속 신호는 fetch 효과가 받는다 — 자국 띠에는 안 적는다 (사건 아님)
      if (ev?.kind === 'reconnected') return;
      // 🔴 **자국부터 남기고** 불을 켠다 — 빛은 5.2초 뒤 꺼지지만 자국은 남는다.
      if (ev?.kind) {
        const [lane, why] = m?.trace_lanes?.[ev.kind]
          || [LANE_FALLBACK[0], ev.kind];
        const what = ev.step || ev.nerve || ev.path || ev.name || why;
        setTrace(prev => [{
          at: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          lane, kind: ev.kind, what: String(what).slice(0, 60),
        }, ...prev].slice(0, 40));
      }
      if (ev?.kind === 'thinking') {
        const id = ev.nerve
          || /신경 «([^»]+)» 발화/.exec(String(ev.text || ''))?.[1];
        if (!id) return;
        const nid = byName[id] || id;      // `판본` → `신경:판본`
        setLit(prev => (prev.includes(nid) ? prev : [...prev, nid]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      } else if (ev?.kind === 'tending' && ev.step) {
        // 🔴 **이 분기가 `sse` 분기보다 앞이어야 한다** (2026-09-11 전수 대조).
        //    뒤에 두면, 서버 MOTOR 표에 누가 `sse="tending"` 을 붙이는 순간
        //    앞 분기가 먹어 **걸음 51개 점등이 통째로 죽는다** — 순서가 곧
        //    계약인데 어디에도 안 적혀 있었다.
        //    (역사: 전에는 쏘는 자가 0곳이라 걸음이 영영 안 켜졌고, timer 도
        //    없어 켜졌더라도 안 꺼졌을 것이다 — 2026-09-10 에 고쳤다.)
        const id = byName[ev.step] || `걸음:${ev.step}`;
        setLit(prev => (prev.includes(id) ? prev : [...prev, id]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      } else if (ev?.kind && byName[`sse:${ev.kind}`]) {
        // notology 조작·사람 손(`act:*`) — **서버가 노드에 실어 보낸 `sse`** 로만
        const id = byName[`sse:${ev.kind}`];
        setLit(prev => (prev.includes(id) ? prev : [...prev, id]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      }
    });
    return () => {
      window.removeEventListener('dobbin:fired', on as EventListener);
      try { off?.(); } catch { /* 구독 해제가 막혀도 화면은 산다 */ }
    };
  }, [m, byName]);

  // 🔴 **접는다** (2026-09-10). 제품 모듈 220개를 다 올리니 노드가 439다 —
  //    다 그리면 못 읽고, 안 그리면 거짓말이다(45/158 만 그리던 자리).
  //    영역마다 **큰 것 K개**만 펴고 나머지는 「+N」 한 점으로 접는다.
  //    잣대는 지어낸 중요도가 아니라 **줄 수 + 부르는 자 수**다.
  const [open, setOpen] = useState<Set<string>>(new Set());
  // 🔴 **이음도 접는다** (2026-09-10). 모듈을 다 올리자 이음이 933이 되었고
  //    화면이 실뭉치가 됐다. `부름`(464)은 «코드에 있다»일 뿐 그 턴에 무슨
  //    일이 있었나를 말하지 않는다 — 기본으로 접고, 켜면 보인다.
  //    ⚠️ 접는 것과 **없애는 것**은 다르다. 수는 범례에 그대로 적힌다.
  const [showCall, setShowCall] = useState(false);
  const shownNodes = useMemo(() => {
    // 🔴 지그의 빈손 200(`{}`)에서 `m.nodes.forEach` 가 터져 앱이 죽었다
    //    (ui_e2e pageerror · 2026-09-11). 렌더 가드는 useMemo 뒤에 돈다.
    if (!m?.nodes) return [] as Node[];
    const K = 9;
    const byR: Record<string, Node[]> = {};
    (m.nodes ?? []).forEach(n => { (byR[n.region] ||= []).push(n); });
    const out: Node[] = [];
    Object.entries(byR).forEach(([r, list]) => {
      const organs = list.filter(n => n.kind === '기관');
      const rest = list.filter(n => n.kind !== '기관');
      out.push(...rest);
      if (organs.length <= K || open.has(r)) { out.push(...organs); return; }
      const rank = (n: Node) => (n.줄수 || 0) + (n.부름받음 || 0) * 300;
      // 🔴 **한 번만 줄 세우고 그 꼬리를 쓴다** (2026-09-10). 전에는 `top` 은
      //    정렬해 놓고 접힘의 「줄수」는 **정렬 전** `organs.slice(K)` 를 더해
      //    서로 다른 집합을 셌다 — 실측 오차 −2,131줄.
      const sorted = [...organs].sort((a, b) => rank(b) - rank(a));
      let top = sorted.slice(0, K), tail = sorted.slice(K);
      // 🔴 **발화하는 기관이 정확히 접혀 사라지는 부류였다** (2026-09-11 적대
      //    검토 A3). 글자는 「기관 3개 관여」인데 그림은 0개 — 켜졌거나
      //    선택된 것은 접힘에서 꺼내 보인다.
      const must = new Set([...lit, pickId].filter(Boolean));
      const rescued = tail.filter(n => must.has(n.id));
      if (rescued.length) {
        top = [...top, ...rescued];
        tail = tail.filter(n => !must.has(n.id));
      }
      out.push(...top);
      out.push({ id: `접힘:${r}`, kind: '접힘', region: r, status: 'fold',
                 label: `+${tail.length}`,
                 why: `${tail.length}개가 접혀 있다 — 눌러서 편다`,
                 줄수: tail.reduce((a, b) => a + (b.줄수 || 0), 0) } as Node);
    });
    return out;
  }, [m, open, lit, pickId]);
  const shownIds = useMemo(() => new Set(shownNodes.map(n => n.id)), [shownNodes]);
  const lb = useMemo(() => (m ? lobes(shownNodes, m.regions, m.layers || {}) : {}),
                     [m, shownNodes]);
  const pos = useMemo(() => (m ? place(shownNodes, lb) : {}), [shownNodes, lb]);
  // 🔴 **«이웃 그물» 을 걷어냈다** (2026-09-09 적대적 검토).
  //    같은 엽 안에서 «가까이 찍힌» 둘을 이어 321개를 그렸는데, 서버가 보낸
  //    진짜 이음 107개와 **겹치는 것이 하나도 없었다**. 사람이 본 428선 중
  //    뜻이 있는 것은 55개(12.9%)뿐이었고, 나머지는 자리 배치의 부산물을
  //    연결로 읽게 만들었다. 선은 서버가 준 것만 그린다.
  if (!m?.nodes?.length) return null;
  const mx = m.matrix || {}, ta = m.tally || {};
  // 「재는 자 82」와 「관문·재는 자 74」가 한 화면에 8 차이로 있었다 — 갈라 센다
  const equipN = {
    gate: m.nodes.filter(n => n.kind === '관문' || n.kind === '잣대').length,
    todo: m.nodes.filter(n => n.kind === '계획').length,
  };
  // 🔴 조작 15개는 **사람이 한 일**이라 성숙도에서 뺐다 — 그렇다고 「장비」도
  //    아니다. 셋으로 갈라 적는다 (뇌 · 손 · 장비).
  const litSet = new Set(lit);
  const nodeById: Record<string, Node> = {};
  m.nodes.forEach(n => { nodeById[n.id] = n; });
  const pick = pickId ? nodeById[pickId] ?? null : null;

  return (
    <section className="brainmap">
      {/* 🔴 한 호흡에 못 읽는 숫자 아홉을 늘어놓지 않는다 (한빈: «글자가 잘
          보여야 함»). 뇌와 장비를 먼저 가르고, 나머지는 아래 범례가 맡는다. */}
      <h3><span className="brainmap__ttl">뇌 지도</span>
        <span className="brainmap__sum">
          뇌 <b>{m.counts?.뇌 ?? m.nodes.length}</b> · 이음 <b>{m.edges.length}</b>
          {/* 🔴 여기 `tally.red`(붉은 노드 **전부**)를 「오배선」이라 불렀다.
              실측 9 중 진짜 오배선은 2이고 나머지 7은 붉은 관문 6 + 기관 1 —
              **회귀 관문의 실패가 뇌의 오배선으로 둔갑**했다. 서버가 진짜 값
              (`matrix.오배선`)을 보내는데 안 읽고 있었다. */}
          {mx.오배선 ? <> · <em className="bm-bad">오배선 {mx.오배선}</em></> : null}
          {ta.red ? <> · <span className="bm-dim">붉은 칸 {ta.red}</span></> : null}
          {mx.명중 == null
            ? <em className="bm-dim"
                  title="nerve_run 표를 못 읽어 반사·신경 덮음·문 셈이 없다 — 조용히 숨기지 않는다 (A14)">
                {' '}· 반사 기록 못 읽음</em>
            : null}
          {mx.명중 != null
            ? <span title={`신경 ${mx.측정}개 · ${mx.잰때 || '언제인지 모름'}`
                           + ` · 출처 ${mx.출처}`}>
                {' · '}반사 {mx.명중}/{mx.자극}
                {/* 🔴 「43/45」는 96%로 읽히지만 그 45는 *신경 수*가 아니라
                    **벤치가 볼 수 있는 자극 수**다. 실제 덮음은 38/56 (68%) —
                    18개는 한 번도 안 쟀다. 두 수를 나란히 적는다. */}
                {mx.신경전체
                  ? <i className="bm-cov" title="반사 벤치가 한 번이라도 잰 신경 / 등록부의 신경 전체">
                      {' '}· 신경 {mx.측정}/{mx.신경전체}
                    </i>
                  : null}
                {/* 🔴 **덮지 않은 것을 덮은 척하지 않는다** (2026-09-10).
                    `_answer_core` 에 값을 돌려주는 문이 62개인데 표시가
                    붙은 것은 13개다 — 나머지 49개로 나간 답은 뇌 지도에
                    **한 칸도 안 켜진다.** 사람이 보기엔 dobbin 이 아무
                    생각 없이 답한 것처럼 보인다. 그 수를 적는다. */}
                {mx.문
                  ? <i className="bm-gap"
                       title="답이 나가는 자리 중 「신경 «X» 발화」 표시가 붙은 것 — 나머지로 나간 답은 지도에 안 켜진다">
                      {' '}· 문 {mx.문표시}/{mx.문}
                      {(mx.문 ?? 0) - (mx.문표시 ?? 0) > 0
                        ? <em>({(mx.문 ?? 0) - (mx.문표시 ?? 0)}개 계측 밖)</em>
                        : null}
                    </i>
                  : null}
                {mx.잰때 ? <i className="bm-at">({mx.잰때.slice(5)})</i> : null}
              </span>
            : null}
          {/* 🔴 **장비를 2배 적게 그리고 있었다** — 노드로는 76개인데
              `src/eval` 은 168파일·81,444줄이다 (2026-09-10). */}
          {' '}<i className="bm-equip-n"
                  title={m.counts?.장비파일
                    ? `재는 자 실물: src/eval ${m.counts.장비파일}파일 · `
                      + `${(m.counts.장비줄 ?? 0).toLocaleString()}줄 · `
                      + `탐침 ${m.counts.탐침}개`
                    : undefined}>
            손 {m.counts?.조작 ?? 0} · 장비 {m.counts?.장비 ?? 0}
            {m.counts?.장비파일
              ? <em className="bm-equip-real">
                  ({m.counts.장비파일}파일 · {Math.round((m.counts.장비줄 ?? 0) / 1000)}k줄)
                </em>
              : null}
          </i>
          {/* 🔴 **갱신 시각을 적는다.** 「반사 49/51」이 17시간 낡았는데 화면에
              아무 표시가 없었다 — 낡은 수를 지금 수처럼 보이게 하면 안 된다. */}
          {at ? <i className="bm-at" title="지도를 지은 때 (서버 built_at) — 캐시가 낡으면 이 시각도 낡게 보인다">· 지음 {at}</i> : null}
          {err ? <em className="bm-bad" title="마지막 요청이 실패했다 — 보이는 지도는 그 이전 것이다">
            · 🔴 못 읽음 ({err})</em> : null}
          {m.registry_error ? <em className="bm-bad"
            title={m.registry_error}> · 🔴 신경 등록부를 못 읽었다</em> : null}
        </span>
      </h3>

      {m.maturity && (
        <div className="brainmap__mat" title="위 단계는 아래가 참이어야 준다">
          {m.maturity.단계.map((label, i) => {
            const n = m.maturity!.셈[String(i)] ?? 0;
            // 🔴 따로 반올림하면 합이 101%가 된다 (실측). 가장 큰 칸이 나머지를 먹는다.
            const all = m.maturity!.단계.map((_, j) =>
              Math.round((100 * (m.maturity!.셈[String(j)] ?? 0)) / (m.maturity!.합 || 1)));
            const big = all.indexOf(Math.max(...all));
            const pct = i === big ? all[i] + (100 - all.reduce((a, b) => a + b, 0)) : all[i];
            // 🔴 **셈만 보이면 화면이 거짓을 말한다** (2026-09-10 적대 검토).
            //    「선언 63」을 한빈은 «안 지은 뇌가 63개» 로 읽는데, 실측은
            //    59개가 **일회성 CLI**(부르는 자가 없는 게 정상인 물건)이고
            //    진짜 미착수는 **4개**다. 「배선」도 «안 돈다» 로 읽혔는데
            //    92%가 지금 돌고 있고 **재는 자**만 없다. 단계마다 그 한 줄을
            //    붙인다 — 수만 보이는 것은 절반의 진실이다.
            const cli = m.maturity!.손CLI ?? 0;
            // 🔴 단계 설명을 지어 붙였었다 (A8) — 3단계 구성원 대부분은
            //    「전용 잣대」가 아니라 「반사/표」다. **잰 것(0단계 CLI 수)만**
            //    남기고, 노드별 까닭은 각 노드의 stage_why 가 말한다.
            const note = i === 0 && cli
              ? `그중 ${cli}개는 일회성 CLI — 손으로 돌린다. 진짜 미착수는 ${n - cli}개`
              : '';
            return (
              <span key={label} className={`bm-mat bm-mat--${i}`} title={note}>
                <b>{label}</b> {n}<i>({pct}%)</i>
                {i === 0 && cli ? <em className="bm-mat__note">진짜 {n - cli}</em> : null}
              </span>
            );
          })}
          {/* 🔴 「모른다 53%」의 **까닭**을 같은 줄에 적는다 — 기관 223개 중
              계측 규칙이 있는 것이 15개뿐이라 나머지가 unknown 이다. 상태가
              나쁜 게 아니라 **재는 자가 없는** 것이다. */}
          {m.maturity.덮음 && (
            <span className="bm-mat bm-mat--cov"
                  title="EVIDENCE 에 계측 규칙이 있는 기관 수 — 나머지는 «모른다» 로 그려진다">
              <b>계측 덮음</b> {m.maturity.덮음.기관}/{m.maturity.덮음.전체}
            </span>
          )}
        </div>
      )}
      <div className="brainmap__wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="brainmap__svg" role="img"
             aria-label="dobbin 의 뇌 지도">
          <defs>
            <filter id="bmsoft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id="bmlit" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="4.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="bmbg">
              <stop offset="0%" stopColor="#1b2440" stopOpacity=".55" />
              <stop offset="100%" stopColor="#070a12" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bmglow">
              <stop offset="0%" stopColor="#fff" stopOpacity=".85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width={W} height={H} fill="url(#bmbg)" />

          {/* 🔴 **밑그림(동그라미)을 걷었다** (한빈 2026-09-10: *"밑배경 뇌
              그림이 상당히 별로다. 그냥 제거해. 전혀 뇌로 보이지 않고 오히려
              허접해 보인다."*).
              어제 이랑·종렬을 걷고 겉선만 남겼는데, 남은 것이 **아무 뜻도 없는
              타원 하나**였다 — 자료를 하나도 안 말하면서 자리만 먹는다.
              남는 것은 **층 띠**(구심/연합/원심)와 **영역 색면**뿐이고,
              그 둘은 각각 「자료가 어디로 흐르나」와 「무엇이 어디 사나」를 말한다.
              ⚠️ `lobes()`·`place()` 의 자리 계산은 **안 건드렸다** — 어제 겉선을
                 고치며 배치까지 만졌다가 노드가 흩어진 적이 있다. */}
          {/* ── 자비스 홀로그램 — 장식 층 (한빈 ② · 2026-09-11) ──
              🔴 **장식만 돈다.** 노드·이음·글자는 회전 금지 — 읽는 것이
              먼저다. 60~140초/바퀴의 느린 회전이라 시선을 안 뺏고,
              `prefers-reduced-motion` 이면 정지한다. dobbin 홈이
              `display:none` 으로 숨으면 그리기 자체가 없어 CPU 0 이다. */}
          <g className="bm-holo" aria-hidden="true">
            {Object.entries(RINGS).map(([k, [r0, r1]]) => (
              <g key={`ring-${k}`}>
                <circle cx={CX} cy={CY} r={r1} className="bm-ring" />
                <circle cx={CX} cy={CY} r={r0} className="bm-ring bm-ring--in" />
                {/* 눈금 호 — 자비스의 그 눈금. dasharray 가 눈금을 만든다 */}
                <circle cx={CX} cy={CY} r={(r0 + r1) / 2 + (r1 - r0) * 0.32}
                        className="bm-ring bm-ring--tick" />
              </g>
            ))}
            {holoDots().map((d, i) => (
              <circle key={`dot-${i}`} cx={d.x} cy={d.y} r={d.r}
                      className="bm-dust" style={{ opacity: d.o }} />
            ))}
          </g>
          <g className="bm-holo bm-holo--rev" aria-hidden="true">
            {/* 짧은 호 조각들 — 반대로 도는 겹이 깊이를 만든다 */}
            {[70, 150, 231].map((r, i) => (
              <circle key={`seg-${i}`} cx={CX} cy={CY} r={r}
                      className="bm-ring bm-ring--seg" />
            ))}
          </g>

          {/* dobbin 코어 — 중심. 상태가 아니라 자리다 (얼굴은 히어로에 있다) */}
          <g className="bm-core" aria-hidden="true">
            <circle cx={CX} cy={CY} r={30} className="bm-core__halo" />
            <circle cx={CX} cy={CY} r={17} className="bm-core__ring" />
            <circle cx={CX} cy={CY} r={5} className="bm-core__dot" />
            <text x={CX} y={CY + 44} textAnchor="middle" className="bm-core__lab">
              dobbin</text>
          </g>

          <g>
            {/* 엽 — 링 위의 호 구획. 발화하면 그 구획이 파동친다 (B3) */}
            {Object.entries(lb).filter(([, L]) => L.arc).map(([k, L]) => {
              const { a0, a1, r0, r1 } = L.arc!;
              const on = lit.some(id => nodeById[id]?.region === k);
              return (
                <path key={`lobe-${k}`} d={arcPath(a0, a1, r0, r1)}
                      className={`bm-lobe${on ? ' bm-lobe--on' : ''}`}
                      style={{ fill: `hsl(${L.hue} 80% 55% / .12)`,
                               stroke: `hsl(${L.hue} 80% 62% / .38)` }} />
              );
            })}
          </g>

          {/* 링 이름 — 12시 방향, 링 바로 위 */}
          {Object.entries(m.layers || {}).map(([k, L]) => {
            const ring = RINGS[k]; if (!ring) return null;
            return (
              <text key={`layl-${k}`} className="bm-layer-lab" x={CX}
                    y={CY - ring[1] + 13} textAnchor="middle"
                    style={{ fill: `hsl(${L.hue} 60% 66%)` }}>
                <title>{L.why}</title>{L.label}
              </text>
            );
          })}

          {/* ── 장비 띠 — 🔴 **뇌가 아니다.** 전 판은 관문 74 + 할 일 94 를
              뇌 안에 그려 노드의 51%가 개발 장비였다. 선을 긋고 밖에 둔다. */}
          {/* 장비 위성 호의 캡션 — 뇌 원 밖 왼쪽 아래 */}
          <text className="bm-equip-lab" x={40} y={H - 26}>
            장비 — 뇌가 아니다 · 바깥 호 (재는 자 {equipN.gate} · 할 일 {equipN.todo}
            {' '}· 서비스 층 {m.nodes.filter(n => n.region === 'service').length})
          </text>

          {/* 영역 이름 — 누르면 아래에 「왜 적은가 · 어디까지 됐나」가 뜬다 */}
          {Object.entries(lb).map(([k, L]) => {
            const c = m.census?.[k];
            // 호 구획이면 가운데 각도의 바깥 가장자리 — 아니면(선반) 위쪽
            let x = L.cx, y = L.cy - L.ry - 5;
            if (L.arc) {
              const mid = (L.arc.a0 + L.arc.a1) / 2;
              const rr = L.arc.r1 - 7;
              x = CX + rr * Math.cos(mid); y = CY + rr * Math.sin(mid);
            }
            return (
              <text key={`lab-${k}`} className="bm-region bm-region--btn" x={x}
                    y={y} textAnchor="middle"
                    onClick={() => setReg(reg === k ? null : k)}
                    style={{ fill: `hsl(${L.hue} 70% 68%)` }}>
                {/* 🔴 L.n 은 접힘 뒤 수 — census 는 65 인데 라벨은 11 이던
                    어긋남 (A2). 서버 전체 수를 쓴다. */}
                {L.label} <tspan className="bm-region-n">
                  {c?.칸 ?? L.n}{c && c.모듈 ? ` · 모듈 ${c.모듈}` : ''}</tspan>
              </text>
            );
          })}

          {/* 이음 — 사슬(옅게) · 공급(가늘게) · 오배선(붉게) */}
          {m.edges.map((e, i) => {
            if (!showCall && (e.kind === '부름' || e.kind === '사슬')) return null;
            if (!shownIds.has(e.a) || !shownIds.has(e.b)) return null;
            const a = pos[e.a], b = pos[e.b];
            if (!a || !b) return null;
            const on = litSet.has(e.a) || litSet.has(e.b);
            const na = nodeById[e.a], nb = nodeById[e.b];
            // 층을 건너는 이음 — 자료가 들어와 답으로 나가는 길이다
            // 서버가 노드마다 layer 를 보낸다 — 재계산 대신 그 값 (두 벌 금지)
            const cross = na && nb && (na.layer ?? m.regions[na.region]?.layer)
              !== (nb.layer ?? m.regions[nb.region]?.layer);
            const cls = `bm-edge bm-edge--${EDGE_CLS[e.kind] || 'chain'}`
              + (cross ? ' bm-edge--cross' : '') + (on ? ' bm-edge--on' : '')
              // 🔴 "static" = 코드에 있다(정적 분석) — 실측 이음과 굵기로 가른다
              + (e.grade === 'static' ? ' bm-edge--static' : '');
            const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2;
            const d = `M${a.x},${a.y} Q${mx2},${my2 - (cross ? 26 : 12)} ${b.x},${b.y}`;
            return <path key={i} d={d} className={cls} fill="none" />;
          })}

          {/* 노드 */}
          {shownNodes.map(n => {
            const p = pos[n.id]; if (!p) return null;
            const s = STATUS[n.status] || STATUS.dark;
            const on = litSet.has(n.id);
            const active = on || hover === n.id || pick?.id === n.id;
            {/* 🔴 **원자 크기** (한빈 2026-09-11: *"노드가 너무 커서 디자인이
                구리다. 원자처럼 작게 — 분포만 보이게, 활성화될 때만 어떤
                신경인지 강조."*). 평시 ~2px 점: 자리(호 구획)가 갈래를,
                점의 색이 **상태**를 말한다 — 굵은 원에 두르던 상태 테두리는
                이 크기에서 안 읽혀서, 채움 자체를 상태색으로 바꿨다.
                활성화(발화·hover·선택)에만 커지고 이름이 붙는다. */}
            const base = n.kind === '접힘' ? 5.5
                       : n.kind === '갈래' ? 3
                       : n.kind === '계획' ? 2.2
                       : n.kind === '걸음' ? 1.7
                       : 2.1;
            const r = active ? Math.max(base * 2.6, 5.5) : base;
            const ghost = n.kind === '계획';
            return (
              <g key={n.id} className={`bm-node bm-node--${n.kind}${on ? ' bm-node--fire' : ''}`}
                 onClick={() => {
                   if (n.kind === '접힘') {
                     setOpen(o => { const x = new Set(o); x.add(n.region); return x; });
                     return;
                   }
                   setPickId(pickId === n.id ? null : n.id);
                 }}
                 onMouseEnter={() => setHover(n.id)}
                 onMouseLeave={() => setHover(h => (h === n.id ? null : h))}>
                {/* 2px 점은 못 누른다 — 보이지 않는 넉넉한 과녁 */}
                <circle cx={p.x} cy={p.y} r={9} fill="transparent" />
                {on && <circle cx={p.x} cy={p.y} r={16} fill="url(#bmglow)" />}
                <circle cx={p.x} cy={p.y} r={r}
                        className={n.status === 'building' ? 'bm-build' : undefined}
                        strokeDasharray={ghost ? '2 2' : undefined}
                        fill={ghost ? 'none' : s.c}
                        stroke={pick?.id === n.id ? '#fff'
                                : ghost ? s.c
                                : active ? `hsl(${m.regions[n.region]?.hue ?? 210} 80% 70%)`
                                : 'none'}
                        strokeWidth={active ? 1.4 : ghost ? 1 : 0}
                        filter={on ? 'url(#bmlit)' : undefined}
                        opacity={active ? 1
                                 : n.status === 'dark' || n.status === 'idle'
                                 ? 0.3 : 0.8}>
                  <title>{`${n.label || n.id} · ${s.t}`}</title>
                </circle>
                {(n.kind === '접힘' || n.kind === '갈래' || active) && (
                  <text className={`bm-tag${on ? ' bm-tag--on' : ''}`} x={p.x}
                        y={p.y - (r + 5)} textAnchor="middle">
                    {n.label || n.id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {lit.length > 0 && (
          <div className="brainmap__live" key={pulse}>
            방금 울린 것: {lit.join(' → ')}
          </div>
        )}
      </div>

      {turn && (
        <div className="brainmap__turn">
          <span>방금 턴 — <b>신경 {turn.nerves}</b>개 울림
            {turn.nerves ? ` (${turn.list.join(' → ')})` : ''}</span>
          <span>기관 <b>{turn.organs.length}</b>개 관여{turn.organs.length ? ` (${turn.organs.join(' · ')})` : ''}</span>
          <span>모델 <b>{turn.llm ? '씀' : '안 씀 — 표에서 셈'}</b></span>
          <span>근거 <b>{turn.refs}</b>건</span>
          {turn.level ? <span>확신 <b>{turn.level}</b></span> : null}
          <span>걸음 <b>{turn.trace.length}</b></span>
        </div>
      )}
      {/* 🔴 **영역마다 「왜 적은가 · 어디까지 됐나」** (한빈 2026-09-10).
          전에는 뇌 전체 성숙도 한 줄뿐이라 *기억은 다 됐는데 지각이 비었다*
          를 읽을 수 없었다. 「적다」의 까닭은 셋으로 갈리고 처방이 다르다. */}
      {reg && m.census?.[reg] && (() => {
        const c = m.census![reg]!;
        const R = m.regions[reg];
        const 단계 = m.maturity?.단계 || [];
        return (
          <div className="brainmap__detail brainmap__census">
            <b style={{ color: `hsl(${R?.hue ?? 210} 70% 68%)` }}>
              {R?.label || reg}</b>
            <span className="bm-kind">
              {c.칸}칸 · 모듈 {c.모듈} · {c.줄수.toLocaleString()}줄</span>
            <div className={`bm-why bm-why--${c.갈래}`}>왜 이만큼인가 — {c.왜}</div>
            <div className="bm-cen-mat">
              어디까지 됐나:{' '}
              {단계.map((label, i) => (
                <span key={label}>{label} <b>{c.성숙도[String(i)] ?? 0}</b></span>
              ))}
            </div>
            {c.그린모듈 < c.모듈 ? (
              <div className="bm-cen-gap">
                덮음 {c.그린모듈}/{c.모듈} — {c.모듈 - c.그린모듈}개가
                이름표 안에 있는데 아직 이 영역에 안 그려졌다
                {c.딴데 ? ` (${c.딴데}개는 다른 영역에 그려져 있다)` : ''}
              </div>
            ) : null}
            {/* 🔴 **추정을 규칙인 척하지 않는다** (2026-09-10). 칸 이름이
                `규칙모듈` 이었는데 실제로는 77%가 꾸러미·이웃 추정이었다.
                무엇으로 가렸는지를 그대로 적는다 — 「이웃」이 많으면 그
                영역의 이름표가 약하다는 뜻이고, 그것이 다음 할 일이다. */}
            {c.판정 && Object.keys(c.판정).length ? (
              <div className="bm-cen-how">
                무엇으로 가렸나 —{' '}
                {Object.entries(c.판정)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${k} ${v}`).join(' · ')}
              </div>
            ) : null}
            {c.큰것?.length ? (
              <div className="bm-cen-big">
                큰 것: {c.큰것.map(([n, mo]) => `${mo} ${n.toLocaleString()}줄`).join(' · ')}
              </div>
            ) : null}
          </div>
        );
      })()}
      {/* 🔴 **「지도 밖」과 「이름 규칙 밖」은 다른 말이다** (2026-09-10).
          전에는 «아직 지도 밖 22개 · 20,098줄» 이라 적었는데 **22개가 전부
          이미 그려져 있었다** — 이름 규칙이 못 가렸을 뿐 자리는 이웃으로
          잡혀 있었다. 「안 그렸다」로 읽히면 없는 할 일이 생긴다.
          두 수를 갈라 적고, 0이어도 숨기지 않는다. */}
      {m.outside && (
        <div className={`brainmap__detail bm-outside${
          (m.outside.수 ?? 0) > 0 ? '' : ' bm-outside--ok'}`}>
          {(m.outside.수 ?? 0) > 0 ? (
            <>🔴 아직 지도 밖: <b>{m.outside.수}개 모듈</b>
              {' · '}{(m.outside.줄수 ?? 0).toLocaleString()}줄 —
              {' '}{(m.outside.큰것 || []).slice(0, 5)
                    .map(([n, mo]) => `${mo}(${n.toLocaleString()})`).join(' · ')}
            </>
          ) : <>지도 밖 <b>0</b> — 모듈이 모두 어딘가에 그려져 있다
              {' '}· 미분류 칸 <b>{m.census?.미분류?.칸 ?? 0}</b></>}
          {(m.outside.이름밖 ?? 0) > 0 && (
            <span className="bm-outside__rule" title="이름 규칙·꾸러미가 못 가려 이웃으로 자리를 잡은 것 — 그려는 져 있다">
              {' · '}이름 규칙 밖 <b>{m.outside.이름밖}</b>
              {(m.outside.이름밖그림 ?? 0) > 0
                ? ` (그중 ${m.outside.이름밖그림}개는 이웃으로 자리를 잡아 그려져 있다)` : ''}
            </span>
          )}
        </div>
      )}
      {pick && (
        <div className="brainmap__detail">
          <b>{pick.label || pick.id}</b>
          <span className="bm-kind">{pick.kind}{pick.sub ? ` · ${pick.sub}` : ''}
            {/* 🔴 서버가 「빚/신설」을 갈라 보내는데 화면이 **0번 읽었다** —
                8개 전부 «빚»(있는 신경을 고치는 일)인데 「아직 없는 신경」으로
                그려져, 같은 상세칸의 두 줄이 서로 모순됐다. */}
            {pick.target ? ` · ${pick.target}` : ''}
            {pick.grade ? ` · ${pick.grade}` : ''}</span>
          {pick.mod ? <code>{pick.mod}</code> : null}
          <div>{(STATUS[pick.status] || STATUS.dark).t}
            {pick.rc != null ? ` · rc=${pick.rc}` : ''}
            {/* 🔴 `hit` 은 신경에만 있다. 기관·조작은 `n`(표 건수)만 있어서
                「반사 undefined/14114」가 17개 노드에 찍혔다 (실측). */}
            {pick.hit != null && pick.n ? ` · 반사 ${pick.hit}/${pick.n}`
             : pick.n != null ? ` · 표에 ${pick.n}건` : ''}
          </div>
          {pick.stage != null ? (
            <div className="bm-stage">성숙도 <b>{pick.stage}</b>
              {/* 🔴 단계 이름의 정본은 서버 STAGES — 하드코딩 두 벌이었다 */}
              {' '}({m.maturity?.단계?.[pick.stage] ?? ''})
              {pick.stage_why ? ` — ${pick.stage_why}` : ''}</div>) : null}
          {pick.why ? <div>{pick.why}</div> : null}
          {/* 🔴 서버가 보내는데 화면이 버리던 칸들 (2026-09-11 전수 대조) —
              aim(할 일이 겨눈 영역)·owner(빚의 임자)·src(수를 잰 표)·
              order(사슬 차례)·자극[1] */}
          {pick.aim ? <div>겨눈 영역: {m.regions[pick.aim]?.label ?? pick.aim}</div> : null}
          {pick.owner ? <div>임자: {pick.owner}</div> : null}
          {pick.src ? <div className="bm-src">잰 곳: {pick.src}</div> : null}
          {pick.수용체?.length ? <div>수용체: {pick.수용체.join(' · ')}</div> : null}
          {pick.자극?.length
            ? <div>이런 말에 울린다: {pick.자극.slice(0, 2)
                .map(x => `「${x}」`).join(' · ')}
                {pick.order != null ? <i className="bm-ord"> · 차례 {pick.order}</i> : null}
              </div> : null}
          {pick.miss && Object.keys(pick.miss).length
            ? <div className="bm-miss">
                {Object.entries(pick.miss).map(([k, v]) =>
                  <span key={k}>← 「{k}」가 {v}번 대신 먹음 </span>)}
              </div> : null}
        </div>
      )}

      <div className="brainmap__legend">
        {Object.entries(STATUS).map(([k, v]) => (
          <span key={k}><i style={{ background: v.c }} />{v.t}</span>
        ))}
      </div>
      {/* 🔴 **자국 띠** — 한빈 2026-09-10 ③. 실시간이 5.2초 번쩍임뿐이라
          자리를 비우면 **일어나지 않은 것과 같았다.** 시각과 함께 쌓는다.
          ⚠️ 비어 있어도 칸을 지우지 않는다 — 「아직 아무 일도 없다」와
             「이 기능이 없다」를 사람이 구별할 수 있어야 한다. */}
      <div className="brainmap__trace">
        <b>방금 일어난 일</b>
        {trace.length ? (
          <ol>
            {trace.slice(0, 12).map((t, i) => (
              <li key={`${t.at}-${i}`} className={`bm-tr bm-tr--${t.lane}`}
                  title={`${t.kind} · ${t.what}`}>
                <i>{t.at}</i><em>{t.lane}</em>{t.what}
              </li>
            ))}
          </ol>
        ) : (
          <span className="bm-tr-empty">
            아직 조용하다 — 노트를 고치거나 dobbin 에게 말을 걸면 여기 쌓인다
          </span>
        )}
      </div>
      {/* 🔴 **이음 범례가 없었다** — 여덟 종을 그려 놓고 무엇이 무엇인지
          화면 어디에도 안 적혀 있었다 (실측). 세는 것도 함께 보인다. */}
      <div className="brainmap__legend brainmap__legend--edge">
        {EDGE_LEGEND.map(([kind, why]) => {
          const mine = m.edges.filter(e => e.kind === kind);
          const n = mine.length;
          if (!n) return null;
          const foldable = kind === '부름' || kind === '사슬';
          const off = foldable && !showCall;
          // 🔴 **끝점이 접혀 사라진 선을 아무 데도 안 적었다** (2026-09-10).
          //    「이음 936」인데 화면엔 358줄이고, `부름`·`사슬` 519는 범례가
          //    밝히는데 **나머지 59개**(일함 50 중 28)는 조용히 없어졌다.
          //    「접는 것과 없애는 것은 다르다」를 이음 **끝점**에도 지킨다.
          const gone = off ? 0
            : mine.filter(e => !shownIds.has(e.a) || !shownIds.has(e.b)).length;
          return (
            <span key={kind} title={why + (foldable ? ' · 눌러서 켜고 끈다' : '')
                    + (gone ? ` · ${gone}개는 끝점이 접혀 안 보인다 (영역을 펴면 나타난다)` : '')}
                  className={foldable ? 'bm-leg-btn' : undefined}
                  style={off ? { opacity: .45 } : undefined}
                  onClick={foldable ? () => setShowCall(v => !v) : undefined}>
              <i className={`bm-leg bm-leg--${EDGE_CLS[kind]}`} />{kind} {n}
              {off ? ' (접힘)' : gone ? <em className="bm-leg__gone">−{gone}</em> : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}


