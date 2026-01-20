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
import { LinearGradient } from 'expo-linear-gradient';
import TouchableScale from '../../components/common/TouchableScale';
import { VaultActionGauge, AmountSlider } from '../../components/vaultAction';
import { UnitAmountSlider } from '../../components/vaultAction/UnitAmountSlider';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { getOpCostOpen, computeHealthFactor, computeLiquidationPrice } from '../../utils/vaultUtils';
import { formatFiat } from '../../utils/formatters';
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
    setBtcAmount,
    setUnitAmount,
    setBitcoinPrice,
    setCurrentStep,
    error,
    reset,
  } = useVaultCreation();

  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  const { segwitBalance } = useBalance();
  const { btcPrice } = usePrice();

  const [previewBtcAmount, setPreviewBtcAmount] = useState(btcAmount);
  const [previewUnitAmount, setPreviewUnitAmount] = useState(unitAmount);

  useEffect(() => {
    if (btcPrice) {
      setBitcoinPrice(btcPrice);
    }
  }, [btcPrice, setBitcoinPrice]);

  useEffect(() => {
    setPreviewBtcAmount(btcAmount);
  }, [btcAmount]);

  useEffect(() => {
    setPreviewUnitAmount(unitAmount);
  }, [unitAmount]);

  const availableBtc = useMemo(() => {
    if (!segwitBalance) return 0;
    const feeCost = getOpCostOpen(selectedFeeRate) / 100_000_000;
    return Math.max(segwitBalance - feeCost - 0.00001, 0);
  }, [segwitBalance, selectedFeeRate]);

  const previewMaxBorrowable = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0) return 0;
    return Math.floor((previewBtcAmount * btcPrice) / 1.6);
  }, [previewBtcAmount, btcPrice]);

  const previewHealth = useMemo(() => {
    if (!btcPrice || previewBtcAmount <= 0 || previewUnitAmount <= 0) return 0;
    return computeHealthFactor(previewBtcAmount, btcPrice, previewUnitAmount);
  }, [previewBtcAmount, previewUnitAmount, btcPrice]);

  const previewLiqPrice = useMemo(() => {
    if (previewBtcAmount <= 0 || previewUnitAmount <= 0) return 0;
    return computeLiquidationPrice(previewUnitAmount, previewBtcAmount);
  }, [previewBtcAmount, previewUnitAmount]);

  const healthBelowMin = previewHealth > 0 && previewHealth < 160;

  const handleBtcLiveChange = useCallback((val: number) => {
    setPreviewBtcAmount(val);
  }, []);

  const handleUnitLiveChange = useCallback((val: number) => {
    setPreviewUnitAmount(val);
  }, []);

  const canContinue = useMemo(() => {
    if (btcAmount <= 0 || unitAmount <= 0) return false;
    if (btcAmount > availableBtc) return false;
    if (healthFactor < 160) return false;
    return true;
  }, [btcAmount, unitAmount, availableBtc, healthFactor]);

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
            <View>
              <Text style={styles.title}>Create Vault</Text>
              <Text style={styles.subtitle}>Set your collateral and borrow amount</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gauge Section */}
          <View style={styles.gaugeSection}>
            <VaultActionGauge
              currentHealth={0}
              newHealth={hasChanges ? previewHealth : undefined}
              showTransition={hasChanges}
            />
          </View>

          {/* Collateral Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="lock-closed" size={16} color={colors.brand.primary} />
              </View>
              <Text style={styles.sectionTitle}>Collateral</Text>
            </View>
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

          {/* Borrow Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(89, 170, 138, 0.15)' }]}>
                <Ionicons name="cash-outline" size={16} color={colors.semantic.success} />
              </View>
              <Text style={styles.sectionTitle}>Borrow</Text>
            </View>
            <UnitAmountSlider
              value={unitAmount}
              maxValue={previewMaxBorrowable}
              onValueChange={setUnitAmount}
              onLiveValueChange={handleUnitLiveChange}
              label="UNIT to Borrow"
              disabled={previewMaxBorrowable <= 0}
            />
          </View>

          {/* Summary Card */}
          {hasChanges && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Vault Preview</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Liquidation Price</Text>
                <Text style={[styles.summaryValue, { color: colors.semantic.warning }]}>
                  {formatFiat(previewLiqPrice)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current BTC Price</Text>
                <Text style={styles.summaryValue}>{formatFiat(btcPrice || 0)}</Text>
              </View>
            </View>
          )}

          {/* Warning */}
          {healthBelowMin && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={18} color={colors.semantic.error} />
              <Text style={styles.warningText}>
                Health must be at least 160%. Adjust your amounts.
              </Text>
            </View>
          )}

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
            {canContinue ? (
              <LinearGradient
                colors={['#1858E4', '#1248C4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.text.white} />
              </LinearGradient>
            ) : (
              <View style={styles.disabledBtnContent}>
                <Text style={styles.continueBtnTextDisabled}>Continue</Text>
              </View>
            )}
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeSection: {
    marginBottom: spacing.md,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(24, 88, 228, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  warning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
  },
  error: {
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
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
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  continueBtn: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  continueBtnDisabled: {},
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  disabledBtnContent: {
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  continueBtnText: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  continueBtnTextDisabled: {
    color: colors.text.tertiary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
});
