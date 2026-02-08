import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface RefreshState {
  // Triggers
  searchRefreshTrigger: number;
  calendarRefreshTrigger: number;
  ontologyRefreshTrigger: number;
  searchReady: boolean;

  // Actions
  incrementSearchRefresh: () => void;
  refreshCalendar: () => void;
  incrementOntologyRefresh: () => void;
  setSearchReady: (ready: boolean) => void;
}

export const useRefreshStore = create<RefreshState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    searchRefreshTrigger: 0,
    calendarRefreshTrigger: 0,
    ontologyRefreshTrigger: 0,
    searchReady: false,

    // Increment search refresh trigger
    incrementSearchRefresh: () => {
      set((state) => ({ searchRefreshTrigger: state.searchRefreshTrigger + 1 }));
    },

    // Refresh calendar
    refreshCalendar: () => {
      set((state) => ({ calendarRefreshTrigger: state.calendarRefreshTrigger + 1 }));
    },

    // Increment ontology refresh trigger
    incrementOntologyRefresh: () => {
      set((state) => ({ ontologyRefreshTrigger: state.ontologyRefreshTrigger + 1 }));
    },

    // Set search ready state
    setSearchReady: (ready: boolean) => {
      set({ searchReady: ready });
    },
  }))
);

// Optimized selector hooks
export const useSearchRefreshTrigger = () =>
  useRefreshStore((state) => state.searchRefreshTrigger);

export const useCalendarRefreshTrigger = () =>
  useRefreshStore((state) => state.calendarRefreshTrigger);

export const useOntologyRefreshTrigger = () =>
  useRefreshStore((state) => state.ontologyRefreshTrigger);

export const useSearchReady = () =>
  useRefreshStore((state) => state.searchReady);

// Actions (stable references - can be called outside React)
export const refreshActions = {
  incrementSearchRefresh: () =>
    useRefreshStore.getState().incrementSearchRefresh(),
  refreshCalendar: () =>
    useRefreshStore.getState().refreshCalendar(),
  incrementOntologyRefresh: () =>
    useRefreshStore.getState().incrementOntologyRefresh(),
  setSearchReady: (ready: boolean) =>
    useRefreshStore.getState().setSearchReady(ready),
};

