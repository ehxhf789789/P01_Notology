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
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { lifeTail, onLive, sseState } from '../../web/liveSync';
import { budget as qBudget, qualityInfo } from '../../web/quality';

// v26-B P1-C — 정직한 상태 칩 (한빈: «진짜 유휴인지 시각화 누락인지
// 혼동스럽다»). 마지막 «일 이벤트» 나이 + 잔량으로 지도가 스스로 말한다:
// 어두운데 «일하는 중»이면 시각화 결함, «잔량인데 신호 없음»이면 서버 공백
// — 혼동 자체가 사라진다. 1s 틱은 이 작은 칩만 다시 그린다 (렉 규율).
const WORK_KINDS = new Set(['thinking', 'tending', 'tended', 'inbox-changed',
  'note-changed', 'vault-changed', 'brainmap-delta', 'brainmap-changed',
  'upload', 'errand-changed']);
function useWorkState(): { cls: string; txt: string;
                                        age: number; anyAge: number } {
  const [, force] = useState(0);
  const lastRef = useRef<number>(0);
  const pendRef = useRef<number | null>(null);
  const touchRef = useRef<number>(0);
  const anyRef = useRef<number>(Date.now());     // ping 포함 — 연결 생존 신호
  useEffect(() => {
    const off = onLive((ev: { kind?: string; pending?: number }) => {
      if (!ev?.kind) return;
      anyRef.current = Date.now();
      if (typeof ev.pending === 'number') pendRef.current = ev.pending;
      if (WORK_KINDS.has(ev.kind) || ev.kind.startsWith('act')) {
        lastRef.current = Date.now();
      }
    });
    // 사람 우선의 역설 — 지도를 보는 손이 governor 를 통해 일을 물린다
    // (2-8: 배치는 사람에게 양보). 그 상태를 «중단»이 아니라 «양보»라고
    // 말해야 혼동이 안 남는다 (한빈 09-13: «또 중단 상태로 보이는데?» —
    // 물러섬 장부의 정체가 사용자 자신의 클릭이었다).
    const touch = () => { touchRef.current = Date.now(); };
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch, { passive: true });
    // 🔴 **1초 틱을 걷었다** (한빈 2026-09-17: *"「일하는중 n초 전」 UI가
    //    거슬린다"*). 초를 1초마다 다시 그리니 숫자가 쉼 없이 오르고, 그것이
    //    거슬림의 정체였다 — 상태가 안 바뀌어도 매초 재렌더였다.
    //    이제 **문구가 바뀔 만한 문턱을 지날 때만** 깨운다 (30·75·90초).
    //    ⚠️ 없애면 「쉼 → 신호 끊김」 전환을 영영 못 보므로 15초 맥은 남긴다.
    const t = window.setInterval(() => force(x => x + 1), 15000);
    return () => {
      off?.(); window.clearInterval(t);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
    };
  }, []);
  const age = lastRef.current ? (Date.now() - lastRef.current) / 1000 : Infinity;
  const anyAge = (Date.now() - anyRef.current) / 1000;
  const pend = pendRef.current;
  let cls = 'bm-chip--idle';
  let txt: string;
  // 서버 ping 은 20s 마다 — 75s 무신호는 스트림이 죽은 것이다 (감시견이
  // 55s 에 되살리므로, 이 문구가 오래 보이면 감시견까지 실패한 것 —
  // 스크린샷 한 장으로 «스트림 사인가 렌더 사인가»가 갈린다).
  if (anyAge > 75) {
    cls = 'bm-chip--warn';
    txt = `⚠ 신호 끊김 ${Math.round(anyAge)}초 — 재접속 시도 중`;
  } else if (age < 30) {
    // 🔴 **초를 안 쓴다.** 「지금 일하는 중」이면 족하고, 몇 초 전인지는
    //    사람이 쓸 일이 없다 (2-14-2-2: 상태가 없으면 애니메이션도 없다).
    //    정확한 초는 hover 의 title 로만 — 못 보게 하는 게 아니라 조용히.
    cls = 'bm-chip--work';
    txt = '일하는 중';
  } else if (pend != null && pend > 0
             && Date.now() - touchRef.current < 90000) {
    txt = `사람 우선 양보 중 · 잔량 ${pend.toLocaleString()}`;
  } else if (pend != null && pend > 0 && age >= 60) {
    cls = 'bm-chip--warn';
    txt = `⚠ 잔량 ${pend.toLocaleString()} — 일 신호 없음 ${Math.round(age / 60)}분`;
  } else if (!isFinite(age)) {
    txt = '이벤트 대기 중';
  } else {
    // 🔴 **쉴 때는 아무 말도 안 한다.** 조용할 때 조용한 것이 살아 있는
    //    것에 더 가깝다 (2-14-2-2). 빈 문자열이면 칩을 안 그린다.
    txt = '';
  }
  return { cls, txt, age, anyAge };
}

let _STAMP: string | null = null;
function BuildTag() {
  // v26-C — 모든 스크린샷이 제 번들을 자백한다 (낡은 탭이 «멈춤»으로
  // 위장하던 순환의 진단 꼬리표).
  const [st, setSt] = useState(_STAMP);
  useEffect(() => {
    if (_STAMP) return;
    fetch('/app/.build-stamp.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { _STAMP = String(j.source_commit || '').slice(0, 7); setSt(_STAMP); })
      .catch(() => { /* 없어도 산다 */ });
  }, []);
  return st ? (
    <div style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 9,
                  opacity: .45, color: '#7c8598', pointerEvents: 'none' }}>
      판 {st}
    </div>
  ) : null;
}

function StateChip({ lit = [], enOf = {} }:
                   { lit?: string[]; enOf?: Record<string, string> }) {
  const { cls, txt, age } = useWorkState();
  // v26-B — 칩 클릭 = 기기 자가진단 (한빈: «타 컴퓨터에서는 안 보인다» —
  // 기기마다 사인이 달라, 화면이 제 기기의 사실을 직접 말해야 원격 진단이
  // 된다). 10초 보여주고 되접는다.
  const [diag, setDiag] = useState<string | null>(null);
  const showDiag = async () => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stamp = '?';
    try {
      const r = await fetch('/app/.build-stamp.json', { cache: 'no-store' });
      stamp = String((await r.json()).source_commit || '').slice(0, 7);
    } catch { /* 판을 못 읽어도 진단은 나간다 */ }
    const heap = (performance as { memory?: { usedJSHeapSize: number } })
      .memory?.usedJSHeapSize;
    setDiag(`${qualityInfo()} ｜ 판 ${stamp} · 모션줄임 ${rm ? '켜짐(OS)' : '꺼짐'} · SSE ${
      ['연결중', '열림', '닫힘'][sseState()] ?? '없음'} · heap ${
      heap ? Math.round(heap / 1048576) + 'MB' : '?'} ｜ ${
      lifeTail(4).join(' → ') || '(생애 기록 없음)'}`);
    window.setTimeout(() => setDiag(null), 15000);
  };
  // 🔴 **할 말이 없으면 아무것도 안 그린다** (한빈 2026-09-17 «거슬린다»).
  //    2-14-2-2 의 그 규율 — *조용할 때 조용한 것이 살아 있는 것에 더
  //    가깝다*. 다만 자가진단을 열었으면 그때는 보인다.
  if (!txt && !diag && !lit.length) return null;
  // 방금 울린 사슬 — 옛 `brainmap__live` 띠의 알맹이. 지도를 덮던 것을
  // 같은 줄로 데려왔다. 여섯은 길어서 셋까지만.
  const chain = lit.slice(0, 3).map(x => enOf[x] || x).join(' ← ');
  const when = isFinite(age)
    ? `마지막 일 ${age < 90 ? Math.round(age) + '초' : Math.round(age / 60) + '분'} 전`
    : '아직 신호 없음';
  return (
    <div className={`bm-strip ${cls}`} onClick={showDiag} role="status"
         aria-live="polite"
         title={`${when} ｜ 클릭 = 이 기기의 자가진단 (판·모션 설정·브라우저)`}>
      <span className="bm-strip__state">{diag ?? txt}</span>
      {!diag && chain ? <span className="bm-strip__chain">{chain}</span> : null}
    </div>
  );
}
import './brain.css';
import { Brain3D } from './Brain3D';

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
  /** 🔴 **밖에서 오는 이음** (v51 P2). v50 이 관문·잣대·서비스·계획을 지도에서
   *  내리며 그 이음 **223개**가 한쪽 끝을 잃고 버려졌다 — 그중 **검증 116**
   *  은 「이 신경이 어느 관문에 지켜지는가」다. 노드는 안 올리고 **사실만**
   *  올린다: 수·갈래·임자(8개까지)가 여기 들어온다. */
  밖?: { n: number; kinds: Record<string, number>;
         who: { id: string; kind: string }[] };
};
type Edge = { a: string; b: string; kind: string; n?: number;
  /** "static" = 코드에 있다(정적 분석) — 실측된 이음과 다르다 */
  grade?: string };
type Region = { label: string; cx: number; cy?: number; hue: number; layer?: string | null; core?: boolean };
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
  /** 재고 축 — 지금 쌓여 있는 것 (3차 검토가 비어 있다고 잡은 그 축) */
  stock?: Record<string, number | null>;
  bench?: {
    at?: string; 'recall@5'?: number; n?: number;
    chat_at?: string; 'chat@5'?: number; 'chat_off@5'?: number; chat_n?: number;
  } | null;
  /** 🔴 `_밖` 은 영역이 아니라서 census Record 에서 분리됐다 (2026-09-11) */
  outside?: { 수?: number; 줄수?: number; 큰것?: [number, string][];
              이름밖?: number; 이름밖그림?: number;
              이름밖큰것?: [number, string][]; 왜?: string };
  matrix?: { 측정?: number; 자극?: number; 명중?: number; 오배선?: number;
             신경전체?: number; 문?: number; 문표시?: number;
             /** 🔴 **분모를 갈라 받는다** (v51 P4). `신경전체` 161 에는 반사
              *  벤치가 **설계상 안 재는** `변조` 40개가 섞여 있다 — 못 재는
              *  것을 분모에 넣으면 영원히 100%가 못 되는 성적이 된다. */
             잴수있음?: number; 못잼변조?: number; 자극없음?: number;
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
/** 원사건만 담는다 — lane·글은 **렌더 때** 서버 trace_lanes 로 파생한다
 *  (2026-09-11 3차 검토: 백필 줄이 지도 도착 전에 「활동」으로 굳고,
 *  what 규칙이 두 벌이었다). ts 는 초 단위 epoch — 병합·중복 제거 열쇠. */
type Trace = { ts: number; kind: string; raw: Record<string, unknown> };

/** 한 벌뿐인 what 규칙 — 백필·실시간이 같은 글자를 얻는다 */
function traceWhat(ev: Record<string, unknown>): string {
  const t = ev as Record<string, any>;
  const cnt = t.total != null
    ? `전체 ${t.total}${t.grew ? ` (+${t.grew})` : ''}` : null;
  return String(t.step ?? t.nerve ?? t.path ?? t.name ?? cnt
    ?? t.note ?? t.kind ?? '').slice(0, 60);
}

/** 병합 — at+kind 로 중복을 걷고 최신순 40 */
function mergeTrace(prev: Trace[], add: Trace[]): Trace[] {
  const seen = new Set(prev.map(t => `${t.ts}|${t.kind}`));
  const out = [...prev];
  add.forEach(t => {
    const k = `${t.ts}|${t.kind}`;
    if (!seen.has(k)) { seen.add(k); out.push(t); }
  });
  return out.sort((a, b) => b.ts - a.ts).slice(0, 40);
}

/** 판 — 🔴 **정사각이다** (v51 · 한빈 2026-09-17: *"여백이 균일하지 않음"*).
 *
 *  전 판은 `980×700`(1.4:1)인데 그리는 것은 **원**(1:1)이라 여백이 이랬다:
 *
 *      좌 232 · 우 232 · 상 **32** · 하 **152**      ← 좌우가 위의 **7.2배**
 *
 *  원인이 둘이다. ⓐ 가로가 세로보다 280 넓은데 원은 그 자리를 못 쓴다.
 *  ⓑ `CY` 를 **장비 띠 자리를 빼고** 냈다 — 그런데 **v50 이 장비를 지도에서
 *  내렸다.** 예약만 남아 아래 150이 영구 공백이 됐다.
 *
 *  → 판을 정사각으로 하고 한가운데에 둔다. **좌=우 · 상=하 가 구조로 보장**
 *    되고, 남는 여백은 창 모양 탓이지 그림 탓이 아니게 된다. */
const W = 760, H = 760;

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
  // v20 온톨로지 — 억제(비켜서기)·전제(설전 의존)는 코드에 실재하는 관계다
  '억제': 'bad', '전제': 'gate',
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
  ['위계', '이 부(온톨로지)에 속한 신경이다'],
  ['사슬', '답을 고르는 차례 — 앞이 이긴다'],
  ['오배선', '의도한 신경 대신 저 신경이 먹었다'],
  ['억제', '이 신경이 물면 저 신경이 비킨다 (코드의 비켜서기)'],
  ['전제', '저 신경은 이 신경이 만든 상태 위에서만 선다'],
];

const STATUS: Record<string, { c: string; t: string }> = {
  ok:       { c: '#3ecf8e', t: '의도대로 돈다' },
  part:     { c: '#e3b341', t: '일부만' },
  red:      { c: '#f0574a', t: '오배선 — 고칠 것' },
  fires:    { c: '#a3e635', t: '운영에서 발화함 — 벤치 측정은 아직' },
  dark:     { c: '#6b7280', t: '아직 못 잼' },
  idle:     { c: '#586074', t: '요즘 안 돌았다' },
  nomeas:   { c: '#7c8598', t: '재는 자가 없다' },
  unknown:  { c: '#4b5563', t: '모른다 (근거 없음)' },
  // 🔴 «선언만 — 빈칸» 은 **거짓 이름이었다** (한빈 2026-09-17:
  //    *"todo 신경은 차례를 기다리는 할일로 왜 등록되어 있는가?"*).
  //    서버는 `brainmap.py:2208` 에서 «수용체를 안 적었다» 일 때 이 값을
  //    준다 — 「아직 안 지었다」가 아니다. 실측 2026-09-17: 21개 중
  //    `정서걱정` 은 문이 `memos.briefing()` 에 **실재하고 돌고 있었다**
  //    (세는 자가 없었을 뿐) · `말투적용` 은 문도 계수기도 있는데 **자극이
  //    안 온다**. 셋을 「빈칸」이라 부르면 고칠 자리를 잘못 짚는다.
  todo:     { c: '#8b5cf6', t: '수용체 없음 — 못 잰다' },
  // ⚠️ `planned`·`building` 은 **kind='계획' 노드**에 붙는다. 그 노드만
  //    도넛으로 그려진다(`ghost`, 아래 :9xx·:13xx) — status 가 아니라
  //    **kind** 가 모양을 정한다. 한빈님이 「핑크 도넛」으로 본 것이 이것이고,
  //    `todo` 신경(보라 **꽉 찬** 점)과는 다른 축이다.
  planned:  { c: '#ff8ac4', t: '차례를 기다리는 할 일 (계획 — 도넛)' },
  building: { c: '#ffd166', t: '지금 만드는 중 (계획 — 도넛)' },
  // 🔴 `fold` 는 서버가 **한 번도 안 내보낸다** (grep 0건) — 죽은 칸이라
  //    걷었다. 「접힘」은 status 가 아니라 kind 로만 있다.
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
const CX = W / 2, CY = H / 2;      // 🔴 한가운데 (전 판은 290 — 60 위였다)
/** 링 **차례**의 계약 — 반지름은 아래 `ringGeo()` 가 **노드 수로** 계산한다
 *  (한빈 2026-09-11: *"노드가 추가되면 범위도 동적으로 넓어지고 디자인도
 *  동적으로 변화되도록"*). 열쇠는 서버 LAYERS 와 한 벌이어야 한다 (뇌계약
 *  관문이 문다). */
const RINGS: Record<string, number> = { '원심': 0, '연합': 1, '구심': 2 };
/** 🔴 `R_OUT` 은 **자가 정한 값**이다. 이름표가 `arc.r1 + 10` 에 가운데 정렬로
 *  그려지므로(아래 이름표 절) 글자 절반이 더 나간다 — 반지름만 보고 못 박으면
 *  지도 밖으로 샌다. `tools/_v51_layout.mjs` 가 「지도 밖 0 · 여백 사방 같음」
 *  을 통과하는 값으로 잡았다. 여백 = 380 − 300 = **80** (사방 같다). */
const R_IN = 50, R_OUT = 300, R_GAP = 24;   // 중심 여백 · 바깥 한계 · 링 사이 틈

/** 층별 노드 수 → 링 [안, 밖] 반지름.
 *
 *  🔴 **두께를 √수 로 나누던 것이 「개판」의 뿌리였다** (v50 · 2026-09-17).
 *     링의 자리는 두께가 아니라 **넓이**(`½θ(r₁²−r₀²)`)이고 반지름이 **제곱**
 *     으로 들어간다. √ 가중은 셈을 평탄화해 버려 실측이 이랬다:
 *
 *       원심 237개 → [50,114]  넓이 5,272   **131 px²/노드**
 *       연합 172개 → [138,193]              289 px²/노드
 *       구심  97개 → [217,258] 넓이 9,757   **602 px²/노드**   ← 4.6배
 *
 *     구심 링이 텅 비어 보이고 원심에 38%가 몰려 겹쳤다. 한빈님이 본
 *     「빈 영역」의 정체는 특정 영역이 아니라 **구심 링 전체**였다.
 *
 *  → **넓이로 나눈다.** `r₁² − r₀² ∝ n` 이 되도록 반지름 제곱 구간을 배분하면
 *     노드당 자리가 링마다 같아진다. 바닥(`MIN_T`)은 한 링이 실처럼 얇아지는
 *     것만 막는다.
 */
const MIN_T = 26;   // 링 최소 두께 — 이보다 얇으면 점이 선처럼 뭉친다

function ringGeo(counts: Record<string, number>): Record<string, [number, number]> {
  const order = Object.keys(RINGS).sort((a, b) => RINGS[a] - RINGS[b]);
  const n = order.map(k => Math.max(counts[k] ?? 0, 4));
  const tot = n.reduce((a, b) => a + b, 0) || 1;
  // 쓸 수 있는 **넓이**(반지름 제곱 구간) — 틈을 빼고 남는 것
  const gaps = R_GAP * (order.length - 1);
  const rIn = R_IN, rOut = R_OUT - gaps;          // 틈을 미리 덜어 둔다
  const area = rOut * rOut - rIn * rIn;
  const out: Record<string, [number, number]> = {};
  let r2 = rIn * rIn, shift = 0;
  order.forEach((k, i) => {
    let a = area * n[i] / tot;                    // 이 링이 가질 넓이
    let r0 = Math.sqrt(r2), r1 = Math.sqrt(r2 + a);
    if (r1 - r0 < MIN_T) { r1 = r0 + MIN_T; a = r1 * r1 - r2; }   // 바닥
    out[k] = [r0 + shift, Math.min(r1 + shift, R_OUT)];
    r2 += a; shift += R_GAP;
  });
  return out;
}
/** 장비 위성 호 — 뇌 링 밖 아래 반원. 아래 끝 290+334=624 ≤ 700. */
const EQUIP_RING: [number, number] = [288, 334];

/** 부(部) 하위 호 — 영역 안을 **온톨로지대로** 가른 칸 하나. */
type Sub = { key: string; label: string; n: number;
             a0: number; a1: number; i: number; of: number };
type Lobe = { cx: number; cy: number; rx: number; ry: number; hue: number;
              label: string; n: number; equip: boolean;
              /** 🔴 **부 하위 호** (v51 P3 · 한빈: *"신경이 배치되는 영역을
               *  더 세분화하여 시각화"*). 서버가 `갈래:{부}` 노드 33개와
               *  위계 이음 161개를 **이미 보내는데** 화면이 점 하나로만
               *  그리고 있었다 — 배치는 `region` 하나만 봤다. */
              subs?: Sub[];
              /** 기질(core) 로브 — 첫 노드는 정확히 중심에 (한빈: «정중앙») */
              core?: boolean;
              /** 호 구획 — 뇌 안 영역만 갖는다 (장비 선반은 없다) */
              arc?: { a0: number; a1: number; r0: number; r1: number } };

/** 한 영역의 노드를 **어느 칸으로 가를까** — 지어내지 않고 **있는 칸**으로.
 *
 *  🔴 신경이 든 영역 10개는 `부`(온톨로지 정본 `BU`·`FAMILY`)가 있다.
 *     가장 붐비는 `cerebellum`(149 = 기관 80 + 걸음 69)에는 **부가 없다** —
 *     거기서는 **있는 칸** `kind` 로 가른다. 없는 축을 만들지 않는다.
 *  ⚠️ 부가 없는 노드(기관·감각 등)는 `'·'` 한 칸에 모인다 — 버리지 않는다. */
function subKey(n: Node, mode: 'bu' | 'kind'): string {
  if (mode === 'kind') return n.kind || '·';
  // 🔴 **영문화가 이음을 끊었다** — 서버가 표시용으로 `label` 을 영문으로
  //    갈고 원 이름을 `ko` 로 옮긴다(`brainmap.py`). 신경의 `부` 는 한국어라
  //    `label` 로 묶으면 **같은 부가 둘로 갈린다** (실측: `Speech Unfold` 가
  //    `말펴기부` 와 따로 섰다). 갈래는 **`ko` 를 먼저** 본다.
  if (n.kind === '갈래') return ((n as any).ko ?? n.label ?? '·');
  // 🔴 부가 없으면 **「·」로 버리지 않고** 있는 칸(`kind`)으로 부른다.
  //    실측에서 `perception › ·` 49개가 가장 큰 칸이었는데, 그 49개는 전부
  //    **기관**이었다 — 이름이 없는 게 아니라 **안 준 것**이다
  //    ([[dashboard-is-itself-untested-instrument]] 의 «미분류 통» 과 같은 병).
  return (n as any).부 || n.kind || '·';
}

function lobes(nodes: Node[], regions: Record<string, Region>,
               rings: Record<string, [number, number]>): Record<string, Lobe> {
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  const out: Record<string, Lobe> = {};
  // 층마다 그 층의 영역을 모아 링 위에서 각도를 배분한다
  const perLayer: Record<string, [string, number][]> = {};
  Object.entries(byR).forEach(([r, list]) => {
    const reg = regions[r]; if (!reg) return;
    // v26-B ② — 기질(core) 영역은 두뇌 중앙 로브다. 서버가 선언한 속성
    // (regions[r].core)이 기하를 정한다 — 노드 이름 특례 0 (한빈: «규칙
    // 기반으로 생성·관리»). LLM·임베딩은 모든 연합 신경이 그 위에서 도는
    // 기질이라 영역 자체가 없던 것이 결함이었다.
    if (reg.core) {
      out[r] = { cx: CX, cy: CY, rx: 52, ry: 52, hue: reg.hue,
                 label: reg.label, n: list.length, equip: false, core: true };
      return;
    }
    const equip = list[0]?.equip ?? !reg.layer;
    if (equip || !reg.layer || !rings[reg.layer]) {
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
    const [r0, r1] = equipRing ? EQUIP_RING : rings[layer];
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
      // ── 🔴 **부 하위 호** (v51 P3). 영역 호를 **식구 수에 비례해** 부마다
      //    자른다. 같은 부의 신경이 한 칸에 모이면 위계가 자리에서 읽힌다.
      //    부가 하나뿐이면 자를 것이 없으므로 안 만든다 (칸막이만 늘 뿐).
      const list = byR[r] || [];
      const hasBu = list.some(x => (x as any).부);
      const mode: 'bu' | 'kind' = hasBu ? 'bu' : 'kind';
      const cnt = new Map<string, number>();
      list.forEach(x => {
        const k = subKey(x, mode);
        cnt.set(k, (cnt.get(k) ?? 0) + 1);
      });
      // 큰 칸부터 — 차례가 바뀌면 매 렌더 자리가 흔들린다 (결정론 유지)
      const keys = [...cnt.entries()]
        .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
      let subs: Sub[] | undefined;
      if (keys.length > 1) {
        const SGAP = Math.min(0.012, span * 0.03);      // 칸막이 틈 (rad)
        const tot2 = keys.reduce((z, [, v]) => z + v, 0) || 1;
        const av2 = span - SGAP * (keys.length - 1);
        let b = a;
        subs = keys.map(([k, v], i) => {
          const w = av2 * v / tot2;
          const one = { key: k, label: k, n: v, a0: b, a1: b + w,
                        i, of: keys.length };
          b += w + SGAP;
          return one;
        });
      }
      out[r] = { cx: CX + rm * Math.cos(mid), cy: CY + rm * Math.sin(mid),
                 rx: (r1 - r0) / 2, ry: (r1 - r0) / 2,
                 hue: regions[r].hue, label: regions[r].label,
                 n: byR[r].length, equip: equipRing, subs,
                 arc: { a0: a, a1: a + span, r0, r1 } };
      a += span + GAP;
    });
  });
  return out;
}

/** 이름표 자리잡기 — 겹치면 밀고, 못 밀면 `null`(안 그린다).
 *  🔴 렌더마다 `resetTags()` 로 비운다 — 안 비우면 두 번째 렌더부터 제
 *     이름표와 겹쳐 전부 사라진다. */
let _tagBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
function resetTags() { _tagBoxes = []; }
function tagAt(x: number, y: number, label: string): number | null {
  const w = (label || '').length * 4.6 + 4;      // 8.5px 글자 폭 어림
  const h = 12.9;                                // 헤일로 포함 높이
  for (const dy of [0, -13, 13, -26, 26]) {
    const b = { x0: x - w / 2, x1: x + w / 2, y0: y + dy - h, y1: y + dy };
    const hit = _tagBoxes.some(o =>
      b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    if (!hit) { _tagBoxes.push(b); return y + dy; }
  }
  return null;
}
/** 덧층(방금 울린 것)용 — **밀되 안 숨긴다.** 울리는 것은 중요하므로
 *  자리를 못 찾아도 그린다. 🔴 장부를 **안 더럽힌다** — 덧층은 매 렌더
 *  바뀌는데 장부에 쌓으면 다음 렌더에서 기반 이름표가 밀려난다. */
function tagAvoid(x: number, y: number, label: string): number {
  const w = (label || '').length * 4.6 + 4, h = 12.9;
  for (const dy of [0, -13, 13, -26, 26]) {
    const b = { x0: x - w / 2, x1: x + w / 2, y0: y + dy - h, y1: y + dy };
    if (!_tagBoxes.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0))
      return y + dy;
  }
  return y - 26;
}

/** 결정론 배치 — 호 구획 안에 황금비 저불일치 수열로 흩는다. */
function place(nodes: Node[], lb: ReturnType<typeof lobes>) {
  const pos: Record<string, { x: number; y: number }> = {};
  const byR: Record<string, Node[]> = {};
  nodes.forEach(n => { (byR[n.region] ||= []).push(n); });
  Object.entries(byR).forEach(([r, list]) => {
    const L = lb[r]; if (!L) return;
    // 🔴 **제 부 호 안에 앉힌다** (v51 P3). 전에는 영역 호 전체에 흩어서
    //    같은 부의 신경이 반대편 끝에 떨어졌다 — 위계가 자리에서 안 읽혔다.
    //    ⚠️ 칸 **안에서의 차례(j)** 로 수열을 돌려야 한 칸에 두 점이 겹치지
    //    않는다. 전역 `i` 를 그대로 쓰면 칸마다 수열이 끊겨 뭉친다.
    const subOf = new Map<string, Sub>();
    const seen = new Map<string, number>();
    if (L.subs) {
      const mode: 'bu' | 'kind' = list.some(x => (x as any).부) ? 'bu' : 'kind';
      L.subs.forEach(sb => subOf.set(sb.key, sb));
      list.forEach(n => { (n as any).__sk = subKey(n, mode); });
    }
    list.forEach((n, i) => {
      if (L.arc) {
        let { a0, a1 } = L.arc;
        const { r0, r1 } = L.arc;
        const sb = L.subs ? subOf.get((n as any).__sk) : undefined;
        if (sb) {
          a0 = sb.a0; a1 = sb.a1;
          i = seen.get(sb.key) ?? 0;              // 칸 안에서의 차례
          seen.set(sb.key, i + 1);
        }
        // 🔴 **저불일치 쌍이 틀려 있었다** (v50 · 2026-09-17).
        //    `1/φ`(0.6180339887)와 플라스틱 수 역수(0.7548776662)는 **2차원
        //    저불일치 쌍이 아니다.** R₂ 수열의 올바른 짝은
        //    `0.7548776662` 와 `0.5698402910` 이다.
        //    옛 조합은 **lag 8** 에서 Δu=−0.0557·Δv=+0.0390 이라
        //    `i` 와 `i+8` 이 **언제나 3.6~4.1px** 안에 떨어졌다 —
        //    겹침이 우연이 아니라 **구조**였다. `verify` 15개를 재현하니
        //    6쌍이 4px 안이었고, 지도 전체로는 **4px 안에 230쌍**.
        const u = (i * 0.7548776662) % 1;             // R₂ — 각도
        const v = (i * 0.5698402910) % 1;             // R₂ 짝 — 반지름
        const th = a0 + (a1 - a0) * (0.09 + 0.82 * u);
        // 🔴 안팎 여백 32% → 20% (두께를 더 쓴다)
        const rr = r0 + (r1 - r0) * (0.10 + 0.80 * v);
        pos[n.id] = { x: CX + rr * Math.cos(th), y: CY + rr * Math.sin(th) };
      } else if (L.core) {
        // 기질 — 첫 노드(llm)는 정중앙, 형제(임베딩 등)는 좁은 고리로
        const a = i * 2.399963;
        const rr = i === 0 ? 0 : 20 + 7 * Math.sqrt(i);
        pos[n.id] = { x: L.cx + rr * Math.cos(a), y: L.cy + rr * Math.sin(a) };
      } else {
        const a = i * 2.399963;                       // 황금각 (선반)
        const t = Math.sqrt((i + 0.5) / list.length);
        pos[n.id] = { x: L.cx + L.rx * 0.84 * t * Math.cos(a),
                      y: L.cy + L.ry * 0.82 * t * Math.sin(a) };
      }
    });
  });
  // 🔴 **빚 끌어당김을 걷었다** (v50). 계획 노드가 이제 지도에 없다 —
  //    「뇌 지도에는 뇌만」. 어제 이 코드가 ① 개발 큐 호를 **빈 영역**으로
  //    만들고 ② 옮겨간 자리에서 다른 노드와 겹치게 했다 (내 회귀).
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


export function BrainMap() {
  const [m, setM] = useState<Map | null>(null);
  // 🔴 노드 **객체**를 잡으면 지도가 갱신돼도 상세칸이 옛 값을 보였다 (A18)
  //    — id 만 잡고 렌더마다 지금 지도에서 찾는다.
  const [pickId, setPickId] = useState<string | null>(null);
  const [reg, setReg] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** 영역(호 구획) hover — 노드 hover 와 **별개 축**이다 (한빈 2026-09-11:
   *  *"타이틀도 영역에 hover 하면 보이도록. 노드 hover 랑 영역 hover 랑
   *  별도로."*). 평시엔 이름을 안 그려 겹침이 0이 된다. */
  const [regHover, setRegHover] = useState<string | null>(null);
  const [lit, setLit] = useState<string[]>([]);
  // v26 유기화(P-D): 발화 나이·도약 펄스 — 일괄 소등 대신 개별 페이드
  const litAtRef = useRef<Record<string, number>>({});
  const lastFireRef = useRef<{ id: string; at: number } | null>(null);
  // «도는 중» 걸음 — 시작 신호로 붙고 끝 신호·120s 로 떨어진다. prune 이
  // litAt 을 되찍어 주므로 도는 동안 halo 가 숨쉬듯 이어진다.
  const stickyRef = useRef<Record<string, { since: number; ttl: number }>>({});
  const [pulses, setPulses] = useState<{ k: string; x1: number; y1: number;
    x2: number; y2: number; at: number }[]>([]);
  /** 자국 띠 — 갈래 표는 서버 `trace_lanes` 가 정본 (한빈 2026-09-10) */
  const [trace, setTrace] = useState<Trace[]>([]);
  // 🔴 늦게 열거나 끊겼다 붙으면 그 사이 자국이 영영 없었다 (2026-09-11) —
  //    서버의 최근 사건 버퍼로 씨를 뿌린다. SSE 로 온 것이 위에 쌓인다.
  const backfill = () => {
    fetch('/api/events/recent').then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j?.events?.length) return;
      // 🔴 「비었을 때만」이었다 — 재접속 때 놓친 사건이 영영 안 메워졌다
      //    (3차 검토). 병합으로 바꾼다 — at+kind 중복은 걷힌다.
      setTrace(prev => mergeTrace(prev, j.events.map((ev: any) => ({
        ts: Math.round(ev.at || 0), kind: String(ev.kind || ''), raw: ev,
      }))));
    }).catch(() => { /* 백필은 덤 */ });
  };
  useEffect(backfill, []);
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
    const lastBuiltRef = { current: '' as string };
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
        // 🔴 같은 판이면 다시 안 그린다 (2026-09-13) — 60초 심박마다
        //    350KB 판을 setM 하면 400노드 SVG 가 통째로 재렌더된다.
        //    built_at 이 그대로면 서버 캐시 적중 = 화면도 그대로가 맞다.
        const ba = (j as { built_at?: string }).built_at;
        if (ba && ba === lastBuiltRef.current) { setErr(null); return; }
        if (ba) lastBuiltRef.current = ba;
        setM(j as Map);
        setErr(null);
        // 🔴 fetch 시각이 아니라 **지은 시각** — 거짓 신선도 금지
        // built_at 없으면(낡은 서버) fetch 시각으로 물러서되 **표를 단다** —
        //    그 물러섬이 옛 거짓 신선도 그대로였다 (3차 검토 A6)
        setAt(j?.built_at ? j.built_at.slice(5)
              : '읽은 시각(대체) ' + new Date().toLocaleTimeString('ko-KR',
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
  const mRef = useRef(m);
  mRef.current = m;
  const byName = useMemo(() => {
    const o: Record<string, string> = {};
    (m?.nodes || []).forEach(n => {
      if (n.label) o[n.label] ??= n.id;
      // 🔴 라벨이 영문화돼도 발화 자국·SSE 는 한국어 id 로 온다 — `ko`
      //    (원래 이름)와 id 의 맨 이름(`신경:판본`→`판본`)을 함께 잇는다.
      const ko = (n as { ko?: string }).ko;
      if (ko) o[ko] ??= n.id;
      const bare = n.id.includes(':') ? n.id.slice(n.id.indexOf(':') + 1) : '';
      if (bare) o[bare] ??= n.id;
      o[n.id] = n.id;
      if (n.sse) o[`sse:${n.sse}`] = n.id;
    });
    return o;
  }, [m]);
  // 표시용 — id(한국어)를 영문 라벨로. 티커·괄호가 쓴다.
  const enOf = useMemo(() => {
    const o: Record<string, string> = {};
    (m?.nodes || []).forEach(n => {
      if (n.label) {
        o[n.id] = n.label;
        const bare = n.id.includes(':') ? n.id.slice(n.id.indexOf(':') + 1) : '';
        if (bare) {
          const kind = n.id.slice(0, n.id.indexOf(':'));
          const kindEn: Record<string, string> = {
            '신경': 'nerve', '조작': 'act', '걸음': 'step', '기관': 'organ',
          };
          o[n.id] = `${kindEn[kind] || kind}:${n.label}`;
          o[bare] ??= n.label;
        }
        const ko = (n as { ko?: string }).ko;
        if (ko) o[ko] ??= n.label;
      }
    });
    return o;
  }, [m]);
  const byNameRef = useRef(byName);
  byNameRef.current = byName;
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  // 말을 걸면 그 턴에 울린 신경이 번쩍인다
  // 🔴 v26-B ① — 이 effect 는 의존성이 없다(구독 안정). 전 판은
  //    [m, byName] 의존이라 **델타·재조회가 setM 을 할 때마다 구독이
  //    헐리고 flush 큐가 버려졌다** — «무반응 → 파문 → 몰림»의 무반응은
  //    유휴가 아니라 이 버그가 제조한 침묵이었다. m·byName·pos 는 ref 로
  //    읽는다 (큐·타이머가 상태 갱신에 살아남는다 — 사건 유실 0).
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
        .map(x => byNameRef.current[x] || x);
      const organs = [...new Set(nerveIds.flatMap(nid =>
        (mRef.current?.edges || []).filter(e => e.kind === '공급' && e.b === nid)
          .map(e => e.a)))];
      if (!nerveIds.length && !organs.length) return;
      // 🔴 **접는다** — 신경과 기관 이름이 겹치면 「신경 2개」라 적고 1개만
      //    나열하던 어긋남이 여기서 났다.
      light([...new Set([...nerveIds, ...organs])]);
      setTurn({ trace, refs: (Array.isArray(d) ? 0 : d?.refs ?? 0),
                llm: Array.isArray(d) ? false : !!d?.llm,
                level: Array.isArray(d) ? null : (d?.level ?? null),
                // 🔴 목록도 그때 붙잡는다 — 살아 있는 lit 을 읽으면 5.2초 뒤
                //    빈 괄호가 되고, 다음 사건이 앞 턴 괄호에 섞였다 (A4)
                organs, nerves: nerveIds.length, list: nerveIds });
    };
    window.addEventListener('dobbin:fired', on as EventListener);
    // 🔴 **실시간** (v11 D1 · 한빈 «대화하거나 판단할 때 실시간으로»).
    //    답이 끝난 뒤가 아니라 **생각하는 도중** 켠다 — SSE 의 `thinking`
    //    걸음이 0.4초 안에 온다. 대화가 아닐 때(자율 걸음)도 같은 통로다.
    // 🔴 **묶음 갱신** (2026-09-13 · 한빈 «플랫폼 자체가 버벅거린다»).
    //    소화가 도는 동안 SSE 가 초당 ~1.7건 — 사건마다 setTrace/setLit 을
    //    치면 400노드 SVG 가 초당 1.7회 통째로 다시 그려져 **탭 전체가
    //    갈렸다** (서버 API 는 0.02~0.04초로 무죄 — 병목은 브라우저).
    //    사건은 버퍼에 모으고 0.7초에 한 번만 상태를 만진다 — halo 지연은
    //    최대 0.7초로 «실시간» 체감 그대로다.
    const buf: any[] = [];
    // v26 델타푸시 P-A — 고정 0.7s 묶음이 사슬을 «점멸»로 만들었다.
    // 2층 렌더(기반 동결) 덕에 덧층 갱신이 값싸져 150ms 적응형으로:
    // 한가하면 즉시(leading), 몰리면 150ms 에 한 번(trailing).
    let lastFlush = 0;
    let flushTimer: number | null = null;
    const doFlush = () => {
      lastFlush = Date.now();
      if (!buf.length) return;
      const evs = buf.splice(0);
      applyEvents(evs);
    };
    const off = onLive((ev: any) => {
      if (ev?.kind === 'reconnected') { backfill(); return; }
      if (!ev?.kind) return;
      // v29 — 재고 줄의 «분석대기(실물)» 를 같은 델타로 즉시 갱신 (한빈:
      // 투입구 2202 vs 분석대기 2205 — 다음 판 재조회까지 묵던 값)
      if (ev.kind === 'inbox-changed' && typeof ev.pending === 'number') {
        const n = ev.pending as number;
        setM(prev => (prev && prev.stock
          ? { ...prev, stock: { ...prev.stock, '분석대기(실물)': n } }
          : prev));
      }
      buf.push(ev);
      const since = Date.now() - lastFlush;
      if (since >= 150) doFlush();
      else if (flushTimer == null) {
        flushTimer = window.setTimeout(() => {
          flushTimer = null;
          doFlush();
        }, 150 - since);
      }
    });
    // v26 유기화 — 점등 공용 경로: 나이 도장·도약 펄스·개별 페이드
    const prune = () => {
      const now = Date.now();
      for (const [id, st] of Object.entries(stickyRef.current)) {
        if (now - st.since > st.ttl) delete stickyRef.current[id];
        else litAtRef.current[id] = now;          // 도는 중 — 계속 산다
      }
      setLit(prev => {
        const next = prev.filter(id => stickyRef.current[id]
          || now - (litAtRef.current[id] || 0) < 5000);
        return next.length === prev.length ? prev : next;
      });
      setPulses(prev => (prev.length
        ? prev.filter(pp => now - pp.at < 1200) : prev));
      // 유휴 정지 가드 — 살아 있는 것이 없으면 루프를 세운다 (light 가
      // 다시 깨운다). 없으면 2.5s 마다 영원히 재렌더한다 (렉 규율).
      const alive = Object.keys(stickyRef.current).length > 0
        || Object.values(litAtRef.current).some(t => now - t < 6000);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = alive ? window.setTimeout(prune, 2500) : null;
    };
    const light = (ids: string[]) => {
      if (!ids.length) return;
      const now = Date.now();
      const newPulses: typeof pulses = [];
      for (const id of ids) {
        litAtRef.current[id] = now;
        const prevF = lastFireRef.current;
        const a = prevF && posRef.current[prevF.id];
        const b = posRef.current[id];
        // 8초 안의 연쇄 발화 — 전기신호가 노드 사이를 «건너간다»
        if (prevF && a && b && prevF.id !== id && now - prevF.at < 8000) {
          newPulses.push({ k: `${prevF.id}>${id}@${now}`,
                           x1: a.x, y1: a.y, x2: b.x, y2: b.y, at: now });
        }
        lastFireRef.current = { id, at: now };
      }
      const qb = qBudget();                     // v29 — 기기 적응 표현 예산
      setLit(prev => [...new Set([...prev, ...ids])].slice(-qb.haloCap));
      if (qb.pulses && newPulses.length) {
        setPulses(prev => [...prev.slice(-8), ...newPulses]);
      }
      setPulse(p => p + 1);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(prune, 2500);
    };
    const applyEvents = (evs: any[]) => {
      // v26 P-C — 지도 노드 델타: 재구축 diff 가 오면 350KB 재조회 없이
      // 그 노드들만 패치한다 (색 반영이 심박 대기 없이 초 단위).
      const deltas = evs.filter(e => e.kind === 'brainmap-delta');
      // v26 — 상태가 바뀐 노드는 눈에 보이게 발화한다 (한빈: «brainmap
      // changed 도 애니메이션 발화가 필요»). diff 는 바뀐 것만 싣는다.
      const deltaIds: string[] = [];
      if (deltas.length) {
        for (const d of deltas) {
          (d.nodes || []).forEach((x: any) => { deltaIds.push(String(x.id)); });
        }
      }
      if (deltas.length) {
        setM(prev => {
          if (!prev) return prev;
          const st: Record<string, any> = {};
          let stock = prev.stock;
          for (const d of deltas) {
            (d.nodes || []).forEach((x: any) => { st[x.id] = x; });
            if (d.stock) stock = { ...stock, ...d.stock };
          }
          return { ...prev, stock,
                   nodes: prev.nodes.map(n => st[n.id]
                     ? { ...n, status: st[n.id].status,
                         why: st[n.id].why || n.why } : n) };
        });
      }
      // 자국부터 — 빛은 5.2초 뒤 꺼지지만 자국은 남는다
      setTrace(prev => mergeTrace(prev, evs.map(ev => ({
        ts: Math.round(ev.at || Date.now() / 1000),
        kind: String(ev.kind), raw: ev,
      }))));
      const ids: string[] = [];
      for (const ev of evs) {
        if (ev.kind === 'thinking') {
          const id = ev.nerve
            || /신경 «([^»]+)» 발화/.exec(String(ev.text || ''))?.[1];
          if (id) {
            const nid = byNameRef.current[id] || id;       // `판본` → `신경:판본`
            // v26 — LLM 생성 심박(4s)·단계 발화는 «도는 중» 이다: 심박이
            // 갱신하는 10s sticky — 생성 10~90s 내내 halo 가 산다
            if (ev.nerve) {
              stickyRef.current[nid] = { since: Date.now(), ttl: 10000 };
            }
            ids.push(nid);
          }
        } else if (ev.kind === 'tending' && ev.step) {
          // 🔴 이 분기가 `sse` 분기보다 앞이어야 한다 (2026-09-11 전수 대조)
          //    — 뒤에 두면 MOTOR 의 sse="tending" 이 먹어 걸음 점등이 죽는다.
          const wid = byNameRef.current[ev.step] || `걸음:${ev.step}`;
          // v26-B — 걸음 심박(beat 8s): 돌고 있는 동안 sticky 가 산다.
          // start 도 20s — beat 가 곧 이어 오므로 120s 는 과했다.
          if (ev.phase === 'start' || ev.phase === 'beat') {
            stickyRef.current[wid] = { since: Date.now(), ttl: 20000 };
          }
          else delete stickyRef.current[wid];       // 끝 — 자연 페이드로
          ids.push(wid);
        } else if (byNameRef.current[`sse:${ev.kind}`]) {
          // notology 조작·사람 손(`act:*`) — 서버가 노드에 실어 보낸 `sse` 로만
          ids.push(byNameRef.current[`sse:${ev.kind}`]);
        }
      }
      // v26-B ① — 부기(지도 장부 갱신) 파문은 걷었다: 인지 사건이 아니다
      // (한빈: «파동의 의미가 뭔가»). 파문은 뜻이 있는 하나만 — 자가공학
      // (dobbin 이 방금 제 신경을 고쳤다 · 보라).
      for (const ev of evs) {
        if (ev.kind === 'self-engineering') {
          setCoreFlash(f => f + 1);
          (ev.nodes || []).forEach((nid: string) =>
            ids.push(byNameRef.current[nid] || nid));
        }
      }
      light([...ids, ...deltaIds.slice(0, 14)]);
    };
    return () => {
      window.removeEventListener('dobbin:fired', on as EventListener);
      if (flushTimer != null) window.clearTimeout(flushTimer);
      try { off?.(); } catch { /* 구독 해제가 막혀도 화면은 산다 */ }
    };
  }, []);

  // 🔴 **접는다** (2026-09-10). 제품 모듈 220개를 다 올리니 노드가 439다 —
  //    다 그리면 못 읽고, 안 그리면 거짓말이다(45/158 만 그리던 자리).
  //    영역마다 **큰 것 K개**만 펴고 나머지는 「+N」 한 점으로 접는다.
  //    잣대는 지어낸 중요도가 아니라 **줄 수 + 부르는 자 수**다.
  // 🔴 **이음도 접는다** (2026-09-10). 모듈을 다 올리자 이음이 933이 되었고
  //    화면이 실뭉치가 됐다. `부름`(464)은 «코드에 있다»일 뿐 그 턴에 무슨
  //    일이 있었나를 말하지 않는다 — 기본으로 접고, 켜면 보인다.
  //    ⚠️ 접는 것과 **없애는 것**은 다르다. 수는 범례에 그대로 적힌다.
  const [coreFlash, setCoreFlash] = useState(0);
  const [showCall, setShowCall] = useState(false);
  // 🔴 접힘 기계를 걷었다 (2026-09-11 3차 검토 — K=9999 라 도달 불가인데
  //    lit/pickId 의존성이 남아 **사건마다 446노드 전면 재배치**를 시켰다).
  //    이제 노드 = 서버가 준 전부, 재배치는 지도 자체가 바뀔 때만.
  // 🔴 **뇌 지도에는 뇌만** (한빈 2026-09-17: *"Service layer, gates scorer 등
  //    영역도 뇌 신경으로써 활성화되는게 맞나?"*).
  //
  //    실측: 「뇌가 아니다」고 **코드가 명시한** 영역이 넷이고 그 넷이 지도의
  //    **19%(120개)** 였다 — `harness` 92(관문·잣대) · `service` 19(HTTP·배선,
  //    `state`·`env`·`tools`·`page`) · `todo` 8(개발 큐 · 분홍) ·
  //    `substrate` 1(llm).
  //
  //    🔴 그리고 셈이 어긋나 **30개가 유령**이었다 — 「뇌가 아니다」를
  //    `layer=None`(영역) · `kind∈EQUIPMENT`(노드) · 장비 띠(그림) **세 가지로**
  //    말하다 보니 `state`·`brainmap`·`nerves` 같은 기관이 뇌에도 장비에도
  //    안 세어졌다 (626 = 뇌 456 + 조작 8 + 감각 9 + 갈래 33 + 장비 90 + **30**).
  //
  //    → 지도 안 = 뇌, 지도 밖 = 뇌 아님. 한 가지로 줄인다.
  //    ⚠️ `substrate`(llm)는 남긴다 — 코드가 *"두뇌 중앙이 맞다"* 고 적어 두었고
  //       `core:true` 라 장비 띠가 아니라 정중앙에 선다. `layer=None` 은
  //       「성숙도 셈에서 뺀다」는 뜻이었지 「뇌가 아니다」가 아니었다.
  //    🔴 **내린 것은 사라지지 않는다** — 계기판이 수로 말한다 (음성 대조가 문다).
  const shownNodes = useMemo(() => {
    const R = m?.regions ?? {};
    return ((m?.nodes ?? []) as Node[])
      // 🔴 계획(todo) 노드는 v50 이 위성 띠를 걷으며 **지도에서 통째로
      //    사라졌다** (region 'todo' 는 층이 없어 아래 필터에 걸린다) —
      //    plan_dots 자가 그날부터 상시 붉었다. 서버가 이미 주는 `aim`
      //    (겨눈 영역)으로 옮겨 그린다: 빚은 그 신경이 사는 영역의 일이다.
      .map(n => (n.kind === '계획' && R[n.region]?.layer == null
                 && n.aim && R[n.aim]?.layer != null)
        ? { ...n, region: n.aim } : n)
      .filter(n => {
        const reg = R[n.region];
        if (!reg) return true;                     // 모르는 영역은 안 숨긴다
        if (reg.core) return true;                 // 기질(llm) — 두뇌 중앙
        return reg.layer != null;                  // 층이 있는 것 = 뇌
      });
  }, [m]);
  const shownIds = useMemo(() => new Set(shownNodes.map(n => n.id)), [shownNodes]);
  const rings = useMemo(() => {
    const cnt: Record<string, number> = {};
    shownNodes.forEach(n => {
      const ly = n.layer ?? m?.regions[n.region]?.layer;
      if (ly) cnt[ly] = (cnt[ly] ?? 0) + 1;
    });
    return ringGeo(cnt);
  }, [m, shownNodes]);
  const lb = useMemo(() => (m ? lobes(shownNodes, m.regions, rings) : {}),
                     [m, shownNodes, rings]);
  const pos = useMemo(() => (m ? place(shownNodes, lb) : {}), [shownNodes, lb]);
  posRef.current = pos;

  // ── W4 Semantic zoom (Maps idiom · HanBin 2026-09-18) ────────────────
  // One viewTransform in viewBox space: p_screen = z·p + t. LOD ladder
  // (Z0 cortex → Z1 sub bands → Z2 nerve dots+names → Z3 blueprints) culls
  // everything below the current level — zooming OUT reduces render work.
  // 🔴 The base layer re-renders only when the Z *bucket* changes, never
  //    per wheel tick (the group transform is GPU-cheap).
  // W4 — the panel opens in 3D (HanBin decision); 2D map is one toggle away.
  // No preference memory. The SSE subscription lives above both views, so
  // toggling never re-subscribes and activation never pauses.
  const [mode3d, setMode3d] = useState(true);
  // W4-T (HanBin 09-18) — the toggle is a MORPH, not a swap: 3D→2D the GL
  // dots glide onto the board while the SVG bands fade in beneath; 2D→3D
  // the bands fade out while dots fly into the brain. During a transition
  // BOTH layers render; the finished side unmounts on onMorphDone.
  const [trans, setTrans] = useState<null | 'to2d' | 'to3d'>(null);
  const go3d = (want: boolean) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode3d(want); setTrans(null); return;           // instant, no theatre
    }
    setTrans(want ? 'to3d' : 'to2d');
    if (want) setMode3d(true);        // mount GL now; SVG lingers till done
  };
  // W4-R (HanBin 8th: «여백이 너무 크다») — the fit view starts slightly
  // zoomed so the board fills the frame; Z-bucket thresholds shift with it.
  const FIT = { z: 1.18, tx: (W - 1.18 * W) / 2, ty: (H - 1.18 * H) / 2 };
  const [view, setView] = useState(FIT);
  const viewRef = useRef(view); viewRef.current = view;
  // test handle — jigs that predate the LOD ladder measure the full dot map
  // at fit zoom via ?bmlod=2 (geometry untouched). Never set by the app.
  const zbFloor = useMemo(() => {
    const v = Number(new URLSearchParams(window.location.search).get('bmlod'));
    return Number.isFinite(v) ? Math.max(0, Math.min(3, v)) : 0;
  }, []);
  const zb = Math.max(zbFloor,
    view.z <= 1.25 ? 0 : view.z <= 2.6 ? 1 : view.z <= 5 ? 2 : 3);
  /** visible window in content (viewBox) coords — for viewport culling */
  const vp = { x: -view.tx / view.z, y: -view.ty / view.z,
               w: W / view.z, h: H / view.z };
  const inVp = (x: number, y: number, pad = 30) =>
    x >= vp.x - pad && x <= vp.x + vp.w + pad
    && y >= vp.y - pad && y <= vp.y + vp.h + pad;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  /** CSS pixel → viewBox point (undo the xMidYMid-meet letterbox) */
  const toVb = (cx: number, cy: number) => {
    const el = svgRef.current; if (!el) return { x: CX, y: CY };
    const r = el.getBoundingClientRect();
    const sc = Math.min(r.width / W, r.height / H) || 1;
    return { x: (cx - r.left - (r.width - W * sc) / 2) / sc,
             y: (cy - r.top - (r.height - H * sc) / 2) / sc };
  };
  const clampView = (z: number, tx: number, ty: number) => {
    z = Math.min(12, Math.max(1, z));
    // content occupies [t, t+z·W]; keep it covering the viewBox
    tx = Math.min(0, Math.max(W - z * W, tx));
    ty = Math.min(0, Math.max(H - z * H, ty));
    return { z, tx, ty };
  };
  /** zoom about a viewBox point c: t' = c·(1 − z'/z) + t·(z'/z) */
  const zoomAt = (c: { x: number; y: number }, factor: number) => {
    setView(v => {
      const nz = Math.min(12, Math.max(1, v.z * factor));
      const k = nz / v.z;
      return clampView(nz, c.x * (1 - k) + v.tx * k, c.y * (1 - k) + v.ty * k);
    });
  };
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    // wheel must be non-passive to preventDefault (page would scroll)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(toVb(e.clientX, e.clientY), Math.exp(-e.deltaY * 0.0015));
    };
    const ptr = new Map<number, { x: number; y: number }>();
    let dragged = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // 🔴 setPointerCapture 를 쓰면 wrap 이 클릭을 통째로 삼켜 **버튼·노드
      //    클릭이 전부 죽는다** (jig 실측: + 버튼 무반응). 캡처 없이 창
      //    리스너로 따라가고, 이동 문턱을 넘어야 팬으로 취급한다.
      if ((e.target as Element | null)?.closest?.('.bm-zoomctl')) return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dragged = false;
    };
    const onMove = (e: PointerEvent) => {
      const prev = ptr.get(e.pointerId); if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (ptr.size === 2) {                          // pinch
        const [a, b] = [...ptr.values()];
        const other = a === prev ? b : a;
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y) || 1;
        zoomAt(toVb((cur.x + other.x) / 2, (cur.y + other.y) / 2), d1 / d0);
      } else if (viewRef.current.z > 1.001) {        // pan (FIT is already >1)
        const r = svgRef.current?.getBoundingClientRect();
        const sc = r ? Math.min(r.width / W, r.height / H) || 1 : 1;
        const dx = (cur.x - prev.x) / sc, dy = (cur.y - prev.y) / sc;
        if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 2) dragged = true;
        setView(v => clampView(v.z, v.tx + dx, v.ty + dy));
      }
      ptr.set(e.pointerId, cur);
    };
    const onUp = (e: PointerEvent) => { ptr.delete(e.pointerId); };
    // swallow the click that ends a drag — else it toggles a node pick
    const onClick = (e: MouseEvent) => {
      if (dragged) { e.stopPropagation(); dragged = false; }
    };
    const onDbl = (e: MouseEvent) => {
      e.preventDefault();
      zoomAt(toVb(e.clientX, e.clientY), 1.8);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    // move/up 은 창에서 듣는다 — 밖으로 끌고 나가도 팬이 이어진다
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('dblclick', onDbl);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dblclick', onDbl);
    };
    // 🔴 wrap 은 m 이 온 뒤 **그리고 2D 모드일 때만** 마운트된다 — 의존이
    //    모자라면 이 effect 가 wrap 없는 렌더에 돌고 끝나 wheel/drag/pinch 가
    //    전부 죽는다 (jig ④ 두 번 실측: [] → m → mode3d 까지 세 겹).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!m?.nodes?.length, mode3d]);
  // 🔴 **기반층을 얼린다** (2026-09-13 · 한빈 «웹 렌더링 렉»). 노드 ~400 +
  //    이음 ~1,200 을 hover·빛·자국(0.7초)마다 React 가 전부 다시 diff 하던
  //    것이 지도 버벅임의 몸통 — 기반층은 판(m)이 바뀔 때만 다시 짓고,
  //    빛·hover·선택은 아래 얇은 덧층이 그린다. useMemo 가 같은 엘리먼트
  //    참조를 돌려주면 React 는 그 서브트리 diff 를 통째로 건너뛴다.
  // ── v29 — 기반 이음 Canvas 페인터. viewBox(980×700)와 같은 좌표계를
  //    CSS 크기 배율로 재현한다 (.brainmap__svg 는 width:100%·height:auto 라
  //    항상 같은 종횡비 — 배율은 cssW/W 하나뿐이다). 절전 단은 dpr 1.
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = edgeCanvasRef.current;
    if (!cv || !m?.nodes?.length || !m.edges) return;
    let raf = 0;
    const draw = () => {
      const cssW = cv.clientWidth, cssH = cv.clientHeight;
      if (!cssW || !cssH) return;
      const vw = viewRef.current;
      const zbNow = vw.z <= 1.001 ? 0 : vw.z <= 2.5 ? 1 : vw.z <= 5 ? 2 : 3;
      const qb = qBudget();
      const dpr = qb.haloCap <= 4 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      // 🔴 **가운데맞춤이 빠져 있었다** (v51 · 2026-09-17). 위 주석이
      //    *"`height:auto` 라 배율은 `cssW/W` 하나뿐"* 이라 적었는데
      //    **v50 이 `height:100%` 로 바꿔 그 전제를 깼다.** SVG 는
      //    `xMidYMid meet` 로 **가운데 맞춰 letterbox** 하는데 캔버스는
      //    안 맞춰서, 이음이 노드보다 **47~100px 위**에 그려졌다 (실측).
      //    배율은 맞았고 **옮김만 없었다.**
      const s = Math.min(cssW / W, cssH / H);        // meet — 작은 쪽이 이긴다
      const ox = (cssW - W * s) / 2, oy = (cssH - H * s) / 2;
      ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
      ctx.clearRect(-ox / s, -oy / s, cssW / s, cssH / s);
      // W4-R — the base edge web renders at EVERY zoom (viewport-culled);
      // the ladder adds semantics, it never removes the map.
      void zbNow;
      ctx.transform(vw.z, 0, 0, vw.z, vw.tx, vw.ty);   // view on top of letterbox
      ctx.globalAlpha = 0.5;                 // .bm-edge 전역 (brain.css:300)
      ctx.lineCap = 'round';
      const byId: Record<string, Node> = {};
      m.nodes.forEach(n => { byId[n.id] = n; });
      // brain.css 의 이음 색·점선 그대로 (폭은 전역 .7 이 덮는다)
      const STYLE: Record<string, { c: string; d?: number[] }> = {
        chain: { c: 'rgba(190,210,255,.10)' },
        feed:  { c: 'rgba(160,255,220,.20)', d: [2, 3] },
        call:  { c: 'rgba(150,190,255,.22)' },
        gate:  { c: 'rgba(214,150,255,.24)', d: [1, 4] },
        act:   { c: 'rgba(120,230,160,.26)' },
        debt:  { c: 'rgba(255,138,196,.30)', d: [3, 3] },
        bad:   { c: 'rgba(240,87,74,.55)' },
        tree:  { c: 'rgba(255,214,140,.30)' },
      };
      ctx.lineWidth = 0.7 / vw.z;                     // hairline stays hairline
      // viewport in content coords — cull off-screen edges (Z3 especially)
      const vx = -vw.tx / vw.z, vy = -vw.ty / vw.z, vwd = W / vw.z, vhd = H / vw.z;
      const vis = (q: { x: number; y: number }) =>
        q.x >= vx - 40 && q.x <= vx + vwd + 40 && q.y >= vy - 40 && q.y <= vy + vhd + 40;
      for (const e of m.edges) {
        if (!showCall && (e.kind === '부름' || e.kind === '사슬')) continue;
        if (!shownIds.has(e.a) || !shownIds.has(e.b)) continue;
        const a = pos[e.a], b = pos[e.b];
        if (!a || !b) continue;
        if (!vis(a) && !vis(b)) continue;
        const na = byId[e.a], nb = byId[e.b];
        const cross = na && nb && (na.layer ?? m.regions[na.region]?.layer)
          !== (nb.layer ?? m.regions[nb.region]?.layer);
        const st = cross ? { c: 'rgba(155,124,255,.35)' }
          : (STYLE[EDGE_CLS[e.kind] || 'chain'] || STYLE.chain);
        ctx.strokeStyle = st.c;
        // v34 — 서버가 가른 grade 를 읽는다: "static"(코드에 있다 — 정적
        //   분석)은 점선, 실측된 이음은 실선. 안 읽으면 둘이 같은 선으로
        //   보여 «심어둔 것»과 «실제로 부른 것»이 화면에서 안 갈린다.
        ctx.setLineDash(e.grade === 'static' ? [2, 3] : (st.d ?? []));
        const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx2, my2 - (cross ? 26 : 12), b.x, b.y);
        ctx.stroke();
      }
    };
    const kick = () => {                    // pan/zoom storms fold into one frame
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };
    kick();
    const ro = new ResizeObserver(kick);
    ro.observe(cv);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [m, pos, shownIds, showCall, view]);

  const baseLayer = useMemo(() => {
    // 🔴 m 만 보면 안 된다 — e2e 심에서 빈 껍데기({})가 와 m.nodes.forEach
    //    가 터졌고 앱 전체가 죽었다 (ui_e2e pageerror 실측)
    if (!m?.nodes?.length || !m.edges) return null;
    // 🔴 W4-R (HanBin: «2D 모드에서 노드가 보이지 않는다») — dots render at
    //    EVERY zoom. The ladder ADDS semantics (Z1 sub bands · Z2 names ·
    //    Z3 blueprints); it never decides existence.
    // 🔴 이름표 자리 장부를 **여기서** 비운다 — 안 비우면 두 번째 렌더부터
    //    제 이름표와 겹쳐 전부 사라진다 (v50).
    resetTags();
    const byId: Record<string, Node> = {};
    m.nodes.forEach(n => { byId[n.id] = n; });
    // v29 — 기반 이음 ~1,300 개는 SVG DOM 이 아니라 아래 Canvas 가 그린다
    //    (판이 바뀔 때 1회 페인트 · GPU 합성). DOM 에서 이음이 빠지면
    //    halo·펄스 애니메이션 중의 SVG 재페인트 비용이 노드 몫만 남는다.
    return (
      <g>
        {shownNodes.map(n => {
          const p = pos[n.id]; if (!p) return null;
          const s = STATUS[n.status] || STATUS.dark;
          // 🔴 **계획 노드가 화면에 한 점도 안 찍혔다** (v45 · 2026-09-16).
          //    한빈: *"todo 는 여전히 노드가 생성이 안됬는데?"* — 서버는 8개를
          //    정확히 주고 DOM 에도 8개가 있었다. 안 보인 까닭은 **그림**이다:
          //
          //        r=1.8 · fill=none · stroke 1px · dasharray "2 2"
          //        → 둘레 11.3px 에 2px 조각 셋. 안티에일리어싱에 녹는다.
          //
          //    잘라내어 픽셀로 세니 **분홍(#ff8ac4) 0개**였다. 「그렸다」와
          //    「보인다」는 다른 말이다 ([[renderer-fixed-is-not-file-fixed]]
          //    의 짝 — 여기서는 DOM 은 맞는데 그림이 안 났다).
          //
          //    ⚠️ 유령 꼴(속 빈 점선)은 **뜻이 있다** — 계획은 아직 지은 것이
          //    아니다. 그 뜻은 지키되 **보이게** 한다: 반지름을 키우고,
          //    옅은 속을 넣고, 테두리를 실선으로 굵힌다.
          // 🔴 **모양이 사실과 어긋나 있었다** (한빈 2026-09-17:
          //    *"해당 영역의 노드들은 신경이 아닌가? 왜 다른 노드들과 너무
          //    디자인이 다른가?"*). 유령 꼴의 뜻은 «아직 지은 것이 아니다»
          //    인데, 실측하니 계획 노드 **8개 전부가 `target='빚'`** —
          //    이미 있는 신경(정산교정·판본·관계…)의 **오배선 수리 과제**다.
          //    「신설」은 0개였다. 서버가 `target` 을 갈라 보내는데
          //    (`brainmap.py:2456`) 화면이 그 칸을 **모양에 0번 썼다.**
          //    → 빚이면 다른 노드와 같은 꽉 찬 점. 유령은 신설에만.
          const ghost = n.kind === '계획' && n.target !== '빚';
          const base = n.kind === '접힘' ? 5.5
                     : n.kind === '계획' ? 3.4
                     : n.kind === '갈래' ? 2.4
                     : n.kind === '걸음' ? 1.3
                     : 1.6;
          return (
            <g key={n.id} className={`bm-node bm-node--${n.kind}`}
               onClick={() => setPickId(prev => (prev === n.id ? null : n.id))}
               onMouseEnter={() => setHover(n.id)}
               onMouseLeave={() => setHover(h => (h === n.id ? null : h))}>
              <circle cx={p.x} cy={p.y} r={9} fill="transparent" />
              {/* 🔴 **뻗침** — 밖(관문·잣대·서비스·계획)에 임자가 있다는 표시.
                  v50 이 그것들을 지도에서 내리며 **이음 223개가 한쪽 끝을 잃고
                  버려졌다** — 그중 검증 116 은 「이 신경이 어느 관문에
                  지켜지는가」다. 선을 다 그리면 스파게티가 되고 안 그리면
                  연계가 통째로 안 보인다. 중심 반대쪽으로 **짧게** 뻗어
                  길이가 임자 수를 말한다 (v51 P2).
                  ⚠️ 이 블록은 한 번 **뒤에서 돌던 심술이 나무를 되돌려** 조용히
                     사라졌다 — 관문이 도는 중엔 나무를 안 건드린다. */}
              {n.밖 ? (() => {
                const dx = p.x - CX, dy = p.y - CY;
                const L2 = Math.hypot(dx, dy) || 1;
                const len = Math.min(2 + n.밖.n * 0.7, 6);   // 🔴 11 → 6 (수염)
                const guard = !!n.밖.kinds['검증'];
                return <line className={`bm-stub${guard ? ' bm-stub--guard' : ''}`}
                             x1={p.x + (dx / L2) * (base + 1.2)}
                             y1={p.y + (dy / L2) * (base + 1.2)}
                             x2={p.x + (dx / L2) * (base + 1.2 + len)}
                             y2={p.y + (dy / L2) * (base + 1.2 + len)} />;
              })() : null}
              <circle cx={p.x} cy={p.y} r={base}
                      className={n.status === 'building' ? 'bm-build' : undefined}
                      fill={s.c}
                      stroke={ghost ? s.c : 'none'}
                      strokeWidth={ghost ? 1.4 : 0}
                      fillOpacity={ghost ? 0.28 : 1}
                      opacity={n.status === 'dark' || n.status === 'idle'
                               ? 0.3 : 0.8}>
                <title>{`${n.label || n.id} · ${s.t}`}</title>
              </circle>
              {/* 🔴 **이름표 겹침 방지가 없었다** (v50 · 2026-09-17).
                  자리가 노드 좌표의 순수 함수라 다른 이름표를 한 번도 안 봤다
                  — 실측: 「Quote Check」가 「Existence Check」 위에 **가로로
                  100% 포개져** 둘 다 못 읽었다 (중심 x 차이 2.0px · baseline
                  13.4px · 헤일로 포함 글자 높이 12.9px).
                  → 놓인 상자와 견주어 ① 위/아래로 밀고 ② 그래도 겹치면
                  **안 그린다.** 포개진 글자는 없느니만 못하다.
                  ⚠️ `kind === '접힘'` 은 죽은 조건 — 서버가 한 번도 안 내보낸다. */}
              {n.kind === '갈래' && (() => {
                const ty = tagAt(p.x, p.y - (base + 5), n.label || n.id);
                return ty == null ? null : (
                  <text className="bm-tag" x={p.x} y={ty} textAnchor="middle">
                    {n.label || n.id}
                  </text>);
              })()}
            </g>
          );
        })}
      </g>
    );
  }, [m, pos, shownNodes, shownIds, showCall, zb]);
  // (W4-R) Z1 cluster dots were dropped — with dots visible at every zoom
  //  they duplicated the same information one layer up.
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
      {/* 🔴 **늘 보이는 것과 접는 것이 뒤바뀌어 있었다** (한빈 2026-09-17:
          *"계기판 디자인 및 UI도 개선 필요"*). 어제 접어 버린 `stock`·`bench`
          안에 **사람이 쓸 숫자**가 있었다 — 검색 82.9% · 열린 할 일 · 질문
          대기. 늘 보이던 줄은 개발자 내부 셈(이음 1,425 · 장비 90 · 문 64/84)
          이었다. 자리를 맞바꾼다 — **지우는 것이 아니라 옮기는 것**이다. */}
      <h3><span className="brainmap__ttl">뇌 지도</span>
        <span className="brainmap__sum">
          {m.bench && m.bench['recall@5'] != null ? (
            <b className="bm-ok" title={`꺼내기 성적 — 질문 ${m.bench.n ?? '?'}개 (${m.bench.at})`}>
              검색 {Math.round(m.bench['recall@5'] * 100)}%</b>
          ) : null}
          {/* 🔴 「열린 할 일」·「질문 대기」를 걷었다 — **맨 위 카드와 겹친다**
              (거기 「확인 부탁 1,766건 [확인하기]」로 이미 있다). 같은 수를
              두 곳에 적으면 사람이 두 번 읽고 한 번도 안 믿는다 (v50). */}
          {/* 🔴 뇌 아닌 것을 지도에서 내렸으므로 **여기가 그 수를 말한다** */}
          {m.counts?.장비 ? <> · <span className="bm-dim"
            title="관문·잣대·서비스 층 — 뇌가 아니라 지도 밖이다">
            장비 {m.counts.장비}</span></> : null}
          {/* 🔴 여기 `tally.red`(붉은 노드 **전부**)를 「오배선」이라 불렀다.
              실측 9 중 진짜 오배선은 2이고 나머지 7은 붉은 관문 6 + 기관 1 —
              **회귀 관문의 실패가 뇌의 오배선으로 둔갑**했다. 서버가 진짜 값
              (`matrix.오배선`)을 보내는데 안 읽고 있었다. */}
          {mx.오배선 ? <> · <em className="bm-bad">오배선 {mx.오배선}</em></> : null}
          {ta.red ? <> · <span className="bm-dim">붉은 칸 {ta.red}</span></> : null}
          {/* 🔴 「0이어도 숨기지 않는다」를 지키되 120px 짜리 칸이 아니라
              **글자 한 칸**으로 (지도 밖 칸은 수>0 일 때만 선다). */}
          {/* 🔴 「지도 밖 0」은 접이로 내렸다 — 계기판은 **나쁜 것 + 성적**만
              (한빈 선택). 0 은 나쁜 것도 성적도 아니다. 사실은 접이에 남는다. */}
          {mx.명중 == null
            ? <em className="bm-dim"
                  title="nerve_run 표를 못 읽어 반사·신경 덮음·문 셈이 없다 — 조용히 숨기지 않는다 (A14)">
                {' '}· 반사 기록 못 읽음</em>
            : null}
          {mx.명중 != null
            ? <span title={`신경 ${mx.측정}개 · ${mx.잰때 || '언제인지 모름'}`
                           + ` · 출처 ${mx.출처}`}>
                {/* 🔴 **「A/B」 는 성적으로 읽힌다** — 실측에서 「반사 0/3」
                    이 0점처럼 보였는데 그것은 디버그 주행의 크기였다.
                    서버가 v49 에서 완주 판만 쓰게 고쳤고, 화면도 **성적은
                    %로** 적는다 (크기·덮음은 「N개 중 M개」로 따로). */}
                {' · '}반사 {Math.round(((mx.명중 ?? 0) / Math.max(1, mx.자극 ?? 0)) * 100)}%
                <i className="bm-cov" title={`완주 판 ${mx.자극}자극 중 ${mx.명중} 명중`}>
                  ({mx.자극}자극)</i>
                {/* 🔴 「43/45」는 96%로 읽히지만 그 45는 *신경 수*가 아니라
                    **벤치가 볼 수 있는 자극 수**다. 실제 덮음은 38/56 (68%) —
                    18개는 한 번도 안 쟀다. 두 수를 나란히 적는다. */}
                {/* 🔴 「신경 N/N」(덮음)은 성적이 아니라 **크기**다 — 접이로 */}
                {false && mx.신경전체
                  ? <i className="bm-cov" title="반사 벤치가 한 번이라도 잰 신경 / 등록부의 신경 전체">
                      {' '}· 신경 {mx.측정}/{mx.신경전체}
                    </i>
                  : null}
                {/* 🔴 **덮지 않은 것을 덮은 척하지 않는다** (2026-09-10).
                    `_answer_core` 에 값을 돌려주는 문이 62개인데 표시가
                    붙은 것은 13개다 — 나머지 49개로 나간 답은 뇌 지도에
                    **한 칸도 안 켜진다.** 사람이 보기엔 dobbin 이 아무
                    생각 없이 답한 것처럼 보인다. 그 수를 적는다. */}
                {/* 「문 N/N」·「손·장비」·「뇌·이음」은 개발자 셈이라 아래
                    접이로 내렸다 — **지운 것이 아니다** (`bm-inner`). */}
                {mx.잰때 ? <i className="bm-at">({mx.잰때.slice(5)})</i> : null}
              </span>
            : null}
          {/* 🔴 **장비를 2배 적게 그리고 있었다** — 노드로는 76개인데
              `src/eval` 은 168파일·81,444줄이다 (2026-09-10). */}

          {/* 🔴 **갱신 시각을 적는다.** 「반사 49/51」이 17시간 낡았는데 화면에
              아무 표시가 없었다 — 낡은 수를 지금 수처럼 보이게 하면 안 된다. */}
          {at ? <i className="bm-at" title="지도를 지은 때 (서버 built_at) — 캐시가 낡으면 이 시각도 낡게 보인다">· 지음 {at}</i> : null}
          {err ? <em className="bm-bad" title="마지막 요청이 실패했다 — 보이는 지도는 그 이전 것이다">
            · 🔴 못 읽음 ({err})</em> : null}
          {m.registry_error ? <em className="bm-bad"
            title={m.registry_error}> · 🔴 신경 등록부를 못 읽었다</em> : null}
        </span>
      </h3>

      {/* 🔴 **접는 것과 지우는 것은 다르다** (한빈 2026-09-17: *"상단 및
          하단의 모니터링 상태 설명 창을 더 심플하게"*). 계기판을 지우면
          다음 회차에 못 잰다 — 그래서 **눌러서 펴는 자리**로 내렸다.
          늘 보이는 것은 제목줄 요약 한 줄뿐이다. */}
      <details className="brainmap__more">
        <summary>계기 — 얼마나 재고 있나</summary>
      {/* 🔴 **요약줄에서 내린 것을 여기 온전히 되살린다** — 접은 것이지
          지운 것이 아니다 ([[dashboard-is-itself-untested-instrument]]). */}
      <div className="brainmap__stock bm-inner">
        <span className="bm-stock">뇌 <b>{m.counts?.뇌 ?? m.nodes.length}</b></span>
        <span className="bm-stock">이음 <b>{m.edges.length}</b></span>
        {mx.문 ? (
          <span className="bm-stock"
                title="답이 나가는 자리 중 「신경 «X» 발화」 표시가 붙은 것">
            문 <b>{mx.문표시}/{mx.문}</b>
            {(mx.문 ?? 0) - (mx.문표시 ?? 0) > 0
              ? ` (${(mx.문 ?? 0) - (mx.문표시 ?? 0)}개 계측 밖)` : ''}
          </span>) : null}
        {mx.잴수있음 ? (
          <span className="bm-cell" title={
              `반사 벤치는 «답을 내는» 신경만 잰다 — `
              + `변조·감각·잔여 ${mx.못잼변조}개는 **설계상** 대상이 아니다(답을 내는 자가 아니다). `
              + `잴 수 있는 ${mx.잴수있음}개 중 ${mx.자극없음}개는 **자극(시험 입력)이 없어** 아직 못 잰다.`}>
            {/* 🔴 여기가 「신경 덮음 161개 중 55개」라 말했다 — **분모가 거짓**
                이었다 (v51 P4). 못 재는 변조 40 을 분모에 넣어 34%로 보였고,
                실제로 잴 수 있는 것 기준으로는 55/121 = 45% 다. */}
            신경 덮음 <b>{mx.잴수있음}개 중 {mx.측정}개</b>
            {mx.자극없음 ? <i className="bm-cov"> · 자극없음 {mx.자극없음}</i> : null}
            {mx.못잼변조 ? <i className="bm-cov"> · 답아닌 {mx.못잼변조}은 대상 아님</i> : null}
          </span>) : null}
        <span className="bm-stock">손 <b>{m.counts?.조작 ?? 0}</b></span>
        <span className="bm-stock"
              title={m.counts?.장비파일
                ? `재는 자 실물: src/eval ${m.counts.장비파일}파일 · `
                  + `${(m.counts.장비줄 ?? 0).toLocaleString()}줄 · 탐침 ${m.counts.탐침}개`
                : undefined}>
          장비 <b>{m.counts?.장비 ?? 0}</b>
          {m.counts?.장비파일
            ? ` (${m.counts.장비파일}파일 · ${Math.round((m.counts.장비줄 ?? 0) / 1000)}k줄)`
            : ''}</span>
      </div>
      {/* 🔴 재고 축 — 쓰기 자국·성적만 그리고 **지금 쌓여 있는 것**이 수로
          0번 나오던 공백 (3차 검토). None 은 「못 읽음」로 — 0 과 다르다. */}
      {m.stock && (
        <div className="brainmap__stock"
             title="서재에 지금 쌓여 있는 것 — 재고 축">
          {Object.entries(m.stock).map(([k, v]) => (
            <span key={k} className="bm-stock">
              {k} <b>{v == null ? '못 읽음' : v.toLocaleString()}</b>
            </span>
          ))}
        </div>
      )}
      {/* 🔴 판단 계기 (v18) — 지도는 관측이지 성적이 아니다. 실측 장부
          (retrieval_bench.json)만 읽고 측정일을 함께 보인다 — 낡으면
          날짜가 낡았다고 말한다. 장부가 없으면 «아직 못 잼». */}
      {m.bench !== undefined && (
        <div className="brainmap__stock"
             title="판단 계기 — 검색 벤치가 제 손으로 쓴 장부 (측정일 포함)">
          {m.bench == null ? (
            <span className="bm-stock">판단 계기 <b>장부 없음</b></span>
          ) : (
            <>
              <span className="bm-stock" title={`질문 ${m.bench.n ?? '?'}개`}>
                검색@5 <b>{m.bench['recall@5'] != null
                  ? Math.round(m.bench['recall@5'] * 100) + '%' : '?'}</b>
                <i style={{ opacity: .6 }}> ({m.bench.at ?? '?'})</i>
              </span>
              {m.bench.chat_n ? (
                <span className="bm-stock"
                      title={`회의문장 ${m.bench.chat_n}문을 대화 문(tools.retrieve)으로 — 동점가름 끔→켬`}>
                  대화문·회의문장@5 <b>
                    {Math.round((m.bench['chat_off@5'] ?? 0) * 100)}%→
                    {Math.round((m.bench['chat@5'] ?? 0) * 100)}%</b>
                  <i style={{ opacity: .6 }}> ({m.bench.chat_at ?? '?'})</i>
                </span>
              ) : null}
            </>
          )}
        </div>
      )}
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
      </details>
      {/* 🔴 **칩을 지도 밖으로 내렸다** (한빈 2026-09-17: *"실시간 창을
          가리고 있으며"*). 어제는 글자만 고치고 **자리를 안 고쳤다** —
          실측: 칩(65×28)이 지도 안에 앉아 `bm-equip-lab` 글자를 덮고 있었다.
          ⚠️ 위 v32 주석(「칩은 wrap 자식이어야 한다」)은 **절대배치 전제**의
             제약이었다. 정적 흐름으로 내리면 그 제약 자체가 사라진다 —
             주석을 안 고치면 다음 사람이 다시 안으로 넣는다.
          🔴 경고(끊김·잔량)는 **그대로 보인다.** 오히려 폭 65px 구석에서
             지도 위 전폭으로 올라와 더 잘 보인다. */}
      <StateChip lit={lit} enOf={enOf} />
      {(mode3d && !trans) ? (
        <div className="brainmap__wrap brainmap__wrap--3d">
          <BuildTag />
          <Brain3D nodes={shownNodes} chainEdges={m.edges} regions={m.regions}
                   pos2d={pos}
                   lit={lit} onPick={setPickId} boardW={W} boardH={H} />
          <div className="bm-zoomctl" role="group" aria-label="view">
            <button type="button" title="switch to the 2D map (semantic zoom)"
                    onClick={() => go3d(false)}>2D</button>
          </div>
        </div>
      ) : null}
      {(!mode3d || trans) ? (
      <div className={`brainmap__wrap bm-z${zb}${view.z > FIT.z + 0.001 ? ' is-zoomed' : ''}${
             trans ? ' bm-morphing' : ''}${
             trans === 'to2d' ? ' bm-fade-in' : trans === 'to3d' ? ' bm-fade-out' : ''}`}
           ref={wrapRef}>
        <BuildTag />
        <canvas ref={edgeCanvasRef} className="brainmap__edgecanvas"
                aria-hidden="true" />
        <svg viewBox={`0 0 ${W} ${H}`} className="brainmap__svg" role="img"
             ref={svgRef}
             /* 🔴 장식 회전의 중심을 **여기서** 넘긴다 — css 에 숫자를 또 적으면
                판 크기를 바꿀 때 조용히 낡는다 (v51 에 실제로 그랬다). */
             style={{ ['--bm-cx' as string]: `${CX}px`,
                      ['--bm-cy' as string]: `${CY}px` }}
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
          {/* W4 — everything below lives in ONE transformed group; the
              transform is the whole zoom (no re-layout, GPU-composited). */}
          <g className="bm-zoomg"
             transform={`translate(${view.tx},${view.ty}) scale(${view.z})`}>

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
          {/* 🔴 **배경 장식층을 걷었다** (한빈 2026-09-17: *"이왕 회전하지 않는
              걸 보니 배경 제거."*).

              걷은 것: 동심 링 테두리 · 눈금 호(dasharray) · 반대로 도는 겹 ·
              홀로그램 먼지 46개. 전부 **장식**이고 뜻이 없었다 — 층의 경계는
              영역 띠(`.bm-lobe`)와 부 띠(`.bm-sub`)가 이미 말한다.

              ⚠️ 이 자리에서 세 번 왔다 갔다 했다: ①휘돌아서 거슬림 → 멈춤
              ②*"회전하지 않고 있고"* → 되살림 ③*"배경 제거"* → 걷음.
              🔴 **증상을 고치기 전에 원인(낡은 회전 중심)을 먼저 고쳤어야
              했다.** 되살리려면 `git show` 로 이 블록을 꺼내면 된다. */}

          {/* dobbin 코어 — 중심. 상태가 아니라 자리다 (얼굴은 히어로에 있다) */}
          <g className="bm-core" aria-hidden="true">
            {lit.length > 0 && (
              /* v26 — 무엇이든 도는 동안 코어가 쉼 없이 «생각 중» 을 돈다
                 (한빈: 시각 효과가 없으면 중단된 것처럼 보인다). CSS 회전 —
                 JS 프레임 0. lit 은 sticky·심박이 살아 있는 동안 비지 않는다 */
              <g className="bm-core__think">
                {coreFlash > 0 && (
                  <circle key={coreFlash} cx={CX} cy={CY} r={34}
                          className="bm-core__flash bm-core__flash--self" />
                )}
                <circle cx={CX} cy={CY} r={38} className="bm-core__spin" />
                <circle cx={CX} cy={CY} r={46} className="bm-core__spin bm-core__spin--rev" />
              </g>
            )}
            <circle cx={CX} cy={CY} r={30} className="bm-core__halo" />
            <circle cx={CX} cy={CY} r={17} className="bm-core__ring" />
            <circle cx={CX} cy={CY} r={5} className="bm-core__dot" />
            <text x={CX} y={CY + 44} textAnchor="middle" className="bm-core__lab">
              dobbin</text>

          </g>

          <g>
            {/* 엽 — 링 위의 호 구획. 발화하면 그 구획이 파동친다 (B3) */}
          {/* 🔴 **부 이름은 그 영역에 손을 얹었을 때만** (v51 P3).
              처음엔 늘 그렸다. 재니 **37 중 25(68%)를 `tagAt` 이 숨겼다** —
              띠 안쪽 가장자리가 붐벼서다. 3분의 1만 뜨는 이름표는 규칙이
              아니라 운이다. 이 화면은 이미 영역 이름에 같은 답을 내려 두었다:
              *"평시엔 이름을 안 그린다 — 상시 라벨은 서로 겹쳤다."* 그 규율을
              따른다. 평시엔 **띠 색과 칸막이**가 세분화를 말하고, `<title>`
              이 하나하나를 말한다. */}
          {Object.entries(lb).filter(([k, L]) => L.arc && L.subs
              && (zb === 1 || regHover === k))
            .flatMap(([k, L]) =>
            L.subs!.filter(sb => sb.n >= 2).map(sb => {
              const mid = (sb.a0 + sb.a1) / 2;
              const rr = L.arc!.r0 + (L.arc!.r1 - L.arc!.r0) * 0.5;
              const x = CX + rr * Math.cos(mid), y = CY + rr * Math.sin(mid);
              const yy = tagAvoid(x, y, sb.label);
              return <text key={`sl-${k}-${sb.key}`} className="bm-sublab"
                           x={x} y={yy} textAnchor="middle">{sb.label}</text>;
            }))}

            {/* 🔴 **부 하위 띠** (v51 P3 · 한빈 선택 «띠 색까지 달리»).
                영역 hue 는 그대로 두고 **밝기·투명도만** 부 차례로 변조한다 —
                새 색을 만들면 화면이 시끄러워지고 색이 뜻을 잃는다. 영역 띠
                **아래**에 깔아 경계가 겹줄로 안 보이게 한다. */}
            {zb >= 1 && Object.entries(lb).filter(([, L]) => L.arc && L.subs).flatMap(([k, L]) =>
              L.subs!.map(sb => (
                <path key={`sub-${k}-${sb.key}`}
                      d={arcPath(sb.a0, sb.a1, L.arc!.r0, L.arc!.r1)}
                      className="bm-sub"
                      style={{ fill: `hsl(${L.hue} ${52 + (sb.i % 3) * 9}% `
                                   + `${38 + (sb.i % 4) * 7}% / `
                                   + `${(0.05 + (sb.i % 2) * 0.035).toFixed(3)})` }}>
                  <title>{`${L.label} › ${sb.label} — ${sb.n}개`}</title>
                </path>)))}
            {Object.entries(lb).filter(([, L]) => L.arc).map(([k, L]) => {
              const { a0, a1, r0, r1 } = L.arc!;
              const on = lit.some(id => nodeById[id]?.region === k);
              const hov = regHover === k;
              return (
                <path key={`lobe-${k}`} d={arcPath(a0, a1, r0, r1)}
                      className={`bm-lobe${on ? ' bm-lobe--on' : ''}${hov ? ' bm-lobe--hov' : ''}`}
                      onMouseEnter={() => setRegHover(k)}
                      onMouseLeave={() => setRegHover(h => (h === k ? null : h))}
                      onClick={() => setReg(reg === k ? null : k)}
                      style={{ fill: `hsl(${L.hue} 70% 55% / ${hov ? '.16' : '.06'})`,
                               stroke: `hsl(${L.hue} 70% 62% / ${hov ? '.55' : '.22'})` }} />
              );
            })}
          </g>

          {/* 링 이름 — 12시 방향, 링 바로 위 */}
          {Object.entries(m.layers || {}).map(([k, L]) => {
            const ring = rings[k]; if (!ring) return null;
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
          {/* 🔴 장비 캡션을 걷었다 — 뇌 아닌 것(관문·서비스·개발 큐)이
            이제 지도에 없다. 그 수는 계기판이 말한다 (v50). */}
            

          {/* 🔴 **부 칸막이** — 띠만으로는 어디까지가 한 부인지 안 읽힌다.
              얇은 방사선 하나면 충분하다 (v51 P3). */}
          {zb >= 1 && Object.entries(lb).filter(([, L]) => L.arc && L.subs).flatMap(([k, L]) =>
            L.subs!.slice(1).map(sb => (
              <line key={`div-${k}-${sb.key}`} className="bm-subdiv"
                    x1={CX + L.arc!.r0 * Math.cos(sb.a0)}
                    y1={CY + L.arc!.r0 * Math.sin(sb.a0)}
                    x2={CX + L.arc!.r1 * Math.cos(sb.a0)}
                    y2={CY + L.arc!.r1 * Math.sin(sb.a0)} />)))}
          {/* 영역 이름 — 누르면 아래에 「왜 적은가 · 어디까지 됐나」가 뜬다 */}
          {Object.entries(lb).map(([k, L]) => {
            const c = m.census?.[k];
            // 🔴 이름이 점 위에 얹혀 깨져 보였다 (한빈 2026-09-11: *"영역
            //    타이틀을 보기 좋게 — 아니면 hover 시에"*). 셋으로 고친다:
            //    ① 자리 — 구획 **바깥** 가장자리 (점들의 띠 밖)
            //    ② 헤일로 — 배경색 테두리로 점 위에서도 읽힌다 (CSS paint-order)
            //    ③ 수치(칸·모듈)는 **hover·선택 때만** — 평시는 이름만
            let x = L.cx, y = L.cy - L.ry - 5;
            if (L.arc) {
              const mid = (L.arc.a0 + L.arc.a1) / 2;
              const rr = L.arc.r1 + 10;
              x = CX + rr * Math.cos(mid); y = CY + rr * Math.sin(mid);
            }
            // 🔴 **평시엔 이름을 안 그린다** — 상시 라벨은 서로 겹쳤다
            //    (「보관소조작」으로 뭉개진 실측 스크린샷). 영역 hover 또는
            //    선택 때만, 그때는 수치까지 함께.
            if (regHover !== k && reg !== k) return null;
            return (
              <text key={`lab-${k}`}
                    className={`bm-region bm-region--btn is-on`}
                    x={x} y={y} textAnchor="middle"
                    onMouseEnter={() => setRegHover(k)}
                    onClick={() => setReg(reg === k ? null : k)}
                    style={{ fill: `hsl(${L.hue} 70% 74%)` }}>
                {/* L.n 은 접힘 뒤 수 — census 전체 수가 정답 (A2) */}
                {L.label}<tspan className="bm-region-n">
                  {` ${c?.칸 ?? L.n}`}{c && c.모듈 ? ` · Modules ${c.모듈}` : ''}</tspan>
              </text>
            );
          })}

          {/* 이음+노드 기반층 — 판(m)이 바뀔 때만 다시 짓는다 (위 baseLayer) */}
          {baseLayer}
          {/* W4 Z2 — nerve names for what's IN the viewport. Text counter-
              scales (10/z) so it stays readable, and a coarse grid dedupes
              near-neighbours instead of the tagAt ledger (whose lifecycle
              belongs to the memoized base layer). */}
          {zb >= 2 && view.z > 2.2 && (() => {
            // names need real magnification — at the ?bmlod test floor
            // (z=1) they'd blanket the board (jig ⑤: 113 overlapping pairs)
            const grid = new Set<string>();
            const cell = 26 / view.z;
            const out: ReactElement[] = [];
            for (const n of shownNodes) {
              if (out.length >= 90) break;
              const pp = pos[n.id]; if (!pp || !inVp(pp.x, pp.y, 10)) continue;
              const gk = `${Math.round(pp.x / cell)}:${Math.round(pp.y / cell)}`;
              if (grid.has(gk)) continue;
              grid.add(gk);
              out.push(
                <text key={`zl-${n.id}`} className="bm-tag bm-tag--zoom"
                      x={pp.x} y={pp.y - 3.4 / view.z}
                      style={{ fontSize: `${10 / view.z}px` }}
                      textAnchor="middle">{n.label || n.id}</text>);
            }
            return <g aria-hidden="true">{out}</g>;
          })()}
          {/* W4 Z3 — blueprint cards: a nerve dot expands into its circuit
              (IN receptors → fn → OUT feeds, one real stimulus, live footer).
              Viewport-only, hard cap — everything outside is culled. */}
          {zb >= 3 && (() => {
            const cards: ReactElement[] = [];
            const bw = 240 / view.z, bh = 150 / view.z;
            for (const n of shownNodes) {
              if (cards.length >= 8) break;
              if (n.kind !== '신경') continue;
              const pp = pos[n.id]; if (!pp || !inVp(pp.x, pp.y, -10)) continue;
              const outs = (m.edges || [])
                .filter(e => e.kind === '공급' && e.a === n.id)
                .map(e => nodeById[e.b]?.label || e.b).slice(0, 3);
              const ins = (n.수용체 || []).slice(0, 3);
              const lit3 = litSet.has(n.id);
              cards.push(
                <foreignObject key={`bp-${n.id}`} x={pp.x + 6 / view.z}
                               y={pp.y - bh / 2} width={bw} height={bh}
                               className="bm-bp-fo">
                  <div className={`bm-bp${lit3 ? ' bm-bp--on' : ''}`}
                       style={{ fontSize: `${10 / view.z}px` }}>
                    <b>{n.label || n.id}</b>
                    <div className="bm-bp__io">
                      <span className="bm-bp__in">
                        {ins.length ? ins.map(x => <i key={x}>▸ {x}</i>)
                          : <i className="bm-bp__none">receptors: —</i>}
                      </span>
                      <span className="bm-bp__fn">fn</span>
                      <span className="bm-bp__out">
                        {outs.length ? outs.map(x => <i key={x}>{x} →</i>)
                          : <i className="bm-bp__none">out: —</i>}
                      </span>
                    </div>
                    {n.자극?.[0]
                      ? <div className="bm-bp__stim">「{n.자극[0]}」</div> : null}
                    <div className="bm-bp__foot">
                      {n.hit != null && n.n ? `bench ${n.hit}/${n.n}` : 'bench —'}
                      {' · '}{(STATUS[n.status] || STATUS.dark).t}
                    </div>
                  </div>
                </foreignObject>);
            }
            return <g>{cards}</g>;
          })()}

          {/* 🔴 덧층 — 빛·hover·선택만. 몇십 개뿐이라 0.7초 갱신이 공짜다.
              «원자 크기» 규율(2026-09-11)은 그대로: 평시 점, 활성만 커진다. */}
          {m.edges.map((e, i) => {
            if (!(litSet.has(e.a) || litSet.has(e.b))) return null;
            if (!shownIds.has(e.a) || !shownIds.has(e.b)) return null;
            if (!showCall && (e.kind === '부름' || e.kind === '사슬')) return null;
            const a = pos[e.a], b = pos[e.b];
            if (!a || !b) return null;
            const na = nodeById[e.a], nb = nodeById[e.b];
            const cross = na && nb && (na.layer ?? m.regions[na.region]?.layer)
              !== (nb.layer ?? m.regions[nb.region]?.layer);
            const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2;
            const d = `M${a.x},${a.y} Q${mx2},${my2 - (cross ? 26 : 12)} ${b.x},${b.y}`;
            return <path key={`on${i}`} d={d} fill="none"
                         className={`bm-edge bm-edge--${EDGE_CLS[e.kind] || 'chain'} bm-edge--on`} />;
          })}
          {[...new Set([...lit, hover, pick?.id].filter(Boolean))].map(id => {
            const n = nodeById[id as string]; if (!n) return null;
            const p = pos[n.id]; if (!p) return null;
            const s = STATUS[n.status] || STATUS.dark;
            const on = litSet.has(n.id);
            const ghost = n.kind === '계획' && n.target !== '빚';
            const r = Math.max((n.kind === '접힘' ? 5.5 : 1.6) * 2.6, 5.5);
            return (
              <g key={`ov-${n.id}`} className={`bm-node${on ? ' bm-node--fire' : ''}`}
                 pointerEvents="none">
                {on && <circle key={`h@${litAtRef.current[n.id] || 0}`}
                               className="bm-halofade"
                               cx={p.x} cy={p.y} r={16} fill="url(#bmglow)" />}
                <circle cx={p.x} cy={p.y} r={r}
                        strokeDasharray={ghost ? '2 2' : undefined}
                        fill={ghost ? 'none' : s.c}
                        stroke={pick?.id === n.id ? '#fff'
                                : `hsl(${m.regions[n.region]?.hue ?? 210} 80% 70%)`}
                        strokeWidth={1.4}
                        filter={on ? 'url(#bmlit)' : undefined} />
                {/* 🔴 덧층도 자리를 피한다 — 안 하면 기반 이름표 위에 포개진다
                    (실측 「vault-hand」×「proactive-selfcheck」). 다만 울리는
                    것이라 **숨기지는 않는다** (`tagAvoid`). */}
                <text className={`bm-tag${on ? ' bm-tag--on' : ''}`} x={p.x}
                      y={tagAvoid(p.x, p.y - (r + 5), n.label || n.id)}
                      textAnchor="middle">
                  {n.label || n.id}
                </text>
              </g>
            );
          })}
          {/* v26 P-D — 전기신호 도약: 직전 발화 노드에서 다음 노드로 한 번
              흐르는 점 (animateMotion 0.5s · prune 이 1.2s 뒤 걷는다) */}
          {pulses.map(pp => (
            <circle key={pp.k} r={2.6} className="bm-pulse">
              <animateMotion dur="0.5s" fill="freeze"
                path={`M${pp.x1},${pp.y1} L${pp.x2},${pp.y2}`} />
            </circle>
          ))}
          </g>
        </svg>
        {/* W4 — zoom controls (Maps idiom: wheel/drag/dblclick/pinch also work) */}
        <div className="bm-zoomctl" role="group" aria-label="zoom">
          <button type="button" title="back to 3D"
                  onClick={() => go3d(true)}>3D</button>
          <button type="button" title="zoom in"
                  onClick={() => zoomAt({ x: vp.x + vp.w / 2, y: vp.y + vp.h / 2 }, 1.6)}>+</button>
          <button type="button" title="zoom out"
                  onClick={() => zoomAt({ x: vp.x + vp.w / 2, y: vp.y + vp.h / 2 }, 1 / 1.6)}>−</button>
          {view.z > FIT.z + 0.001 ? (
            <button type="button" title="reset"
                    onClick={() => setView(FIT)}>⤢</button>) : null}
          <i className="bm-zoomctl__z">{view.z <= FIT.z + 0.001 ? '' : `×${view.z.toFixed(1)} · Z${zb}`}</i>
        </div>
        {/* 🔴 `brainmap__live`(378×43)도 **지도를 덮고 있었다** — 칩과
            같은 물음(「지금 무슨 일이 일어나는가」)에 답하면서 지도 양쪽
            구석에 따로 떠 있었다. 위 `<StateChip lit=…>` 한 줄로 합쳤다.
            겹치는 것이 둘에서 **0** 이 된다. */}
        {/* W4-R (HanBin 7th): the morph overlay lives INSIDE this wrap —
            anchored to the section it had a different box, so the landing
            board was scaled/offset against the SVG. Same box = same
            letterbox = the derived front camera lands pixel-true. */}
        {trans ? (
          <div className="bm-glover">
            <Brain3D nodes={shownNodes} chainEdges={m.edges}
                     regions={m.regions} pos2d={pos}
                     lit={lit} onPick={setPickId} boardW={W} boardH={H}
                     morphTo={trans === 'to2d' ? 0 : 1}
                     onMorphDone={() => {
                       // HanBin 9th — the GL dots land EXACTLY on the SVG
                       // dots (position+size identity), so the handoff is an
                       // instant swap: no crossfade, no double exposure.
                       if (trans === 'to2d') { setMode3d(false); setTrans(null); }
                       else setTrans(null);
                     }} />
          </div>) : null}
      </div>
      ) : null}

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
      {/* 🔴 **0 일 때는 칸을 안 세운다 — 그러나 숨기지도 않는다**
          (한빈 2026-09-17: *"지도 밖 0 관련 창도 중요한 정보인지 모르겠음"*).
          위 주석의 규율(「0이어도 숨기지 않는다」)은 지킨다 — 0 이면 제목줄
          요약(`.brainmap__sum`)에 **글자로 남는다.** 실측: 이 칸이 728×120px
          을 「0」 하나에 쓰고 있었다 (창 세로 예산의 12%). */}
      {m.outside && (m.outside.수 ?? 0) > 0 && (
        <div className="brainmap__detail bm-outside">
          <>🔴 아직 지도 밖: <b>{m.outside.수}개 모듈</b>
            {' · '}{(m.outside.줄수 ?? 0).toLocaleString()}줄 —
            {' '}{(m.outside.큰것 || []).slice(0, 5)
                  .map(([n, mo]) => `${mo}(${n.toLocaleString()})`).join(' · ')}
          </>
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
          {/* v20 온톨로지 — 피질 > 계 > 부 > 신경의 자리 */}
          {(pick as any).부 ? (
            <div className="bm-ont" title="인지 온톨로지에서의 자리">
              자리: {(pick as any).계 ?? '?'} › {(pick as any).부}
            </div>) : null}
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

      {/* 🔴 **모양 범례가 없었다** (한빈 2026-09-17: *"타 노드와 다르게 왜
          도넛모양인가?"*). 색 12칸을 전부 **꽉 찬 원**으로 그려 놓아서,
          화면의 도넛·크기 차이를 설명하는 자리가 어디에도 없었다. 모양은
          status 가 아니라 **kind** 가 정한다 — 그 표를 함께 낸다. */}
      {/* 🔴 범례 **24칸**(상태 12 + 이음 12)이 상시 켜져 있었다 — 한 번
          배우면 안 보는 것이 화면의 절반을 먹는다. 접는다(지우지 않는다). */}
      <details className="brainmap__more">
        <summary>범례 — 색과 모양</summary>
      <div className="brainmap__legend">
        {/* 🔴 어제 「도넛 = 계획(할 일)」이라 적었는데 **이제 틀린 말**이
            된다 — 계획 중 `빚`(이미 있는 신경을 고치는 일)은 꽉 찬 점으로
            그린다. 속 빈 것은 **아직 안 지은 것(신설)** 뿐이다. */}
        <span title="가운데가 빈 원 = 아직 안 지은 신경(신설 계획). 있는 신경의 빚은 꽉 찬 점이다">
          <i style={{ background: 'transparent', border: '1.6px solid #ff8ac4' }} />
          속 빈 원 = 아직 안 지음
        </span>
        <span title="꽉 찬 원 = 신경·기관·걸음·관문, 그리고 있는 신경의 빚">
          <i style={{ background: '#8b5cf6' }} />꽉 찬 점 = 신경·기관·빚
        </span>
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
            {trace.slice(0, 12).map((t, i) => {
              const lane = (m.trace_lanes?.[t.kind] || LANE_FALLBACK)[0];
              const what = traceWhat(t.raw) || t.kind;
              const at = new Date(t.ts * 1000)
                .toLocaleTimeString('ko-KR', { hour12: false });
              return (
                <li key={`${t.ts}-${t.kind}-${i}`} className={`bm-tr bm-tr--${lane}`}
                    title={`${t.kind} · ${what}`}>
                  <i>{at}</i><em>{lane}</em>{what}
                </li>
              );
            })}
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
          // 접힘을 걷어 끝점 소실이 구조적으로 0 이 됐다 (전 노드 표시)
          const gone = 0;
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
      </details>
    </section>
  );
}


