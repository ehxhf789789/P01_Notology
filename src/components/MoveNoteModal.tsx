import { useState, useEffect, useCallback } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { useFileTree } from '../stores/zustand/fileTreeStore';
import { moveNote } from '../stores/appActions';
import type { FileNode } from '../types';

function MoveNoteModal() {
  const moveNoteModalPath = useModalStore(s => s.moveNoteModalPath);
  const hideMoveNoteModal = useModalStore(s => s.hideMoveNoteModal);
  const fileTree = useFileTree();
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (!moveNoteModalPath) {
      setSelectedDir(null);
      setExpanded(new Set());
    }
  }, [moveNoteModalPath]);

  useEffect(() => {
    if (!moveNoteModalPath) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideMoveNoteModal();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [moveNoteModalPath, hideMoveNoteModal]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('move-note-backdrop')) {
      hideMoveNoteModal();
    }
  }, [hideMoveNoteModal]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Calculate the note's current directory
  const noteDir = moveNoteModalPath?.replace(/[/\\][^/\\]+$/, '') || null;

  // Check if selected directory is the same as current directory
  const isCurrentDir = selectedDir === noteDir;

  const handleMove = async () => {
    if (!selectedDir || !moveNoteModalPath || isMoving || isCurrentDir) return;
    setIsMoving(true);
    try {
      await moveNote(moveNoteModalPath, selectedDir);
      hideMoveNoteModal();
    } catch (e) {
      console.error('Failed to move note:', e);
    } finally {
      setIsMoving(false);
    }
  };

  const renderTree = (nodes: FileNode[], depth: number = 0) => {
    return nodes
      .filter(node => node.is_dir)
      .map(node => {
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedDir === node.path;
        const hasChildren = node.children?.some(c => c.is_dir);
        // Highlight the note's own current directory
        const isCurrent = node.path === noteDir;

        return (
          <div key={node.path} className="move-tree-item" style={{ paddingLeft: depth * 16 }}>
            <div
              className={`move-tree-row ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => setSelectedDir(node.path)}
            >
              {hasChildren ? (
                <span
                  className="move-tree-toggle"
                  onClick={(e) => { e.stopPropagation(); toggleExpand(node.path); }}
                >
                  {isExpanded ? '▾' : '▸'}
                </span>
              ) : (
                <span className="move-tree-toggle-spacer" />
              )}
              <span className="move-tree-name">{node.name}</span>
              {isCurrent && <span className="move-tree-current">(현재)</span>}
            </div>
            {isExpanded && node.children && (
              <div className="move-tree-children">
                {renderTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      });
  };

  if (!moveNoteModalPath) return null;

  const noteName = moveNoteModalPath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || '';

  return (
    <div className="move-note-backdrop" onClick={handleBackdropClick}>
      <div className="move-note-modal">
        <div className="move-note-header">
          <span className="move-note-title">노트 이동: {noteName}</span>
          <button className="move-note-close" onClick={hideMoveNoteModal}>x</button>
        </div>
        <div className="move-note-body">
          <div className="move-note-tree">
            {renderTree(fileTree)}
          </div>
        </div>
        <div className="move-note-footer">
          <button className="move-note-btn cancel" onClick={hideMoveNoteModal}>
            취소
          </button>
          <button
            className="move-note-btn confirm"
            onClick={handleMove}
            disabled={!selectedDir || isMoving || isCurrentDir}
          >
            {isMoving ? '이동 중...' : isCurrentDir ? '현재 위치' : '이동'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MoveNoteModal;
