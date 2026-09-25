/**
 * 저장소 한 개 (플랜 B5 ②) — GitHub 의 같은 자리에 같은 것 + GitHub 에 없는 것 (PC · 과제 · 배포 정리).
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { code, ago, errText, type RepoDetail } from './codeClient';
import { RepoCode } from './RepoCode';
import { ActivityTab, CommitsTab } from './RepoHistory';
import { PublishTab, InfoTab } from './RepoManage';

type Tab = 'code' | 'activity' | 'commits' | 'outputs' | 'publish' | 'info';
const TABS: { k: Tab; label: string }[] = [
  { k: 'code', label: '코드' }, { k: 'activity', label: '활동' }, { k: 'commits', label: '커밋' },
  { k: 'outputs', label: '산출물' }, { k: 'publish', label: '배포' }, { k: 'info', label: '정보' },
];

export function RepoView({ slug, onBack, onChanged }: { slug: string; onBack: () => void; onChanged: () => void }) {
  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('code');
  const load = useCallback(async () => {
    try { setRepo(await code.repo(slug)); setErr(null); } catch (e) { setErr(errText(e)); }
  }, [slug]);
  useEffect(() => { setTab('code'); void load(); }, [load]);
  const changed = () => { void load(); onChanged(); };
  const open = repo ? repo.divergences.filter(d => d.state === 'conflict' && !d.resolved_at).length : 0;
  return (
    <div className="ghub-repo">
      <div className="ghub-repo__head">
        <button type="button" className="ghub__btn ghub__btn--ghost" onClick={onBack} aria-label="저장소 목록"><ArrowLeft size={16} /></button>
        <div className="ghub-repo__title">
          <h2>{repo?.name || slug}</h2>
          <p className="ghub__muted">{repo?.description}</p>
        </div>
        <div className="ghub-repo__chips">
          {repo?.projects.map(p => <span key={p.id} className="ghub-chip ghub-chip--proj">{p.label}</span>)}
          {repo && !repo.projects.length && <span className="ghub-chip ghub-chip--warn">과제 없음</span>}
          {open > 0 && <span className="ghub-chip ghub-chip--bad">겹침 {open}</span>}
        </div>
      </div>
      <nav className="ghub-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.k} type="button" role="tab" aria-selected={tab === t.k}
                  className={`ghub-tabs__t ${tab === t.k ? 'is-on' : ''}`} onClick={() => setTab(t.k)}>
            {t.label}{t.k === 'info' && open ? ` 🔴${open}` : ''}
          </button>
        ))}
      </nav>
      {err && <p className="ghub__err">{err}</p>}
      {repo && (
        <div className="ghub-repo__body">
          {tab === 'code' && <RepoCode repo={repo} />}
          {tab === 'activity' && <ActivityTab slug={slug} />}
          {tab === 'commits' && <CommitsTab slug={slug} branch={repo.default_branch} />}
          {tab === 'outputs' && (
            <p className="ghub__muted">
              이 저장소에서 나온 서재 자료와 PC 마다 git 이 무시하는 결과 파일 목록은 다음 판에서 보입니다
              (지금은 태그 {repo.tags.length} — 납품판). 마지막 판 {ago(repo.branches[0]?.at)}.
            </p>
          )}
          {tab === 'publish' && <PublishTab repo={repo} onChanged={changed} />}
          {tab === 'info' && <InfoTab repo={repo} onChanged={changed} />}
        </div>
      )}
    </div>
  );
}
