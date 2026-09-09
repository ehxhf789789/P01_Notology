/**
 * 신경 지도 — dobbin 의 뇌를 **눈으로 본다** (v10 ㅈ · 2026-09-09).
 *
 * 한빈: *"뇌의 신경을 시각적으로 보여주는 방식으로 notology 에 구현하던가."*
 *
 * 🔴 새로 계산하지 않는다. 서버가 이미 가진 셋을 합쳐 그린다:
 *    ① 등록부(신경 53개 · 사슬 차례 · 수용체 유무)  ② 반사 행렬(명중/오배선)
 *    ③ 최근 발화 자국(대화 trace — 이주 064 로 영속)
 *
 * 색이 곧 상태다:  초록=명중  ·  붉음=오배선  ·  회색=아직 못 잼
 *                 점선 테두리=수용체가 선언 안 됨(정직한 빚)
 * 말을 걸면 그 턴에 울린 신경이 **깜빡인다** (dobbin:fired 사건).
 */
import { useEffect, useState } from 'react';
import './nerve.css';

type Nerve = {
  id: string; order: number; kind: string; mod?: string; fn?: string;
  수용체: string[]; 자극: string[];
  잼?: number | null; 명중?: number | null;
  오배선?: Record<string, number>; 최근발화?: string | null;
};
type Payload = {
  matrix?: { 측정?: number; 자극?: number; 명중?: number; 오배선?: number;
             무표시?: number; 혼동?: { 의도: string; 발화: string; n: number }[] };
  nerves?: Nerve[];
};

function tone(n: Nerve): string {
  const miss = Object.keys(n.오배선 || {}).length;
  if (miss) return 'bad';                       // 붉음 — 남이 대신 먹었다
  if (n.잼 && n.명중 === n.잼) return 'ok';      // 초록 — 의도대로 울린다
  if (n.잼) return 'part';
  return 'dark';                                // 회색 — 아직 못 쟀다
}

export function NerveMap() {
  const [d, setD] = useState<Payload | null>(null);
  const [pick, setPick] = useState<Nerve | null>(null);
  const [lit, setLit] = useState<string[]>([]);

  useEffect(() => {
    let dead = false;
    fetch('/api/nerves').then(r => (r.ok ? r.json() : null))
      .then(j => { if (!dead && j) setD(j as Payload); })
      .catch(() => { /* 옛 서버면 지도가 없다 — 조용히 빠진다 */ });
    return () => { dead = true; };
  }, []);

  // 대화가 끝날 때마다 그 턴에 울린 신경이 깜빡인다
  useEffect(() => {
    const on = (e: Event) => {
      const ids = (e as CustomEvent).detail as string[] | undefined;
      if (!ids?.length) return;
      setLit(ids);
      const t = setTimeout(() => setLit([]), 2200);
      return () => clearTimeout(t);
    };
    window.addEventListener('dobbin:fired', on as EventListener);
    return () => window.removeEventListener('dobbin:fired', on as EventListener);
  }, []);

  if (!d?.nerves?.length) return null;
  const m = d.matrix || {};
  return (
    <section className="nervemap">
      <h3>신경 지도
        <span className="nervemap__sum">
          {d.nerves.length}개 · 잰 것 {m.측정 ?? '—'} · 명중 {m.명중 ?? '—'}/{m.자극 ?? '—'}
          {m.오배선 ? ` · 오배선 ${m.오배선}` : ''}
        </span>
      </h3>
      <div className="nervemap__grid">
        {d.nerves.map(n => (
          <button key={n.id} type="button"
                  className={`nrv nrv--${tone(n)}${n.수용체.length ? '' : ' nrv--nore'}`
                             + (lit.includes(n.id) ? ' nrv--fire' : '')
                             + (pick?.id === n.id ? ' nrv--pick' : '')}
                  onClick={() => setPick(pick?.id === n.id ? null : n)}
                  title={`${n.id} · ${n.kind}${n.잼 ? ` · ${n.명중}/${n.잼}` : ' · 아직 못 잼'}`}>
            <span className="nrv__id">{n.id}</span>
            {n.잼 ? <span className="nrv__n">{n.명중}/{n.잼}</span> : null}
          </button>
        ))}
      </div>
      {pick && (
        <div className="nervemap__detail">
          <b>{pick.id}</b> <span className="nrv__kind">{pick.kind}</span>
          {pick.mod ? <code>{pick.mod}{pick.fn ? `.${pick.fn}` : ''}</code> : null}
          <div>수용체: {pick.수용체.length ? pick.수용체.join(' · ') : '아직 선언 안 됨'}</div>
          {pick.자극?.length ? <div>이런 말에 울린다: 「{pick.자극[0]}」</div> : null}
          <div>
            {pick.잼 ? `반사 ${pick.명중}/${pick.잼}` : '반사 아직 못 잼'}
            {Object.entries(pick.오배선 || {}).map(([k, v]) =>
              <span key={k} className="nrv__miss"> ← 「{k}」가 {v}번 대신 먹음</span>)}
          </div>
          {pick.최근발화 ? <div>최근 발화 {pick.최근발화}</div> : null}
        </div>
      )}
      <div className="nervemap__legend">
        <i className="nrv--ok" />의도대로 <i className="nrv--bad" />오배선
        <i className="nrv--dark" />아직 못 잼 <i className="nrv--nore" />수용체 없음
      </div>
    </section>
  );
}
