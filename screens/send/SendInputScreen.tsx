/**
 * SendInputScreen - Combined address and amount input for sending BTC/UNIT
 * Features: address input, amount slider with fee selector footer
 */

import { Ionicons } from '@expo/vector-icons';
import { NavigationProp,RouteProp } from '@react-navigation/native';
import React,{ useCallback,useEffect,useRef,useState } from 'react';
import {
ActivityIndicator,
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
import { useSendFlowStore,type AssetType } from '../../stores/sendFlowStore';
import { analytics } from '../../services/analyticsService';
import { TRANSACTION_EVENTS } from '../../constants/analyticsEvents';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';

// Local hooks and components
import {
AddressInputSection,
AmountSection,
SendWarnings,
TurboToggle,
} from './components';
import { useAddressInput,useSendBalances,useSendValidation } from './hooks';

interface SendInputRouteParams {
  assetType?: AssetType;
  prefillAddress?: string;
  prefillAmount?: string;
}

interface SendInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: SendInputRouteParams }, 'params'>;
}

export default function SendInputScreen({ navigation, route }: SendInputScreenProps): React.JSX.Element {
  // Store selectors
  const sendAssetType = useSendFlowStore((state) => state.sendAssetType);
  const sendRecipient = useSendFlowStore((state) => state.sendRecipient);
  const sendAmount = useSendFlowStore((state) => state.sendAmount);
  const selectedFeeRate = useSendFlowStore((state) => state.selectedFeeRate);
  const turboEnabled = useSendFlowStore((state) => state.turboEnabled);

  // Store actions
  const setSendRecipient = useSendFlowStore((state) => state.setSendRecipient);
  const setSendAddressType = useSendFlowStore((state) => state.setSendAddressType);
  const setSendAssetType = useSendFlowStore((state) => state.setSendAssetType);
  const setSendAmount = useSendFlowStore((state) => state.setSendAmount);
  const setSelectedFeeRate = useSendFlowStore((state) => state.setSelectedFeeRate);
  const setTurboEnabled = useSendFlowStore((state) => state.setTurboEnabled);

  // Hooks
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { keyboardHeight } = useKeyboard();
  const { settingsHandlers } = useSettingsHandlers();
  const ecashThreshold = settingsHandlers?.ecashThreshold || 10000;

  // Local state
  const prevMaxRef = useRef<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);

  const assetType = route.params?.assetType || sendAssetType;
  const prefillAddress = route.params?.prefillAddress;
  const prefillAmount = route.params?.prefillAmount;
  const assetSymbol = assetType === 'btc' ? 'BTC' : 'UNIT';
  const isBtc = assetType === 'btc';

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
  const {
    maxSendableBtc,
    maxSendableUnit,
    hasSufficientBtcForUnitFees,
  } = useSendBalances({ estimatedFeeSats });

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

  // Turbo review hook for UNIT transactions
  const {
    isRequestingMint,
    showInsufficientTurboSheet,
    setShowInsufficientTurboSheet,
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
  });

  // Validation
  const {
    exceedsBalance,
    insufficientBtcForFees,
    canContinue,
  } = useSendValidation({
    isValidAddress,
    addressError,
    sendRecipient,
    currentAmount,
    isBtc,
    maxSendableBtc,
    maxSendableUnit,
    hasSufficientBtcForUnitFees,
    isRequestingMint,
  });

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

  // Adjust amount when max changes based on fee rate (for BTC only)
  useEffect(() => {
    if (!isBtc) return;

    const prevMax = prevMaxRef.current;
    // Use larger tolerance for floating point comparison (1 satoshi = 0.00000001)
    const wasAtMax = prevMax > 0 && Math.abs(currentAmount - prevMax) < 0.000001;

    if (wasAtMax && maxSendableBtc > 0) {
      // User was at max - follow the new max (up or down)
      setSendAmount(maxSendableBtc.toString());
    } else if (currentAmount > maxSendableBtc && maxSendableBtc > 0) {
      // User exceeded new max - clamp down
      setSendAmount(maxSendableBtc.toString());
    }

    prevMaxRef.current = maxSendableBtc;
  }, [maxSendableBtc, currentAmount, isBtc, setSendAmount]);

  // Handle prefilled data
  useEffect(() => {
    if (prefillAddress) {
      handleRecipientChange(prefillAddress);
    }
    if (prefillAmount) {
      setSendAmount(prefillAmount);
    }
  }, [prefillAddress, prefillAmount, handleRecipientChange, setSendAmount]);

  const handleAmountChange = useCallback((value: number) => {
    setSendAmount(value.toString());
  }, [setSendAmount]);

  const handleLiveAmountChange = useCallback((_value: number) => {
    Keyboard.dismiss();
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleReview = useCallback(() => {
    if (!canContinue) return;
    // For BTC, go to Processing to create intent
    // For UNIT, use turbo review hook which handles turbo vs normal flow
    if (isBtc) {
      navigation.navigate('Processing', {
        fromScreen: 'SendInput',
        action: 'create_intent',
      });
    } else {
      handleTurboReview();
    }
  }, [canContinue, isBtc, navigation, handleTurboReview]);

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
            maxValue={isBtc ? maxSendableBtc : maxSendableUnit}
            onValueChange={handleAmountChange}
            onLiveValueChange={handleLiveAmountChange}
            btcPrice={btcPrice ?? undefined}
            selectedFeeRate={selectedFeeRate}
            onFeeRateChange={setSelectedFeeRate}
            estimatedFeeSats={estimatedFeeSats}
          />

          {/* Turbo Toggle for UNIT */}
          {!isBtc && (
            <TurboToggle
              enabled={turboEnabled}
              onToggle={setTurboEnabled}
            />
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
            style={[styles.reviewBtn, !canContinue && styles.reviewBtnDisabled]}
            onPress={handleReview}
            disabled={!canContinue}
            testID="send-review-btn"
            accessibilityLabel="Review transaction"
          >
            <Text style={[styles.reviewBtnText, !canContinue && styles.reviewBtnTextDisabled]}>
              Review
            </Text>
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
      {isRequestingMint && (
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
});
