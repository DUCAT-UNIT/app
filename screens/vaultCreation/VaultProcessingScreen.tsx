/**
 * VaultProcessingScreen - Shows vault creation progress
 * Features: 4-step progress tracker, animated indicators
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProcessingStepsList } from '../../components/vaultCreation';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useIssuedUnitSettlement } from '../../hooks/vault/useIssuedUnitSettlement';
import { useNotificationStore } from '../../stores/notificationStore';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import { getVaultSettlementStatusMessage } from '../../services/vaultSettlementService';

interface VaultProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultProcessingScreen({ navigation }: VaultProcessingScreenProps) {
  const { processingStep, currentStep, error, txid, setCurrentStep } = useVaultCreation();
  const { settingsHandlers } = useSettingsHandlers();
  const { kind, phase, faceValueUsd, requestedPayoutAsset } = useVaultSettlementStore();
  const { settleIssuedUnitToUsdc, settleIssuedUnitToTurboUnit } = useIssuedUnitSettlement();
  const [isRetryingSettlement, setIsRetryingSettlement] = useState(false);
  const isSettlementRetryNeeded =
    !error &&
    kind === 'open' &&
    phase === 'needs_retry' &&
    requestedPayoutAsset !== 'UNIT' &&
    faceValueUsd > 0;

  // Navigate to success screen when complete
  useEffect(() => {
    if (currentStep === 'success' && txid) {
      navigation.navigate('VaultSuccess', { txid });
    }
  }, [currentStep, txid, navigation]);

  // Navigate back to confirm if there's an error
  useEffect(() => {
    if (error && currentStep === 'confirm') {
      navigation.navigate('VaultConfirm');
    }
  }, [error, currentStep, navigation]);

  const handleRetrySettlement = useCallback(async () => {
    if (isRetryingSettlement || kind !== 'open' || faceValueUsd <= 0) {
      return;
    }

    setIsRetryingSettlement(true);
    try {
      const settlement = requestedPayoutAsset === 'TURBOUNIT'
        ? await settleIssuedUnitToTurboUnit('open', faceValueUsd)
        : await settleIssuedUnitToUsdc('open', faceValueUsd);
      const canComplete =
        settlement.status === 'settled' ||
        (
          settlement.status === 'pending_settlement' &&
          (!!settlement.bridgeSendTxid || !!settlement.cashuMintSendTxid)
        );
      if (canComplete) {
        setCurrentStep('success');
      }
    } catch (retryError) {
      const message = retryError instanceof Error
        ? retryError.message
        : 'Unable to retry settlement';
      useNotificationStore.getState().showSnackbar({
        title: 'Settlement retry failed',
        description: message,
        type: 'error',
      });
    } finally {
      setIsRetryingSettlement(false);
    }
  }, [
    faceValueUsd,
    isRetryingSettlement,
    kind,
    requestedPayoutAsset,
    setCurrentStep,
    settleIssuedUnitToTurboUnit,
    settleIssuedUnitToUsdc,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="vault-create-processing-screen">
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Creating Vault</Text>
          <Text style={styles.subtitle}>
            Please wait while we process your vault creation
          </Text>
        </View>

        {/* Processing Steps */}
        <View style={styles.stepsContainer}>
          <ProcessingStepsList
            currentStep={processingStep}
            hasError={!!error}
            errorStep={error ? processingStep : undefined}
          />
        </View>

        {/* Status Message */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {getVaultSettlementStatusMessage(kind, phase, processingStep, settingsHandlers.usdcFeaturesEnabled)}
          </Text>
        </View>

        {isSettlementRetryNeeded && (
          <TouchableOpacity
            style={[
              styles.backButton,
              isRetryingSettlement && styles.disabledButton,
            ]}
            onPress={handleRetrySettlement}
            disabled={isRetryingSettlement}
            accessibilityRole="button"
            accessibilityLabel="Retry settlement"
            accessibilityHint="Retries settlement without creating another vault"
          >
            <Text style={styles.backButtonText}>
              {isRetryingSettlement ? 'Retrying...' : 'Retry settlement'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  stepsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statusText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  backButton: {
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  disabledButton: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
});
