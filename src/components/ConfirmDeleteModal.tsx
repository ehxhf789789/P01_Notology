import { useEffect } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';

function ConfirmDeleteModal() {
  const confirmDeleteState = useModalStore(s => s.confirmDeleteState);
  const hideConfirmDelete = useModalStore(s => s.hideConfirmDelete);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideConfirmDelete();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hideConfirmDelete]);

  if (!confirmDeleteState || !confirmDeleteState.visible) return null;

  const { itemName, itemType, onConfirm, count } = confirmDeleteState;
  const isFolder = itemType === 'folder';
  const isFile = itemType === 'file';
  const isBatch = count && count > 1;

  const handleConfirm = () => {
    onConfirm();
    hideConfirmDelete();
  };

  const handleCancel = () => {
    hideConfirmDelete();
  };

  // Determine header text
  const getHeaderText = () => {
    if (isBatch) return '일괄 삭제';
    if (isFile) return '파일 삭제';
    if (isFolder) return '폴더 삭제';
    return '노트 삭제';
  };

  // Determine message text
  const getMessage = () => {
    if (isBatch) {
      return <><strong>{count}개의 파일</strong>을 삭제하시겠습니까?</>;
    }
    if (isFile) {
      return <><strong>"{itemName}"</strong> 파일을 삭제하시겠습니까?</>;
    }
    if (isFolder) {
      return <><strong>"{itemName}"</strong> 폴더를 삭제하시겠습니까?</>;
    }
    return <><strong>"{itemName}"</strong> 노트를 삭제하시겠습니까?</>;
  };

  // Determine warning text
  const getWarning = () => {
    if (isBatch || isFile) return '연결된 위키링크도 함께 제거됩니다.';
    if (isFolder) return '모든 하위 항목이 함께 삭제됩니다.';
    return '첨부 폴더도 함께 삭제됩니다.';
  };

  return (
    <div className="modal-overlay">
      <div className="confirm-delete-modal">
        <div className="confirm-delete-header">
          {getHeaderText()}
        </div>
        <div className="confirm-delete-body">
          <p className="confirm-delete-message">
            {getMessage()}
          </p>
          <p className="confirm-delete-warning">
            {getWarning()}
          </p>
        </div>
        <div className="confirm-delete-actions">
          <button className="confirm-delete-btn confirm-delete-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="confirm-delete-btn confirm-delete-confirm" onClick={handleConfirm}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
