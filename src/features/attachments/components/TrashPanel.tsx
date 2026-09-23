/**
 * Trash panel — 지운 것을 **보고 되살린다**. 영구 삭제 문은 없다.
 *
 * 🔴 v61 N1 ③ (2026-09-24, web) — 서버의 삭제 심사 뒤로 **모든 지우기는 휴지통
 * 이동**이고 장부(custody_log)에 까닭과 함께 남는다. 이 창은 그 장부를 그대로
 * 보여 준다 (`trash_list`) · 한 줄을 되살린다 (`move_from_trash`).
 *
 *   • 옛 판(데스크톱 5.0.6q)은 `sync_v2_*` 명령을 불렀는데 웹 서버에 그 명령이
 *     없었다 — 열 단추도 없어 죽은 코드였다.
 *   • «영구 삭제»·«만료 비우기» 단추를 걷었다. 서버에도 그 문이 없다 —
 *     되돌릴 수 있어야 지울 권한을 준다 (삭제 심사의 전제).
 *   • 두 갈래로 나눈다: 내가 지운 것 · dobbin 이 치운 것 (까닭과 함께).
 *   • 옛 자리에 무엇이 이미 있으면 서버가 **덮지 않고 거절**한다 — 까닭을 그대로 띄운다.
 *   • 사람이 되살린 자리는 dobbin 의 까닭으로 다시 치우지 않는다 (서버 `delreview`).
 */
import { useTrashStore, trashActions } from '../stores/trashStore';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { syncV2Commands, type TrashEntryDto } from '../attachmentCommands';
import { showToast } from '../../shared/Toast';
import { useLanguage } from '../../../core/stores/settingsStore';
import { t, tf } from '../../../core/utils/i18n';
import { Button } from '../../../design-system/components';

type Tab = 'mine' | 'dobbin';

/** 보관함 접두(`library:`)를 떼고 슬래시를 고른다 — 사람이 읽는 자리 */
function displayPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^[a-z]+:/, '');
}

/** 사람의 손이 지운 것 — 앱에서 지움(human) · 말로 확인한 지시(instructed) */
function byPerson(e: TrashEntryDto): boolean {
  return e.actor === 'human' || e.actor === 'instructed';
}

/** `.notology/` 아래는 보관함의 설정·틀이다 — 기본으로 가리고 단추로 보인다 (옛 판과 같다) */
function isUserVisible(originalPath: string): boolean {
  const normalized = displayPath(originalPath);
  return !(normalized.startsWith('.notology/') || normalized.includes('/.notology/'));
}

export function TrashPanel() {
  const language = useLanguage();
  const open = useTrashStore(s => s.open);
  const [entries, setEntries] = useState<TrashEntryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // note_id being acted on
  const [tab, setTab] = useState<Tab | null>(null);
  const [showSystem, setShowSystem] = useState(false);

  const close = useCallback(() => {
    trashActions.close();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await syncV2Commands.listTrash();
      setEntries(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[TrashPanel] list failed:', e);
      showToast({ type: 'error', title: t('trashTitle', language), description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, close]);

  if (!open) return null;

  const systemEntries = entries.filter(e => !isUserVisible(e.original_path));
  const shown = showSystem ? entries : entries.filter(e => isUserVisible(e.original_path));
  const mine = shown.filter(byPerson);
  const theirs = shown.filter(e => !byPerson(e));
  // 처음 열 때는 사람이 지운 것이 있으면 그쪽, 없으면 dobbin 쪽
  const active: Tab = tab ?? (mine.length > 0 ? 'mine' : 'dobbin');
  const visible = active === 'mine' ? mine : theirs;

  const handleRestore = async (entry: TrashEntryDto) => {
    if (busy || !entry.present) return;
    setBusy(entry.note_id);
    try {
      await syncV2Commands.restoreFromTrash(entry.note_id);
      showToast({
        type: 'success',
        title: t('trashRestoreDone', language),
        description: displayPath(entry.original_path),
      });
      await refresh();
    } catch (e: any) {
      showToast({ type: 'error', title: t('trashRestoreFailed', language), description: String(e?.message ?? e) });
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div className="nas-browser-overlay" onClick={close}>
      <div
        className="nas-browser-modal trash-panel-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="nas-browser-header">
          <div className="nas-browser-title trash-panel-title">
            <Trash2 size={15} />
            <span>{t('trashTitle', language)}</span>
            <span className="trash-panel-title__meta">
              {tf('trashItemsNoPurge', language, { count: String(entries.length) })}
            </span>
          </div>
          <button
            className="nas-browser-close"
            onClick={close}
            aria-label={t('close', language)}
            title={t('close', language)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="trash-panel-toolbar" role="tablist">
          <Button
            variant={active === 'mine' ? 'primary' : 'secondary'}
            size="sm"
            role="tab"
            aria-selected={active === 'mine'}
            onClick={() => setTab('mine')}
          >
            {tf('trashByMe', language, { count: String(mine.length) })}
          </Button>
          <Button
            variant={active === 'dobbin' ? 'primary' : 'secondary'}
            size="sm"
            role="tab"
            aria-selected={active === 'dobbin'}
            onClick={() => setTab('dobbin')}
          >
            {tf('trashByDobbin', language, { count: String(theirs.length) })}
          </Button>
          <div className="trash-panel-toolbar__spacer" />
          {systemEntries.length > 0 && (
            <label
              className="trash-panel-system-toggle"
              title={t('trashShowSystemTooltip', language)}
            >
              <input
                type="checkbox"
                checked={showSystem}
                onChange={e => setShowSystem(e.target.checked)}
              />
              <span>
                {tf('trashShowSystem', language, { count: String(systemEntries.length) })}
              </span>
            </label>
          )}
        </div>

        <div className="trash-panel-list">
          {loading ? (
            <div className="trash-panel-empty">{t('trashLoading', language)}</div>
          ) : visible.length === 0 ? (
            <div className="trash-panel-empty">{t('trashEmpty', language)}</div>
          ) : (
            visible.map(e => (
              <div key={e.note_id} className="trash-panel-entry" data-trash-id={e.note_id}>
                <div className="trash-panel-entry__body">
                  <div
                    className="trash-panel-entry__path-row"
                    title={displayPath(e.original_path)}
                  >
                    <span className="trash-panel-entry__path">
                      {displayPath(e.original_path)}
                    </span>
                    {!isUserVisible(e.original_path) && (
                      <span
                        className="trash-panel-entry__system-badge"
                        title={t('trashSystemBadgeTooltip', language)}
                      >
                        {t('trashSystemBadge', language)}
                      </span>
                    )}
                  </div>
                  <div className="trash-panel-entry__meta">
                    <span>
                      {t('trashDeletedAt', language)}: {e.deleted_at ? new Date(e.deleted_at).toLocaleString() : '—'}
                    </span>
                    {e.reason_says && (
                      <span title={e.why ?? undefined}>
                        {t('trashWhy', language)}: {e.reason_says}
                      </span>
                    )}
                    {!e.present && (
                      <span className="trash-panel-entry__meta--expiring">
                        {t('trashGone', language)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCcw size={12} />}
                  onClick={() => handleRestore(e)}
                  disabled={busy !== null || !e.present}
                  loading={busy === e.note_id}
                  title={e.present ? t('trashRestoreTooltip', language) : t('trashGone', language)}
                >
                  {t('trashRestore', language)}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
