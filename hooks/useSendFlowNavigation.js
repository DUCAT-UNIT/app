/**
 * useSendFlowNavigation Hook
 * Manages step navigation and state cleanup for send transaction flow
 * Provides dismiss handlers for each step that clean up appropriate state
 */

import { useCallback } from 'react';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';

export function useSendFlowNavigation() {
  const { setIntentStep, setSendAssetType, setSendAmount, setSendRecipient } = useSendFlow();

  const { setSendIntent } = useTransactionBuild();
  const { setBroadcastedTxid } = useTransactionExecution();

  // Dismiss handlers for each step
  const handleAssetSelectorDismiss = useCallback(() => {
    setIntentStep('idle');
  }, [setIntentStep]);

  const handleAddressInputDismiss = useCallback(() => {
    setIntentStep('idle');
    setSendAssetType(null);
    setSendRecipient('');
  }, [setIntentStep, setSendAssetType, setSendRecipient]);

  const handleAmountInputDismiss = useCallback(() => {
    setIntentStep('idle');
    setSendAssetType(null);
    setSendAmount('');
    setSendRecipient('');
  }, [setIntentStep, setSendAssetType, setSendAmount, setSendRecipient]);

  const handleReviewDismiss = useCallback(() => {
    setIntentStep('idle');
    setSendIntent(null);
  }, [setIntentStep, setSendIntent]);

  const handleConfirmedDismiss = useCallback(() => {
    setIntentStep('idle');
    setSendIntent(null);
    setSendAmount('');
    setSendRecipient('');
    setSendAssetType(null);
    setBroadcastedTxid(null);
  }, [
    setIntentStep,
    setSendIntent,
    setSendAmount,
    setSendRecipient,
    setSendAssetType,
    setBroadcastedTxid,
  ]);

  const handleConfirmedClose = useCallback(() => {
    setSendIntent(null);
    setIntentStep('idle');
    setSendAmount('');
    setSendRecipient('');
    setSendAssetType(null);
    setBroadcastedTxid(null);
  }, [
    setSendIntent,
    setIntentStep,
    setSendAmount,
    setSendRecipient,
    setSendAssetType,
    setBroadcastedTxid,
  ]);

  // Unified dismiss handler for animations hook
  const handleSheetDismiss = useCallback(
    (sheetName) => {
      switch (sheetName) {
        case 'assetSelector':
          handleAssetSelectorDismiss();
          break;
        case 'addressInput':
          handleAddressInputDismiss();
          break;
        case 'amountInput':
          handleAmountInputDismiss();
          break;
        case 'review':
          handleReviewDismiss();
          break;
        case 'confirmed':
          handleConfirmedDismiss();
          break;
        default:
          break;
      }
    },
    [
      handleAssetSelectorDismiss,
      handleAddressInputDismiss,
      handleAmountInputDismiss,
      handleReviewDismiss,
      handleConfirmedDismiss,
    ]
  );

  return {
    handleAssetSelectorDismiss,
    handleAddressInputDismiss,
    handleAmountInputDismiss,
    handleReviewDismiss,
    handleConfirmedDismiss,
    handleConfirmedClose,
    handleSheetDismiss, // For animation hook
  };
}
