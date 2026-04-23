/**
 * VaultAmountsScreen - Enter BTC deposit and face-value USD borrow amounts
 * Features: Sliders for input, VaultActionGauge for health display
 */

import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import React,{ useCallback,useEffect,useMemo,useState } from 'react';
import {
KeyboardAvoidingView,
Platform,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeeRateDropdown } from '../../components/common/FeeRateSelectorCompact';
import TouchableScale from '../../components/common/TouchableScale';
import { AmountSlider,VaultActionGauge } from '../../components/vaultAction';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { BITCOIN_TX } from '../../utils/constants';
import { logger } from '../../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getOpCostOpen,
  getOpCostRepay,
} from '../../utils/vaultUtils';

// Health-based slider colors (matching VaultActionGauge)
const getHealthSliderColor = (health: number): string => {
  if (health <= 160) return '#d04c68'; // red
  if (health <= 200) return '#fde37b'; // yellow
  return '#59aa8a'; // green
};

const VAULT_SETTLEMENT_FEE_BUFFER_SATS = 5_000;
const ESTIMATED_VAULT_SETTLEMENT_FEE_VBYTES = 250;

interface VaultAmountsScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultAmountsScreen({ navigation }: VaultAmountsScreenProps) {
  const {
    btcAmount,
    borrowAmountUsd,
    selectedFeeRate,
    setSelectedFeeRate,
    healthFactor,
    setBtcAmount,
    setBorrowAmountUsd,
    setBitcoinPrice,
    setCurrentStep,
    error,
    reset,
  } = useVaultCreation();

  // Handle close - reset state and dismiss modal
  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  const { segwitBalance, utxos, loadingBalance } = useBalance();
  const { btcPrice } = usePrice();
  logger.debug('[VaultAmounts] segwitBalance:', { segwitBalance, loadingBalance, utxoCount: utxos?.length, btcPrice });

  // Calculate estimated fee based on selected rate and UTXOs
  const estimatedFeeSats = useMemo(() => {
    return getOpCostOpen(selectedFeeRate, utxos);
  }, [selectedFeeRate, utxos]);

  // Local preview states for real-time updates during drag
  const [previewBtcAmount, setPreviewBtcAmount] = useState(btcAmount);
  const [previewBorrowAmountUsd, setPreviewBorrowAmountUsd] = useState(borrowAmountUsd);

  // Update bitcoin price in store when it changes
  useEffect(() => {
    if (btcPrice) {
      setBitcoinPrice(btcPrice);
    }
  }, [btcPrice, setBitcoinPrice]);

  // Sync preview amounts when store values change
  useEffect(() => {
    setPreviewBtcAmount(btcAmount);
  }, [btcAmount]);

  useEffect(() => {
    setPreviewBorrowAmountUsd(borrowAmountUsd);
  }, [borrowAmountUsd]);

  // Calculate available BTC (balance minus fees)
  const availableBtc = useMemo(() => {
    if (!segwitBalance) return 0;
    const openFeeCostSats = estimatedFeeSats;
    const bridgeSettlementReserveSats =
      BITCOIN_TX.RUNE_OUTPUT_AMOUNT +
      selectedFeeRate * ESTIMATED_VAULT_SETTLEMENT_FEE_VBYTES +
      VAULT_SETTLEMENT_FEE_BUFFER_SATS;
    const futureRepayReserveSats = getOpCostRepay(selectedFeeRate, utxos);
    const totalReservedBtc =
      (openFeeCostSats + bridgeSettlementReserveSats + futureRepayReserveSats) / 100_000_000;

    // Leave enough spendable BTC for the hidden bridge send and a later repay.
    return Math.max(segwitBalance - totalReservedBtc, 0);
  }, [estimatedFeeSats, segwitBalance, selectedFeeRate, utxos]);

  // Calculate max borrowable for preview BTC amount (at 160% minimum health)
  const previewMaxBorrowable = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0) return 0;
    // Max borrow = (collateral * price) / 1.6 (160% health factor)
    // Subtract 1 to ensure health rounds to >= 160% after Math.floor in computeHealthFactor
    return Math.max(Math.floor((previewBtcAmount * btcPrice) / 1.6) - 1, 0);
  }, [previewBtcAmount, btcPrice]);

  // Preview health calculation
  const previewHealth = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0 || previewBorrowAmountUsd <= 0) return 0;
    return computeHealthFactor(previewBtcAmount, btcPrice, previewBorrowAmountUsd);
  }, [previewBtcAmount, previewBorrowAmountUsd, btcPrice]);

  // Check if health would be below minimum
  const healthBelowMin = previewHealth > 0 && previewHealth < 160;

  // Preview liquidation price calculation
  const previewLiquidationPrice = useMemo(() => {
    if (previewBtcAmount <= 0) return 0;
    return computeLiquidationPrice(previewBorrowAmountUsd, previewBtcAmount);
  }, [previewBtcAmount, previewBorrowAmountUsd]);

  // Live update handlers - always reset the borrow face value when BTC changes
  const handleBtcLiveChange = useCallback((val: number) => {
    setPreviewBtcAmount(val);
    setPreviewBorrowAmountUsd(0);
    setBorrowAmountUsd(0);
  }, [setBorrowAmountUsd]);

  const handleUnitLiveChange = useCallback((val: number) => {
    setPreviewBorrowAmountUsd(val);
  }, []);

  // Validation
  const canContinue = useMemo(() => {
    if (btcAmount <= 0 || borrowAmountUsd <= 0) return false;
    if (btcAmount > availableBtc) return false;
    if (healthFactor < 160) return false;
    return true;
  }, [btcAmount, borrowAmountUsd, availableBtc, healthFactor]);

  // Handle continue
  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('VaultConfirm');
  }, [canContinue, setCurrentStep, navigation]);

  const hasChanges = previewBtcAmount > 0 && previewBorrowAmountUsd > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="vault-amounts-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Vault</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gauge */}
          <VaultActionGauge
            currentHealth={0}
            newHealth={hasChanges ? previewHealth : undefined}
            showTransition={hasChanges}
            hasNoDebt={previewBorrowAmountUsd <= 0}
          />

          {/* Liquidation Price */}
          <View style={styles.liquidationPrice}>
            <Text style={styles.liquidationLabel}>Liquidation Price</Text>
            <Text style={styles.liquidationValue}>
              {previewLiquidationPrice > 0 && previewLiquidationPrice !== Infinity
                ? `$${previewLiquidationPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'None'}
            </Text>
          </View>

          {/* Connected Sliders - Deposit + Borrow as one unit */}
          <View style={styles.section}>
            <AmountSlider
              value={btcAmount}
              maxValue={availableBtc}
              onValueChange={setBtcAmount}
              onLiveValueChange={handleBtcLiveChange}
              label="BTC to Deposit"
              testIDPrefix="vault-create-btc"
              btcPrice={btcPrice ?? undefined}
              disabled={availableBtc <= 0}
              attachedBottom
            />
            <View style={previewBtcAmount <= 0 ? styles.disabledSection : undefined}>
              <UnitAmountSlider
                value={borrowAmountUsd}
                maxValue={previewMaxBorrowable}
                onValueChange={setBorrowAmountUsd}
                onLiveValueChange={handleUnitLiveChange}
                label="USD to Borrow"
                unitLabel="USD"
                testIDPrefix="vault-create-borrow-usd"
                disabled={previewMaxBorrowable <= 0}
                sliderColor={getHealthSliderColor(hasChanges ? previewHealth : 0)}
                attachedTop
                renderFooter={() => (
                  <FeeRateDropdown
                    selectedRate={selectedFeeRate}
                    onRateChange={setSelectedFeeRate}
                    estimatedFeeSats={estimatedFeeSats}
                    transparent
                  />
                )}
              />
            </View>
          </View>

          {/* Warning for min health violation */}
          {healthBelowMin && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>
                Health factor must be at least 160%. Reduce borrow amount or increase collateral.
              </Text>
            </View>
          )}

          {/* Error message */}
          {error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableScale
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            testID="vault-create-continue-btn"
          >
            <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
              Continue
            </Text>
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  liquidationPrice: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  liquidationLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  liquidationValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  section: { marginTop: spacing.md },
  disabledSection: { opacity: 0.4 },
  warning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
  error: {
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  continueBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: colors.bg.tertiary },
  continueBtnText: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  continueBtnTextDisabled: { color: colors.text.tertiary },
});
