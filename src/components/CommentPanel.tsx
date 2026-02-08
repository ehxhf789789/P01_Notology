import { useState, useRef, useEffect } from 'react';
import type { NoteComment, CanvasSelection } from '../types';
import { generateCommentId } from '../utils/comments';

interface CommentPanelProps {
  comments: NoteComment[];
  onAddComment: (comment: NoteComment) => void;
  onDeleteComment: (commentId: string) => void;
  onResolveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, updatedComment: NoteComment) => void;
  onCancel?: () => void;
  selectedText: string;
  selectionRange: { from: number; to: number } | null;
  activeCommentId: string | null;
  canvasSelection?: CanvasSelection | null;
  initialTaskMode?: boolean;
}

function CommentPanel({
  comments,
  onAddComment,
  onDeleteComment,
  onResolveComment,
  onUpdateComment,
  onCancel,
  selectedText,
  selectionRange,
  activeCommentId,
  canvasSelection,
  initialTaskMode,
}: CommentPanelProps) {
  const [newContent, setNewContent] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskDueTime, setEditTaskDueTime] = useState('');
  const activeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isTaskMode = !!initialTaskMode;

  useEffect(() => {
    if (activeCommentId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  // Auto-focus textarea when selection appears
  useEffect(() => {
    if (selectionRange && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectionRange]);

  const handleCancel = () => {
    setNewContent('');
    setTaskDueDate('');
    setTaskDueTime('');
    onCancel?.();
  };

  const handleAdd = () => {
    if (!newContent.trim() || !selectionRange) return;
    if (isTaskMode && !taskDueDate) {
      alert('마감 날짜를 선택하세요.');
      return;
    }

    const now = new Date();
    const comment: NoteComment = {
      id: generateCommentId(),
      content: newContent.trim(),
      position: selectionRange,
      anchorText: selectedText,
      created: now.toISOString().split('T')[0],
      createdTime: now.toISOString(),
      resolved: false,
    };

    if (canvasSelection) {
      comment.canvasNodeId = canvasSelection.nodeId;
      comment.canvasTextPosition = { from: canvasSelection.from, to: canvasSelection.to };
    }

    if (isTaskMode) {
      comment.task = {
        summary: newContent.trim(),
        dueDate: taskDueDate || undefined,
        dueTime: taskDueTime || undefined,
      };
    }

    onAddComment(comment);
    setNewContent('');
    setTaskDueDate('');
    setTaskDueTime('');
  };

  const handleStartEdit = (comment: NoteComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    if (comment.task) {
      setEditTaskDueDate(comment.task.dueDate || '');
      setEditTaskDueTime(comment.task.dueTime || '');
    }
  };

  const handleSaveEdit = (comment: NoteComment) => {
    if (!editContent.trim()) return;

    const updatedComment: NoteComment = {
      ...comment,
      content: editContent.trim(),
    };

    if (comment.task) {
      updatedComment.task = {
        summary: editContent.trim(),
        dueDate: editTaskDueDate || undefined,
        dueTime: editTaskDueTime || undefined,
      };
    }

    onUpdateComment(comment.id, updatedComment);
    setEditingCommentId(null);
    setEditContent('');
    setEditTaskDueDate('');
    setEditTaskDueTime('');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
    setEditTaskDueDate('');
    setEditTaskDueTime('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <span className="comment-panel-title">메모</span>
        <span className="comment-panel-count">{unresolvedComments.length}</span>
      </div>

      {/* Add new comment */}
      {selectionRange && (
        <div className={`comment-new ${isTaskMode ? 'task-mode' : ''}`}>
          <div className="comment-new-header">
            <span className="comment-new-mode-label">
              {isTaskMode ? '할일 추가' : '메모 추가'}
            </span>
          </div>
          <div className="comment-new-anchor">
            "{selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText}"
          </div>
          <textarea
            ref={inputRef}
            className="comment-new-input"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTaskMode ? '할일 내용 입력... (Ctrl+Enter: 추가)' : '메모 입력... (Ctrl+Enter: 추가)'}
            rows={3}
          />

          {/* Task fields (shown when task mode from context menu) */}
          {isTaskMode && (
            <div className="comment-task-fields">
              <div className="comment-task-field">
                <label htmlFor="task-due-date">마감 날짜 *</label>
                <input
                  id="task-due-date"
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="comment-task-field">
                <label htmlFor="task-due-time">마감 시간</label>
                <input
                  id="task-due-time"
                  type="time"
                  value={taskDueTime}
                  onChange={e => setTaskDueTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="comment-new-actions">
            <button className="comment-add-btn" onClick={handleAdd} disabled={!newContent.trim()}>
              추가
            </button>
            <button className="comment-cancel-btn" onClick={handleCancel}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="comment-list">
        {unresolvedComments.length === 0 && !selectionRange && (
          <div className="comment-empty">
            텍스트를 선택하여 메모를 추가하세요
          </div>
        )}
        {unresolvedComments.map(comment => (
          <div
            key={comment.id}
            ref={activeCommentId === comment.id ? activeRef : undefined}
            className={`comment-item ${activeCommentId === comment.id ? 'active' : ''} ${comment.task ? 'task' : ''} ${comment.resolved ? 'resolved' : ''}`}
          >
            <div className="comment-item-anchor">"{comment.anchorText.substring(0, 30)}"</div>

            {/* Edit mode */}
            {editingCommentId === comment.id ? (
              <div className="comment-edit-mode">
                <textarea
                  className="comment-edit-input"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={3}
                />
                {comment.task && (
                  <div className="comment-task-fields">
                    <div className="comment-task-field">
                      <label>마감 날짜</label>
                      <input
                        type="date"
                        value={editTaskDueDate}
                        onChange={e => setEditTaskDueDate(e.target.value)}
                      />
                    </div>
                    <div className="comment-task-field">
                      <label>마감 시간</label>
                      <input
                        type="time"
                        value={editTaskDueTime}
                        onChange={e => setEditTaskDueTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div className="comment-edit-actions">
                  <button
                    className="comment-edit-save-btn"
                    onClick={() => handleSaveEdit(comment)}
                  >
                    저장
                  </button>
                  <button
                    className="comment-edit-cancel-btn"
                    onClick={handleCancelEdit}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Task or regular comment content */}
                {comment.task ? (
                  <div className="comment-task-content">
                    <div className="comment-task-header">
                      <input
                        type="checkbox"
                        className="comment-task-checkbox"
                        checked={comment.resolved}
                        onChange={() => {
                          const updatedComment = {
                            ...comment,
                            resolved: !comment.resolved,
                          };
                          onUpdateComment(comment.id, updatedComment);
                        }}
                      />
                      <span className={`comment-task-title ${comment.resolved ? 'completed' : ''}`}>
                        {comment.task.summary}
                      </span>
                    </div>
                    {(comment.task.dueDate || comment.task.dueTime) && (
                      <div className="comment-task-meta">
                        {comment.task.dueDate && (
                          <div className="comment-task-date">{comment.task.dueDate}</div>
                        )}
                        {comment.task.dueTime && (
                          <div className="comment-task-time">{comment.task.dueTime}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="comment-item-content">{comment.content}</div>
                )}

                <div className="comment-item-footer">
                  <span className="comment-item-date">
                    {comment.createdTime
                      ? new Date(comment.createdTime).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : new Date(comment.created).toLocaleDateString('ko-KR')}
                  </span>
                  <div className="comment-item-actions">
                    {!comment.task && (
                      <button
                        className="comment-action-btn"
                        onClick={() => onResolveComment(comment.id)}
                        title={comment.resolved ? '미해결로 변경' : '해결'}
                      >
                        {comment.resolved ? '○' : '✓'}
                      </button>
                    )}
                    <button
                      className="comment-action-btn"
                      onClick={() => handleStartEdit(comment)}
                      title="편집"
                    >
                      ✎
                    </button>
                    <button
                      className="comment-action-btn comment-delete-btn"
                      onClick={() => onDeleteComment(comment.id)}
                      title="삭제"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Resolved comments */}
      {resolvedComments.length > 0 && (
        <div className="comment-resolved-section">
          <button
            className="comment-resolved-toggle"
            onClick={() => setShowResolved(!showResolved)}
          >
            해결됨 ({resolvedComments.length}) {showResolved ? '▾' : '▸'}
          </button>
          {showResolved && resolvedComments.map(comment => (
            <div key={comment.id} className={`comment-item resolved ${comment.task ? 'task' : ''}`}>
              <div className="comment-item-anchor">"{comment.anchorText.substring(0, 30)}"</div>

              {comment.task ? (
                <div className="comment-task-content">
                  <div className="comment-task-header">
                    <input
                      type="checkbox"
                      className="comment-task-checkbox"
                      checked={comment.resolved}
                      onChange={() => {
                        const updatedComment = {
                          ...comment,
                          resolved: !comment.resolved,
                        };
                        onUpdateComment(comment.id, updatedComment);
                      }}
                    />
                    <span className={`comment-task-title ${comment.resolved ? 'completed' : ''}`}>
                      {comment.task.summary}
                    </span>
                  </div>
                  {(comment.task.dueDate || comment.task.dueTime) && (
                    <div className="comment-task-meta">
                      {comment.task.dueDate && (
                        <div className="comment-task-date">{comment.task.dueDate}</div>
                      )}
                      {comment.task.dueTime && (
                        <div className="comment-task-time">{comment.task.dueTime}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="comment-item-content">{comment.content}</div>
              )}

              <div className="comment-item-footer">
                <span className="comment-item-date">
                  {comment.createdTime
                    ? new Date(comment.createdTime).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date(comment.created).toLocaleDateString('ko-KR')}
                </span>
                <button
                  className="comment-action-btn comment-delete-btn"
                  onClick={() => onDeleteComment(comment.id)}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentPanel;
