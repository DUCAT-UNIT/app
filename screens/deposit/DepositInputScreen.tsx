/**
 * DepositInputScreen - Enter BTC deposit amount
 * Features: Current vault data display, max button, health factor preview
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  Text,
  View,
  TextInput,
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
import { HealthFactorBar } from '../../components/vaultCreation';
import { useDeposit } from '../../stores/depositStore';
import { useDepositVault } from '../../hooks/useDepositVault';
import { usePrice } from '../../stores/priceStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { formatFiat, formatBTC } from '../../utils/formatters';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface DepositInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function DepositInputScreen({ navigation }: DepositInputScreenProps) {
  const {
    depositAmountSats,
    depositAmountBtc,
    currentUnitBorrowed,
    currentBtcLocked,
    selectedFeeRate,
    newHealthFactor,
    newLiquidationPrice,
    healthFactor,
    setDepositAmountBtc,
    setCurrentStep,
    error,
    reset,
  } = useDeposit();

  const { loadVaultData, isLoading: isLoadingVault } = useDepositVault();
  const { btcPrice } = usePrice();
  const { segwitBalance } = useBalance();

  // Local input state
  const [btcInput, setBtcInput] = useState(depositAmountBtc > 0 ? depositAmountBtc.toString() : '');
  const [vaultLoaded, setVaultLoaded] = useState(false);

  // Load vault data and balance on mount
  useEffect(() => {
    const load = async () => {
      const success = await loadVaultData();
      setVaultLoaded(success);
    };
    load();
  }, [loadVaultData]);

  // Calculate available balance in sats (segwitBalance is in BTC)
  const availableBalanceSats = useMemo(() => {
    return Math.round((segwitBalance || 0) * 100_000_000);
  }, [segwitBalance]);

  // Available balance in BTC for display
  const availableBalanceBtcDisplay = segwitBalance || 0;

  // Handle close - reset state and dismiss modal
  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  // Handle BTC input change
  const handleBtcChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;

    setBtcInput(formatted);
    const value = parseFloat(formatted) || 0;
    setDepositAmountBtc(value);
  }, [setDepositAmountBtc]);

  // Handle MAX button for BTC
  const handleMaxBtc = useCallback(() => {
    if (availableBalanceSats > 0) {
      // Leave some for fees (10000 sats)
      const maxSats = Math.max(0, availableBalanceSats - 10000);
      const maxBtc = maxSats / 100_000_000;
      setBtcInput(maxBtc.toFixed(8));
      setDepositAmountBtc(maxBtc);
    }
  }, [availableBalanceSats, setDepositAmountBtc]);

  // Calculate total collateral after deposit
  const totalCollateral = useMemo(() => {
    return currentBtcLocked + depositAmountBtc;
  }, [currentBtcLocked, depositAmountBtc]);

  // Calculate USD value
  const depositUsdValue = useMemo(() => {
    return btcPrice ? depositAmountBtc * btcPrice : 0;
  }, [depositAmountBtc, btcPrice]);

  // Validation
  const canContinue = useMemo(() => {
    if (!vaultLoaded) return false;
    if (depositAmountSats <= 0) return false;
    if (depositAmountSats > availableBalanceSats) return false;
    return true;
  }, [vaultLoaded, depositAmountSats, availableBalanceSats]);

  // Handle continue
  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('DepositConfirm');
  }, [canContinue, setCurrentStep, navigation]);

  // Loading state
  if (isLoadingVault && !vaultLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Loading vault data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No vault state
  if (vaultLoaded && currentBtcLocked <= 0 && currentUnitBorrowed <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Deposit BTC</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.noVaultContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.semantic.warning} />
            <Text style={styles.noVaultText}>No vault found</Text>
            <Text style={styles.noVaultSubtext}>
              Please create a vault first to deposit BTC.
            </Text>
            <TouchableScale style={styles.createVaultButton} onPress={handleClose}>
              <Text style={styles.createVaultText}>Close</Text>
            </TouchableScale>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Deposit BTC</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              Add more BTC collateral to improve your vault health
            </Text>
          </View>

          {/* Current Vault Info */}
          <View style={styles.vaultInfoCard}>
            <Text style={styles.vaultInfoTitle}>Current Vault</Text>
            <View style={styles.vaultInfoRow}>
              <Text style={styles.vaultInfoLabel}>Collateral</Text>
              <Text style={styles.vaultInfoValue}>{currentBtcLocked.toFixed(8)} BTC</Text>
            </View>
            <View style={styles.vaultInfoRow}>
              <Text style={styles.vaultInfoLabel}>Debt</Text>
              <Text style={styles.vaultInfoValue}>{currentUnitBorrowed.toFixed(2)} UNIT</Text>
            </View>
            <View style={styles.vaultInfoRow}>
              <Text style={styles.vaultInfoLabel}>Health Factor</Text>
              <Text style={[styles.vaultInfoValue, { color: getHealthColor(healthFactor) }]}>
                {healthFactor}%
              </Text>
            </View>
          </View>

          {/* BTC Deposit Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>BTC to Deposit</Text>
              <TouchableScale onPress={handleMaxBtc} disabled={availableBalanceSats <= 0}>
                <Text style={[styles.maxButton, availableBalanceSats <= 0 && styles.maxButtonDisabled]}>
                  MAX
                </Text>
              </TouchableScale>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={btcInput}
                onChangeText={handleBtcChange}
                placeholder="0.00000000"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.inputSuffix}>BTC</Text>
            </View>

            <View style={styles.inputMeta}>
              <Text style={styles.usdValue}>≈ {formatFiat(depositUsdValue)}</Text>
              <Text style={styles.balance}>
                Available: {formatBTC(availableBalanceBtcDisplay)} BTC
              </Text>
            </View>
          </View>

          {/* New Totals */}
          {depositAmountBtc > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>After Deposit</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Collateral</Text>
                <Text style={styles.previewValue}>{totalCollateral.toFixed(8)} BTC</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>New Health Factor</Text>
                <Text style={[styles.previewValue, { color: getHealthColor(newHealthFactor) }]}>
                  {newHealthFactor}%
                </Text>
              </View>
              {newLiquidationPrice > 0 && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Liquidation Price</Text>
                  <Text style={[styles.previewValue, { color: colors.semantic.success }]}>
                    {formatFiat(newLiquidationPrice)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Health Factor */}
          <View style={styles.healthSection}>
            <Text style={styles.healthLabel}>New Health Factor</Text>
            <HealthFactorBar healthFactor={depositAmountBtc > 0 ? newHealthFactor : healthFactor} />
            <View style={styles.healthMeta}>
              <Text style={styles.healthHint}>
                Adding collateral improves vault health and lowers liquidation risk.
              </Text>
            </View>
          </View>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableScale
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
              Continue
            </Text>
          </TouchableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getHealthColor(healthFactor: number): string {
  if (healthFactor >= 200) return colors.semantic.success;
  if (healthFactor >= 161) return colors.semantic.warning;
  return colors.semantic.error;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  noVaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  noVaultText: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  noVaultSubtext: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  createVaultButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  createVaultText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  vaultInfoCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  vaultInfoTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  vaultInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  vaultInfoLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  vaultInfoValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  inputSection: {
    marginBottom: spacing.xl,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  maxButton: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  maxButtonDisabled: {
    color: colors.text.tertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.xl,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  inputSuffix: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  usdValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  balance: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  previewCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  previewLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  previewValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  healthSection: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  healthLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  healthMeta: {
    marginTop: spacing.md,
  },
  healthHint: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  errorContainer: {
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.semantic.error,
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
  continueButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
  continueText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  continueTextDisabled: {
    color: colors.text.tertiary,
  },
});
