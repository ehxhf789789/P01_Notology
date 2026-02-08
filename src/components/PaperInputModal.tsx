import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import TagInputSection, { type FacetedTagSelection } from './TagInputSection';

export interface PaperFormData {
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi: string;
  url: string;
  tags?: FacetedTagSelection;
}

const DEFAULT_TAGS: FacetedTagSelection = {
  domain: [],
  who: [],
  org: [],
  ctx: [],
};

function PaperInputModal() {
  const paperInputModalState = useModalStore(s => s.paperInputModalState);
  const hidePaperInputModal = useModalStore(s => s.hidePaperInputModal);
  const language = useSettingsStore(s => s.language);
  const [formData, setFormData] = useState<PaperFormData>({
    title: '',
    authors: '',
    year: '',
    venue: '',
    doi: '',
    url: '',
  });
  const [selectedTags, setSelectedTags] = useState<FacetedTagSelection>(DEFAULT_TAGS);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paperInputModalState) {
      // Set default year to current year
      const currentYear = new Date().getFullYear().toString();
      setFormData(prev => ({ ...prev, year: currentYear }));

      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }
  }, [paperInputModalState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hidePaperInputModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hidePaperInputModal]);

  if (!paperInputModalState || !paperInputModalState.visible) return null;

  const { callback } = paperInputModalState;

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('논문 제목을 입력하세요');
      return;
    }
    callback({ ...formData, tags: selectedTags });
    hidePaperInputModal();
    setFormData({ title: '', authors: '', year: '', venue: '', doi: '', url: '' });
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleCancel = () => {
    hidePaperInputModal();
    setFormData({ title: '', authors: '', year: '', venue: '', doi: '', url: '' });
    setSelectedTags(DEFAULT_TAGS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="paper-input-modal" onKeyDown={handleKeyDown}>
        <div className="paper-input-header">새 논문 노트 생성</div>

        <div className="paper-input-body">
          <div className="paper-input-field">
            <label className="paper-input-label">논문 제목 *</label>
            <input
              ref={titleInputRef}
              className="paper-input-input"
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="논문 제목"
            />
          </div>

          <div className="paper-input-field">
            <label className="paper-input-label">저자</label>
            <input
              className="paper-input-input"
              type="text"
              value={formData.authors}
              onChange={e => setFormData({ ...formData, authors: e.target.value })}
              placeholder="예: Smith, J., Lee, H., Kim, S."
            />
          </div>

          <div className="paper-input-row">
            <div className="paper-input-field">
              <label className="paper-input-label">발행년도</label>
              <input
                className="paper-input-input"
                type="text"
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                placeholder="2024"
              />
            </div>

            <div className="paper-input-field">
              <label className="paper-input-label">출판처</label>
              <input
                className="paper-input-input"
                type="text"
                value={formData.venue}
                onChange={e => setFormData({ ...formData, venue: e.target.value })}
                placeholder="예: NeurIPS 2024"
              />
            </div>
          </div>

          <div className="paper-input-field">
            <label className="paper-input-label">DOI</label>
            <input
              className="paper-input-input"
              type="text"
              value={formData.doi}
              onChange={e => setFormData({ ...formData, doi: e.target.value })}
              placeholder="10.1000/example.doi"
            />
          </div>

          <div className="paper-input-field">
            <label className="paper-input-label">URL</label>
            <input
              className="paper-input-input"
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

        <div className="paper-input-actions">
          <button className="paper-input-btn paper-input-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="paper-input-btn paper-input-submit" onClick={handleSubmit}>
            생성 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaperInputModal;
