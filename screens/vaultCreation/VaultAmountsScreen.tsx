/**
 * VaultAmountsScreen - Enter BTC deposit and UNIT borrow amounts
 * Features: Sliders for input, VaultActionGauge for health display
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { VaultActionGauge, AmountSlider } from '../../components/vaultAction';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { getOpCostOpen, computeHealthFactor, computeLiquidationPrice } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface VaultAmountsScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultAmountsScreen({ navigation }: VaultAmountsScreenProps) {
  const {
    btcAmount,
    unitAmount,
    selectedFeeRate,
    healthFactor,
    liquidationPrice,
    maxBorrowable,
    setBtcAmount,
    setUnitAmount,
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

  const { segwitBalance } = useBalance();
  const { btcPrice } = usePrice();

  // Local preview states for real-time updates during drag
  const [previewBtcAmount, setPreviewBtcAmount] = useState(btcAmount);
  const [previewUnitAmount, setPreviewUnitAmount] = useState(unitAmount);

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
    setPreviewUnitAmount(unitAmount);
  }, [unitAmount]);

  // Calculate available BTC (balance minus fees)
  const availableBtc = useMemo(() => {
    if (!segwitBalance) return 0;
    const feeCost = getOpCostOpen(selectedFeeRate) / 100_000_000;
    return Math.max(segwitBalance - feeCost - 0.00001, 0); // Leave small buffer
  }, [segwitBalance, selectedFeeRate]);

  // Calculate max borrowable for preview BTC amount (at 160% minimum health)
  const previewMaxBorrowable = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0) return 0;
    // Max borrow = (collateral * price) / 1.6 (160% health factor)
    return Math.floor((previewBtcAmount * btcPrice) / 1.6);
  }, [previewBtcAmount, btcPrice]);

  // Preview health calculation
  const previewHealth = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0 || previewUnitAmount <= 0) return 0;
    return computeHealthFactor(previewBtcAmount, btcPrice, previewUnitAmount);
  }, [previewBtcAmount, previewUnitAmount, btcPrice]);

  // Check if health would be below minimum
  const healthBelowMin = previewHealth > 0 && previewHealth < 160;

  // Preview liquidation price calculation
  const previewLiquidationPrice = useMemo(() => {
    if (previewBtcAmount <= 0) return 0;
    return computeLiquidationPrice(previewUnitAmount, previewBtcAmount);
  }, [previewBtcAmount, previewUnitAmount]);

  // Live update handlers - always reset UNIT when BTC changes
  const handleBtcLiveChange = useCallback((val: number) => {
    setPreviewBtcAmount(val);
    // Always reset UNIT to 0 when BTC slider is touched
    setPreviewUnitAmount(0);
    setUnitAmount(0);
  }, [setUnitAmount]);

  const handleUnitLiveChange = useCallback((val: number) => {
    setPreviewUnitAmount(val);
  }, []);

  // Validation
  const canContinue = useMemo(() => {
    if (btcAmount <= 0 || unitAmount <= 0) return false;
    if (btcAmount > availableBtc) return false;
    if (healthFactor < 160) return false;
    return true;
  }, [btcAmount, unitAmount, availableBtc, healthFactor]);

  // Handle continue
  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('VaultConfirm');
  }, [canContinue, setCurrentStep, navigation]);

  const hasChanges = previewBtcAmount > 0 && previewUnitAmount > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            hasNoDebt={previewUnitAmount <= 0}
          />

          {/* Liquidation Price */}
          {(previewLiquidationPrice > 0 || previewLiquidationPrice === Infinity) && (
            <View style={styles.liquidationPrice}>
              <Text style={styles.liquidationLabel}>Liquidation Price</Text>
              <Text style={styles.liquidationValue}>
                {previewLiquidationPrice === Infinity
                  ? 'None'
                  : `$${previewLiquidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              </Text>
            </View>
          )}

          {/* BTC Slider */}
          <View style={styles.section}>
            <AmountSlider
              value={btcAmount}
              maxValue={availableBtc}
              onValueChange={setBtcAmount}
              onLiveValueChange={handleBtcLiveChange}
              label="BTC to Deposit"
              btcPrice={btcPrice ?? undefined}
              disabled={availableBtc <= 0}
            />
          </View>

          {/* UNIT Slider */}
          <View style={styles.section}>
            <UnitAmountSlider
              value={unitAmount}
              maxValue={previewMaxBorrowable}
              onValueChange={setUnitAmount}
              onLiveValueChange={handleUnitLiveChange}
              label="UNIT to Borrow"
              disabled={previewMaxBorrowable <= 0}
            />
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
  scroll: { padding: spacing.lg, paddingBottom: 120 },
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
    marginTop: spacing.sm,
  },
  liquidationLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  liquidationValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.semiBold,
    color: colors.text.secondary,
  },
  section: { marginTop: spacing.lg },
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
    padding: spacing.lg,
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
