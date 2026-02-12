import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import { wallet } from '../../../styles/screens';

// Real components
import TotalBalanceSection from '../../../components/wallet/TotalBalanceSection';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5' },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8' },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14' },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro' },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max' },
};

type DeviceSize = keyof typeof DEVICE_SIZES;

// Create styles object matching the component interface
const totalBalanceStyles = {
  xverseBalanceSection: wallet.xverseBalanceSection,
  xverseBalanceLeft: wallet.xverseBalanceLeft,
  xverseBalanceLabel: wallet.xverseBalanceLabel,
  balanceWithIcon: wallet.balanceWithIcon,
  balanceIcon: wallet.balanceIcon,
  xverseBalanceAmount: wallet.xverseBalanceAmount,
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY - Large balance across all sizes
// ============================================================================
const DeviceSizeOverviewStory = () => {
  return (
    <ScrollView contentContainerStyle={localStyles.overviewContainer}>
      {Object.entries(DEVICE_SIZES).map(([key, config]) => (
        <View key={key} style={localStyles.deviceSection}>
          <View style={localStyles.deviceHeader}>
            <Text style={localStyles.deviceLabel}>{config.label}</Text>
            <Text style={localStyles.deviceSubtitle}>{config.subtitle} ({config.width}px)</Text>
          </View>
          <View style={[localStyles.deviceFrame, { width: config.width }]}>
            <TotalBalanceSection
              showTotalInBTC={false}
              onToggle={() => {}}
              totalBTC="125.00000000"
              totalUSD="12,500,000.00"
              totalBalanceUSD={12500000}
              styles={totalBalanceStyles}
              largeBalanceStyle={wallet.totalBalanceAmountSmall}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ============================================================================
// BASIC INTERACTIVE STORY - Editable amount with toggle
// ============================================================================
interface BasicStoryProps {
  balanceUSD: number;
  deviceSize: DeviceSize;
}

const formatUSD = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatBTC = (usdValue: number): string => {
  // Assume ~$100,000 per BTC for conversion
  const btcValue = usdValue / 100000;
  return btcValue.toFixed(8);
};

const BasicStory = ({ balanceUSD, deviceSize }: BasicStoryProps) => {
  const [showBTC, setShowBTC] = useState(false);
  const isLargeBalance = balanceUSD >= 10000000;
  const deviceWidth = DEVICE_SIZES[deviceSize]?.width || 393;

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.hint}>Tap the balance to toggle between BTC and USD</Text>
      <View style={[localStyles.deviceFrame, { width: deviceWidth }]}>
        <TotalBalanceSection
          showTotalInBTC={showBTC}
          onToggle={() => setShowBTC(!showBTC)}
          totalBTC={formatBTC(balanceUSD)}
          totalUSD={formatUSD(balanceUSD)}
          totalBalanceUSD={balanceUSD}
          styles={totalBalanceStyles}
          largeBalanceStyle={isLargeBalance ? wallet.totalBalanceAmountSmall : undefined}
        />
      </View>
    </View>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/TotalBalance',
};

export default meta;
export const DeviceSizeOverview: StoryObj = {
  render: () => <DeviceSizeOverviewStory />,
  parameters: {
    controls: { disable: true },
  },
};

export const Basic: StoryObj<BasicStoryProps> = {
  render: (args) => <BasicStory {...args} />,
  args: {
    balanceUSD: 12500000,
    deviceSize: 'L',
  },
  argTypes: {
    balanceUSD: {
      control: { type: 'number' },
      description: 'Balance amount in USD',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
  },
  // Device Size Overview styles
  overviewContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    gap: 32,
  },
  deviceSection: {
    alignItems: 'center',
    gap: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceSubtitle: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.VERY_DARK_GRAY,
    padding: 16,
  },
});
