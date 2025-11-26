/**
 * SendFlowContext - Manages the send transaction UI flow state
 * Handles the state machine for the send flow and form inputs
 * No dependencies on other contexts - pure UI state
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
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

interface SendFlowContextValue {
  // State
  intentStep: IntentStep;
  sendAssetType: AssetType;
  sendAmount: string;
  sendRecipient: string;
  sendAddressType: AddressType;
  requireConfirmedUtxos: boolean;
  turboEnabled: boolean;

  // Setters
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

const SendFlowContext = createContext<SendFlowContextValue | undefined>(undefined);

export const useSendFlow = (): SendFlowContextValue => {
  const context = useContext(SendFlowContext);
  if (!context) {
    throw new Error('useSendFlow must be used within a SendFlowProvider');
  }
  return context;
};

interface SendFlowProviderProps {
  children: ReactNode;
}

export const SendFlowProvider: React.FC<SendFlowProviderProps> = ({ children }) => {
  // State machine: idle → selecting_asset → entering_address → entering_amount → creating → reviewing → signing → broadcasting → pending → confirmed
  const [intentStep, _setIntentStep] = useState<IntentStep>('idle');

  // Wrapped setter with logging - use useCallback for stable reference
  const setIntentStep = useCallback((newStep: IntentStep) => {
    logger.debug('[SendFlowContext] setIntentStep called:', { to: newStep });
    _setIntentStep(newStep);
  }, []);

  // Form inputs
  const [sendAssetType, setSendAssetType] = useState<AssetType>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState<AddressType>('taproot');
  const [requireConfirmedUtxos, setRequireConfirmedUtxos] = useState(false);
  const [turboEnabled, setTurboEnabled] = useState(false);

  // Auto-manage transaction completion flow
  useEffect(() => {
    if (intentStep === 'confirmed') {
      // Clear ALL transaction fields so they don't persist to next transaction
      setSendRecipient('');
      setSendAmount('');
      setSendAssetType(null);
      setTurboEnabled(false);
      setRequireConfirmedUtxos(false);

      // Auto-reset to idle after 10 seconds when confirmed
      const timer = setTimeout(() => {
        setIntentStep('idle');
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [intentStep, setIntentStep]);

  // Reset all send flow state - memoized to prevent unnecessary re-renders
  const resetSendFlow = useCallback(() => {
    logger.debug('[SendFlowContext] resetSendFlow called');
    setIntentStep('idle');
    setSendAssetType(null);
    setSendAmount('');
    setSendRecipient('');
    setSendAddressType('taproot');
    setRequireConfirmedUtxos(false);
    setTurboEnabled(false);
  }, [setIntentStep]);

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
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
    }),
    [intentStep, sendAssetType, sendAmount, sendRecipient, sendAddressType, requireConfirmedUtxos, turboEnabled, setIntentStep, resetSendFlow]
  );

  return <SendFlowContext.Provider value={value}>{children}</SendFlowContext.Provider>;
};
