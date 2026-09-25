/**
 * 차이 한 벌 — 커밋 · 비교 · (K4) 미커밋 사이에 **같은 부품**을 쓴다 (플랜 B5 ②).
 * 줄마다 옛/새 줄 번호 (hunk 머리에서 센다) · 더한 줄·뺀 줄 색.
 */
import { memo, useState } from 'react';
import type { Patch } from './codeClient';

type Row = { kind: 'hunk' | 'add' | 'del' | 'ctx' | 'meta'; old: number | null; neu: number | null; text: string };

function rows(patch: string): Row[] {
  const out: Row[] = [];
  let o = 0;
  let n = 0;
  for (const line of patch.split('\n')) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (m) {
      o = Number(m[1]);
      n = Number(m[2]);
      out.push({ kind: 'hunk', old: null, neu: null, text: line });
    } else if (line.startsWith('+++ ') || line.startsWith('--- ') || line.startsWith('index ')
      || line.startsWith('new file') || line.startsWith('deleted file') || line.startsWith('similarity')
      || line.startsWith('rename ') || line.startsWith('Binary files') || line.startsWith('\\ No newline')) {
      out.push({ kind: 'meta', old: null, neu: null, text: line });
    } else if (line.startsWith('+')) {
      out.push({ kind: 'add', old: null, neu: n++, text: line.slice(1) });
    } else if (line.startsWith('-')) {
      out.push({ kind: 'del', old: o++, neu: null, text: line.slice(1) });
    } else if (line !== '' || out.length) {
      out.push({ kind: 'ctx', old: o++, neu: n++, text: line.startsWith(' ') ? line.slice(1) : line });
    }
  }
  while (out.length && out[out.length - 1].kind === 'ctx' && out[out.length - 1].text === '') out.pop();
  return out;
}

export const DiffFile = memo(function DiffFile({ p, open: open0 = true }: { p: Patch; open?: boolean }) {
  const [open, setOpen] = useState(open0);
  const rs = rows(p.patch);
  const add = rs.filter(r => r.kind === 'add').length;
  const del = rs.filter(r => r.kind === 'del').length;
  return (
    <div className="cdiff">
      <button type="button" className="cdiff__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="cdiff__path">{p.path}</span>
        <span className="cdiff__stat"><span className="cdiff__plus">+{add}</span> <span className="cdiff__minus">−{del}</span></span>
      </button>
      {open && (
        <div className="cdiff__body" role="table">
          {rs.map((r, i) => (
            <div key={i} className={`cdiff__row cdiff__row--${r.kind}`} role="row">
              <span className="cdiff__ln">{r.old ?? ''}</span>
              <span className="cdiff__ln">{r.neu ?? ''}</span>
              <span className="cdiff__sign">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}</span>
              <code className="cdiff__text">{r.text}</code>
            </div>
          ))}
          {p.truncated && <div className="cdiff__row cdiff__row--meta">… 너무 길어 잘랐습니다</div>}
        </div>
      )}
    </div>
  );
});

export function DiffView({ patches, truncated }: { patches: Patch[]; truncated?: boolean }) {
  if (!patches.length) return <p className="ghub__muted">바뀐 것이 없습니다.</p>;
  return (
    <div className="cdiff-list">
      {patches.map((p, i) => <DiffFile key={`${p.path}-${i}`} p={p} open={patches.length <= 12} />)}
      {truncated && <p className="ghub__muted">차이가 너무 커서 앞부분만 보입니다 — PC 에서 여십시오.</p>}
    </div>
  );
}
