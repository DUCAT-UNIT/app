/**
 * Send Flow Store (Zustand)
 * Manages the send transaction UI flow state
 *
 * MIGRATION: Replaces SendFlowContext
 * Benefits: No provider needed, simpler state machine, selective re-renders
 *
 * NOTE: This store is intentionally NOT persisted. All fields are transient UI state:
 * - intentStep tracks the current position in a short-lived state machine
 * - sendAmount/sendRecipient are text inputs the user can quickly re-enter
 * - turboEnabled/selectedFeeRate have sensible defaults that reset correctly
 * Persisting this state would risk resuming a stale transaction with outdated UTXO
 * data or fee rates, which is worse than requiring the user to re-enter a few fields.
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';

export type IntentStep =
  | 'idle'
  | 'selecting_asset'
  | 'entering_address'
  | 'entering_amount'
  | 'creating'
  | 'reviewing'
  | 'signing'
  | 'broadcasting'
  | 'pending'
  | 'confirmed';

export type AssetType = 'btc' | 'unit' | null;
export type SendAddressType = 'segwit' | 'taproot';

interface SendFlowState {
  intentStep: IntentStep;
  sendAssetType: AssetType;
  sendAmount: string;
  sendRecipient: string;
  sendAddressType: SendAddressType;
  requireConfirmedUtxos: boolean;
  turboEnabled: boolean;
  selectedFeeRate: number;
}

interface SendFlowActions {
  setIntentStep: (step: IntentStep) => void;
  setSendAssetType: (type: AssetType) => void;
  setSendAmount: (amount: string) => void;
  setSendRecipient: (recipient: string) => void;
  setSendAddressType: (type: SendAddressType) => void;
  setRequireConfirmedUtxos: (required: boolean) => void;
  setTurboEnabled: (enabled: boolean) => void;
  setSelectedFeeRate: (rate: number) => void;
  resetSendFlow: () => void;
}

type SendFlowStore = SendFlowState & SendFlowActions;

const initialState: SendFlowState = {
  intentStep: 'idle',
  sendAssetType: null,
  sendAmount: '',
  sendRecipient: '',
  sendAddressType: 'taproot',
  requireConfirmedUtxos: false,
  turboEnabled: true, // Turbo ON by default for UNIT transactions
  selectedFeeRate: 2, // Default to standard (2 sat/vB)
};

// Timer for auto-reset from 'confirmed' to 'idle'
let resetTimer: ReturnType<typeof setTimeout> | null = null;

export const useSendFlowStore = create<SendFlowStore>((set) => ({
  // Initial state
  ...initialState,

  // Actions
  setIntentStep: (step) => {
    logger.debug('[SendFlowStore] setIntentStep:', { to: step });

    // Cancel any existing reset timer when step changes
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    // When transaction is confirmed, clear transaction fields
    // so they don't persist to the next transaction
    if (step === 'confirmed') {
      set({
        intentStep: step,
        sendRecipient: '',
        sendAmount: '',
        sendAssetType: null,
      });
      // Auto-reset to idle after 10 seconds
      resetTimer = setTimeout(() => {
        set({ intentStep: 'idle' });
        resetTimer = null;
      }, 10000);
      (resetTimer as { unref?: () => void }).unref?.();
    } else {
      set({ intentStep: step });
    }
  },

  setSendAssetType: (type) => set({ sendAssetType: type }),
  setSendAmount: (amount) => set({ sendAmount: amount }),
  setSendRecipient: (recipient) => set({ sendRecipient: recipient }),
  setSendAddressType: (type) => set({ sendAddressType: type }),
  setRequireConfirmedUtxos: (required) => set({ requireConfirmedUtxos: required }),
  setTurboEnabled: (enabled) => set({ turboEnabled: enabled }),
  setSelectedFeeRate: (rate) => set({ selectedFeeRate: rate }),

  resetSendFlow: () => {
    logger.debug('[SendFlowStore] resetSendFlow');
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    set(initialState);
  },
}));

/**
 * Reset store to initial state (useful for testing)
 */
export const resetSendFlowStore = () => {
  // Clear any pending reset timer
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  useSendFlowStore.setState(initialState);
};

/**
 * useSendFlow - Backwards-compatible hook that returns all state and actions
 * Use this when you need multiple values, or use selective hooks for performance
 */
export const useSendFlow = () => {
  const store = useSendFlowStore();
  return {
    // State
    intentStep: store.intentStep,
    sendAssetType: store.sendAssetType,
    sendAmount: store.sendAmount,
    sendRecipient: store.sendRecipient,
    sendAddressType: store.sendAddressType,
    requireConfirmedUtxos: store.requireConfirmedUtxos,
    turboEnabled: store.turboEnabled,
    selectedFeeRate: store.selectedFeeRate,
    // Actions (wrapped to match React.Dispatch<SetStateAction<T>> signature for backwards compat)
    setIntentStep: store.setIntentStep,
    setSendAssetType: (value: AssetType | ((prev: AssetType) => AssetType)) => {
      if (typeof value === 'function') {
        store.setSendAssetType(value(useSendFlowStore.getState().sendAssetType));
      } else {
        store.setSendAssetType(value);
      }
    },
    setSendAmount: (value: string | ((prev: string) => string)) => {
      if (typeof value === 'function') {
        store.setSendAmount(value(useSendFlowStore.getState().sendAmount));
      } else {
        store.setSendAmount(value);
      }
    },
    setSendRecipient: (value: string | ((prev: string) => string)) => {
      if (typeof value === 'function') {
        store.setSendRecipient(value(useSendFlowStore.getState().sendRecipient));
      } else {
        store.setSendRecipient(value);
      }
    },
    setSendAddressType: (value: SendAddressType | ((prev: SendAddressType) => SendAddressType)) => {
      if (typeof value === 'function') {
        store.setSendAddressType(value(useSendFlowStore.getState().sendAddressType));
      } else {
        store.setSendAddressType(value);
      }
    },
    setRequireConfirmedUtxos: (value: boolean | ((prev: boolean) => boolean)) => {
      if (typeof value === 'function') {
        store.setRequireConfirmedUtxos(value(useSendFlowStore.getState().requireConfirmedUtxos));
      } else {
        store.setRequireConfirmedUtxos(value);
      }
    },
    setTurboEnabled: (value: boolean | ((prev: boolean) => boolean)) => {
      if (typeof value === 'function') {
        store.setTurboEnabled(value(useSendFlowStore.getState().turboEnabled));
      } else {
        store.setTurboEnabled(value);
      }
    },
    setSelectedFeeRate: store.setSelectedFeeRate,
    resetSendFlow: store.resetSendFlow,
  };
};
