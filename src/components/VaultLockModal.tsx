import { useModalStore } from '../stores/zustand/modalStore';
import { forceOpenLockedVault } from '../stores/appActions';

function VaultLockModal() {
  const vaultLockModalState = useModalStore(s => s.vaultLockModalState);
  const hideVaultLockModal = useModalStore(s => s.hideVaultLockModal);

  if (!vaultLockModalState || !vaultLockModalState.visible) return null;

  const { holder, isStale, vaultPath } = vaultLockModalState;
  const vaultName = vaultPath.split(/[/\\]/).filter(Boolean).pop() || vaultPath;

  // Format the heartbeat time
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="modal-overlay" onClick={hideVaultLockModal}>
      <div className="modal-content vault-lock-modal" onClick={e => e.stopPropagation()}>
        <div className="vault-lock-modal-header">
          <span className="vault-lock-icon">🔒</span>
          <h2>보관소가 사용 중입니다</h2>
        </div>

        <div className="vault-lock-modal-body">
          <p className="vault-lock-message">
            <strong>{vaultName}</strong> 보관소가 다른 기기에서 사용 중입니다.
          </p>

          {holder && (
            <div className="vault-lock-info">
              <div className="vault-lock-info-row">
                <span className="vault-lock-info-label">기기:</span>
                <span className="vault-lock-info-value">{holder.hostname}</span>
              </div>
              <div className="vault-lock-info-row">
                <span className="vault-lock-info-label">마지막 활동:</span>
                <span className="vault-lock-info-value">{formatTime(holder.heartbeat)}</span>
              </div>
              <div className="vault-lock-info-row">
                <span className="vault-lock-info-label">잠금 시작:</span>
                <span className="vault-lock-info-value">{formatTime(holder.locked_at)}</span>
              </div>
            </div>
          )}

          {isStale ? (
            <p className="vault-lock-stale-warning">
              ⚠️ 이전 세션이 비정상 종료된 것으로 보입니다. 강제로 열 수 있습니다.
            </p>
          ) : (
            <p className="vault-lock-active-warning">
              동시에 여러 기기에서 보관소를 열면 데이터가 손상될 수 있습니다.
              다른 기기에서 Notology를 먼저 종료하세요.
            </p>
          )}
        </div>

        <div className="vault-lock-modal-footer">
          <button className="vault-lock-btn cancel" onClick={hideVaultLockModal}>
            취소
          </button>
          <button
            className={`vault-lock-btn force ${isStale ? 'recommended' : 'dangerous'}`}
            onClick={forceOpenLockedVault}
          >
            {isStale ? '열기' : '강제 열기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VaultLockModal;
