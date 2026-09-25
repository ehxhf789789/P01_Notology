/**
 * 활동 · 커밋 탭 (플랜 B5 ②) — 하루 단위 일지 (무엇이 언제 **어느 PC 에서**) · 커밋 목록 → 차이.
 */
import { useCallback, useEffect, useState } from 'react';
import { code, ago, errText, type ActivityResult, type ActivityItem, type CommitRow, type CommitResult } from './codeClient';
import { DiffView } from './DiffView';

const KIND: Record<string, string> = {
  push: '올림', merge: '서버가 합침', force: '되감음', publish: 'github.com 배포',
  'divergence-merged': '갈라짐 → 합침', 'divergence-conflict': '🔴 겹침', 'divergence-resolved': '겹침 풀림',
  'sync-adopt': '받아들임', 'sync-rewire': '원격을 허브로', 'sync-clone': '이 PC 에 받음',
  'sync-restore': '되돌림', 'sync-park': '대피', 'sync-ask': '여쭘',
  'publish-pushed': 'github.com 배포', 'publish-blocked': '🔴 배포 멈춤', 'publish-failed': '🔴 배포 실패',
  'publish-same': '배포 — 같음',
};

function line(it: ActivityItem): string {
  const what = KIND[it.kind] || it.kind;
  const ref = it.ref ? ` ${String(it.ref).replace('refs/heads/', '').replace('refs/tags/', '태그 ')}` : '';
  const subj = it.subject ? ` — ${it.subject}` : '';
  const files = it.files?.length ? ` (${it.files.slice(0, 3).join(', ')})` : '';
  const why = it.why ? ` — ${it.why}` : '';
  const det = it.detail && typeof it.detail.path === 'string' ? ` ${it.detail.path}` : '';
  return `${what}${ref}${subj}${files}${why}${det}`;
}

export function ActivityTab({ slug }: { slug: string }) {
  const [a, setA] = useState<ActivityResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    code.activity(slug, 60).then(r => { if (!dead) setA(r); }).catch(e => { if (!dead) setErr(errText(e)); });
    return () => { dead = true; };
  }, [slug]);
  if (err) return <p className="ghub__err">{err}</p>;
  if (!a) return <p className="ghub__muted">읽는 중…</p>;
  if (!a.days.length) return <p className="ghub__muted">최근 60일 동안 움직임이 없습니다.</p>;
  return (
    <div className="ghub-journal">
      {a.days.map(d => (
        <section key={d.date} className="ghub-journal__day">
          <h4 className="ghub-journal__date">{d.date}</h4>
          <ul className="ghub-journal__list">
            {d.items.map((it, i) => (
              <li key={i} className={`ghub-journal__it ghub-journal__it--${it.kind.split('-')[0]}`}>
                <span className="ghub-journal__time">{it.at.slice(11, 16)}</span>
                {it.host && <span className="ghub-chip ghub-chip--pc">{it.host}</span>}
                <span className="ghub-journal__txt">{line(it)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CommitView({ slug, sha, onBack }: { slug: string; sha: string; onBack: () => void }) {
  const [c, setC] = useState<CommitResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    code.commit(slug, sha).then(r => { if (!dead) setC(r); }).catch(e => { if (!dead) setErr(errText(e)); });
    return () => { dead = true; };
  }, [slug, sha]);
  return (
    <div className="ghub-commit">
      <button type="button" className="ghub__btn ghub__btn--ghost" onClick={onBack}>← 커밋 목록</button>
      {err && <p className="ghub__err">{err}</p>}
      {!c && !err && <p className="ghub__muted">읽는 중…</p>}
      {c && (
        <>
          <h3 className="ghub-commit__subj">{c.commit.subject}</h3>
          {c.commit.body && <pre className="ghub-commit__body">{c.commit.body}</pre>}
          <p className="ghub__muted">
            {c.commit.author} · {ago(c.commit.at)} · {c.commit.sha.slice(0, 10)}
            {c.commit.pushed && <> · <span className="ghub-chip ghub-chip--pc">{c.commit.pushed.host}</span>
              {c.commit.pushed.via === 'adopt' ? ' 받아들임' : c.commit.pushed.via === 'merge' ? ' 서버 합침' : ' 올림'}</>}
            {c.commit.parents.length > 1 && ' · 합침 커밋'}
          </p>
          <ul className="ghub-commit__files">
            {c.files.map(f => (
              <li key={f.path}><span className="cdiff__plus">+{f.add}</span> <span className="cdiff__minus">−{f.del}</span> {f.from ? `${f.from} → ` : ''}{f.path}</li>
            ))}
          </ul>
          <DiffView patches={c.patches} truncated={c.truncated} />
        </>
      )}
    </div>
  );
}

export function CommitsTab({ slug, branch }: { slug: string; branch: string }) {
  const [rows, setRows] = useState<CommitRow[]>([]);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async (skip: number) => {
    try {
      const r = await code.log(slug, branch, '', skip);
      setRows(prev => (skip ? [...prev, ...r.commits] : r.commits));
      setMore(r.more);
    } catch (e) {
      setErr(errText(e));
    }
  }, [slug, branch]);
  useEffect(() => { setRows([]); setOpen(null); void load(0); }, [load]);
  if (open) return <CommitView slug={slug} sha={open} onBack={() => setOpen(null)} />;
  if (!branch) return <p className="ghub__muted">가지가 없습니다.</p>;
  return (
    <div className="ghub-commits">
      {err && <p className="ghub__err">{err}</p>}
      <ul className="ghub-commits__list">
        {rows.map(c => (
          <li key={c.sha}>
            <button type="button" className="ghub-commits__row" onClick={() => setOpen(c.sha)}>
              <span className="ghub-commits__subj">{c.subject}</span>
              <span className="ghub-commits__meta">
                {c.pushed && <span className="ghub-chip ghub-chip--pc">{c.pushed.host}{c.pushed.via === 'adopt' ? ' · 받아들임' : ''}</span>}
                {c.author} · {ago(c.at)} · <code>{c.sha.slice(0, 7)}</code>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more && <button type="button" className="ghub__btn" onClick={() => void load(rows.length)}>더 보기</button>}
    </div>
  );
}
