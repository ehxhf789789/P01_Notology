import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '../stores/zustand/modalStore';
import ParticipantInput from './ParticipantInput';

export interface MeetingFormData {
  title: string;
  participants: string;
  date: string;
  time: string;
}

function MeetingInputModal() {
  const meetingInputModalState = useModalStore(s => s.meetingInputModalState);
  const hideMeetingInputModal = useModalStore(s => s.hideMeetingInputModal);
  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    participants: '',
    date: '',
    time: '',
  });
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (meetingInputModalState) {
      // Set default date to today
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, date: dateStr, time: timeStr }));

      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }
  }, [meetingInputModalState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideMeetingInputModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hideMeetingInputModal]);

  if (!meetingInputModalState || !meetingInputModalState.visible) return null;

  const { callback } = meetingInputModalState;

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('미팅 제목을 입력하세요');
      return;
    }
    callback(formData);
    hideMeetingInputModal();
    setFormData({ title: '', participants: '', date: '', time: '' });
  };

  const handleCancel = () => {
    hideMeetingInputModal();
    setFormData({ title: '', participants: '', date: '', time: '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="meeting-input-modal" onKeyDown={handleKeyDown}>
        <div className="meeting-input-header">새 미팅 노트 생성</div>

        <div className="meeting-input-body">
          <div className="meeting-input-field">
            <label className="meeting-input-label">미팅 제목 *</label>
            <input
              ref={titleInputRef}
              className="meeting-input-input"
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 주간 팀 미팅"
            />
          </div>

          <div className="meeting-input-field">
            <label className="meeting-input-label">참석자</label>
            <ParticipantInput
              value={formData.participants}
              onChange={(participants) => setFormData({ ...formData, participants })}
              placeholder="예: @홍길동, @김철수 또는 이름 직접 입력"
            />
          </div>

          <div className="meeting-input-row">
            <div className="meeting-input-field">
              <label className="meeting-input-label">날짜</label>
              <input
                className="meeting-input-input"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="meeting-input-field">
              <label className="meeting-input-label">시간</label>
              <input
                className="meeting-input-input"
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="meeting-input-actions">
          <button className="meeting-input-btn meeting-input-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="meeting-input-btn meeting-input-submit" onClick={handleSubmit}>
            생성 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingInputModal;
