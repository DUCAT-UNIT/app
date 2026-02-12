/**
 * EcashThresholdSheetStore - Global state for ecash threshold sheet visibility
 * Allows the sheet to be shown from anywhere and rendered at the app level
 */

import { create } from 'zustand';

interface EcashThresholdSheetState {
  visible: boolean;
  onSelectHandler: ((value: number) => void) | null;
  show: () => void;
  hide: () => void;
  setOnSelect: (handler: ((value: number) => void) | null) => void;
}

export const useEcashThresholdSheetStore = create<EcashThresholdSheetState>((set) => ({
  visible: false,
  onSelectHandler: null,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
  setOnSelect: (handler) => set({ onSelectHandler: handler }),
}));

export const setThresholdSheetOnSelect = (handler: (value: number) => void) => {
  useEcashThresholdSheetStore.getState().setOnSelect(handler);
};

export const getThresholdSheetOnSelect = (): ((value: number) => void) | null => {
  return useEcashThresholdSheetStore.getState().onSelectHandler;
};

// Convenience hooks
export const useEcashThresholdSheetVisible = () =>
  useEcashThresholdSheetStore((state) => state.visible);

export const useShowEcashThresholdSheet = () =>
  useEcashThresholdSheetStore((state) => state.show);

export const useHideEcashThresholdSheet = () =>
  useEcashThresholdSheetStore((state) => state.hide);
