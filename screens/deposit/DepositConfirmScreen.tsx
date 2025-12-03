/**
 * DepositConfirmScreen - Review and confirm deposit operation
 * Features: Summary display, biometric authentication before signing
 */

import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { HealthFactorGauge } from '../../components/vaultCreation';
import { useDeposit } from '../../stores/depositStore';
import { useDepositVault } from '../../hooks/useDepositVault';
import { usePrice } from '../../stores/priceStore';
import { formatFiat, formatBTC } from '../../utils/formatters';
import { getOpCostOpen } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface DepositConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function DepositConfirmScreen({ navigation }: DepositConfirmScreenProps) {
  const {
    depositAmountBtc,
    depositAmountSats,
    currentUnitBorrowed,
    currentBtcLocked,
    selectedFeeRate,
    newHealthFactor,
    newLiquidationPrice,
    healthFactor,
    liquidationPrice,
    totalCollateral,
    setCurrentStep,
    error,
  } = useDeposit();

  const { deposit, isLoading } = useDepositVault();
  const { btcPrice } = usePrice();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Calculate values
  const depositUsdValue = btcPrice ? depositAmountBtc * btcPrice : 0;
  const estimatedFee = getOpCostOpen(selectedFeeRate);
  const feeUsdValue = btcPrice ? (estimatedFee / 100_000_000) * btcPrice : 0;

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    try {
      setIsAuthenticating(true);

      // Check if biometrics are available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        // Authenticate with biometrics
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to deposit BTC',
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

      // Proceed with deposit operation
      setIsAuthenticating(false);
      setCurrentStep('processing');
      navigation.navigate('DepositProcessing');

      const result = await deposit();
      if (result) {
        setCurrentStep('success');
        navigation.navigate('DepositSuccess', { vaultTxid: result.vaultTxid });
      }
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', 'Failed to complete deposit. Please try again.');
    }
  }, [deposit, setCurrentStep, navigation]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    setCurrentStep('input');
    navigation.goBack();
  }, [setCurrentStep, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableScale onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableScale>
          <Text style={styles.title}>Confirm Deposit</Text>
        </View>

        {/* Health Factor Display */}
        <View style={styles.healthContainer}>
          <HealthFactorGauge healthFactor={newHealthFactor} size="lg" />
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Deposit Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current Collateral</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmount}>{currentBtcLocked.toFixed(8)} BTC</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deposit Amount</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmountHighlight}>+{formatBTC(depositAmountBtc)} BTC</Text>
              <Text style={styles.summaryUsd}>≈ {formatFiat(depositUsdValue)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>New Total Collateral</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmount}>{totalCollateral.toFixed(8)} BTC</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Debt (unchanged)</Text>
            <Text style={styles.summaryAmount}>{currentUnitBorrowed.toFixed(2)} UNIT</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Health Factor</Text>
            <View style={styles.healthChange}>
              <Text style={[styles.summaryAmount, { color: getHealthColor(healthFactor) }]}>
                {healthFactor}%
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={[styles.summaryAmount, { color: getHealthColor(newHealthFactor) }]}>
                {newHealthFactor}%
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Liquidation Price</Text>
            <View style={styles.healthChange}>
              <Text style={styles.summaryAmount}>{formatFiat(liquidationPrice)}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <Text style={[styles.summaryAmount, { color: colors.semantic.success }]}>
                {formatFiat(newLiquidationPrice)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Network Fee</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmount}>~{estimatedFee} sats</Text>
              <Text style={styles.summaryUsd}>≈ {formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Depositing more BTC improves your vault health and lowers your liquidation risk.
          </Text>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableScale
          style={styles.cancelButton}
          onPress={handleBack}
          disabled={isLoading || isAuthenticating}
        >
          <Text style={styles.cancelText}>Back</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  healthContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  summaryValue: {
    alignItems: 'flex-end',
  },
  summaryAmount: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  summaryAmountHighlight: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  summaryUsd: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  healthChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.xs,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
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
