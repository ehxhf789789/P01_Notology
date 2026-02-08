import { create } from 'zustand';
import { searchCommands } from '../../services/tauriCommands';
import type { NoteMetadata } from '../../types';

interface NoteTypeCacheState {
  // Cache: fileName -> noteType
  cache: Map<string, string>;
  isLoading: boolean;
  lastRefresh: number;

  // Actions
  refreshCache: () => Promise<void>;
  getNoteType: (fileName: string) => string | null;
  invalidate: () => void;
}

export const useNoteTypeCacheStore = create<NoteTypeCacheState>()((set, get) => ({
  cache: new Map(),
  isLoading: false,
  lastRefresh: 0,

  refreshCache: async () => {
    const state = get();
    // Debounce: don't refresh if we did so in the last 2 seconds
    const now = Date.now();
    if (state.isLoading || (now - state.lastRefresh < 2000)) {
      return;
    }

    set({ isLoading: true });

    try {
      const notes = await searchCommands.queryNotes({});
      const newCache = new Map<string, string>();

      for (const note of notes) {
        const fileName = note.path.split(/[/\\]/).pop()?.replace(/\.md$/, '');
        if (fileName) {
          newCache.set(fileName, note.note_type);
          newCache.set(fileName + '.md', note.note_type);
        }
      }

      set({ cache: newCache, isLoading: false, lastRefresh: now });
    } catch (err) {
      console.error('Failed to load note types:', err);
      set({ isLoading: false });
    }
  },

  getNoteType: (fileName: string): string | null => {
    const { cache } = get();
    return cache.get(fileName) || cache.get(fileName.replace(/\.md$/, '')) || null;
  },

  invalidate: () => {
    set({ lastRefresh: 0 });
  },
}));

// Selector hooks
export const useNoteTypeCache = () => useNoteTypeCacheStore((state) => state.cache);
export const useNoteTypeCacheLoading = () => useNoteTypeCacheStore((state) => state.isLoading);

// Actions (stable references)
export const noteTypeCacheActions = {
  refreshCache: () => useNoteTypeCacheStore.getState().refreshCache(),
  getNoteType: (fileName: string) => useNoteTypeCacheStore.getState().getNoteType(fileName),
  invalidate: () => useNoteTypeCacheStore.getState().invalidate(),
};
