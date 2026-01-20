/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing, fee estimation
 */

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  Text,
  View,
  TextInput,
  ActivityIndicator,
  Pressable,
  InputAccessoryView,
  Platform,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { COLORS } from '../../theme';
import TouchableScale from '../../components/common/TouchableScale';
import { formatNumberWithCommas } from '../../utils/sendHelpers';
import { formatFiat } from '../../utils/formatters';
import { useSendFlow } from '../../stores/sendFlowStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { useWallet } from '../../contexts/WalletContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useAmountInput } from '../../hooks/useAmountInput';
import { useTurboReview } from '../../hooks/useTurboReview';
import { RecipientHeader } from '../../components/amountInput';
import InsufficientTurboSheet from '../../components/send/InsufficientTurboSheet';
import { useCashu } from '../../contexts/CashuContext';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import { useResponsive } from '../../hooks/useResponsive';
import { logger } from '../../utils/logger';
import styles from './AmountInputScreen.styles';

// Estimated fees in sats (conservative estimates)
const ESTIMATED_BTC_FEE_SATS = 250;
const ESTIMATED_UNIT_FEE_SATS = 500; // UNIT transactions have more outputs

/**
 * Safe BTC to satoshi conversion avoiding floating point errors
 * @param btcString - BTC amount as string (e.g. "0.001")
 * @returns Amount in satoshis
 */
function btcToSats(btcString: string): number {
  // Split on decimal point and handle each part as integer
  const parts = btcString.replace(',', '.').split('.');
  const wholePart = parseInt(parts[0] || '0', 10) * 100000000;
  if (parts.length === 1) return wholePart;

  // Pad or truncate decimal part to 8 digits
  const decimalPart = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return wholePart + parseInt(decimalPart, 10);
}

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

  // Fee estimation
  const estimatedFeeSats = sendAssetType === 'unit' ? ESTIMATED_UNIT_FEE_SATS : ESTIMATED_BTC_FEE_SATS;
  const estimatedFeeBtc = estimatedFeeSats / 100000000;

  // Check if user has enough BTC to cover fees when sending UNIT
  const btcBalanceSats = btcToSats((segwitBalance || 0).toString());
  const hasInsufficientBtcForFees = sendAssetType === 'unit' && btcBalanceSats < estimatedFeeSats;

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

  // Auto-toggle turbo based on ecash threshold
  useEffect(() => {
    if (sendAssetType === 'unit' && sendAmount) {
      const amount = parseFloat(sendAmount) || 0;
      if (amount >= ecashThreshold && turboEnabled) {
        // Turn OFF when amount exceeds threshold
        setTurboEnabled(false);
      } else if (amount > 0 && amount < ecashThreshold && !turboEnabled) {
        // Turn ON when amount drops below threshold
        setTurboEnabled(true);
      }
    }
  }, [sendAmount, sendAssetType, ecashThreshold, turboEnabled, setTurboEnabled]);

  // State for checking ecash balance
  const [isCheckingEcash, setIsCheckingEcash] = useState(false);

  // Local state for toggle-triggered insufficient sheet
  const [toggleInsufficientAmount, setToggleInsufficientAmount] = useState(0);
  const [toggleInsufficientBalance, setToggleInsufficientBalance] = useState(0);
  const [showToggleInsufficientSheet, setShowToggleInsufficientSheet] = useState(false);

  // Handle turbo toggle with ecash balance check
  const handleTurboToggle = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      // Turning OFF - just disable
      setTurboEnabled(false);
      return;
    }

    // Turning ON - check if amount exceeds threshold
    const amount = parseFloat(sendAmount) || 0;
    if (amount >= ecashThreshold) {
      // Can't enable turbo for amounts over threshold
      return;
    }

    // Check ecash balance
    setIsCheckingEcash(true);
    try {
      const { getBalance } = await import('../../services/cashu/cashuWalletService');
      const ecashBalance = await getBalance();
      // Safe conversion: multiply by 100 using integer math to avoid floating point errors
      const ecashBalanceSmallestUnits = Math.round(ecashBalance * 100);
      const amountInSmallestUnits = Math.round(amount * 100);

      if (ecashBalanceSmallestUnits >= amountInSmallestUnits) {
        // Has enough ecash - enable turbo
        setTurboEnabled(true);
      } else {
        // Not enough ecash - show warning sheet
        setToggleInsufficientAmount(amount);
        setToggleInsufficientBalance(ecashBalance);
        setShowToggleInsufficientSheet(true);
      }
    } catch (error) {
      // On error, just enable turbo (will check again on review)
      logger.warn('Failed to check ecash balance for turbo toggle', { error: (error as Error).message });
      setTurboEnabled(true);
    } finally {
      setIsCheckingEcash(false);
    }
  }, [sendAmount, ecashThreshold, setTurboEnabled]);

  // Handle user choosing to use turbo from toggle sheet (needs minting)
  const handleToggleUseTurbo = useCallback(() => {
    setShowToggleInsufficientSheet(false);
    setTurboEnabled(true);
  }, [setTurboEnabled]);

  // Handle user choosing to not use turbo from toggle sheet
  const handleToggleSendNormally = useCallback(() => {
    setShowToggleInsufficientSheet(false);
    setTurboEnabled(false);
  }, [setTurboEnabled]);

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

  // For BTC, also check if amount + fee exceeds balance
  const btcAmountPlusFee = sendAssetType === 'btc' ? enteredAmount + estimatedFeeBtc : 0;
  const btcExceedsWithFees = sendAssetType === 'btc' && sendAmount && btcAmountPlusFee > (segwitBalance || 0);

  const isReviewDisabled = !sendAmount || hasInsufficientBalance || hasInsufficientBtcForFees || btcExceedsWithFees || isRequestingMint;

  // Show turbo toggle for UNIT transactions
  const showTurboToggle = sendAssetType === 'unit';

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
        showTurboToggle={showTurboToggle}
        turboEnabled={turboEnabled}
        onTurboToggle={handleTurboToggle}
      />

      <View style={[styles.content, { paddingHorizontal: s(20), paddingBottom: keyboardHeight > 0 ? keyboardHeight + s(100) : s(120) }]}>
        {/* Main Amount Display - Strike style */}
        <View style={styles.amountSection}>
          <View style={[styles.amountInputRow]}>
            <TextInput
              ref={amountInputRef}
              style={[
                styles.amountInput,
                {
                  fontSize,
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
              inputAccessoryViewID="amountInputAccessory"
              testID="amount-input"
            />
            <Text style={[styles.assetSymbol, { fontSize: sf(24), marginLeft: s(8) }]}>{assetLabel}</Text>
          </View>

          {/* USD Value */}
          <Text style={[styles.usdValue, { fontSize: sf(18), marginTop: s(12) }]} testID="amount-usd-value">
            ${usdValue}
          </Text>

          {/* Available Balance - Tappable */}
          <Pressable
            onPress={handleMaxPress}
            disabled={isCalculatingMax}
            style={[
              styles.balanceButton,
              { marginTop: s(24), paddingVertical: s(8), paddingHorizontal: s(16), borderRadius: s(20) },
              (hasInsufficientBalance || hasInsufficientBtcForFees || btcExceedsWithFees) && styles.balanceButtonError
            ]}
            testID="amount-max-btn"
          >
            {isCalculatingMax ? (
              <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
            ) : (
              <Text style={[
                styles.balanceButtonText,
                { fontSize: sf(14) },
                (hasInsufficientBalance || hasInsufficientBtcForFees || btcExceedsWithFees) && styles.balanceButtonTextError
              ]}>
                {hasInsufficientBtcForFees
                  ? 'Insufficient BTC for fees'
                  : hasInsufficientBalance || btcExceedsWithFees
                  ? 'Insufficient balance'
                  : `${sendAssetType === 'btc' ? formatFiat(balance, 8) : formatFiat(balance)} ${assetLabel} available`}
              </Text>
            )}
          </Pressable>

          {/* Turbo Info Card */}
          {sendAssetType === 'unit' && turboEnabled && (
            <View style={[styles.turboInfoContainer, { borderRadius: s(12), padding: s(16), marginTop: s(16) }]}>
              <Text style={[styles.turboInfoTitle, { fontSize: sf(16), marginBottom: s(4) }]}>Turbo Transaction</Text>
              <Text style={[styles.turboInfoText, { fontSize: sf(13), lineHeight: s(18) }]}>
                Anonymous, instant, and private.{'\n'}
                The recipient has to claim the funds manually.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.buttonContainer, { bottom: keyboardHeight, paddingHorizontal: s(20), paddingVertical: s(16) }]}>
        <TouchableScale
          style={[
            styles.reviewButton,
            { borderRadius: s(14), paddingVertical: s(18) },
            isReviewDisabled && styles.reviewButtonDisabled
          ]}
          onPress={onReviewPress}
          disabled={isReviewDisabled}
          testID="amount-review-btn"
        >
          <Text style={[styles.reviewButtonText, { fontSize: sf(17) }]}>Review</Text>
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

      {/* Sheet for toggle-triggered insufficient ecash */}
      <InsufficientTurboSheet
        visible={showToggleInsufficientSheet}
        onClose={() => setShowToggleInsufficientSheet(false)}
        onUseTurbo={handleToggleUseTurbo}
        onSendNormally={handleToggleSendNormally}
        requiredAmount={toggleInsufficientAmount}
        currentBalance={toggleInsufficientBalance}
      />

      {/* Empty InputAccessoryView to hide keyboard Done button on iOS */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="amountInputAccessory">
          <View />
        </InputAccessoryView>
      )}
    </View>
  );
}
