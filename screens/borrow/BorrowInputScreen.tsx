/**
 * BorrowInputScreen - Enter additional UNIT borrow amount
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
import { useBorrow } from '../../stores/borrowStore';
import { useBorrowVault } from '../../hooks/useBorrowVault';
import { usePrice } from '../../stores/priceStore';
import { formatFiat } from '../../utils/formatters';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface BorrowInputScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowInputScreen({ navigation }: BorrowInputScreenProps) {
  const {
    borrowAmount,
    currentUnitBorrowed,
    currentBtcLocked,
    selectedFeeRate,
    newHealthFactor,
    newLiquidationPrice,
    maxBorrowable,
    healthFactor,
    setBorrowAmount,
    setCurrentStep,
    error,
    setError,
    reset,
  } = useBorrow();

  const { loadVaultData, isLoading: isLoadingVault } = useBorrowVault();
  const { btcPrice } = usePrice();

  // Local input state
  const [unitInput, setUnitInput] = useState(borrowAmount > 0 ? borrowAmount.toString() : '');
  const [vaultLoaded, setVaultLoaded] = useState(false);

  // Load vault data on mount
  useEffect(() => {
    const load = async () => {
      const success = await loadVaultData();
      setVaultLoaded(success);
    };
    load();
  }, [loadVaultData]);

  // Handle close - reset state and dismiss modal
  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  // Handle UNIT input change
  const handleUnitChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;

    setUnitInput(formatted);
    const value = parseFloat(formatted) || 0;
    setBorrowAmount(value);
  }, [setBorrowAmount]);

  // Handle MAX button for UNIT
  const handleMaxUnit = useCallback(() => {
    if (maxBorrowable !== null && maxBorrowable > 0) {
      const max = Math.floor(maxBorrowable);
      setUnitInput(max.toString());
      setBorrowAmount(max);
    }
  }, [maxBorrowable, setBorrowAmount]);

  // Calculate total debt after borrow
  const totalDebt = useMemo(() => {
    return currentUnitBorrowed + borrowAmount;
  }, [currentUnitBorrowed, borrowAmount]);

  // Validation
  const canContinue = useMemo(() => {
    if (!vaultLoaded || currentBtcLocked <= 0) return false;
    if (borrowAmount <= 0) return false;
    if (maxBorrowable !== null && borrowAmount > maxBorrowable) return false;
    if (newHealthFactor < 160) return false;
    return true;
  }, [vaultLoaded, currentBtcLocked, borrowAmount, maxBorrowable, newHealthFactor]);

  // Handle continue
  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setCurrentStep('confirm');
    navigation.navigate('BorrowConfirm');
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
  if (vaultLoaded && currentBtcLocked <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Borrow More</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.noVaultContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.semantic.warning} />
            <Text style={styles.noVaultText}>No vault found</Text>
            <Text style={styles.noVaultSubtext}>
              Please create a vault first to borrow UNIT.
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
              <Text style={styles.title}>Borrow More</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              Borrow additional UNIT against your existing collateral
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
              <Text style={styles.vaultInfoLabel}>Current Debt</Text>
              <Text style={styles.vaultInfoValue}>{currentUnitBorrowed.toFixed(2)} UNIT</Text>
            </View>
            <View style={styles.vaultInfoRow}>
              <Text style={styles.vaultInfoLabel}>Health Factor</Text>
              <Text style={[styles.vaultInfoValue, { color: getHealthColor(healthFactor) }]}>
                {healthFactor}%
              </Text>
            </View>
          </View>

          {/* UNIT Borrow Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>Additional UNIT to Borrow</Text>
              <TouchableScale onPress={handleMaxUnit} disabled={maxBorrowable === null || maxBorrowable <= 0}>
                <Text style={[styles.maxButton, (maxBorrowable === null || maxBorrowable <= 0) && styles.maxButtonDisabled]}>
                  MAX
                </Text>
              </TouchableScale>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={unitInput}
                onChangeText={handleUnitChange}
                placeholder="0.00"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.inputSuffix}>UNIT</Text>
            </View>

            <View style={styles.inputMeta}>
              <Text style={styles.usdValue}>≈ {formatFiat(borrowAmount)}</Text>
              <Text style={styles.balance}>
                Max: {maxBorrowable !== null ? Math.floor(maxBorrowable) : '-'} UNIT
              </Text>
            </View>
          </View>

          {/* New Totals */}
          {borrowAmount > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>After Borrow</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Debt</Text>
                <Text style={styles.previewValue}>{totalDebt.toFixed(2)} UNIT</Text>
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
                  <Text style={[styles.previewValue, { color: colors.semantic.warning }]}>
                    {formatFiat(newLiquidationPrice)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Health Factor */}
          <View style={styles.healthSection}>
            <Text style={styles.healthLabel}>New Health Factor</Text>
            <HealthFactorBar healthFactor={borrowAmount > 0 ? newHealthFactor : healthFactor} />
            <View style={styles.healthMeta}>
              <Text style={styles.healthHint}>
                Minimum 160% required. Higher is safer.
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
