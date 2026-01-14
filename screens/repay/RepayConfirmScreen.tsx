/**
 * RepayConfirmScreen - Review and confirm repay operation
 * Features: Summary display, biometric authentication before signing
 */

import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useRepay } from '../../stores/repayStore';
import { useRepayVault } from '../../hooks/useRepayVault';
import { usePrice } from '../../stores/priceStore';
import { formatFiat } from '../../utils/formatters';
import { getOpCostOpen } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface RepayConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayConfirmScreen({ navigation }: RepayConfirmScreenProps) {
  const {
    repayAmountUnit,
    currentUnitBorrowed,
    currentBtcLocked,
    selectedFeeRate,
    newHealthFactor,
    newLiquidationPrice,
    healthFactor,
    liquidationPrice,
    newDebt,
    setCurrentStep,
    error,
  } = useRepay();

  const { repay, isLoading } = useRepayVault();
  const { btcPrice } = usePrice();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Calculate values
  const repayUsdValue = repayAmountUnit; // UNIT is roughly pegged to USD
  const estimatedFee = getOpCostOpen(selectedFeeRate);
  const feeUsdValue = btcPrice ? (estimatedFee / 100_000_000) * btcPrice : 0;

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    try {
      setIsAuthenticating(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to repay UNIT',
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

      setIsAuthenticating(false);
      setCurrentStep('processing');
      navigation.navigate('RepayProcessing');

      const result = await repay();
      if (result) {
        setCurrentStep('success');
        navigation.navigate('RepaySuccess', { vaultTxid: result.vaultTxid });
      }
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', 'Failed to complete repayment. Please try again.');
    }
  }, [repay, setCurrentStep, navigation]);

  const handleBack = useCallback(() => {
    setCurrentStep('input');
    navigation.goBack();
  }, [setCurrentStep, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Repayment</Text>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Card - All info in one dense block */}
        <View style={styles.summaryCard}>
          {/* Repay Amount - Highlighted */}
          <View style={styles.repaySection}>
            <Text style={styles.repayLabel}>Repay Amount</Text>
            <Text style={styles.repayAmount}>-{Math.floor(repayAmountUnit)} UNIT</Text>
            <Text style={styles.repayUsd}>≈ ${formatFiat(repayUsdValue)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Debt */}
          <View style={styles.row}>
            <Text style={styles.label}>Current Debt</Text>
            <Text style={styles.value}>{currentUnitBorrowed.toFixed(0)} UNIT</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>New Debt</Text>
            <Text style={[styles.valueHighlight, newDebt === 0 && { color: colors.semantic.success }]}>
              {newDebt.toFixed(0)} UNIT
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Collateral */}
          <View style={styles.row}>
            <Text style={styles.label}>Collateral (unchanged)</Text>
            <Text style={styles.value}>{currentBtcLocked.toFixed(8)} BTC</Text>
          </View>

          <View style={styles.divider} />

          {/* Health Factor */}
          <View style={styles.row}>
            <Text style={styles.label}>Health Factor</Text>
            <View style={styles.changeRow}>
              <Text style={[styles.value, { color: getHealthColor(healthFactor) }]}>
                {healthFactor.toFixed(0)}%
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={[styles.valueHighlight, { color: getHealthColor(newDebt > 0 ? newHealthFactor : 999) }]}>
                {newDebt > 0 ? `${newHealthFactor.toFixed(0)}%` : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Liquidation Price - only show if there's remaining debt */}
          {newDebt > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Liquidation Price</Text>
              <View style={styles.changeRow}>
                <Text style={[styles.value, { color: colors.semantic.error }]}>
                  ${formatFiat(liquidationPrice, 0)}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
                <Text style={[styles.valueHighlight, { color: colors.semantic.success }]}>
                  ${formatFiat(newLiquidationPrice, 0)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Network Fee */}
          <View style={styles.row}>
            <Text style={styles.label}>Network Fee</Text>
            <View style={styles.feeContainer}>
              <Text style={styles.value}>~{estimatedFee} sats</Text>
              <Text style={styles.feeUsd}>≈ ${formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Repaying UNIT burns the tokens and reduces your debt, improving vault health.
          </Text>
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
  repaySection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  repayLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  repayAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.semantic.success,
  },
  repayUsd: {
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
  feeContainer: {
    alignItems: 'flex-end',
  },
  feeUsd: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.brand.primary,
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
