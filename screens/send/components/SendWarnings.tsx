/**
 * SendWarnings Component
 * Warning messages for send flow validation issues
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing, radii } from '../../../styles/theme';

interface SendWarningsProps {
  /** Whether there's insufficient BTC for UNIT fees */
  insufficientBtcForFees: boolean;
  /** Whether amount exceeds available balance */
  exceedsBalance: boolean;
  /** Current amount (to show exceeds warning only when > 0) */
  currentAmount: number;
}

export function SendWarnings({
  insufficientBtcForFees,
  exceedsBalance,
  currentAmount,
}: SendWarningsProps): React.JSX.Element | null {
  if (!insufficientBtcForFees && !(exceedsBalance && currentAmount > 0)) {
    return null;
  }

  return (
    <>
      {insufficientBtcForFees && (
        <View
          style={styles.warning}
          accessibilityRole="alert"
          accessibilityLabel="Warning: You need BTC in your wallet to pay for transaction fees"
        >
          <Ionicons name="warning" size={20} color={colors.semantic.error} accessibilityElementsHidden />
          <Text style={styles.warningText} accessibilityElementsHidden>
            You need BTC in your wallet to pay for transaction fees
          </Text>
        </View>
      )}

      {exceedsBalance && currentAmount > 0 && (
        <View
          style={styles.warning}
          accessibilityRole="alert"
          accessibilityLabel="Warning: Amount exceeds available balance"
        >
          <Ionicons name="warning" size={20} color={colors.semantic.error} accessibilityElementsHidden />
          <Text style={styles.warningText} accessibilityElementsHidden>
            Amount exceeds available balance
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(208,76,104,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
});
