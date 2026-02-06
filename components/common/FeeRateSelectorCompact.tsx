/**
 * FeeRateSelectorCompact - Multiple compact variants for fee selection
 * Option 1: Segmented control (pill style)
 * Option 2: Dropdown/expandable
 * Option 3: Compact horizontal buttons
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  selectedRate: number;
  onRateChange: (rate: number) => void;
  estimatedFeeSats?: number;
  feeOptions?: FeeRateOption[];
  disabled?: boolean;
  /** Use transparent background (for embedding inside other cards) */
  transparent?: boolean;
}

/**
 * Option 1: Segmented Control - Pill style single row
 */
export function FeeRateSegmented({
  selectedRate,
  onRateChange,
  estimatedFeeSats,
  feeOptions = DEFAULT_FEE_OPTIONS,
  disabled = false,
}: FeeRateSelectorProps) {
  return (
    <View style={segmentedStyles.container}>
      <View style={segmentedStyles.header}>
        <Text style={segmentedStyles.label}>Network Fee</Text>
        {estimatedFeeSats !== undefined && (
          <Text style={segmentedStyles.estimate}>~{estimatedFeeSats.toLocaleString()} sats</Text>
        )}
      </View>
      <View style={segmentedStyles.pillContainer}>
        {feeOptions.map((option, index) => {
          const isSelected = selectedRate === option.rate;
          const isFirst = index === 0;
          const isLast = index === feeOptions.length - 1;
          return (
            <TouchableOpacity
              key={option.rate}
              style={[
                segmentedStyles.segment,
                isSelected && segmentedStyles.segmentSelected,
                isFirst && segmentedStyles.segmentFirst,
                isLast && segmentedStyles.segmentLast,
                disabled && segmentedStyles.segmentDisabled,
              ]}
              onPress={() => !disabled && onRateChange(option.rate)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} fee rate, ${option.rate} satoshi per virtual byte`}
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityHint={`Select ${option.label.toLowerCase()} fee rate`}
            >
              <Text
                style={[
                  segmentedStyles.segmentText,
                  isSelected && segmentedStyles.segmentTextSelected,
                ]}
                accessibilityElementsHidden
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const segmentedStyles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  estimate: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md - 2,
  },
  segmentSelected: {
    backgroundColor: colors.brand.primary,
  },
  segmentFirst: {},
  segmentLast: {},
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  segmentTextSelected: {
    color: colors.text.white,
    fontFamily: fonts.bold,
  },
});

/**
 * Option 2: Expandable/Dropdown style
 */
export function FeeRateDropdown({
  selectedRate,
  onRateChange,
  estimatedFeeSats,
  feeOptions = DEFAULT_FEE_OPTIONS,
  disabled = false,
  transparent = false,
}: FeeRateSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedOption = feeOptions.find(o => o.rate === selectedRate) || feeOptions[1];

  return (
    <View style={[dropdownStyles.container, transparent && dropdownStyles.containerTransparent]}>
      <TouchableOpacity
        style={[
          dropdownStyles.header,
          transparent && dropdownStyles.headerTransparent,
          disabled && dropdownStyles.headerDisabled,
        ]}
        onPress={() => !disabled && setExpanded(!expanded)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Network fee: ${selectedOption.label}, ${selectedOption.rate} satoshi per virtual byte${estimatedFeeSats !== undefined ? `, estimated ${estimatedFeeSats.toLocaleString()} satoshis` : ''}`}
        accessibilityHint={expanded ? "Collapse fee options" : "Expand to select fee rate"}
        accessibilityState={{ expanded, disabled }}
      >
        <View style={dropdownStyles.headerLeft} accessibilityElementsHidden>
          <Text style={dropdownStyles.label}>Network Fee</Text>
          <Text style={dropdownStyles.selectedLabel}>
            {selectedOption.label} ({selectedOption.rate} sat/vB)
          </Text>
        </View>
        <View style={dropdownStyles.headerRight} accessibilityElementsHidden>
          {estimatedFeeSats !== undefined && (
            <Text style={dropdownStyles.estimate}>~{estimatedFeeSats.toLocaleString()} sats</Text>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.text.secondary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={dropdownStyles.optionsContainer}>
          {feeOptions.map((option) => {
            const isSelected = selectedRate === option.rate;
            return (
              <TouchableOpacity
                key={option.rate}
                style={[
                  dropdownStyles.option,
                  isSelected && dropdownStyles.optionSelected,
                ]}
                onPress={() => {
                  onRateChange(option.rate);
                  setExpanded(false);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} fee rate, ${option.description}, ${option.rate} satoshi per virtual byte`}
                accessibilityState={{ selected: isSelected }}
              >
                <View accessibilityElementsHidden>
                  <Text style={[dropdownStyles.optionLabel, isSelected && dropdownStyles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={dropdownStyles.optionDesc}>{option.description}</Text>
                </View>
                <Text style={[dropdownStyles.optionRate, isSelected && dropdownStyles.optionRateSelected]} accessibilityElementsHidden>
                  {option.rate} sat/vB
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const dropdownStyles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  containerTransparent: {
    marginVertical: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  headerTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    paddingVertical: spacing.xs,
  },
  headerDisabled: {
    opacity: 0.5,
  },
  headerLeft: {
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
  },
  selectedLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  estimate: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  optionsContainer: {
    marginTop: spacing.xs,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  optionSelected: {
    backgroundColor: colors.brand.primary + '15',
  },
  optionLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: colors.brand.primary,
  },
  optionDesc: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  optionRate: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  optionRateSelected: {
    color: colors.brand.primary,
  },
});

/**
 * Option 3: Compact Horizontal Buttons - minimal with just label and rate
 */
export function FeeRateCompactButtons({
  selectedRate,
  onRateChange,
  estimatedFeeSats,
  feeOptions = DEFAULT_FEE_OPTIONS,
  disabled = false,
}: FeeRateSelectorProps) {
  return (
    <View style={compactStyles.container}>
      <View style={compactStyles.header}>
        <Text style={compactStyles.label}>Network Fee</Text>
        {estimatedFeeSats !== undefined && (
          <Text style={compactStyles.estimate}>~{estimatedFeeSats.toLocaleString()} sats</Text>
        )}
      </View>
      <View style={compactStyles.buttonsRow}>
        {feeOptions.map((option) => {
          const isSelected = selectedRate === option.rate;
          return (
            <TouchableOpacity
              key={option.rate}
              style={[
                compactStyles.button,
                isSelected && compactStyles.buttonSelected,
                disabled && compactStyles.buttonDisabled,
              ]}
              onPress={() => !disabled && onRateChange(option.rate)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} fee rate, ${option.rate} satoshi per virtual byte`}
              accessibilityState={{ selected: isSelected, disabled }}
            >
              <Text
                style={[
                  compactStyles.buttonText,
                  isSelected && compactStyles.buttonTextSelected,
                ]}
                accessibilityElementsHidden
              >
                {option.label} ({option.rate})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const compactStyles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  estimate: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  button: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonSelected: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  buttonTextSelected: {
    color: colors.brand.primary,
    fontFamily: fonts.bold,
  },
});

export default {
  Segmented: FeeRateSegmented,
  Dropdown: FeeRateDropdown,
  CompactButtons: FeeRateCompactButtons,
};
