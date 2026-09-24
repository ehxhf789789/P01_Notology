/** 첨부 명령 — 🔴 `sync_v2`에서 갈라 나왔다
 *
 * ## 왜 갈랐나 (2026-08-11)
 *
 * `sync_v2`라는 이름 아래 **성격이 다른 둘**이 섞여 있었다:
 *
 *   WebDAV 동기화     `syncV2Commands` · 연결 화면 · 충돌 해소 · 보관함 복구
 *   첨부 생명주기      `attachmentStore` · 삭제 · 고아 정리 · 꺼내기
 *
 * 앞것은 **로컬 앱 전용**이다 — web notology는 서버가 NAS를 직접 들고 있어
 * 어긋날 두 벌이 없다. 뒷것은 **위키링크 칩과 첨부 탭의 본체**이고
 * `invoke`/`webdav` 호출이 0회다. 웹에서도 그대로 필요하다.
 *
 * 이름 하나 때문에 지울 뻔했다. **묶여 있다고 같은 것이 아니다.**
 */
import { invoke } from '../../web/core';
import { EventBus } from '../../core/infrastructure/eventBus';

export interface AttachmentRefDto {
  id: string;
  note_id: string;
  filename: string;
  mime?: string;
  size?: number;
  local_path?: string;
  // 🔴 서버(`vault_api.attachment_list`)가 실제로 주는 이름들 — 첨부 탭이 이 이름으로
  //    읽는데 선언이 없어 타입 오류로만 남아 있었다.
  attachmentId: string;
  originalName: string;
  displayPath: string;
  linkedNotes: string[];
  syncEtag?: string;
  sizeBytes: number;
  /** 자료 **자신의** 날짜 (doc_date) — 탐색기의 «만든 날» 이 아니다 */
  createdAt?: string;
  /** v61 B4 — 보낸 쪽이 알려 준 원래 **만든** 시각 (탐색기처럼 · 모르면 없다) */
  fileCreatedAt?: string;
  /** v61 B4 — 보낸 쪽이 알려 준 원래 **수정한** 시각 */
  fileModifiedAt?: string;
}

export const attachmentCommands = {
  listAll: () => invoke<AttachmentRefDto[]>('attachment_list_all'),

  localPath: (attachmentId: string) =>
    invoke<string>('attachment_local_path', { attachmentId }),

  /** 위키링크를 지웠을 때 — 다른 노트가 아직 쓰면 링크만 끊고, 아니면 지운다. */
  unlinkOrDelete: async (attachmentId: string, noteId: string): Promise<boolean> => {
    const deleted = await invoke<boolean>('attachment_unlink_or_delete',
                                          { attachmentId, noteId });
    EventBus.emit(deleted ? 'attachment:deleted' : 'attachment:saved',
                  { path: attachmentId });
    return deleted;
  },
};

/** 휴지통의 한 줄 — 서버 장부(custody_log)의 «지우기» 가 말하는 것 (v61 N1 ③).
 *  `note_id` 는 장부 줄 번호(글자)다 — TrashPanel 이 열쇠로 쓴다. */
export interface TrashEntryDto {
  note_id: string;
  id: number;
  original_path: string;
  deleted_at: string;
  trash_filename: string;
  actor: string | null;          // human · instructed · dobbin · probe
  reason: string | null;         // 삭제 심사의 까닭 (human_request · orphan_link …)
  reason_says: string | null;    // 그 까닭을 사람 말로
  why: string | null;
  run_id: string | null;
  present: boolean;              // 휴지통에 지금도 있나 (없으면 되살릴 수 없다)
}

/** 서가 첨부를 뗀다 — 서버 `delete_attachments_with_links{paths}` (v61 · 09-25).
 *  휴지통으로 옮기고(되돌림 한 번) 노트 링크를 함께 떼며 창고(00_pool)는 안 건드린다.
 *  🔴 `doc:{id}` 는 **서가에 걸린 파일이 없는** 창고 자료라 뗄 것이 없다 — 보내지 않는다.
 *  돌려주는 것: [뗀 수, 뗀 링크 수, 고친 노트들] · 건너뛴 `doc:` 수. */
export async function detachShelfAttachments(
  paths: string[],
): Promise<{ deleted: number; links: number; notes: string[]; skipped: number }> {
  const real = paths.filter((p) => p && !p.startsWith('doc:'));
  const skipped = paths.length - real.length;
  if (real.length === 0) return { deleted: 0, links: 0, notes: [], skipped };
  const [deleted, links, notes] = await invoke<[number, number, string[]]>(
    'delete_attachments_with_links', { paths: real });
  EventBus.emit('attachment:deleted', { path: real[0] });
  return { deleted, links, notes: notes ?? [], skipped };
}

/** 옛 이름으로 부르던 곳을 위해 남긴다 (호출부 20여 곳) */
export const syncV2Commands = {
  /** 🔴 v61 N1 ③ — 보고 · 되살리기만. **영구 삭제 문은 없다** (서버에도 없다). */
  listTrash: () => invoke<TrashEntryDto[]>('trash_list', { limit: 500 }),
  restoreFromTrash: (id: string) =>
    invoke<{ ok: boolean; path: string }>('move_from_trash', { id }),
  attachmentListAll: attachmentCommands.listAll,
  /** 노트 id → 보관함 경로. 첨부 탭과 그래프가 노트를 짚는 데 쓴다. */
  noteIdIndex: () => invoke<Record<string, string>>('note_id_index'),
  attachmentLocalPath: attachmentCommands.localPath,
  attachmentUnlinkOrDelete: attachmentCommands.unlinkOrDelete,
};
