/**
 * 배포 · 정보 탭 (플랜 B5 ②) — 사람이 바꾸는 일. 서버가 edit 권한과 **누가 눌렀나**를 확인한다.
 *
 *   배포  github.com 정리 배포 규칙 · 🔴 다음 배포 미리보기 (들어갈 것 / 빠질 것 / 비밀) 뒤에 켠다
 *   정보  과제 잇기 · PC 별 clone · «이 PC 에 받기» · 🔴 겹친 갈라짐을 파일마다 고르기
 */
import { useEffect, useState } from 'react';
import { code, ago, errText, type RepoDetail, type Project, type PublishResult, type Divergence, type CompareResult } from './codeClient';
import { DiffView } from './DiffView';

export function PublishTab({ repo, onChanged }: { repo: RepoDetail; onChanged: () => void }) {
  const rules = repo.publish_rules || {};
  const [exclude, setExclude] = useState((rules.exclude || []).join('\n'));
  const [branch, setBranch] = useState(rules.branch || repo.default_branch || 'main');
  const [pv, setPv] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (f: () => Promise<unknown>, done: string) => {
    setBusy(true); setMsg(null);
    try { await f(); setMsg(done); onChanged(); } catch (e) { setMsg(`🔴 ${errText(e)}`); } finally { setBusy(false); }
  };
  if (!repo.github_url) {
    return <p className="ghub__muted">github.com 주소가 없는 저장소입니다 — 배포할 곳이 없습니다 (PC 의 옛 origin 이 한빈의 github 일 때 저절로 섭니다).</p>;
  }
  return (
    <div className="ghub-publish">
      <p className="ghub-publish__to">과녁: <code>{repo.github_url}</code> · 역할 {repo.github_role}</p>
      <p className="ghub__muted">
        개인 GitHub 에는 모든 것이 남고, github.com 에는 배포 제외 규칙과 비밀 검사를 거친 <b>정리본</b>만 매주 한 커밋으로 갑니다.
        🔴 처음 켤 때는 먼저 미리보기를 보십시오 — 이미 github.com 에 있던 파일이라도 제외 규칙에 걸리면 배포 커밋에서 빠집니다.
      </p>
      <div className="ghub-form">
        <label className="ghub-form__row">
          <input type="checkbox" checked={!!rules.enabled} disabled={busy}
                 onChange={e => void run(() => code.publishRules(repo.slug, { enabled: e.target.checked }),
                   e.target.checked ? '매주 배포를 켰습니다' : '매주 배포를 껐습니다')} />
          <span>매주 정리 배포</span>
        </label>
        <label className="ghub-form__row">
          <span>가지</span>
          <input className="ghub__input" value={branch} onChange={e => setBranch(e.target.value)} />
        </label>
        <label className="ghub-form__col">
          <span>더 뺄 경로 (한 줄에 하나 · 기본 제외 목록 위에 더한다)</span>
          <textarea className="ghub__textarea" rows={4} value={exclude} onChange={e => setExclude(e.target.value)}
                    placeholder={'notes/\n*.csv'} />
        </label>
        <div className="ghub-form__btns">
          <button type="button" className="ghub__btn" disabled={busy}
                  onClick={() => void run(() => code.publishRules(repo.slug, {
                    branch, exclude: exclude.split('\n').map(s => s.trim()).filter(Boolean),
                  }), '규칙을 적었습니다')}>규칙 적기</button>
          <button type="button" className="ghub__btn" disabled={busy}
                  onClick={() => void run(async () => setPv(await code.publishPreview(repo.slug)), '미리보기를 만들었습니다 (올리지 않았습니다)')}>
            다음 배포 미리보기</button>
          <button type="button" className="ghub__btn ghub__btn--primary" disabled={busy || !pv || pv.state !== 'dry'}
                  title={!pv ? '먼저 미리보기를 보십시오' : ''}
                  onClick={() => void run(async () => setPv(await code.publishNow(repo.slug)), '배포했습니다')}>지금 배포</button>
        </div>
        {msg && <p className={msg.startsWith('🔴') ? 'ghub__err' : 'ghub__ok'}>{msg}</p>}
      </div>
      {pv && (
        <div className="ghub-preview">
          <p><b>{pv.state === 'dry' ? '미리보기' : pv.state}</b>{pv.why ? ` — ${pv.why}` : ''}</p>
          {pv.secrets.length > 0 && (
            <div className="ghub__err">🔴 비밀로 보이는 것 {pv.secrets.length} — 배포가 멈춥니다:
              <ul>{pv.secrets.map((s, i) => <li key={i}>{s.path} ({s.rule})</li>)}</ul></div>
          )}
          <details open><summary>들어갈 커밋 {pv.included.length}</summary>
            <ul>{pv.included.slice(0, 60).map((s, i) => <li key={i}>{s}</li>)}</ul></details>
          <details><summary>빠질 경로 {pv.excluded.length}</summary>
            <ul>{pv.excluded.slice(0, 200).map((x, i) => <li key={i}><code>{x.path}</code> — {x.why}</li>)}</ul></details>
        </div>
      )}
      <h4 className="ghub__h4">배포 기록</h4>
      <ul className="ghub-list">
        {repo.publishes.map((p, i) => (
          <li key={i}>{ago(p.at)} · {p.branch} · <b>{p.state}</b> · 커밋 {p.included} · 뺀 것 {p.excluded}
            {p.secrets ? ` · 🔴 비밀 ${p.secrets}` : ''}{p.why ? ` — ${p.why}` : ''}</li>
        ))}
        {!repo.publishes.length && <li className="ghub__muted">아직 없습니다</li>}
      </ul>
    </div>
  );
}

function Resolve({ repo, d, onDone }: { repo: RepoDetail; d: Divergence; onDone: () => void }) {
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [pick, setPick] = useState<Record<string, 'hub' | 'park' | 'both'>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!d.host_sha) return;
    code.compare(repo.slug, d.branch, d.host_sha).then(setCmp).catch(e => setMsg(`🔴 ${errText(e)}`));
  }, [repo.slug, d.branch, d.host_sha]);
  const all = d.conflicts.every(f => pick[f]);
  return (
    <div className="ghub-resolve">
      <p><b>{d.branch}</b> — <span className="ghub-chip ghub-chip--pc">{d.host}</span> 와 서버 가지가 같은 곳을 고쳤습니다 ({ago(d.at)}).
        둘 다 서버에 있습니다. 파일마다 고르면 서버가 합침 커밋을 짓고, PC 들은 받기만 하면 됩니다.</p>
      <table className="ghub-resolve__t">
        <tbody>
          {d.conflicts.map(f => (
            <tr key={f}>
              <td><code>{f}</code></td>
              {(['hub', 'park', 'both'] as const).map(k => (
                <td key={k}>
                  <label>
                    <input type="radio" name={`r-${d.id}-${f}`} checked={pick[f] === k}
                           onChange={() => setPick({ ...pick, [f]: k })} />
                    {k === 'hub' ? '서버 쪽' : k === 'park' ? `${d.host} 쪽` : '둘 다'}
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ghub__muted">«둘 다» 는 서버 판을 그 이름에 두고 {d.host} 판을 <code>이름.{d.host}.확장자</code> 로 나란히 둡니다.</p>
      <button type="button" className="ghub__btn ghub__btn--primary" disabled={!all || busy}
              onClick={async () => {
                setBusy(true);
                try { await code.resolve(d.id, pick); setMsg('풀었습니다 — 서버 가지가 앞으로 갔습니다'); onDone(); }
                catch (e) { setMsg(`🔴 ${errText(e)}`); } finally { setBusy(false); }
              }}>이렇게 합치기</button>
      {msg && <p className={msg.startsWith('🔴') ? 'ghub__err' : 'ghub__ok'}>{msg}</p>}
      {cmp && (<details><summary>{d.host} 쪽이 바꾼 것 (갈라진 뒤)</summary><DiffView patches={cmp.patches} truncated={cmp.truncated} /></details>)}
    </div>
  );
}

export function InfoTab({ repo, onChanged }: { repo: RepoDetail; onChanged: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pid, setPid] = useState<number | ''>('');
  const [role, setRole] = useState('main');
  const [host, setHost] = useState('');
  const [dest, setDest] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { code.projects().then(r => setProjects(r.projects)).catch(() => setProjects([])); }, []);
  const act = async (f: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try { await f(); setMsg(done); onChanged(); } catch (e) { setMsg(`🔴 ${errText(e)}`); }
  };
  const open = repo.divergences.filter(d => d.state === 'conflict' && !d.resolved_at);
  return (
    <div className="ghub-info">
      {open.length > 0 && (
        <section className="ghub-info__sec">
          <h4 className="ghub__h4">🔴 겹친 갈라짐 {open.length}</h4>
          {open.map(d => <Resolve key={d.id} repo={repo} d={d} onDone={onChanged} />)}
        </section>
      )}
      <section className="ghub-info__sec">
        <h4 className="ghub__h4">과제</h4>
        <ul className="ghub-list">
          {repo.projects.map(p => (
            <li key={p.id}>{p.label} · {p.role} · <span className="ghub__muted">{p.decided_by}</span>
              <button type="button" className="ghub__btn ghub__btn--ghost"
                      onClick={() => void act(() => code.linkProject(repo.slug, p.id, p.role, true), '끊었습니다')}>끊기</button></li>
          ))}
          {!repo.projects.length && <li className="ghub__muted">아직 과제가 없습니다</li>}
        </ul>
        <div className="ghub-form__row">
          <select className="ghub__select" value={pid} onChange={e => setPid(e.target.value ? Number(e.target.value) : '')} aria-label="과제">
            <option value="">과제 고르기…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="ghub__select" value={role} onChange={e => setRole(e.target.value)} aria-label="역할">
            <option value="main">주 과제</option><option value="shared">함께 씀</option><option value="tool">도구</option>
          </select>
          <button type="button" className="ghub__btn" disabled={pid === ''}
                  onClick={() => pid !== '' && void act(() => code.linkProject(repo.slug, pid, role), '이었습니다')}>잇기</button>
        </div>
      </section>
      <section className="ghub-info__sec">
        <h4 className="ghub__h4">PC 별 clone</h4>
        <table className="ghub-clones">
          <thead><tr><th>PC</th><th>경로</th><th>가지</th><th>상태</th><th>보고</th></tr></thead>
          <tbody>
            {repo.clones.map(c => (
              <tr key={`${c.host}-${c.path}`}>
                <td>{c.host}</td><td><code>{c.path}</code></td><td>{c.branch || '—'}</td>
                <td>{[c.ahead ? `↑${c.ahead}` : '', c.behind ? `↓${c.behind}` : '', c.dirty ? `미커밋 ${c.dirty}` : '',
                      c.paused ? '멈춤' : ''].filter(Boolean).join(' · ') || '맞음'}</td>
                <td>{ago(c.report_at)}</td>
              </tr>
            ))}
            {!repo.clones.length && <tr><td colSpan={5} className="ghub__muted">아직 어느 PC 에도 없습니다</td></tr>}
          </tbody>
        </table>
        <div className="ghub-form__row">
          <input className="ghub__input" placeholder="PC 이름 (예: hanbin-labmeet)" value={host} onChange={e => setHost(e.target.value)} />
          <input className="ghub__input" placeholder="받을 자리 (비우면 C:\dev\이름)" value={dest} onChange={e => setDest(e.target.value)} />
          <button type="button" className="ghub__btn" disabled={!host.trim()}
                  onClick={() => void act(() => code.cloneOn(repo.slug, host.trim(), dest.trim() || undefined),
                    `«${host.trim()}» 에 받기를 맡겼습니다 — 그 PC 의 다음 판 (5분 안) 에 받습니다`)}>이 PC 에 받기</button>
        </div>
      </section>
      <section className="ghub-info__sec ghub__muted">
        종류 {repo.kind} · 세운 이 {repo.created_by || '—'} · {ago(repo.created_at)} · 판 {repo.version}
      </section>
      {msg && <p className={msg.startsWith('🔴') ? 'ghub__err' : 'ghub__ok'}>{msg}</p>}
    </div>
  );
}
