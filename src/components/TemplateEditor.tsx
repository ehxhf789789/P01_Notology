import { useState } from 'react';
import type { FolderNoteTemplate } from '../types';

interface TemplateEditorProps {
  template?: FolderNoteTemplate;
  onSave: (template: FolderNoteTemplate) => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [level, setLevel] = useState(template?.level ?? 0);
  const [body, setBody] = useState(template?.body || '# {{title}}\n\n');
  const [tags, setTags] = useState(template?.frontmatter.tags?.join(', ') || '');
  const [cssclasses, setCssclasses] = useState(template?.frontmatter.cssclasses?.join(', ') || '');

  const handleSave = () => {
    if (!name.trim()) return;

    const newTemplate: FolderNoteTemplate = {
      id: template?.id || `b-${Date.now()}`,
      name: name.trim(),
      type: 'B',
      level,
      frontmatter: {
        type: 'FOLDER',
        cssclasses: cssclasses ? cssclasses.split(',').map(s => s.trim()).filter(Boolean) : [],
        tags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [],
      },
      body,
    };

    onSave(newTemplate);
  };

  return (
    <div className="template-editor">
      <div className="template-editor-field">
        <label className="template-editor-label">이름</label>
        <input
          className="template-editor-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="템플릿 이름"
        />
      </div>

      <div className="template-editor-field">
        <label className="template-editor-label">레벨</label>
        <input
          className="template-editor-input template-editor-input-small"
          type="number"
          min={0}
          max={10}
          value={level}
          onChange={e => setLevel(Number(e.target.value))}
        />
      </div>

      <div className="template-editor-field">
        <label className="template-editor-label">CSS Classes</label>
        <input
          className="template-editor-input"
          value={cssclasses}
          onChange={e => setCssclasses(e.target.value)}
          placeholder="folder-custom (쉼표로 구분)"
        />
      </div>

      <div className="template-editor-field">
        <label className="template-editor-label">태그</label>
        <input
          className="template-editor-input"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="태그 (쉼표로 구분)"
        />
      </div>

      <div className="template-editor-field">
        <label className="template-editor-label">본문 (Markdown)</label>
        <textarea
          className="template-editor-textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          placeholder="# {{title}}"
        />
      </div>

      <div className="template-editor-actions">
        <button className="settings-action-btn" onClick={onCancel}>취소</button>
        <button className="template-editor-save-btn" onClick={handleSave}>저장</button>
      </div>
    </div>
  );
}

export default TemplateEditor;
