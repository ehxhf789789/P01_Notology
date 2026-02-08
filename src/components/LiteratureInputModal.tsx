import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import TagInputSection, { type FacetedTagSelection } from './TagInputSection';

export interface LiteratureFormData {
  title: string;
  authors: string;
  year: string;
  publisher: string;
  source: string;
  url: string;
  tags?: FacetedTagSelection;
}

const DEFAULT_TAGS: FacetedTagSelection = {
  domain: [],
  who: [],
  org: [],
  ctx: [],
};

function LiteratureInputModal() {
  const literatureInputModalState = useModalStore(s => s.literatureInputModalState);
  const hideLiteratureInputModal = useModalStore(s => s.hideLiteratureInputModal);
  const language = useSettingsStore(s => s.language);
  const [formData, setFormData] = useState<LiteratureFormData>({
    title: '',
    authors: '',
    year: '',
    publisher: '',
    source: '',
    url: '',
  });
  const [selectedTags, setSelectedTags] = useState<FacetedTagSelection>(DEFAULT_TAGS);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (literatureInputModalState) {
      // Set default year to current year
      const currentYear = new Date().getFullYear().toString();
      setFormData(prev => ({ ...prev, year: currentYear }));

      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }
  }, [literatureInputModalState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideLiteratureInputModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hideLiteratureInputModal]);

  if (!literatureInputModalState || !literatureInputModalState.visible) return null;

  const { callback } = literatureInputModalState;

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('문헌 제목을 입력하세요');
      return;
    }
    callback({ ...formData, tags: selectedTags });
    hideLiteratureInputModal();
    setFormData({ title: '', authors: '', year: '', publisher: '', source: '', url: '' });
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleCancel = () => {
    hideLiteratureInputModal();
    setFormData({ title: '', authors: '', year: '', publisher: '', source: '', url: '' });
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="literature-input-modal" onKeyDown={handleKeyDown}>
        <div className="literature-input-header">새 문헌 노트 생성</div>

        <div className="literature-input-body">
          <div className="literature-input-field">
            <label className="literature-input-label">문헌 제목 *</label>
            <input
              ref={titleInputRef}
              className="literature-input-input"
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="문헌 제목"
            />
          </div>

          <div className="literature-input-field">
            <label className="literature-input-label">저자</label>
            <input
              className="literature-input-input"
              type="text"
              value={formData.authors}
              onChange={e => setFormData({ ...formData, authors: e.target.value })}
              placeholder="예: Smith, J., Lee, H., Kim, S."
            />
          </div>

          <div className="literature-input-row">
            <div className="literature-input-field">
              <label className="literature-input-label">발행년도</label>
              <input
                className="literature-input-input"
                type="text"
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                placeholder="2024"
              />
            </div>

            <div className="literature-input-field">
              <label className="literature-input-label">출판사</label>
              <input
                className="literature-input-input"
                type="text"
                value={formData.publisher}
                onChange={e => setFormData({ ...formData, publisher: e.target.value })}
                placeholder="예: Springer"
              />
            </div>
          </div>

          <div className="literature-input-field">
            <label className="literature-input-label">출처</label>
            <input
              className="literature-input-input"
              type="text"
              value={formData.source}
              onChange={e => setFormData({ ...formData, source: e.target.value })}
              placeholder="예: 보고서, 백서, 가이드북 등"
            />
          </div>

          <div className="literature-input-field">
            <label className="literature-input-label">URL</label>
            <input
              className="literature-input-input"
              type="url"
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <TagInputSection
            value={selectedTags}
            onChange={setSelectedTags}
            language={language}
            collapsed={true}
          />
        </div>

        <div className="literature-input-actions">
          <button className="literature-input-btn literature-input-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="literature-input-btn literature-input-submit" onClick={handleSubmit}>
            생성 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiteratureInputModal;
