import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { Editor } from '@tiptap/react';
import type { CalloutType } from '../extensions/Callout';

interface EditorContextMenuProps {
  editor: Editor;
  position: { x: number; y: number };
  onClose: () => void;
  onAddMemo?: () => void;
  onAddTask?: () => void;
}

const CALLOUT_TYPES: { type: CalloutType; label: string }[] = [
  { type: 'info', label: 'Info' },
  { type: 'warning', label: 'Warning' },
  { type: 'error', label: 'Error' },
  { type: 'success', label: 'Success' },
  { type: 'note', label: 'Note' },
  { type: 'tip', label: 'Tip' },
];

const CELL_COLORS: { color: string; label: string }[] = [
  { color: 'transparent', label: '기본' },
  { color: '#2d2d2d', label: '진한 회색' },
  { color: '#3c3c3c', label: '회색' },
  { color: '#1e3a5f', label: '파랑' },
  { color: '#2d4a2c', label: '초록' },
  { color: '#5f3a1e', label: '갈색' },
  { color: '#5f1e3a', label: '자주' },
  { color: '#4a2d2d', label: '빨강' },
];

function EditorContextMenu({ editor, position, onClose, onAddMemo, onAddTask }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const [showHeadingSubmenu, setShowHeadingSubmenu] = useState(false);
  const [showCalloutSubmenu, setShowCalloutSubmenu] = useState(false);
  const [showCellColorSubmenu, setShowCellColorSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    // Add some padding to prevent menu from being too close to edges
    const padding = 16;
    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position - ensure menu stays within viewport
    // The menu has max-height: min(500px, calc(100vh - 80px)) in CSS
    const maxMenuHeight = Math.min(500, window.innerHeight - 80);
    const availableHeight = window.innerHeight - y - padding;

    if (availableHeight < rect.height) {
      // If not enough space below, try to position above or adjust
      if (position.y > rect.height + padding) {
        // Position above the click point
        y = position.y - rect.height;
      } else {
        // Position at top with padding, scrollbar will handle overflow
        y = padding;
      }
    }

    if (y < padding) {
      y = padding;
    }

    setAdjustedPos({ x, y });
  }, [position]);

  const runCommand = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="editor-context-menu"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {/* Memo / Task (only when text is selected) */}
      {!editor.state.selection.empty && onAddMemo && (
        <>
          <button
            className="editor-context-menu-item ecm-memo-item"
            onClick={() => { onAddMemo(); onClose(); }}
          >
            <span className="ecm-label">메모 추가</span>
          </button>
          {onAddTask && (
            <button
              className="editor-context-menu-item ecm-memo-item"
              onClick={() => { onAddTask(); onClose(); }}
            >
              <span className="ecm-label">할일 추가</span>
            </button>
          )}
          <div className="editor-context-menu-separator" />
        </>
      )}

      {/* Text formatting */}
      <button
        className={`editor-context-menu-item ${editor.isActive('bold') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleBold().run())}
      >
        <span className="ecm-label">굵게</span>
        <span className="ecm-shortcut">Ctrl+B</span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('italic') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleItalic().run())}
      >
        <span className="ecm-label">기울임</span>
        <span className="ecm-shortcut">Ctrl+I</span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('strike') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleStrike().run())}
      >
        <span className="ecm-label">취소선</span>
        <span className="ecm-shortcut"></span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('underline') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleUnderline().run())}
      >
        <span className="ecm-label">밑줄</span>
        <span className="ecm-shortcut">Ctrl+U</span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('highlight') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleHighlight().run())}
      >
        <span className="ecm-label">하이라이트</span>
        <span className="ecm-shortcut"></span>
      </button>

      <div className="editor-context-menu-separator" />

      {/* Heading submenu */}
      <div
        className="editor-context-menu-item has-submenu"
        onMouseEnter={() => { setShowHeadingSubmenu(true); setShowCalloutSubmenu(false); }}
        onMouseLeave={() => setShowHeadingSubmenu(false)}
      >
        <span className="ecm-label">제목</span>
        <span className="ecm-arrow">▸</span>
        {showHeadingSubmenu && (
          <div className="editor-context-submenu">
            <button
              className={`editor-context-menu-item ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
            >
              <span className="ecm-label">제목 1</span>
            </button>
            <button
              className={`editor-context-menu-item ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            >
              <span className="ecm-label">제목 2</span>
            </button>
            <button
              className={`editor-context-menu-item ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
            >
              <span className="ecm-label">제목 3</span>
            </button>
          </div>
        )}
      </div>

      <div className="editor-context-menu-separator" />

      {/* Lists */}
      <button
        className={`editor-context-menu-item ${editor.isActive('bulletList') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleBulletList().run())}
      >
        <span className="ecm-label">글머리 목록</span>
        <span className="ecm-shortcut"></span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('orderedList') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleOrderedList().run())}
      >
        <span className="ecm-label">번호 목록</span>
        <span className="ecm-shortcut"></span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('taskList') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleTaskList().run())}
      >
        <span className="ecm-label">체크리스트</span>
        <span className="ecm-shortcut"></span>
      </button>

      <div className="editor-context-menu-separator" />

      {/* Block elements */}
      <button
        className={`editor-context-menu-item ${editor.isActive('blockquote') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleBlockquote().run())}
      >
        <span className="ecm-label">인용</span>
        <span className="ecm-shortcut"></span>
      </button>

      {/* Callout submenu */}
      <div
        className="editor-context-menu-item has-submenu"
        onMouseEnter={() => { setShowCalloutSubmenu(true); setShowHeadingSubmenu(false); }}
        onMouseLeave={() => setShowCalloutSubmenu(false)}
      >
        <span className="ecm-label">콜아웃</span>
        <span className="ecm-arrow">▸</span>
        {showCalloutSubmenu && (
          <div className="editor-context-submenu">
            {CALLOUT_TYPES.map(ct => (
              <button
                key={ct.type}
                className="editor-context-menu-item"
                onClick={() => runCommand(() => editor.chain().focus().toggleCallout(ct.type).run())}
              >
                <span className="ecm-label">{ct.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={`editor-context-menu-item ${editor.isActive('code') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleCode().run())}
      >
        <span className="ecm-label">코드</span>
        <span className="ecm-shortcut">Ctrl+E</span>
      </button>
      <button
        className={`editor-context-menu-item ${editor.isActive('codeBlock') ? 'active' : ''}`}
        onClick={() => runCommand(() => editor.chain().focus().toggleCodeBlock().run())}
      >
        <span className="ecm-label">코드 블록</span>
        <span className="ecm-shortcut"></span>
      </button>

      <div className="editor-context-menu-separator" />

      {/* Indent */}
      <button
        className="editor-context-menu-item"
        onClick={() => runCommand(() => {
          if (editor.isActive('listItem')) {
            editor.chain().focus().sinkListItem('listItem').run();
          } else if (editor.isActive('taskItem')) {
            editor.chain().focus().sinkListItem('taskItem').run();
          } else {
            // First-line indent for regular paragraphs
            editor.chain().focus().setFirstLineIndent().run();
          }
        })}
      >
        <span className="ecm-label">들여쓰기</span>
        <span className="ecm-shortcut">Tab</span>
      </button>
      <button
        className="editor-context-menu-item"
        onClick={() => runCommand(() => {
          if (editor.isActive('listItem')) {
            editor.chain().focus().liftListItem('listItem').run();
          } else if (editor.isActive('taskItem')) {
            editor.chain().focus().liftListItem('taskItem').run();
          } else {
            // Hanging indent for regular paragraphs
            editor.chain().focus().setHangingIndent().run();
          }
        })}
      >
        <span className="ecm-label">내어쓰기</span>
        <span className="ecm-shortcut">Shift+Tab</span>
      </button>

      {/* Table operations */}
      {editor.isActive('table') && (
        <>
          <div className="editor-context-menu-separator" />
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().addRowBefore().run())}
          >
            <span className="ecm-label">행 위에 추가</span>
          </button>
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().addRowAfter().run())}
          >
            <span className="ecm-label">행 아래에 추가</span>
          </button>
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().addColumnBefore().run())}
          >
            <span className="ecm-label">열 왼쪽에 추가</span>
          </button>
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().addColumnAfter().run())}
          >
            <span className="ecm-label">열 오른쪽에 추가</span>
          </button>
          <div className="editor-context-menu-separator" />
          <div
            className="editor-context-menu-item has-submenu"
            onMouseEnter={() => { setShowCellColorSubmenu(true); setShowHeadingSubmenu(false); setShowCalloutSubmenu(false); }}
            onMouseLeave={() => setShowCellColorSubmenu(false)}
          >
            <span className="ecm-label">셀 배경색</span>
            <span className="ecm-arrow">▸</span>
            {showCellColorSubmenu && (
              <div className="editor-context-submenu">
                {CELL_COLORS.map(c => (
                  <button
                    key={c.color}
                    className="editor-context-menu-item"
                    onClick={() => runCommand(() => {
                      editor.chain().focus().updateAttributes('tableCell', { backgroundColor: c.color }).run();
                    })}
                  >
                    <div className="cell-color-preview" style={{ backgroundColor: c.color }} />
                    <span className="ecm-label">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="editor-context-menu-separator" />
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().deleteRow().run())}
          >
            <span className="ecm-label">행 삭제</span>
          </button>
          <button
            className="editor-context-menu-item"
            onClick={() => runCommand(() => editor.chain().focus().deleteColumn().run())}
          >
            <span className="ecm-label">열 삭제</span>
          </button>
          <button
            className="editor-context-menu-item delete"
            onClick={() => runCommand(() => editor.chain().focus().deleteTable().run())}
          >
            <span className="ecm-label">표 삭제</span>
          </button>
        </>
      )}
    </div>
  );
}

export default EditorContextMenu;
