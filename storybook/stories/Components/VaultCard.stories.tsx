import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../../theme';
import { wallet, vault } from '../../../styles/screens';
import Icon from '../../../components/icons';

// Real components
import VaultCard from '../../../components/wallet/VaultCard';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5', iconSize: 28, fontSize: 11, labelFontSize: 9, amountIcon: 9, padding: 10, gap: 6 },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8', iconSize: 32, fontSize: 13, labelFontSize: 10, amountIcon: 10, padding: 12, gap: 8 },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14', iconSize: 34, fontSize: 14, labelFontSize: 11, amountIcon: 11, padding: 14, gap: 10 },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro', iconSize: 36, fontSize: 14, labelFontSize: 11, amountIcon: 11, padding: 14, gap: 10 },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max', iconSize: 40, fontSize: 15, labelFontSize: 12, amountIcon: 12, padding: 16, gap: 12 },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// Generate scaled styles for each device size
const getScaledStyles = (config: DeviceConfig) => ({
  vaultCard: {
    ...vault.vaultCard,
    padding: config.padding,
  },
  vaultIconContainer: {
    ...vault.vaultIconContainer,
    width: config.iconSize + 8,
    height: config.iconSize + 8,
  },
  vaultStatusIndicator: vault.vaultStatusIndicator,
  vaultContentWrapper: {
    ...vault.vaultContentWrapper,
    gap: config.gap,
  },
  vaultHeader: vault.vaultHeader,
  vaultHeaderLeft: {
    ...vault.vaultHeaderLeft,
    gap: config.gap,
  },
  assetInfo: wallet.assetInfo,
  vaultAssetName: {
    ...vault.vaultAssetName,
    fontSize: config.fontSize,
  },
  assetValue: {
    ...wallet.assetValue,
    fontSize: config.fontSize - 2,
  },
  vaultDetailsContainer: {
    ...vault.vaultDetailsContainer,
    gap: config.gap,
  },
  vaultDetailRow: vault.vaultDetailRow,
  vaultLabel: {
    ...vault.vaultLabel,
    fontSize: config.labelFontSize,
  },
  vaultValueContainer: vault.vaultValueContainer,
  assetAmountIcon: {
    ...wallet.assetAmountIcon,
    width: config.amountIcon,
    height: config.amountIcon,
  },
  assetAmount: {
    ...wallet.assetAmount,
    fontSize: config.fontSize - 1,
  },
  vaultOverlay: vault.vaultOverlay,
  createVaultButton: {
    ...vault.createVaultButton,
    paddingVertical: config.padding - 2,
    paddingHorizontal: config.padding + 4,
  },
  createVaultButtonText: {
    ...vault.createVaultButtonText,
    fontSize: config.fontSize - 1,
  },
});

// Health state config
const HEALTH_STATES = {
  healthy: { color: COLORS.SUCCESS_GREEN, percentage: '245', hasVault: true, liquidated: false },
  warning: { color: COLORS.YELLOW, percentage: '175', hasVault: true, liquidated: false },
  danger: { color: COLORS.DANGER_RED, percentage: '140', hasVault: true, liquidated: false },
  liquidated: { color: COLORS.DANGER_RED, percentage: '105', hasVault: true, liquidated: true },
  noVault: { color: COLORS.SECONDARY_TEXT, percentage: '0', hasVault: false, liquidated: false },
};

type HealthState = keyof typeof HEALTH_STATES;

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={localStyles.overviewScrollContent}>
    {Object.entries(DEVICE_SIZES).map(([key, config]) => (
      <View key={key} style={localStyles.deviceSection}>
        <View style={localStyles.deviceHeader}>
          <Text style={localStyles.deviceLabel}>{config.label}</Text>
          <Text style={localStyles.deviceWidth}>{config.subtitle} ({config.width}px)</Text>
        </View>
        <View style={{ width: config.width }}>
          <VaultCard
            hasVault={true}
            vaultHealthColor={COLORS.SUCCESS_GREEN}
            vaultHealthPercentage="245"
            vaultDebt={1250.50}
            vaultCollateral={0.05}
            onVaultPress={() => {}}
            onCreateVault={() => {}}
            creatingVault={false}
            styles={getScaledStyles(config)}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// BASIC CONFIGURABLE STORY
// ============================================================================
interface BasicStoryProps {
  healthState: HealthState;
  vaultDebt: number;
  vaultCollateral: number;
  deviceSize: DeviceSize;
}

const BasicStory = ({ healthState, vaultDebt, vaultCollateral, deviceSize }: BasicStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const health = HEALTH_STATES[healthState];
  const scaledStyles = getScaledStyles(config);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <View style={health.liquidated ? localStyles.liquidationWrapper : undefined}>
          <VaultCard
            hasVault={health.hasVault}
            vaultHealthColor={health.color}
            vaultHealthPercentage={health.percentage}
            vaultDebt={vaultDebt}
            vaultCollateral={vaultCollateral}
            onVaultPress={() => {}}
            onCreateVault={() => {}}
            creatingVault={false}
            styles={scaledStyles}
          />
          {health.liquidated && (
            <LinearGradient
              colors={[COLORS.OVERLAY_START, COLORS.OVERLAY_END]}
              style={localStyles.liquidationOverlay}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            >
              <View style={localStyles.liquidationContent}>
                <View style={localStyles.liquidationIconContainer}>
                  <Icon name="warning" size={14} color={COLORS.DANGER_RED} />
                </View>
                <Text style={localStyles.liquidationText}>Vault in Liquidation</Text>
              </View>
            </LinearGradient>
          )}
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/VaultCard',
};

export default meta;
type Story = StoryObj;

export const DeviceSizeOverview: Story = {
  render: () => <DeviceSizeOverviewStory />,
  parameters: {
    controls: { disable: true },
  },
};

export const Basic: Story = {
  render: (args: BasicStoryProps) => <BasicStory {...args} />,
  args: {
    healthState: 'healthy',
    vaultDebt: 1250.50,
    vaultCollateral: 0.05,
    deviceSize: 'M',
  },
  argTypes: {
    healthState: {
      control: { type: 'select' },
      options: ['healthy', 'warning', 'danger', 'liquidated', 'noVault'],
      description: 'Vault health state',
    },
    vaultDebt: {
      control: { type: 'number' },
      description: 'Vault debt in UNIT',
    },
    vaultCollateral: {
      control: { type: 'number', step: 0.001 },
      description: 'Vault collateral in BTC',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const localStyles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  overviewScrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    flexGrow: 1,
    gap: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deviceLabel: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  deviceWidth: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
  // Liquidation styles
  liquidationWrapper: {
    position: 'relative',
  },
  liquidationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidationContent: {
    alignItems: 'center',
    gap: 6,
  },
  liquidationIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.DANGER_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidationText: {
    color: COLORS.DANGER_RED,
    fontSize: 14,
    fontWeight: '600',
  },
});
