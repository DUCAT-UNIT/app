/**
 * WithdrawProcessingScreen - Shows withdraw operation progress
 * Features: 4-step progress tracker, animated indicators
 */

import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProcessingStepsList } from '../../components/vaultCreation';
import { useWithdraw } from '../../stores/withdrawStore';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

interface WithdrawProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function WithdrawProcessingScreen({ navigation }: WithdrawProcessingScreenProps) {
  const { processingStep, currentStep, error, vaultTxid } = useWithdraw();

  // Navigate to success screen when complete
  useEffect(() => {
    if (currentStep === 'success' && vaultTxid) {
      navigation.navigate('WithdrawSuccess', { vaultTxid });
    }
  }, [currentStep, vaultTxid, navigation]);

  // Navigate back to confirm if there's an error
  useEffect(() => {
    if (error && currentStep === 'confirm') {
      navigation.navigate('WithdrawConfirm');
    }
  }, [error, currentStep, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Withdrawing BTC</Text>
          <Text style={styles.subtitle}>
            Please wait while we process your withdrawal
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
            {getStatusMessage(processingStep)}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getStatusMessage(step: number): string {
  switch (step) {
    case 1:
      return 'Preparing transaction...';
    case 2:
      return 'Connecting to network...';
    case 3:
      return 'Validating withdrawal...';
    case 4:
      return 'Finalizing withdrawal...';
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
});
