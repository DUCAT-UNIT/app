/**
 * SendFlowContext - Manages the send transaction UI flow state
 * Handles the state machine for the send flow and form inputs
 * No dependencies on other contexts - pure UI state
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';

const SendFlowContext = createContext();

export const useSendFlow = () => {
  const context = useContext(SendFlowContext);
  if (!context) {
    throw new Error('useSendFlow must be used within a SendFlowProvider');
  }
  return context;
};

export const SendFlowProvider = ({ children }) => {
  // State machine: idle → selecting_asset → entering_address → entering_amount → creating → reviewing → signing → broadcasting → pending → confirmed
  const [intentStep, _setIntentStep] = useState('idle');

  // Wrapped setter with logging - use useCallback for stable reference
  const setIntentStep = useCallback((newStep) => {
    logger.debug('[SendFlowContext] setIntentStep called:', { to: newStep });
    _setIntentStep(newStep);
  }, []);

  // Form inputs
  const [sendAssetType, setSendAssetType] = useState(null); // 'btc' | 'unit'
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState('taproot'); // 'segwit' | 'taproot'
  const [requireConfirmedUtxos, setRequireConfirmedUtxos] = useState(false); // For Turbo/Fuse - only use confirmed UTXOs
  const [turboEnabled, setTurboEnabled] = useState(false); // For Turbo mode - create address-bound Cashu tokens

  // Auto-manage transaction completion flow
  useEffect(() => {
    if (intentStep === 'confirmed') {
      // Clear transaction fields so they don't persist
      setSendRecipient('');
      setSendAmount('');
      setSendAssetType(null);

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
