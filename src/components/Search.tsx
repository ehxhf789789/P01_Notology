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
import { t, tf } from '../utils/i18n';
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
  // Selected folder note path (for single-click highlight, double-click to navigate)
  const [selectedFolderNotePath, setSelectedFolderNotePath] = useState<string | null>(null);

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

  // Details mode filtering — single-pass loop (avoids intermediate arrays)
  const filteredDetailsNotes = useMemo(() => {
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

    // Pre-compute tag query
    const tagQuery = detailsTagFilter.trim() ? detailsTagFilter.toLowerCase() : null;

    for (const n of notes) {
      // Container path filter
      if (prefix) {
        const normPath = n.path.replace(/\\/g, '/');
        if (!normPath.startsWith(prefix + '/')) continue;
        if (normPath.toLowerCase() === folderNotePath) continue;

        const relativePath = normPath.slice(prefix.length + 1);
        if (relativePath.includes('/')) {
          const parts = relativePath.split('/');
          if (parts.length !== 2) continue;
          if (parts[1].toLowerCase() !== `${parts[0].toLowerCase()}.md`) continue;
        }
      }

      // Type filter
      if (detailsTypeFilter && n.note_type !== detailsTypeFilter) continue;

      // Tag filter
      if (tagQuery && !n.tags.some(t => t.toLowerCase().includes(tagQuery))) continue;

      // Dedup
      const dedupKey = n.path.replace(/\\/g, '/').toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      result.push(n);
    }

    // Sort folder notes first
    result.sort((a, b) => {
      const aIsContainer = a.note_type === 'CONTAINER' ? 0 : 1;
      const bIsContainer = b.note_type === 'CONTAINER' ? 0 : 1;
      return aIsContainer - bIsContainer;
    });

    return result;
  }, [notes, containerPath, detailsTypeFilter, detailsTagFilter]);

  // Content results filtering — single-pass loop
  const filteredContentResults = useMemo(() => {
    const result: SearchResult[] = [];

    // Pre-compute container filter values
    let prefix: string | undefined;
    let folderNotePath: string | undefined;
    if (containerPath) {
      prefix = containerPath.replace(/\\/g, '/');
      const containerName = prefix.split('/').pop() || '';
      folderNotePath = (prefix + '/' + containerName + '.md').toLowerCase();
    }

    // Pre-compute type filter prefix
    const typePrefix = contentsTypeFilter ? contentsTypeFilter + '-' : null;
    const typeExact = contentsTypeFilter ? contentsTypeFilter + '.MD' : null;

    for (const r of contentResults) {
      const normPath = r.path.replace(/\\/g, '/');

      // Container path filter
      if (prefix) {
        if (!normPath.startsWith(prefix + '/')) continue;
        if (normPath.toLowerCase() === folderNotePath) continue;

        const relativePath = normPath.slice(prefix.length + 1);
        if (relativePath.includes('/')) {
          const parts = relativePath.split('/');
          if (parts.length !== 2) continue;
          if (parts[1].toLowerCase() !== `${parts[0].toLowerCase()}.md`) continue;
        }
      }

      // Type filter
      if (typePrefix) {
        const fileName = normPath.split('/').pop() || '';
        const fileUpper = fileName.toUpperCase();
        if (!fileUpper.startsWith(typePrefix) && fileUpper !== typeExact) continue;
      }

      result.push(r);
    }

    return result;
  }, [contentResults, containerPath, contentsTypeFilter]);

  // Attachments filtering — single-pass loop
  const filteredAttachments = useMemo(() => {
    const result: AttachmentInfo[] = [];

    // Pre-compute container prefix
    const prefix = containerPath ? containerPath.replace(/\\/g, '/') : null;

    // Pre-compute filter values
    const containerQuery = attachmentsContainerFilter.trim() ? attachmentsContainerFilter.toLowerCase() : null;
    const ext = attachmentsExtensionFilter.trim() ? attachmentsExtensionFilter.toLowerCase().replace('.', '') : null;
    const pathQuery = attachmentsNotePathFilter.trim() ? attachmentsNotePathFilter.toLowerCase() : null;

    for (const a of attachmentResults) {
      const normPath = a.path.replace(/\\/g, '/');

      // Container path filter
      if (prefix) {
        if (!normPath.startsWith(prefix + '/')) continue;

        const relativePath = normPath.slice(prefix.length + 1);
        const parts = relativePath.split('/');

        // Direct child attachment: note.md_att/file.png (2 parts)
        // Nested attachment: subfolder/note.md_att/file.png (3 parts, folder note only)
        if (parts.length === 2) {
          // OK
        } else if (parts.length === 3) {
          const folderName = parts[0];
          const attFolder = parts[1];
          if (attFolder.toLowerCase() !== `${folderName.toLowerCase()}.md_att`) continue;
        } else {
          continue;
        }
      }

      // Container filter
      if (containerQuery && !a.container.toLowerCase().includes(containerQuery)) continue;

      // Extension filter
      if (ext) {
        const fileExt = a.file_name.split('.').pop()?.toLowerCase() || '';
        if (fileExt !== ext) continue;
      }

      // Dummy file filter
      if (attachmentsShowDummyOnly && a.note_relative_path !== '-') continue;

      // Note path filter
      if (pathQuery) {
        if (!a.inferred_note_path.toLowerCase().includes(pathQuery) &&
            !a.note_relative_path.toLowerCase().includes(pathQuery)) continue;
      }

      result.push(a);
    }

    return result;
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
        t('conflictFilesOnly', language),
        tf('conflictFilesMsg', language, { count: conflictFiles.length })
      );
      return;
    }

    if (dummyFiles.length === 0) {
      return;
    }

    const count = dummyFiles.length;
    const conflictNote = conflictFiles.length > 0
      ? tf('conflictExcluded', language, { count: conflictFiles.length })
      : '';

    // Show confirmation modal - deletion happens in the callback after user confirms
    modalActions.showConfirmDelete(`${t('dummyFile', language)}${conflictNote}`, 'file', async () => {
      try {
        const paths = dummyFiles.map(a => a.path);
        const deleted = await searchCommands.deleteMultipleFiles(paths);

        // Refresh file tree and search
        await fileTreeActions.refreshFileTree();
        refreshActions.incrementSearchRefresh();

        // Refresh attachments list
        await searchAttachments();

        modalActions.showAlertModal(t('deleteComplete', language), `${tf('deletedFilesMsg', language, { count: deleted })}${conflictNote}`);
      } catch (e) {
        console.error('Failed to batch delete dummy files:', e);
        modalActions.showAlertModal(t('deleteFailed', language), `${t('batchDeleteFailed', language)}\n\n${e}`);
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
    modalActions.showConfirmDelete(t('selectedFiles', language), 'file', async () => {
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
        let msg = tf('filesDeletedMsg', language, { count: deleted });
        if (linksRemoved > 0) {
          msg += `\n${tf('wikilinksRemovedMsg', language, { count: linksRemoved })}`;
        }
        modalActions.showAlertModal(t('deleteComplete', language), msg);
      } catch (e) {
        console.error('Failed to batch delete selected files:', e);
        modalActions.showAlertModal(t('deleteFailed', language), `${t('fileDeleteFailed', language)}\n\n${e}`);
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
          <span>{t('syncInProgressMsg', language)}</span>
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
              {NOTE_TYPES.map(nt => (
                <option key={nt.value} value={nt.value}>{nt.value === '' ? t('allTypes', language) : nt.label}</option>
              ))}
            </select>
            <input
              className="search-input"
              type="text"
              placeholder={t('tagSearch', language)}
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
                title={t('filter', language)}
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
                  {t('titleColumn', language)}{getSortIndicator('title')}
                </th>
                <th className="search-th">{t('noteType', language)}</th>
                <th className="search-th">{t('tags', language)}</th>
                <th className="search-th">{t('memos', language)}</th> {/* Note body presence */}
                <th className="search-th clickable" onClick={() => handleSortChange('created')}>
                  {t('createdDate', language)}{getSortIndicator('created')}
                </th>
                <th className="search-th clickable" onClick={() => handleSortChange('modified')}>
                  {t('modifiedDate', language)}{getSortIndicator('modified')}
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
                  selectedPath={selectedFolderNotePath}
                  onSelect={setSelectedFolderNotePath}
                />
              ))}
              {filteredNotes.length === 0 && (
                <tr>
                  <td className="search-td search-empty" colSpan={6}>
                    {searchReady ? t('noResults', language) : t('indexInitializing', language)}
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
              {!contentsQuery.trim() ? t('enterSearchTerm', language) : searchReady ? t('noResults', language) : t('indexInitializing', language)}
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
              <span>{tf('syncConflictMsg', language, { count: conflictCount })}</span>
            </div>
          )}
            <table className="search-table">
              <thead>
                <tr>
                  <th className="search-th">{t('fileName', language)}</th>
                  <th className="search-th">{t('ownerNote', language)}</th>
                  <th className="search-th">{t('attachedNote', language)}</th>
                  <th className="search-th">{t('container', language)}</th>
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
                    language={language}
                  />
                ))}
                {filteredAttachments.length === 0 && (
                  <tr>
                    <td className="search-td search-empty" colSpan={4}>
                      {searchReady ? t('noAttachments', language) : t('indexInitializing', language)}
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
              {searchReady ? t('noResults', language) : t('indexInitializing', language)}
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
                language={language}
                selectedPath={selectedFolderNotePath}
                onSelect={setSelectedFolderNotePath}
              />
            ))
          )}
        </div>
      ) : mode === 'graph' ? (
        <Suspense fallback={<div className="graph-loading">{t('graphLoadingSearch', language)}</div>}>
          <GraphView containerPath={containerPath} refreshTrigger={refreshTrigger} />
        </Suspense>
      ) : null}

      {mode !== 'graph' && <div className="search-status-bar">
        <span className="search-count">
          {mode === 'frontmatter'
            ? tf('notesCountLabel', language, { count: filteredNotes.length })
            : mode === 'contents'
              ? tf('resultsCountLabel', language, { count: filteredContentResults.length })
              : mode === 'attachments'
                ? tf('attachmentsCountLabel', language, { count: filteredAttachments.length })
                : tf('notesCountLabel', language, { count: filteredDetailsNotes.length })}
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
            {tf('deleteSelectedAttachments', language, { count: selectedAttachments.size })}
          </button>
        </div>
      )}

    </div>
  );
}

export default Search;
