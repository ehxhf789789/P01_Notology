import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { renameFile } from '../stores/appActions';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { t, tf } from '../utils/i18n';

function RenameDialog() {
  const renameDialogState = useModalStore(s => s.renameDialogState);
  const hideRenameDialog = useModalStore(s => s.hideRenameDialog);
  const language = useSettingsStore(s => s.language);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renameDialogState?.visible) {
      // Set initial name:
      // - Folders: show as-is (no extension)
      // - Notes (.md files): strip .md extension for display
      // - Attachments: show with extension
      const name = renameDialogState.currentName;
      if (renameDialogState.isFolder || renameDialogState.isAttachment) {
        setNewName(name);
      } else {
        // Note: strip .md extension for display
        setNewName(name.replace(/\.md$/, ''));
      }
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [renameDialogState]);

  if (!renameDialogState || !renameDialogState.visible) return null;

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      let finalName: string;
      if (renameDialogState.isFolder) {
        // For folders, use the name as-is (no extension)
        finalName = newName.trim();
      } else if (renameDialogState.isAttachment) {
        // For attachments, preserve the original extension
        const originalName = renameDialogState.currentName;
        const originalExt = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
        const inputName = newName.trim();

        // Check if user provided the extension
        if (originalExt && !inputName.endsWith(originalExt)) {
          // User didn't include extension or changed it - force the original extension
          const inputBaseName = inputName.includes('.') ? inputName.substring(0, inputName.lastIndexOf('.')) : inputName;
          finalName = `${inputBaseName}${originalExt}`;
        } else {
          finalName = inputName;
        }
      } else {
        // For notes, add .md extension
        finalName = `${newName.trim()}.md`;
      }
      await renameFile(renameDialogState.path, finalName);
      hideRenameDialog();
    } catch (e) {
      console.error('Failed to rename:', e);
      alert(tf('renameFailed', language, { error: String(e) }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      hideRenameDialog();
    }
  };

  return (
    <div className="rename-dialog-overlay" onClick={hideRenameDialog}>
      <div className="rename-dialog" onClick={e => e.stopPropagation()}>
        <div className="rename-dialog-title">{t('renameTitle', language)}</div>
        <input
          ref={inputRef}
          className="rename-dialog-input"
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="rename-dialog-actions">
          <button className="rename-dialog-btn cancel" onClick={hideRenameDialog}>{t('cancel', language)}</button>
          <button className="rename-dialog-btn confirm" onClick={handleRename}>{t('change', language)}</button>
        </div>
      </div>
    </div>
  );
}

export default RenameDialog;
