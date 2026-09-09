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
  miss?: Record<string, number>; mod?: string; why?: string; label?: string;
  수용체?: string[]; 자극?: string[];
};
type Edge = { a: string; b: string; kind: string; n?: number };
type Region = { label: string; cx: number; cy: number; hue: number; hemi?: string };
type Map = {
  regions: Record<string, Region>; nodes: Node[]; edges: Edge[];
  maturity?: { 단계: string[]; 셈: Record<string, number>; 합: number };
  matrix?: { 측정?: number; 자극?: number; 명중?: number; 오배선?: number };
  tally?: Record<string, number>;
};

const W = 980, H = 580;

/** SSE 이름 → 조작 칸 (서버 `MOTOR` 와 같은 표 · 지어낸 이름 없음) */
const MOTOR_SSE: Record<string, string> = {
  'search': '검색', 'file-changed': '자료 열기', 'note-changed': '노트 편집',
  'vault-changed': '보관소', 'inbox-changed': '투입', 'memos-changed': '일정',
  'shelf-changed': '서가 이동', 'tended': '일과', 'initiate': '선말',
  'consistency': '일관성', 'lease-changed': '임차',
};

/** 뇌 옆모습 — 겉선 하나로 충분하다 (그림 파일을 안 쓴다). */
/** 좌·우 반구 — 이랑(gyri)이 물결지는 겉선. 그림 파일을 안 쓴다. */
const HEMI_L = 'M474,58 C420,44 360,44 312,58 C250,52 196,84 164,132 '
  + 'C112,158 88,214 96,272 C74,318 88,378 130,414 C150,462 200,494 262,502 '
  + 'C312,528 396,532 452,510 C468,506 474,498 474,486 Z';
const HEMI_R = 'M506,58 C560,44 620,44 668,58 C730,52 784,84 816,132 '
  + 'C868,158 892,214 884,272 C906,318 892,378 850,414 C830,462 780,494 718,502 '
  + 'C668,528 584,532 528,510 C512,506 506,498 506,486 Z';
const STEM = 'M490,510 C492,534 500,550 514,560';
const LOBE_R: Record<string, [number, number]> = {
  harness: [124, 58], front: [84, 58], broca: [104, 72], stem: [66, 40],
  motor: [62, 40],
  parietal: [98, 56], occipital: [80, 54], temporal: [90, 58],
  cerebellum: [94, 58],
};

const STATUS: Record<string, { c: string; t: string }> = {
  ok:       { c: '#3ecf8e', t: '의도대로 돈다' },
  part:     { c: '#e3b341', t: '일부만' },
  red:      { c: '#f0574a', t: '오배선 — 고칠 것' },
  dark:     { c: '#6b7280', t: '아직 못 잼' },
  idle:     { c: '#586074', t: '요즘 안 돌았다' },
  nomeas:   { c: '#7c8598', t: '재는 자가 없다' },
  unknown:  { c: '#4b5563', t: '모른다 (근거 없음)' },
  todo:     { c: '#8b5cf6', t: '선언만 — 빈칸' },
  planned:  { c: '#ff8ac4', t: '만들 차례 (아직 없는 신경)' },
  building: { c: '#ffd166', t: '지금 만드는 중' },
};

/** 영역 중심에 결정론으로 흩는다 (같은 지도를 다시 열어도 같은 자리). */
function place(nodes: Node[], regions: Record<string, Region>) {
  const pos: Record<string, { x: number; y: number }> = {};
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  Object.entries(byR).forEach(([r, list]) => {
    const reg = regions[r]; if (!reg) return;
    const cx = reg.cx * W, cy = reg.cy * H;
    // 🔴 **엽 안에 묶는다** — 앞 판은 배치 반지름이 엽 크기를 안 봐서 노드가
    //    반구 겉선 밖으로 흘렀다 (실측 그림). 나선은 그대로 두고 반지름만
    //    그 엽의 크기에서 받는다.
    const [lrx, lry] = LOBE_R[r] || [100, 70];
    list.forEach((n, i) => {
      const a = i * 2.399963;                       // 황금각
      const t = Math.sqrt((i + 0.5) / list.length);
      pos[n.id] = { x: cx + lrx * 0.84 * t * Math.cos(a),
                    y: cy + lry * 0.82 * t * Math.sin(a) };
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

  // 말을 걸면 그 턴에 울린 신경이 번쩍인다
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as
        { fired?: string[]; trace?: string[]; refs?: number; llm?: boolean;
          level?: string | null } | string[] | undefined;
      const ids = Array.isArray(d) ? d : (d?.fired ?? []);
      const trace = Array.isArray(d) ? [] : (d?.trace ?? []);
      // 🔴 걸음 글에서 **어느 기관이 실제로 일했는지** 읽는다 — 이것이
      //    «하네스·신경 활용 수준»의 실체다 (지어낸 연출이 아니라 자국).
      const ORGAN: [RegExp, string][] = [
        [/서재를 뒤지는 중|대조하는 중/, '읽기'],
        [/말을 고르는 중/, '말투'],
        [/확신을 정했다/, '심의 회로'],
        [/정서 —/, '정서'],
        [/기억|알려 주신/, '기억 3층'],
        [/관계|사슬/, '관계 사슬'],
        [/연상/, '연상망'],
        [/수단|상황/, '수단 고르기'],
        [/여몄다/, '존대 여미기'],
        [/빈 논항/, '한국어'],
      ];
      const organs = ORGAN.filter(([re]) => trace.some(t => re.test(String(t))))
                          .map(([, name]) => name);
      if (!ids.length && !organs.length) return;
      setLit([...ids, ...organs]); setPulse(p => p + 1);
      setTurn({ trace, refs: (Array.isArray(d) ? 0 : d?.refs ?? 0),
                llm: Array.isArray(d) ? false : !!d?.llm,
                level: Array.isArray(d) ? null : (d?.level ?? null),
                organs, nerves: ids.length });
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
        setLit(prev => (prev.includes(id) ? prev : [...prev, id]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      } else if (ev?.kind && MOTOR_SSE[ev.kind]) {
        // notology 조작 — 검색·열기·편집·투입이 일어나면 그 칸이 켜진다
        const id = `조작:${MOTOR_SSE[ev.kind]}`;
        setLit(prev => (prev.includes(id) ? prev : [...prev, id]));
        setPulse(p => p + 1);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLit([]), 5200);
      } else if (ev?.kind === 'tending' && ev.step) {
        setLit(prev => [...prev, `걸음:${ev.step}`]);
        setPulse(p => p + 1);
      }
    });
    return () => {
      window.removeEventListener('dobbin:fired', on as EventListener);
      try { off?.(); } catch { /* 구독 해제가 막혀도 화면은 산다 */ }
    };
  }, []);

  const pos = useMemo(() => (m ? place(m.nodes, m.regions) : {}), [m]);
  /** 같은 엽 안에서 가까운 둘을 잇는다 — 그물처럼 보이게 (뜻은 «이웃»). */
  const mesh = useMemo(() => {
    if (!m) return [] as [string, string][];
    const out: [string, string][] = [];
    const byR: Record<string, Node[]> = {};
    m.nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
    Object.values(byR).forEach(list => {
      list.forEach(a => {
        const pa = pos[a.id]; if (!pa) return;
        const near = list
          .filter(b => b.id !== a.id && pos[b.id])
          .map(b => ({ b, d: (pos[b.id].x - pa.x) ** 2 + (pos[b.id].y - pa.y) ** 2 }))
          .sort((x, y) => x.d - y.d).slice(0, 2);
        near.forEach(({ b }) => { if (a.id < b.id) out.push([a.id, b.id]); });
      });
    });
    return out;
  }, [m, pos]);
  if (!m?.nodes?.length) return null;
  const mx = m.matrix || {}, ta = m.tally || {};
  const litSet = new Set(lit);
  const nodeById: Record<string, Node> = {};
  m.nodes.forEach(n => { nodeById[n.id] = n; });

  return (
    <section className="brainmap">
      <h3>뇌 지도
        <span className="brainmap__sum">
          {m.nodes.length}개 · 의도대로 {ta.ok ?? 0} · 일부 {ta.part ?? 0} ·
          오배선 {ta.red ?? 0} · 못 잼 {ta.dark ?? 0} · 빈칸 {ta.todo ?? 0}
          {mx.명중 != null ? ` · 반사 ${mx.명중}/${mx.자극}` : ''}
          {ta.building ? ` · 🔨 지금 만드는 중 ${ta.building}` : ''}
          {ta.planned ? ` · 만들 차례 ${ta.planned}` : ''}
        </span>
      </h3>

      {m.maturity && (
        <div className="brainmap__mat" title="위 단계는 아래가 참이어야 준다">
          {m.maturity.단계.map((label, i) => {
            const n = m.maturity!.셈[String(i)] ?? 0;
            const pct = Math.round((100 * n) / (m.maturity!.합 || 1));
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
            {/* 🔴 반구 밖으로 삐져나오지 않게 잘라 낸다 (엽이 겉선을 넘던 것) */}
            <clipPath id="bmL"><path d={HEMI_L} /></clipPath>
            <clipPath id="bmR"><path d={HEMI_R} /></clipPath>
            <radialGradient id="bmglow">
              <stop offset="0%" stopColor="#fff" stopOpacity=".85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width={W} height={H} fill="url(#bmbg)" />
          {/* 좌·우 반구 겉선 */}
          <path d={HEMI_L} className="bm-outline" />
          <path d={HEMI_R} className="bm-outline" />
          <path d={STEM} className="bm-outline bm-outline--stem" />
          <text className="bm-hemi" x={285} y={30} textAnchor="middle">
            좌 · 규칙이 정하는 쪽</text>
          <text className="bm-hemi" x={695} y={30} textAnchor="middle">
            우 · 재료가 정하는 쪽</text>
          {/* 엽 — 색으로 갈린 영역 */}
          {Object.entries(m.regions).map(([k, r]) => {
            const [rx, ry] = LOBE_R[k] || [110, 80];
            return (
              <ellipse key={`lobe-${k}`} cx={r.cx * W} cy={r.cy * H} rx={rx} ry={ry}
                       className="bm-lobe" filter="url(#bmsoft)"
                       clipPath={`url(#bm${r.hemi === 'R' ? 'R' : 'L'})`}
                       style={{ fill: `hsl(${r.hue} 80% 55% / .10)`,
                                stroke: `hsl(${r.hue} 80% 62% / .34)` }} />
            );
          })}

          {/* 이웃 그물 — 촘촘하게, 아주 옅게 */}
          {mesh.map(([a, b], i) => {
            const pa = pos[a], pb = pos[b];
            if (!pa || !pb) return null;
            const on = litSet.has(a) || litSet.has(b);
            return <line key={`mesh${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                         className={`bm-mesh${on ? ' bm-mesh--on' : ''}`} />;
          })}

          {/* 영역 이름 — 엽 위쪽 가장자리에 칩으로 (노드와 안 겹친다) */}
          {Object.entries(m.regions).map(([k, r]) => {
            const [, ry] = LOBE_R[k] || [110, 80];
            const y = r.cy * H - ry - 6;
            return (
              <g key={`lab-${k}`}>
                <text className="bm-region" x={r.cx * W} y={y} textAnchor="middle"
                      style={{ fill: `hsl(${r.hue} 70% 68%)` }}>{r.label}</text>
              </g>
            );
          })}

          {/* 이음 — 사슬(옅게) · 공급(가늘게) · 오배선(붉게) */}
          {m.edges.map((e, i) => {
            const a = pos[e.a], b = pos[e.b];
            if (!a || !b) return null;
            const on = litSet.has(e.a) || litSet.has(e.b);
            const na = nodeById[e.a], nb = nodeById[e.b];
            const cross = na && nb
              && m.regions[na.region]?.hemi !== m.regions[nb.region]?.hemi;
            const cls = `bm-edge bm-edge--${e.kind === '오배선' ? 'bad'
              : e.kind === '공급' ? 'feed' : 'chain'}`
              + (cross ? ' bm-edge--cross' : '') + (on ? ' bm-edge--on' : '');
            // 좌우를 건너는 이음은 가운데(뇌량)로 휘어 지난다
            const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2;
            const d = cross
              ? `M${a.x},${a.y} Q${W / 2},${my2} ${b.x},${b.y}`
              : `M${a.x},${a.y} Q${mx2},${my2 - 12} ${b.x},${b.y}`;
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
          <span className="bm-kind">{pick.kind}{pick.sub ? ` · ${pick.sub}` : ''}</span>
          {pick.mod ? <code>{pick.mod}</code> : null}
          <div>{(STATUS[pick.status] || STATUS.dark).t}
            {pick.n ? ` · 반사 ${pick.hit}/${pick.n}` : ''}
            {pick.n === undefined && pick.n !== null && typeof pick.n === 'number'
              ? '' : ''}</div>
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
    </section>
  );
}
