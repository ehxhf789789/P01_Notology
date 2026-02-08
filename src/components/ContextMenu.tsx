import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { utilCommands, searchCommands } from '../services/tauriCommands';
import { RefreshCw, Check, Pause, Circle } from 'lucide-react';
import { useFileTree, useVaultPath, fileTreeActions, hoverActions, refreshActions } from '../stores/zustand';
import { useModalStore, modalActions } from '../stores/zustand/modalStore';
import { useContainerConfigs, useFolderStatuses, vaultConfigActions } from '../stores/zustand/vaultConfigStore';
import { deleteNote, deleteFolder, refreshHoverWindowsForFile } from '../stores/appActions';
import type { ContainerType, FolderStatus } from '../types';
import { FOLDER_STATUS_INFO } from '../types';

// Render folder status icon using Lucide
function renderStatusIcon(status: FolderStatus) {
  const iconSize = 12;
  switch (status) {
    case 'in_progress':
      return <RefreshCw size={iconSize} />;
    case 'completed':
      return <Check size={iconSize} />;
    case 'on_hold':
      return <Pause size={iconSize} />;
    case 'none':
    default:
      return <Circle size={iconSize} />;
  }
}

function ContextMenu() {
  const contextMenu = useModalStore(s => s.contextMenu);
  const fileTree = useFileTree();
  const vaultPath = useVaultPath();
  const containerConfigs = useContainerConfigs();
  const folderStatuses = useFolderStatuses();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showTypeSubmenu, setShowTypeSubmenu] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);

  useEffect(() => {
    if (!contextMenu) {
      setShowTypeSubmenu(false);
      setShowStatusSubmenu(false);
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        modalActions.hideContextMenu();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') modalActions.hideContextMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const findFilePath = useCallback((fileName: string): string | null => {
    const search = (nodes: typeof fileTree): string | null => {
      for (const node of nodes) {
        if (!node.is_dir) {
          const nameWithoutExt = node.name.replace(/\.[^.]+$/, '');
          if (nameWithoutExt === fileName || node.name === fileName) {
            return node.path;
          }
        }
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(fileTree);
  }, [fileTree]);

  // Adjust position to stay within viewport (must be before conditional return)
  useLayoutEffect(() => {
    if (!contextMenu?.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pos = contextMenu.position;
    const padding = 16;
    let x = pos.x, y = pos.y;

    // Adjust horizontal position
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position - ensure menu stays within viewport
    // The menu has max-height: min(500px, calc(100vh - 80px)) in CSS
    const availableHeight = window.innerHeight - y - padding;

    if (availableHeight < rect.height) {
      // If not enough space below, try to position above or adjust
      if (pos.y > rect.height + padding) {
        // Position above the click point
        y = pos.y - rect.height;
      } else {
        // Position at top with padding, scrollbar will handle overflow
        y = padding;
      }
    }

    if (y < padding) {
      y = padding;
    }

    setAdjustedPos({ x, y });
  }, [contextMenu]);

  if (!contextMenu || !contextMenu.visible) return null;

  const { fileName, position, notePath, filePath: directPath, isFolder, fromSearch, wikiLinkDeleteCallback, hideDelete, isAttachment: isAttachmentFlag } = contextMenu;
  const filePath = directPath || findFilePath(fileName);
  // Check if the file is in an _att folder (then it's an attachment, not a note even if .md)
  const isInAttFolder = filePath ? (/_att[/\\]/.test(filePath) || /_att$/.test(filePath)) : false;
  // If isAttachment flag is explicitly set (from attachment tab), use it; otherwise check path
  const isNote = isAttachmentFlag ? false : (filePath ? (/\.md$/i.test(filePath) && !isInAttFolder) : false);
  // Check if notePath is a valid note file path (must end with .md)
  const hasValidNotePath = notePath && /\.md$/i.test(notePath);
  const isPreviewable = filePath ? /\.(md|pdf|png|jpg|jpeg|gif|webp|svg|bmp|ico|json|py|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|rs|go|java|c|cpp|h|hpp|cs|rb|php|sh|bash|sql|lua|r|swift|kt|scala)$/i.test(filePath) : false;

  // Check if this folder is a root container (direct child of vault)
  const isRootContainer = isFolder && filePath && vaultPath && (() => {
    // Normalize paths
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    const normalizedVaultPath = vaultPath.replace(/\\/g, '/');
    // Get parent directory of the folder
    const lastSlash = normalizedFilePath.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? normalizedFilePath.slice(0, lastSlash) : '';
    return parentPath === normalizedVaultPath;
  })();

  // Get current container config if it's a root container
  const currentContainerConfig = isRootContainer && filePath ? containerConfigs[filePath] : null;
  const currentType: ContainerType = currentContainerConfig?.type || 'standard';

  // Check if container has subfolders (for Storage type restriction)
  const containerHasSubfolders = isRootContainer && filePath && (() => {
    const containerNode = fileTree.find(node => node.path === filePath);
    if (!containerNode?.children) return false;
    return containerNode.children.some(child =>
      child.is_dir && !child.name.endsWith('_att') && child.name !== '.notology'
    );
  })();

  const handleOpenDefault = async () => {
    if (filePath) {
      await utilCommands.openInDefaultApp(filePath);
    }
    modalActions.hideContextMenu();
  };

  const handleRevealFolder = async () => {
    if (filePath) {
      await utilCommands.revealInExplorer(filePath);
    }
    modalActions.hideContextMenu();
  };

  const handleOpenNewWindow = () => {
    if (filePath) {
      hoverActions.open(filePath);
    }
    modalActions.hideContextMenu();
  };

  const handleMoveNote = () => {
    if (filePath && isNote) {
      modalActions.showMoveNoteModal(filePath);
    } else {
      modalActions.showMoveNoteModal(notePath);
    }
    modalActions.hideContextMenu();
  };

  const handleRename = () => {
    if (filePath) {
      const name = filePath.split(/[/\\]/).pop() || '';
      modalActions.showRenameDialog(filePath, name, !isNote, false);
    }
    modalActions.hideContextMenu();
  };

  const handleDelete = () => {
    if (!filePath || !isNote) return;
    const noteName = filePath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || '';
    const notePathToDelete = filePath;
    modalActions.hideContextMenu();
    modalActions.showConfirmDelete(noteName, 'note', async () => {
      try {
        await deleteNote(notePathToDelete);
        await fileTreeActions.refreshFileTree();
      } catch (e) {
        console.error('Failed to delete note:', e);
        modalActions.showAlertModal('삭제 실패', `노트를 삭제하지 못했습니다.\n\n${e}`);
      }
    });
  };

  const handleDeleteFolder = () => {
    if (!filePath) return;
    const folderName = filePath.split(/[/\\]/).pop() || '';
    const folderPathToDelete = filePath;
    modalActions.hideContextMenu();
    modalActions.showConfirmDelete(folderName, 'folder', async () => {
      try {
        await deleteFolder(folderPathToDelete);
        await fileTreeActions.refreshFileTree();
      } catch (e) {
        console.error('Failed to delete folder:', e);
        modalActions.showAlertModal('삭제 실패', `폴더를 삭제하지 못했습니다.\n\n${e}`);
      }
    });
  };

  const handleRenameFolder = () => {
    if (filePath) {
      const name = filePath.split(/[/\\]/).pop() || '';
      modalActions.showRenameDialog(filePath, name, false, true);
    }
    modalActions.hideContextMenu();
  };

  const handleMoveFolder = () => {
    if (filePath) {
      modalActions.showMoveNoteModal(filePath);
    }
    modalActions.hideContextMenu();
  };

  const handleSetContainerType = (type: ContainerType) => {
    if (!filePath) return;

    if (type === 'standard') {
      vaultConfigActions.setContainerConfig(filePath, { type: 'standard' });
      modalActions.hideContextMenu();
    } else {
      // For storage type, check if container has subfolders
      if (containerHasSubfolders) {
        modalActions.hideContextMenu();
        modalActions.showAlertModal(
          'Storage 유형으로 변경 불가',
          'Storage 컨테이너는 내부에 폴더 구조를 가질 수 없습니다.\n\n하위 폴더가 있는 컨테이너는 Storage 유형으로 변경할 수 없습니다.\n먼저 하위 폴더를 삭제하거나 이동해 주세요.'
        );
        return;
      }
      // Show template selector
      modalActions.hideContextMenu();
      modalActions.showTemplateSelector(
        { x: Math.round(window.innerWidth / 2 - 150), y: Math.round(window.innerHeight / 2 - 200) },
        (templateId: string) => {
          vaultConfigActions.setContainerConfig(filePath, {
            type: 'storage',
            assignedTemplateId: templateId,
          });
        }
      );
    }
  };

  const handleRenameWikiLink = () => {
    if (filePath) {
      const name = filePath.split(/[/\\]/).pop() || '';
      // Check if this is an attachment (not a .md file)
      const isAttachment = !filePath.endsWith('.md');
      modalActions.showRenameDialog(filePath, name, isAttachment, false);
    }
    modalActions.hideContextMenu();
  };

  const handleDeleteAttachment = () => {
    if (!filePath) return;
    const fileName = filePath.split(/[/\\]/).pop() || '';
    modalActions.hideContextMenu();
    modalActions.showConfirmDelete(fileName, 'file', async () => {
      try {
        // Use new command that also removes wikilinks from owning notes
        const [deleted, linksRemoved, modifiedNotes] = await searchCommands.deleteAttachmentsWithLinks(
          [filePath]
        );

        await fileTreeActions.refreshFileTree();
        refreshActions.incrementSearchRefresh();

        // Refresh any open hover windows that were modified
        for (const notePath of modifiedNotes) {
          refreshHoverWindowsForFile(notePath);
        }

        if (deleted === 0) {
          modalActions.showAlertModal('삭제 실패', '파일을 삭제하지 못했습니다.');
        }
      } catch (e) {
        console.error('Failed to delete attachment:', e);
        modalActions.showAlertModal('삭제 실패', `파일을 삭제하지 못했습니다.\n\n${e}`);
      }
    });
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: adjustedPos.x,
    top: adjustedPos.y,
    zIndex: 10000,
  };

  return (
    <div ref={menuRef} className="context-menu" style={menuStyle}>
      {wikiLinkDeleteCallback ? (
        <>
          <button className="context-menu-item" onClick={handleOpenNewWindow}>
            노트 열기
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleRenameWikiLink}>
            위키링크 이름 변경...
          </button>
          <button className="context-menu-item delete" onClick={() => {
            wikiLinkDeleteCallback();
            modalActions.hideContextMenu();
          }}>
            링크 삭제
          </button>
        </>
      ) : isFolder ? (
        <>
          {/* Container type change for root containers */}
          {isRootContainer && (
            <>
              <div
                className="context-menu-item context-menu-submenu-trigger"
                onMouseEnter={() => setShowTypeSubmenu(true)}
                onMouseLeave={() => setShowTypeSubmenu(false)}
              >
                <span>컨테이너 유형</span>
                <span className="context-menu-arrow">▶</span>
                {showTypeSubmenu && (
                  <div className="context-menu-submenu">
                    <button
                      className={`context-menu-item ${currentType === 'standard' ? 'checked' : ''}`}
                      onClick={() => handleSetContainerType('standard')}
                    >
                      <span className="context-menu-check">{currentType === 'standard' ? '✓' : ''}</span>
                      <span>Standard</span>
                      <span className="context-menu-type-desc">일반</span>
                    </button>
                    <button
                      className={`context-menu-item ${currentType === 'storage' ? 'checked' : ''}`}
                      onClick={() => handleSetContainerType('storage')}
                    >
                      <span className="context-menu-check">{currentType === 'storage' ? '✓' : ''}</span>
                      <span>Storage</span>
                      <span className="context-menu-type-desc">보관</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          {/* Folder status submenu */}
          <div
            className="context-menu-item context-menu-submenu-trigger"
            onMouseEnter={() => setShowStatusSubmenu(true)}
            onMouseLeave={() => setShowStatusSubmenu(false)}
          >
            <span>폴더 상태</span>
            <span className="context-menu-arrow">▶</span>
            {showStatusSubmenu && (
              <div className="context-menu-submenu">
                {FOLDER_STATUS_INFO.map(info => {
                  const currentStatus = filePath ? (folderStatuses[filePath]?.status || 'none') : 'none';
                  const isActive = currentStatus === info.status;
                  return (
                    <button
                      key={info.status}
                      className={`context-menu-item ${isActive ? 'checked' : ''}`}
                      onClick={() => {
                        if (filePath) {
                          vaultConfigActions.setFolderStatus(filePath, info.status);
                        }
                        modalActions.hideContextMenu();
                      }}
                    >
                      <span className="context-menu-check">{isActive ? '✓' : ''}</span>
                      <span className="context-menu-status-icon">{renderStatusIcon(info.status)}</span>
                      <span>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleRenameFolder}>
            폴더 이름 변경...
          </button>
          {!isRootContainer && (
            <button className="context-menu-item" onClick={handleMoveFolder}>
              폴더 이동...
            </button>
          )}
          <button className="context-menu-item delete" onClick={handleDeleteFolder}>
            {isRootContainer ? '컨테이너 삭제' : '폴더 삭제'}
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleRevealFolder}>
            탐색기에서 열기
          </button>
        </>
      ) : isNote ? (
        <>
          {!fromSearch && (
            <>
              <button className="context-menu-item" onClick={handleOpenNewWindow}>
                새 창에서 열기
              </button>
              <div className="context-menu-separator" />
            </>
          )}
          <button className="context-menu-item" onClick={handleRename}>
            노트 이름 변경...
          </button>
          <button className="context-menu-item" onClick={handleMoveNote}>
            노트 이동...
          </button>
          <button className="context-menu-item delete" onClick={handleDelete}>
            노트 삭제
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleOpenDefault}>
            기본 앱으로 열기
          </button>
          <button className="context-menu-item" onClick={handleRevealFolder}>
            폴더에서 보기
          </button>
        </>
      ) : (
        <>
          <button className="context-menu-item" onClick={handleOpenDefault}>
            기본 앱으로 열기
          </button>
          <button className="context-menu-item" onClick={handleRevealFolder}>
            첨부 폴더 열기
          </button>
          {hasValidNotePath && (
            <>
              <div className="context-menu-separator" />
              <button className="context-menu-item" onClick={() => {
                hoverActions.open(notePath);
                modalActions.hideContextMenu();
              }}>
                소속 노트 열기
              </button>
            </>
          )}
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleRename}>
            이름 변경...
          </button>
          {!hideDelete && (
            <button className="context-menu-item delete" onClick={handleDeleteAttachment}>
              파일 삭제
            </button>
          )}
          {filePath && isPreviewable && (
            <>
              <div className="context-menu-separator" />
              <button className="context-menu-item" onClick={handleOpenNewWindow}>
                내부에서 열기
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ContextMenu;
