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
    Animated.timing(assetSelectorTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      assetSelectorOpacity.setValue(0);
      setIntentStep('idle');
    });
  };

  const handleAddressInputDismiss = () => {
    Animated.timing(addressInputTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      addressInputOpacity.setValue(0);
      setIntentStep('idle');
      setSendAssetType(null);
      setSendRecipient('');
    });
  };

  const handleAmountInputDismiss = () => {
    Animated.timing(amountInputTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      amountInputOpacity.setValue(0);
      setIntentStep('idle');
      setSendAssetType(null);
      setSendAmount('');
      setSendRecipient('');
    });
  };

  const handleReviewDismiss = () => {
    Animated.timing(reviewTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      reviewOpacity.setValue(0);
      setIntentStep('idle');
      setSendIntent(null);
    });
  };

  const handleConfirmedDismiss = () => {
    Animated.timing(confirmedTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      confirmedOpacity.setValue(0);
      setSendIntent(null);
      setIntentStep('idle');
      setSendAmount('');
      setSendRecipient('');
      setSendAssetType(null);
      setBroadcastedTxid(null);
    });
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
      onStartShouldSetPanResponder: () => true,
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
      onStartShouldSetPanResponder: () => true,
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
      onStartShouldSetPanResponder: () => true,
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
      onStartShouldSetPanResponder: () => true,
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
      onStartShouldSetPanResponder: () => true,
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
          console.log(`${assetType.toUpperCase()} asset selected`);
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
          console.log('Confirm button pressed!');
          signIntent();
        }}
      />

      {/* Transaction Success Bottom Sheet */}
      <ConfirmationSheet
        visible={intentStep === 'confirmed' && !!broadcastedTxid}
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
