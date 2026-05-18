/**
 * TurboToggle Component
 * Toggle switch for enabling Turbo UNIT transactions
 */

import React from 'react';
import { Pressable, View, Text, Switch, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing, radii } from '../../../styles/theme';

interface TurboToggleProps {
  /** Whether turbo mode is enabled */
  enabled: boolean;
  /** Called when toggle changes */
  onToggle: (enabled: boolean) => void;
  label?: string;
  description?: string;
}

export function TurboToggle({
  enabled,
  onToggle,
  label = 'Turbo UNIT',
  description = 'Instant transaction',
}: TurboToggleProps): React.JSX.Element {
  const handlePress = (): void => {
    onToggle(!enabled);
  };

  return (
    <View style={styles.turboSection}>
      <Pressable
        testID="send-turbo-toggle"
        style={styles.turboRow}
        onPress={handlePress}
        accessibilityLabel={`Enable ${label}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
      >
        <View style={styles.turboLabelContainer}>
          <Text style={styles.turboLabel}>{label}</Text>
          <Text style={styles.turboDescription}>{description}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          pointerEvents="none"
          trackColor={{ false: colors.bg.tertiary, true: colors.brand.primary }}
          thumbColor={colors.text.white}
          testID="send-turbo-toggle-switch"
          accessibilityLabel={`Enable ${label}`}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
        />
      </Pressable>
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
