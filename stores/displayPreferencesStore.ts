/**
 * Display Preferences Store (Zustand)
 * Manages how balances and amounts are displayed (BTC vs USD)
 *
 * MIGRATION: Replaces DisplayPreferencesContext
 * Benefits: No provider needed, selective re-renders, simpler usage
 */

import { create } from 'zustand';

interface DisplayPreferencesState {
  showTotalInBTC: boolean;
  showBTCInBTC: boolean;
  showUnitInUnit: boolean;
}

interface DisplayPreferencesActions {
  setShowTotalInBTC: (value: boolean) => void;
  setShowBTCInBTC: (value: boolean) => void;
  setShowUnitInUnit: (value: boolean) => void;
  toggleShowTotalInBTC: () => void;
  toggleShowBTCInBTC: () => void;
  toggleShowUnitInUnit: () => void;
}

type DisplayPreferencesStore = DisplayPreferencesState & DisplayPreferencesActions;

export const useDisplayPreferencesStore = create<DisplayPreferencesStore>((set) => ({
  // State
  showTotalInBTC: false,
  showBTCInBTC: false,
  showUnitInUnit: false,

  // Setters
  setShowTotalInBTC: (value) => set({ showTotalInBTC: value }),
  setShowBTCInBTC: (value) => set({ showBTCInBTC: value }),
  setShowUnitInUnit: (value) => set({ showUnitInUnit: value }),

  // Toggles (convenience methods)
  toggleShowTotalInBTC: () => set((state) => ({ showTotalInBTC: !state.showTotalInBTC })),
  toggleShowBTCInBTC: () => set((state) => ({ showBTCInBTC: !state.showBTCInBTC })),
  toggleShowUnitInUnit: () => set((state) => ({ showUnitInUnit: !state.showUnitInUnit })),
}));

/**
 * Selector hooks for granular subscriptions
 * Use these to only re-render when specific values change
 */
export const useShowTotalInBTC = () => useDisplayPreferencesStore((state) => state.showTotalInBTC);
export const useShowBTCInBTC = () => useDisplayPreferencesStore((state) => state.showBTCInBTC);
export const useShowUnitInUnit = () => useDisplayPreferencesStore((state) => state.showUnitInUnit);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetDisplayPreferencesStore = () => {
  useDisplayPreferencesStore.setState({
    showTotalInBTC: false,
    showBTCInBTC: false,
    showUnitInUnit: false,
  });
};
