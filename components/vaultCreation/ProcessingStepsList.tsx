/**
 * ProcessingStepsList Component
 * Shows the 4-step progress during vault creation
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';
import type { ProcessingStep } from '../../stores/vaultCreationStore';

interface ProcessingStepsListProps {
  currentStep: ProcessingStep;
  hasError?: boolean;
  errorStep?: ProcessingStep;
}

interface StepConfig {
  title: string;
  description: string;
}

const STEPS: Record<ProcessingStep, StepConfig> = {
  1: {
    title: 'Awaiting user signatures',
    description: 'Approval for deposit and borrow',
  },
  2: {
    title: 'Request received by node',
    description: 'Initiating transaction process',
  },
  3: {
    title: 'Validation in progress',
    description: 'Confirming transaction details',
  },
  4: {
    title: 'Network approvals',
    description: 'Gathering necessary approvals',
  },
};

export function ProcessingStepsList({
  currentStep,
  hasError = false,
  errorStep,
}: ProcessingStepsListProps) {
  return (
    <View style={styles.container}>
      {([1, 2, 3, 4] as ProcessingStep[]).map((step, index) => (
        <ProcessingStepItem
          key={step}
          step={step}
          currentStep={currentStep}
          config={STEPS[step]}
          isError={hasError && errorStep === step}
          isLast={index === 3}
        />
      ))}
    </View>
  );
}

interface ProcessingStepItemProps {
  step: ProcessingStep;
  currentStep: ProcessingStep;
  config: StepConfig;
  isError: boolean;
  isLast: boolean;
}

function ProcessingStepItem({
  step,
  currentStep,
  config,
  isError,
  isLast,
}: ProcessingStepItemProps) {
  const isCompleted = step < currentStep && !isError;
  const isCurrent = step === currentStep;
  const isPending = step > currentStep;

  const getIconContent = () => {
    if (isError) {
      return (
        <View style={[styles.iconContainer, styles.iconError]}>
          <Ionicons name="close" size={16} color={colors.semantic.error} />
        </View>
      );
    }

    if (isCompleted) {
      return (
        <View style={[styles.iconContainer, styles.iconCompleted]}>
          <Ionicons name="checkmark" size={16} color={colors.semantic.success} />
        </View>
      );
    }

    if (isCurrent) {
      return (
        <View style={[styles.iconContainer, styles.iconCurrent]}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
        </View>
      );
    }

    return (
      <View style={[styles.iconContainer, styles.iconPending]}>
        <Text style={styles.stepNumber}>{step}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.stepItem, isLast && styles.stepItemLast]}>
      {getIconContent()}

      <View style={styles.stepContent}>
        <Text
          style={[
            styles.stepTitle,
            isCompleted && styles.stepTitleCompleted,
            isCurrent && styles.stepTitleCurrent,
            isPending && styles.stepTitlePending,
            isError && styles.stepTitleError,
          ]}
        >
          {config.title}
        </Text>
        <Text
          style={[
            styles.stepDescription,
            (isCompleted || isPending) && styles.stepDescriptionFaded,
          ]}
        >
          {config.description}
        </Text>
      </View>

      {!isLast && <View style={styles.connector} />}
    </View>
  );
}

interface VaultStepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  totalSteps?: number;
}

export function VaultStepIndicator({
  currentStep,
  totalSteps = 4,
}: VaultStepIndicatorProps) {
  return (
    <View style={styles.indicatorContainer}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <View key={step} style={styles.indicatorRow}>
          <View
            style={[
              styles.dot,
              step < currentStep && styles.dotCompleted,
              step === currentStep && styles.dotCurrent,
              step > currentStep && styles.dotPending,
            ]}
          />
          {step < totalSteps && (
            <View
              style={[
                styles.line,
                step < currentStep && styles.lineCompleted,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  stepItemLast: {
    flex: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  iconCompleted: {
    backgroundColor: 'rgba(89, 170, 138, 0.15)',
  },
  iconCurrent: {
    backgroundColor: 'rgba(24, 88, 228, 0.15)',
  },
  iconPending: {
    backgroundColor: colors.bg.tertiary,
  },
  iconError: {
    backgroundColor: 'rgba(208, 76, 104, 0.15)',
  },
  stepNumber: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
  },
  stepContent: {
    flex: 1,
    paddingTop: 6,
  },
  stepTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepTitleCompleted: {
    color: colors.semantic.success,
  },
  stepTitleCurrent: {
    color: colors.brand.primary,
  },
  stepTitlePending: {
    color: colors.text.tertiary,
  },
  stepTitleError: {
    color: colors.semantic.error,
  },
  stepDescription: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  stepDescriptionFaded: {
    color: colors.text.tertiary,
  },
  connector: {
    position: 'absolute',
    left: 23,
    top: 52,
    bottom: 4,
    width: 2,
    backgroundColor: colors.border.default,
  },
  // Step indicator styles
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
  },
  dotCompleted: {
    backgroundColor: colors.semantic.success,
  },
  dotCurrent: {
    backgroundColor: colors.brand.primary,
  },
  dotPending: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: colors.bg.tertiary,
  },
  lineCompleted: {
    backgroundColor: colors.semantic.success,
  },
});
