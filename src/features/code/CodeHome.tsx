/**
 * «개인 GitHub» 창 (v61 B5 K3 · 2026-09-25) — dobbin 창처럼 따로 여는 중앙 뷰.
 *
 * 한빈 09-25: *"dobbin 창 처럼 별도의 창을 만들어서 개발 폴더를 따로 보관하는 개인 Github 탭"* ·
 * *"개발 폴더를 노트로 보여주는것은 결국 사람 기준 불편하며 어색한 방식"* → 🔴 서재에 노트를 만들지 않는다.
 *
 * 맨 위 «살펴볼 것» (겹침 · 여쭐 것 · 받아들일 수 있는 개발 폴더) · 아래 저장소 × PC 격자 (과제별).
 * 허브가 바뀌면 (`code-changed`) 다시 읽는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import { onLive } from '../../web/liveSync';
import { code, ago, errText, type RepoSummary, type Candidate, type CloneState } from './codeClient';
import { RepoView } from './RepoView';
import './code.css';

function cell(c: CloneState | undefined) {
  if (!c) return <span className="ghub-cell ghub-cell--none" title="이 PC 에는 없음">—</span>;
  const bits: string[] = [];
  if (c.ahead) bits.push(`↑${c.ahead}`);
  if (c.behind) bits.push(`↓${c.behind}`);
  if (c.dirty) bits.push(`미커밋 ${c.dirty}`);
  const tone = c.paused ? 'paused' : bits.length ? 'busy' : 'ok';
  return (
    <span className={`ghub-cell ghub-cell--${tone}`} title={`${c.path} · ${c.branch || ''} · 보고 ${ago(c.report_at)}`}>
      {c.paused ? '멈춤' : bits.join(' ') || '맞음'}
    </span>
  );
}

export function CodeHome() {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([code.repos(), code.candidates().catch(() => ({ candidates: [] as Candidate[] }))]);
      setRepos(r.repos);
      setCands(c.candidates);
      setErr(null);
    } catch (e) {
      setErr(errText(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const off = onLive((ev: unknown) => {
      if ((ev as { kind?: string } | null)?.kind === 'code-changed') void load();
    });
    return () => { off(); };
  }, [load]);
  const hosts = useMemo(() => {
    const s = new Set<string>();
    (repos || []).forEach(r => r.clones.forEach(c => s.add(c.host)));
    return [...s].sort();
  }, [repos]);
  const groups = useMemo(() => {
    const m = new Map<string, RepoSummary[]>();
    (repos || []).forEach(r => {
      const k = r.projects.find(p => p.role === 'main')?.label || r.projects[0]?.label || '과제 미정';
      m.set(k, [...(m.get(k) || []), r]);
    });
    return [...m.entries()].sort((a, b) => (a[0] === '과제 미정' ? 1 : b[0] === '과제 미정' ? -1 : a[0].localeCompare(b[0])));
  }, [repos]);
  const asks = cands.filter(c => c.decision === 'ask');
  const waiting = cands.filter(c => c.git && c.kind === 'own' && !c.decision && !c.slug);
  const conflicts = (repos || []).filter(r => r.conflicts > 0);
  return (
    <div className="ghub">
      <header className="ghub__hero">
        <GitBranch size={20} />
        <div className="ghub__text">
          <div className="ghub__title">개인 GitHub</div>
          <div className="ghub__sub">
            {repos ? `저장소 ${repos.length} · PC ${hosts.length}` : '불러오는 중…'} — 개발은 PC 에서, 주고받기·합치기는 여기서
          </div>
        </div>
        <button type="button" className="ghub__btn ghub__btn--ghost" onClick={() => void load()} aria-label="다시 읽기"><RefreshCw size={15} /></button>
      </header>
      {err && <p className="ghub__err ghub__pad">{err}</p>}
      {sel ? (
        <RepoView slug={sel} onBack={() => setSel(null)} onChanged={() => void load()} />
      ) : (
        <div className="ghub__body">
          {(conflicts.length > 0 || asks.length > 0 || waiting.length > 0) && (
            <section className="ghub-look" aria-label="살펴볼 것">
              <h3 className="ghub-look__h">살펴볼 것</h3>
              <ul>
                {conflicts.map(r => (
                  <li key={r.slug}><button type="button" className="ghub-look__it ghub-look__it--bad" onClick={() => setSel(r.slug)}>
                    🔴 {r.name} — 두 PC 가 같은 곳을 고쳤습니다 ({r.conflicts}) · 파일마다 고르기</button></li>
                ))}
                {asks.map(c => (
                  <li key={`${c.host}-${c.path}`} className="ghub-look__it">
                    ❓ {c.host} · <code>{c.path}</code> — {c.why || 'dobbin 이 판정을 기다립니다'}</li>
                ))}
                {waiting.length > 0 && (
                  <li className="ghub-look__it">
                    📦 받아들일 수 있는 개발 폴더 {waiting.length} ({[...new Set(waiting.map(c => c.host))].join(' · ')}) —
                    dobbin 에게 «{waiting[0].host} 저장소 켜줘» 라고 하시면 받아들입니다</li>
                )}
              </ul>
            </section>
          )}
          {repos && !repos.length && (
            <p className="ghub__muted ghub__pad">
              아직 잇힌 저장소가 없습니다. PC 의 «저장소» 를 켜면 그 PC 의 개발 폴더를 받아들여 여기 보입니다.
            </p>
          )}
          {groups.map(([g, rs]) => (
            <section key={g} className="ghub-grid">
              <h3 className="ghub-grid__h">{g}</h3>
              <table className="ghub-grid__t">
                <thead>
                  <tr><th>저장소</th><th>마지막 활동</th>{hosts.map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rs.map(r => (
                    <tr key={r.slug} className="ghub-grid__row" onClick={() => setSel(r.slug)}>
                      <td className="ghub-grid__name">
                        <b>{r.name}</b>{r.conflicts > 0 && <span className="ghub-chip ghub-chip--bad">겹침</span>}
                        {r.publish_enabled && <span className="ghub-chip">배포</span>}
                        <div className="ghub__muted ghub-grid__desc">{r.description}</div>
                      </td>
                      <td className="ghub-grid__last">{r.last ? <>{ago(r.last.at)}<div className="ghub__muted">{r.last.host}</div></> : '—'}</td>
                      {hosts.map(h => <td key={h}>{cell(r.clones.find(c => c.host === h))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
