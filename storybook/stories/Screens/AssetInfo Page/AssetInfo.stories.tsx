/**
 * Asset Info Page Stories
 * Matches the actual AssetDetailScreen component from the app
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import { AssetActionButtons } from '../../../../components/assetDetail/AssetActionButtons';
import { AssetPriceChart } from '../../../../components/assetDetail/AssetPriceChart';
import { AssetActivityList } from '../../../../components/assetDetail/AssetActivityList';
import type { Transaction } from '../../../../components/transaction/TransactionItem';
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
// TYPES
// =============================================================================

type AssetType = 'BTC' | 'UNIT';
type TabType = 'activity' | 'about';
type PriceTimeframe = '1D' | '1W' | '1M' | '1Y';

// =============================================================================
// MOCK DATA
// =============================================================================

// Generate mock price data for chart
const generateMockPriceData = (
  basePrice: number,
  volatility: number,
  points: number,
  isPositive: boolean
): [number, number][] => {
  const now = Date.now();
  const data: [number, number][] = [];
  let price = basePrice * (isPositive ? 0.95 : 1.05);

  for (let i = 0; i < points; i++) {
    const timestamp = now - (points - i) * 3600000; // hourly intervals
    const change = (Math.random() - 0.5) * volatility;
    const trend = isPositive ? 0.001 : -0.001;
    price = price * (1 + change + trend);
    data.push([timestamp, price]);
  }

  return data;
};

const MOCK_BTC_PRICE_DATA = generateMockPriceData(97000, 0.02, 100, true);
const MOCK_BTC_PRICE_DATA_NEGATIVE = generateMockPriceData(97000, 0.02, 100, false);

// Mock transactions matching the Transaction type
const MOCK_TRANSACTIONS: { BTC: Transaction[]; UNIT: Transaction[] } = {
  BTC: [
    {
      txid: 'btc-tx-1',
      timestamp: Date.now() - 3600000,
      status: { confirmed: true },
      txData: {
        amount: 1000000,
        assetType: 'BTC',
        isSent: false,
        isReceived: true,
      },
    },
    {
      txid: 'btc-tx-2',
      timestamp: Date.now() - 86400000,
      status: { confirmed: true },
      txData: {
        amount: 500000,
        assetType: 'BTC',
        isSent: true,
        isReceived: false,
      },
    },
    {
      txid: 'btc-tx-3',
      timestamp: Date.now() - 172800000,
      status: { confirmed: true },
      txData: {
        amount: 2000000,
        assetType: 'BTC',
        isSent: false,
        isReceived: true,
      },
    },
    {
      txid: 'btc-tx-4',
      timestamp: Date.now() - 259200000,
      status: { confirmed: false },
      txData: {
        amount: 100000,
        assetType: 'BTC',
        isSent: true,
        isReceived: false,
      },
    },
  ],
  UNIT: [
    {
      txid: 'unit-tx-1',
      timestamp: Date.now() - 3600000,
      status: { confirmed: true },
      txData: {
        amount: BigInt(50000),
        assetType: 'UNIT',
        isSent: false,
        isReceived: true,
      },
    },
    {
      txid: 'unit-tx-2',
      timestamp: Date.now() - 86400000,
      status: { confirmed: true },
      txData: {
        amount: BigInt(25000),
        assetType: 'UNIT',
        isSent: true,
        isReceived: false,
      },
    },
    {
      txid: 'unit-tx-3',
      timestamp: Date.now() - 172800000,
      status: { confirmed: true },
      txData: {
        amount: BigInt(100000),
        assetType: 'UNIT',
        isSent: false,
        isReceived: true,
      },
    },
  ],
};

// =============================================================================
// MOCK COMPONENTS
// =============================================================================

interface AssetHeaderProps {
  assetType: AssetType;
}

const MockAssetHeader = ({ assetType }: AssetHeaderProps) => (
  <View style={styles.header}>
    <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
      <Icon name="back" size={24} color={colors.text.primary} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>
      {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
    </Text>
    <View style={styles.headerSpacer} />
  </View>
);

interface AssetInfoSectionProps {
  assetType: AssetType;
  balance: string;
  usdValue: string;
  priceChange: string;
  isPositive: boolean;
}

const MockAssetInfoSection = ({
  assetType,
  balance,
  usdValue,
  priceChange,
  isPositive,
}: AssetInfoSectionProps) => (
  <View style={styles.assetInfoSection}>
    <View style={styles.assetIcon}>
      <Icon name={assetType === 'BTC' ? 'btc_logo' : 'unit_logo'} size={60} />
    </View>
    <Text style={styles.assetName}>
      {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
    </Text>
    <Text style={styles.balanceAmount}>
      {balance} {assetType}
    </Text>
    <Text style={styles.balanceFiat}>{usdValue} USD</Text>
    {assetType === 'BTC' && (
      <View style={styles.priceChangeRow}>
        <Text style={[styles.priceChangeText, { color: isPositive ? colors.semantic.success : colors.semantic.error }]}>
          {isPositive ? '▲' : '▼'} {priceChange}
        </Text>
      </View>
    )}
  </View>
);

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const MockTabs = ({ activeTab, onTabChange }: TabsProps) => (
  <View style={styles.tabsContainer}>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
      onPress={() => onTabChange('activity')}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
        Activity
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'about' && styles.tabActive]}
      onPress={() => onTabChange('about')}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
        About
      </Text>
    </TouchableOpacity>
  </View>
);

interface AboutSectionProps {
  assetType: AssetType;
}

const MockAboutSection = ({ assetType }: AboutSectionProps) => (
  <View style={styles.aboutSection}>
    <Text style={styles.aboutTitle}>
      About {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
    </Text>
    <Text style={styles.aboutText}>
      {assetType === 'BTC'
        ? 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network.'
        : 'UNIT is a stablecoin backed by Bitcoin collateral in vaults, maintaining a 1:1 peg with the US Dollar.'}
    </Text>
  </View>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

interface AssetDetailMockProps {
  size?: ScreenSize;
  assetType: AssetType;
  balance?: string;
  usdValue?: string;
  priceChange?: string;
  isPositive?: boolean;
  scale?: number;
  width?: number;
}

const AssetDetailMock = ({
  size = 'L',
  assetType,
  balance = assetType === 'BTC' ? '0.05420000' : '12,345.67',
  usdValue = assetType === 'BTC' ? '$5,420.00' : '$12,345.67',
  priceChange = '2.45% (+$130.50)',
  isPositive = true,
  scale = 1,
  width = 393,
}: AssetDetailMockProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1M');

  // Get price data based on direction - no boundaries for auto-scaling
  const priceData = isPositive ? MOCK_BTC_PRICE_DATA : MOCK_BTC_PRICE_DATA_NEGATIVE;

  // No-op handlers for buttons
  const handleNoop = () => {};

  return (
    <View style={styles.screenContainer}>
      <ScaledMutinynetBanner size={size} />
      <MockAssetHeader assetType={assetType} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <MockAssetInfoSection
          assetType={assetType}
          balance={balance}
          usdValue={usdValue}
          priceChange={priceChange}
          isPositive={isPositive}
        />

        {/* Actual AssetActionButtons Component - scaled to device */}
        <View style={{
          marginHorizontal: spacing.lg,
          height: 90 * scale,
        }}>
          <View style={{
            transform: [{ scale }],
            transformOrigin: 'top left',
            width: (width - spacing.lg * 2) / scale,
          }}>
          <AssetActionButtons
            onSendPress={handleNoop}
            onReceivePress={handleNoop}
            onConsolidatePress={handleNoop}
            onTurboPress={handleNoop}
            showConsolidate={assetType === 'UNIT'}
            advancedMode={false}
          />
          </View>
        </View>

        {/* Actual AssetPriceChart Component - using native dimensions for correct scrubbing */}
        <View style={{
          marginHorizontal: spacing.lg,
          overflow: 'hidden',
        }}>
          <AssetPriceChart
            assetType={assetType}
            priceData={priceData}
            priceError={null}
            priceLoading={false}
            isPositive={isPositive}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            onRetry={handleNoop}
            currentPrice={assetType === 'BTC' ? 97000 : 1}
            width={width - spacing.lg * 2}
            height={143 * scale}
            scale={scale}
          />
        </View>

        <MockTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'activity' ? (
          /* Actual AssetActivityList Component - scaled */
          <View style={{
            height: MOCK_TRANSACTIONS[assetType].length * 72 * scale + 40 * scale,
            marginBottom: spacing.lg,
            marginHorizontal: spacing.lg,
          }}>
            <View style={{
              transform: [{ scale }],
              transformOrigin: 'top left',
              width: (width - spacing.lg * 2) / scale,
            }}>
              <AssetActivityList
                transactions={MOCK_TRANSACTIONS[assetType]}
                isLoading={false}
                onTransactionPress={handleNoop}
                advancedMode={false}
              />
            </View>
          </View>
        ) : (
          <MockAboutSection assetType={assetType} />
        )}
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
  assetType: AssetType;
  isPositive: boolean;
}

const AssetDetailStory = ({ screenSize, assetType, isPositive }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <AssetDetailMock
          size={config.size}
          assetType={assetType}
          isPositive={isPositive}
          scale={config.scale}
          width={config.width}
        />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

interface OverviewProps {
  assetType: AssetType;
  isPositive: boolean;
}

const AssetDetailOverview = ({ assetType, isPositive }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <AssetDetailMock
            size={config.size}
            assetType={assetType}
            isPositive={isPositive}
            scale={config.scale}
            width={config.width}
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
  title: 'Screens/AssetInfo Page',
  parameters: {
    notes: 'Asset detail screen showing balance, price chart, and transaction history.',
  },
};

export default meta;
type Story = StoryObj;

// =============================================================================
// STORIES
// =============================================================================

export const Interactive: Story = {
  render: (args: StoryProps) => <AssetDetailStory {...args} />,
  args: {
    screenSize: 'L',
    assetType: 'BTC',
    isPositive: true,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    assetType: {
      control: { type: 'select' },
      options: ['BTC', 'UNIT'],
      description: 'Asset type to display',
    },
    isPositive: {
      control: { type: 'boolean' },
      description: 'Price change direction',
    },
  },
};

export const Overview: Story = {
  render: (args: OverviewProps) => <AssetDetailOverview {...args} />,
  args: {
    assetType: 'BTC',
    isPositive: true,
  },
  argTypes: {
    assetType: {
      control: { type: 'select' },
      options: ['BTC', 'UNIT'],
      description: 'Asset type to display',
    },
    isPositive: {
      control: { type: 'boolean' },
      description: 'Price change direction',
    },
  },
};

// =============================================================================
// STYLES (Following Design System)
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
    width: '100%',
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },

  // Asset Info Section
  assetInfoSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    minHeight: 180,
  },
  assetIcon: {
    marginBottom: spacing.xs,
  },
  assetName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  balanceAmount: {
    fontSize: 31,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  balanceFiat: {
    fontSize: 20,
    fontWeight: fontWeights.regular,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  priceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceChangeText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    fontFamily: fonts.regular,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    marginHorizontal: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
  },
  tabText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: fontWeights.semibold,
  },

  // About Section
  aboutSection: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  aboutTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  aboutText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 22,
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
