/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { formatNumberWithCommas } from '../../utils/sendHelpers';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useAmountInput } from '../../hooks/useAmountInput';
import { RecipientHeader, BalanceMaxButton } from '../../components/amountInput';
import InsufficientTurboSheet from '../../components/send/InsufficientTurboSheet';
import { requestMint } from '../../services/cashu/cashuWalletService';
import { useCashu } from '../../contexts/CashuContext';
import { logger } from '../../utils/logger';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';

export default function AmountInputScreen({ navigation, route }) {
  const { sendAssetType, sendAmount, setSendAmount, sendRecipient, sendAddressType, turboEnabled, setTurboEnabled, setSendRecipient: setRecipient } = useSendFlow();
  const { settingsHandlers } = useNavigationHandlers();
  const ecashThreshold = settingsHandlers?.ecashThreshold || 100;
  const [isRequestingMint, setIsRequestingMint] = useState(false);
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashu();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { createSendIntent: _createSendIntent } = useTransactionBuild();
  const { keyboardHeight } = useKeyboard();
  const amountInputRef = useRef(null);

  // State for insufficient turbo balance sheet
  const [showInsufficientTurboSheet, setShowInsufficientTurboSheet] = useState(false);
  const [insufficientTurboAmount, setInsufficientTurboAmount] = useState(0);
  const [insufficientTurboBalance, setInsufficientTurboBalance] = useState(0);

  // Check if this is a Cashu mint transaction
  const isCashuMint = route?.params?.cashuMint === true;
  const cashuQuoteId = route?.params?.quoteId;

  // Use amount input hook for balance calculations and MAX functionality
  const { balance, assetLabel, isCalculatingMax, handleMaxPress, calculateUsdValue } = useAmountInput({
    sendAssetType,
    segwitBalance,
    taprootBalance,
    runesBalance,
    cashuBalance,
    wallet,
    sendAddressType,
    setSendAmount,
  });

  // Determine address type from recipient
  const addressType =
    sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p')
      ? 'Taproot'
      : 'Native SegWit';

  useEffect(() => {
    // Auto-focus input when screen loads
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle prefilled amount and auto-advance (for non-Turbo flows)
  useEffect(() => {
    const { prefillAmount, autoAdvance } = route.params || {};

    if (prefillAmount && !sendAmount) {
      setSendAmount(prefillAmount.toString());

      // If autoAdvance is true, automatically proceed to review
      if (autoAdvance) {
        // Small delay to ensure amount is set
        setTimeout(() => {
          amountInputRef.current?.blur();
          navigation.navigate('Processing', {
            fromScreen: 'AmountInput',
            action: 'create_intent',
          });
        }, 500);
      }
    }
  }, [route.params?.prefillAmount, route.params?.autoAdvance]);

  const handleAmountChange = (text) => {
    // Handle decimal comma from keyboard
    let processed = text;

    // If text ends with a comma and there's no period yet, it's a decimal comma
    if (processed.endsWith(',') && !processed.includes('.')) {
      // Replace the last comma with a period
      processed = processed.slice(0, -1) + '.';
    }

    // Remove all remaining commas (thousand separators)
    const cleaned = processed.replace(/,/g, '');

    // Only allow numbers and one decimal point
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setSendAmount(cleaned);
    }
  };

  const handleReview = async () => {
    logger.debug('[AmountInputScreen] handleReview called', {
      sendAmount,
      isRequestingMint,
      sendAssetType,
      turboEnabled,
      sendRecipient,
    });

    if (!sendAmount || isRequestingMint) {
      logger.warn('[AmountInputScreen] Aborting review - missing amount or already requesting mint');
      return;
    }

    amountInputRef.current?.blur();

    // Auto-enable Turbo for UNIT transactions less than threshold
    let shouldUseTurbo = turboEnabled;
    if (sendAssetType === 'unit') {
      const displayAmount = parseFloat(sendAmount);
      // Check against ecashThreshold (Infinity means "All transfers")
      if (displayAmount < ecashThreshold && !turboEnabled) {
        logger.debug(`[AmountInputScreen] Auto-enabling Turbo for transaction < ${ecashThreshold} UNIT`);
        setTurboEnabled(true);
        shouldUseTurbo = true;
      }

      logger.debug(`[AmountInputScreen] Turbo decision:`, {
        shouldUseTurbo,
        turboEnabled,
        displayAmount,
        ecashThreshold,
        sendRecipient,
        sendAssetType
      });
    }

    // If Turbo mode is enabled for UNIT transfers, check if we have enough ecash first
    if (shouldUseTurbo && sendAssetType === 'unit') {
      try {
        setIsRequestingMint(true);

        // Use display amount directly (e.g., "100" for 100 UNIT)
        const displayAmount = parseFloat(sendAmount);
        const amountInSmallestUnits = Math.round(displayAmount * 100);

        // Check current ecash balance
        const { getBalance } = await import('../../services/cashu/cashuWalletService');
        const ecashBalance = await getBalance();
        const ecashBalanceSmallestUnits = Math.round(ecashBalance * 100);

        logger.debug('[AmountInputScreen] Turbo mode - checking balance:', {
          requested: displayAmount,
          ecashBalance,
          hasEnough: ecashBalanceSmallestUnits >= amountInSmallestUnits,
        });

        // If we have enough ecash, skip minting and create P2PK token directly
        if (ecashBalanceSmallestUnits >= amountInSmallestUnits) {
          logger.debug('[AmountInputScreen] ✅ Sufficient ecash balance - skipping mint, creating P2PK token directly');

          setIsRequestingMint(false);

          // Navigate to processing screen to create token
          logger.debug('[AmountInputScreen] Navigating to TurboProcessing...');
          navigation.navigate('TurboProcessing');
          logger.debug('[AmountInputScreen] Navigation call completed');
          return;
        }

        // Not enough ecash - show bottom sheet to ask user
        logger.debug('[AmountInputScreen] ⚠️ Insufficient ecash balance - showing bottom sheet');
        setIsRequestingMint(false);
        setInsufficientTurboAmount(displayAmount);
        setInsufficientTurboBalance(ecashBalance);
        setShowInsufficientTurboSheet(true);
        return;
      } catch (error) {
        logger.error('Failed to request mint quote:', error);
        Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
      } finally {
        setIsRequestingMint(false);
      }
    } else {
      // Normal flow - Navigate to processing screen
      // Pass along Cashu mint params if this is a Cashu mint transaction
      logger.debug('[AmountInputScreen] Normal flow - Navigating to Processing...', {
        isCashuMint,
        cashuQuoteId,
      });
      navigation.navigate('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        cashuMint: isCashuMint,
        quoteId: cashuQuoteId,
      });
      logger.debug('[AmountInputScreen] Navigation call completed');
    }
  };

  // Handler for using Turbo with minting
  const handleUseTurbo = async () => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[AmountInputScreen] User chose Turbo with minting');

    try {
      setIsRequestingMint(true);

      // Request mint quote from Cashu mint
      const mintQuote = await requestMint(insufficientTurboAmount);

      logger.debug('[AmountInputScreen] Received mint quote:', {
        quoteId: mintQuote.quoteId,
        amount: mintQuote.amount,
        depositAddress: mintQuote.depositAddress,
      });

      // Store the original recipient address (where tokens will be locked)
      const originalRecipient = sendRecipient;

      logger.debug('[AmountInputScreen] 🔑 Capturing recipient for P2PK locking:', {
        originalRecipient,
        mintDepositAddress: mintQuote.depositAddress,
        note: 'P2PK tokens will be locked to originalRecipient pubkey'
      });

      // Temporarily update recipient to mint's deposit address
      setRecipient(mintQuote.depositAddress);

      setIsRequestingMint(false);

      // Navigate to processing screen with Turbo params
      navigation.navigate('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        isTurbo: true,
        mintQuoteId: mintQuote.quoteId,
        mintAmount: mintQuote.amount,
        turboRecipient: originalRecipient,
      });
    } catch (error) {
      setIsRequestingMint(false);
      logger.error('[AmountInputScreen] Failed to request mint quote:', error);
      Alert.alert('Error', 'Failed to initiate Turbo transaction. Please try again.');
    }
  };

  // Handler for sending normally (on-chain)
  const handleSendNormally = () => {
    setShowInsufficientTurboSheet(false);
    logger.debug('[AmountInputScreen] User chose regular on-chain send');

    // Disable Turbo and proceed with regular send
    setTurboEnabled(false);

    // Navigate to processing screen for normal send
    navigation.navigate('Processing', {
      fromScreen: 'AmountInput',
      action: 'create_intent',
    });
  };

  const usdValue = calculateUsdValue(sendAmount, btcPrice);

  // Check if user has sufficient balance
  // For UNIT, check total balance (on-chain + ecash)
  const hasNoUnitBalance = sendAssetType === 'unit' && balance === 0;

  // Check if amount exceeds available balance
  const enteredAmount = parseFloat(sendAmount) || 0;
  const exceedsBalance = sendAmount && enteredAmount > balance;

  // Determine if we should show insufficient balance warning
  const hasInsufficientBalance = hasNoUnitBalance || exceedsBalance;
  const isReviewDisabled = !sendAmount || hasInsufficientBalance || isRequestingMint;

  // Debug: Log button disabled state
  React.useEffect(() => {
    logger.debug('[AmountInputScreen] Review button state:', {
      isReviewDisabled,
      sendAmount,
      hasInsufficientBalance,
      hasNoUnitBalance,
      exceedsBalance,
      isRequestingMint,
      balance,
      enteredAmount,
    });
  }, [isReviewDisabled, sendAmount, hasInsufficientBalance, hasNoUnitBalance, exceedsBalance, isRequestingMint, balance, enteredAmount]);

  return (
    <View style={localStyles.container}>
      {/* Header with back button and recipient info */}
      <RecipientHeader
        onBackPress={() => navigation.goBack()}
        recipientAddress={sendRecipient}
        addressType={addressType}
      />

      {/* Content */}
      <View style={localStyles.content}>
        {/* Balance and MAX button */}
        <BalanceMaxButton
          assetLabel={assetLabel}
          balance={balance}
          assetType={sendAssetType}
          onMaxPress={handleMaxPress}
          isCalculating={isCalculatingMax}
        />

        {/* Insufficient balance warning */}
        {hasInsufficientBalance && (
          <View style={localStyles.warningContainer}>
            <Icon name="warning" size={16} color={COLORS.DANGER_RED} />
            <Text style={localStyles.warningText}>
              {hasNoUnitBalance
                ? 'No available UNIT balance to send'
                : 'Insufficient balance'}
            </Text>
          </View>
        )}

        {/* Amount input */}
        <View style={localStyles.amountInputRow}>
          <TextInput
            ref={amountInputRef}
            style={[
              localStyles.amountInput,
              formatNumberWithCommas(sendAmount).length > 8 && localStyles.mediumText,
              formatNumberWithCommas(sendAmount).length > 12 && localStyles.smallText,
              formatNumberWithCommas(sendAmount).length > 15 && localStyles.xsmallText,
            ]}
            value={formatNumberWithCommas(sendAmount)}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={COLORS.MID_DARK_GRAY}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleReview}
          />
          <Icon
            name={sendAssetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
            size={32}
            color={COLORS.VERY_LIGHT_GRAY}
          />
        </View>

        {/* USD conversion */}
        <Text style={localStyles.usdValue}>≈ ${usdValue} USD</Text>
      </View>

      {/* Review Button - Sits on top of keyboard */}
      <View style={[localStyles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableScale
          style={[
            localStyles.reviewButton,
            isReviewDisabled && localStyles.reviewButtonDisabled,
          ]}
          onPress={handleReview}
          disabled={isReviewDisabled}
        >
          <Text style={localStyles.reviewButtonText}>Review</Text>
        </TouchableScale>
      </View>

      {/* Loading overlay while requesting mint quote */}
      {isRequestingMint && (
        <View style={localStyles.loadingOverlay}>
          <View style={localStyles.loadingContent}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={localStyles.loadingText}>Preparing Turbo transaction...</Text>
          </View>
        </View>
      )}

      {/* Insufficient Turbo Balance Sheet */}
      <InsufficientTurboSheet
        visible={showInsufficientTurboSheet}
        onClose={() => setShowInsufficientTurboSheet(false)}
        onUseTurbo={handleUseTurbo}
        onSendNormally={handleSendNormally}
        requiredAmount={insufficientTurboAmount}
        currentBalance={insufficientTurboBalance}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.DANGER_RED,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'right',
    marginRight: 12,
    minWidth: 60,
  },
  mediumText: {
    fontSize: 44,
  },
  smallText: {
    fontSize: 36,
  },
  xsmallText: {
    fontSize: 28,
  },
  usdValue: {
    fontSize: 18,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.DARK_BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  reviewButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    opacity: 0.5,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
    marginTop: 16,
    textAlign: 'center',
  },
});
