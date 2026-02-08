import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { CalloutType } from '../extensions/Callout';

interface EditorToolbarProps {
  editor: Editor | null;
  defaultCollapsed?: boolean;
}

const CALLOUT_TYPES: { type: CalloutType; label: string }[] = [
  { type: 'info', label: 'Info' },
  { type: 'warning', label: 'Warning' },
  { type: 'error', label: 'Error' },
  { type: 'success', label: 'Success' },
  { type: 'note', label: 'Note' },
  { type: 'tip', label: 'Tip' },
];

const EditorToolbar = memo(function EditorToolbar({ editor }: EditorToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCalloutPicker, setShowCalloutPicker] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setShowCalloutPicker(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  const handleCallout = useCallback((type: CalloutType) => {
    if (!editor) return;
    editor.chain().focus().toggleCallout(type).run();
    setShowCalloutPicker(false);
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      className={`editor-toolbar-wrapper ${expanded ? 'visible' : ''} ${showCalloutPicker ? 'dropdown-open' : ''}`}
    >
      {/* Toggle button - expand or collapse */}
      {!expanded ? (
        <button
          className="editor-toolbar-toggle"
          onClick={() => setExpanded(true)}
          title="툴바 열기"
        >
          <ChevronDown size={12} />
        </button>
      ) : (
        <div className="editor-toolbar">
          {/* Collapse button */}
          <button
            className="editor-toolbar-toggle-close"
            onClick={() => { setExpanded(false); setShowCalloutPicker(false); }}
            title="툴바 닫기"
          >
            <ChevronUp size={12} />
          </button>

          {/* Text formatting */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="굵게 (Ctrl+B)"
            >
              B
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="기울임 (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="취소선"
            >
              <s>S</s>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="밑줄 (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="하이라이트"
            >
              H
            </button>
            <button
              className={`editor-toolbar-btn btn-small ${editor.isActive('subscript') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              title="아래 첨자"
            >
              X₂
            </button>
            <button
              className={`editor-toolbar-btn btn-small ${editor.isActive('superscript') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              title="위 첨자"
            >
              X²
            </button>
          </div>

          {/* Headings */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="제목 1"
            >
              H1
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="제목 2"
            >
              H2
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="제목 3"
            >
              H3
            </button>
          </div>

          {/* Lists */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="글머리 목록"
            >
              •≡
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="번호 목록"
            >
              1.
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              title="체크리스트"
            >
              ☑
            </button>
          </div>

          {/* Block elements */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="인용"
            >
              ❝
            </button>
            <div className="editor-toolbar-dropdown-wrapper">
              <button
                className={`editor-toolbar-btn ${editor.isActive('callout') ? 'active' : ''}`}
                onClick={() => setShowCalloutPicker(!showCalloutPicker)}
                title="콜아웃"
              >
                ⓘ
              </button>
              {showCalloutPicker && (
                <div className="editor-toolbar-dropdown">
                  {CALLOUT_TYPES.map(ct => (
                    <button
                      key={ct.type}
                      className="editor-toolbar-dropdown-item"
                      onClick={() => handleCallout(ct.type)}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`editor-toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="코드 블록"
            >
              {'</>'}
            </button>
            <button
              className="editor-toolbar-btn"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="구분선"
            >
              ―
            </button>
          </div>

          {/* Insert */}
          <div className="editor-toolbar-group">
            <button
              className="editor-toolbar-btn"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="표 삽입"
            >
              ⊞
            </button>
            <button
              className="editor-toolbar-btn"
              onClick={() => {
                const url = prompt('Enter URL:');
                if (url) {
                  editor.chain().focus().setLinkCard({ url }).run();
                }
              }}
              title="링크 카드 삽입"
            >
              🔗
            </button>
          </div>

          {/* Indent */}
          <div className="editor-toolbar-group">
            <button
              className="editor-toolbar-btn"
              onClick={() => {
                if (editor.isActive('listItem')) {
                  editor.chain().focus().sinkListItem('listItem').run();
                } else if (editor.isActive('taskItem')) {
                  editor.chain().focus().sinkListItem('taskItem').run();
                } else {
                  editor.chain().focus().indent().run();
                }
              }}
              title="들여쓰기 (Tab)"
            >
              ⇥
            </button>
            <button
              className="editor-toolbar-btn"
              onClick={() => {
                if (editor.isActive('listItem')) {
                  editor.chain().focus().liftListItem('listItem').run();
                } else if (editor.isActive('taskItem')) {
                  editor.chain().focus().liftListItem('taskItem').run();
                } else {
                  editor.chain().focus().outdent().run();
                }
              }}
              title="내어쓰기 (Shift+Tab)"
            >
              ⇤
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default EditorToolbar;
