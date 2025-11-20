/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
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

export default function AmountInputScreen({ navigation, route }) {
  const { sendAssetType, sendAmount, setSendAmount, sendRecipient, sendAddressType } = useSendFlow();
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { createSendIntent: _createSendIntent } = useTransactionBuild();
  const { keyboardHeight } = useKeyboard();
  const amountInputRef = useRef(null);

  // Check if this is a Cashu mint transaction
  const isCashuMint = route?.params?.cashuMint === true;
  const cashuQuoteId = route?.params?.quoteId;

  // Use amount input hook for balance calculations and MAX functionality
  const { balance, assetLabel, isCalculatingMax, handleMaxPress, calculateUsdValue } = useAmountInput({
    sendAssetType,
    segwitBalance,
    taprootBalance,
    runesBalance,
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

  // Handle prefilled amount and auto-advance (for non-Spectre flows)
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

  const handleReview = () => {
    if (!sendAmount) return;

    amountInputRef.current?.blur();

    // Navigate to processing screen - the processing screen will handle creating the intent
    // Pass along Cashu mint params if this is a Cashu mint transaction
    navigation.navigate('Processing', {
      fromScreen: 'AmountInput',
      action: 'create_intent',
      cashuMint: isCashuMint,
      quoteId: cashuQuoteId,
    });
  };

  const usdValue = calculateUsdValue(sendAmount, btcPrice);

  // Check if user has sufficient balance
  const unitAmount = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const hasNoUnitBalance = sendAssetType === 'unit' && unitAmount === 0;

  // Check if amount exceeds available balance
  const enteredAmount = parseFloat(sendAmount) || 0;
  const exceedsBalance = sendAmount && enteredAmount > balance;

  // Determine if we should show insufficient balance warning
  const hasInsufficientBalance = hasNoUnitBalance || exceedsBalance;
  const isReviewDisabled = !sendAmount || hasInsufficientBalance;

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
});
