/**
 * VaultConfirmScreen - Review and confirm vault creation
 * Features: Summary display, biometric authentication before signing
 */

import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useVaultCreation, useVaultCreationStore } from '../../stores/vaultCreationStore';
import { useCreateVault } from '../../hooks/useCreateVault';
import { usePrice } from '../../stores/priceStore';
import { formatFiat } from '../../utils/formatters';
import { getOpCostOpen } from '../../utils/vaultUtils';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface VaultConfirmScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultConfirmScreen({ navigation }: VaultConfirmScreenProps) {
  // Use direct store subscription for reactive updates
  const btcAmount = useVaultCreationStore((state) => state.btcAmount);
  const unitAmount = useVaultCreationStore((state) => state.unitAmount);
  const selectedFeeRate = useVaultCreationStore((state) => state.selectedFeeRate);
  const error = useVaultCreationStore((state) => state.error);
  const setCurrentStep = useVaultCreationStore((state) => state.setCurrentStep);
  const getHealthFactor = useVaultCreationStore((state) => state.getHealthFactor);
  const getLiquidationPrice = useVaultCreationStore((state) => state.getLiquidationPrice);

  const healthFactor = getHealthFactor();
  const liquidationPrice = getLiquidationPrice();

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
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Vault</Text>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          {/* Deposit Amount - Highlighted */}
          <View style={styles.highlightSection}>
            <Text style={styles.highlightLabel}>BTC Deposit</Text>
            <Text style={styles.highlightAmount}>{btcAmount.toFixed(8)} BTC</Text>
            <Text style={styles.highlightUsd}>≈ ${formatFiat(btcUsdValue)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Borrow Amount */}
          <View style={styles.row}>
            <Text style={styles.label}>UNIT to Borrow</Text>
            <View style={styles.valueContainer}>
              <Text style={styles.valueHighlight}>{unitAmount.toFixed(2)} UNIT</Text>
              <Text style={styles.valueUsd}>≈ ${formatFiat(unitAmount)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Health Factor */}
          <View style={styles.row}>
            <Text style={styles.label}>Health Factor</Text>
            <Text style={[styles.valueHighlight, { color: getHealthColor(healthFactor) }]}>
              {unitAmount > 0 ? `${healthFactor}%` : '∞'}
            </Text>
          </View>

          {/* Liquidation Price */}
          <View style={styles.row}>
            <Text style={styles.label}>Liquidation Price</Text>
            <Text style={[styles.value, { color: liquidationPrice === Infinity ? colors.semantic.success : colors.semantic.error }]}>
              {liquidationPrice === Infinity ? 'None' : `$${formatFiat(liquidationPrice, 0)}`}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Network Fee */}
          <View style={styles.row}>
            <Text style={styles.label}>Network Fee</Text>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>~{estimatedFee} sats</Text>
              <Text style={styles.valueUsd}>≈ ${formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
        </View>

        {/* Warning - only show if there's debt */}
        {unitAmount > 0 && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color={colors.semantic.warning} />
            <Text style={styles.warningText}>
              Your vault may be liquidated if the health factor drops below 135%.
              Monitor your vault regularly.
            </Text>
          </View>
        )}

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
  highlightSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  highlightLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  highlightAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  highlightUsd: {
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
  valueContainer: {
    alignItems: 'flex-end',
  },
  valueUsd: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(230, 190, 80, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
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
