import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import TagInputSection, { type FacetedTagSelection } from './TagInputSection';

const DEFAULT_TAGS: FacetedTagSelection = {
  domain: [],
  who: [],
  org: [],
  ctx: [],
};

function TitleInputModal() {
  const titleInputModalState = useModalStore(s => s.titleInputModalState);
  const hideTitleInputModal = useModalStore(s => s.hideTitleInputModal);
  const language = useSettingsStore(s => s.language);
  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<FacetedTagSelection>(DEFAULT_TAGS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (titleInputModalState && inputRef.current) {
      inputRef.current.focus();
    }
  }, [titleInputModalState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideTitleInputModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hideTitleInputModal]);

  if (!titleInputModalState || !titleInputModalState.visible) return null;

  const { callback, placeholder, title, templateInfo } = titleInputModalState;

  const handleSubmit = () => {
    if (!inputValue.trim()) {
      alert(language === 'ko' ? '제목을 입력하세요' : 'Please enter a title');
      return;
    }
    callback({ title: inputValue.trim(), tags: selectedTags });
    hideTitleInputModal();
    setInputValue('');
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleCancel = () => {
    hideTitleInputModal();
    setInputValue('');
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const iconClass = templateInfo ? `icon-${templateInfo.noteType}` : '';

  return (
    <div className="modal-overlay">
      <div className={`title-input-modal ${templateInfo ? 'with-template-info' : ''}`}>
        <div className="title-input-header">{title || '새 노트 생성'}</div>
        {templateInfo && (
          <div className="title-input-template-info">
            <span
              className={`title-input-template-icon template-selector-icon ${iconClass}`}
              style={templateInfo.customColor ? { backgroundColor: templateInfo.customColor } : undefined}
            />
            <div className="title-input-template-details">
              <div className="title-input-template-name">{templateInfo.name}</div>
              <div className="title-input-template-desc">{templateInfo.description}</div>
            </div>
          </div>
        )}
        <div className="title-input-body">
          <input
            ref={inputRef}
            className="title-input-field"
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || (language === 'ko' ? '노트 제목을 입력하세요' : 'Enter note title')}
          />
          <TagInputSection
            value={selectedTags}
            onChange={setSelectedTags}
            language={language}
            collapsed={true}
          />
        </div>
        <div className="title-input-actions">
          <button className="title-input-btn title-input-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="title-input-btn title-input-submit" onClick={handleSubmit}>
            생성 (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

export default TitleInputModal;
