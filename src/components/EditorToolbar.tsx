import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { CalloutType } from '../extensions/Callout';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { t } from '../utils/i18n';

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
  const language = useSettingsStore(s => s.language);
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
          title={t('toolbarOpen', language)}
        >
          <ChevronDown size={12} />
        </button>
      ) : (
        <div className="editor-toolbar">
          {/* Collapse button */}
          <button
            className="editor-toolbar-toggle-close"
            onClick={() => { setExpanded(false); setShowCalloutPicker(false); }}
            title={t('toolbarClose', language)}
          >
            <ChevronUp size={12} />
          </button>

          {/* Text formatting */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title={t('bold', language)}
            >
              B
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title={t('italic', language)}
            >
              <em>I</em>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title={t('strikethrough', language)}
            >
              <s>S</s>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title={t('underline', language)}
            >
              <u>U</u>
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title={t('highlight', language)}
            >
              H
            </button>
            <button
              className={`editor-toolbar-btn btn-small ${editor.isActive('subscript') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              title={t('subscript', language)}
            >
              X₂
            </button>
            <button
              className={`editor-toolbar-btn btn-small ${editor.isActive('superscript') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              title={t('superscript', language)}
            >
              X²
            </button>
          </div>

          {/* Headings */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title={t('heading1', language)}
            >
              H1
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title={t('heading2', language)}
            >
              H2
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title={t('heading3', language)}
            >
              H3
            </button>
          </div>

          {/* Lists */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title={t('bulletList', language)}
            >
              •≡
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title={t('orderedList', language)}
            >
              1.
            </button>
            <button
              className={`editor-toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              title={t('checklist', language)}
            >
              ☑
            </button>
          </div>

          {/* Block elements */}
          <div className="editor-toolbar-group">
            <button
              className={`editor-toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title={t('blockquote', language)}
            >
              ❝
            </button>
            <div className="editor-toolbar-dropdown-wrapper">
              <button
                className={`editor-toolbar-btn ${editor.isActive('callout') ? 'active' : ''}`}
                onClick={() => setShowCalloutPicker(!showCalloutPicker)}
                title={t('callout', language)}
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
              title={t('codeBlock', language)}
            >
              {'</>'}
            </button>
            <button
              className="editor-toolbar-btn"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title={t('horizontalRule', language)}
            >
              ―
            </button>
          </div>

          {/* Insert */}
          <div className="editor-toolbar-group">
            <button
              className="editor-toolbar-btn"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title={t('insertTable', language)}
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
              title={t('insertLinkCard', language)}
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
              title={t('indent', language)}
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
              title={t('outdent', language)}
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
