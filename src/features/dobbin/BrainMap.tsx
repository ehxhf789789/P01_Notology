/**
 * 뇌 지도 — dobbin 의 **전체 구조**를 뇌 모양으로 그린다 (v10 ㅈ′ · 2026-09-09).
 *
 * 한빈: *"신경 지도의 디자인은 두뇌의 형태로. 질문을 하면 어떤 신경이 밝아지고
 * 움직이고 반응하는지 동적으로. 깊이·구조가 너무 얕다 — 세부 신경도 모두.
 * 하네스와 dobbin 의 두뇌가 어디까지 구현됐는지 시각적으로."*
 *
 * 🔴 그리는 값은 전부 **서버가 잰 것**이다 (`/api/brainmap`): 대화 신경 53 +
 *    기관(기억·연상·심의·관계·지각·말) + 일과 걸음 25 + 하네스 관문 24.
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
  target?: string; owner?: string; grade?: string; src?: string | null;
};
type Edge = { a: string; b: string; kind: string; n?: number };
type Region = { label: string; cx: number; cy?: number; hue: number; layer?: string | null };
type Layer = { label: string; cy: number; hue: number; why?: string };
type Map = {
  regions: Record<string, Region>; layers?: Record<string, Layer>;
  nodes: Node[]; edges: Edge[];
  maturity?: { 단계: string[]; 셈: Record<string, number>; 합: number };
  counts?: { 뇌?: number; 장비?: number; 전체?: number };
  matrix?: { 측정?: number; 자극?: number; 명중?: number; 오배선?: number };
  tally?: Record<string, number>;
};

const W = 980, H = 700;
/** 뇌가 차지하는 세로 — 아래 나머지는 **장비 띠**다 (뇌가 아니다). */
const BRAIN_TOP = 24, BRAIN_BOT = 556, EQUIP_TOP = 586;

/* 🔴 **화면의 조작 표를 버렸다** (2026-09-10). 여기 `MOTOR_SSE` 라는 두 번째
   표를 들고 있어서, 서버가 이름을 고치자 **4개는 켤 노드가 없고 4개는 영영
   못 켜지는** 어긋남이 생겼다. 「같은 표를 두 곳에 두지 않는다」— 이제 서버가
   노드마다 `sse` 를 실어 보내고 화면은 그것으로만 잇는다. */

/** 🔴 **위에서 본 뇌** (한빈 2026-09-09 선택). 앞 판은 좌·우 반구를 두 덩이로
 *  떼어 그렸는데, 한빈이 *"영역이 과도하게 떨어져 있고 테두리가 허접하다"* 고
 *  했고 — 게다가 그 좌/우 가름은 **코드에 근거가 없었다**(서버 주석 LAYERS 참조).
 *  이제 한 덩어리다: 앞(위)에서 뒤(아래)로 길고, 가운데 세로 틈(대뇌 종렬)이
 *  둘로 나누며, 겉선은 이랑(gyri)이 물결진다. 그림 파일은 안 쓴다. */
const BRAIN =
  'M490,26 C580,26 664,54 722,110 C796,166 842,250 844,318 '
  + 'C846,398 806,470 730,516 C666,554 582,572 490,572 '
  + 'C398,572 314,554 250,516 C174,470 134,398 136,318 '
  + 'C138,250 184,166 258,110 C316,54 400,26 490,26 Z';
/* 🔴 **밑그림을 걷었다** (한빈 2026-09-09: *"뇌 밑 그림 디자인이 너무 허접하다.
   더 이쁘게 수정이 안 될 거 같으면 밑그림 디자인을 제거해라."*).
   이랑(gyri) 여덟 줄과 대뇌 종렬을 그렸는데, 실제로는 **뜻 없는 곡선이 노드
   위를 가로지르는** 그림이 됐다 — 해부학 흉내는 자료를 하나도 안 말하면서
   읽기만 방해한다. 남는 것은 겉선 하나와 층 띠뿐이고, 그 둘은 각각 「여기까지가
   뇌다」와 「자료가 어디로 흐르나」를 말한다. */

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
  '일으킴': 'act', '빚': 'debt',
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
};

/** 영역의 자리와 크기 — 층이 세로를, `cx` 가 가로를, 식구 수가 크기를 정한다. */
function lobes(nodes: Node[], regions: Record<string, Region>,
               layers: Record<string, Layer>) {
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  const out: Record<string, { cx: number; cy: number; rx: number; ry: number;
                              hue: number; label: string; n: number;
                              equip: boolean }> = {};
  Object.entries(byR).forEach(([r, list]) => {
    const reg = regions[r]; if (!reg) return;
    const [rx, ry] = lobeR(list.length);
    const equip = !reg.layer;
    // 🔴 층은 **띠로 보이는 것**이고 자리는 갈래마다 따로 받는다. 층 하나에
    //    여섯 갈래를 한 줄로 앉히면 「언어 50개」가 이웃을 덮는다 (실측).
    const cy = equip ? EQUIP_TOP + 44
                     : BRAIN_TOP + (BRAIN_BOT - BRAIN_TOP) * (reg.cy ?? 0.5);
    // 뇌 안쪽으로 모은다 — 겉선에 붙지 않게 가로 폭을 좁힌다
    const cx = equip ? (0.10 + 0.80 * reg.cx) * W
                     : (0.20 + 0.60 * reg.cx) * W;
    out[r] = { cx, cy, rx: equip ? Math.min(rx * 1.8, 250) : rx,
               ry: equip ? 34 : ry, hue: reg.hue, label: reg.label,
               n: list.length, equip };
  });
  return out;
}

/** 영역 중심에 결정론으로 흩는다 (같은 지도를 다시 열어도 같은 자리). */
function place(nodes: Node[], lb: ReturnType<typeof lobes>) {
  const pos: Record<string, { x: number; y: number }> = {};
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  Object.entries(byR).forEach(([r, list]) => {
    const L = lb[r]; if (!L) return;
    list.forEach((n, i) => {
      const a = i * 2.399963;                       // 황금각
      const t = Math.sqrt((i + 0.5) / list.length);
      pos[n.id] = { x: L.cx + L.rx * 0.84 * t * Math.cos(a),
                    y: L.cy + L.ry * 0.82 * t * Math.sin(a) };
    });
  });
  return pos;
}

export function BrainMap() {
  const [m, setM] = useState<Map | null>(null);
  const [pick, setPick] = useState<Node | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [lit, setLit] = useState<string[]>([]);
  // 🔴 **꺼지는 빛에 기대지 않는다.** 앞 판은 요약의 「신경 N개」를 번쩍임
  //    상태(lit)에서 셌는데, 5초 뒤 빛이 꺼지면 «0개»로 바뀌었다 (실측).
  //    그 턴에 울린 수는 **그때 붙잡아** 둔다.
  const [turn, setTurn] = useState<{ trace: string[]; refs: number;
                                     llm: boolean; level: string | null;
                                     organs: string[]; nerves: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let dead = false;
    fetch('/api/brainmap').then(r => (r.ok ? r.json() : null))
      .then(j => { if (!dead && j) setM(j as Map); })
      .catch(() => { /* 옛 서버면 지도가 없다 */ });
    return () => { dead = true; };
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
                organs, nerves: nerveIds.length });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLit([]), 5200);
    };
    window.addEventListener('dobbin:fired', on as EventListener);
    // 🔴 **실시간** (v11 D1 · 한빈 «대화하거나 판단할 때 실시간으로»).
    //    답이 끝난 뒤가 아니라 **생각하는 도중** 켠다 — SSE 의 `thinking`
    //    걸음이 0.4초 안에 온다. 대화가 아닐 때(자율 걸음)도 같은 통로다.
    const off = onLive((ev: any) => {
      if (ev?.kind === 'thinking') {
        const id = ev.nerve
          || /신경 «([^»]+)» 발화/.exec(String(ev.text || ''))?.[1];
        if (!id) return;
        const nid = byName[id] || id;      // `판본` → `신경:판본`
        setLit(prev => (prev.includes(nid) ? prev : [...prev, nid]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      } else if (ev?.kind && byName[`sse:${ev.kind}`]) {
        // notology 조작 — **서버가 노드에 실어 보낸 `sse`** 로만 잇는다
        const id = byName[`sse:${ev.kind}`];
        setLit(prev => (prev.includes(id) ? prev : [...prev, id]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      }
      // 🔴 여기 있던 `tending` 갈래를 지웠다 — **서버가 그 이름을 한 번도 안
      //    쏜다**(`grep publish\('tending'` → 0곳). 듣는데 아무도 안 쏘는 것은
      //    죽은 갈래다. 걸음을 켜려면 `tend.py` 가 실제로 쏘아야 한다.
    });
    return () => {
      window.removeEventListener('dobbin:fired', on as EventListener);
      try { off?.(); } catch { /* 구독 해제가 막혀도 화면은 산다 */ }
    };
  }, [m, byName]);

  const lb = useMemo(() => (m ? lobes(m.nodes, m.regions, m.layers || {}) : {}), [m]);
  const pos = useMemo(() => (m ? place(m.nodes, lb) : {}), [m, lb]);
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

  return (
    <section className="brainmap">
      {/* 🔴 한 호흡에 못 읽는 숫자 아홉을 늘어놓지 않는다 (한빈: «글자가 잘
          보여야 함»). 뇌와 장비를 먼저 가르고, 나머지는 아래 범례가 맡는다. */}
      <h3>뇌 지도
        <span className="brainmap__sum">
          뇌 <b>{m.counts?.뇌 ?? m.nodes.length}</b> · 이음 <b>{m.edges.length}</b>
          {/* 🔴 여기 `tally.red`(붉은 노드 **전부**)를 「오배선」이라 불렀다.
              실측 9 중 진짜 오배선은 2이고 나머지 7은 붉은 관문 6 + 기관 1 —
              **회귀 관문의 실패가 뇌의 오배선으로 둔갑**했다. 서버가 진짜 값
              (`matrix.오배선`)을 보내는데 안 읽고 있었다. */}
          {mx.오배선 ? <> · <em className="bm-bad">오배선 {mx.오배선}</em></> : null}
          {ta.red ? <> · <span className="bm-dim">붉은 칸 {ta.red}</span></> : null}
          {mx.명중 != null ? ` · 반사 ${mx.명중}/${mx.자극}` : ''}
          {' '}<i className="bm-equip-n">손 {m.counts?.조작 ?? 0} · 장비 {m.counts?.장비 ?? 0}</i>
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
            return (
              <span key={label} className={`bm-mat bm-mat--${i}`}>
                <b>{label}</b> {n}<i>({pct}%)</i>
              </span>
            );
          })}
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
            {/* 겉선 밖으로 삐져나오지 않게 잘라 낸다 */}
            <clipPath id="bmBrain"><path d={BRAIN} /></clipPath>
            <radialGradient id="bmglow">
              <stop offset="0%" stopColor="#fff" stopOpacity=".85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            {/* 겉선 — 두 겹으로 두께를 준다 (한빈: «테두리가 너무 허접») */}
            <linearGradient id="bmrim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8fa6d8" stopOpacity=".85" />
              <stop offset="100%" stopColor="#5b6c96" stopOpacity=".55" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={W} height={H} fill="url(#bmbg)" />

          {/* ── 뇌 (위에서 본 한 덩어리) */}
          <g clipPath="url(#bmBrain)">
            <path d={BRAIN} className="bm-fill" />
            {/* 층 띠 — 구심(위) → 연합(가운데) → 원심(아래) */}
            {Object.entries(m.layers || {}).map(([k, L]) => {
              const cy = BRAIN_TOP + (BRAIN_BOT - BRAIN_TOP) * L.cy;
              const h = (BRAIN_BOT - BRAIN_TOP) * 0.30;
              return (
                <rect key={`lay-${k}`} x={0} y={cy - h / 2} width={W} height={h}
                      className="bm-layer"
                      style={{ fill: `hsl(${L.hue} 70% 50% / .07)` }} />
              );
            })}
            {/* 엽 — 색으로 갈린 영역 (뇌 안쪽만) */}
            {Object.entries(lb).filter(([, L]) => !L.equip).map(([k, L]) => (
              <ellipse key={`lobe-${k}`} cx={L.cx} cy={L.cy} rx={L.rx} ry={L.ry}
                       className="bm-lobe" filter="url(#bmsoft)"
                       style={{ fill: `hsl(${L.hue} 80% 55% / .13)`,
                                stroke: `hsl(${L.hue} 80% 62% / .34)` }} />
            ))}
          </g>
          <path d={BRAIN} className="bm-rim" />

          {/* 층 이름 — 왼쪽 가장자리에 세로로 */}
          {Object.entries(m.layers || {}).map(([k, L]) => {
            const cy = BRAIN_TOP + (BRAIN_BOT - BRAIN_TOP) * L.cy;
            return (
              <text key={`layl-${k}`} className="bm-layer-lab" x={16} y={cy}
                    style={{ fill: `hsl(${L.hue} 60% 66%)` }}>
                <title>{L.why}</title>{L.label}
              </text>
            );
          })}

          {/* ── 장비 띠 — 🔴 **뇌가 아니다.** 전 판은 관문 74 + 할 일 94 를
              뇌 안에 그려 노드의 51%가 개발 장비였다. 선을 긋고 밖에 둔다. */}
          <line x1={40} y1={EQUIP_TOP - 12} x2={W - 40} y2={EQUIP_TOP - 12}
                className="bm-divider" />
          <text className="bm-equip-lab" x={40} y={EQUIP_TOP + 2}>
            장비 — 뇌가 아니다 (재는 자 {equipN.gate} · 할 일 {equipN.todo})
          </text>

          {/* 영역 이름 — 엽 위쪽 가장자리에 (노드와 안 겹친다) */}
          {Object.entries(lb).map(([k, L]) => (
            <text key={`lab-${k}`} className="bm-region" x={L.cx}
                  y={L.cy - L.ry - 5} textAnchor="middle"
                  style={{ fill: `hsl(${L.hue} 70% 68%)` }}>
              {L.label} <tspan className="bm-region-n">{L.n}</tspan>
            </text>
          ))}

          {/* 이음 — 사슬(옅게) · 공급(가늘게) · 오배선(붉게) */}
          {m.edges.map((e, i) => {
            const a = pos[e.a], b = pos[e.b];
            if (!a || !b) return null;
            const on = litSet.has(e.a) || litSet.has(e.b);
            const na = nodeById[e.a], nb = nodeById[e.b];
            // 층을 건너는 이음 — 자료가 들어와 답으로 나가는 길이다
            const cross = na && nb
              && m.regions[na.region]?.layer !== m.regions[nb.region]?.layer;
            const cls = `bm-edge bm-edge--${EDGE_CLS[e.kind] || 'chain'}`
              + (cross ? ' bm-edge--cross' : '') + (on ? ' bm-edge--on' : '');
            const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2;
            const d = `M${a.x},${a.y} Q${mx2},${my2 - (cross ? 26 : 12)} ${b.x},${b.y}`;
            return <path key={i} d={d} className={cls} fill="none" />;
          })}

          {/* 노드 */}
          {m.nodes.map(n => {
            const p = pos[n.id]; if (!p) return null;
            const s = STATUS[n.status] || STATUS.dark;
            const on = litSet.has(n.id);
            const r = n.kind === '신경' ? (on ? 7.5 : 5)
                    : n.kind === '기관' ? 8
                    : n.kind === '계획' ? (n.status === 'building' ? 6.5 : 4.5)
                    : 4;
            const ghost = n.kind === '계획';
            return (
              <g key={n.id} className={`bm-node bm-node--${n.kind}${on ? ' bm-node--fire' : ''}`}
                 onClick={() => setPick(pick?.id === n.id ? null : n)}
                 onMouseEnter={() => setHover(n.id)}
                 onMouseLeave={() => setHover(h => (h === n.id ? null : h))}>
                {on && <circle cx={p.x} cy={p.y} r={22} fill="url(#bmglow)" />}
                <circle cx={p.x} cy={p.y} r={r}
                        className={n.status === 'building' ? 'bm-build' : undefined}
                        strokeDasharray={ghost ? '2 2' : undefined}
                        fill={ghost ? 'none'
                              : `hsl(${m.regions[n.region]?.hue ?? 210} 75% 60%)`}
                        stroke={pick?.id === n.id ? '#fff' : s.c}
                        strokeWidth={pick?.id === n.id ? 2 : 1.8}
                        filter={on ? 'url(#bmlit)' : undefined}
                        opacity={n.status === 'dark' || n.status === 'idle'
                                 ? 0.34 : 0.94}>
                  <title>{`${n.label || n.id} · ${s.t}`}</title>
                </circle>
                {(on || hover === n.id || pick?.id === n.id) && (
                  <text className="bm-tag" x={p.x}
                        y={p.y + (n.kind === '기관' ? 15 : -11)} textAnchor="middle">
                    {n.label || n.id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {lit.length > 0 && (
          <div className="brainmap__live" key={pulse}>
            방금 울린 신경: {lit.join(' → ')}
          </div>
        )}
      </div>

      {turn && (
        <div className="brainmap__turn">
          <span>방금 턴 — <b>신경 {turn.nerves}</b>개 울림
            {turn.nerves ? ` (${(Array.isArray(lit) ? lit : [])
              .filter(x => !turn.organs.includes(x)).join(' → ')})` : ''}</span>
          <span>기관 <b>{turn.organs.length}</b>개 관여{turn.organs.length ? ` (${turn.organs.join(' · ')})` : ''}</span>
          <span>모델 <b>{turn.llm ? '씀' : '안 씀 — 표에서 셈'}</b></span>
          <span>근거 <b>{turn.refs}</b>건</span>
          {turn.level ? <span>확신 <b>{turn.level}</b></span> : null}
          <span>걸음 <b>{turn.trace.length}</b></span>
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
              {' '}({['선언','배선','도는 중','측정됨','관문'][pick.stage]})
              {pick.stage_why ? ` — ${pick.stage_why}` : ''}</div>) : null}
          {pick.why ? <div>{pick.why}</div> : null}
          {pick.수용체?.length ? <div>수용체: {pick.수용체.join(' · ')}</div> : null}
          {pick.자극?.length ? <div>이런 말에 울린다: 「{pick.자극[0]}」</div> : null}
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
      {/* 🔴 **이음 범례가 없었다** — 여덟 종을 그려 놓고 무엇이 무엇인지
          화면 어디에도 안 적혀 있었다 (실측). 세는 것도 함께 보인다. */}
      <div className="brainmap__legend brainmap__legend--edge">
        {EDGE_LEGEND.map(([kind, why]) => {
          const n = m.edges.filter(e => e.kind === kind).length;
          if (!n) return null;
          return (
            <span key={kind} title={why}>
              <i className={`bm-leg bm-leg--${EDGE_CLS[kind]}`} />{kind} {n}
            </span>
          );
        })}
      </div>
    </section>
  );
}
