/**
 * Wallet Page Screen Story
 * Uses actual app components to match the real wallet screen
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import WalletHeader from '../../../../components/wallet/WalletHeader';
import TotalBalanceSection from '../../../../components/wallet/TotalBalanceSection';
import VaultCard from '../../../../components/wallet/VaultCard';
import AssetCard from '../../../../components/wallet/AssetCard';
import { COLORS } from '../../../../theme';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  radii,
  phoneFrame,
  mutinynetBanner,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// COMPONENT STYLES (matching app styles)
// =============================================================================

const componentStyles = StyleSheet.create({
  // WalletHeader styles
  xverseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: spacing.lg,
  },
  xverseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  xverseAccountName: {
    fontSize: 20,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  xverseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconButton: {
    padding: 0,
    margin: 0,
  },

  // TotalBalanceSection styles
  xverseBalanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: spacing.lg,
  },
  xverseBalanceLeft: {
    flex: 1,
  },
  xverseBalanceLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  balanceWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  xverseBalanceAmount: {
    fontSize: 44,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
  },

  // VaultCard styles
  vaultCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    paddingVertical: 12,
    margin: 0,
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
    width: '100%',
  },
  vaultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    position: 'relative',
    alignSelf: 'center',
  },
  vaultStatusIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.semantic.success,
    borderWidth: 3,
    borderColor: colors.bg.secondary,
  },
  vaultContentWrapper: {
    flex: 1,
  },
  vaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vaultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetInfo: {
    flex: 1,
  },
  vaultAssetName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    paddingTop: 4,
    marginBottom: 0,
  },
  assetValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  vaultDetailsContainer: {
    marginLeft: 0,
    marginTop: 6,
    marginBottom: 0,
  },
  vaultDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  vaultLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  vaultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetAmountIcon: {
    width: 12,
    height: 12,
    marginRight: 0,
  },
  assetAmount: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
  },
  vaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createVaultButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  createVaultButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.white,
  },

  // AssetCard styles
  assetCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    margin: 0,
    width: '100%',
  },
  assetCardLast: {
    marginBottom: 0,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  btcIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    overflow: 'hidden',
  },
  ducatIcon: {
    borderRadius: 20,
  },
  assetName: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  balanceWithIconAsset: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 16,
    height: 16,
    marginRight: 3,
  },
});

// =============================================================================
// SCALED MUTINYNET BANNER
// =============================================================================

const BANNER_SIZES = {
  XS: { fontSize: 12, paddingV: 6 },
  S: { fontSize: 13, paddingV: 7 },
  M: { fontSize: 14, paddingV: 8 },
  L: { fontSize: 14, paddingV: 8 },
  XL: { fontSize: 15, paddingV: 10 },
};

const ScaledMutinynetBanner = ({ size = 'L' }: { size?: ScreenSize }) => {
  const config = BANNER_SIZES[size];
  return (
    <View style={[styles.mutinynetBanner, { paddingVertical: config.paddingV }]}>
      <Text style={[styles.mutinynetBannerText, { fontSize: config.fontSize }]}>
        Mutinynet Edition
      </Text>
    </View>
  );
};

// =============================================================================
// ACTION BUTTONS (inline like in WalletScreen)
// =============================================================================

const ActionButtons = () => (
  <View style={styles.actionsRow}>
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>↓</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Repay</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>+</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Deposit</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>-</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Withdraw</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
      <View style={styles.actionButtonIcon}>
        <Text style={styles.buttonIcon}>↑</Text>
      </View>
      <Text style={styles.actionButtonLabel}>Borrow</Text>
    </TouchableOpacity>
  </View>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

interface WalletScreenMockProps {
  size?: ScreenSize;
  scale?: number;
  width?: number;
  hasVault?: boolean;
  showInBTC?: boolean;
  vaultHealth?: 'healthy' | 'warning' | 'danger';
}

const getVaultHealthColor = (health: string) => {
  switch (health) {
    case 'warning': return COLORS.ORANGE;
    case 'danger': return COLORS.RED;
    default: return COLORS.SUCCESS_GREEN;
  }
};

const getVaultHealthPercentage = (health: string) => {
  switch (health) {
    case 'warning': return 135;
    case 'danger': return 115;
    default: return 175;
  }
};

const WalletScreenMock = ({
  size = 'L',
  scale = 1,
  width = 393,
  hasVault = true,
  showInBTC = false,
  vaultHealth = 'healthy',
}: WalletScreenMockProps) => {
  const [showBTC, setShowBTC] = useState(showInBTC);
  const handleNoop = () => {};

  const vaultHealthColor = getVaultHealthColor(vaultHealth);
  const vaultHealthPercentage = getVaultHealthPercentage(vaultHealth);

  return (
    <View style={styles.screenContainer}>
      <ScaledMutinynetBanner size={size} />

      <View style={styles.contentArea}>
        <WalletHeader
          accountNumber={1}
          onHistoryPress={handleNoop}
          onQRScanPress={handleNoop}
          onSettingsPress={handleNoop}
          styles={componentStyles}
        />

        <TotalBalanceSection
          showTotalInBTC={showBTC}
          onToggle={() => setShowBTC(!showBTC)}
          totalBTC="0.12345678"
          totalUSD="12,345.67"
          totalBalanceUSD={12345.67}
          styles={componentStyles}
        />

        {/* Action Buttons - scaled with 24px left margin */}
        <View style={{ marginLeft: spacing.lg, height: 76 * scale }}>
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            <ActionButtons />
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.assetsList}>
          {/* VaultCard - scaled */}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 8, height: 80 * scale, overflow: 'hidden' }}>
            <View style={{ transform: [{ scale }], transformOrigin: 'top left', width: (width - spacing.lg * 2 - 5) / scale }}>
              <VaultCard
                hasVault={hasVault}
                vaultHealthColor={vaultHealthColor}
                vaultHealthPercentage={vaultHealthPercentage}
                vaultDebt={1234.56}
                vaultCollateral={0.0542}
                onVaultPress={handleNoop}
                onCreateVault={handleNoop}
                creatingVault={false}
                styles={componentStyles}
              />
            </View>
          </View>

          {/* Bitcoin AssetCard - scaled */}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 8, height: 72 * scale, overflow: 'hidden' }}>
            <View style={{ transform: [{ scale }], transformOrigin: 'top left', width: (width - spacing.lg * 2 - 5) / scale }}>
              <AssetCard
                assetName="Bitcoin"
                assetLogo="btc_logo"
                amountLabel="btc_symbol"
                amountValue="0.05420000"
                displayInBTC={showBTC}
                btcValue="0.05420000"
                usdValue={5420.0}
                styles={componentStyles}
                onPress={handleNoop}
              />
            </View>
          </View>

          {/* UNIT AssetCard - scaled */}
          <View style={{ paddingHorizontal: spacing.lg, height: 72 * scale, overflow: 'hidden' }}>
            <View style={{ transform: [{ scale }], transformOrigin: 'top left', width: (width - spacing.lg * 2 - 5) / scale }}>
              <AssetCard
                assetName="UNIT"
                assetLogo="unit_logo"
                amountLabel="unit_symbol"
                amountValue="12,345.67"
                displayInBTC={showBTC}
                btcValue="0.12345678"
                usdValue={12345.67}
                styles={componentStyles}
                onPress={handleNoop}
                isLast
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
  hasVault: boolean;
  showInBTC: boolean;
  vaultHealth: 'healthy' | 'warning' | 'danger';
}

const WalletStory = ({ screenSize, hasVault, showInBTC, vaultHealth }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <WalletScreenMock
          size={config.size}
          scale={config.scale}
          width={config.width}
          hasVault={hasVault}
          showInBTC={showInBTC}
          vaultHealth={vaultHealth}
        />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

interface OverviewProps {
  hasVault: boolean;
  showInBTC: boolean;
  vaultHealth: 'healthy' | 'warning' | 'danger';
}

const WalletOverview = ({ hasVault, showInBTC, vaultHealth }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <WalletScreenMock
            size={config.size}
            scale={config.scale}
            width={config.width}
            hasVault={hasVault}
            showInBTC={showInBTC}
            vaultHealth={vaultHealth}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/WalletPage',
  parameters: {
    notes: 'Main wallet interface using actual app components.',
  },
};

export default meta;
type Story = StoryObj;

// =============================================================================
// STORIES
// =============================================================================

export const Interactive: Story = {
  render: (args: StoryProps) => <WalletStory {...args} />,
  args: {
    screenSize: 'L',
    hasVault: true,
    showInBTC: false,
    vaultHealth: 'healthy',
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    hasVault: {
      control: { type: 'boolean' },
      description: 'Show vault with data or "Create Vault" overlay',
    },
    showInBTC: {
      control: { type: 'boolean' },
      description: 'Display balances in BTC instead of USD',
    },
    vaultHealth: {
      control: { type: 'select' },
      options: ['healthy', 'warning', 'danger'],
      description: 'Vault health status (affects color)',
    },
  },
};

export const Overview: Story = {
  render: (args: OverviewProps) => <WalletOverview {...args} />,
  args: {
    hasVault: true,
    showInBTC: false,
    vaultHealth: 'healthy',
  },
  argTypes: {
    hasVault: {
      control: { type: 'boolean' },
      description: 'Show vault with data or "Create Vault" overlay',
    },
    showInBTC: {
      control: { type: 'boolean' },
      description: 'Display balances in BTC instead of USD',
    },
    vaultHealth: {
      control: { type: 'select' },
      options: ['healthy', 'warning', 'danger'],
      description: 'Vault health status (affects color)',
    },
  },
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Story Container
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phone Frame
  phoneFrame: {
    backgroundColor: colors.bg.primary,
    borderRadius: phoneFrame.borderRadius,
    borderWidth: phoneFrame.borderWidth,
    borderColor: phoneFrame.borderColor,
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,
  },

  // Mutinynet Banner
  mutinynetBanner: {
    backgroundColor: mutinynetBanner.backgroundColor,
    alignItems: 'center',
    width: '100%',
  },
  mutinynetBannerText: {
    color: mutinynetBanner.text.color,
    fontWeight: mutinynetBanner.text.fontWeight,
    fontFamily: fonts.medium,
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Content Area
  contentArea: {
    flex: 1,
    paddingTop: spacing.lg,
  },

  // Action Buttons (no padding)
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    padding: 0,
    margin: 0,
  },
  actionButton: {
    alignItems: 'center',
    padding: 0,
    margin: 0,
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 24,
    color: colors.bg.primary,
    fontWeight: '200',
  },
  actionButtonLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.lg,
    marginTop: 20,
    marginBottom: 12,
    opacity: 0.3,
  },

  // Assets List
  assetsList: {
    flex: 1,
  },

  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  overviewContent: {
    padding: spacing.lg,
    gap: spacing.xxl,
    alignItems: 'center',
  },

  // Device Row
  deviceRow: {
    alignItems: 'center',
  },

  // Device Label
  deviceLabel: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceSize: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  deviceName: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  deviceWidth: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
