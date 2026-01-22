/**
 * SendInputScreen - Combined address and amount input for sending BTC/UNIT
 * Features: address input, amount slider with fee selector footer
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Switch,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import QRScanner from '../../components/scanner/QRScanner';
import { validateBitcoinAddress } from '../../utils/bitcoin';
import { useSendFlowStore, type AssetType } from '../../stores/sendFlowStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { useWallet } from '../../contexts/WalletContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useFeeEstimate } from '../../hooks/useFeeEstimate';
import { TransactionType } from '../../services/feeEstimationService';
import { FeeRateDropdown } from '../../components/common/FeeRateSelectorCompact';
import { AmountSlider } from '../../components/vaultAction/AmountSlider';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import TouchableScale from '../../components/common/TouchableScale';
import { getRunesAmount } from '../../utils/runesHelper';
import { useTurboReview } from '../../hooks/useTurboReview';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import InsufficientTurboSheet from '../../components/send/InsufficientTurboSheet';
import { logger } from '../../utils/logger';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

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
  const { segwitBalance, runesBalance, utxos, unconfirmedSegwitBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { keyboardHeight } = useKeyboard();
  const { settingsHandlers } = useNavigationHandlers();
  const ecashThreshold = settingsHandlers?.ecashThreshold || 100;

  // Local state
  const addressInputRef = useRef<TextInput>(null);
  const [addressError, setAddressError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [previewAmount, setPreviewAmount] = useState(0);
  const prevMaxRef = useRef<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);

  const assetType = route.params?.assetType || sendAssetType;

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
  const assetSymbol = assetType === 'btc' ? 'BTC' : 'UNIT';
  const isBtc = assetType === 'btc';

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

  // Fee estimation
  const transactionType = isBtc ? TransactionType.BTC_SEND : TransactionType.UNIT_SEND;
  const { feeEstimateSats } = useFeeEstimate({
    type: transactionType,
    sourceAddress: wallet?.segwitAddress,
    feeRate: selectedFeeRate,
    enabled: true,
  });

  const estimatedFeeSats = Math.ceil(feeEstimateSats * 1.1); // 10% buffer

  // Balance calculations (include unconfirmed for transaction chaining)
  const btcBalance = (segwitBalance || 0) + (unconfirmedSegwitBalance || 0);
  const unitBalance = useMemo(() => getRunesAmount(runesBalance), [runesBalance]);

  // For BTC: max sendable = balance - fee
  const maxSendableBtc = useMemo(() => {
    const feeBtc = estimatedFeeSats / 100_000_000;
    return Math.max(0, btcBalance - feeBtc);
  }, [btcBalance, estimatedFeeSats]);

  // For UNIT: max sendable = unit balance (but need BTC for fees)
  const maxSendableUnit = unitBalance;
  const btcBalanceSats = Math.round(btcBalance * 100_000_000);
  const hasSufficientBtcForUnitFees = btcBalanceSats >= estimatedFeeSats;

  // Current amount as number
  const currentAmount = parseFloat(sendAmount) || 0;

  // Adjust amount when max changes based on fee rate (for BTC only)
  useEffect(() => {
    if (!isBtc) return;

    const prevMax = prevMaxRef.current;
    // Use larger tolerance for floating point comparison (1 satoshi = 0.00000001)
    const wasAtMax = prevMax > 0 && Math.abs(currentAmount - prevMax) < 0.000001;

    if (wasAtMax && maxSendableBtc > 0) {
      // User was at max - follow the new max (up or down)
      setSendAmount(maxSendableBtc.toString());
      setPreviewAmount(maxSendableBtc);
    } else if (currentAmount > maxSendableBtc && maxSendableBtc > 0) {
      // User exceeded new max - clamp down
      setSendAmount(maxSendableBtc.toString());
      setPreviewAmount(maxSendableBtc);
    }

    prevMaxRef.current = maxSendableBtc;
  }, [maxSendableBtc, currentAmount, isBtc, setSendAmount]);

  // Handle prefilled data
  useEffect(() => {
    const { prefillAddress, prefillAmount } = route.params || {};
    if (prefillAddress) {
      handleRecipientChange(prefillAddress);
    }
    if (prefillAmount) {
      setSendAmount(prefillAmount);
      setPreviewAmount(parseFloat(prefillAmount) || 0);
    }
  }, [route.params?.prefillAddress, route.params?.prefillAmount]);


  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      const firstLine = text.split(/[\r\n]/)[0].trim();
      handleRecipientChange(firstLine);
    }
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (data: string) => {
    setShowQRScanner(false);
    let address = data;
    if (data.toLowerCase().startsWith('bitcoin:')) {
      address = data.replace(/^bitcoin:/i, '').split('?')[0];
    }
    handleRecipientChange(address);
  };

  const handleRecipientChange = (text: string): void => {
    const cleanText = text.split(/[\r\n]/)[0].trim();
    setSendRecipient(cleanText);
    setAddressError('');
    setIsValidAddress(false);

    if (cleanText) {
      const validation = validateBitcoinAddress(cleanText);
      if (!validation.valid) {
        setAddressError(validation.error || 'Invalid address');
      } else if (assetType === 'unit') {
        const isTaproot = cleanText.startsWith('tb1p') || cleanText.startsWith('bc1p');
        if (!isTaproot) {
          setAddressError('UNIT requires Taproot (bc1p/tb1p)');
        } else {
          setSendAddressType('taproot');
          setIsValidAddress(true);
        }
      } else {
        const addressType = cleanText.startsWith('tb1p') || cleanText.startsWith('bc1p') ? 'taproot' : 'segwit';
        setSendAddressType(addressType);
        setIsValidAddress(true);
      }
    }
  };

  const handleAmountChange = useCallback((value: number) => {
    setSendAmount(value.toString());
    setPreviewAmount(value);
  }, [setSendAmount]);

  const handleLiveAmountChange = useCallback((value: number) => {
    Keyboard.dismiss();
    setPreviewAmount(value);
  }, []);

  // Validation (moved before handlers that depend on canContinue)
  const hasValidAddress = isValidAddress && !addressError && sendRecipient.length > 0;
  const hasValidAmount = currentAmount > 0;
  const exceedsBalance = isBtc
    ? currentAmount > maxSendableBtc
    : currentAmount > maxSendableUnit;
  const insufficientBtcForFees = !isBtc && !hasSufficientBtcForUnitFees;

  const canContinue = hasValidAddress && hasValidAmount && !exceedsBalance && !insufficientBtcForFees && !isRequestingMint;

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
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
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Address Input Section */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Recipient Address</Text>
              {addressError ? (
                <View style={styles.statusRow}>
                  <Ionicons name="close-circle" size={14} color={colors.semantic.error} />
                  <Text style={styles.statusTextError}>Invalid</Text>
                </View>
              ) : isValidAddress ? (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.semantic.success} />
                  <Text style={styles.statusTextSuccess}>Valid</Text>
                </View>
              ) : null}
            </View>

            {addressError && (
              <Text style={styles.errorText}>{addressError}</Text>
            )}

            <View style={styles.addressContainer}>
              <TextInput
                ref={addressInputRef}
                style={styles.addressInput}
                value={sendRecipient}
                onChangeText={handleRecipientChange}
                placeholder={assetType === 'unit' ? 'tb1p... or bc1p...' : 'tb1q... or tb1p...'}
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
              />
              <View style={styles.addressIcons}>
                <Pressable style={styles.addressIconBtn} onPress={handlePaste} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={20} color={colors.text.tertiary} />
                </Pressable>
                <Pressable style={styles.addressIconBtn} onPress={handleScanQR} hitSlop={8}>
                  <Ionicons name="qr-code-outline" size={20} color={colors.text.tertiary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Amount Slider with Fee Selector */}
          <View style={styles.section}>
            {isBtc ? (
              <AmountSlider
                value={currentAmount}
                maxValue={maxSendableBtc}
                onValueChange={handleAmountChange}
                onLiveValueChange={handleLiveAmountChange}
                label="Amount to Send"
                btcPrice={btcPrice ?? undefined}
                disabled={maxSendableBtc <= 0}
                renderFooter={() => (
                  <FeeRateDropdown
                    selectedRate={selectedFeeRate}
                    onRateChange={setSelectedFeeRate}
                    estimatedFeeSats={estimatedFeeSats}
                    transparent
                  />
                )}
              />
            ) : (
              <UnitAmountSlider
                value={currentAmount}
                maxValue={maxSendableUnit}
                onValueChange={handleAmountChange}
                onLiveValueChange={handleLiveAmountChange}
                label="Amount to Send"
                disabled={maxSendableUnit <= 0}
                renderFooter={() => (
                  <FeeRateDropdown
                    selectedRate={selectedFeeRate}
                    onRateChange={setSelectedFeeRate}
                    estimatedFeeSats={estimatedFeeSats}
                    transparent
                  />
                )}
              />
            )}
          </View>

          {/* Turbo Toggle for UNIT */}
          {!isBtc && (
            <View style={styles.turboSection}>
              <View style={styles.turboRow}>
                <View style={styles.turboLabelContainer}>
                  <Text style={styles.turboLabel}>⚡ Turbo UNIT</Text>
                  <Text style={styles.turboDescription}>Instant transaction</Text>
                </View>
                <Switch
                  value={turboEnabled}
                  onValueChange={setTurboEnabled}
                  trackColor={{ false: colors.bg.tertiary, true: colors.brand.primary }}
                  thumbColor={colors.text.white}
                />
              </View>
            </View>
          )}

          {/* Warning for insufficient BTC for UNIT fees */}
          {insufficientBtcForFees && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>
                You need BTC in your wallet to pay for transaction fees
              </Text>
            </View>
          )}

          {/* Warning for exceeding balance */}
          {exceedsBalance && currentAmount > 0 && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>
                Amount exceeds available balance
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(keyboardHeight, 16) }]}>
          <TouchableScale
            style={[styles.reviewBtn, !canContinue && styles.reviewBtnDisabled]}
            onPress={handleReview}
            disabled={!canContinue}
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
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold
  },
  section: { marginTop: spacing.md },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusTextError: {
    color: colors.semantic.error,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  statusTextSuccess: {
    color: colors.semantic.success,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginBottom: spacing.sm,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    fontFamily: fonts.regular,
    minHeight: 52,
    lineHeight: 22,
    paddingRight: spacing.sm,
  },
  addressIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressIconBtn: {
    padding: spacing.xs,
  },
  turboSection: {
    marginTop: spacing.lg,
  },
  turboRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  turboLabelContainer: {
    flex: 1,
  },
  turboLabel: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  turboDescription: {
    color: colors.text.tertiary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  warning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm
  },
  warningText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium
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
    alignItems: 'center'
  },
  reviewBtnDisabled: {
    backgroundColor: colors.bg.tertiary
  },
  reviewBtnText: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold
  },
  reviewBtnTextDisabled: {
    color: colors.text.tertiary
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
