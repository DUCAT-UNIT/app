/**
 * WithdrawInputScreen - Enter BTC withdraw amount
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
  ActivityIndicator,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { FeeRateDropdown } from '../../components/common/FeeRateSelectorCompact';
import { VaultActionGauge, VaultChangesCard, AmountSlider } from '../../components/vaultAction';
import { useWithdraw } from '../../stores/withdrawStore';
import { useWithdrawVault } from '../../hooks/useWithdrawVault';
import { usePriceStore } from '../../stores/priceStore';
import { useBalance, useVaultData } from '../../contexts/WalletDataContext';
import { computeHealthFactor, computeLiquidationPrice, getOpCostOpen } from '../../utils/vaultUtils';
import { VAULT_CONFIG } from '../../utils/constants';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

// Health-based slider colors (matching VaultActionGauge)
const getHealthSliderColor = (health: number): string => {
  if (health <= 160) return '#d04c68'; // red
  if (health <= 200) return '#fde37b'; // yellow
  return '#59aa8a'; // green
};

interface WithdrawInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function WithdrawInputScreen({ navigation }: WithdrawInputScreenProps) {
  const {
    withdrawAmountSats,
    withdrawAmountBtc,
    currentUnitBorrowed,
    currentBtcLocked,
    maxWithdrawable,
    selectedFeeRate,
    setSelectedFeeRate,
    setWithdrawAmountBtc,
    setCurrentStep,
    error,
    reset,
  } = useWithdraw();

  const { loadVaultData } = useWithdrawVault();
  const { btcPrice, fetchBtcPrice } = usePriceStore();
  const { segwitBalance, utxos } = useBalance();
  const { vaultData } = useVaultData();

  // Use vault data directly from context for immediate display
  const contextBtcLocked = vaultData?.totalCollateral ?? 0;
  const contextUnitBorrowed = vaultData?.totalDebt ?? 0;

  // Use context values if store hasn't synced yet - prioritize whichever has data
  const effectiveBtcLocked = currentBtcLocked > 0 ? currentBtcLocked : contextBtcLocked;
  const effectiveUnitBorrowed = currentUnitBorrowed > 0 ? currentUnitBorrowed : contextUnitBorrowed;

  // Track if initial data has been loaded to prevent layout flash
  const [isInitializing, setIsInitializing] = useState(true);

  // Consider vault loaded if we have effective data from either source
  const hasVaultData = effectiveBtcLocked > 0 || effectiveUnitBorrowed > 0;
  const vaultLoaded = vaultData !== null || hasVaultData;

  // BTC balance in sats for fee validation (fee comes from user's wallet)
  const btcBalanceSats = Math.round((segwitBalance || 0) * 100_000_000);

  // Calculate estimated fee based on selected rate and UTXOs
  const estimatedFeeSats = useMemo(() => {
    return getOpCostOpen(selectedFeeRate, utxos);
  }, [selectedFeeRate, utxos]);

  // Check if user has sufficient BTC for the selected fee rate
  const hasSufficientBtc = btcBalanceSats >= estimatedFeeSats;
  const feeErrorMessage = !hasSufficientBtc
    ? btcBalanceSats === 0
      ? 'You need BTC in your wallet for transaction fees'
      : `Need ${(estimatedFeeSats / 100_000_000).toFixed(8)} BTC for fees, have ${(btcBalanceSats / 100_000_000).toFixed(8)} BTC`
    : null;

  // Local preview state for real-time updates during drag
  const [previewAmount, setPreviewAmount] = useState(withdrawAmountBtc);

  useEffect(() => {
    if (!btcPrice) {
      fetchBtcPrice();
    }
    // Sync vault data from context to withdraw store
    if (vaultData) {
      loadVaultData();
    }
  }, [btcPrice, fetchBtcPrice, vaultData, loadVaultData]);

  // Mark initialization complete after first render with data
  useEffect(() => {
    if (vaultLoaded && isInitializing) {
      const timer = setTimeout(() => setIsInitializing(false), 50);
      return () => clearTimeout(timer);
    }
  }, [vaultLoaded, isInitializing]);

  // Max withdrawable in BTC
  const maxWithdrawableBtc = useMemo(() => {
    return Math.max(0, maxWithdrawable / 100_000_000);
  }, [maxWithdrawable]);

  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  // Compute current health directly using effective values from context
  const currentHealth = useMemo(() => {
    if (!btcPrice || effectiveBtcLocked <= 0 || effectiveUnitBorrowed <= 0) return 0;
    return computeHealthFactor(effectiveBtcLocked, btcPrice, effectiveUnitBorrowed);
  }, [btcPrice, effectiveBtcLocked, effectiveUnitBorrowed]);

  const currentLiqPrice = useMemo(() => {
    if (effectiveBtcLocked <= 0) return 0;
    return computeLiquidationPrice(effectiveUnitBorrowed, effectiveBtcLocked);
  }, [effectiveBtcLocked, effectiveUnitBorrowed]);

  // Sync preview amount when store value changes
  useEffect(() => {
    setPreviewAmount(withdrawAmountBtc);
  }, [withdrawAmountBtc]);

  // Preview calculations after withdrawal - uses previewAmount for real-time updates
  const preview = useMemo(() => {
    const newCollateral = Math.max(0, effectiveBtcLocked - previewAmount);

    if (!btcPrice || newCollateral <= 0) {
      return { newCollateral, newHealth: 0, newLiqPrice: 0 };
    }

    // If no debt, health is infinite and no liquidation risk
    if (effectiveUnitBorrowed <= 0) {
      return { newCollateral, newHealth: 999, newLiqPrice: Infinity };
    }

    return {
      newCollateral,
      newHealth: computeHealthFactor(newCollateral, btcPrice, effectiveUnitBorrowed),
      newLiqPrice: computeLiquidationPrice(effectiveUnitBorrowed, newCollateral),
    };
  }, [previewAmount, effectiveBtcLocked, effectiveUnitBorrowed, btcPrice]);

  // Check if withdrawal would violate min health
  const wouldViolateMinHealth = useMemo(() => {
    if (previewAmount <= 0) return false;
    if (effectiveUnitBorrowed <= 0) return false;
    return preview.newHealth < VAULT_CONFIG.MIN_COL_RATE * 100;
  }, [previewAmount, effectiveUnitBorrowed, preview.newHealth]);

  // Live update handler
  const handleLiveValueChange = useCallback((val: number) => {
    setPreviewAmount(val);
  }, []);

  const canContinue = vaultLoaded && withdrawAmountSats > 0 && !wouldViolateMinHealth && hasSufficientBtc;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('WithdrawConfirm');
  }, [canContinue, setCurrentStep, navigation]);

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

  if (vaultLoaded && effectiveBtcLocked <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.semantic.warning} />
          <Text style={styles.noVaultText}>No collateral to withdraw</Text>
          <TouchableScale style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  const hasChanges = previewAmount > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Withdraw BTC</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gauge */}
          <VaultActionGauge
            currentHealth={currentHealth}
            newHealth={hasChanges ? preview.newHealth : undefined}
            showTransition={hasChanges}
          />

          {/* Slider with Fee Selector inside */}
          <View style={styles.section}>
            <AmountSlider
              value={withdrawAmountBtc}
              maxValue={maxWithdrawableBtc}
              onValueChange={setWithdrawAmountBtc}
              onLiveValueChange={handleLiveValueChange}
              label="BTC to Withdraw"
              btcPrice={btcPrice ?? undefined}
              disabled={maxWithdrawableBtc <= 0}
              sliderColor={getHealthSliderColor(hasChanges ? preview.newHealth : currentHealth)}
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

          {/* Warning for min health violation */}
          {wouldViolateMinHealth && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>
                This would put your vault below the minimum health of {VAULT_CONFIG.MIN_COL_RATE * 100}%.
              </Text>
            </View>
          )}

          {/* Warning for insufficient BTC for fees */}
          {!hasSufficientBtc && feeErrorMessage && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>{feeErrorMessage}</Text>
            </View>
          )}

          {/* Changes */}
          <View style={styles.section}>
            <VaultChangesCard
              currentCollateral={effectiveBtcLocked}
              currentDebt={effectiveUnitBorrowed}
              currentHealth={currentHealth}
              newCollateral={preview.newCollateral}
              newDebt={effectiveUnitBorrowed}
              newHealth={hasChanges ? preview.newHealth : currentHealth}
              currentLiquidationPrice={currentLiqPrice}
              newLiquidationPrice={hasChanges ? preview.newLiqPrice : currentLiqPrice}
              showChanges={hasChanges}
              hideTitle
            />
          </View>

          {error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { color: colors.text.secondary, fontSize: fontSizes.md },
  noVaultText: { color: colors.text.primary, fontSize: fontSizes.xl, fontFamily: fonts.bold },
  closeBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  closeBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { color: colors.text.primary, fontSize: fontSizes.xxl, fontFamily: fonts.bold },
  section: { marginTop: spacing.lg },
  feeSection: { marginTop: spacing.lg },
  warning: { flexDirection: 'row', backgroundColor: 'rgba(208,76,104,0.1)', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  warningText: { flex: 1, color: colors.semantic.error, fontSize: fontSizes.sm, fontFamily: fonts.medium },
  error: { backgroundColor: 'rgba(208,76,104,0.1)', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  errorText: { color: colors.semantic.error, fontSize: fontSizes.sm, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.default },
  continueBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: colors.bg.tertiary },
  continueBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  continueBtnTextDisabled: { color: colors.text.tertiary },
});
