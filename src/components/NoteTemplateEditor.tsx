import { useState } from 'react';
import type { NoteTemplate } from '../types';

interface NoteTemplateEditorProps {
  template?: NoteTemplate;
  onSave: (template: NoteTemplate) => void;
  onCancel: () => void;
}

const COLOR_THEMES = [
  { label: 'Purple (NOTE)', value: 'note-type', color: '#a78bfa' },
  { label: 'Blue (MTG)', value: 'mtg-type', color: '#60a5fa' },
  { label: 'Green (OFA)', value: 'ofa-type', color: '#34d399' },
  { label: 'Orange (SEM)', value: 'sem-type', color: '#fb923c' },
  { label: 'Red (EVENT)', value: 'event-type', color: '#f87171' },
  { label: 'Cyan (CONTACT)', value: 'contact-type', color: '#22d3ee' },
  { label: 'Gray (SETUP)', value: 'setup-type', color: '#9ca3af' },
  { label: 'Amber (DATA)', value: 'data-type', color: '#fbbf24' },
  { label: 'Indigo (THEO)', value: 'theo-type', color: '#818cf8' },
  { label: 'Teal (PAPER)', value: 'paper-type', color: '#5eead4' },
  { label: 'Pink (SKETCH)', value: 'sketch-type', color: '#f472b6' },
  { label: 'Rose (LIT)', value: 'lit-type', color: '#fb7185' },
];

const ICON_OPTIONS = [
  { value: 'note', label: '노트' },
  { value: 'mtg', label: '회의' },
  { value: 'ofa', label: '공문' },
  { value: 'sem', label: '세미나' },
  { value: 'event', label: '이벤트' },
  { value: 'contact', label: '연락처' },
  { value: 'setup', label: '설정' },
  { value: 'data', label: '데이터' },
  { value: 'theo', label: '이론' },
  { value: 'paper', label: '논문' },
  { value: 'sketch', label: '스케치' },
  { value: 'lit', label: '문헌' },
];

// Parse markdown body to extract headers
function parseHeaders(body: string): string[] {
  const lines = body.split('\n');
  const headers: string[] = [];
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)$/);
    if (match) {
      headers.push(match[1]);
    }
  }
  return headers.length > 0 ? headers : ['Overview', 'Content'];
}

// Generate markdown body from headers
function generateBody(headers: string[]): string {
  if (headers.length === 0) return '---\n# Overview\n\n---\n# Content\n\n';
  return headers.map((h, i) => `${i > 0 ? '---\n' : ''}# ${h}\n\n`).join('');
}

function NoteTemplateEditor({ template, onSave, onCancel }: NoteTemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [prefix, setPrefix] = useState(template?.prefix || '');
  const [namePattern, setNamePattern] = useState(template?.namePattern || '{{title}}');
  const [headers, setHeaders] = useState<string[]>(template?.body ? parseHeaders(template.body) : ['Overview', 'Content']);
  const [tags, setTags] = useState(template?.frontmatter.tags?.join(', ') || '');
  const [cssclasses, setCssclasses] = useState(template?.frontmatter.cssclasses?.join(', ') || '');
  const [type, setType] = useState(template?.frontmatter.type || 'NOTE');
  const [customColor, setCustomColor] = useState(template?.customColor || '');
  const [useCustomColor, setUseCustomColor] = useState(!!template?.customColor);
  const [icon, setIcon] = useState(template?.icon || 'note');
  // Tag categories
  const [domainTags, setDomainTags] = useState(template?.tagCategories?.domain?.join(', ') || '');
  const [whoTags, setWhoTags] = useState(template?.tagCategories?.who?.join(', ') || '');
  const [orgTags, setOrgTags] = useState(template?.tagCategories?.org?.join(', ') || '');
  const [ctxTags, setCtxTags] = useState(template?.tagCategories?.ctx?.join(', ') || '');

  const handleSave = () => {
    if (!name.trim() || !prefix.trim()) return;

    const newTemplate: NoteTemplate = {
      id: template?.id || `note-custom-${Date.now()}`,
      name: name.trim(),
      prefix: prefix.trim().toUpperCase(),
      namePattern: namePattern.trim(),
      frontmatter: {
        type: type as string,
        cssclasses: cssclasses ? cssclasses.split(',').map(s => s.trim()).filter(Boolean) : [],
        tags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [],
      },
      body: generateBody(headers),
      customColor: useCustomColor && customColor ? customColor : undefined,
      icon,
      tagCategories: {
        domain: domainTags ? domainTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        who: whoTags ? whoTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        org: orgTags ? orgTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        ctx: ctxTags ? ctxTags.split(',').map(s => s.trim()).filter(Boolean) : [],
      },
    };

    onSave(newTemplate);
  };

  return (
    <div className="template-editor">
      <div className="template-editor-header">
        <button className="template-editor-back-btn" onClick={onCancel} title="뒤로 가기">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z"/>
          </svg>
        </button>
        <h3 className="template-editor-title">
          {template ? '템플릿 편집' : '새 템플릿 만들기'}
        </h3>
      </div>

      {/* Basic Info Section */}
      <div className="template-editor-section">
        <h4 className="template-editor-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          기본 정보
        </h4>
        <div className="template-editor-row">
          <div className="template-editor-field">
            <label className="template-editor-label">템플릿 이름</label>
            <input
              className="template-editor-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: Weekly Report"
            />
          </div>
          <div className="template-editor-field">
            <label className="template-editor-label">접두어</label>
            <input
              className="template-editor-input"
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              placeholder="예: RPT"
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        </div>
        <div className="template-editor-field">
          <label className="template-editor-label">타입</label>
          <input
            className="template-editor-input"
            value={type}
            onChange={e => setType(e.target.value)}
            placeholder="NOTE"
            style={{ width: '120px', textTransform: 'uppercase' }}
          />
        </div>
      </div>

      {/* Appearance Section */}
      <div className="template-editor-section">
        <h4 className="template-editor-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="21.17" y1="8" x2="12" y2="8"/>
            <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
            <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
          </svg>
          외관
        </h4>
        <div className="template-editor-field">
          <label className="template-editor-label">아이콘</label>
          <div className="icon-selector-grid">
            {ICON_OPTIONS.map(opt => {
              const isSelected = icon === opt.value;
              const iconClass = `icon-${opt.value}`;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`icon-selector-option${isSelected ? ' selected' : ''}`}
                  onClick={() => setIcon(opt.value)}
                  title={opt.label}
                >
                  <span className={`icon-selector-preview template-selector-icon ${iconClass}`} />
                  <span className="icon-selector-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="template-editor-field">
          <label className="template-editor-label">색상 테마</label>
          <div className="color-theme-picker">
            {COLOR_THEMES.map(theme => {
              const isSelected = !useCustomColor && cssclasses === theme.value;
              return (
                <button
                  key={theme.value}
                  className={`color-theme-swatch${isSelected ? ' selected' : ''}`}
                  style={{
                    backgroundColor: theme.color,
                    borderColor: theme.color,
                  }}
                  onClick={() => {
                    setCssclasses(theme.value);
                    setUseCustomColor(false);
                  }}
                  title={theme.label}
                  type="button"
                >
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="color-custom-picker">
            <label className="template-editor-checkbox">
              <input
                type="checkbox"
                checked={useCustomColor}
                onChange={e => setUseCustomColor(e.target.checked)}
              />
              사용자 지정 색상
            </label>
            {useCustomColor && (
              <div className="color-custom-input-row">
                <input
                  type="color"
                  className="color-picker-input"
                  value={customColor || '#a78bfa'}
                  onChange={e => setCustomColor(e.target.value)}
                />
                <input
                  type="text"
                  className="template-editor-input"
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value)}
                  placeholder="#a78bfa"
                  style={{ width: '100px' }}
                />
              </div>
            )}
          </div>
          <span className="template-editor-hint">
            선택한 색상이 편집기, 검색, Hover 창에 자동 적용됩니다
          </span>
        </div>
      </div>

      {/* Tags Section */}
      <div className="template-editor-section">
        <h4 className="template-editor-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          태그
        </h4>
        <div className="template-editor-field">
          <label className="template-editor-label">기본 태그</label>
          <input
            className="template-editor-input"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="쉼표로 구분하여 입력"
          />
        </div>
        <div className="template-editor-field">
          <label className="template-editor-label">태그 카테고리 (자동완성용)</label>
          <div className="tag-categories-grid">
            <div className="tag-category-row">
              <span className="tag-category-label">domain/</span>
              <input
                className="template-editor-input"
                value={domainTags}
                onChange={e => setDomainTags(e.target.value)}
                placeholder="분야 태그"
              />
            </div>
            <div className="tag-category-row">
              <span className="tag-category-label">who/</span>
              <input
                className="template-editor-input"
                value={whoTags}
                onChange={e => setWhoTags(e.target.value)}
                placeholder="사람 태그"
              />
            </div>
            <div className="tag-category-row">
              <span className="tag-category-label">org/</span>
              <input
                className="template-editor-input"
                value={orgTags}
                onChange={e => setOrgTags(e.target.value)}
                placeholder="조직 태그"
              />
            </div>
            <div className="tag-category-row">
              <span className="tag-category-label">ctx/</span>
              <input
                className="template-editor-input"
                value={ctxTags}
                onChange={e => setCtxTags(e.target.value)}
                placeholder="맥락 태그"
              />
            </div>
          </div>
          <span className="template-editor-hint">
            자주 사용하는 태그를 미리 등록하면 입력 시 자동완성됩니다
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="template-editor-section">
        <h4 className="template-editor-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          본문 구조
        </h4>
        <div className="template-editor-field">
          <label className="template-editor-label">섹션 헤더</label>
          <div className="header-editor-container">
            {headers.map((header, index) => (
              <div key={index} className="header-editor-row">
                <span className="header-editor-number">{index + 1}</span>
                <input
                  type="text"
                  className="template-editor-input"
                  value={header}
                  onChange={e => {
                    const newHeaders = [...headers];
                    newHeaders[index] = e.target.value;
                    setHeaders(newHeaders);
                  }}
                  placeholder={`섹션 ${index + 1}`}
                />
                <button
                  type="button"
                  className="header-editor-remove-btn"
                  onClick={() => {
                    if (headers.length > 1) {
                      setHeaders(headers.filter((_, i) => i !== index));
                    }
                  }}
                  title="섹션 삭제"
                  disabled={headers.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="header-editor-add-btn"
              onClick={() => setHeaders([...headers, ''])}
            >
              + 섹션 추가
            </button>
          </div>
          <span className="template-editor-hint">
            각 섹션은 구분선(---)으로 구분됩니다
          </span>
        </div>
      </div>

      <div className="template-editor-actions">
        <button className="template-editor-cancel-btn" onClick={onCancel}>취소</button>
        <button className="template-editor-save-btn" onClick={handleSave}>저장</button>
      </div>
    </div>
  );
}

export default NoteTemplateEditor;
