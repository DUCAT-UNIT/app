/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
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
import { useKeyboard } from '../../hooks/useKeyboard';
import { useAmountInput } from '../../hooks/useAmountInput';
import { useTurboReview } from '../../hooks/useTurboReview';
import { RecipientHeader, BalanceMaxButton } from '../../components/amountInput';
import InsufficientTurboSheet from '../../components/send/InsufficientTurboSheet';
import { useCashu } from '../../contexts/CashuContext';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import styles from './AmountInputScreen.styles';

export default function AmountInputScreen({ navigation, route }) {
  const {
    sendAssetType,
    sendAmount,
    setSendAmount,
    sendRecipient,
    sendAddressType,
    turboEnabled,
    setTurboEnabled,
    setSendRecipient,
  } = useSendFlow();
  const { settingsHandlers } = useNavigationHandlers();
  const ecashThreshold = settingsHandlers?.ecashThreshold || 100;
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashu();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { keyboardHeight } = useKeyboard();
  const amountInputRef = useRef(null);

  // Cashu mint params
  const isCashuMint = route?.params?.cashuMint === true;
  const cashuQuoteId = route?.params?.quoteId;

  // Amount input hook
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

  // Turbo review logic
  const {
    isRequestingMint,
    showInsufficientTurboSheet,
    setShowInsufficientTurboSheet,
    insufficientTurboAmount,
    insufficientTurboBalance,
    handleReview,
    handleUseTurbo,
    handleSendNormally,
  } = useTurboReview({
    sendAmount,
    sendAssetType,
    sendRecipient,
    turboEnabled,
    setTurboEnabled,
    setSendRecipient,
    setSendAmount,
    ecashThreshold,
    navigation,
    isCashuMint,
    cashuQuoteId,
  });

  // Address type from recipient
  const addressType =
    sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p')
      ? 'Taproot'
      : 'Native SegWit';

  // Auto-focus input
  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle prefilled amount
  useEffect(() => {
    const { prefillAmount, autoAdvance } = route.params || {};

    if (prefillAmount && !sendAmount) {
      setSendAmount(prefillAmount.toString());

      if (autoAdvance) {
        setTimeout(() => {
          amountInputRef.current?.blur();
          navigation.navigate('Processing', {
            fromScreen: 'AmountInput',
            action: 'create_intent',
          });
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAmountChange = (text) => {
    let processed = text;

    if (processed.endsWith(',') && !processed.includes('.')) {
      processed = processed.slice(0, -1) + '.';
    }

    const cleaned = processed.replace(/,/g, '');

    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setSendAmount(cleaned);
    }
  };

  const onReviewPress = () => {
    amountInputRef.current?.blur();
    handleReview();
  };

  const usdValue = calculateUsdValue(sendAmount, btcPrice);

  // Balance checks
  const hasNoUnitBalance = sendAssetType === 'unit' && balance === 0;
  const enteredAmount = parseFloat(sendAmount) || 0;
  const exceedsBalance = sendAmount && enteredAmount > balance;
  const hasInsufficientBalance = hasNoUnitBalance || exceedsBalance;
  const isReviewDisabled = !sendAmount || hasInsufficientBalance || isRequestingMint;

  return (
    <View style={styles.container}>
      <RecipientHeader
        onBackPress={() => navigation.goBack()}
        recipientAddress={sendRecipient}
        addressType={addressType}
      />

      <View style={styles.content}>
        <BalanceMaxButton
          assetLabel={assetLabel}
          balance={balance}
          assetType={sendAssetType}
          onMaxPress={handleMaxPress}
          isCalculating={isCalculatingMax}
        />

        {hasInsufficientBalance && (
          <View style={styles.warningContainer}>
            <Icon name="warning" size={16} color={COLORS.DANGER_RED} />
            <Text style={styles.warningText}>
              {hasNoUnitBalance ? 'No available UNIT balance to send' : 'Insufficient balance'}
            </Text>
          </View>
        )}

        <View style={styles.amountInputRow}>
          <TextInput
            ref={amountInputRef}
            style={[
              styles.amountInput,
              formatNumberWithCommas(sendAmount).length > 8 && styles.mediumText,
              formatNumberWithCommas(sendAmount).length > 12 && styles.smallText,
              formatNumberWithCommas(sendAmount).length > 15 && styles.xsmallText,
            ]}
            value={formatNumberWithCommas(sendAmount)}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={COLORS.MID_DARK_GRAY}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={onReviewPress}
          />
          <Icon
            name={sendAssetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
            size={32}
            color={COLORS.VERY_LIGHT_GRAY}
          />
        </View>

        <Text style={styles.usdValue}>≈ ${usdValue} USD</Text>
      </View>

      <View style={[styles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableScale
          style={[styles.reviewButton, isReviewDisabled && styles.reviewButtonDisabled]}
          onPress={onReviewPress}
          disabled={isReviewDisabled}
        >
          <Text style={styles.reviewButtonText}>Review</Text>
        </TouchableScale>
      </View>

      {isRequestingMint && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Preparing Turbo transaction...</Text>
          </View>
        </View>
      )}

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
