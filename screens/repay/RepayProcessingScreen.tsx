/**
 * RepayProcessingScreen - Shows repay operation progress
 * Features: 4-step progress tracker, animated indicators, background support
 *
 * @deprecated Use RepayProcessingScreenNew from screens/vault/screens instead.
 * This screen will be removed in a future release.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { ProcessingStepsList } from '../../components/vaultCreation';
import { useRepay } from '../../stores/repayStore';
import type { ProcessingStep } from '../../stores/vaultCreationStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import { useRepayVault } from '../../hooks/useRepayVault';
import { logger } from '../../utils/logger';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

const STEP_DURATION_MS = 1000; // Minimum 1 second per step
const TOTAL_STEPS = 4;

interface RepayProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function RepayProcessingScreen({ navigation }: RepayProcessingScreenProps) {
  const { processingStep, currentStep, error, vaultTxid, reset, setCurrentStep } = useRepay();
  const { repay } = useRepayVault();
  const { isAuthenticated } = useAuth();
  const appState = useRef(AppState.currentState);
  const hasShownError = useRef(false);
  const operationStarted = useRef(false);

  // Visual step state - advances at minimum 1 second per step
  const [visualStep, setVisualStep] = useState(1);
  const visualStepRef = useRef(1);

  // Track if we can start animating (after FaceID delay)
  const [canAnimate, setCanAnimate] = useState(false);

  // Execute repay operation when screen mounts
  useEffect(() => {
    if (operationStarted.current) return;
    operationStarted.current = true;

    logger.debug('[RepayProcessing] Starting repay operation...');
    repay().then((result) => {
      if (result) {
        logger.debug('[RepayProcessing] Repay succeeded:', { vaultTxid: result.vaultTxid });
        setCurrentStep('success');
      } else {
        logger.error('[RepayProcessing] Repay returned null');
      }
    }).catch((err) => {
      logger.error('[RepayProcessing] Repay error:', { error: err });
    });
  }, []);

  // Wait for FaceID/splash screen to complete before starting animation
  // Use a delay since FaceID doesn't reliably trigger app state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanAnimate(true);
    }, 2000); // 2 second delay for FaceID to complete

    return () => clearTimeout(timer);
  }, []);

  // Advance visual step every 1 second
  // visualStep goes to TOTAL_STEPS + 1 to show all steps as completed before navigating
  // Only start advancing after FaceID delay
  useEffect(() => {
    if (error) return; // Stop advancing on error
    if (!canAnimate) return; // Wait for FaceID delay
    if (visualStepRef.current > TOTAL_STEPS) return; // Already done

    const interval = setInterval(() => {
      // Always advance one step at a time, up to TOTAL_STEPS + 1
      if (visualStepRef.current <= TOTAL_STEPS) {
        visualStepRef.current += 1;
        setVisualStep(visualStepRef.current);
      }
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, [error, canAnimate]);

  // Keep the operation running when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App is coming back to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Check if operation completed while in background and user is authenticated
        if (isAuthenticated && currentStep === 'success' && vaultTxid && visualStep > TOTAL_STEPS) {
          navigation.navigate('RepaySuccess', { vaultTxid });
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentStep, vaultTxid, navigation, isAuthenticated, visualStep]);

  // Navigate to success screen when complete - only if authenticated AND all steps shown completed
  useEffect(() => {
    // visualStep > TOTAL_STEPS means step 4 has been shown as completed for 1 second
    if (isAuthenticated && currentStep === 'success' && vaultTxid && visualStep > TOTAL_STEPS) {
      const timer = setTimeout(() => {
        navigation.navigate('RepaySuccess', { vaultTxid });
      }, 500); // Small delay after showing all completed
      return () => clearTimeout(timer);
    }
  }, [currentStep, vaultTxid, navigation, isAuthenticated, visualStep]);

  // Show error snackbar when error occurs
  useEffect(() => {
    if (error && !hasShownError.current) {
      hasShownError.current = true;
      useNotificationStore.getState().showSnackbar({
        title: 'Repayment failed',
        description: error,
        type: 'error',
      });
    }
    // Reset error flag when error is cleared
    if (!error) {
      hasShownError.current = false;
    }
  }, [error]);

  // Handle cancel button press
  const handleCancel = () => {
    reset();
    navigation.navigate('RepayInput');
  };

  return (
    <View style={styles.container} testID="vault-repay-processing-screen">
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Repaying UNIT</Text>
          <Text style={styles.subtitle}>
            {error ? 'An error occurred' : 'Please wait while we process your repayment'}
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
        <View style={styles.statusContainer}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.statusText}>
              {getStatusMessage(visualStep)}
            </Text>
          )}
        </View>

        {/* Cancel Button - only visible on error */}
        {error && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function getStatusMessage(step: number): string {
  switch (step) {
    case 1:
      return 'Preparing transaction...';
    case 2:
      return 'Connecting to network...';
    case 3:
      return 'Burning UNIT tokens...';
    case 4:
      return 'Finalizing repayment...';
    default:
      return 'Processing...';
  }
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
