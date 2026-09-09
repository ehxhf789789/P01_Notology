/**
 * dobbin이 거기 있다 — 살아 있는 사서 (CLAUDE.md 1-3의 정신)
 *
 * 사용자 지시 (2026-08-11):
 *   *"dobbin을 좀더 활동적인 AI로서, 도서관 사서 및 관리인으로써 애니메이션
 *     등으로 사용자를 적극적으로 돕도록 설계해줘."*
 *   *"서버로 접속했을 때도 인사말을 사라지는 말풍선으로 먼저 대화를 것도
 *     구현하는 등, 인간 친화적 AI로 설계해."*
 *
 * ## 🔴 살아 있음은 움직임이 아니라 **상태가 보이는 것**이다
 *
 * 그냥 흔들리는 아이콘은 장식이고, 두 번째부터는 거슬린다.
 * dobbin의 애니메이션은 전부 **지금 무슨 일이 일어나는지**를 말한다:
 *
 * | 상태 | 보이는 것 | 뜻 |
 * |---|---|---|
 * | `idle` | 느린 숨 (4초) | 듣고 있다 |
 * | `reading` | 책장이 넘어간다 | 자료를 읽는 중 |
 * | `thinking` | 점 세 개가 차례로 | 답을 만드는 중 |
 * | `found` | 한 번 튀어오름 | 찾았다 |
 * | `alert` | 붉은 맥박 | 지난 기한이 있다 |
 *
 * **상태가 없으면 애니메이션도 없다.** 조용할 때 조용한 것이 살아 있는 것에
 * 더 가깝다 — 늘 움직이는 것은 기계다.
 *
 * ## 🔴 인사는 한 번만, 그리고 스스로 사라진다
 *
 * 매번 인사하면 세 번째부터 닫는 버튼만 찾게 된다 (2-14-3의 질문 규율과
 * 같은 이유). 할 말이 있을 때만 뜨고, 8초 뒤 스스로 사라진다.
 *
 * ## 🔴 그림 파일을 쓰지 않는다
 *
 * 아티팩트 CSP와 같은 이유이자 더 실질적인 이유: 이 앱은 자기 완결이어야
 * 한다. dobbin은 **CSS 도형과 SVG 인라인**으로만 그린다 — 받아올 것이 없다.
 */

import { useEffect, useRef, useState } from 'react';
import { useDobbinStore, dobbinActions } from './dobbinStore';
import './presence.css';

// 🔴 `sorry` 를 여기에도 넣는다 — 표는 `PenguinFace` 가 갖고 이 파일이 그
//    표를 쓰는데, 두 union 이 어긋나 **사과 표정이 타입에서 막혀 있었다.**
export type Mood = 'idle' | 'reading' | 'thinking' | 'found' | 'alert' | 'sorry';

// 🔴 얼굴을 **펭귄**으로 바꿨다 (사용자, 2026-08-11). 상태가 곧 움직임이라는
//    규율은 그대로다 (2-14-2-2) — 장식용 움직임은 없다.
import { PenguinFace, faceOf } from './PenguinFace';
import './penguin.css';

const Face = PenguinFace;

export function DobbinPresence() {
  const busy = useDobbinStore((s) => s.busy);
  const open = useDobbinStore((s) => s.open);
  const [mood, setMood] = useState<Mood>('idle');
  // 바탕(ambient) — 서버가 잰 상태 (v6 ⓐ · 2층 시간축). found 는 여기로
  // «되돌아온다» — idle 로 떨어지면 기한이 있어도 alert 가 꺼진다 (실측 결함).
  const ambient = useRef<Mood>('idle');
  const [hello, setHello] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const shown = useRef(false);

  // 답을 만드는 동안은 생각한다. 끝나면 한 번 튀고 **바탕으로** 가라앉는다.
  // 🔴 «기권인데 폴짝»(상태 거짓말 ①)은 상위에서 온다: found 는 서버 정서
  //    (dobbin_mood=뿌듯)일 때만 — dobbinStore 가 lastMood 를 실어 주면 그걸
  //    본다. 없으면(옛 화면·오류) 튀지 않는 쪽이 정직하다.
  // 🔴 **표는 v7 에 만들어 두고 상시 얼굴에는 «뿌듯» 하나만 걸려 있었다**
  //    (2026-09-09 실측). 서버는 매 턴 7정서를 재서 `dobbin_mood` 로 보내고
  //    `faceOf` 가 그 표인데 여기서는 「뿌듯이면 폴짝」 한 줄만 썼다 —
  //    **미안(사과)·걱정(기한)이 얼굴에 닿지 못했다.** 홈 카드만 그 표를 썼다.
  //    2층 규율은 그대로다: 반응은 잠깐 보이고 **바탕으로 되돌아온다.**
  //    빈손·차분·안도는 `faceOf` 가 idle 로 주므로 **튀지 않는다** (정직).
  const lastMood = useDobbinStore((s: any) => s.lastMood ?? null);
  useEffect(() => {
    if (busy) { setMood('thinking'); return; }
    const react = faceOf(lastMood);            // 모르면 idle — 조용한 쪽
    setMood((m) => (m === 'thinking'
                    ? (react === 'idle' ? ambient.current : react) : m));
    const t = setTimeout(
      () => setMood((m) => (m === 'found' || m === 'sorry' || m === 'alert'
                            ? ambient.current : m)), 1400);
    return () => clearTimeout(t);
  }, [busy, lastMood]);

  // 🔴 접속했을 때 먼저 말을 건다. **할 말이 있을 때만.**
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    let dead = false;
    const t0 = setTimeout(() => {
      fetch('/api/briefing', { method: 'POST' })
        .then((r) => r.json())
        .then((j) => {
          if (dead) return;
          const line = (j?.say || '').split('\n')[0];
          // 서버가 잰 바탕 정서·인사를 그대로 쓴다 (v6 ⓐ — 화면이 다시
          // 재지 않는다). 🔴 옛 판은 j.overdue(접은 기한 포함 총계)로
          // alert 를 켰다 — 218일짜리가 매일 경보를 울리는 지어낸 걱정.
          const live = j?.overdue_live ?? 0;
          const greet = j?.greeting
            || (live ? `지난 기한 ${live}건이 있습니다` : line || null);
          if (j?.mood?.mood === '걱정' || live) {
            ambient.current = 'alert'; setMood('alert');
          }
          if (!greet) return;                  // 조용할 땐 조용히 있는다
          setHello(greet);
          setTimeout(() => setLeaving(true), 7000);
          setTimeout(() => { setHello(null); setLeaving(false); }, 8000);
        })
        .catch(() => {});
    }, 1400);                                  // 화면이 자리를 잡은 뒤에 말한다
    return () => { dead = true; clearTimeout(t0); };
  }, []);

  return (
    <button
      className={`dob-presence${open ? ' is-open' : ''} dob-presence--${mood}`}
      onClick={() => dobbinActions.toggle()}
      title="dobbin — 이 서재의 사서 (Ctrl+K)"
      aria-label="dobbin 열기"
    >
      <Face mood={mood} />
      <span className="dob-presence__name">dobbin</span>
      {hello && (
        <span className={`dob-bubble${leaving ? ' is-leaving' : ''}`}
              onClick={(e) => { e.stopPropagation(); setLeaving(true); }}>
          {hello}
        </span>
      )}
    </button>
  );
}
