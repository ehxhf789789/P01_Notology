/** v29 P2 — 접속 기기 적응 품질 (한빈: 기기에 따라 렉 편차가 크다).
 *
 * 스펙이 아니라 **실측**이 판정한다: 부팅 2초 rAF 간격 p95. 같은 스펙도
 * 배터리·절전 모드로 다르다. 의미(발화=진실)는 전 단계 보존 — 밀도만
 * 조절한다. 조용한 강등 금지: 모든 전환이 log 에 남고 칩 진단이 보여준다.
 */
export type Tier = '풀' | '보통' | '절전';

const KEY = 'dobbin-quality';
let cur: Tier | null = null;
let fps95 = 0;
const log: string[] = [];
let badStreak = 0;

function note(s: string): void {
  log.push(`${new Date().toTimeString().slice(0, 8)} ${s}`);
  if (log.length > 20) log.shift();
}

function pick(p95ms: number): Tier {
  const hc = navigator.hardwareConcurrency || 4;
  const dm = (navigator as { deviceMemory?: number }).deviceMemory || 4;
  if (p95ms <= 22 && hc >= 8 && dm >= 8) return '풀';
  if (p95ms <= 40) return '보통';
  return '절전';
}

/** 부팅 실측 — 2초간 rAF 간격을 재서 단을 정한다 (수동 고정이 있으면 그것). */
export function calibrate(): void {
  const manual = localStorage.getItem(KEY) as Tier | null;
  if (manual === '풀' || manual === '보통' || manual === '절전') {
    cur = manual;
    note(`수동 고정: ${manual}`);
    return;
  }
  const gaps: number[] = [];
  let last = performance.now();
  const t0 = last;
  const step = (t: number) => {
    gaps.push(t - last);
    last = t;
    if (t - t0 < 2000) requestAnimationFrame(step);
    else {
      gaps.sort((a, b) => a - b);
      fps95 = gaps[Math.floor(gaps.length * 0.95)] || 16;
      cur = pick(fps95);
      note(`실측 rAF p95 ${fps95.toFixed(1)}ms → ${cur}`);
      watch();
    }
  };
  requestAnimationFrame(step);
}

/** 런타임 강등 — 프레임 p95 가 예산을 3회 연속 넘으면 한 단계 내린다. */
function watch(): void {
  let gaps: number[] = [];
  let last = performance.now();
  const step = (t: number) => {
    gaps.push(t - last);
    last = t;
    if (gaps.length >= 300) {
      gaps.sort((a, b) => a - b);
      const p95 = gaps[Math.floor(gaps.length * 0.95)];
      gaps = [];
      const budget = cur === '풀' ? 25 : cur === '보통' ? 45 : 90;
      if (p95 > budget) {
        badStreak += 1;
        if (badStreak >= 3 && cur !== '절전') {
          cur = cur === '풀' ? '보통' : '절전';
          badStreak = 0;
          note(`강등 → ${cur} (p95 ${p95.toFixed(0)}ms × 3회)`);
        }
      } else badStreak = 0;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function tier(): Tier { return cur ?? '보통'; }

/** 표현 예산 — 밀도만 조절, 의미는 보존. */
export function budget(): { haloCap: number; pulses: boolean; spin: boolean } {
  const t = tier();
  if (t === '풀') return { haloCap: 24, pulses: true, spin: true };
  if (t === '보통') return { haloCap: 8, pulses: true, spin: true };
  return { haloCap: 4, pulses: false, spin: false };
}

export function qualityInfo(): string {
  return `품질 ${tier()} · rAF p95 ${fps95.toFixed(0)}ms · ${
    navigator.hardwareConcurrency || '?'}코어 ｜ ${log.slice(-2).join(' → ')}`;
}

calibrate();
