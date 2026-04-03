/**
 * Turbo Processing Store (Zustand)
 * Persists turbo transaction state across app restarts
 * Ensures transactions complete even if user closes the app
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'turbo_processing_state';

export interface TurboProcessingState {
  isProcessing: boolean;
  sendAmount: string;
  sendRecipient: string;
  currentStep: number;
  currentMessage: string;
  startedAt: number | null;
  // For mint flow (when user needs to mint new ecash)
  mintQuoteId?: string;
  mintAmount?: number;
  turboRecipient?: string;
}

interface TurboProcessingActions {
  startProcessing: (params: {
    sendAmount: string;
    sendRecipient: string;
    mintQuoteId?: string;
    mintAmount?: number;
    turboRecipient?: string;
  }) => Promise<void>;
  updateProgress: (step: number, message: string) => Promise<void>;
  completeProcessing: () => Promise<void>;
  failProcessing: () => Promise<void>;
  loadPersistedState: () => Promise<TurboProcessingState | null>;
  clearState: () => Promise<void>;
}

type TurboProcessingStore = TurboProcessingState & TurboProcessingActions;

const initialState: TurboProcessingState = {
  isProcessing: false,
  sendAmount: '',
  sendRecipient: '',
  currentStep: 0,
  currentMessage: '',
  startedAt: null,
};

export const useTurboProcessingStore = create<TurboProcessingStore>((set, get) => ({
  ...initialState,

  startProcessing: async (params) => {
    const state: TurboProcessingState = {
      isProcessing: true,
      sendAmount: params.sendAmount,
      sendRecipient: params.sendRecipient,
      currentStep: 0,
      currentMessage: 'Starting...',
      startedAt: Date.now(),
      mintQuoteId: params.mintQuoteId,
      mintAmount: params.mintAmount,
      turboRecipient: params.turboRecipient,
    };

    logger.debug('[TurboProcessingStore] Starting processing:', state);

    // Persist to storage immediately
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to persist state:', { error });
    }

    set(state);
  },

  updateProgress: async (step, message) => {
    const currentState = get();
    const newState = {
      ...currentState,
      currentStep: step,
      currentMessage: message,
    };

    // Persist progress
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to persist progress:', { error });
    }

    set({ currentStep: step, currentMessage: message });
  },

  completeProcessing: async () => {
    logger.debug('[TurboProcessingStore] Processing completed');

    // Clear persisted state
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }

    set(initialState);
  },

  failProcessing: async () => {
    logger.debug('[TurboProcessingStore] Processing failed');

    // Clear persisted state
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }

    set(initialState);
  },

  loadPersistedState: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as TurboProcessingState;
        logger.debug('[TurboProcessingStore] Loaded persisted state:', state);

        // Check if the transaction is too old (> 5 minutes)
        if (state.startedAt && Date.now() - state.startedAt > 5 * 60 * 1000) {
          logger.debug('[TurboProcessingStore] Persisted state too old, clearing');
          await AsyncStorage.removeItem(STORAGE_KEY);
          return null;
        }

        set(state);
        return state;
      }
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to load persisted state:', { error });
    }
    return null;
  },

  clearState: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }
    set(initialState);
  },
}));

