import { create } from 'zustand';

export interface ProtectedOperationState {
  activeOperations: Record<string, true>;
  beginOperation: (key: string) => void;
  endOperation: (key: string) => void;
  reset: () => void;
}

export const useProtectedOperationStore = create<ProtectedOperationState>((set) => ({
  activeOperations: {},

  beginOperation: (key) => {
    set((state) => {
      if (state.activeOperations[key]) {
        return state;
      }
      return {
        activeOperations: {
          ...state.activeOperations,
          [key]: true,
        },
      };
    });
  },

  endOperation: (key) => {
    set((state) => {
      if (!state.activeOperations[key]) {
        return state;
      }
      const remaining = { ...state.activeOperations };
      delete remaining[key];
      return { activeOperations: remaining };
    });
  },

  reset: () => set({ activeOperations: {} }),
}));

export const selectHasProtectedOperation = (state: ProtectedOperationState): boolean =>
  Object.keys(state.activeOperations).length > 0;
