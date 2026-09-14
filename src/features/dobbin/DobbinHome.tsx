/**
 * dobbin 홈 — **관리자가 무대에 선다** (docs/UIUX_PLAN.md P0)
 *
 * 사용자 (2026-08-27): *"자료 넣기의 우측 패널 자체가 불편하다"* ·
 * *"dobbin 이 관리자임에도 notology 와 별개로 보조 기능같이 보인다"*.
 *
 * 실측된 원인은 폭이 아니라 **자리**였다 (UIUX_PLAN ②):
 *
 *     우측 패널 280px 고정 · 세 탭이 한 자리 배타 · 닫으면 언마운트
 *     중앙 분기는 검색/컨테이너/빈 화면 셋 — **dobbin 이 없다**
 *
 * 그래서 오늘 할 일(확인할 것·최근 받음)이 280px 에 갇히고 이미 읽은 노트가
 * 전체 폭을 썼다. 중요도와 면적이 반대였다.
 *
 * 🔴 **새 화면을 지어내지 않는다.** 검색이 중앙을 쓰는 그 자리에 같은 규격
 *    (`search-hero` 의 여백·구분선·토큰)으로 서고, 안에는 **이미 있는 부품**
 *    을 넓게 놓는다 — 자료 넣기는 `IntakePanel`, 대화는 `DobbinSurface`.
 *    두 벌로 만들면 어긋난다 (이 저장소가 여러 번 겪은 실수).
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Search as SearchIcon } from 'lucide-react';
import { PenguinFace, faceOf } from './PenguinFace';
import { BrainMap } from './BrainMap';
import { IntakePanel } from './IntakePanel';
import { ClusterReview } from './ClusterReview';
import { NoticeList } from './NoticeList';
import { useNotices, markAllSeen } from './noticeStore';
import { DobbinSurface } from './DobbinSurface';
import { uiActions } from '../../core/stores/uiStore';
import { rightActions, useDobbinView } from '../../core/stores/rightTabStore';
import { onLive } from '../../web/liveSync';
import './home.css';

/** 좁아지면 세로로 접는다. 🔴 미디어쿼리로는 못 잰다 — 이 영역의 폭은
 *  창이 아니라 **사이드바·우측 패널이 얼마나 먹었나**로 정해진다. */
function useNarrow<T extends HTMLElement>(px = 900) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < px));
    ro.observe(el);
    return () => ro.disconnect();
  }, [px]);
  return { ref, narrow };
}

/** /api/briefing 이 이미 보내는 전부 (memos.py:2468~) — v7 2단계에서야
 *  화면이 소비한다. 감사(2026-09-08): «j?.say 한 칸만 읽고 나머지를 버렸다». */
type Brief = {
  say?: string; greeting?: string;
  mood?: { mood?: string; cause?: string };
  choices?: { label: string; send: string }[];
  overdue_live?: number; today?: number; inbox?: number;
};

/** /api/brain (v7 2단계 신설) — 없으면(옛 서버) 카드가 조용히 빠진다. */
type Brain = {
  memory?: { main?: number; volatile?: number; faded?: number; dead?: number;
             insights?: string[] };
  tend?: { today?: { label: string; n: number }[]; last?: string;
           quiet?: string[] };
  bench?: { name: string; value: string }[];
  senses?: { name: string; ok: boolean; note?: string }[];
};

export function DobbinHome() {
  const { ref, narrow } = useNarrow<HTMLDivElement>();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const { list: notices } = useNotices();
  const report = notices;
  // 홈을 연 것이 곧 «봤다» — 좌측 배지는 그때 내려간다
  useEffect(() => {
    if (!notices.length) return;
    const t = setTimeout(() => {
      markAllSeen(notices);
      window.dispatchEvent(new CustomEvent('dobbin:notices-seen'));
    }, 900);
    return () => clearTimeout(t);
  }, [notices]);
  const dview = useDobbinView();
  const calOn = dview === 'cal';
  const findOn = dview === 'search';

  // 🔴 **브리핑도 창 열 때 한 번 읽고 굳었다** (한빈 2026-09-10: *"아니 이
  //    질문이 여전히 dobbin 상단 창에 있다니까?"*). 서버는 이미 고쳐서 단추를
  //    0개로 주는데 화면이 **열었을 때의 답을 붙들고** 있었다 — 뇌 지도에서
  //    고친 것과 **같은 결함**이 여기 그대로 있었다 (`useEffect(…, [])`).
  //    dobbin 이 일하면 브리핑도 바뀐다 — 그때 다시 읽는다.
  const pullRef = useRef<number>(0);
  useEffect(() => {
    let dead = false;
    const pull = () => {
      fetch('/api/briefing')
        .then(r => r.json())
        .then(j => { if (!dead && j) setBrief(j as Brief); })
        .catch(() => { /* 브리핑이 없으면 그 줄은 없다 — 빈 인사를 만들지 않는다 */ });
      fetch('/api/brain')
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (!dead && j) setBrain(j as Brain); })
        .catch(() => { /* 두뇌 계기판은 덤이다 — 옛 서버면 카드가 없다 */ });
    };
    pull();
    const off = onLive((ev: any) => {
      // 브리핑이 말하는 것들이 바뀌면 다시 읽는다
      // 🔴 `brainmap-changed` 를 뺐다 — 뇌 지도가 바뀐 것은 **브리핑과 무관**
      //    한데, 관문 한 판마다 3.5초짜리 `/api/briefing` 을 덩달아 읽었다.
      // v26 델타푸시 — inbox-changed 가 잔량 참값(pending)을 실어 오면
      //    재조회 없이 칩만 즉시 갱신한다 (사건→픽셀 <300ms 예산).
      if (ev?.kind === 'inbox-changed' && typeof ev.pending === 'number') {
        // v29 — 칩(inbox)만 갈고 문장을 얼려 두면 「투입구 3304」 칩과
        // 「2517건이 기다립니다」 문장이 한 화면에서 딴말을 한다 (한빈
        // 지적). 서버 문장의 그 수도 같은 델타로 갈아끼운다 — 자는 하나다.
        setBrief((prev: any) => (prev ? {
          ...prev, inbox: ev.pending,
          say: typeof prev.say === 'string'
            ? prev.say.replace(/투입구에 \d+건이 기다립니다/,
                               `투입구에 ${ev.pending}건이 기다립니다`)
            : prev.say,
        } : prev));
      }
      // 🔴 소화 중 inbox-changed 가 분당 ~10회 — 그때마다 브리핑을 다시
      //    읽으면 그물+렌더가 계속 돈다 (2026-09-13). 30초 조리개.
      if (['tended', 'memos-changed', 'inbox-changed',
           'initiate'].includes(ev?.kind)) {
        const now = Date.now();
        if (now - (pullRef.current || 0) > 30000) {
          pullRef.current = now;
          pull();
        }
      }
    });
    const beat = window.setInterval(pull, 60000);
    return () => {
      dead = true;
      window.clearInterval(beat);
      try { off?.(); } catch { /* 해제가 막혀도 화면은 산다 */ }
    };
  }, []);
  const say = (brief?.say || '').trim() || null;
  const badges: { k: string; n: number; tone: string }[] = [
    { k: '지난 기한', n: brief?.overdue_live ?? 0, tone: 'warn' },
    { k: '오늘·내일', n: brief?.today ?? 0, tone: 'info' },
    { k: '투입구', n: brief?.inbox ?? 0, tone: 'info' },
  ].filter(b => b.n > 0);

  return (
    <div ref={ref} className={`dhome${narrow ? ' is-narrow' : ''}`}>
      <header className="dhome__hero">
        {/* v7: idle 붙박이 → 브리핑의 바탕 정서 (걱정=alert · 반김=found …).
            cause 는 툴팁 — «왜 그 표정인가»의 근거 숫자가 서버에서 온다. */}
        <span className="dhome__icon" aria-hidden="true"
              title={brief?.mood?.cause || undefined}>
          <PenguinFace mood={faceOf(brief?.mood?.mood)} size={34} />
        </span>
        <div className="dhome__text">
          <h1 className="dhome__title">dobbin</h1>
          <p className="dhome__sub">{brief?.greeting || '이 서재를 관리합니다'}</p>
        </div>
        {/* 배지는 아래 상황판으로 내렸다 (C4 · 2026-09-11) — 흩어진
            브리핑 띠·질문칸·배지 세 덩이가 「상황판」 한 카드가 된다 */}
        {/* 🔴 두 자리를 오가는 길을 **각 화면에 하나씩** 둔다 (숨은 조작 금지).
            여기서는 «곁에 두기» — 노트를 보면서 흘끗 볼 때. */}
        {/* 🔴 닫기 단추를 두지 않는다 (2026-08-27 사용자) — 컨테이너를
            누르면 저절로 닫히고, 좌측 dobbin 단추가 토글이다. 오른쪽 위에
            단추를 놓으면 우측 탭(달력)을 가린다. */}
      </header>

      {/* 브리핑 — 할 말이 있을 때만 (2-10-1: 빈 인사는 하지 않는다).
          🔴 죽은 줄이었다: 잘려 보이는데 눌러도 아무 일이 없었다.
             누르면 펼친다 — 잘린 글을 보는 것이 사람이 원한 일이다. */}
      {/* 🔴 **93.75%가 숨어 있었다.** 서버가 보내는 say 는 네 줄 432자인데
          `white-space: nowrap` + ellipsis 로 **27자 한 줄**만 보였다. 그리고
          숨은 405자가 하필 «인격체» 대목이었다 — *"제가 한 일 중 미심쩍은
          것 — 제 판정 17건 중 6건은 다시 잴 수 없다…"*. 두 줄까지 펴 두고,
          누르면 전부 보인다. */}
      {/* ── 상황판 (C4 · 한빈 ③ «심플하고 이쁘게») ──
          브리핑 띠 + 질문칸 + 배지 3덩이 → 한 카드. 할 말도 배지도 질문도
          없으면 카드 자체가 없다 (2-10-1: 빈 인사는 하지 않는다). */}
      {(say || badges.length > 0 || !!brief?.choices?.length) && (
      <section className="dhome__board">
        {badges.length > 0 && (
          <div className="dhome__badges">
            {badges.map(b => (
              <span key={b.k} className={`dhome__badge is-${b.tone}`}>
                {b.k} <b>{b.n}</b>
              </span>
            ))}
          </div>
        )}
        {say && (
        <button className={`dhome__brief${briefOpen ? ' is-open' : ''}`}
                title={briefOpen ? '접기' : '전부 보기'}
                onClick={() => setBriefOpen(v => !v)}>
          {say}
        </button>
        )}
      {/* 🔴 **무엇을 묻는 단추인지 말한다** (한빈 2026-09-09: *"상단에 있는
          버튼 및 UI가 뭔가? 나보고 입력을 하라고 있는건가?"*). 전 판은 라벨만
          늘어놓아서 — 게다가 가운데가 잘려서 — 「맞다 · 수요 조사: 다음 주에
          양…」이 무엇에 «맞다» 인지 알 수 없었다. 묻는 말을 앞에 세우고, 누가
          묻는지(dobbin)를 밝히고, 라벨은 안 자른다. */}
      {!!brief?.choices?.length && (
        <div className="dhome__ask">
          <span className="dhome__ask-q">dobbin 이 묻습니다 — 한 번만 눌러 주십시오</span>
          <div className="dhome__brief-picks">
            {brief.choices.map(c => (
              <button key={c.label} className="dhome__brief-pick"
                      title={c.send || c.label}
                      onClick={() => window.dispatchEvent(
                        new CustomEvent('dobbin:ask', { detail: c.send || c.label }))}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      </section>
      )}

      <div className="dhome__body">
        {/* 🔴 **뇌가 무대다** (한빈 2026-09-09 선택). 전 판은 왼쪽 48%가
            알림·투입이고 대화가 20.6%, 묻는 자리가 **1.6%** 였다 — 가장 자주
            할 일이 가장 작은 자리에 있었다. 알림은 아래 서랍으로 내린다. */}
        <div className="dhome__stage">
          <BrainMap />
          {/* 계기판은 지도 아래 — 접었다 폈다 (기본 접힘: 첫 화면의 정보
              덩어리를 42개에서 줄이는 것이 이번 재설계의 과녁이다) */}
          {brain && (
            <details className="dhome__gauge">
              <summary>계기판 — 기억 · 오늘 일과 · 관문</summary>
              <div className="dbrain">
                {brain.memory && (
                  <div className="dbrain__col">
                    <h3>기억</h3>
                    <div className="dbrain__mem">
                      <span title="자주 꺼내 단단해진 기억">주기억 <b>{brain.memory.main ?? 0}</b></span>
                      <span title="쓰면 남고 안 쓰면 흐려지는 층">휘발성 <b>{brain.memory.volatile ?? 0}</b></span>
                      <span title="흐려져 잊힘 문턱 아래">망각 <b>{brain.memory.faded ?? 0}</b></span>
                    </div>
                    {!!brain.memory.insights?.length && (
                      <ul className="dbrain__list">
                        {brain.memory.insights.slice(0, 3).map((s, i) =>
                          <li key={i} title="잠(sleep) 회고가 근거 기억을 인용해 만든 통찰">{s}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                {brain.tend && (
                  <div className="dbrain__col">
                    <h3>오늘 일과{brain.tend.last ? ` · ${brain.tend.last}` : ''}</h3>
                    {brain.tend.today?.length ? (
                      <ul className="dbrain__list">
                        {brain.tend.today.slice(0, 6).map((t, i) =>
                          <li key={i}>{t.label} <b>{t.n}</b></li>)}
                      </ul>
                    ) : <p className="dbrain__quiet">오늘은 아직 한 일이 없습니다</p>}
                    {!!brain.tend.quiet?.length && (
                      <p className="dbrain__starve"
                         title="최근 40회차에 자국이 없는 걸음 — 할 일이 없었거나 자리를 못 받았다">
                        조용한 걸음 {brain.tend.quiet.length}개
                        {brain.tend.quiet.length <= 6 ? ` — ${brain.tend.quiet.join(' · ')}` : ''}
                      </p>
                    )}
                  </div>
                )}
                {!!brain.bench?.length && (
                  <div className="dbrain__col">
                    <h3>관문</h3>
                    <ul className="dbrain__list">
                      {brain.bench.map((b, i) => <li key={i}>{b.name} <b>{b.value}</b></li>)}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        <div className="dhome__chat">
          {/* 🔴 **여기가 dobbin 이다.** 전 판의 제목은 회색 12px 「대화」였고
              말풍선에는 얼굴도 이름도 없었다 — 화면 어디에도 «누가 말하는가»
              가 없으니 도구로 읽혔다. 얼굴과 이름을 말하는 자리에 붙인다. */}
          <div className="dhome__chat-head">
            <span className="dhome__chat-face" aria-hidden="true"
                  title={brief?.mood?.cause || undefined}>
              <PenguinFace mood={faceOf(brief?.mood?.mood)} size={22} />
            </span>
            <span className="dhome__chat-title">dobbin</span>
            <button className={`dhome__chat-btn${calOn ? ' is-on' : ''}`}
                    title="날짜로 대화 찾기"
                    onClick={() => rightActions.view('cal')}>
              <CalendarDays size={15} />
            </button>
            <button className={`dhome__chat-btn${findOn ? ' is-on' : ''}`}
                    title="대화 검색"
                    onClick={() => rightActions.view('search')}>
              <SearchIcon size={15} />
            </button>
          </div>
          <DobbinSurface />
        </div>
      </div>

      {/* 🔴 **서랍** — 알림·검수·받은 자료. 전 판은 이 셋이 첫 화면의 48%를
          먹었고(알림만 33%), 그 33%가 ✓/? 시스템 아이콘이라 창 전체가
          로그처럼 보였다. 볼 수는 있되 무대를 뺏지 않는다. */}
      <details className="dhome__drawer" open={false}>
        <summary>
          받은 것과 알림
          {report.length > 0 && <b className="dhome__drawer-n">{report.length}</b>}
        </summary>
        <div className="dhome__drawer-body">
          {report.length > 0 && (
            <section className="dhome__report">
              <h2 className="dhome__h2">알림</h2>
              <NoticeList list={report} />
            </section>
          )}
          <ClusterReview />
          <IntakePanel variant="home" />
        </div>
      </details>
    </div>
  );
}

export default DobbinHome;
