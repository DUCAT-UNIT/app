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
import { NavigationProp, RouteProp } from '@react-navigation/native';
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
import { useResponsive } from '../../hooks/useResponsive';
import styles from './AmountInputScreen.styles';

/**
 * Route parameters for AmountInputScreen
 */
interface AmountInputRouteParams {
  cashuMint?: boolean;
  quoteId?: string;
  prefillAmount?: string;
  autoAdvance?: boolean;
}

/**
 * Props for AmountInputScreen
 */
interface AmountInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: AmountInputRouteParams }, 'params'>;
}

export default function AmountInputScreen({ navigation, route }: AmountInputScreenProps): React.JSX.Element {
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
  const amountInputRef = useRef<TextInput>(null);
  const { s, sf } = useResponsive();

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

  const handleAmountChange = (text: string): void => {
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

  // Dynamic font sizing for amount input
  const displayAmount = formatNumberWithCommas(sendAmount);
  let fontSize = sf(54);
  if (displayAmount.length > 8) fontSize = sf(40);
  if (displayAmount.length > 12) fontSize = sf(32);
  if (displayAmount.length > 15) fontSize = sf(24);

  return (
    <View style={styles.container} testID="amount-input-screen">
      <RecipientHeader
        onBackPress={() => navigation.goBack()}
        recipientAddress={sendRecipient}
        addressType={addressType}
      />

      <View style={[styles.content, { paddingTop: s(40) }]}>
        <BalanceMaxButton
          assetLabel={assetLabel}
          balance={balance}
          assetType={sendAssetType}
          onMaxPress={handleMaxPress}
          isCalculating={isCalculatingMax}
          testID="amount-max-btn"
        />

        {hasInsufficientBalance && (
          <View style={[
            styles.warningContainer,
            {
              borderRadius: s(8),
              paddingVertical: s(12),
              paddingHorizontal: s(16),
              marginBottom: s(24),
              gap: s(8),
            }
          ]} testID="amount-error">
            <Icon name="warning" size={s(16)} color={COLORS.DANGER_RED} />
            <Text style={[styles.warningText, { fontSize: sf(14) }]}>
              {hasNoUnitBalance ? 'No available UNIT balance to send' : 'Insufficient balance'}
            </Text>
          </View>
        )}

        <View style={[styles.amountInputRow, { marginBottom: s(12) }]}>
          <TextInput
            ref={amountInputRef}
            style={[
              styles.amountInput,
              {
                fontSize,
                marginRight: s(12),
                minWidth: s(60),
              }
            ]}
            value={displayAmount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={COLORS.MID_DARK_GRAY}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={onReviewPress}
            testID="amount-input"
          />
          <Icon
            name={sendAssetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
            size={s(32)}
            color={COLORS.VERY_LIGHT_GRAY}
          />
        </View>

        <Text style={[styles.usdValue, { fontSize: sf(18) }]} testID="amount-usd-value">≈ ${usdValue} USD</Text>
      </View>

      <View style={[styles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableScale
          style={[
            styles.reviewButton,
            { borderRadius: s(12), paddingVertical: s(16) },
            isReviewDisabled && styles.reviewButtonDisabled
          ]}
          onPress={onReviewPress}
          disabled={isReviewDisabled}
          testID="amount-review-btn"
        >
          <Text style={[styles.reviewButtonText, { fontSize: sf(16) }]}>Review</Text>
        </TouchableScale>
      </View>

      {isRequestingMint && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={[styles.loadingText, { fontSize: sf(16), marginTop: s(16) }]}>Preparing Turbo transaction...</Text>
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
