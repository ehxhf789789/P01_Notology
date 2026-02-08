import { X } from 'lucide-react';
import type { SearchMode, AttachmentInfo } from '../../types';
import type { LanguageSetting } from '../../utils/i18n';
import { NOTE_TYPES, noteTypeToFullName } from './searchHelpers';

export interface SearchFiltersProps {
  mode: SearchMode;
  // Frontmatter filters
  frontmatterTypeFilter: string;
  setFrontmatterTypeFilter: (v: string) => void;
  frontmatterTagFilter: string;
  setFrontmatterTagFilter: (v: string) => void;
  frontmatterMemoFilter: 'all' | 'has' | 'none';
  setFrontmatterMemoFilter: (v: 'all' | 'has' | 'none') => void;
  showFolderNotes: boolean;
  setShowFolderNotes: (v: boolean) => void;
  showDateFilters: boolean;
  setShowDateFilters: (v: boolean) => void;
  createdAfter: string;
  setCreatedAfter: (v: string) => void;
  createdBefore: string;
  setCreatedBefore: (v: string) => void;
  modifiedAfter: string;
  setModifiedAfter: (v: string) => void;
  modifiedBefore: string;
  setModifiedBefore: (v: string) => void;
  // Contents filters
  showContentsFilters: boolean;
  contentsTypeFilter: string;
  setContentsTypeFilter: (v: string) => void;
  // Attachments filters
  showAttachmentsFilters: boolean;
  attachmentsContainerFilter: string;
  setAttachmentsContainerFilter: (v: string) => void;
  attachmentsExtensionFilter: string;
  setAttachmentsExtensionFilter: (v: string) => void;
  attachmentsShowDummyOnly: boolean;
  setAttachmentsShowDummyOnly: (v: boolean) => void;
  attachmentsNotePathFilter: string;
  setAttachmentsNotePathFilter: (v: string) => void;
  // Data for dropdowns
  uniqueTags: string[];
  filteredAttachments: AttachmentInfo[];
  selectedAttachments: Set<string>;
  // Batch operations
  onBatchDeleteDummy: () => void;
  onBatchDeleteSelected: () => void;
  // Details filters
  detailsTypeFilter: string;
  setDetailsTypeFilter: (v: string) => void;
  detailsTagFilter: string;
  setDetailsTagFilter: (v: string) => void;
  // Utility
  language: LanguageSetting;
  // Search functions
  fetchNotes: () => void;
}

export function SearchFilters(props: SearchFiltersProps) {
  const {
    mode,
    frontmatterTypeFilter, setFrontmatterTypeFilter,
    frontmatterTagFilter, setFrontmatterTagFilter,
    frontmatterMemoFilter, setFrontmatterMemoFilter,
    showFolderNotes, setShowFolderNotes,
    showDateFilters,
    createdAfter, setCreatedAfter,
    createdBefore, setCreatedBefore,
    modifiedAfter, setModifiedAfter,
    modifiedBefore, setModifiedBefore,
    showContentsFilters,
    contentsTypeFilter, setContentsTypeFilter,
    showAttachmentsFilters,
    attachmentsContainerFilter, setAttachmentsContainerFilter,
    attachmentsExtensionFilter, setAttachmentsExtensionFilter,
    attachmentsShowDummyOnly, setAttachmentsShowDummyOnly,
    attachmentsNotePathFilter, setAttachmentsNotePathFilter,
    uniqueTags,
    filteredAttachments,
    onBatchDeleteDummy,
  } = props;

  return (
    <>
      {/* Date filters panel */}
      {mode === 'frontmatter' && showDateFilters && (
        <div className="search-date-filters">
          {/* Type filter */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">타입</label>
            <select
              className="search-details-select"
              value={frontmatterTypeFilter}
              onChange={e => setFrontmatterTypeFilter(e.target.value)}
            >
              {NOTE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {frontmatterTypeFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setFrontmatterTypeFilter('')}
                title="타입 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Tag filter */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">태그</label>
            <select
              className="search-details-select"
              value={frontmatterTagFilter}
              onChange={e => setFrontmatterTagFilter(e.target.value)}
            >
              <option value="">전체 태그</option>
              {uniqueTags.map(tag => {
                // Extract display name without namespace prefix
                let displayTag = tag;
                if (tag.startsWith('domain/')) displayTag = tag.substring(7);
                else if (tag.startsWith('who/')) displayTag = tag.substring(4);
                else if (tag.startsWith('org/')) displayTag = tag.substring(4);
                else if (tag.startsWith('ctx/')) displayTag = tag.substring(4);
                return <option key={tag} value={tag}>{displayTag}</option>;
              })}
            </select>
            {frontmatterTagFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setFrontmatterTagFilter('')}
                title="태그 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Memo filter */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">메모</label>
            <select
              className="search-details-select"
              value={frontmatterMemoFilter}
              onChange={e => setFrontmatterMemoFilter(e.target.value as 'all' | 'has' | 'none')}
            >
              <option value="all">전체</option>
              <option value="has">메모 있음</option>
              <option value="none">메모 없음</option>
            </select>
            {frontmatterMemoFilter !== 'all' && (
              <button
                className="search-date-clear-btn"
                onClick={() => setFrontmatterMemoFilter('all')}
                title="메모 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Folder notes visibility toggle */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">폴더노트</label>
            <button
              className={`search-filter-toggle-btn ${showFolderNotes ? 'active' : ''}`}
              onClick={() => setShowFolderNotes(!showFolderNotes)}
            >
              {showFolderNotes ? '표시' : '숨김'}
            </button>
          </div>
          {/* Date: created */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">생성일</label>
            <input
              type="date"
              className="search-date-input"
              value={createdAfter}
              onChange={e => setCreatedAfter(e.target.value)}
              placeholder="시작일"
            />
            <span className="search-date-separator">~</span>
            <input
              type="date"
              className="search-date-input"
              value={createdBefore}
              onChange={e => setCreatedBefore(e.target.value)}
              placeholder="종료일"
            />
            {(createdAfter || createdBefore) && (
              <button
                className="search-date-clear-btn"
                onClick={() => { setCreatedAfter(''); setCreatedBefore(''); }}
                title="생성일 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Date: modified */}
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">수정일</label>
            <input
              type="date"
              className="search-date-input"
              value={modifiedAfter}
              onChange={e => setModifiedAfter(e.target.value)}
              placeholder="시작일"
            />
            <span className="search-date-separator">~</span>
            <input
              type="date"
              className="search-date-input"
              value={modifiedBefore}
              onChange={e => setModifiedBefore(e.target.value)}
              placeholder="종료일"
            />
            {(modifiedAfter || modifiedBefore) && (
              <button
                className="search-date-clear-btn"
                onClick={() => { setModifiedAfter(''); setModifiedBefore(''); }}
                title="수정일 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contents filters panel */}
      {mode === 'contents' && showContentsFilters && (
        <div className="search-date-filters">
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">타입</label>
            <select
              className="search-details-select"
              value={contentsTypeFilter}
              onChange={e => setContentsTypeFilter(e.target.value)}
            >
              {NOTE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {contentsTypeFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setContentsTypeFilter('')}
                title="타입 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Attachments filters panel */}
      {mode === 'attachments' && showAttachmentsFilters && (
        <div className="search-date-filters">
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">컨테이너</label>
            <input
              type="text"
              className="search-date-input"
              value={attachmentsContainerFilter}
              onChange={e => setAttachmentsContainerFilter(e.target.value)}
              placeholder="컨테이너 이름..."
              style={{ flex: 1 }}
            />
            {attachmentsContainerFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setAttachmentsContainerFilter('')}
                title="컨테이너 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">확장자</label>
            <input
              type="text"
              className="search-date-input"
              value={attachmentsExtensionFilter}
              onChange={e => setAttachmentsExtensionFilter(e.target.value)}
              placeholder="예: png, pdf..."
              style={{ flex: 1 }}
            />
            {attachmentsExtensionFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setAttachmentsExtensionFilter('')}
                title="확장자 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">첨부노트</label>
            <input
              type="text"
              className="search-date-input"
              value={attachmentsNotePathFilter}
              onChange={e => setAttachmentsNotePathFilter(e.target.value)}
              placeholder="노트 경로 검색..."
              style={{ flex: 1 }}
            />
            {attachmentsNotePathFilter && (
              <button
                className="search-date-clear-btn"
                onClick={() => setAttachmentsNotePathFilter('')}
                title="첨부노트 필터 초기화"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="search-date-filter-row">
            <label className="search-date-filter-label">더미 파일</label>
            <button
              className={`search-filter-toggle-btn ${attachmentsShowDummyOnly ? 'active' : ''}`}
              onClick={() => setAttachmentsShowDummyOnly(!attachmentsShowDummyOnly)}
            >
              {attachmentsShowDummyOnly ? '더미만 표시' : '전체 표시'}
            </button>
          </div>
          {/* Batch delete dummy files button in filter panel */}
          {filteredAttachments.some(a => a.note_relative_path === '-') && (
            <div className="search-date-filter-row">
              <button
                className="search-batch-delete-filter-btn"
                onClick={onBatchDeleteDummy}
                title="필터링된 더미 파일 일괄 삭제"
              >
                더미 파일 일괄 삭제 ({filteredAttachments.filter(a => a.note_relative_path === '-').length}개)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
