import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Calendar, Plus, Settings as SettingsIcon, FolderClosed, ChevronDown, FolderPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  useVaultPath,
  useFileTree,
  useSelectedContainer,
} from '../stores/zustand';
import { useShowSearch, useShowCalendar, useShowSidebar, uiActions } from '../stores/zustand/uiStore';
import { useContainerConfigs, vaultConfigActions } from '../stores/zustand/vaultConfigStore';
import { modalActions } from '../stores/zustand/modalStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { openVault, createFolder, selectContainer } from '../stores/appActions';
import Settings from './Settings';
import RibbonBar from './RibbonBar';
import FolderTree from './FolderTree';
import type { ContainerType } from '../types';
import { t } from '../utils/i18n';

interface SidebarProps {
  width: number;
}

function Sidebar({ width }: SidebarProps) {
  // ========== ZUSTAND SELECTIVE SUBSCRIPTIONS (prevents cascade re-renders) ==========
  const vaultPath = useVaultPath();
  const fileTree = useFileTree();
  const selectedContainer = useSelectedContainer();

  // ========== ZUSTAND UI STATE ==========
  const showSearch = useShowSearch();
  const showCalendar = useShowCalendar();
  const showSidebar = useShowSidebar();
  const containerConfigs = useContainerConfigs();
  const language = useSettingsStore(s => s.language);

  // Get vault name from path
  const vaultName = vaultPath ? vaultPath.split(/[/\\]/).filter(Boolean).pop() : '';
  const [showSettings, setShowSettings] = useState(false);
  const [showNewContainer, setShowNewContainer] = useState(false);
  const [newContainerName, setNewContainerName] = useState('');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [pendingContainerPath, setPendingContainerPath] = useState<string | null>(null);
  const [typeSelectorPos, setTypeSelectorPos] = useState({ x: 0, y: 0 });
  const [rootContainer, setRootContainer] = useState<string | null>(null);
  const [showNewSubfolder, setShowNewSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const subfolderInputRef = useRef<HTMLInputElement>(null);
  const typeSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showNewContainer && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewContainer]);

  useEffect(() => {
    if (showNewSubfolder && subfolderInputRef.current) {
      subfolderInputRef.current.focus();
    }
  }, [showNewSubfolder]);

  useEffect(() => {
    if (!showTypeSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (typeSelectorRef.current && !typeSelectorRef.current.contains(e.target as Node)) {
        setShowTypeSelector(false);
        setPendingContainerPath(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTypeSelector(false);
        setPendingContainerPath(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showTypeSelector]);

  const cancelNew = () => {
    setShowNewContainer(false);
    setNewContainerName('');
  };

  const handleCreateContainer = async () => {
    if (!newContainerName.trim()) {
      cancelNew();
      return;
    }
    try {
      const containerPath = await createFolder(newContainerName.trim());
      setShowNewContainer(false);
      setNewContainerName('');
      // Position type selector at center of screen
      setTypeSelectorPos({
        x: Math.round(window.innerWidth / 2 - 100),
        y: Math.round(window.innerHeight / 2 - 60)
      });
      setPendingContainerPath(containerPath);
      setShowTypeSelector(true);
    } catch (e) {
      console.error('Failed to create container:', e);
    }
  };

  const handleSelectType = useCallback((type: ContainerType) => {
    if (!pendingContainerPath) return;
    if (type === 'standard') {
      vaultConfigActions.setContainerConfig(pendingContainerPath, { type: 'standard' });
      setShowTypeSelector(false);
      setPendingContainerPath(null);
    } else {
      setShowTypeSelector(false);
      const pos = typeSelectorPos;
      modalActions.showTemplateSelector(pos, (templateId: string) => {
        if (pendingContainerPath) {
          vaultConfigActions.setContainerConfig(pendingContainerPath, {
            type: 'storage',
            assignedTemplateId: templateId,
          });
        }
        setPendingContainerPath(null);
      });
    }
  }, [pendingContainerPath, typeSelectorPos]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateContainer();
    if (e.key === 'Escape') cancelNew();
  };

  const cancelNewSubfolder = () => {
    setShowNewSubfolder(false);
    setNewSubfolderName('');
  };

  const handleCreateSubfolder = async () => {
    // Use selectedContainer (can be root or subfolder) as parent
    if (!newSubfolderName.trim() || !selectedContainer) {
      cancelNewSubfolder();
      return;
    }
    try {
      const newFolderPath = await createFolder(newSubfolderName.trim(), selectedContainer);
      setShowNewSubfolder(false);
      setNewSubfolderName('');
      // Auto-select the newly created folder
      selectContainer(newFolderPath);
    } catch (e) {
      console.error('Failed to create subfolder:', e);
    }
  };

  const handleSubfolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateSubfolder();
    if (e.key === 'Escape') cancelNewSubfolder();
  };

  // Top-level folders = containers (exclude system folders)
  const containers = fileTree.filter(node => node.is_dir && node.name !== '.notology');

  // Find the root container for the selected container
  const getRootContainerPath = (containerPath: string | null): string | null => {
    if (!containerPath || !vaultPath) return null;
    const normalizedPath = containerPath.replace(/\\/g, '/');
    const normalizedVault = vaultPath.replace(/\\/g, '/');
    // Remove vault path prefix
    const relativePath = normalizedPath.startsWith(normalizedVault)
      ? normalizedPath.slice(normalizedVault.length + 1)
      : normalizedPath;
    // Get first segment (root container name)
    const firstSegment = relativePath.split('/')[0];
    if (!firstSegment) return null;
    return `${normalizedVault}/${firstSegment}`.replace(/\//g, '\\');
  };

  // Check if the selected container is inside a Storage container
  const isInsideStorageContainer = (): boolean => {
    const rootPath = getRootContainerPath(selectedContainer);
    if (!rootPath) return false;
    const config = containerConfigs[rootPath];
    return config?.type === 'storage';
  };

  // Handle new subfolder button click with Storage check
  const handleNewSubfolderClick = () => {
    if (isInsideStorageContainer()) {
      modalActions.showAlertModal(
        '폴더 생성 불가',
        'Storage 컨테이너 내부에는 폴더를 생성할 수 없습니다.\n\n폴더 구조가 필요하다면 컨테이너 유형을 Standard로 변경해 주세요.'
      );
      return;
    }
    setShowNewSubfolder(true);
  };

  return (
    <>
      <aside className="sidebar" style={{ width }}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <button
              className={`sidebar-toggle-btn ${showSidebar ? '' : 'collapsed'}`}
              onClick={() => uiActions.setShowSidebar(!showSidebar)}
              title={showSidebar ? t('close', language) : t('open', language)}
            >
              {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>
          <div className="sidebar-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => setShowNewContainer(!showNewContainer)}
              title={t('newFolder', language)}
              disabled={!vaultPath}
            >
              <Plus size={18} strokeWidth={2} />
            </button>
            <button
              className={`sidebar-action-btn ${showSearch ? 'active' : ''}`}
              onClick={() => uiActions.setShowSearch(true)}
              title={t('search', language)}
              disabled={!vaultPath}
            >
              <Search size={16} strokeWidth={2} />
            </button>
            <button
              className={`sidebar-action-btn ${showCalendar ? 'active' : ''}`}
              onClick={() => uiActions.setShowCalendar(true)}
              title="Calendar"
              disabled={!vaultPath}
            >
              <Calendar size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Unified Container and Folder Tree */}
        <nav className="sidebar-content">
          {vaultPath ? (
            <FolderTree
              containers={containers}
              rootContainer={rootContainer}
              onRootContainerChange={setRootContainer}
              onNewSubfolder={handleNewSubfolderClick}
            />
          ) : (
            <div className="sidebar-empty">
              <button className="open-vault-btn" onClick={() => openVault()}>
                {t('openVault', language)}
              </button>
              <p className="sidebar-empty-text">{t('noVaultOpen', language)}</p>
            </div>
          )}
        </nav>

        {/* Ribbon Bar */}
        {vaultPath && <RibbonBar />}

        {/* Sidebar Footer - Vault & Settings */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn vault-btn"
            onClick={() => modalActions.setShowVaultSelectorModal(true)}
            title={t('openVault', language)}
          >
            <FolderClosed size={16} strokeWidth={2} />
            <span className="sidebar-footer-btn-text">{vaultName || t('openVault', language)}</span>
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          <button
            className="sidebar-footer-btn settings-btn"
            onClick={() => setShowSettings(true)}
            title={t('settings', language)}
          >
            <SettingsIcon size={16} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Container Type Selector Popup - Portal to body for correct positioning */}
      {showTypeSelector && createPortal(
        <div className="container-type-selector-overlay">
          <div
            ref={typeSelectorRef}
            className="container-type-selector-v2"
          >
            <div className="container-type-selector-header-v2">
              <span>컨테이너 유형 선택</span>
              <span className="container-type-selector-hint">새 컨테이너</span>
            </div>
            <div className="container-type-selector-content">
              <button
                className="container-type-selector-item-v2 standard"
                onClick={() => handleSelectType('standard')}
              >
                <div className="container-type-icon-wrapper standard">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <line x1="12" y1="11" x2="12" y2="17"/>
                    <line x1="9" y1="14" x2="15" y2="14"/>
                  </svg>
                </div>
                <div className="container-type-info-v2">
                  <span className="container-type-name-v2">Standard</span>
                  <span className="container-type-desc-v2">
                    다양한 종류의 노트를 자유롭게 저장하는 일반 컨테이너입니다.
                    모든 템플릿 유형의 노트를 생성할 수 있습니다.
                  </span>
                </div>
              </button>
              <button
                className="container-type-selector-item-v2 storage"
                onClick={() => handleSelectType('storage')}
              >
                <div className="container-type-icon-wrapper storage">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <path d="M9 13h6"/>
                    <path d="M9 17h6"/>
                  </svg>
                </div>
                <div className="container-type-info-v2">
                  <span className="container-type-name-v2">Storage</span>
                  <span className="container-type-desc-v2">
                    특정 템플릿 전용 보관 컨테이너입니다.
                    선택한 템플릿 유형의 노트만 생성됩니다.
                  </span>
                </div>
              </button>
            </div>
            <div className="container-type-selector-footer">
              <button
                className="container-type-cancel-btn"
                onClick={() => {
                  setShowTypeSelector(false);
                  setPendingContainerPath(null);
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal - Portal to body for correct positioning */}
      {showSettings && createPortal(
        <Settings onClose={() => setShowSettings(false)} />,
        document.body
      )}

      {/* New Container Modal - Portal to body for correct positioning */}
      {showNewContainer && createPortal(
        <div className="modal-overlay" onClick={cancelNew}>
          <div className="new-container-modal" onClick={(e) => e.stopPropagation()}>
            <div className="new-container-modal-header">새 Container</div>
            <input
              ref={inputRef}
              className="new-container-modal-input"
              type="text"
              placeholder="Container 이름을 입력하세요"
              value={newContainerName}
              onChange={(e) => setNewContainerName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="new-container-modal-actions">
              <button className="new-container-modal-btn cancel" onClick={cancelNew}>
                취소
              </button>
              <button
                className="new-container-modal-btn create"
                onClick={handleCreateContainer}
                disabled={!newContainerName.trim()}
              >
                생성
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New Subfolder Modal - Portal to body for correct positioning */}
      {showNewSubfolder && createPortal(
        <div className="modal-overlay" onClick={cancelNewSubfolder}>
          <div className="new-container-modal" onClick={(e) => e.stopPropagation()}>
            <div className="new-container-modal-header">
              <FolderPlus size={16} style={{ marginRight: '8px' }} />
              새 폴더
            </div>
            <input
              ref={subfolderInputRef}
              className="new-container-modal-input"
              type="text"
              placeholder="폴더 이름을 입력하세요"
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              onKeyDown={handleSubfolderKeyDown}
            />
            <div className="new-container-modal-actions">
              <button className="new-container-modal-btn cancel" onClick={cancelNewSubfolder}>
                취소
              </button>
              <button
                className="new-container-modal-btn create"
                onClick={handleCreateSubfolder}
                disabled={!newSubfolderName.trim()}
              >
                생성
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default Sidebar;
