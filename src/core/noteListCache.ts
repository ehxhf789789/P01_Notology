// v29-B — 노트 목록 공유 캐시 (stale-while-revalidate · in-flight 공유)
//
// 병명 (한빈: «컨테이너를 클릭하면 노트 렌더링이 늦음»):
//   ① <Search> 가 리마운트될 때마다(DobbinHome↔컨테이너 등) 전 서고
//      2,500노트 1.37MB 를 새로 받는 동안 표가 «결과 없음»으로 섰다.
//   ② 같은 payload 를 Search 와 noteTypeCacheStore 가 **각자** 받았다.
//
// 처방: 모듈 수명 캐시 — 리마운트에도 산다. 있으면 그 판을 즉시 주고,
//   낡았으면 배경에서 다시 받는다 (서버의 conversation.recent 와 같은 꼴).
//   같은 열쇠의 fetch 는 한 비행만 뜬다. 무효화는 refreshStore 의
//   incrementSearchRefresh(노트 생성·삭제·이동의 중앙 관문)가 부른다.
import { searchCommands } from './services/tauriCommands';
import { asAuto } from '../web/core';
import type { NoteFilter, NoteMetadata } from './types';

type Entry = { at: number; notes: NoteMetadata[] };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<NoteMetadata[]>>();
let gen = 0;                       // 무효화 세대 — 낡은 비행의 결과를 버린다

const BELT_MS = 30_000;            // 무효화가 새는 경우의 안전벨트

const keyOf = (f: NoteFilter | undefined) => JSON.stringify(f ?? {});

/** 노트가 생기고·지워지고·옮겨졌다 — 다음 읽기가 다시 받게 한다.
 *  🔴 판을 지우지 않고 «낡음»으로만 표시한다 — 지우면 다음 리마운트가
 *  도로 «결과 없음» 플래시를 문다. 낡은 판 즉답 + 배경 재검증이 답. */
export function invalidateNoteList(): void {
  gen++;
  cache.forEach((e) => { e.at = 0; });
}

/** 지금 손에 있는 판 (없으면 null) — 마운트 직후 첫 페인트용. */
export function cachedNoteList(filter?: NoteFilter): NoteMetadata[] | null {
  const e = cache.get(keyOf(filter));
  return e ? e.notes : null;
}

/** 목록을 얻는다 — 캐시가 있으면 즉시 그 판, 낡았으면 배경 재검증. */
export function getNoteList(filter?: NoteFilter): Promise<NoteMetadata[]> {
  const key = keyOf(filter);
  const hit = cache.get(key);
  if (hit) {
    if (Date.now() - hit.at > BELT_MS) void revalidate(key, filter);
    return Promise.resolve(hit.notes);
  }
  return revalidate(key, filter);
}

/** 강제로 새 판을 기다린다 — 방금 무효화한 직후의 소비자용. */
export function freshNoteList(filter?: NoteFilter): Promise<NoteMetadata[]> {
  return revalidate(keyOf(filter), filter);
}

function revalidate(key: string, filter?: NoteFilter): Promise<NoteMetadata[]> {
  const inf = inflight.get(key);
  if (inf) return inf;
  const myGen = gen;
  // v32 — 캐시 재검증은 자동 갱신이다 (첫 채움 포함 — 목록 fetch 자체가
  // 사람의 «행동»은 아니고, 사람 행동은 대화·클릭·검색이 따로 센다)
  const p = asAuto(() => searchCommands.queryNotes(filter ?? {}))
    .then((notes) => {
      if (gen === myGen) cache.set(key, { at: Date.now(), notes });
      return notes;
    })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
}
