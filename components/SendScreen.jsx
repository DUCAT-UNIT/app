/**
 * SendScreen Component
 * Orchestrates the send transaction flow through multiple bottom sheets
 * - Asset selection (BTC, UNIT, or DUCAT)
 * - Address entry
 * - Amount entry
 * - Transaction review
 * - Success confirmation
 */

import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { usePrice } from '../contexts/PriceContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import {
  calculateMaxSendableBTC,
  determineSourceAddress,
} from '../services/transactionCalculationService';
import { useSendSheetAnimations } from '../hooks/useSendSheetAnimations';
import { useSendValidation } from '../hooks/useSendValidation';
import { useSendFlowNavigation } from '../hooks/useSendFlowNavigation';
import AssetSelectorSheet from './send/AssetSelectorSheet';
import AddressInputSheet from './send/AddressInputSheet';
import AmountInputSheet from './send/AmountInputSheet';
import ReviewSheet from './send/ReviewSheet';
import ConfirmationSheet from './send/ConfirmationSheet';
import LoadingSheet from './send/LoadingSheet';

export default function SendScreen({
  keyboardHeight,
  amountInputRef,
  btcBalance,
  unitBalance,
  wallet,
}) {
  // Get contexts
  const { btcPrice } = usePrice();
  const {
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
  } = useSendFlow();
  const { sendIntent, setSendIntent, createSendIntent } = useTransactionBuild();
  const { broadcastedTxid, _setBroadcastedTxid, signIntent } = useTransactionExecution();

  // Validation and loading states
  const { addressError, loadingMessageIndex } = useSendValidation({
    intentStep,
    sendRecipient,
    sendAssetType,
  });

  // Flow navigation and dismiss handlers
  const {
    handleAssetSelectorDismiss,
    handleAddressInputDismiss,
    handleAmountInputDismiss,
    handleReviewDismiss,
    handleConfirmedDismiss,
    handleConfirmedClose,
    handleSheetDismiss,
  } = useSendFlowNavigation();

  // Sheet animations and swipe gestures
  const { assetSelector, addressInput, amountInput, review, confirmed } = useSendSheetAnimations({
    onDismiss: handleSheetDismiss,
  });

  // Ref for address input to maintain focus
  const addressInputRef = useRef(null);

  // Animate sheets in when they become visible
  useEffect(() => {
    if (intentStep === 'selecting_asset') {
      assetSelector.opacity.setValue(1);
      assetSelector.translateY.setValue(0);
    } else if (intentStep === 'entering_address') {
      addressInput.opacity.setValue(1);
      addressInput.translateY.setValue(0);
    } else if (intentStep === 'entering_amount') {
      amountInput.opacity.setValue(1);
      amountInput.translateY.setValue(0);
    } else if (intentStep === 'reviewing') {
      review.opacity.setValue(1);
      review.translateY.setValue(0);
    } else if (intentStep === 'confirmed') {
      confirmed.opacity.setValue(1);
      confirmed.translateY.setValue(0);
    }
  }, [intentStep, assetSelector, addressInput, amountInput, review, confirmed]);

  // Get loading messages for creating transaction
  const getLoadingMessage = () => {
    if (sendAssetType === 'btc') {
      const messages = ['Collecting UTXOs...', 'Building PSBT...'];
      return messages[loadingMessageIndex];
    } else {
      const messages = [
        'Collecting rune UTXOs...',
        'Constructing runestone...',
        'Building PSBT...',
      ];
      return messages[loadingMessageIndex];
    }
  };

  // Handle MAX button for BTC - calculate max sendable amount minus estimated fees
  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      // Determine source address based on recipient address type
      const sourceAddress = determineSourceAddress(sendRecipient, wallet);

      // Calculate max sendable amount using service
      const maxBtc = await calculateMaxSendableBTC({
        sourceAddress,
        btcBalance,
        feeRate: 1, // sats per vbyte (testnet)
      });

      setSendAmount(String(maxBtc));
    } else {
      // For UNIT, just use the full balance
      setSendAmount(String(unitBalance || 0));
    }
  };

  return (
    <>
      {/* Asset Selector Bottom Sheet */}
      <AssetSelectorSheet
        visible={intentStep === 'selecting_asset'}
        opacity={assetSelector.opacity}
        translateY={assetSelector.translateY}
        panHandlers={assetSelector.panHandlers}
        btcBalance={btcBalance}
        unitBalance={unitBalance}
        btcPrice={btcPrice}
        onDismiss={handleAssetSelectorDismiss}
        onSelectAsset={(assetType) => {
          setSendAssetType(assetType);
          setIntentStep('entering_address');
        }}
      />

      {/* Address Input Bottom Sheet */}
      <AddressInputSheet
        visible={intentStep === 'entering_address' && !!sendAssetType}
        opacity={addressInput.opacity}
        translateY={addressInput.translateY}
        panHandlers={addressInput.panHandlers}
        keyboardHeight={keyboardHeight}
        sendRecipient={sendRecipient}
        addressError={addressError}
        addressInputRef={addressInputRef}
        onDismiss={handleAddressInputDismiss}
        onBack={() => {
          setIntentStep('selecting_asset');
          setSendRecipient('');
        }}
        onContinue={() => setIntentStep('entering_amount')}
        onRecipientChange={setSendRecipient}
      />

      {/* Amount Input Bottom Sheet */}
      <AmountInputSheet
        visible={intentStep === 'entering_amount' && !!sendAssetType}
        opacity={amountInput.opacity}
        translateY={amountInput.translateY}
        panHandlers={amountInput.panHandlers}
        keyboardHeight={keyboardHeight}
        sendAssetType={sendAssetType}
        sendAmount={sendAmount}
        sendRecipient={sendRecipient}
        btcBalance={btcBalance}
        unitBalance={unitBalance}
        btcPrice={btcPrice}
        amountInputRef={amountInputRef}
        onDismiss={handleAmountInputDismiss}
        onBack={() => {
          setIntentStep('entering_address');
          setSendAmount('');
        }}
        onAmountChange={setSendAmount}
        onReview={createSendIntent}
        onMaxPress={handleMaxPress}
      />

      {/* Review Transaction Bottom Sheet */}
      <ReviewSheet
        visible={intentStep === 'reviewing' && !!sendIntent}
        opacity={review.opacity}
        translateY={review.translateY}
        panHandlers={review.panHandlers}
        sendIntent={sendIntent}
        btcPrice={btcPrice}
        onDismiss={handleReviewDismiss}
        onBack={() => {
          setIntentStep('entering_amount');
          setSendIntent(null);
        }}
        onCancel={() => {
          setIntentStep('selecting_asset');
          setSendIntent(null);
        }}
        onConfirm={() => {
          signIntent();
        }}
      />

      {/* Transaction Success Bottom Sheet - Disabled, using toast instead */}
      <ConfirmationSheet
        visible={false}
        opacity={confirmed.opacity}
        translateY={confirmed.translateY}
        panHandlers={confirmed.panHandlers}
        broadcastedTxid={broadcastedTxid}
        onDismiss={handleConfirmedDismiss}
        onClose={handleConfirmedClose}
      />

      {/* Creating Transaction Loading Sheet */}
      <LoadingSheet
        visible={intentStep === 'creating'}
        title="Creating Transaction"
        message={getLoadingMessage()}
        dismissible={false}
      />

      {/* Signing/Broadcasting Loading Sheet */}
      <LoadingSheet
        visible={intentStep === 'signing' || intentStep === 'broadcasting'}
        title={intentStep === 'signing' ? 'Signing transaction...' : 'Broadcasting transaction...'}
        dismissible={false}
      />
    </>
  );
}

SendScreen.propTypes = {
  keyboardHeight: PropTypes.number.isRequired,
  amountInputRef: PropTypes.object.isRequired,
  btcBalance: PropTypes.number,
  unitBalance: PropTypes.number,
  wallet: PropTypes.object,
};
