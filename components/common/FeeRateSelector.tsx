/**
 * FeeRateSelector - Allows users to select transaction fee rate
 * Provides preset options (Economy/Standard/Priority) with sat/vB display
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

export interface FeeRateOption {
  label: string;
  rate: number;
  description: string;
}

const DEFAULT_FEE_OPTIONS: FeeRateOption[] = [
  { label: 'Economy', rate: 1, description: 'Slower' },
  { label: 'Standard', rate: 2, description: 'Normal' },
  { label: 'Priority', rate: 5, description: 'Faster' },
];

interface FeeRateSelectorProps {
  /** Currently selected fee rate in sat/vB */
  selectedRate: number;
  /** Callback when fee rate is changed */
  onRateChange: (rate: number) => void;
  /** Estimated fee in sats at current rate */
  estimatedFeeSats?: number;
  /** Optional custom fee options */
  feeOptions?: FeeRateOption[];
  /** Whether the selector is disabled */
  disabled?: boolean;
}

export function FeeRateSelector({
  selectedRate,
  onRateChange,
  estimatedFeeSats,
  feeOptions = DEFAULT_FEE_OPTIONS,
  disabled = false,
}: FeeRateSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Network Fee</Text>
        {estimatedFeeSats !== undefined && (
          <Text style={styles.estimate}>~{estimatedFeeSats.toLocaleString()} sats</Text>
        )}
      </View>

      <View style={styles.optionsRow}>
        {feeOptions.map((option) => {
          const isSelected = selectedRate === option.rate;
          return (
            <TouchableOpacity
              key={option.rate}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                disabled && styles.optionDisabled,
              ]}
              onPress={() => !disabled && onRateChange(option.rate)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionRate,
                  isSelected && styles.optionRateSelected,
                ]}
              >
                {option.rate} sat/vB
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  isSelected && styles.optionDescriptionSelected,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  estimate: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  optionSelected: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: colors.brand.primary,
  },
  optionRate: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  optionRateSelected: {
    color: colors.brand.primary,
  },
  optionDescription: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  optionDescriptionSelected: {
    color: colors.brand.primary,
  },
});

export default FeeRateSelector;
