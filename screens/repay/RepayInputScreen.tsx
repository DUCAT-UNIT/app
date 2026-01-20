/**
 * RepayInputScreen - Enter UNIT repay amount
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
import { VaultActionGauge, VaultChangesCard } from '../../components/vaultAction';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import { useRepay } from '../../stores/repayStore';
import { useRepayVault } from '../../hooks/useRepayVault';
import { usePriceStore } from '../../stores/priceStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { computeHealthFactor, computeLiquidationPrice } from '../../utils/vaultUtils';
import { getRunesAmount } from '../../utils/runesHelper';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface RepayInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayInputScreen({ navigation }: RepayInputScreenProps) {
  const {
    repayAmountUnit,
    currentUnitBorrowed,
    currentBtcLocked,
    maxRepayable,
    setRepayAmountUnit,
    setAvailableUnitBalance,
    setCurrentStep,
    error,
    reset,
  } = useRepay();

  const { loadVaultData, isLoading: isLoadingVault } = useRepayVault();
  const { btcPrice, fetchBtcPrice } = usePriceStore();
  const { runesBalance } = useBalance();
  const [vaultLoaded, setVaultLoaded] = useState(false);

  // Get UNIT balance from runes
  const unitBalance = useMemo((): number => {
    return getRunesAmount(runesBalance);
  }, [runesBalance]);

  // Local preview state for real-time updates during drag
  const [previewAmount, setPreviewAmount] = useState(repayAmountUnit);

  useEffect(() => {
    if (!btcPrice) {
      fetchBtcPrice();
    }
    loadVaultData().then(setVaultLoaded);
  }, [loadVaultData, btcPrice, fetchBtcPrice]);

  // Update available UNIT balance
  useEffect(() => {
    setAvailableUnitBalance(unitBalance);
  }, [unitBalance, setAvailableUnitBalance]);

  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  // Compute current health directly
  const currentHealth = useMemo(() => {
    if (!btcPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, btcPrice, currentUnitBorrowed);
  }, [btcPrice, currentBtcLocked, currentUnitBorrowed]);

  const currentLiqPrice = useMemo(() => {
    if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
  }, [currentBtcLocked, currentUnitBorrowed]);

  // Sync preview amount when store value changes
  useEffect(() => {
    setPreviewAmount(repayAmountUnit);
  }, [repayAmountUnit]);

  // Preview calculations after repay - uses previewAmount for real-time updates
  const preview = useMemo(() => {
    const newDebt = Math.max(0, currentUnitBorrowed - previewAmount);

    if (!btcPrice || currentBtcLocked <= 0 || newDebt <= 0) {
      return { newDebt, newHealth: newDebt === 0 ? 999 : 0, newLiqPrice: 0 };
    }

    return {
      newDebt,
      newHealth: computeHealthFactor(currentBtcLocked, btcPrice, newDebt),
      newLiqPrice: computeLiquidationPrice(newDebt, currentBtcLocked),
    };
  }, [previewAmount, currentBtcLocked, currentUnitBorrowed, btcPrice]);

  // Live update handler
  const handleLiveValueChange = useCallback((val: number) => {
    setPreviewAmount(val);
  }, []);

  // Max repayable in UNIT (floor to whole numbers, limited by balance)
  const maxRepayableUnit = useMemo(() => {
    const max = Math.min(maxRepayable || currentUnitBorrowed, unitBalance);
    return Math.max(0, Math.floor(max));
  }, [maxRepayable, currentUnitBorrowed, unitBalance]);

  // Validation message
  const validationMessage = useMemo(() => {
    if (!vaultLoaded) return null;
    if (repayAmountUnit <= 0) return null;
    if (repayAmountUnit > currentUnitBorrowed) {
      return `Cannot repay more than your debt (${currentUnitBorrowed.toFixed(2)} UNIT)`;
    }
    if (repayAmountUnit > unitBalance) {
      return `Insufficient UNIT balance. You have ${unitBalance.toFixed(2)} UNIT available.`;
    }
    return null;
  }, [vaultLoaded, repayAmountUnit, currentUnitBorrowed, unitBalance]);

  const canContinue = vaultLoaded && repayAmountUnit > 0 && repayAmountUnit <= currentUnitBorrowed && repayAmountUnit <= unitBalance;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('RepayConfirm');
  }, [canContinue, setCurrentStep, navigation]);

  if (isLoadingVault && !vaultLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Loading vault...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No vault debt state
  if (vaultLoaded && currentUnitBorrowed <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.semantic.success} />
          <Text style={styles.noVaultText}>No debt to repay</Text>
          <TouchableScale style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // No UNIT balance state
  if (vaultLoaded && currentUnitBorrowed > 0 && unitBalance <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.semantic.warning} />
          <Text style={styles.noVaultText}>No UNIT Available</Text>
          <Text style={styles.noVaultSubtext}>
            You need UNIT to repay your debt of {currentUnitBorrowed.toFixed(2)} UNIT.
          </Text>
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
            <Text style={styles.title}>Repay UNIT</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gauge */}
          <VaultActionGauge
            currentHealth={currentHealth}
            newHealth={hasChanges ? preview.newHealth : undefined}
            showTransition={hasChanges}
            hasNoDebt={hasChanges && preview.newDebt === 0}
          />

          {/* Slider */}
          <View style={styles.section}>
            <UnitAmountSlider
              value={repayAmountUnit}
              maxValue={maxRepayableUnit}
              onValueChange={setRepayAmountUnit}
              onLiveValueChange={handleLiveValueChange}
              label="UNIT to Repay"
              disabled={maxRepayableUnit <= 0}
            />
            <Text style={styles.balanceText}>
              Available: {unitBalance.toFixed(2)} UNIT
            </Text>
          </View>

          {/* Validation/Error message */}
          {(error || validationMessage) && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={20} color={colors.semantic.error} />
              <Text style={styles.warningText}>{error || validationMessage}</Text>
            </View>
          )}

          {/* Changes */}
          <View style={styles.section}>
            <VaultChangesCard
              currentCollateral={currentBtcLocked}
              currentDebt={currentUnitBorrowed}
              currentHealth={currentHealth}
              newCollateral={currentBtcLocked}
              newDebt={preview.newDebt}
              newHealth={hasChanges ? preview.newHealth : currentHealth}
              currentLiquidationPrice={currentLiqPrice}
              newLiquidationPrice={hasChanges ? preview.newLiqPrice : currentLiqPrice}
              showChanges={hasChanges}
              actionType="debt"
            />
          </View>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  loadingText: { color: colors.text.secondary, fontSize: fontSizes.md },
  noVaultText: { color: colors.text.primary, fontSize: fontSizes.xl, fontFamily: fonts.bold },
  noVaultSubtext: { color: colors.text.secondary, fontSize: fontSizes.md, textAlign: 'center' },
  closeBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  closeBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { color: colors.text.primary, fontSize: fontSizes.xxl, fontFamily: fonts.bold },
  section: { marginTop: spacing.lg },
  balanceText: { color: colors.text.tertiary, fontSize: fontSizes.sm, textAlign: 'right', marginTop: spacing.xs },
  warning: { flexDirection: 'row', backgroundColor: 'rgba(208,76,104,0.1)', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  warningText: { flex: 1, color: colors.semantic.error, fontSize: fontSizes.sm, fontFamily: fonts.medium },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.default },
  continueBtn: { backgroundColor: colors.brand.primary, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: colors.bg.tertiary },
  continueBtnText: { color: colors.text.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  continueBtnTextDisabled: { color: colors.text.tertiary },
});
