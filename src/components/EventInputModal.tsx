import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';

export interface EventFormData {
  title: string;
  date: string;
  location: string;
  organizer: string;
  participants: string;
}

function EventInputModal() {
  const eventInputModalState = useModalStore(s => s.eventInputModalState);
  const hideEventInputModal = useModalStore(s => s.hideEventInputModal);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    date: '',
    location: '',
    organizer: '',
    participants: '',
  });
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventInputModalState) {
      // Set default date to today
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, date: dateStr }));

      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }
  }, [eventInputModalState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideEventInputModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hideEventInputModal]);

  if (!eventInputModalState || !eventInputModalState.visible) return null;

  const { callback } = eventInputModalState;

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('행사 제목을 입력하세요');
      return;
    }
    callback(formData);
    hideEventInputModal();
    setFormData({ title: '', date: '', location: '', organizer: '', participants: '' });
  };

  const handleCancel = () => {
    hideEventInputModal();
    setFormData({ title: '', date: '', location: '', organizer: '', participants: '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="event-input-modal" onKeyDown={handleKeyDown}>
        <div className="event-input-header">새 행사 노트 생성</div>

        <div className="event-input-body">
          <div className="event-input-field">
            <label className="event-input-label">행사 제목 *</label>
            <input
              ref={titleInputRef}
              className="event-input-input"
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 2024 AI 학회"
            />
          </div>

          <div className="event-input-field">
            <label className="event-input-label">날짜</label>
            <input
              className="event-input-input"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div className="event-input-field">
            <label className="event-input-label">장소</label>
            <input
              className="event-input-input"
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="예: 서울 코엑스"
            />
          </div>

          <div className="event-input-field">
            <label className="event-input-label">주최</label>
            <input
              className="event-input-input"
              type="text"
              value={formData.organizer}
              onChange={e => setFormData({ ...formData, organizer: e.target.value })}
              placeholder="주최 기관/단체"
            />
          </div>

          <div className="event-input-field">
            <label className="event-input-label">참가자</label>
            <input
              className="event-input-input"
              type="text"
              value={formData.participants}
              onChange={e => setFormData({ ...formData, participants: e.target.value })}
              placeholder="예: 홍길동, 김철수, 이영희"
            />
          </div>
        </div>

        <div className="event-input-actions">
          <button className="event-input-btn event-input-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="event-input-btn event-input-submit" onClick={handleSubmit}>
            생성 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventInputModal;
