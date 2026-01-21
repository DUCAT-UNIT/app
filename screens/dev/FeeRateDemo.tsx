/**
 * FeeRateDemo - Demo screen to compare fee selector variants
 * Access via dev menu or navigation
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeeRateSelector } from '../../components/common/FeeRateSelector';
import {
  FeeRateSegmented,
  FeeRateDropdown,
  FeeRateCompactButtons,
} from '../../components/common/FeeRateSelectorCompact';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

export default function FeeRateDemo() {
  const [rate1, setRate1] = useState(2);
  const [rate2, setRate2] = useState(2);
  const [rate3, setRate3] = useState(2);
  const [rate4, setRate4] = useState(2);

  const estimatedFee = 1234;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Fee Selector Options</Text>
        <Text style={styles.subtitle}>Compare the different styles below</Text>

        {/* Current (Original) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current (Original)</Text>
          <Text style={styles.sectionDesc}>3 tall boxes with label, rate, and description</Text>
          <View style={styles.card}>
            <FeeRateSelector
              selectedRate={rate1}
              onRateChange={setRate1}
              estimatedFeeSats={estimatedFee}
            />
          </View>
        </View>

        {/* Option 1: Segmented */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Option 1: Segmented Control</Text>
          <Text style={styles.sectionDesc}>Pill-style single row, minimal vertical space</Text>
          <View style={styles.card}>
            <FeeRateSegmented
              selectedRate={rate2}
              onRateChange={setRate2}
              estimatedFeeSats={estimatedFee}
            />
          </View>
        </View>

        {/* Option 2: Dropdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Option 2: Expandable Dropdown</Text>
          <Text style={styles.sectionDesc}>Collapsed by default, tap to expand options</Text>
          <View style={styles.card}>
            <FeeRateDropdown
              selectedRate={rate3}
              onRateChange={setRate3}
              estimatedFeeSats={estimatedFee}
            />
          </View>
        </View>

        {/* Option 3: Compact Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Option 3: Compact Buttons</Text>
          <Text style={styles.sectionDesc}>Smaller buttons with just label and rate number</Text>
          <View style={styles.card}>
            <FeeRateCompactButtons
              selectedRate={rate4}
              onRateChange={setRate4}
              estimatedFeeSats={estimatedFee}
            />
          </View>
        </View>

        {/* Option 4 note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Option 4: Move to Confirmation</Text>
          <Text style={styles.sectionDesc}>
            Remove from input screen entirely, show on confirmation screen instead.
            This keeps the input screen clean and focused on the amount.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
