import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { searchCommands, utilCommands } from '../services/tauriCommands';
import { FilePlus, Filter } from 'lucide-react';

const GraphView = lazy(() => import('./GraphView'));
import { useHoverStore, hoverActions } from '../stores/zustand/hoverStore';
import { useVaultPath } from '../stores/zustand/fileTreeStore';
import { fileTreeActions } from '../stores/zustand/fileTreeStore';
import { useSearchReady } from '../stores/zustand/refreshStore';
import { refreshActions } from '../stores/zustand/refreshStore';
import { modalActions } from '../stores/zustand/modalStore';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { useTemplateStore } from '../stores/zustand/templateStore';
import { useIsNasSynced, useIsBulkSyncing } from '../stores/zustand/vaultConfigStore';
import { selectContainer, refreshHoverWindowsForFile } from '../stores/appActions';
import { contentCacheActions } from '../stores/zustand/contentCacheStore';
import type { NoteFilter, NoteMetadata, SearchResult, SearchMode, AttachmentInfo } from '../types';
import { t } from '../utils/i18n';
import { getTemplateCustomColor as getTemplateColor } from '../utils/noteTypeHelpers';
import { NOTE_TYPES } from './search/searchHelpers';
import { SearchFilters } from './search/SearchFilters';
import { FrontmatterResultRow, ContentResultCard, AttachmentResultRow, DetailsResultCard } from './search/SearchResultItem';

interface SearchProps {
  containerPath?: string | null;
  refreshTrigger?: number;
  onCreateNote?: (e?: React.MouseEvent) => void;
  onCreateFolder?: () => void;
}

function Search({ containerPath, refreshTrigger, onCreateNote }: SearchProps) {
  const searchReady = useSearchReady();
  const vaultPath = useVaultPath();
  const noteTemplates = useTemplateStore(s => s.noteTemplates);
  const language = useSettingsStore(s => s.language);
  const isBulkSyncing = useIsBulkSyncing();
  const isNasSynced = useIsNasSynced();

  // Helper function to get template custom color by note type
  const getTemplateCustomColor = useCallback((noteType: string): string | undefined => {
    return getTemplateColor(noteType, noteTemplates);
  }, [noteTemplates]);

  const [frontmatterQuery, setFrontmatterQuery] = useState('');
  const [contentsQuery, setContentsQuery] = useState('');
  const [attachmentsQuery, setAttachmentsQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('frontmatter');
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [attachmentResults, setAttachmentResults] = useState<AttachmentInfo[]>([]);
  const [sortBy, setSortBy] = useState('modified');
  const [sortOrder, setSortOrder] = useState('desc');
  // Date filters
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [modifiedAfter, setModifiedAfter] = useState('');
  const [modifiedBefore, setModifiedBefore] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);
  // Frontmatter tab filters
  const [frontmatterTypeFilter, setFrontmatterTypeFilter] = useState('');
  const [frontmatterTagFilter, setFrontmatterTagFilter] = useState('');
  const [frontmatterMemoFilter, setFrontmatterMemoFilter] = useState<'all' | 'has' | 'none'>('all');
  const [showFolderNotes, setShowFolderNotes] = useState(true);
  // Details tab filters
  const [detailsTypeFilter, setDetailsTypeFilter] = useState('');
  const [detailsTagFilter, setDetailsTagFilter] = useState('');
  // Contents tab filters
  const [showContentsFilters, setShowContentsFilters] = useState(false);
  const [contentsTypeFilter, setContentsTypeFilter] = useState('');
  // Attachments tab filters
  const [showAttachmentsFilters, setShowAttachmentsFilters] = useState(false);
  const [attachmentsContainerFilter, setAttachmentsContainerFilter] = useState('');
  const [attachmentsExtensionFilter, setAttachmentsExtensionFilter] = useState('');
  const [attachmentsShowDummyOnly, setAttachmentsShowDummyOnly] = useState(false);
  const [attachmentsNotePathFilter, setAttachmentsNotePathFilter] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());

  // Frontmatter mode search
  const fetchNotes = useCallback(async () => {
    if (!searchReady) {
      console.log('[fetchNotes] Search not ready, skipping');
      return;
    }

    const filter: NoteFilter = {
      sort_by: sortBy,
      sort_order: sortOrder,
      created_after: createdAfter || undefined,
      created_before: createdBefore || undefined,
      modified_after: modifiedAfter || undefined,
      modified_before: modifiedBefore || undefined,
    };

    console.log('[fetchNotes] Querying notes with refreshTrigger:', refreshTrigger);
    try {
      const results = await searchCommands.queryNotes(filter);
      console.log('[fetchNotes] Got', results.length, 'results');
      setNotes(results);
    } catch (err) {
      console.error('Failed to query notes:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchReady, sortBy, sortOrder, createdAfter, createdBefore, modifiedAfter, modifiedBefore, refreshTrigger]);

  // Contents mode search - uses ref to avoid recreating callback on every query change
  const contentsQueryRef = useRef(contentsQuery);
  contentsQueryRef.current = contentsQuery;

  const searchContents = useCallback(async () => {
    const query = contentsQueryRef.current.trim();
    if (!searchReady || !query) {
      setContentResults([]);
      return;
    }

    try {
      const results = await searchCommands.fullTextSearch(query, 50);
      // Only update if query hasn't changed during search
      if (query === contentsQueryRef.current.trim()) {
        setContentResults(results);
      }
    } catch (err) {
      console.error('Failed to search contents:', err);
    }
  }, [searchReady, refreshTrigger]);

  // Attachments mode search
  const searchAttachments = useCallback(async () => {
    if (!searchReady || !vaultPath) {
      setAttachmentResults([]);
      return;
    }

    try {
      const results = await searchCommands.searchAttachments(
        vaultPath,
        attachmentsQuery.trim(),
      );
      setAttachmentResults(results);
    } catch (err) {
      console.error('Failed to search attachments:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchReady, vaultPath, attachmentsQuery, refreshTrigger]);

  useEffect(() => {
    console.log('[Search] useEffect triggered, mode:', mode, 'refreshTrigger:', refreshTrigger);
    if (mode === 'frontmatter' || mode === 'details') {
      fetchNotes();
    }
  }, [mode, fetchNotes, refreshTrigger]);

  useEffect(() => {
    if (mode === 'contents') {
      // Clear results immediately when query is empty
      if (!contentsQuery.trim()) {
        setContentResults([]);
        return;
      }
      // Short debounce (100ms) for responsive search while preventing excessive API calls
      const timeout = setTimeout(searchContents, 100);
      return () => clearTimeout(timeout);
    }
  }, [mode, contentsQuery, searchContents]);

  useEffect(() => {
    if (mode === 'attachments') {
      const timeout = setTimeout(searchAttachments, 10);
      return () => clearTimeout(timeout);
    }
  }, [mode, searchAttachments, refreshTrigger]);

  // Compute unique tags from all notes for dropdown
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filter results — single-pass loop (avoids 7 intermediate arrays)
  const filteredNotes = useMemo(() => {
    const result: NoteMetadata[] = [];
    const seen = new Set<string>();

    // Pre-compute container filter values
    let prefix: string | undefined;
    let folderNotePath: string | undefined;
    if (containerPath) {
      prefix = containerPath.replace(/\\/g, '/');
      const containerName = prefix.split('/').pop() || '';
      folderNotePath = (prefix + '/' + containerName + '.md').toLowerCase();
    }

    // Pre-compute query
    const q = (frontmatterQuery.trim() && mode === 'frontmatter') ? frontmatterQuery.toLowerCase() : null;

    for (const n of notes) {
      // Container path filter
      if (prefix) {
        const normPath = n.path.replace(/\\/g, '/');
        if (!normPath.startsWith(prefix + '/')) continue;
        if (normPath.toLowerCase() === folderNotePath) continue;

        const relativePath = normPath.slice(prefix.length + 1);
        if (relativePath.includes('/')) {
          // Nested items: only show folder notes (CONTAINER type with matching pattern)
          if (n.note_type !== 'CONTAINER') continue;
          const parts = relativePath.split('/');
          if (parts.length !== 2) continue;
          if (parts[1].toLowerCase() !== `${parts[0].toLowerCase()}.md`) continue;
        }
      }

      // Query filter
      if (q && !n.title.toLowerCase().includes(q) &&
          !n.tags.some(t => t.toLowerCase().includes(q)) &&
          !n.note_type.toLowerCase().includes(q)) continue;

      // Type filter
      if (frontmatterTypeFilter && n.note_type !== frontmatterTypeFilter) continue;

      // Tag filter
      if (frontmatterTagFilter && !n.tags.includes(frontmatterTagFilter)) continue;

      // Memo filter
      if (frontmatterMemoFilter === 'has' && n.comment_count <= 0) continue;
      if (frontmatterMemoFilter === 'none' && n.comment_count > 0) continue;

      // Folder notes visibility
      if (!showFolderNotes && n.note_type === 'CONTAINER') continue;

      // Dedup
      const dedupKey = n.path.replace(/\\/g, '/').toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      result.push(n);
    }

    // Sort folder notes (CONTAINER) first
    result.sort((a, b) => {
      const aIsContainer = a.note_type === 'CONTAINER' ? 0 : 1;
      const bIsContainer = b.note_type === 'CONTAINER' ? 0 : 1;
      return aIsContainer - bIsContainer;
    });

    return result;
  }, [notes, containerPath, frontmatterQuery, mode, frontmatterTypeFilter, frontmatterTagFilter, frontmatterMemoFilter, showFolderNotes]);

  // Details mode filtering - by type, tags, and containerPath
  const filteredDetailsNotes = useMemo(() => {
    let filtered = notes;

    // Container path filtering (same logic as filteredNotes)
    if (containerPath) {
      const prefix = containerPath.replace(/\\/g, '/');
      const containerName = prefix.split('/').pop() || '';
      const folderNotePath = (prefix + '/' + containerName + '.md').toLowerCase();
      filtered = filtered.filter(n => {
        const normPath = n.path.replace(/\\/g, '/');
        // Must be inside the container
        if (!normPath.startsWith(prefix + '/')) return false;
        // Exclude the folder note itself
        if (normPath.toLowerCase() === folderNotePath) return false;

        const relativePath = normPath.slice(prefix.length + 1);

        // Direct children: always show
        if (!relativePath.includes('/')) return true;

        // Nested items: only show if it's a folder note
        const parts = relativePath.split('/');
        if (parts.length === 2) {
          const subFolderName = parts[0];
          const fileName = parts[1];
          if (fileName.toLowerCase() === (subFolderName + '.md').toLowerCase()) {
            return true;
          }
        }
        return false;
      });
    }

    // Apply type filter
    if (detailsTypeFilter) {
      filtered = filtered.filter(n => n.note_type === detailsTypeFilter);
    }
    // Apply tag filter (case-insensitive partial match)
    if (detailsTagFilter.trim()) {
      const tagQuery = detailsTagFilter.toLowerCase();
      filtered = filtered.filter(n =>
        n.tags.some(t => t.toLowerCase().includes(tagQuery))
      );
    }
    // Deduplicate by path
    const seen = new Set<string>();
    filtered = filtered.filter(n => {
      const dedupKey = n.path.replace(/\\/g, '/').toLowerCase();
      if (seen.has(dedupKey)) return false;
      seen.add(dedupKey);
      return true;
    });
    // Sort folder notes first
    filtered.sort((a, b) => {
      const aIsContainer = a.note_type === 'CONTAINER' ? 0 : 1;
      const bIsContainer = b.note_type === 'CONTAINER' ? 0 : 1;
      return aIsContainer - bIsContainer;
    });
    return filtered;
  }, [notes, containerPath, detailsTypeFilter, detailsTagFilter]);

  const filteredContentResults = useMemo(() => {
    let filtered = contentResults;

    // Container path filtering
    if (containerPath) {
      const prefix = containerPath.replace(/\\/g, '/');
      const containerName = prefix.split('/').pop() || '';
      const folderNotePath = (prefix + '/' + containerName + '.md').toLowerCase();
      filtered = filtered.filter(r => {
        const normPath = r.path.replace(/\\/g, '/');
        if (!normPath.startsWith(prefix + '/')) return false;
        if (normPath.toLowerCase() === folderNotePath) return false;

        const relativePath = normPath.slice(prefix.length + 1);

        // Direct children: always show
        if (!relativePath.includes('/')) return true;

        // Nested items: only show if it's a folder note
        const parts = relativePath.split('/');
        if (parts.length === 2) {
          const folderName = parts[0];
          const fileName = parts[1];
          if (fileName.toLowerCase() === `${folderName.toLowerCase()}.md`) {
            return true;
          }
        }

        return false;
      });
    }

    // Type filter
    if (contentsTypeFilter) {
      filtered = filtered.filter(r => {
        const fileName = r.path.split(/[/\\]/).pop() || '';
        const fileUpper = fileName.toUpperCase();
        return fileUpper.startsWith(contentsTypeFilter + '-') || fileUpper === contentsTypeFilter + '.MD';
      });
    }

    return filtered;
  }, [contentResults, containerPath, contentsTypeFilter]);

  const filteredAttachments = useMemo(() => {
    let filtered = attachmentResults;

    // Container path filtering
    if (containerPath) {
      const prefix = containerPath.replace(/\\/g, '/');
      filtered = filtered.filter(a => {
        const normPath = a.path.replace(/\\/g, '/');
        if (!normPath.startsWith(prefix + '/')) return false;

        const relativePath = normPath.slice(prefix.length + 1);
        const parts = relativePath.split('/');

        // Direct child attachment: note.md_att/file.png (2 parts)
        if (parts.length === 2) return true;

        // Nested attachment: subfolder/note.md_att/file.png (3 parts)
        // Only show if it belongs to a folder note
        if (parts.length === 3) {
          const folderName = parts[0];
          const attFolder = parts[1];
          // Check if it's a folder note's attachment folder
          if (attFolder.toLowerCase() === `${folderName.toLowerCase()}.md_att`) {
            return true;
          }
        }

        return false;
      });
    }

    // Container filter
    if (attachmentsContainerFilter.trim()) {
      const query = attachmentsContainerFilter.toLowerCase();
      filtered = filtered.filter(a => a.container.toLowerCase().includes(query));
    }

    // Extension filter
    if (attachmentsExtensionFilter.trim()) {
      const ext = attachmentsExtensionFilter.toLowerCase().replace('.', '');
      filtered = filtered.filter(a => {
        const fileExt = a.file_name.split('.').pop()?.toLowerCase() || '';
        return fileExt === ext;
      });
    }

    // Dummy file filter - only show files with no links (note_relative_path is "-")
    if (attachmentsShowDummyOnly) {
      filtered = filtered.filter(a => a.note_relative_path === '-');
    }

    // Note path filter - filter by specific note path
    if (attachmentsNotePathFilter.trim()) {
      const pathQuery = attachmentsNotePathFilter.toLowerCase();
      filtered = filtered.filter(a =>
        a.inferred_note_path.toLowerCase().includes(pathQuery) ||
        a.note_relative_path.toLowerCase().includes(pathQuery)
      );
    }

    return filtered;
  }, [attachmentResults, containerPath, attachmentsContainerFilter, attachmentsExtensionFilter, attachmentsShowDummyOnly, attachmentsNotePathFilter]);

  const handleNoteClick = (path: string, noteType?: string) => {
    // If it's a Container type, open in ContainerView (main editor area)
    if (noteType?.toUpperCase() === 'CONTAINER') {
      // Get the parent folder path (folder note is FolderName/FolderName.md)
      const parts = path.split(/[/\\]/);
      parts.pop(); // Remove the file name
      const folderPath = parts.join('\\');
      selectContainer(folderPath);
    } else {
      // Check if the note is already open in an ACTIVE hover window
      // Cached windows are handled by openHoverFile's cache restoration logic
      const existingWindow = useHoverStore.getState().hoverFiles.find(h => h.filePath === path && !h.cached);
      if (existingWindow) {
        if (existingWindow.minimized) {
          // Restore minimized window
          hoverActions.restore(existingWindow.id);
        } else {
          // Focus the existing window
          hoverActions.focus(existingWindow.id);
        }
      } else {
        // Opens new window or restores from cache
        hoverActions.open(path);
      }
    }
  };

  // Preload content when hovering over search results - for instant loading when clicked
  const handleNoteHover = useCallback((path: string) => {
    // Only preload .md files
    if (path.endsWith('.md')) {
      contentCacheActions.preloadContent(path);
    }
  }, []);

  const handleAttachmentClick = (e: React.MouseEvent, att: AttachmentInfo) => {
    // Check if Ctrl key is pressed for multi-select
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedAttachments(prev => {
        const newSet = new Set(prev);
        if (newSet.has(att.path)) {
          newSet.delete(att.path);
        } else {
          newSet.add(att.path);
        }
        return newSet;
      });
      return;
    }

    // Normal click without Ctrl - clear selection and open file
    setSelectedAttachments(new Set());
    const isPreviewable = /\.(md|pdf|png|jpg|jpeg|gif|webp|svg|bmp|ico|json|py|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|rs|go|java|c|cpp|h|hpp|cs|rb|php|sh|bash|sql|lua|r|swift|kt|scala)$/i.test(att.path);
    if (isPreviewable) {
      hoverActions.open(att.path);
    } else {
      utilCommands.openInDefaultApp(att.path);
    }
  };

  const [customContextMenu, setCustomContextMenu] = useState<{ x: number; y: number } | null>(null);
  const customContextMenuRef = useRef<HTMLDivElement>(null);

  const handleAttachmentContextMenu = (e: React.MouseEvent, att: AttachmentInfo) => {
    e.preventDefault();

    // If there are selected items, show the batch delete custom context menu
    if (selectedAttachments.size > 0) {
      // If the right-clicked item is not in selection, add it
      if (!selectedAttachments.has(att.path)) {
        setSelectedAttachments(prev => new Set(prev).add(att.path));
      }
      setCustomContextMenu({ x: e.clientX, y: e.clientY });
      return;
    }

    // No selection - show normal context menu for single item (hide delete option - delete only via Ctrl+click selection)
    // Pass isAttachment: true to ensure attachment menu is shown (not note menu even for .md files)
    modalActions.showContextMenu(att.file_name, { x: e.clientX, y: e.clientY }, att.note_path, att.path, false, false, undefined, true, true);
  };

  // Close custom context menu on outside click
  useEffect(() => {
    if (!customContextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Only close if click is OUTSIDE the custom context menu
      if (customContextMenuRef.current && !customContextMenuRef.current.contains(e.target as Node)) {
        setCustomContextMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomContextMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [customContextMenu]);

  // Clear selection on outside click (but not when clicking on attachment rows)
  const searchTableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedAttachments.size === 0) return;

    const handleOutsideClick = (e: MouseEvent) => {
      // Don't clear if clicking on the custom context menu
      const target = e.target as HTMLElement;
      if (target.closest('.context-menu')) return;

      // Don't clear if clicking on the attachment table rows
      if (searchTableRef.current && searchTableRef.current.contains(target)) return;

      // Don't clear if Ctrl/Meta key is held (user is multi-selecting)
      if (e.ctrlKey || e.metaKey) return;

      // Clear selection
      setSelectedAttachments(new Set());
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAttachments(new Set());
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [selectedAttachments.size]);

  const handleBatchDeleteDummy = useCallback(() => {
    // Exclude conflict files from batch deletion — they need manual resolution
    const dummyFiles = filteredAttachments.filter(a => a.note_relative_path === '-' && !a.is_conflict);
    const conflictFiles = filteredAttachments.filter(a => a.is_conflict);

    if (dummyFiles.length === 0 && conflictFiles.length > 0) {
      modalActions.showAlertModal(
        '충돌 파일만 존재',
        `${conflictFiles.length}개의 Synology 동기화 충돌 파일이 있습니다.\n충돌 파일은 일괄 삭제 대상에서 제외됩니다. 원본 파일과 비교 후 수동으로 처리해 주세요.`
      );
      return;
    }

    if (dummyFiles.length === 0) {
      return;
    }

    const count = dummyFiles.length;
    const conflictNote = conflictFiles.length > 0
      ? `\n(충돌 파일 ${conflictFiles.length}개는 제외됨)`
      : '';

    // Show confirmation modal - deletion happens in the callback after user confirms
    modalActions.showConfirmDelete(`더미 파일${conflictNote}`, 'file', async () => {
      try {
        const paths = dummyFiles.map(a => a.path);
        const deleted = await searchCommands.deleteMultipleFiles(paths);

        // Refresh file tree and search
        await fileTreeActions.refreshFileTree();
        refreshActions.incrementSearchRefresh();

        // Refresh attachments list
        await searchAttachments();

        modalActions.showAlertModal('삭제 완료', `${deleted}개의 더미 파일이 삭제되었습니다.${conflictNote}`);
      } catch (e) {
        console.error('Failed to batch delete dummy files:', e);
        modalActions.showAlertModal('삭제 실패', `일괄 삭제에 실패했습니다.\n\n${e}`);
      }
    }, count);
  }, [filteredAttachments, searchAttachments]);

  const handleBatchDeleteSelected = useCallback(() => {
    if (selectedAttachments.size === 0) {
      return;
    }

    const count = selectedAttachments.size;
    const pathsToDelete = Array.from(selectedAttachments);

    // Show confirmation modal - deletion happens in the callback after user confirms
    modalActions.showConfirmDelete('선택된 파일', 'file', async () => {
      try {
        // Use new command that also removes wikilinks from owning notes
        const [deleted, linksRemoved, modifiedNotes] = await searchCommands.deleteAttachmentsWithLinks(pathsToDelete);

        // Clear selection and refresh
        setSelectedAttachments(new Set());
        await fileTreeActions.refreshFileTree();
        refreshActions.incrementSearchRefresh();

        // Refresh attachments list
        await searchAttachments();

        // Refresh any open hover windows that were modified
        for (const notePath of modifiedNotes) {
          refreshHoverWindowsForFile(notePath);
        }

        // Show result using alert modal
        let msg = `${deleted}개의 파일이 삭제되었습니다.`;
        if (linksRemoved > 0) {
          msg += `\n${linksRemoved}개의 위키링크가 제거되었습니다.`;
        }
        modalActions.showAlertModal('삭제 완료', msg);
      } catch (e) {
        console.error('Failed to batch delete selected files:', e);
        modalActions.showAlertModal('삭제 실패', `파일을 삭제하지 못했습니다.\n\n${e}`);
      }
    }, count);
  }, [selectedAttachments, searchAttachments]);

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIndicator = (field: string) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const handleFrontmatterContextMenu = (e: React.MouseEvent, note: NoteMetadata) => {
    e.preventDefault();
    modalActions.showContextMenu(note.title, { x: e.clientX, y: e.clientY }, note.path, note.path, false, true);
  };

  const handleDetailsContextMenu = (e: React.MouseEvent, note: NoteMetadata) => {
    e.preventDefault();
    modalActions.showContextMenu(note.title, { x: e.clientX, y: e.clientY }, note.path, note.path, false, true);
  };

  // Count conflict attachments for warning
  const conflictCount = useMemo(() =>
    attachmentResults.filter(a => a.is_conflict).length,
  [attachmentResults]);

  return (
    <div className="search-view">
      {/* Bulk sync banner — only visible when NAS sync is detected and bulk sync is active */}
      {isNasSynced && isBulkSyncing && (
        <div className="bulk-sync-banner">
          <span>Synology Drive 동기화 진행 중... 파일이 안정화될 때까지 편집을 잠시 대기해 주세요.</span>
        </div>
      )}
      <div className="search-tabs">
        <button
          className={`search-tab ${mode === 'frontmatter' ? 'active' : ''}`}
          onClick={() => setMode('frontmatter')}
        >
          {t('notes', language)}
        </button>
        <button
          className={`search-tab ${mode === 'contents' ? 'active' : ''}`}
          onClick={() => setMode('contents')}
        >
          {t('body', language)}
        </button>
        <button
          className={`search-tab ${mode === 'attachments' ? 'active' : ''}`}
          onClick={() => setMode('attachments')}
        >
          {t('attachments', language)}
        </button>
        <button
          className={`search-tab ${mode === 'details' ? 'active' : ''}`}
          onClick={() => setMode('details')}
        >
          {t('details', language)}
        </button>
        <button
          className={`search-tab ${mode === 'graph' ? 'active' : ''}`}
          onClick={() => setMode('graph')}
        >
          {t('graph', language)}
        </button>
        {containerPath && onCreateNote && (
          <button className="search-create-note-btn" onClick={(e) => onCreateNote(e)} title={t('createNote', language)}>
            <FilePlus size={14} strokeWidth={2} />
            <span>{t('newNote', language)}</span>
          </button>
        )}
      </div>
      {mode !== 'graph' && <div className="search-toolbar">
        {mode === 'details' ? (
          <div className="search-details-filters">
            <select
              className="search-details-select"
              value={detailsTypeFilter}
              onChange={e => setDetailsTypeFilter(e.target.value)}
            >
              {NOTE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              className="search-input"
              type="text"
              placeholder="태그 검색..."
              value={detailsTagFilter}
              onChange={e => setDetailsTagFilter(e.target.value)}
            />
          </div>
        ) : (
          <div className="search-bar">
            <input
              className="search-input"
              type="text"
              placeholder={
                mode === 'frontmatter' ? t('titleTagTypeSearch', language) :
                mode === 'contents' ? t('bodyContentSearch', language) :
                t('attachmentSearch', language)
              }
              value={
                mode === 'frontmatter' ? frontmatterQuery :
                mode === 'contents' ? contentsQuery :
                attachmentsQuery
              }
              onChange={e => {
                const value = e.target.value;
                if (mode === 'frontmatter') setFrontmatterQuery(value);
                else if (mode === 'contents') setContentsQuery(value);
                else setAttachmentsQuery(value);
              }}
            />
            {mode === 'frontmatter' && (
              <button
                className={`search-filter-btn ${showDateFilters ? 'active' : ''}`}
                onClick={() => setShowDateFilters(!showDateFilters)}
                title={t('dateFilter', language)}
              >
                <Filter size={14} />
              </button>
            )}
            {mode === 'contents' && (
              <button
                className={`search-filter-btn ${showContentsFilters ? 'active' : ''}`}
                onClick={() => setShowContentsFilters(!showContentsFilters)}
                title={t('typeFilter', language)}
              >
                <Filter size={14} />
              </button>
            )}
            {mode === 'attachments' && (
              <button
                className={`search-filter-btn ${showAttachmentsFilters ? 'active' : ''}`}
                onClick={() => setShowAttachmentsFilters(!showAttachmentsFilters)}
                title="필터"
              >
                <Filter size={14} />
              </button>
            )}
          </div>
        )}
      </div>}

      <SearchFilters
        mode={mode}
        frontmatterTypeFilter={frontmatterTypeFilter}
        setFrontmatterTypeFilter={setFrontmatterTypeFilter}
        frontmatterTagFilter={frontmatterTagFilter}
        setFrontmatterTagFilter={setFrontmatterTagFilter}
        frontmatterMemoFilter={frontmatterMemoFilter}
        setFrontmatterMemoFilter={setFrontmatterMemoFilter}
        showFolderNotes={showFolderNotes}
        setShowFolderNotes={setShowFolderNotes}
        showDateFilters={showDateFilters}
        setShowDateFilters={setShowDateFilters}
        createdAfter={createdAfter}
        setCreatedAfter={setCreatedAfter}
        createdBefore={createdBefore}
        setCreatedBefore={setCreatedBefore}
        modifiedAfter={modifiedAfter}
        setModifiedAfter={setModifiedAfter}
        modifiedBefore={modifiedBefore}
        setModifiedBefore={setModifiedBefore}
        showContentsFilters={showContentsFilters}
        contentsTypeFilter={contentsTypeFilter}
        setContentsTypeFilter={setContentsTypeFilter}
        showAttachmentsFilters={showAttachmentsFilters}
        attachmentsContainerFilter={attachmentsContainerFilter}
        setAttachmentsContainerFilter={setAttachmentsContainerFilter}
        attachmentsExtensionFilter={attachmentsExtensionFilter}
        setAttachmentsExtensionFilter={setAttachmentsExtensionFilter}
        attachmentsShowDummyOnly={attachmentsShowDummyOnly}
        setAttachmentsShowDummyOnly={setAttachmentsShowDummyOnly}
        attachmentsNotePathFilter={attachmentsNotePathFilter}
        setAttachmentsNotePathFilter={setAttachmentsNotePathFilter}
        uniqueTags={uniqueTags}
        filteredAttachments={filteredAttachments}
        selectedAttachments={selectedAttachments}
        onBatchDeleteDummy={handleBatchDeleteDummy}
        onBatchDeleteSelected={handleBatchDeleteSelected}
        detailsTypeFilter={detailsTypeFilter}
        setDetailsTypeFilter={setDetailsTypeFilter}
        detailsTagFilter={detailsTagFilter}
        setDetailsTagFilter={setDetailsTagFilter}
        language={language}
        fetchNotes={fetchNotes}
      />

      {mode === 'frontmatter' ? (
        <div className="search-table-wrapper">
          <table className="search-table">
            <thead>
              <tr>
                <th className="search-th clickable" onClick={() => handleSortChange('title')}>
                  제목{getSortIndicator('title')}
                </th>
                <th className="search-th">타입</th>
                <th className="search-th">태그</th>
                <th className="search-th">메모</th> {/* Note body presence */}
                <th className="search-th clickable" onClick={() => handleSortChange('created')}>
                  생성일{getSortIndicator('created')}
                </th>
                <th className="search-th clickable" onClick={() => handleSortChange('modified')}>
                  수정일{getSortIndicator('modified')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map(note => (
                <FrontmatterResultRow
                  key={note.path}
                  note={note}
                  frontmatterQuery={frontmatterQuery}
                  getTemplateCustomColor={getTemplateCustomColor}
                  onNoteClick={handleNoteClick}
                  onNoteHover={handleNoteHover}
                  onContextMenu={handleFrontmatterContextMenu}
                />
              ))}
              {filteredNotes.length === 0 && (
                <tr>
                  <td className="search-td search-empty" colSpan={6}>
                    {searchReady ? '결과 없음' : '인덱스 초기화 중...'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : mode === 'contents' ? (
        <div className="search-content-results">
          {filteredContentResults.length === 0 ? (
            <div className="search-content-empty">
              {!contentsQuery.trim() ? '검색어를 입력하세요' : searchReady ? '결과 없음' : '인덱스 초기화 중...'}
            </div>
          ) : (
            filteredContentResults.map(result => (
              <ContentResultCard
                key={result.path}
                result={result}
                contentsQuery={contentsQuery}
                getTemplateCustomColor={getTemplateCustomColor}
                onNoteClick={handleNoteClick}
                onNoteHover={handleNoteHover}
              />
            ))
          )}
        </div>
      ) : mode === 'attachments' ? (
        <div className="search-table-wrapper" ref={searchTableRef}>
          {conflictCount > 0 && (
            <div className="bulk-sync-banner" style={{ borderBottom: '1px solid rgba(232, 168, 56, 0.3)', animation: 'none', opacity: 1 }}>
              <span>동기화 충돌 파일 {conflictCount}개 감지됨 — 원본과 비교 후 수동으로 처리해 주세요. 일괄 삭제 대상에서 자동 제외됩니다.</span>
            </div>
          )}
            <table className="search-table">
              <thead>
                <tr>
                  <th className="search-th">파일명</th>
                  <th className="search-th">소속 노트</th>
                  <th className="search-th">첨부 노트</th>
                  <th className="search-th">컨테이너</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttachments.map(att => (
                  <AttachmentResultRow
                    key={att.path}
                    att={att}
                    attachmentsQuery={attachmentsQuery}
                    isSelected={selectedAttachments.has(att.path)}
                    onAttachmentClick={handleAttachmentClick}
                    onAttachmentContextMenu={handleAttachmentContextMenu}
                  />
                ))}
                {filteredAttachments.length === 0 && (
                  <tr>
                    <td className="search-td search-empty" colSpan={4}>
                      {searchReady ? '첨부파일 없음' : '인덱스 초기화 중...'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      ) : mode === 'details' ? (
        /* Details mode - detailed metadata view */
        <div className="search-details-results">
          {filteredDetailsNotes.length === 0 ? (
            <div className="search-content-empty">
              {searchReady ? '결과 없음' : '인덱스 초기화 중...'}
            </div>
          ) : (
            filteredDetailsNotes.map(note => (
              <DetailsResultCard
                key={note.path}
                note={note}
                getTemplateCustomColor={getTemplateCustomColor}
                onNoteClick={handleNoteClick}
                onNoteHover={handleNoteHover}
                onContextMenu={handleDetailsContextMenu}
                onTagClick={setDetailsTagFilter}
              />
            ))
          )}
        </div>
      ) : mode === 'graph' ? (
        <Suspense fallback={<div className="graph-loading">그래프 로딩 중...</div>}>
          <GraphView containerPath={containerPath} refreshTrigger={refreshTrigger} />
        </Suspense>
      ) : null}

      {mode !== 'graph' && <div className="search-status-bar">
        <span className="search-count">
          {mode === 'frontmatter'
            ? `${filteredNotes.length}개 노트`
            : mode === 'contents'
              ? `${filteredContentResults.length}개 결과`
              : mode === 'attachments'
                ? `${filteredAttachments.length}개 첨부파일`
                : `${filteredDetailsNotes.length}개 노트`}
        </span>
      </div>}

      {/* Custom context menu for multi-select */}
      {customContextMenu && (
        <div
          ref={customContextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: customContextMenu.x,
            top: customContextMenu.y,
            zIndex: 10000,
          }}
        >
          <button
            className="context-menu-item delete"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setCustomContextMenu(null);
              handleBatchDeleteSelected();
            }}
          >
            선택 항목 삭제 ({selectedAttachments.size}개)
          </button>
        </div>
      )}

    </div>
  );
}

export default Search;
