import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

interface OperationBusyIndicatorProps {
  label: string;
  compact?: boolean;
  testID?: string;
}

export default function OperationBusyIndicator({
  label,
  compact = false,
  testID,
}: OperationBusyIndicatorProps): React.ReactElement {
  return (
    <View style={[styles.container, compact && styles.compact]} testID={testID}>
      <ActivityIndicator color={colors.text.white} size={compact ? 'small' : 'small'} />
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compact: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text.white,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  compactLabel: {
    fontSize: fontSizes.sm,
  },
});
