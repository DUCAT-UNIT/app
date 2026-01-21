/**
 * EcashThresholdSheetStore - Global state for ecash threshold sheet visibility
 * Allows the sheet to be shown from anywhere and rendered at the app level
 */

import { create } from 'zustand';

interface EcashThresholdSheetState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useEcashThresholdSheetStore = create<EcashThresholdSheetState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

// Convenience hooks
export const useEcashThresholdSheetVisible = () =>
  useEcashThresholdSheetStore((state) => state.visible);

export const useShowEcashThresholdSheet = () =>
  useEcashThresholdSheetStore((state) => state.show);

export const useHideEcashThresholdSheet = () =>
  useEcashThresholdSheetStore((state) => state.hide);
