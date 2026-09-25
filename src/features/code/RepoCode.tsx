/**
 * 코드 탭 — 가지·태그·**각 PC 의 대피 끝**을 고르고, 폴더를 펼칠 때 읽는다 (플랜 B5 ②).
 * 파일은 창 안에서 (줄 번호 · 강조 · 256KB 넘으면 강조 없이 · 2MB 넘으면 내려받기만).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { Folder, FileText, ChevronRight, Download, GitCommit } from 'lucide-react';
import { getLanguageFromPath } from '../hover-windows/viewers/HoverCodeViewer';
import { code, codeFileUrl, ago, errText, type RepoDetail, type TreeResult, type BlobResult } from './codeClient';
import { Readme } from './Readme';

const IMG = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function FileView({ slug, sha, path }: { slug: string; sha: string; path: string }) {
  const [b, setB] = useState<BlobResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  useEffect(() => {
    let dead = false;
    setB(null); setErr(null);
    code.blob(slug, sha, path).then(r => { if (!dead) setB(r); }).catch(e => { if (!dead) setErr(errText(e)); });
    return () => { dead = true; };
  }, [slug, sha, path]);
  const html = useMemo(() => {
    if (!b?.text || b.text.length > 256 * 1024) return null;
    try {
      return hljs.highlight(b.text, { language: getLanguageFromPath(path) }).value;
    } catch {
      return null;
    }
  }, [b, path]);
  const dl = codeFileUrl(slug, sha, path, true);
  const isMd = /\.(md|markdown)$/i.test(path);
  return (
    <div className="ghub-file">
      <div className="ghub-file__bar">
        <span className="ghub-file__path">{path}</span>
        {b && <span className="ghub__muted">{b.size.toLocaleString()} 바이트</span>}
        {isMd && b?.text != null && (
          <button type="button" className="ghub__btn ghub__btn--ghost" onClick={() => setRaw(!raw)}>{raw ? '보기' : '원문'}</button>
        )}
        <a className="ghub__btn ghub__btn--ghost" href={dl} download><Download size={14} /> 내려받기</a>
      </div>
      {err && <p className="ghub__err">{err}</p>}
      {!b && !err && <p className="ghub__muted">읽는 중…</p>}
      {b?.too_big && <p className="ghub__muted">너무 큰 파일입니다 — 내려받아 여십시오.</p>}
      {b?.binary && (IMG.test(path)
        ? <img className="ghub-file__img" src={codeFileUrl(slug, sha, path)} alt={path} />
        : <p className="ghub__muted">바이너리 파일입니다 — 내려받아 여십시오.</p>)}
      {b?.text != null && isMd && !raw && <Readme text={b.text} />}
      {b?.text != null && (!isMd || raw) && (
        <div className="ghub-code">
          <div className="ghub-code__gutter" aria-hidden>
            {b.text.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          {html != null
            ? <pre className="ghub-code__pre"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
            : <pre className="ghub-code__pre"><code>{b.text}</code></pre>}
        </div>
      )}
    </div>
  );
}

export function RepoCode({ repo }: { repo: RepoDetail }) {
  const [ref, setRef] = useState(repo.default_branch);
  const [path, setPath] = useState('');
  const [file, setFile] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeResult | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setRef(repo.default_branch); setPath(''); setFile(null); }, [repo.slug, repo.default_branch]);
  const load = useCallback(async () => {
    if (!ref) return;
    setErr(null);
    try {
      const t = await code.tree(repo.slug, ref, path);
      setTree(t);
      if (t.readme) {
        const b = await code.blob(repo.slug, t.sha, t.readme);
        setReadme(b.text);
      } else {
        setReadme(null);
      }
    } catch (e) {
      setTree(null);
      setErr(errText(e));
    }
  }, [repo.slug, ref, path]);
  useEffect(() => { void load(); }, [load]);
  const crumbs = path ? path.split('/') : [];
  const refs = [
    ...repo.branches.map(b => ({ v: b.name || b.ref, label: `가지 ${b.name}` })),
    ...repo.tags.map(t => ({ v: t.ref, label: `태그 ${t.name}` })),
    ...repo.parks.map(p => ({ v: p.ref, label: `${p.host} 의 대피 끝 (${p.branch})` })),
    ...repo.wips.map(w => ({ v: w.ref, label: `${w.host} 의 지금 (${w.branch})` })),
  ];
  if (!repo.default_branch) return <p className="ghub__muted">빈 저장소입니다 — PC 에서 첫 커밋을 올리면 여기 보입니다.</p>;
  return (
    <div className="ghub-codetab">
      <div className="ghub-codetab__bar">
        <select className="ghub__select" value={ref} onChange={e => { setRef(e.target.value); setPath(''); setFile(null); }}
                aria-label="가지·태그">
          {refs.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
        <nav className="ghub-crumbs" aria-label="경로">
          <button type="button" className="ghub-crumbs__c" onClick={() => { setPath(''); setFile(null); }}>{repo.name}</button>
          {crumbs.map((c, i) => (
            <span key={i}>
              <ChevronRight size={12} />
              <button type="button" className="ghub-crumbs__c"
                      onClick={() => { setPath(crumbs.slice(0, i + 1).join('/')); setFile(null); }}>{c}</button>
            </span>
          ))}
        </nav>
      </div>
      {err && <p className="ghub__err">{err}</p>}
      {file && tree ? (
        <>
          <button type="button" className="ghub__btn ghub__btn--ghost" onClick={() => setFile(null)}>← {path || repo.name}</button>
          <FileView slug={repo.slug} sha={tree.sha} path={file} />
        </>
      ) : tree && (
        <>
          <table className="ghub-tree">
            <tbody>
              {tree.entries.map(e => (
                <tr key={e.name} className="ghub-tree__row"
                    onClick={() => (e.type === 'tree' ? setPath(path ? `${path}/${e.name}` : e.name)
                      : e.type === 'blob' ? setFile(path ? `${path}/${e.name}` : e.name) : undefined)}>
                  <td className="ghub-tree__name">
                    {e.type === 'tree' ? <Folder size={15} /> : <FileText size={15} />}
                    <span>{e.name}{e.type === 'commit' ? ' (submodule)' : ''}</span>
                  </td>
                  <td className="ghub-tree__msg" title={e.last?.subject || ''}>
                    {e.last && <><GitCommit size={12} /> {e.last.subject}</>}
                  </td>
                  <td className="ghub-tree__at">{e.last ? ago(e.last.at) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {readme != null && (
            <section className="ghub-readme-card">
              <h3 className="ghub-readme-card__h">{tree.readme}</h3>
              <Readme text={readme} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
