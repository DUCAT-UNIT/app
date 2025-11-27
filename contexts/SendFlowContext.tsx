/**
 * SendFlowContext - MIGRATED TO ZUSTAND
 *
 * This file now provides backward compatibility by wrapping the Zustand store.
 * New code should import directly from stores/sendFlowStore.ts
 *
 * MIGRATION STATUS: Complete
 * - Provider handles the auto-reset effect on 'confirmed' step
 * - Hook returns Zustand store values with compatible interface
 */

import React, { useEffect, ReactNode, useCallback } from 'react';
import {
  useSendFlowStore,
  IntentStep,
  AssetType,
  AddressType,
} from '../stores/sendFlowStore';

// Re-export types for backward compatibility
export type { IntentStep, AssetType, AddressType };

interface SendFlowContextValue {
  // State
  intentStep: IntentStep;
  sendAssetType: AssetType;
  sendAmount: string;
  sendRecipient: string;
  sendAddressType: AddressType;
  requireConfirmedUtxos: boolean;
  turboEnabled: boolean;

  // Setters (matching React.Dispatch<SetStateAction<T>> signature)
  setIntentStep: (step: IntentStep) => void;
  setSendAssetType: React.Dispatch<React.SetStateAction<AssetType>>;
  setSendAmount: React.Dispatch<React.SetStateAction<string>>;
  setSendRecipient: React.Dispatch<React.SetStateAction<string>>;
  setSendAddressType: React.Dispatch<React.SetStateAction<AddressType>>;
  setRequireConfirmedUtxos: React.Dispatch<React.SetStateAction<boolean>>;
  setTurboEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  resetSendFlow: () => void;
}

/**
 * Hook that provides backward-compatible interface to Zustand store
 * Uses selective subscriptions for optimal performance
 */
export const useSendFlow = (): SendFlowContextValue => {
  // Subscribe to individual state slices for optimal re-renders
  const intentStep = useSendFlowStore((state) => state.intentStep);
  const sendAssetType = useSendFlowStore((state) => state.sendAssetType);
  const sendAmount = useSendFlowStore((state) => state.sendAmount);
  const sendRecipient = useSendFlowStore((state) => state.sendRecipient);
  const sendAddressType = useSendFlowStore((state) => state.sendAddressType);
  const requireConfirmedUtxos = useSendFlowStore((state) => state.requireConfirmedUtxos);
  const turboEnabled = useSendFlowStore((state) => state.turboEnabled);

  // Subscribe to actions (stable references)
  const setIntentStep = useSendFlowStore((state) => state.setIntentStep);
  const setSendAssetTypeStore = useSendFlowStore((state) => state.setSendAssetType);
  const setSendAmountStore = useSendFlowStore((state) => state.setSendAmount);
  const setSendRecipientStore = useSendFlowStore((state) => state.setSendRecipient);
  const setSendAddressTypeStore = useSendFlowStore((state) => state.setSendAddressType);
  const setRequireConfirmedUtxosStore = useSendFlowStore((state) => state.setRequireConfirmedUtxos);
  const setTurboEnabledStore = useSendFlowStore((state) => state.setTurboEnabled);
  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);

  // Wrap setters to match React.Dispatch<SetStateAction<T>> signature
  const setSendAssetType = useCallback((value: AssetType | ((prev: AssetType) => AssetType)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().sendAssetType;
      setSendAssetTypeStore(value(currentValue));
    } else {
      setSendAssetTypeStore(value);
    }
  }, [setSendAssetTypeStore]);

  const setSendAmount = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().sendAmount;
      setSendAmountStore(value(currentValue));
    } else {
      setSendAmountStore(value);
    }
  }, [setSendAmountStore]);

  const setSendRecipient = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().sendRecipient;
      setSendRecipientStore(value(currentValue));
    } else {
      setSendRecipientStore(value);
    }
  }, [setSendRecipientStore]);

  const setSendAddressType = useCallback((value: AddressType | ((prev: AddressType) => AddressType)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().sendAddressType;
      setSendAddressTypeStore(value(currentValue));
    } else {
      setSendAddressTypeStore(value);
    }
  }, [setSendAddressTypeStore]);

  const setRequireConfirmedUtxos = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().requireConfirmedUtxos;
      setRequireConfirmedUtxosStore(value(currentValue));
    } else {
      setRequireConfirmedUtxosStore(value);
    }
  }, [setRequireConfirmedUtxosStore]);

  const setTurboEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      const currentValue = useSendFlowStore.getState().turboEnabled;
      setTurboEnabledStore(value(currentValue));
    } else {
      setTurboEnabledStore(value);
    }
  }, [setTurboEnabledStore]);

  return {
    // State
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    sendAddressType,
    requireConfirmedUtxos,
    turboEnabled,

    // Setters
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
    setSendAddressType,
    setRequireConfirmedUtxos,
    setTurboEnabled,

    // Actions
    resetSendFlow,
  };
};

interface SendFlowProviderProps {
  children: ReactNode;
}

/**
 * Provider handles the auto-reset effect when transaction is confirmed
 */
export const SendFlowProvider: React.FC<SendFlowProviderProps> = ({ children }) => {
  const intentStep = useSendFlowStore((state) => state.intentStep);
  const setIntentStep = useSendFlowStore((state) => state.setIntentStep);
  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);

  // Auto-manage transaction completion flow
  useEffect(() => {
    if (intentStep === 'confirmed') {
      // Clear ALL transaction fields so they don't persist to next transaction
      // Note: We only reset to idle after timeout, not the full reset
      // The full reset happens on the next send flow start

      // Auto-reset to idle after 10 seconds when confirmed
      const timer = setTimeout(() => {
        setIntentStep('idle');
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [intentStep, setIntentStep, resetSendFlow]);

  return <>{children}</>;
};
