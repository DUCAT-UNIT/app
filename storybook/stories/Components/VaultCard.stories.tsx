import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../../theme';
import { wallet, vault } from '../../../styles/screens';
import Icon from '../../../components/icons';

import VaultCard from '../../../components/wallet/VaultCard';

const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.75 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.85 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.1 },
];

const getScaledStyles = (scale: number) => ({
  vaultCard: {
    ...vault.vaultCard,
    padding: 4,
    height: 'auto' as const,
    marginBottom: 0,
  },
  vaultIconContainer: {
    ...vault.vaultIconContainer,
    width: 40 * scale,
    height: 40 * scale,
  },
  vaultStatusIndicator: {
    ...vault.vaultStatusIndicator,
    position: 'absolute',
    top: 1 * scale * 4,
    right: 1 * scale * 4,
  },
  vaultContentWrapper: {
    ...vault.vaultContentWrapper,
    gap: 4,
    marginRight: 8,
  },
  vaultHeader: vault.vaultHeader,
  vaultHeaderLeft: vault.vaultHeaderLeft,
  assetInfo: wallet.assetInfo,
  vaultAssetName: {
    ...vault.vaultAssetName,
    fontSize: 14 * scale,
  },
  assetValue: {
    ...wallet.assetValue,
    fontSize: 13 * scale,
  },
  vaultDetailsContainer: {
    ...vault.vaultDetailsContainer,
    gap: 4,
  },
  vaultDetailRow: vault.vaultDetailRow,
  vaultLabel: {
    ...vault.vaultLabel,
    fontSize: 11 * scale,
  },
  vaultValueContainer: vault.vaultValueContainer,
  assetAmountIcon: {
    ...wallet.assetAmountIcon,
    width: 10 * scale,
    height: 10 * scale,
  },
  assetAmount: {
    ...wallet.assetAmount,
    fontSize: 12 * scale,
  },
  vaultOverlay: vault.vaultOverlay,
  createVaultButton: vault.createVaultButton,
  createVaultButtonText: {
    ...vault.createVaultButtonText,
    fontSize: 13 * scale,
  },
});

// ============================================================================
// DEVICE SIZE OVERVIEW
// ============================================================================
const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {DEVICE_CONFIGS.map(({ width, size, label, scale }) => (
      <View key={width} style={styles.deviceSection}>
        <Text style={styles.sizeLabel}>{size}</Text>
        <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
        <View style={{ width }}>
          <VaultCard
            hasVault={true}
            vaultHealthColor={COLORS.SUCCESS_GREEN}
            vaultHealthPercentage="245"
            vaultDebt={1250.5}
            vaultCollateral={0.05}
            onVaultPress={() => {}}
            onCreateVault={() => {}}
            creatingVault={false}
            styles={getScaledStyles(scale) as any}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// VAULT HEALTH CARD
// ============================================================================
type HealthState = 'healthy' | 'medium' | 'risky' | 'liquidated' | 'noVault';
type ScreenSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

const HEALTH_STATES: Record<HealthState, { color: string; percentage: string; hasVault: boolean }> = {
  healthy: { color: COLORS.SUCCESS_GREEN, percentage: '245', hasVault: true },
  medium: { color: COLORS.YELLOW, percentage: '175', hasVault: true },
  risky: { color: COLORS.DANGER_RED, percentage: '140', hasVault: true },
  liquidated: { color: COLORS.DANGER_RED, percentage: '105', hasVault: true },
  noVault: { color: COLORS.SECONDARY_TEXT, percentage: '0', hasVault: false },
};

const SCREEN_SCALES: Record<ScreenSize, number> = {
  XS: 0.75,
  S: 0.85,
  M: 0.95,
  L: 1.0,
  XL: 1.1,
};

interface VaultHealthCardProps {
  healthState: HealthState;
  screenSize: ScreenSize;
  debtAmount: number;
  collateralAmount: number;
}

const VaultHealthCardStory = ({ healthState, screenSize, debtAmount, collateralAmount }: VaultHealthCardProps) => {
  const health = HEALTH_STATES[healthState];
  const scale = SCREEN_SCALES[screenSize];
  const deviceWidth = DEVICE_CONFIGS.find(d => d.size === screenSize)?.width || 393;
  const isLiquidated = healthState === 'liquidated';

  return (
    <View style={styles.container}>
      <View style={{ width: deviceWidth, position: 'relative' }}>
        <VaultCard
          hasVault={health.hasVault}
          vaultHealthColor={health.color}
          vaultHealthPercentage={health.percentage}
          vaultDebt={debtAmount}
          vaultCollateral={collateralAmount}
          onVaultPress={() => {}}
          onCreateVault={() => {}}
          creatingVault={false}
          styles={getScaledStyles(scale) as any}
        />
        {isLiquidated && (
          <LinearGradient
            colors={[COLORS.OVERLAY_START, COLORS.OVERLAY_END]}
            style={styles.liquidationOverlay}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <View style={styles.liquidationContent}>
              <View style={styles.liquidationIconContainer}>
                <Icon name="warning" size={14} color={COLORS.DANGER_RED} />
              </View>
              <Text style={styles.liquidationText}>Vault in Liquidation</Text>
            </View>
          </LinearGradient>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// META
// ============================================================================
const meta: Meta = {
  title: 'Components/VaultCard',
};

export default meta;
export const DeviceSizeOverview: StoryObj = {
  render: () => <DeviceSizeOverviewStory />,
};

export const VaultHealthCard: StoryObj<VaultHealthCardProps> = {
  render: (args) => <VaultHealthCardStory {...args} />,
  args: {
    healthState: 'healthy',
    screenSize: 'L',
    debtAmount: 1250.5,
    collateralAmount: 0.05,
  },
  argTypes: {
    healthState: {
      control: { type: 'select' },
      options: ['healthy', 'medium', 'risky', 'liquidated', 'noVault'],
      description: 'Vault health state',
    },
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Screen size',
    },
    debtAmount: {
      control: { type: 'number' },
      description: 'Debt in UNIT',
    },
    collateralAmount: {
      control: { type: 'number', step: 0.001 },
      description: 'Collateral in BTC',
    },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
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
  liquidationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: vault.vaultCard.borderRadius,
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
