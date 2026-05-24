/**
 * SendInputScreen - Combined address and amount input for sending BTC/UNIT
 * Features: address input, amount slider with fee selector footer
 */

import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableScale from '../../components/common/TouchableScale';
import QRScanner from '../../components/scanner/QRScanner';
import InsufficientTurboSheet from '../../components/send/InsufficientTurboSheet';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import { useFeeEstimate } from '../../hooks/useFeeEstimate';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useTurboReview } from '../../hooks/useTurboReview';
import { TransactionType } from '../../services/feeEstimationService';
import { usePrice } from '../../stores/priceStore';
import { useSendFlowStore, type AssetType } from '../../stores/sendFlowStore';
import { analytics } from '../../services/analyticsService';
import { TRANSACTION_EVENTS } from '../../constants/analyticsEvents';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';

// Local hooks and components
import { AddressInputSection, AmountSection, SendWarnings, TurboToggle } from './components';
import { useAddressInput, useSendBalances, useSendValidation } from './hooks';

interface SendInputRouteParams {
  assetType?: AssetType;
  prefillAddress?: string;
  prefillAmount?: string;
  showInsufficientSheet?: boolean;
  insufficientAmount?: number;
  insufficientBalance?: number;
  cashuUnit?: 'unit' | 'sat';
}

interface SendInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: SendInputRouteParams }, 'params'>;
}

const formatSatsAsBtcInput = (sats: number): string =>
  (sats / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');

const formatBtcInputAmount = (btcAmount: number): string =>
  Number.isFinite(btcAmount) ? btcAmount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : '';

export default function SendInputScreen({
  navigation,
  route,
}: SendInputScreenProps): React.JSX.Element {
  // Store selectors
  const sendAssetType = useSendFlowStore((state) => state.sendAssetType);
  const sendRecipient = useSendFlowStore((state) => state.sendRecipient);
  const sendAmount = useSendFlowStore((state) => state.sendAmount);
  const sendAddressType = useSendFlowStore((state) => state.sendAddressType);
  const selectedFeeRate = useSendFlowStore((state) => state.selectedFeeRate);
  const turboEnabled = useSendFlowStore((state) => state.turboEnabled);
  const btcTurboEnabled = useSendFlowStore((state) => state.btcTurboEnabled);

  // Store actions
  const setSendRecipient = useSendFlowStore((state) => state.setSendRecipient);
  const setSendAddressType = useSendFlowStore((state) => state.setSendAddressType);
  const setSendAssetType = useSendFlowStore((state) => state.setSendAssetType);
  const setSendAmount = useSendFlowStore((state) => state.setSendAmount);
  const setSelectedFeeRate = useSendFlowStore((state) => state.setSelectedFeeRate);
  const setTurboEnabled = useSendFlowStore((state) => state.setTurboEnabled);
  const setBtcTurboEnabled = useSendFlowStore((state) => state.setBtcTurboEnabled);
  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);

  // Hooks
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { keyboardHeight } = useKeyboard();
  const { settingsHandlers } = useSettingsHandlers();
  const ecashThreshold = settingsHandlers?.ecashThreshold || 10000;

  // Local state
  const prevMaxRef = useRef<number>(0);
  const reviewUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRequestingBtcTurbo, setIsRequestingBtcTurbo] = useState(false);
  const [showInsufficientBtcTurboSheet, setShowInsufficientBtcTurboSheet] = useState(false);
  const [insufficientBtcTurboAmount, setInsufficientBtcTurboAmount] = useState(0);
  const [insufficientBtcTurboBalance, setInsufficientBtcTurboBalance] = useState(0);

  const assetType = route.params?.assetType || sendAssetType;
  const prefillAddress = route.params?.prefillAddress;
  const prefillAmount = route.params?.prefillAmount;
  const assetSymbol = assetType === 'btc' ? 'BTC' : 'UNIT';
  const isBtc = assetType === 'btc';
  const isTurboBtc = isBtc && btcTurboEnabled;

  // Fee estimation
  const transactionType = isBtc ? TransactionType.BTC_SEND : TransactionType.UNIT_SEND;
  const { feeEstimateSats } = useFeeEstimate({
    type: transactionType,
    sourceAddress: wallet?.segwitAddress,
    feeRate: selectedFeeRate,
    enabled: true,
  });
  const estimatedFeeSats = Math.ceil(feeEstimateSats * 1.1); // 10% buffer

  // Balance calculations
  const { maxSendableBtc, maxSendableTurboBtc, maxSendableUnit, hasSufficientBtcForUnitFees } =
    useSendBalances({ estimatedFeeSats });

  // Address input handling
  const {
    addressError,
    isValidAddress,
    showQRScanner,
    setShowQRScanner,
    handleRecipientChange,
    handlePaste,
    handleScanQR,
    handleQRScanned,
  } = useAddressInput({
    assetType,
    onRecipientChange: setSendRecipient,
    onAddressTypeChange: setSendAddressType,
  });

  // Current amount as number
  const currentAmount = parseFloat(sendAmount) || 0;
  const activeMaxSendableBtc = isTurboBtc ? maxSendableTurboBtc + maxSendableBtc : maxSendableBtc;
  const btcMaxButtonValue =
    isTurboBtc && maxSendableTurboBtc > 0 ? maxSendableTurboBtc : activeMaxSendableBtc;

  // Turbo review hook for UNIT transactions
  const {
    isRequestingMint,
    showInsufficientTurboSheet,
    setShowInsufficientTurboSheet,
    setInsufficientTurboAmount,
    setInsufficientTurboBalance,
    insufficientTurboAmount,
    insufficientTurboBalance,
    handleReview: handleTurboReview,
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
    isCashuMint: false,
    cashuQuoteId: null,
    senderTaprootAddress: wallet?.taprootAddress,
  });

  // Validation
  const { exceedsBalance, insufficientBtcForFees, canContinue } = useSendValidation({
    isValidAddress,
    addressError,
    sendRecipient,
    currentAmount,
    isBtc,
    maxSendableBtc: activeMaxSendableBtc,
    maxSendableUnit,
    hasSufficientBtcForUnitFees,
    isRequestingMint: isRequestingMint || isRequestingBtcTurbo,
  });

  const turboBtcNeedsTaproot =
    isTurboBtc && sendRecipient.length > 0 && sendAddressType !== 'taproot';
  const canContinueWithTurboBtc = canContinue && !turboBtcNeedsTaproot;

  // Track send flow started on mount
  useEffect(() => {
    analytics.track(TRANSACTION_EVENTS.SEND_STARTED, { asset_type: sendAssetType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set asset type from route params
  useEffect(() => {
    if (route.params?.assetType && route.params.assetType !== sendAssetType) {
      setSendAssetType(route.params.assetType);
    }
  }, [route.params?.assetType, sendAssetType, setSendAssetType]);

  // Mark initialization complete after first render to prevent layout flash
  useEffect(() => {
    if (isInitializing) {
      const timer = setTimeout(() => setIsInitializing(false), 50);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  useEffect(
    () => () => {
      if (reviewUnlockTimerRef.current) {
        clearTimeout(reviewUnlockTimerRef.current);
        reviewUnlockTimerRef.current = null;
      }
    },
    []
  );

  // Adjust amount when max changes based on fee rate (for BTC only)
  useEffect(() => {
    if (!isBtc) return;

    const prevMax = prevMaxRef.current;
    // Use larger tolerance for floating point comparison (1 satoshi = 0.00000001)
    const wasAtMax = prevMax > 0 && Math.abs(currentAmount - prevMax) < 0.000001;

    if (wasAtMax && activeMaxSendableBtc > 0) {
      // User was at max - follow the new max (up or down)
      setSendAmount(formatBtcInputAmount(activeMaxSendableBtc));
    } else if (currentAmount > activeMaxSendableBtc && activeMaxSendableBtc > 0) {
      // User exceeded new max - clamp down
      setSendAmount(formatBtcInputAmount(activeMaxSendableBtc));
    }

    prevMaxRef.current = activeMaxSendableBtc;
  }, [activeMaxSendableBtc, currentAmount, isBtc, setSendAmount]);

  // Handle prefilled data
  useEffect(() => {
    if (prefillAddress) {
      handleRecipientChange(prefillAddress);
    }
    if (prefillAmount) {
      setSendAmount(prefillAmount);
    }
  }, [prefillAddress, prefillAmount, handleRecipientChange, setSendAmount]);

  const handleAmountChange = useCallback(
    (value: number) => {
      setSendAmount(isBtc ? formatBtcInputAmount(value) : value.toString());
    },
    [isBtc, setSendAmount]
  );

  const handleLiveAmountChange = useCallback((_value: number) => {
    Keyboard.dismiss();
  }, []);

  const handleClose = useCallback(() => {
    resetSendFlow();
    navigation.goBack();
  }, [navigation, resetSendFlow]);

  const prepareBtcTurboTopUp = useCallback(
    async (
      requestedAmountBtc: number,
      currentTurboBalanceBtc: number,
      originalRecipient: string
    ): Promise<void> => {
      setIsRequestingBtcTurbo(true);
      const amountSats = Math.round(requestedAmountBtc * 100_000_000);
      const currentTurboBalanceSats = Math.max(0, Math.round(currentTurboBalanceBtc * 100_000_000));
      const shortfallSats = amountSats - currentTurboBalanceSats;

      if (!wallet?.taprootAddress) {
        throw new Error('Wallet Taproot address unavailable for Turbo BTC recovery');
      }

      if (shortfallSats <= 0) {
        Alert.alert(
          'Review Turbo BTC send',
          `Send ${requestedAmountBtc} BTC to this Taproot address?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create token',
              onPress: () => navigation.navigate('TurboProcessing', {
                cashuUnit: 'sat',
                senderTaprootAddress: wallet.taprootAddress,
              }),
            },
          ]
        );
        return;
      }

      const { requestMint } = await import('../../services/cashu/cashuWalletService');
      const { savePendingTurboSend } = await import('../../services/cashu/cashuTurboRecovery');
      const mintQuote = await requestMint(shortfallSats, 'sat');
      const mintAmountSats = mintQuote.amount ?? shortfallSats;

      await savePendingTurboSend(
        mintQuote.quoteId,
        originalRecipient,
        amountSats,
        wallet.taprootAddress,
        'sat',
        mintAmountSats
      );

      const mintAmountBtc = formatSatsAsBtcInput(mintAmountSats);
      setSendAmount(mintAmountBtc);
      setSendRecipient(mintQuote.depositAddress);
      navigation.navigate('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
        isTurbo: true,
        cashuUnit: 'sat',
        mintQuoteId: mintQuote.quoteId,
        mintAmount: amountSats,
        mintClaimAmount: mintAmountSats,
        turboRecipient: originalRecipient,
        senderTaprootAddress: wallet.taprootAddress,
        assetType: 'btc',
        amount: mintAmountBtc,
        recipient: mintQuote.depositAddress,
      });
    },
    [navigation, setSendAmount, setSendRecipient, wallet?.taprootAddress]
  );

  const handleUseBtcTurbo = useCallback(async () => {
    setShowInsufficientBtcTurboSheet(false);
    try {
      await prepareBtcTurboTopUp(
        insufficientBtcTurboAmount,
        insufficientBtcTurboBalance,
        sendRecipient
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to prepare Turbo BTC transaction');
    } finally {
      setIsRequestingBtcTurbo(false);
    }
  }, [
    insufficientBtcTurboAmount,
    insufficientBtcTurboBalance,
    prepareBtcTurboTopUp,
    sendRecipient,
  ]);

  const handleSendBtcNormally = useCallback(() => {
    setShowInsufficientBtcTurboSheet(false);
    setBtcTurboEnabled(false);
    navigation.navigate('Processing', {
      fromScreen: 'SendInput',
      action: 'create_intent',
    });
  }, [navigation, setBtcTurboEnabled]);

  const handleReview = useCallback(async () => {
    const allowedToContinue = isTurboBtc ? canContinueWithTurboBtc : canContinue;
    if (!allowedToContinue || isReviewing || isRequestingMint || isRequestingBtcTurbo) return;
    setIsReviewing(true);
    if (reviewUnlockTimerRef.current) {
      clearTimeout(reviewUnlockTimerRef.current);
    }
    try {
      // For BTC, go to Processing to create intent.
      // For UNIT, use turbo review hook which handles turbo vs normal flow.
      if (isTurboBtc) {
        const amountSats = Math.round(currentAmount * 100_000_000);
        const { getBalance } = await import('../../services/cashu/cashuBalanceService');
        const turboBtcBalanceSats = await getBalance(true, 'sat');

        if (turboBtcBalanceSats >= amountSats) {
          if (!wallet?.taprootAddress) {
            throw new Error('Wallet Taproot address unavailable for Turbo BTC recovery');
          }
          Alert.alert(
            'Review Turbo BTC send',
            `Send ${currentAmount} BTC to this Taproot address?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Create token',
                onPress: () => navigation.navigate('TurboProcessing', {
                  cashuUnit: 'sat',
                  senderTaprootAddress: wallet.taprootAddress,
                }),
              },
            ]
          );
          return;
        }

        setInsufficientBtcTurboAmount(currentAmount);
        setInsufficientBtcTurboBalance(turboBtcBalanceSats / 100_000_000);
        setShowInsufficientBtcTurboSheet(true);
      } else if (isBtc) {
        navigation.navigate('Processing', {
          fromScreen: 'SendInput',
          action: 'create_intent',
        });
      } else {
        await handleTurboReview();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errorMessage || 'Failed to prepare transaction');
    } finally {
      setIsRequestingBtcTurbo(false);
      reviewUnlockTimerRef.current = setTimeout(() => {
        reviewUnlockTimerRef.current = null;
        setIsReviewing(false);
      }, 900);
      (reviewUnlockTimerRef.current as { unref?: () => void }).unref?.();
    }
  }, [
    canContinue,
    canContinueWithTurboBtc,
    isReviewing,
    isRequestingMint,
    isRequestingBtcTurbo,
    isTurboBtc,
    isBtc,
    currentAmount,
    navigation,
    handleTurboReview,
    wallet?.taprootAddress,
  ]);

  useEffect(() => {
    if (!route.params?.showInsufficientSheet) {
      return;
    }

    if (route.params.cashuUnit === 'sat') {
      setInsufficientBtcTurboAmount(route.params.insufficientAmount ?? currentAmount);
      setInsufficientBtcTurboBalance(route.params.insufficientBalance ?? 0);
      setShowInsufficientBtcTurboSheet(true);
    } else {
      setInsufficientTurboAmount(route.params.insufficientAmount ?? currentAmount);
      setInsufficientTurboBalance(route.params.insufficientBalance ?? 0);
      setShowInsufficientTurboSheet(true);
    }
  }, [
    route.params?.showInsufficientSheet,
    route.params?.cashuUnit,
    route.params?.insufficientAmount,
    route.params?.insufficientBalance,
    currentAmount,
    setInsufficientTurboAmount,
    setInsufficientTurboBalance,
    setShowInsufficientTurboSheet,
  ]);

  // Show loading state during initialization to prevent layout flash
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const reviewDisabled =
    !(isTurboBtc ? canContinueWithTurboBtc : canContinue) ||
    isReviewing ||
    isRequestingMint ||
    isRequestingBtcTurbo;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="send-input-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        testID="send-input-content"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Send {assetSymbol}</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Address Input Section */}
          <AddressInputSection
            value={sendRecipient}
            assetType={assetType}
            addressError={addressError}
            isValidAddress={isValidAddress}
            onChangeText={handleRecipientChange}
            onPaste={handlePaste}
            onScanQR={handleScanQR}
          />

          {/* Amount Slider with Fee Selector */}
          <AmountSection
            isBtc={isBtc}
            value={currentAmount}
            maxValue={isBtc ? activeMaxSendableBtc : maxSendableUnit}
            maxButtonValue={isBtc ? btcMaxButtonValue : undefined}
            onValueChange={handleAmountChange}
            onLiveValueChange={handleLiveAmountChange}
            btcPrice={btcPrice ?? undefined}
            selectedFeeRate={selectedFeeRate}
            onFeeRateChange={setSelectedFeeRate}
            estimatedFeeSats={estimatedFeeSats}
          />

          {/* Turbo Toggle */}
          {isBtc ? (
            <TurboToggle
              enabled={btcTurboEnabled}
              onToggle={setBtcTurboEnabled}
              label="Turbo BTC"
              description="App-to-app Cashu BTC"
            />
          ) : (
            <TurboToggle enabled={turboEnabled} onToggle={setTurboEnabled} />
          )}

          {turboBtcNeedsTaproot && (
            <View style={styles.warningCard}>
              <Ionicons name="warning-outline" size={16} color={colors.semantic.warning} />
              <Text style={styles.warningText}>
                Turbo BTC requires a Taproot recipient address.
              </Text>
            </View>
          )}

          {/* Warnings */}
          <SendWarnings
            insufficientBtcForFees={insufficientBtcForFees}
            exceedsBalance={exceedsBalance}
            currentAmount={currentAmount}
          />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(keyboardHeight, 16) }]}>
          <TouchableScale
            style={[styles.reviewBtn, reviewDisabled && styles.reviewBtnDisabled]}
            onPress={handleReview}
            disabled={reviewDisabled}
            testID="send-review-btn"
            accessibilityLabel={
              reviewDisabled && isReviewing ? 'Preparing transaction review' : 'Review transaction'
            }
            accessibilityState={{
              disabled: reviewDisabled,
              busy: isReviewing || isRequestingMint || isRequestingBtcTurbo,
            }}
            lockWhilePending
            pressLockMs={700}
          >
            {isReviewing || isRequestingMint || isRequestingBtcTurbo ? (
              <View style={styles.busyButtonContent}>
                <ActivityIndicator size="small" color={colors.text.white} />
                <Text style={styles.reviewBtnText}>Preparing...</Text>
              </View>
            ) : (
              <Text style={[styles.reviewBtnText, !canContinue && styles.reviewBtnTextDisabled]}>
                Review
              </Text>
            )}
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
      />

      {/* Loading overlay for turbo minting */}
      {(isRequestingMint || isRequestingBtcTurbo) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Preparing Turbo transaction...</Text>
          </View>
        </View>
      )}

      {/* Insufficient turbo balance sheet */}
      <InsufficientTurboSheet
        visible={showInsufficientTurboSheet}
        onClose={() => setShowInsufficientTurboSheet(false)}
        onUseTurbo={handleUseTurbo}
        onSendNormally={handleSendNormally}
        requiredAmount={insufficientTurboAmount}
        currentBalance={insufficientTurboBalance}
      />

      <InsufficientTurboSheet
        visible={showInsufficientBtcTurboSheet}
        onClose={() => setShowInsufficientBtcTurboSheet(false)}
        onUseTurbo={handleUseBtcTurbo}
        onSendNormally={handleSendBtcNormally}
        requiredAmount={insufficientBtcTurboAmount}
        currentBalance={insufficientBtcTurboBalance}
        cashuUnit="sat"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.primary,
  },
  reviewBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reviewBtnDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
  reviewBtnText: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  reviewBtnTextDisabled: {
    color: colors.text.tertiary,
  },
  busyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingContent: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    marginTop: spacing.md,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.semantic.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
});
