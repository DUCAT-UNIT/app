/**
 * Turbo Processing Store (Zustand)
 * Persists turbo transaction state across app restarts
 * Ensures transactions complete even if user closes the app
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export const TURBO_PROCESSING_STORAGE_KEY = 'turbo_processing_state';
export const TURBO_PROCESSING_EXPIRY_MS = 5 * 60 * 1000;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function toPersistedState(state: TurboProcessingStore | TurboProcessingState): TurboProcessingState {
  return {
    isProcessing: state.isProcessing,
    sendAmount: state.sendAmount,
    sendRecipient: state.sendRecipient,
    currentStep: state.currentStep,
    currentMessage: state.currentMessage,
    startedAt: state.startedAt,
    mintQuoteId: state.mintQuoteId,
    mintAmount: state.mintAmount,
    turboRecipient: state.turboRecipient,
  };
}

export function normalizeTurboProcessingState(
  value: unknown,
  now = Date.now(),
): TurboProcessingState | null {
  if (!isRecord(value)) {
    return null;
  }

  const startedAt = typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
    ? value.startedAt
    : null;
  if (value.isProcessing !== true || !startedAt || now - startedAt > TURBO_PROCESSING_EXPIRY_MS) {
    return null;
  }

  const sendAmount = stringField(value.sendAmount).trim();
  const sendRecipient = stringField(value.sendRecipient).trim();
  if (!sendAmount || !sendRecipient) {
    return null;
  }

  const currentStep = typeof value.currentStep === 'number' && Number.isFinite(value.currentStep) && value.currentStep >= 0
    ? Math.floor(value.currentStep)
    : 0;
  const currentMessage = stringField(value.currentMessage).trim() || 'Restoring Turbo send...';

  return {
    isProcessing: true,
    sendAmount,
    sendRecipient,
    currentStep,
    currentMessage,
    startedAt,
    mintQuoteId: optionalStringField(value.mintQuoteId),
    mintAmount: optionalPositiveNumber(value.mintAmount),
    turboRecipient: optionalStringField(value.turboRecipient),
  };
}

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
      await AsyncStorage.setItem(TURBO_PROCESSING_STORAGE_KEY, JSON.stringify(toPersistedState(state)));
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to persist state:', { error });
    }

    set(state);
  },

  updateProgress: async (step, message) => {
    const currentState = get();
    const newState: TurboProcessingState = {
      ...toPersistedState(currentState),
      currentStep: step,
      currentMessage: message,
    };

    // Persist progress
    try {
      await AsyncStorage.setItem(TURBO_PROCESSING_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to persist progress:', { error });
    }

    set({ currentStep: step, currentMessage: message });
  },

  completeProcessing: async () => {
    logger.debug('[TurboProcessingStore] Processing completed');

    // Clear persisted state
    try {
      await AsyncStorage.removeItem(TURBO_PROCESSING_STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }

    set(initialState);
  },

  failProcessing: async () => {
    logger.debug('[TurboProcessingStore] Processing failed');

    // Clear persisted state
    try {
      await AsyncStorage.removeItem(TURBO_PROCESSING_STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }

    set(initialState);
  },

  loadPersistedState: async () => {
    try {
      const stored = await AsyncStorage.getItem(TURBO_PROCESSING_STORAGE_KEY);
      if (stored) {
        const state = normalizeTurboProcessingState(JSON.parse(stored));
        logger.debug('[TurboProcessingStore] Loaded persisted state:', state);

        if (!state) {
          logger.debug('[TurboProcessingStore] Persisted state invalid or too old, clearing');
          await AsyncStorage.removeItem(TURBO_PROCESSING_STORAGE_KEY);
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
      await AsyncStorage.removeItem(TURBO_PROCESSING_STORAGE_KEY);
    } catch (error) {
      logger.error('[TurboProcessingStore] Failed to clear state:', { error });
    }
    set(initialState);
  },
}));
