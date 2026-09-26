/**
 * «개발 폴더 가져오기» — PC 마다 찾은 git 개발 폴더를 체크해서 개인 GitHub 로 가져온다 (v61 R2 · 2026-09-26).
 *
 * 한빈 09-26: *"hanbin-labmeet 저장소 켜줘 라는 매커니즘은 또 뭔가? … UI 에서도 대체 뭘 말하고 싶은건지 이해가 안된다."*
 * → 대화 명령으로만 만들어 둔 것이 잘못이었다. 서버의 같은 판정(`code_pc_folders` · `code_pc_adopt`)을 목록·체크·단추로.
 *   PC 의 파일·이력은 그대로이고, 그 PC 가 다음에 켜질 때 (매일 03:00 · 로그온 2분 뒤) 고른 폴더의 사본이 서버에 선다.
 *   🔴 서버가 누가 눌렀는지(승인된 쓰기 기기 · 서버 자신은 안 됨)를 대화와 같은 자로 확인한다.
 */
import { useCallback, useEffect, useState } from 'react';
import { code, ago, errText, type PcCard } from './codeClient';

const TONE: Record<string, string> = { 기다림: 'wait', '가져오는 중': 'busy', 가져옴: 'ok', 뺌: 'none', 물음: 'ask' };

function Card({ pc, onChanged }: { pc: PcCard; onChanged: () => void }) {
  const waiting = pc.folders.filter(f => f.state === '기다림');
  const [pick, setPick] = useState<Set<string>>(() => new Set(waiting.map(f => f.path)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(waiting.length > 0);
  const run = async (adopt: string[], skip: string[], revive: string[]) => {
    setBusy(true); setMsg(null);
    try {
      const r = await code.pcAdopt(pc.host, adopt, skip, revive);
      setMsg(r.say);
      onChanged();
    } catch (e) { setMsg(`🔴 ${errText(e)}`); } finally { setBusy(false); }
  };
  const count = (s: string) => pc.folders.filter(f => f.state === s).length;
  const toggle = (p: string) => setPick(prev => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const chosen = waiting.filter(f => pick.has(f.path)).map(f => f.path);
  return (
    <section className="ghub-pc" aria-label={`${pc.host} 개발 폴더`}>
      <button type="button" className="ghub-pc__head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <b>{pc.host}</b>
        <span className="ghub__muted">
          개발 폴더 {pc.folders.length} · 기다림 {count('기다림')} · 가져오는 중 {count('가져오는 중')} · 가져옴 {count('가져옴')}
          {count('뺌') ? ` · 뺌 ${count('뺌')}` : ''} · 마지막 연결 {ago(pc.last_seen)}
        </span>
      </button>
      {open && (
        <div className="ghub-pc__body">
          <p className="ghub__muted ghub-pc__say">{pc.say}</p>
          <ul className="ghub-pc__list">
            {pc.folders.map(f => (
              <li key={f.path} className="ghub-pc__row">
                {f.state === '기다림' ? (
                  <input type="checkbox" checked={pick.has(f.path)} onChange={() => toggle(f.path)} aria-label={`${f.name} 고르기`} />
                ) : <span className="ghub-pc__nobox" />}
                <div className="ghub-pc__what">
                  <b>{f.name}</b> <span className={`ghub-cell ghub-cell--${TONE[f.state] || 'none'}`}>{f.state}</span>
                  <div className="ghub__muted">{f.role_say}</div>
                  <div className="ghub__muted ghub-pc__path"><code>{f.path}</code></div>
                </div>
                {f.state === '뺌' && (
                  <button type="button" className="ghub__btn" disabled={busy} onClick={() => void run([], [], [f.path])}>되살리기</button>
                )}
              </li>
            ))}
          </ul>
          {(pc.other.external > 0 || pc.other.etc > 0) && (
            <p className="ghub__muted">남의 저장소 {pc.other.external} · 모음·기타 {pc.other.etc} 은 가져오지 않습니다.</p>
          )}
          {waiting.length > 0 && (
            <div className="ghub-pc__act">
              <button type="button" className="ghub__btn ghub__btn--primary" disabled={busy || !chosen.length}
                      onClick={() => void run(chosen, [], [])}>선택한 폴더 가져오기 ({chosen.length})</button>
              <button type="button" className="ghub__btn" disabled={busy || !chosen.length}
                      onClick={() => void run([], chosen, [])}>선택한 폴더 빼기</button>
            </div>
          )}
          {msg && <p className="ghub-pc__msg">{msg}</p>}
        </div>
      )}
    </section>
  );
}

export function PcAdopt({ onChanged }: { onChanged: () => void }) {
  const [cards, setCards] = useState<PcCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setCards(await code.pcFolders()); setErr(null); } catch (e) { setErr(errText(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (err) return <p className="ghub__err">{err}</p>;
  if (!cards || !cards.length) return null;
  return (
    <section className="ghub-pcs" aria-label="개발 폴더 가져오기">
      <h3 className="ghub-look__h">개발 폴더 가져오기 — PC 에서 찾은 git 개발 폴더</h3>
      {cards.map(pc => <Card key={pc.host} pc={pc} onChanged={() => { void load(); onChanged(); }} />)}
    </section>
  );
}
