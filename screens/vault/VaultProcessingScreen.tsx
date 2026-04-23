/**
 * VaultProcessingScreen - Generic processing screen for all vault operations
 * Features: 4-step progress tracker, animated indicators, background support
 */

import React,{ useCallback,useEffect,useRef,useState } from 'react';
import { AppState,AppStateStatus,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { ProcessingStepsList } from '../../components/vaultCreation';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../stores/notificationStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import type { ProcessingStep } from '../../stores/vaultCreationStore';
import { colors,fonts,fontSizes,spacing } from '../../styles/theme';
import { getVaultSettlementStatusMessage } from '../../services/vaultSettlementService';
import type { VaultProcessingScreenConfig,VaultScreenNavigationProp,VaultStoreState } from './types';

const STEP_DURATION_MS = 1000; // Minimum 1 second per step
const TOTAL_STEPS = 4;

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
  const { currentStep, error, vaultTxid: txid, reset } = store;
  const { isAuthenticated } = useAuth();
  const { kind: settlementKind, phase: settlementPhase } = useVaultSettlementStore();
  const appState = useRef(AppState.currentState);
  const hasShownError = useRef(false);

  // Visual step state - advances at minimum 1 second per step
  const [visualStep, setVisualStep] = useState(1);
  const visualStepRef = useRef(1);

  // Track if we can start animating (after FaceID delay)
  const [canAnimate, setCanAnimate] = useState(false);

  // Wait for FaceID/splash screen to complete before starting animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanAnimate(true);
    }, 2000); // 2 second delay for FaceID to complete

    return () => clearTimeout(timer);
  }, []);

  // Advance visual step every 1 second
  useEffect(() => {
    if (error) return; // Stop advancing on error
    if (!canAnimate) return; // Wait for FaceID delay
    if (visualStepRef.current > TOTAL_STEPS) return; // Already done

    const interval = setInterval(() => {
      if (visualStepRef.current <= TOTAL_STEPS) {
        visualStepRef.current += 1;
        setVisualStep(visualStepRef.current);
      }
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, [error, canAnimate]);

  const hasNavigatedToSuccess = useRef(false);

  const navigateToSuccess = useCallback(() => {
    if (hasNavigatedToSuccess.current) return;
    if (isAuthenticated && currentStep === 'success' && txid && visualStep > TOTAL_STEPS) {
      hasNavigatedToSuccess.current = true;
      navigation.navigate(config.routes.success, { vaultTxid: txid });
    }
  }, [isAuthenticated, currentStep, txid, visualStep, navigation, config.routes.success]);

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
    if (isAuthenticated && currentStep === 'success' && txid && visualStep > TOTAL_STEPS) {
      const timer = setTimeout(() => {
        navigateToSuccess();
      }, 500); // Small delay after showing all completed
      return () => clearTimeout(timer);
    }
  }, [currentStep, txid, isAuthenticated, visualStep, navigateToSuccess]);

  // Show error snackbar and navigate back when error occurs
  useEffect(() => {
    if (error && !hasShownError.current) {
      hasShownError.current = true;
      useNotificationStore.getState().showSnackbar({
        title: `${capitalize(config.operationType)} failed`,
        description: error,
        type: 'error',
      });
      // Navigate back to input screen after showing error
      setTimeout(() => {
        navigation.navigate(config.routes.input);
      }, 500);
    }
    if (!error) {
      hasShownError.current = false;
    }
  }, [error, config.operationType, navigation, config.routes.input]);

  // Handle cancel button press
  const handleCancel = () => {
    reset();
    navigation.navigate(config.routes.input);
  };

  const statusMessage =
    config.operationType === 'repay' && settlementKind === 'repay'
      ? getVaultSettlementStatusMessage(settlementKind, settlementPhase, visualStep)
      : config.getStatusMessage(visualStep);

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
            currentStep={visualStep as ProcessingStep}
            hasError={!!error}
            errorStep={error ? visualStep as ProcessingStep : undefined}
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

        {/* Cancel Button - only visible on error */}
        {error && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel and go back"
              accessibilityHint="Returns to the input screen to try again"
            >
              <Text style={styles.cancelButtonText} accessibilityElementsHidden>Cancel</Text>
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
  cancelButtonText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
});
