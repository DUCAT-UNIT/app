/**
 * TurboToggle Component
 * Toggle switch for enabling Turbo UNIT transactions
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing, radii } from '../../../styles/theme';

interface TurboToggleProps {
  /** Whether turbo mode is enabled */
  enabled: boolean;
  /** Called when toggle changes */
  onToggle: (enabled: boolean) => void;
}

export function TurboToggle({
  enabled,
  onToggle,
}: TurboToggleProps): React.JSX.Element {
  return (
    <View style={styles.turboSection}>
      <View style={styles.turboRow}>
        <View style={styles.turboLabelContainer}>
          <Text style={styles.turboLabel}>⚡ Turbo UNIT</Text>
          <Text style={styles.turboDescription}>Instant transaction</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.bg.tertiary, true: colors.brand.primary }}
          thumbColor={colors.text.white}
          accessibilityLabel="Enable Turbo UNIT"
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  turboSection: {
    marginTop: spacing.lg,
  },
  turboRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  turboLabelContainer: {
    flex: 1,
  },
  turboLabel: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  turboDescription: {
    color: colors.text.tertiary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
});
