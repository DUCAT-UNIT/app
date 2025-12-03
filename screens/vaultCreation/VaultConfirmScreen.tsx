/**
 * VaultConfirmScreen - Review and confirm vault creation
 * Features: Summary display, biometric authentication before signing
 */

import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { HealthFactorGauge, VaultStepIndicator } from '../../components/vaultCreation';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useCreateVault } from '../../hooks/useCreateVault';
import { usePrice } from '../../stores/priceStore';
import { formatFiat } from '../../utils/formatters';
import { getOpCostOpen } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface VaultConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultConfirmScreen({ navigation }: VaultConfirmScreenProps) {
  const {
    btcAmount,
    unitAmount,
    selectedFeeRate,
    healthFactor,
    liquidationPrice,
    setCurrentStep,
    error,
  } = useVaultCreation();

  const { createVault, isLoading } = useCreateVault();
  const { btcPrice } = usePrice();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Calculate USD values
  const btcUsdValue = btcPrice ? btcAmount * btcPrice : 0;
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
          promptMessage: 'Authenticate to create vault',
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

      // Proceed with vault creation
      setIsAuthenticating(false);
      setCurrentStep('processing');
      navigation.navigate('VaultProcessing');

      const txid = await createVault();
      if (txid) {
        setCurrentStep('success');
        navigation.navigate('VaultSuccess', { txid });
      }
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', 'Failed to create vault. Please try again.');
    }
  }, [createVault, setCurrentStep, navigation]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    setCurrentStep('amounts');
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
          <Text style={styles.title}>Confirm Vault</Text>
        </View>

        <VaultStepIndicator currentStep={2} />

        {/* Health Factor Display */}
        <View style={styles.healthContainer}>
          <HealthFactorGauge healthFactor={healthFactor} size="lg" />
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Vault Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deposit</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmount}>{btcAmount.toFixed(8)} BTC</Text>
              <Text style={styles.summaryUsd}>≈ {formatFiat(btcUsdValue)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Borrow</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryAmount}>{unitAmount.toFixed(2)} UNIT</Text>
              <Text style={styles.summaryUsd}>≈ {formatFiat(unitAmount)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Health Factor</Text>
            <Text style={[styles.summaryAmount, { color: getHealthColor(healthFactor) }]}>
              {healthFactor}%
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Liquidation Price</Text>
            <Text style={styles.summaryAmount}>{formatFiat(liquidationPrice)}</Text>
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

        {/* Warning */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning-outline" size={20} color={colors.semantic.warning} />
          <Text style={styles.warningText}>
            Your vault may be liquidated if the health factor drops below 135%.
            Monitor your vault regularly.
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
  summaryUsd: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.xs,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.semantic.warning,
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
