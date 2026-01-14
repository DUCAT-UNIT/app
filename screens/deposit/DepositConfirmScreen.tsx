/**
 * DepositConfirmScreen - Review and confirm deposit operation
 * Features: Summary display, biometric authentication before signing
 */

import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import { VaultActionGauge, VaultChangesCard } from '../../components/vaultAction';
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
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Deposit</Text>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Gauge */}
        <VaultActionGauge
          currentHealth={healthFactor}
          newHealth={newHealthFactor}
          showTransition={true}
        />

        {/* Deposit Amount Card */}
        <View style={styles.depositCard}>
          <Text style={styles.depositLabel}>Depositing</Text>
          <Text style={styles.depositAmount}>+{formatBTC(depositAmountBtc)} BTC</Text>
          <Text style={styles.depositUsd}>≈ {formatFiat(depositUsdValue)}</Text>
        </View>

        {/* Vault Changes */}
        <View style={styles.section}>
          <VaultChangesCard
            currentCollateral={currentBtcLocked}
            currentDebt={currentUnitBorrowed}
            currentHealth={healthFactor}
            newCollateral={totalCollateral}
            newDebt={currentUnitBorrowed}
            newHealth={newHealthFactor}
            currentLiquidationPrice={liquidationPrice}
            newLiquidationPrice={newLiquidationPrice}
            showChanges={true}
          />
        </View>

        {/* Network Fee */}
        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>Network Fee</Text>
          <View style={styles.feeValue}>
            <Text style={styles.feeAmount}>~{estimatedFee} sats</Text>
            <Text style={styles.feeUsd}>≈ {formatFiat(feeUsdValue)}</Text>
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
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  depositCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  depositLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  depositAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  depositUsd: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
  },
  feeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  feeLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  feeValue: {
    alignItems: 'flex-end',
  },
  feeAmount: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  feeUsd: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
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
    padding: spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  confirmButton: {
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
