import { FolderOpen, FolderPlus, Trash2, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVaultPath } from '../stores/zustand/fileTreeStore';
import { useRecentVaults } from '../stores/zustand/vaultConfigStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { openVault, removeVault } from '../stores/appActions';
import logoWhite from '../assets/logo-white.png';
import logoBlack from '../assets/logo-black.png';

interface VaultSelectorProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

function VaultSelector({ onClose, showCloseButton = false }: VaultSelectorProps) {
  const vaultPath = useVaultPath();
  const recentVaults = useRecentVaults();
  const theme = useSettingsStore(s => s.theme);

  // Determine effective theme (considering system preference)
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  const effectiveTheme = getEffectiveTheme();
  const logo = effectiveTheme === 'light' ? logoBlack : logoWhite;

  return (
    <div className="vault-selector-overlay">
      <div className="vault-selector-container">
        {showCloseButton && onClose && (
          <button className="vault-selector-close-btn" onClick={onClose} title="닫기">
            <X size={20} />
          </button>
        )}
        <div className="vault-selector-header">
          <img src={logo} alt="Notology" className="vault-selector-logo" />
          <div className="vault-selector-title-row">
            <h1 className="vault-selector-title">Notology</h1>
            <span className="vault-selector-version">v1.0.4</span>
          </div>
          <p className="vault-selector-subtitle">보관함을 선택하여 시작하세요</p>
        </div>

        <div className="vault-selector-body">
          {recentVaults.length > 0 && (
            <div className="vault-selector-recent">
              <h3 className="vault-selector-recent-title">보관함 목록</h3>
              <div className="vault-selector-recent-list">
                {recentVaults.map((vault) => {
                  const isCurrentVault = vaultPath === vault.path;
                  return (
                    <div key={vault.path} className={`vault-selector-recent-item-wrapper${isCurrentVault ? ' current' : ''}`}>
                      <button
                        className={`vault-selector-recent-item${isCurrentVault ? ' current' : ''}`}
                        onClick={() => !isCurrentVault && openVault(vault.path)}
                        disabled={isCurrentVault}
                      >
                        <FolderOpen className="vault-selector-recent-icon" size={20} />
                        <div className="vault-selector-recent-text">
                          <div className="vault-selector-recent-name">
                            {vault.name}
                            {isCurrentVault && <span className="vault-selector-current-badge">현재</span>}
                          </div>
                          <div className="vault-selector-recent-path">{vault.path}</div>
                        </div>
                      </button>
                      {!isCurrentVault && (
                        <button
                          className="vault-selector-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeVault(vault.path);
                          }}
                          title="목록에서 제거"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="vault-selector-btn vault-selector-btn-primary" onClick={() => openVault()}>
            <FolderOpen className="vault-selector-icon" size={24} />
            <div className="vault-selector-btn-text">
              <div className="vault-selector-btn-title">보관함 열기</div>
              <div className="vault-selector-btn-desc">기존 Notology 보관함을 엽니다</div>
            </div>
          </button>

          <button className="vault-selector-btn vault-selector-btn-secondary" onClick={() => openVault()}>
            <FolderPlus className="vault-selector-icon" size={24} />
            <div className="vault-selector-btn-text">
              <div className="vault-selector-btn-title">보관함 추가</div>
              <div className="vault-selector-btn-desc">선택한 폴더에 새 보관함을 생성합니다</div>
            </div>
          </button>
        </div>

        <div className="vault-selector-footer">
          <p className="vault-selector-hint">
            보관함은 노트와 파일을 저장할 폴더입니다
          </p>
          {!showCloseButton && (
            <button
              className="vault-selector-exit-btn"
              onClick={() => getCurrentWindow().close()}
            >
              종료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VaultSelector;
