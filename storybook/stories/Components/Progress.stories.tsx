import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.8 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.9 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.0 },
];

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

/**
 * Progress bar showing token distribution (matching VaultHealthGauge capacity bar)
 */
interface ProgressBarProps {
  mintedAmount: number;
  availableAmount: number;
  scale?: number;
  deviceSize?: DeviceSize;
}

const ProgressBar = ({ mintedAmount, availableAmount, scale = 1 }: ProgressBarProps) => {
  const total = mintedAmount + availableAmount;
  const mintedPercentage = total > 0 ? (mintedAmount / total) * 100 : 0;

  const formatAmount = (value: number): string => {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const labelFontSize = 11 * scale;
  const valueFontSize = 14 * scale;
  const iconSize = 12 * scale;

  return (
    <View style={styles.capacitySection}>
      <View style={styles.capacityLabelsRow}>
        <View style={styles.capacityLabelGroup}>
          <Text style={[styles.capacityLabel, { fontSize: labelFontSize }]}>Minted</Text>
          <View style={styles.capacityValueRow}>
            <Icon name="unit_symbol" size={iconSize} color={COLORS.PRIMARY_BLUE} style={styles.capacityIcon} />
            <Text style={[styles.capacityValue, { color: COLORS.PRIMARY_BLUE, fontSize: valueFontSize }]}>
              {formatAmount(mintedAmount)}
            </Text>
          </View>
        </View>
        <View style={[styles.capacityLabelGroup, styles.capacityRightAlign]}>
          <Text style={[styles.capacityLabel, { fontSize: labelFontSize }]}>Available</Text>
          <View style={styles.capacityValueRow}>
            <Icon name="unit_symbol" size={iconSize} color={COLORS.SECONDARY_TEXT} style={styles.capacityIcon} />
            <Text style={[styles.capacityValue, { color: COLORS.SECONDARY_TEXT, fontSize: valueFontSize }]}>
              {formatAmount(availableAmount)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${mintedPercentage}%` }]} />
        </View>
      </View>
    </View>
  );
};

const meta: Meta = {
  title: 'Components/Progress',
};

export default meta;
type Story = StoryObj;

export const DistributionBar: Story = {
  render: (args: ProgressBarProps) => {
    const config = DEVICE_CONFIGS.find(d => d.size === args.deviceSize) || DEVICE_CONFIGS[3];
    return (
      <View style={styles.container}>
        <View style={{ width: config.width }}>
          <ProgressBar mintedAmount={args.mintedAmount} availableAmount={args.availableAmount} scale={config.scale} />
        </View>
      </View>
    );
  },
  args: {
    mintedAmount: 5000,
    availableAmount: 3500,
    deviceSize: 'L',
  },
  argTypes: {
    mintedAmount: {
      control: { type: 'number' },
      description: 'Minted UNIT amount',
    },
    availableAmount: {
      control: { type: 'number' },
      description: 'Available UNIT amount',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
  },
};

const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {DEVICE_CONFIGS.map(({ width, size, label, scale }) => (
      <View key={width} style={styles.deviceSection}>
        <Text style={styles.sizeLabel}>{size}</Text>
        <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
        <View style={{ width }}>
          <ProgressBar mintedAmount={5000} availableAmount={3500} scale={scale} />
        </View>
      </View>
    ))}
  </ScrollView>
);

export const DeviceSizeOverview: Story = {
  render: () => <DeviceSizeOverviewStory />,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    justifyContent: 'center',
  },
  scrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    gap: 24,
    alignItems: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  capacitySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  capacityLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capacityLabelGroup: {
    alignItems: 'flex-start',
  },
  capacityRightAlign: {
    alignItems: 'flex-end',
  },
  capacityLabel: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 2,
  },
  capacityValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityIcon: {
    marginRight: 4,
  },
  capacityValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barBackground: {
    flex: 1,
    backgroundColor: COLORS.DARK_GRAY,
    borderRadius: 4,
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 4,
  },
});
