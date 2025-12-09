/**
 * VaultAmountsScreen - Enter BTC deposit and UNIT borrow amounts
 * Features: Health factor display, max buttons, fee selection
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
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { HealthFactorBar } from '../../components/vaultCreation';
import { VaultStepIndicator } from '../../components/vaultCreation';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { getMaxUnit, getOpCostOpen } from '../../utils/vaultUtils';
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
    liquidationPrice,
    maxBorrowable,
    setBtcAmount,
    setUnitAmount,
    setSelectedFeeRate,
    setBitcoinPrice,
    setCurrentStep,
    error,
    setError,
    reset,
  } = useVaultCreation();

  // Handle close - reset state and dismiss modal
  const handleClose = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [reset, navigation]);

  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();

  // Update bitcoin price in store when it changes
  useEffect(() => {
    if (btcPrice) {
      setBitcoinPrice(btcPrice);
    }
  }, [btcPrice, setBitcoinPrice]);

  // Local input states for controlled inputs
  const [btcInput, setBtcInput] = useState(btcAmount > 0 ? btcAmount.toString() : '');
  const [unitInput, setUnitInput] = useState(unitAmount > 0 ? unitAmount.toString() : '');

  // Calculate available BTC (balance minus fees)
  // Note: segwitBalance is already in BTC, not sats
  const availableBtc = useMemo(() => {
    if (!segwitBalance) return 0;
    const feeCost = getOpCostOpen(selectedFeeRate) / 100_000_000;
    return Math.max(segwitBalance - feeCost - 0.00001, 0); // Leave small buffer
  }, [segwitBalance, selectedFeeRate]);

  // Handle BTC input change
  const handleBtcChange = useCallback((text: string) => {
    // Allow only numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;

    setBtcInput(formatted);
    const value = parseFloat(formatted) || 0;
    setBtcAmount(value);
  }, [setBtcAmount]);

  // Handle UNIT input change
  const handleUnitChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;

    setUnitInput(formatted);
    const value = parseFloat(formatted) || 0;
    setUnitAmount(value);
  }, [setUnitAmount]);

  // Handle MAX button for BTC
  const handleMaxBtc = useCallback(() => {
    setBtcInput(availableBtc.toFixed(8));
    setBtcAmount(availableBtc);
  }, [availableBtc, setBtcAmount]);

  // Handle MAX button for UNIT
  const handleMaxUnit = useCallback(() => {
    if (maxBorrowable !== null) {
      const max = Math.floor(maxBorrowable);
      setUnitInput(max.toString());
      setUnitAmount(max);
    }
  }, [maxBorrowable, setUnitAmount]);

  // Calculate USD values
  const btcUsdValue = useMemo(() => {
    if (!btcPrice || btcAmount <= 0) return null;
    return btcAmount * btcPrice;
  }, [btcAmount, btcPrice]);

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
              <Text style={styles.title}>Create Vault</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              Deposit BTC as collateral and borrow UNIT stablecoins
            </Text>
          </View>

          <VaultStepIndicator currentStep={1} />

          {/* BTC Deposit Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>Deposit BTC</Text>
              <TouchableScale onPress={handleMaxBtc}>
                <Text style={styles.maxButton}>MAX</Text>
              </TouchableScale>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={btcInput}
                onChangeText={handleBtcChange}
                placeholder="0.00"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.inputSuffix}>BTC</Text>
            </View>

            <View style={styles.inputMeta}>
              <Text style={styles.usdValue}>
                {btcUsdValue !== null ? `≈ ${formatFiat(btcUsdValue)}` : ''}
              </Text>
              <Text style={styles.balance}>
                Available: {availableBtc.toFixed(8)} BTC
              </Text>
            </View>
          </View>

          {/* UNIT Borrow Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>Borrow UNIT</Text>
              <TouchableScale onPress={handleMaxUnit} disabled={maxBorrowable === null}>
                <Text style={[styles.maxButton, maxBorrowable === null && styles.maxButtonDisabled]}>
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
              />
              <Text style={styles.inputSuffix}>UNIT</Text>
            </View>

            <View style={styles.inputMeta}>
              <Text style={styles.usdValue}>≈ {formatFiat(unitAmount)}</Text>
              <Text style={styles.balance}>
                Max borrowable: {maxBorrowable !== null ? Math.floor(maxBorrowable) : '-'} UNIT
              </Text>
            </View>
          </View>

          {/* Health Factor */}
          <View style={styles.healthSection}>
            <Text style={styles.healthLabel}>Health Factor</Text>
            <HealthFactorBar healthFactor={healthFactor} />
            <View style={styles.healthMeta}>
              <Text style={styles.healthHint}>
                Minimum 160% required. Higher is safer.
              </Text>
              {liquidationPrice > 0 && (
                <Text style={styles.liquidationPrice}>
                  Liquidation at: {formatFiat(liquidationPrice)}
                </Text>
              )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
  liquidationPrice: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.semantic.warning,
    marginTop: spacing.xs,
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
