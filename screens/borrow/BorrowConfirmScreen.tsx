/**
 * BorrowConfirmScreen - Review and confirm borrow operation
 * Features: Summary display, biometric authentication before signing
 *
 * @deprecated Use BorrowConfirmScreenNew from screens/vault/screens instead.
 * This screen will be removed in a future release.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import { useBorrow } from '../../stores/borrowStore';
import { useBorrowVault } from '../../hooks/useBorrowVault';
import { usePrice } from '../../stores/priceStore';
import { useBalance } from '../../contexts/WalletDataContext';
import { formatFiat } from '../../utils/formatters';
import { getOpCostOpen } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';
import { logger } from '../../utils/logger';

interface BorrowConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowConfirmScreen({ navigation }: BorrowConfirmScreenProps) {
  const {
    borrowAmount,
    currentUnitBorrowed,
    currentBtcLocked,
    selectedFeeRate,
    newHealthFactor,
    newLiquidationPrice,
    healthFactor,
    liquidationPrice,
    setCurrentStep,
    error,
  } = useBorrow();

  const { borrowMore, isLoading } = useBorrowVault();
  const { btcPrice } = usePrice();
  const { utxos } = useBalance();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Calculate values
  const totalDebt = currentUnitBorrowed + borrowAmount;
  const borrowUsdValue = borrowAmount; // UNIT is roughly pegged to USD

  // Dynamic fee calculation based on UTXOs and selected rate
  const estimatedFee = useMemo(() => {
    return getOpCostOpen(selectedFeeRate, utxos);
  }, [selectedFeeRate, utxos]);

  const feeUsdValue = btcPrice ? (estimatedFee / 100_000_000) * btcPrice : 0;

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    try {
      setIsAuthenticating(true);

      // Skip biometric auth in E2E mode
      const isE2E = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true';

      if (!isE2E) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to borrow UNIT',
            fallbackLabel: 'Use PIN',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
          });

          if (!result.success) {
            if (result.error !== 'user_cancel') {
              Alert.alert('Authentication Failed', 'Please try again');
            }
            setIsAuthenticating(false);
            return;
          }
        }
      }

      setIsAuthenticating(false);
      setCurrentStep('processing');
      // Operation runs from the processing screen after navigation
      navigation.navigate('BorrowProcessing');
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', 'Failed to complete borrow. Please try again.');
    }
  }, [borrowMore, setCurrentStep, navigation]);

  const handleBack = useCallback(() => {
    setCurrentStep('input');
    navigation.goBack();
  }, [setCurrentStep, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="vault-borrow-confirm-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Borrow</Text>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Card - All info in one dense block */}
        <View style={styles.summaryCard}>
          {/* Borrow Amount - Highlighted in white */}
          <View style={styles.borrowSection}>
            <Text style={styles.borrowLabel}>Borrow Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.borrowAmount}>{borrowAmount.toFixed(2)}</Text>
              <Icon name="unit_symbol" size={24} />
            </View>
            <Text style={styles.borrowUsd}>≈ ${formatFiat(borrowUsdValue)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Debt - same line */}
          <View style={styles.row}>
            <Text style={styles.label}>Debt</Text>
            <View style={styles.changeRow}>
              <Text style={styles.valueSecondary}>{currentUnitBorrowed.toFixed(2)}</Text>
              <Icon name="unit_symbol" size={14} color={colors.text.secondary} />
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={styles.valueHighlight}>{totalDebt.toFixed(2)}</Text>
              <Icon name="unit_symbol" size={14} />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Collateral - unchanged */}
          <View style={styles.row}>
            <Text style={styles.label}>Collateral (unchanged)</Text>
            <View style={styles.changeRow}>
              <Text style={styles.value}>{currentBtcLocked.toFixed(8)}</Text>
              <Icon name="btc_symbol" size={16} />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Health Factor */}
          <View style={styles.row}>
            <Text style={styles.label}>Health Factor</Text>
            <View style={styles.changeRow}>
              <Text style={[styles.value, { color: getHealthColor(healthFactor) }]}>
                {healthFactor >= 999 ? '∞' : `${healthFactor.toFixed(0)}%`}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={[styles.valueHighlight, { color: getHealthColor(newHealthFactor) }]}>
                {newHealthFactor >= 999 ? '∞' : `${newHealthFactor.toFixed(0)}%`}
              </Text>
            </View>
          </View>

          {/* Liquidation Price */}
          <View style={styles.row}>
            <Text style={styles.label}>Liquidation Price</Text>
            <View style={styles.changeRow}>
              <Text style={[styles.value, { color: colors.semantic.error }]}>
                ${formatFiat(liquidationPrice)}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={[styles.valueHighlight, { color: colors.semantic.error }]}>
                ${formatFiat(newLiquidationPrice)}
              </Text>
            </View>
          </View>

        </View>

        {/* Fee Display */}
        <View style={styles.feeSection}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Network Fee</Text>
            <View style={styles.feeValues}>
              <View style={styles.feeAmountRow}>
                <Text style={styles.feeAmount}>{(estimatedFee / 100_000_000).toFixed(8)}</Text>
                <Icon name="btc_symbol" size={14} />
              </View>
              <Text style={styles.feeUsdText}>≈ ${formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
          <View style={[styles.feeRow, { marginTop: spacing.sm }]}>
            <Text style={styles.feeLabel}>Fee Rate</Text>
            <Text style={styles.feeAmount}>{selectedFeeRate} sat/vB</Text>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableScale
          style={styles.backButton}
          onPress={handleBack}
          disabled={isLoading || isAuthenticating}
        >
          <Text style={styles.backText}>Back</Text>
        </TouchableScale>

        <TouchableScale
          style={[styles.confirmButton, (isLoading || isAuthenticating) && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading || isAuthenticating}
          testID="vault-borrow-confirm-btn"
        >
          {isAuthenticating ? (
            <Ionicons name="finger-print" size={20} color={colors.text.white} />
          ) : (
            <Text style={styles.confirmText}>Confirm & Sign</Text>
          )}
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

function getHealthColor(health: number): string {
  if (health >= 200) return colors.semantic.success;
  if (health > 160) return '#fde37b'; // Moderate yellow
  return colors.semantic.error;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  borrowSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  borrowLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  borrowAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  borrowUsd: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  value: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  valueSecondary: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  valueHighlight: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feeSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  feeValues: {
    alignItems: 'flex-end',
  },
  feeAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feeAmount: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  feeUsdText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  errorContainer: {
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
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
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
