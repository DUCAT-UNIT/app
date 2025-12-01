/**
 * Send Flow Store (Zustand)
 * Manages the send transaction UI flow state
 *
 * MIGRATION: Replaces SendFlowContext
 * Benefits: No provider needed, simpler state machine, selective re-renders
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
export type AddressType = 'segwit' | 'taproot';

interface SendFlowState {
  intentStep: IntentStep;
  sendAssetType: AssetType;
  sendAmount: string;
  sendRecipient: string;
  sendAddressType: AddressType;
  requireConfirmedUtxos: boolean;
  turboEnabled: boolean;
}

interface SendFlowActions {
  setIntentStep: (step: IntentStep) => void;
  setSendAssetType: (type: AssetType) => void;
  setSendAmount: (amount: string) => void;
  setSendRecipient: (recipient: string) => void;
  setSendAddressType: (type: AddressType) => void;
  setRequireConfirmedUtxos: (required: boolean) => void;
  setTurboEnabled: (enabled: boolean) => void;
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
};

export const useSendFlowStore = create<SendFlowStore>((set) => ({
  // Initial state
  ...initialState,

  // Actions
  setIntentStep: (step) => {
    logger.debug('[SendFlowStore] setIntentStep:', { to: step });
    // When transaction is confirmed, clear transaction fields
    // so they don't persist to the next transaction
    if (step === 'confirmed') {
      set({
        intentStep: step,
        sendRecipient: '',
        sendAmount: '',
        sendAssetType: null,
      });
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

  resetSendFlow: () => {
    logger.debug('[SendFlowStore] resetSendFlow');
    set(initialState);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useIntentStep = () => useSendFlowStore((state) => state.intentStep);
export const useSendAssetType = () => useSendFlowStore((state) => state.sendAssetType);
export const useSendAmount = () => useSendFlowStore((state) => state.sendAmount);
export const useSendRecipient = () => useSendFlowStore((state) => state.sendRecipient);
export const useTurboEnabled = () => useSendFlowStore((state) => state.turboEnabled);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetSendFlowStore = () => {
  useSendFlowStore.setState(initialState);
};
