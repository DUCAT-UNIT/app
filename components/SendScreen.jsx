/**
 * SendScreen Component
 * Orchestrates the send transaction flow through multiple bottom sheets
 * - Asset selection (BTC, UNIT, or DUCAT)
 * - Address entry
 * - Amount entry
 * - Transaction review
 * - Success confirmation
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PanResponder, Animated, Dimensions } from 'react-native';
import { validateBitcoinAddress } from '../utils/sendHelpers';
import AssetSelectorSheet from './send/AssetSelectorSheet';
import AddressInputSheet from './send/AddressInputSheet';
import AmountInputSheet from './send/AmountInputSheet';
import ReviewSheet from './send/ReviewSheet';
import ConfirmationSheet from './send/ConfirmationSheet';
import LoadingSheet from './send/LoadingSheet';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function SendScreen({
  // State
  intentStep,
  sendAssetType,
  sendAmount,
  sendRecipient,
  sendIntent,
  broadcastedTxid,
  keyboardHeight,
  amountInputRef,
  btcBalance,
  unitBalance,
  btcPrice,
  wallet,

  // Setters
  setIntentStep,
  setSendAssetType,
  setSendAmount,
  setSendRecipient,
  setSendIntent,
  setBroadcastedTxid,

  // Handlers
  createSendIntent,
  signIntent,
}) {
  // Address validation state
  const [addressError, setAddressError] = useState('');

  // Loading message state for creating transaction
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Ref for address input to maintain focus
  const addressInputRef = React.useRef(null);

  // Auto-validate address on change
  useEffect(() => {
    if (intentStep === 'entering_address' && sendRecipient) {
      const validation = validateBitcoinAddress(sendRecipient);
      setAddressError(validation.error);
    } else {
      setAddressError('');
    }
  }, [sendRecipient, intentStep]);

  // Cycle through loading messages
  useEffect(() => {
    if (intentStep === 'creating') {
      setLoadingMessageIndex(0);
      const maxMessages = sendAssetType === 'btc' ? 2 : 3;

      const timer = setInterval(() => {
        setLoadingMessageIndex((prev) => {
          if (prev < maxMessages - 1) {
            return prev + 1;
          }
          return prev; // Stay on last message
        });
      }, 500); // 500ms between messages

      return () => clearInterval(timer);
    }
  }, [intentStep, sendAssetType]);

  // Animated values for swipe-down dismissal
  const assetSelectorTranslateY = useRef(new Animated.Value(0)).current;
  const addressInputTranslateY = useRef(new Animated.Value(0)).current;
  const amountInputTranslateY = useRef(new Animated.Value(0)).current;
  const reviewTranslateY = useRef(new Animated.Value(0)).current;
  const confirmedTranslateY = useRef(new Animated.Value(0)).current;

  const assetSelectorOpacity = useRef(new Animated.Value(0)).current;
  const addressInputOpacity = useRef(new Animated.Value(0)).current;
  const amountInputOpacity = useRef(new Animated.Value(0)).current;
  const reviewOpacity = useRef(new Animated.Value(0)).current;
  const confirmedOpacity = useRef(new Animated.Value(0)).current;

  // Pan responder refs - create once and reuse
  const assetSelectorPanResponderRef = useRef(null);
  const addressInputPanResponderRef = useRef(null);
  const amountInputPanResponderRef = useRef(null);
  const reviewPanResponderRef = useRef(null);
  const confirmedPanResponderRef = useRef(null);

  // Handle dismiss functions for each sheet
  const handleAssetSelectorDismiss = () => {
    setIntentStep('idle');
  };

  const handleAddressInputDismiss = () => {
    setIntentStep('idle');
    setSendAssetType(null);
    setSendRecipient('');
  };

  const handleAmountInputDismiss = () => {
    setIntentStep('idle');
    setSendAssetType(null);
    setSendAmount('');
    setSendRecipient('');
  };

  const handleReviewDismiss = () => {
    setIntentStep('idle');
    setSendIntent(null);
  };

  const handleConfirmedDismiss = () => {
    setIntentStep('idle');
    setSendIntent(null);
    setSendAmount('');
    setSendRecipient('');
    setSendAssetType(null);
    setBroadcastedTxid(null);
  };

  const handleConfirmedClose = () => {
    setSendIntent(null);
    setIntentStep('idle');
    setSendAmount('');
    setSendRecipient('');
    setSendAssetType(null);
    setBroadcastedTxid(null);
  };

  // Create pan responders once
  if (!assetSelectorPanResponderRef.current) {
    assetSelectorPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          assetSelectorTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleAssetSelectorDismiss();
        } else {
          Animated.spring(assetSelectorTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!addressInputPanResponderRef.current) {
    addressInputPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          addressInputTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleAddressInputDismiss();
        } else {
          Animated.spring(addressInputTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!amountInputPanResponderRef.current) {
    amountInputPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          amountInputTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleAmountInputDismiss();
        } else {
          Animated.spring(amountInputTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!reviewPanResponderRef.current) {
    reviewPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          reviewTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleReviewDismiss();
        } else {
          Animated.spring(reviewTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!confirmedPanResponderRef.current) {
    confirmedPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          confirmedTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleConfirmedDismiss();
        } else {
          Animated.spring(confirmedTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  // Animate sheets in when they become visible
  useEffect(() => {
    if (intentStep === 'selecting_asset') {
      assetSelectorOpacity.setValue(1);
      assetSelectorTranslateY.setValue(0);
    } else if (intentStep === 'entering_address') {
      addressInputOpacity.setValue(1);
      addressInputTranslateY.setValue(0);
    } else if (intentStep === 'entering_amount') {
      amountInputOpacity.setValue(1);
      amountInputTranslateY.setValue(0);
    } else if (intentStep === 'reviewing') {
      reviewOpacity.setValue(1);
      reviewTranslateY.setValue(0);
    } else if (intentStep === 'confirmed') {
      confirmedOpacity.setValue(1);
      confirmedTranslateY.setValue(0);
    }
  }, [intentStep]);

  // Get loading messages for creating transaction
  const getLoadingMessage = () => {
    if (sendAssetType === 'btc') {
      const messages = ['Collecting UTXOs...', 'Building PSBT...'];
      return messages[loadingMessageIndex];
    } else {
      const messages = ['Collecting rune UTXOs...', 'Constructing runestone...', 'Building PSBT...'];
      return messages[loadingMessageIndex];
    }
  };

  // Handle MAX button for BTC - calculate max sendable amount minus estimated fees
  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      try {
        // Fetch UTXOs to calculate realistic fee based on actual inputs needed
        const sourceAddress = sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p')
          ? wallet?.taprootAddress
          : wallet?.p2wpkhAddress;

        if (!sourceAddress) {
          // Fallback to simple estimation if we can't fetch UTXOs
          const estimatedFee = 140;
          const btcBalanceInSats = Math.floor(btcBalance * 100000000);
          const maxSendable = Math.max(0, btcBalanceInSats - estimatedFee);
          const maxBtc = maxSendable / 100000000;
          setSendAmount(String(maxBtc));
          return;
        }

        const utxoResponse = await fetch(`https://mutinynet.com/api/address/${sourceAddress}/utxo`);
        const utxos = await utxoResponse.json();
        const confirmedUtxos = utxos.filter(u => u.status.confirmed);

        // Transaction size calculation constants
        const BASE_TX_SIZE = 10;
        const P2WPKH_INPUT_SIZE = 68;
        const P2WPKH_OUTPUT_SIZE = 31;
        const feeRate = 1; // sats per vbyte (testnet)

        // Calculate fee for given number of inputs and outputs
        const calculateFee = (numInputs, numOutputs) => {
          const txSize = BASE_TX_SIZE + (numInputs * P2WPKH_INPUT_SIZE) + (numOutputs * P2WPKH_OUTPUT_SIZE);
          return Math.ceil(txSize * feeRate);
        };

        // For MAX, use ALL confirmed UTXOs to send the absolute maximum
        // Calculate total value of all UTXOs
        const totalInputValue = confirmedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
        const numInputsNeeded = confirmedUtxos.length;

        console.log('[MAX] Total UTXOs:', numInputsNeeded, 'Total value:', totalInputValue, 'sats');

        // For MAX, we want to send everything, so we only need 1 output (recipient)
        // No change output since we're sending the maximum
        const DUST_LIMIT = 546;
        const feeWithOneOutput = calculateFee(numInputsNeeded, 1);
        const actualMaxSendable = totalInputValue - feeWithOneOutput;

        console.log('[MAX] Fee for', numInputsNeeded, 'inputs + 1 output:', feeWithOneOutput, 'sats');
        console.log('[MAX] Max sendable amount:', actualMaxSendable, 'sats');

        // Ensure we're above dust limit
        if (actualMaxSendable < DUST_LIMIT) {
          console.error('Max sendable amount is below dust limit');
          setSendAmount('0');
          return;
        }

        const maxBtc = actualMaxSendable / 100000000;
        setSendAmount(String(maxBtc));
      } catch (error) {
        console.error('Error calculating max amount:', error);
        // Fallback to simple estimation
        const estimatedFee = 140;
        const btcBalanceInSats = Math.floor(btcBalance * 100000000);
        const maxSendable = Math.max(0, btcBalanceInSats - estimatedFee);
        const maxBtc = maxSendable / 100000000;
        setSendAmount(String(maxBtc));
      }
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
        opacity={assetSelectorOpacity}
        translateY={assetSelectorTranslateY}
        panHandlers={assetSelectorPanResponderRef.current?.panHandlers}
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
        opacity={addressInputOpacity}
        translateY={addressInputTranslateY}
        panHandlers={addressInputPanResponderRef.current?.panHandlers}
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
        opacity={amountInputOpacity}
        translateY={amountInputTranslateY}
        panHandlers={amountInputPanResponderRef.current?.panHandlers}
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
        opacity={reviewOpacity}
        translateY={reviewTranslateY}
        panHandlers={reviewPanResponderRef.current?.panHandlers}
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
        opacity={confirmedOpacity}
        translateY={confirmedTranslateY}
        panHandlers={confirmedPanResponderRef.current?.panHandlers}
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
  intentStep: PropTypes.oneOf(['idle', 'selecting_asset', 'entering_address', 'entering_amount', 'creating', 'reviewing', 'signing', 'broadcasting', 'confirmed']).isRequired,
  sendAssetType: PropTypes.oneOf(['btc', 'unit', 'ducat']),
  sendAmount: PropTypes.string.isRequired,
  sendRecipient: PropTypes.string.isRequired,
  sendIntent: PropTypes.object,
  broadcastedTxid: PropTypes.string,
  keyboardHeight: PropTypes.number.isRequired,
  amountInputRef: PropTypes.object.isRequired,
  btcBalance: PropTypes.number,
  unitBalance: PropTypes.number,
  btcPrice: PropTypes.number,
  setIntentStep: PropTypes.func.isRequired,
  setSendAssetType: PropTypes.func.isRequired,
  setSendAmount: PropTypes.func.isRequired,
  setSendRecipient: PropTypes.func.isRequired,
  setSendIntent: PropTypes.func.isRequired,
  setBroadcastedTxid: PropTypes.func.isRequired,
  createSendIntent: PropTypes.func.isRequired,
  signIntent: PropTypes.func.isRequired,
};
