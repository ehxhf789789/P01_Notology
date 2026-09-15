/**
 * AttachmentStore — frontend mirror of the backend AttachmentRef index.
 *
 * Single-surface principle (track_b_attachment_design.md §13):
 *   - The wikilink chip is the only user-facing attachment surface.
 *   - `.attachments/` folder is hidden in the file tree.
 *   - Wikilink resolver consults THIS store first to render chips with the
 *     correct color (resolved vs. unresolved) and to power the redesigned
 *     Attachments tab without `_att/` folder scanning.
 *
 * Lifecycle:
 *   - Hydrate on vault open via `attachment_list_all`.
 *   - Update incrementally on EventBus `attachment:saved` / `attachment:deleted`
 *     by re-fetching the same command (cheap — N small JSONs).
 *   - Clear on `vault:closed`.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { listen, type UnlistenFn } from '../../../web/event';
import { syncV2Commands, type AttachmentRefDto } from '../attachmentCommands';
import { EventBus } from '../../../core/infrastructure/eventBus';
import { useFileTreeStore } from '../../../core/stores/fileTreeStore';

interface AttachmentIndex {
  /** id → ref */
  byId: Map<string, AttachmentRefDto>;
  /** lowercased original_name → ids (collisions yield multiple) */
  byName: Map<string, string[]>;
  /** lowercased display path basename → ids */
  byDisplayBasename: Map<string, string[]>;
  /** 확장자를 뗀 이름 → id. 위키링크가 `[[파일명]]` 꼴이라 필요하다 */
  byStem: Map<string, string[]>;
  /** lowercased note_id → set of attachment ids linked to that note */
  byNoteId: Map<string, Set<string>>;
}

interface AttachmentState {
  index: AttachmentIndex;
  hydrated: boolean;
  hydratedAt: number;
  loading: boolean;
  error: string | null;

  /**
   * Lowercased file basenames currently in flight for `attachment_add`.
   * Used by WikiLink to paint a chip's amber "processing" state from the
   * moment of drop, instead of waiting for the AttachmentRef to land in the
   * store. Bridges the visual gap during sha256 + CAS write (~30 s for a
   * 600 MB file).
   */
  pendingNames: Set<string>;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;

  /** Mark a basename as being processed; safe to call repeatedly. */
  markPending: (fileName: string) => void;
  unmarkPending: (fileName: string) => void;
  isPending: (fileName: string) => boolean;

  /** Sync lookups (read-side hot path) */
  resolveByName: (fileName: string, noteId?: string) => AttachmentRefDto | null;
  listForNote: (noteId: string) => AttachmentRefDto[];
  all: () => AttachmentRefDto[];
  /**
   * Track B Phase B-3 PART 6 (HanBin 2026-05-13): "infinite-spinner" guard.
   * Returns true when the ref has no `syncEtag` yet AND its
   * attachment_id timestamp is older than STUCK_THRESHOLD_MS, which
   * indicates the chunked upload (or its retry budget) has likely been
   * exhausted. The chip then transitions from amber/uploading to a red
   * "stuck" state so the user can intervene instead of waiting forever.
   */
  isStuck: (attachmentId: string) => boolean;
}

function emptyIndex(): AttachmentIndex {
  return {
    byId: new Map(),
    byName: new Map(),
    byDisplayBasename: new Map(),
    // 🔴 **확장자 없는 위키링크를 위한 자리** (실측 2026-08-11).
    //    본문 링크는 `[[KICT-…-vFIN2]]` 인데 실제 파일은 `….pdf` 다.
    //    이름이 정확히 같아야만 찾으니 **첨부 링크를 눌러도 아무 일도
    //    안 났다** — 사용자가 세 번 신고한 그 증상이다.
    byStem: new Map(),
    byNoteId: new Map(),
  };
}

// 🔴 DTO에 없는 이름을 쓰고 있었다 (2026-08-11 실측).
//    `AttachmentRefDto` 는 `{id, note_id, filename, local_path}` 인데
//    이 함수는 `attachmentId`·`originalName`·`displayPath`·`linkedNotes` 를
//    읽었다. vite 빌드는 타입을 검사하지 않아(esbuild가 타입만 벗긴다)
//    조용히 통과했고, 실행할 때 `Cannot read properties of undefined
//    (reading 'toLowerCase')` 로 hydrate 가 통째로 죽었다.
//    → **DTO 하나를 진실로 삼는다.** 서버가 이미 그 모양으로 준다.
function refId(r: AttachmentRefDto): string { return r.id; }
function refName(r: AttachmentRefDto): string { return r.filename ?? ''; }
function refDisplay(r: AttachmentRefDto): string { return r.local_path ?? ''; }
function refNotes(r: AttachmentRefDto): string[] {
  return r.note_id ? [r.note_id] : [];
}

function buildIndex(refs: AttachmentRefDto[]): AttachmentIndex {
  const idx = emptyIndex();
  for (const r of refs) {
    idx.byId.set(refId(r), r);

    const nameKey = refName(r).toLowerCase();
    const nameList = idx.byName.get(nameKey) ?? [];
    nameList.push(refId(r));
    idx.byName.set(nameKey, nameList);

    // 확장자를 뗀 이름으로도 찾을 수 있게 한다
    const stem = nameKey.replace(/\.[^.]+$/, '');
    if (stem && stem !== nameKey) {
      const stemList = idx.byStem.get(stem) ?? [];
      stemList.push(refId(r));
      idx.byStem.set(stem, stemList);
    }

    const displayBase = refDisplay(r).split('/').pop()?.toLowerCase() ?? '';
    if (displayBase && displayBase !== nameKey) {
      const dispList = idx.byDisplayBasename.get(displayBase) ?? [];
      dispList.push(refId(r));
      idx.byDisplayBasename.set(displayBase, dispList);
    } else if (displayBase) {
      // Same as originalName — both maps point at the same list. Skip dup add.
    }

    for (const noteId of refNotes(r)) {
      const key = noteId.toLowerCase();
      const set = idx.byNoteId.get(key) ?? new Set();
      set.add(refId(r));
      idx.byNoteId.set(key, set);
    }
  }
  return idx;
}

export const useAttachmentStore = create<AttachmentState>()(
  subscribeWithSelector((set, get) => ({
    index: emptyIndex(),
    hydrated: false,
    hydratedAt: 0,
    loading: false,
    error: null,
    pendingNames: new Set<string>(),

    markPending(fileName) {
      const key = fileName.toLowerCase();
      set((s) => {
        if (s.pendingNames.has(key)) return s;
        const next = new Set(s.pendingNames);
        next.add(key);
        return { ...s, pendingNames: next };
      });
      // Persist with timestamp so other webviews (and the same webview after
      // close+reopen) can see it. Auto-expires after PENDING_TTL_MS.
      writePersistentPending(key, Date.now());
    },

    unmarkPending(fileName) {
      const key = fileName.toLowerCase();
      set((s) => {
        if (!s.pendingNames.has(key)) return s;
        const next = new Set(s.pendingNames);
        next.delete(key);
        return { ...s, pendingNames: next };
      });
      removePersistentPending(key);
    },

    isPending(fileName) {
      const key = fileName.toLowerCase();
      // In-memory first (this context's own drops).
      if (get().pendingNames.has(key)) return true;
      // Then the cross-context persistent map.
      return readPersistentPending(key);
    },

    async hydrate() {
      if (get().loading) return;
      set({ loading: true, error: null });
      try {
        const refs = await syncV2Commands.attachmentListAll();
        let h = 0;
        for (const r of refs as Array<{ id: string; syncEtag?: string;
                                        filename?: string }>) {
          const k = r.id + '|' + (r.syncEtag ?? '') + '|' + (r.filename ?? '');
          for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
        }
        const fp = refs.length + ':' + h;
        const changed = fp !== (get() as any)._indexFp;
        set({
          index: buildIndex(refs),
          hydrated: true,
          ...(changed ? { hydratedAt: Date.now() } : {}),
          loading: false,
          ...( { _indexFp: fp } as any),
        });
        console.log(`[attachmentStore] hydrated ${refs.length} refs`);
        maybeStartUploadPolling();
      } catch (err) {
        set({ loading: false, error: String(err) });
        console.error('[attachmentStore] hydrate failed:', err);
      }
    },

    // v32 P4-1b — 내용 지문: refs 가 실제로 바뀌었을 때만 hydratedAt 을
    //   올린다. 전에는 refresh 마다 올라 열린 편집기 전부가 10초마다
    //   ProseMirror 전면 재장식을 했다 (감사 — 최대 지속 버벅임).
    _indexFp: '',

    async refresh() {
      // refresh = hydrate without the early-return guard, used by event handlers.
      set({ loading: true, error: null });
      try {
        const refs = await syncV2Commands.attachmentListAll();
        let h = 0;
        for (const r of refs as Array<{ id: string; syncEtag?: string;
                                        filename?: string }>) {
          const k = r.id + '|' + (r.syncEtag ?? '') + '|' + (r.filename ?? '');
          for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
        }
        const fp = refs.length + ':' + h;
        const changed = fp !== (get() as any)._indexFp;
        set({
          index: buildIndex(refs),
          hydrated: true,
          ...(changed ? { hydratedAt: Date.now() } : {}),
          loading: false,
          ...( { _indexFp: fp } as any),
        });
        console.log(`[attachmentStore] refreshed → ${refs.length} refs`);
        maybeStartUploadPolling();
      } catch (err) {
        set({ loading: false, error: String(err) });
        console.warn('[attachmentStore] refresh failed:', err);
      }
    },

    clear() {
      set({ index: emptyIndex(), hydrated: false, hydratedAt: 0, error: null });
    },

    resolveByName(fileName, noteId) {
      const { index } = get();
      const key = fileName.toLowerCase();
      // Prefer name match; fall back to display basename (covers collision
      // suffixes like `Report_1.pdf` when a note body still has the original).
      // 이름 → 표시이름 → **확장자 없는 이름** 순으로 찾는다
      const ids = index.byName.get(key)
                ?? index.byDisplayBasename.get(key)
                ?? index.byStem.get(key)
                ?? index.byStem.get(key.replace(/\.[^.]+$/, ''));
      if (!ids || ids.length === 0) return null;
      if (ids.length === 1 || !noteId) {
        return index.byId.get(ids[0]) ?? null;
      }
      // Multiple candidates → prefer one linked to this note.
      const noteKey = noteId.toLowerCase();
      for (const id of ids) {
        const r = index.byId.get(id);
        if (r && refNotes(r).some((n) => n.toLowerCase() === noteKey)) {
          return r;
        }
      }
      return index.byId.get(ids[0]) ?? null;
    },

    listForNote(noteId) {
      const { index } = get();
      const ids = index.byNoteId.get(noteId.toLowerCase());
      if (!ids) return [];
      const out: AttachmentRefDto[] = [];
      for (const id of ids) {
        const r = index.byId.get(id);
        if (r) out.push(r);
      }
      return out;
    },

    all() {
      return Array.from(get().index.byId.values());
    },

    isStuck(attachmentId) {
      const r = get().index.byId.get(attachmentId);
      if (!r) return false;
      if (r.syncEtag) return false; // already synced, not stuck
      const createdMs = parseAttachmentIdMs(refId(r));
      if (createdMs === null) return false; // bad id format — refuse to flag
      return Date.now() - createdMs > STUCK_THRESHOLD_MS;
    },
  })),
);

/**
 * Parse the 14-digit timestamp embedded in an attachment_id (YYYYMMDDhhmmss
 * in UTC, sortable). Returns the ms epoch, or null if the format doesn't
 * match (covers migrated legacy ids, manual user edits, etc.).
 */
function parseAttachmentIdMs(id: string): number | null {
  const m = id.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, Y, M, D, h, mn, s] = m;
  const t = Date.UTC(+Y, +M - 1, +D, +h, +mn, +s);
  return Number.isFinite(t) ? t : null;
}

/** 15 minutes — see `isStuck` docstring for rationale. */
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Wire the store to the EventBus + Tauri events. Call once from app bootstrap.
 *
 * Multi-path subscription rationale: the `vault:opened` event is emitted from
 * specific user-interactive code paths (selectVault, etc.), but on a fresh app
 * start a vault may be restored from settings via a different code path that
 * sets `fileTreeStore.vaultPath` without going through that event. We also
 * subscribe to the vaultPath selector directly so the store hydrates regardless
 * of which code path activated the vault.
 *
 * Returns an unsubscribe function for test teardown.
 */
export function initAttachmentStoreSubscriptions(): () => void {
  const off1 = EventBus.on('vault:opened', () => {
    void useAttachmentStore.getState().hydrate();
    startAmbientPolling();
  });
  const off2 = EventBus.on('vault:closed', () => {
    useAttachmentStore.getState().clear();
    stopAmbientPolling();
    stopUploadPolling();
  });
  const off3 = EventBus.on('attachment:saved', () => {
    void useAttachmentStore.getState().refresh();
  });
  const off4 = EventBus.on('attachment:deleted', () => {
    void useAttachmentStore.getState().refresh();
  });

  // Catch the "vault already open at init time" race — fired during app boot
  // before our subscriptions land. Also catches HMR reloads where the vault is
  // already set in the store but `vault:opened` won't fire again.
  const initialVault = useFileTreeStore.getState().vaultPath;
  if (initialVault) {
    void useAttachmentStore.getState().hydrate();
    startAmbientPolling();
  }
  // Watch subsequent vaultPath changes — covers any bootstrap path that sets
  // the vault without going through the EventBus emit site.
  const off5 = useFileTreeStore.subscribe(
    (state) => state.vaultPath,
    (vault, prevVault) => {
      if (vault && vault !== prevVault) {
        void useAttachmentStore.getState().hydrate();
        startAmbientPolling();
      } else if (!vault && prevVault) {
        useAttachmentStore.getState().clear();
        stopAmbientPolling();
        stopUploadPolling();
      }
    },
  );

  // Track B Phase B-3 hotfix (2026-05-13): cross-webview Tauri events.
  // Backend `attachment_add` / `attachment_delete` commands emit the
  // canonical events; the frontend EventBus.emit in the wrapper is only
  // visible to the JS context that issued the invoke. Without these
  // listeners, a hover window that wasn't open during the drop never
  // hears about the new ref and renders its chip as gray indefinitely.
  let tauriOffSaved: UnlistenFn | null = null;
  let tauriOffDeleted: UnlistenFn | null = null;
  void (async () => {
    try {
      tauriOffSaved = await listen<AttachmentRefDto>('attachment:saved', () => {
        void useAttachmentStore.getState().refresh();
      });
      tauriOffDeleted = await listen<string>('attachment:deleted', () => {
        void useAttachmentStore.getState().refresh();
      });
    } catch (e) {
      console.warn('[attachmentStore] tauri event listen failed:', e);
    }
  })();

  return () => {
    off1();
    off2();
    off3();
    off4();
    off5();
    if (tauriOffSaved) tauriOffSaved();
    if (tauriOffDeleted) tauriOffDeleted();
  };
}

// Convenience selectors for components
export const useAttachmentResolver = () =>
  useAttachmentStore((s) => s.resolveByName);

export const useAttachmentList = () => useAttachmentStore((s) => s.all());

// ── Persistent pending map ─────────────────────────────────────────────────
// Survives a single webview's lifecycle (localStorage is shared across all
// Tauri windows of the same app origin) and auto-expires entries after
// PENDING_TTL_MS so a backend that died mid-`attachment_add` doesn't leave
// a chip spinning forever.
//
// Stored shape: `{ [basenameLowercase]: timestampMs }`.
const PENDING_KEY = 'notology.attachment.pending';
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 min — generous for slow sha on huge files

function readPendingMap(): Record<string, number> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PENDING_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingMap(map: Record<string, number>) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  } catch {}
}

function writePersistentPending(key: string, ts: number) {
  const map = readPendingMap();
  map[key] = ts;
  writePendingMap(map);
}

function removePersistentPending(key: string) {
  const map = readPendingMap();
  if (!(key in map)) return;
  delete map[key];
  writePendingMap(map);
}

function readPersistentPending(key: string): boolean {
  const map = readPendingMap();
  const ts = map[key];
  if (!ts) return false;
  if (Date.now() - ts > PENDING_TTL_MS) {
    // Clean up stale entry as a side-effect of the read.
    removePersistentPending(key);
    return false;
  }
  return true;
}

// ── Polling timers ─────────────────────────────────────────────────────────
//
// Two layers cover three failure modes:
//
//   1. Ambient polling (always on while vault is open, low frequency).
//      Catches the cases where neither the EventBus emit (frontend wrapper)
//      nor the Tauri global event (backend emit) reaches us — most often
//      because a hover window was reopened after the prior drop's JS
//      context died, and the Tauri listener registered too late to catch
//      the `attachment:saved` event. Without ambient polling those chips
//      stayed gray forever.
//
//   2. Upload-accelerator polling (3 s while any ref has `syncEtag === null`).
//      Tightens the `uploading` → `synced` transition during active push.
//      `push_worker` / `background_worker` don't have an `AppHandle` to
//      emit Tauri events from, so the frontend has to look at disk state
//      to notice the etag landing.
//
// Both timers stop on `vault:closed`. Cost while idle is ~0.1 req/s; the
// command is a cheap directory scan of `.notology/attachments/refs/`.
// v32 P4-1 — 🔴 상시 10s 폴이 2.81MB 를 시간당 1GB 씩 나르고, refresh 가
//   hydratedAt 을 올려 **열린 편집기 전면 재장식**을 10초마다 강제했다
//   (전수 감사 — 최대 지속 버벅임). 사건(dobbin:live vault-changed 계열)
//   구동 + 60s 안전벨트로 바꾼다. 업로드 중 3s 짧은 폴은 유지.
const AMBIENT_POLL_INTERVAL_MS = 60_000;
const UPLOAD_POLL_INTERVAL_MS = 3_000;
let ambientPollTimer: ReturnType<typeof setInterval> | null = null;
let uploadPollTimer: ReturnType<typeof setInterval> | null = null;

function hasUploadingRef(): boolean {
  for (const r of useAttachmentStore.getState().index.byId.values()) {
    if (!r.syncEtag) return true;
  }
  return false;
}

let liveHandler: ((e: Event) => void) | null = null;
let liveAperture = 0;

function startAmbientPolling() {
  if (ambientPollTimer !== null) return;
  ambientPollTimer = setInterval(() => {
    void useAttachmentStore.getState().refresh();
  }, AMBIENT_POLL_INTERVAL_MS);
  // v32 — 실시간은 사건이 끈다 (5s 조리개 — 소화 중 분당 ~10사건)
  if (!liveHandler) {
    liveHandler = (e: Event) => {
      const k = (e as CustomEvent).detail?.kind;
      if (k === 'vault-changed' || k === 'file-changed'
          || k === 'inbox-changed') {
        const now = Date.now();
        if (now - liveAperture > 5000) {
          liveAperture = now;
          void useAttachmentStore.getState().refresh();
        }
      }
    };
    window.addEventListener('dobbin:live', liveHandler);
  }
}

function stopAmbientPolling() {
  if (ambientPollTimer !== null) {
    clearInterval(ambientPollTimer);
    ambientPollTimer = null;
  }
  if (liveHandler) {
    window.removeEventListener('dobbin:live', liveHandler);
    liveHandler = null;
  }
}

function maybeStartUploadPolling() {
  if (uploadPollTimer !== null) return;
  if (!hasUploadingRef()) return;
  uploadPollTimer = setInterval(() => {
    if (!hasUploadingRef()) {
      if (uploadPollTimer !== null) {
        clearInterval(uploadPollTimer);
        uploadPollTimer = null;
      }
      return;
    }
    void useAttachmentStore.getState().refresh();
  }, UPLOAD_POLL_INTERVAL_MS);
}

function stopUploadPolling() {
  if (uploadPollTimer !== null) {
    clearInterval(uploadPollTimer);
    uploadPollTimer = null;
  }
}
