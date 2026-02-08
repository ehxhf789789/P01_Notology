import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface UIState {
  // State
  showSearch: boolean;
  showCalendar: boolean;
  showHoverPanel: boolean;
  showSidebar: boolean;
  sidebarAnimState: 'idle' | 'opening' | 'closing';
  hoverPanelAnimState: 'idle' | 'opening' | 'closing';

  // Actions
  setShowSearch: (show: boolean) => void;
  setShowCalendar: (show: boolean) => void;
  setShowSidebar: (show: boolean) => void;
  setShowHoverPanel: (show: boolean) => void;
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    showSearch: false,
    showCalendar: false,
    showHoverPanel: false,
    showSidebar: true,
    sidebarAnimState: 'idle',
    hoverPanelAnimState: 'idle',

    // Show search (mutually exclusive with calendar)
    setShowSearch: (show: boolean) => {
      set({ showSearch: show });
      if (show) {
        set({ showCalendar: false });
      }
    },

    // Show calendar (mutually exclusive with search)
    setShowCalendar: (show: boolean) => {
      set({ showCalendar: show });
      if (show) {
        set({ showSearch: false });
      }
    },

    // Animated sidebar toggle (100ms open, 80ms close)
    setShowSidebar: (show: boolean) => {
      if (show === get().showSidebar) return;
      if (show) {
        set({ sidebarAnimState: 'opening', showSidebar: true });
        setTimeout(() => set({ sidebarAnimState: 'idle' }), 120);
      } else {
        set({ sidebarAnimState: 'closing' });
        setTimeout(() => set({ showSidebar: false, sidebarAnimState: 'idle' }), 100);
      }
    },

    // Animated hover panel toggle (100ms open, 80ms close)
    setShowHoverPanel: (show: boolean) => {
      if (show === get().showHoverPanel) return;
      if (show) {
        set({ hoverPanelAnimState: 'opening', showHoverPanel: true });
        setTimeout(() => set({ hoverPanelAnimState: 'idle' }), 120);
      } else {
        set({ hoverPanelAnimState: 'closing' });
        setTimeout(() => set({ showHoverPanel: false, hoverPanelAnimState: 'idle' }), 100);
      }
    },
  }))
);

// Selector hooks
export const useShowSearch = () => useUIStore((s) => s.showSearch);
export const useShowCalendar = () => useUIStore((s) => s.showCalendar);
export const useShowHoverPanel = () => useUIStore((s) => s.showHoverPanel);
export const useShowSidebar = () => useUIStore((s) => s.showSidebar);
export const useSidebarAnimState = () => useUIStore((s) => s.sidebarAnimState);
export const useHoverPanelAnimState = () => useUIStore((s) => s.hoverPanelAnimState);

// Actions (stable references)
export const uiActions = {
  setShowSearch: (show: boolean) => useUIStore.getState().setShowSearch(show),
  setShowCalendar: (show: boolean) => useUIStore.getState().setShowCalendar(show),
  setShowSidebar: (show: boolean) => useUIStore.getState().setShowSidebar(show),
  setShowHoverPanel: (show: boolean) => useUIStore.getState().setShowHoverPanel(show),
};
