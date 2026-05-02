/**
 * VaultProcessingScreen - Generic processing screen for all vault operations
 * Features: 4-step progress tracker driven by real operation state, background support
 */

import React,{ useCallback,useEffect,useRef,useState } from 'react';
import { AppState,AppStateStatus,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { ProcessingStepsList } from '../../components/vaultCreation';
import { useAuthSession } from '../../contexts/AuthContext';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useIssuedUnitSettlement } from '../../hooks/vault/useIssuedUnitSettlement';
import { useNotificationStore } from '../../stores/notificationStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import type { ProcessingStep } from '../../stores/vaultCreationStore';
import { colors,fonts,fontSizes,spacing } from '../../styles/theme';
import { getVaultSettlementStatusMessage } from '../../services/vaultSettlementService';
import type { VaultProcessingScreenConfig,VaultScreenNavigationProp,VaultStoreState } from './types';

interface VaultProcessingScreenProps {
  navigation: VaultScreenNavigationProp;
  config: VaultProcessingScreenConfig;
  store: VaultStoreState;
}

export default function VaultProcessingScreen({
  navigation,
  config,
  store,
}: VaultProcessingScreenProps) {
  const { currentStep, processingStep, error, vaultTxid: txid, reset } = store;
  const { isAuthenticated } = useAuthSession();
  const { settingsHandlers } = useSettingsHandlers();
  const {
    kind: settlementKind,
    phase: settlementPhase,
    faceValueUsd: settlementFaceValueUsd,
  } = useVaultSettlementStore();
  const { settleIssuedUnitToUsdc } = useIssuedUnitSettlement();
  const appState = useRef(AppState.currentState);
  const hasShownError = useRef(false);
  const [isRetryingSettlement, setIsRetryingSettlement] = useState(false);
  const realStep = Math.max(1, Math.min(4, processingStep || 1)) as ProcessingStep;

  const hasNavigatedToSuccess = useRef(false);

  const navigateToSuccess = useCallback(() => {
    if (hasNavigatedToSuccess.current) return;
    if (isAuthenticated && currentStep === 'success' && txid) {
      hasNavigatedToSuccess.current = true;
      navigation.navigate(config.routes.success, { vaultTxid: txid });
    }
  }, [isAuthenticated, currentStep, txid, navigation, config.routes.success]);

  // Keep the operation running when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App is coming back to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        navigateToSuccess();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [navigateToSuccess]);

  // Navigate to success screen when complete
  useEffect(() => {
    if (isAuthenticated && currentStep === 'success' && txid) {
      navigateToSuccess();
    }
  }, [currentStep, txid, isAuthenticated, navigateToSuccess]);

  // Show error snackbar and navigate back when error occurs
  useEffect(() => {
    let navigateBackTimer: ReturnType<typeof setTimeout> | null = null;

    if (error && !hasShownError.current) {
      hasShownError.current = true;
      useNotificationStore.getState().showSnackbar({
        title: `${capitalize(config.operationType)} failed`,
        description: error,
        type: 'error',
      });
      // Navigate back to input screen after showing error
      navigateBackTimer = setTimeout(() => {
        navigation.navigate(config.routes.input);
      }, 500);
      (navigateBackTimer as { unref?: () => void }).unref?.();
    }
    if (!error) {
      hasShownError.current = false;
    }

    return () => {
      if (navigateBackTimer) {
        clearTimeout(navigateBackTimer);
      }
    };
  }, [error, config.operationType, navigation, config.routes.input]);

  // Handle cancel button press
  const handleCancel = () => {
    reset();
    navigation.navigate(config.routes.input);
  };

  const handleRetrySettlement = useCallback(async () => {
    if (
      isRetryingSettlement ||
      settlementKind !== 'borrow' ||
      settlementFaceValueUsd <= 0
    ) {
      return;
    }

    setIsRetryingSettlement(true);
    try {
      const settlement = await settleIssuedUnitToUsdc('borrow', settlementFaceValueUsd);
      const canComplete =
        settlement.status === 'settled' ||
        (settlement.status === 'pending_settlement' && !!settlement.bridgeSendTxid);
      if (canComplete) {
        store.setCurrentStep('success');
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
    isRetryingSettlement,
    settlementKind,
    settlementFaceValueUsd,
    settleIssuedUnitToUsdc,
    store,
  ]);

  const statusMessage =
    settlementKind === config.operationType
      ? getVaultSettlementStatusMessage(settlementKind, settlementPhase, realStep, settingsHandlers.usdcFeaturesEnabled)
      : config.getStatusMessage(realStep);
  const isSettlementRetryNeeded =
    !error &&
    settlementPhase === 'needs_retry' &&
    settlementKind === 'borrow' &&
    config.operationType === 'borrow' &&
    settlementFaceValueUsd > 0;
  const showActionButton = !!error || isSettlementRetryNeeded;
  const actionLabel = error
    ? 'Cancel'
    : isRetryingSettlement
      ? 'Retrying...'
      : 'Retry settlement';

  return (
    <View style={styles.container} testID={`vault-${config.operationType}-processing-screen`}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
          <Text style={styles.subtitle}>
            {error ? config.errorSubtitle : config.subtitle}
          </Text>
        </View>

        {/* Processing Steps */}
        <View style={styles.stepsContainer}>
          <ProcessingStepsList
            currentStep={realStep}
            hasError={!!error}
            errorStep={error ? realStep : undefined}
          />
        </View>

        {/* Status Message or Error */}
        <View
          style={styles.statusContainer}
          accessibilityRole={error ? "alert" : undefined}
          accessibilityLiveRegion="polite"
        >
          {error ? (
            <Text style={styles.errorText} accessibilityLabel={`Error: ${error}`}>{error}</Text>
          ) : (
            <Text style={styles.statusText}>
              {statusMessage}
            </Text>
          )}
        </View>

        {/* Action button - visible on hard errors or settlement retry states */}
        {showActionButton && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                isRetryingSettlement && styles.disabledButton,
              ]}
              onPress={error ? handleCancel : handleRetrySettlement}
              disabled={isRetryingSettlement}
              accessibilityRole="button"
              accessibilityLabel={error ? 'Cancel and go back' : 'Retry settlement'}
              accessibilityHint={
                error
                  ? 'Returns to the input screen to try again'
                  : 'Retries USDC settlement without creating another borrow'
              }
            >
              <Text style={styles.cancelButtonText} accessibilityElementsHidden>
                {actionLabel}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: 60, // Account for status bar
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
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
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.semantic.error,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonContainer: {
    paddingBottom: spacing.xxl,
  },
  cancelButton: {
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
});
