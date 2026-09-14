/** 변화 알림 받기 — F5를 누르지 않아도 화면이 따라온다
 *
 * 사용자 요구 (2026-08-11):
 *   *"너가 이렇게 수정하게 되면 웹으로 열려있는 notology가 자동으로
 *     리프레시가 되어야 한다고. 이전 화면을 보고 있는 게 아니라.
 *     그 병목이 최소화되지 않으면 충돌이나 오류가 발생할 수 있다. (편집이 되므로)"*
 *
 * 🔴 **이건 편의가 아니라 안전이다.** 이전 화면을 보면서 편집하면
 *    저장할 때 남의 글을 덮는다. 화면이 최신이어야 충돌이 안 난다.
 *
 * 서버가 쓸 때마다 SSE로 밀어준다 (`/api/events`). 폴링하지 않는다 —
 * 기기가 늘수록 서버가 그것만 하게 된다.
 */
type Handler = (ev: { kind: string; path?: string; [k: string]: unknown }) => void;

const handlers = new Set<Handler>();
let source: EventSource | null = null;
let retry = 1000;
// v26-C 블랙박스 — 연결 생애 최근 50건. 재발 보고가 원인을 싣고 오게.
const LIFE: string[] = [];
function life(s: string): void {
  LIFE.push(`${new Date().toTimeString().slice(0, 8)} ${s}`);
  if (LIFE.length > 50) LIFE.shift();
}
export function lifeTail(n = 5): string[] { return LIFE.slice(-n); }
export function sseState(): number { return source ? source.readyState : -1; }
// v26-C 소크 진단 — 수신 종류 계수기 + 마지막 ping 자백(q 길이·등록 여부)
const KINDS: Record<string, number> = {};
let lastPing: { q?: number; in?: boolean; at?: number } = {};
declare global { interface Window { __live?: unknown } }
if (typeof window !== 'undefined') {
  window.__live = {
    tail: lifeTail, state: sseState,
    kinds: () => ({ ...KINDS }), ping: () => ({ ...lastPing }),
  };
}

export function onLive(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}

/** 🔴 **새 번들이 올라오면 스스로 새로고침한다.**
 *
 * 서버 코드를 고쳐도 열려 있는 창은 옛 자바스크립트를 계속 돌린다.
 * 그러면 "자동 리프레시가 안 된다"가 된다 — 실제로 그랬다.
 * 30초마다 빌드 도장을 견주고, 달라졌으면 한 번 다시 읽는다.
 *
 * ⚠️ 편집 중에는 새로고침하지 않는다. 쓰던 글을 날리는 것이 낡은 화면보다 나쁘다.
 */
function watchBuild(): void {
  let mine: number | null = null;
  const check = async () => {
    try {
      const r = await fetch('/api/build', { method: 'POST' });
      const { build } = await r.json();
      if (mine === null) { mine = build; return; }
      if (build && build !== mine) {
        // v26-C — 억제는 «쓰던 글»을 지키려는 것이지 «포커스»가 아니다.
        // 대화창을 상시 포커스로 쓰는 사람에게는 영영 리로드가 안 돌아
        // 낡은 탭이 «멈춤 증상»으로 위장했다 (오늘 6번). 내용이 비었으면
        // 리로드한다.
        const el = document.querySelector(
          '.cm-editor.cm-focused, textarea:focus, input:focus');
        const txt = !el ? '' : ('value' in (el as HTMLInputElement)
          ? (el as HTMLInputElement).value
          : (el as HTMLElement).textContent || '');
        if (!txt.trim()) { life('빌드갱신 리로드'); location.reload(); }
      }
    } catch { /* 서버가 잠깐 없을 수 있다 */ }
  };
  check();
  setInterval(check, 30000);
}

export function startLive(): void {
  if (source) return;
  watchBuild();
  let everBroke = false;
  // v26-B 감시견 — SSE 는 **오류 없이 굳을 수** 있다 (실측: 탭이 조용히
  // 멎고 강력새로고침만 살렸다 — onerror 가 안 오면 재접속 로직이 영원히
  // 안 돈다). 서버가 20s 마다 실이벤트 ping 을 보내므로, 55s 무신호면
  // 소켓이 굳은 것 — 제 손으로 끊고 다시 붙는다.
  let lastMsg = Date.now();
  let lastReal = Date.now();               // 비-ping — 좀비 스트림 판별
  let zombieBusy = false;
  const kick = (why: string) => {
    life(`감시견 재접속: ${why}`);
    everBroke = true;
    console.warn(`[liveSync] 재접속 (${why}) — 마지막 신호 ${Math.round((Date.now() - lastMsg) / 1000)}s 전`);
    handlers.forEach((h) => { try { h({ kind: 'reconnecting' }); } catch { /* */ } });
    try { source?.close(); } catch { /* 이미 죽었을 수 있다 */ }
    source = null;
    retry = 1000;
    open();
  };
  window.setInterval(() => {
    if (source && Date.now() - lastMsg > 55000) { kick('55s 무신호'); return; }
    // v26-C P-heal — **좀비 스트림 자가치유**: ping 은 오는데(연결 생존)
    // 실이벤트가 90s 없으면, 서버 장부(/api/events/recent)와 대조해
    // 서버가 흐르고 있으면 이 연결이 죽은 것 — 제 손으로 다시 붙는다.
    // (실측: 산 연결의 서버측 큐가 등록부에서 이탈 — ping.in=false)
    if (source && !zombieBusy
        && Date.now() - lastMsg < 55000
        && Date.now() - lastReal > 90000) {
      zombieBusy = true;
      fetch('/api/events/recent').then(r => r.json()).then(j => {
        const evs = j.events || [];
        const fresh = evs.length
          && Date.now() / 1000 - evs[evs.length - 1].at < 30;
        if (fresh) kick('좀비 스트림 (ping만 옴)');
      }).catch(() => { /* 대조를 못 떠도 다음 틱에 또 본다 */ })
        .finally(() => { zombieBusy = false; });
    }
  }, 15000);
  // 탭이 얼었다 깨어나면(브라우저 절전) 그 자리에서 되살핀다 — 15s 를
  // 기다리게 하면 사람 눈에는 «돌아왔는데도 죽어 있음»으로 보인다.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      life(`탭 복귀 (무신호 ${Math.round((Date.now() - lastMsg) / 1000)}s)`);
      if (Date.now() - lastMsg > 25000) kick('탭 복귀');
    }
  });
  const open = () => {
    source = new EventSource('/api/events');
    life('연결 시도');
    source.onopen = () => {
      retry = 1000;
      lastMsg = Date.now();
      life('열림');
      // 🔴 **끊긴 사이 사건은 영영 유실이다** (2026-09-11 신호 경로 전수 —
      //    SSE 에 Last-Event-ID 재전송이 없다). 다시 붙었을 때 리스너들에게
      //    「재접속」을 알려 각자 다시 읽게 한다 — 유실을 재조회로 메운다.
      if (everBroke) {
        handlers.forEach((h) => {
          try { h({ kind: 'reconnected' }); } catch { /* 한 곳이 죽어도 */ }
        });
      }
    };
    source.onmessage = (e) => {
      lastMsg = Date.now();
      try {
        const ev = JSON.parse(e.data);
        KINDS[ev.kind] = (KINDS[ev.kind] || 0) + 1;
        if (ev.kind === 'ping') lastPing = { q: ev.q, in: ev.in, at: Date.now() };
        else lastReal = Date.now();
        handlers.forEach((h) => { try { h(ev); } catch { /* 한 곳이 죽어도 나머지는 돈다 */ } });
      } catch { /* ping 등 */ }
    };
    // 🔴 끊기면 다시 붙는다. 노트북 덮개를 닫았다 열면 끊긴다 —
    //    거기서 포기하면 그때부터 이전 화면을 보게 된다.
    source.onerror = () => {
      life(`오류(${retry}ms 뒤 재시도)`);
      everBroke = true;
      source?.close();
      source = null;
      retry = Math.min(retry * 2, 30000);
      setTimeout(open, retry);
    };
  };
  open();
}
