/**
 * HealthFactorGauge Component
 * Visual indicator for vault health factor
 */

import React from 'react';
import { StyleSheet,Text,View } from 'react-native';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { getHealthColor,getHealthStatus,type HealthStatus } from '../../utils/vaultUtils';

interface HealthFactorGaugeProps {
  healthFactor: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function HealthFactorGauge({
  healthFactor,
  showLabel = true,
  size = 'md',
}: HealthFactorGaugeProps) {
  const status = getHealthStatus(healthFactor);
  const color = getHealthColor(status);

  const gaugeSize = {
    sm: 60,
    md: 80,
    lg: 100,
  }[size];

  const fontSize = {
    sm: fontSizes.sm,
    md: fontSizes.lg,
    lg: fontSizes.xl,
  }[size];

  const labelSize = {
    sm: fontSizes.xs,
    md: fontSizes.sm,
    lg: fontSizes.md,
  }[size];

  return (
    <View style={styles.container}>
      <View style={[styles.gauge, { width: gaugeSize, height: gaugeSize }]}>
        {/* Background circle */}
        <View style={[styles.gaugeBackground, { borderColor: colors.border.default }]} />

        {/* Colored arc - simplified as a border */}
        <View
          style={[
            styles.gaugeProgress,
            {
              borderColor: color,
              borderWidth: size === 'sm' ? 3 : 4,
            },
          ]}
        />

        {/* Center content */}
        <View style={styles.gaugeContent}>
          <Text style={[styles.healthValue, { fontSize, color }]}>
            {healthFactor > 0 ? `${healthFactor}%` : '-'}
          </Text>
        </View>
      </View>

      {showLabel && (
        <Text style={[styles.label, { fontSize: labelSize }]}>
          {getStatusLabel(status)}
        </Text>
      )}
    </View>
  );
}

function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'At Risk';
    case 'danger':
      return 'Danger';
  }
}

interface HealthFactorBarProps {
  healthFactor: number;
  showValue?: boolean;
}

export function HealthFactorBar({ healthFactor, showValue = true }: HealthFactorBarProps) {
  const status = getHealthStatus(healthFactor);
  const color = getHealthColor(status);

  // Calculate bar width percentage (scale: 100-300%)
  const fillPercentage = Math.min(Math.max(((healthFactor - 100) / 200) * 100, 0), 100);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${fillPercentage}%`, backgroundColor: color }]} />
      </View>
      {showValue && (
        <Text style={[styles.barValue, { color }]}>
          {healthFactor > 0 ? `${healthFactor}%` : '-'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  gauge: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    borderWidth: 4,
  },
  gaugeProgress: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  gaugeContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthValue: {
    fontFamily: fonts.bold,
  },
  label: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontFamily: fonts.medium,
  },
  // Bar styles
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  barValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    minWidth: 50,
    textAlign: 'right',
  },
});
