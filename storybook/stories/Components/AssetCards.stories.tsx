import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import { wallet } from '../../../styles/screens';

// Real components
import AssetCard from '../../../components/wallet/AssetCard';
import SkeletonLoader from '../../../components/ui/SkeletonLoader';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5', cardHeight: 52, iconSize: 28, fontSize: 11, amountIcon: 10, padding: { left: 6, right: 10, vertical: 10 } },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8', cardHeight: 60, iconSize: 32, fontSize: 13, amountIcon: 11, padding: { left: 6, right: 12, vertical: 12 } },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14', cardHeight: 64, iconSize: 34, fontSize: 14, amountIcon: 12, padding: { left: 7, right: 14, vertical: 14 } },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro', cardHeight: 66, iconSize: 36, fontSize: 14, amountIcon: 12, padding: { left: 7, right: 14, vertical: 14 } },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max', cardHeight: 72, iconSize: 40, fontSize: 15, amountIcon: 13, padding: { left: 8, right: 16, vertical: 16 } },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// Generate styles for each device size
const getScaledStyles = (config: DeviceConfig) => ({
  assetCard: {
    ...wallet.assetCard,
    height: config.cardHeight,
    paddingLeft: config.padding.left,
    paddingRight: config.padding.right,
    paddingVertical: config.padding.vertical,
  },
  assetCardLast: wallet.assetCardLast,
  assetRow: wallet.assetRow,
  assetLeft: wallet.assetLeft,
  btcIcon: { ...wallet.btcIcon, width: config.iconSize, height: config.iconSize },
  ducatIcon: { ...wallet.ducatIcon, width: config.iconSize, height: config.iconSize },
  assetInfo: wallet.assetInfo,
  assetName: { ...wallet.assetName, fontSize: config.fontSize },
  balanceWithIcon: wallet.balanceWithIcon,
  assetAmountIcon: { ...wallet.assetAmountIcon, width: config.amountIcon, height: config.amountIcon },
  assetAmount: { ...wallet.assetAmount, fontSize: config.fontSize - 1 },
  assetValue: { ...wallet.assetValue, fontSize: config.fontSize - 1 },
  assetValueWithIcon: wallet.assetValueWithIcon,
  assetIcon: wallet.assetIcon,
});

// ============================================================================
// CONFIGURABLE ASSET CARD
// ============================================================================
interface AssetCardStoryProps {
  assetName: string;
  assetLogo: string;
  amountLabel?: string;
  amountValue: string;
  usdValue: number | string;
  deviceSize: DeviceSize;
}

const AssetCardStory = ({ assetName, assetLogo, amountLabel, amountValue, usdValue, deviceSize }: AssetCardStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <AssetCard
          assetName={assetName}
          assetLogo={assetLogo}
          amountLabel={amountLabel}
          amountValue={amountValue}
          displayInBTC={false}
          btcValue="0.00"
          usdValue={usdValue}
          styles={getScaledStyles(config)}
          onPress={() => {}}
        />
      </View>
    </View>
  );
};

// ============================================================================
// ALL ASSET CARDS STORY
// ============================================================================
interface AllAssetsStoryProps {
  deviceSize: DeviceSize;
}

const AllAssetsStory = ({ deviceSize }: AllAssetsStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const styles = getScaledStyles(config);
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.assetList, { width: config.width }]}>
        <AssetCard
          assetName="Bitcoin"
          assetLogo="btc_logo"
          amountLabel="btc_symbol"
          amountValue="0.05420000"
          displayInBTC={false}
          btcValue="0.05420000"
          usdValue={5420.0}
          styles={styles}
          onPress={() => {}}
        />
        <AssetCard
          assetName="UNIT"
          assetLogo="unit_logo"
          amountLabel="unit_symbol"
          amountValue="12,345.67"
          displayInBTC={false}
          btcValue="0.12345678"
          usdValue={12345.67}
          styles={styles}
          onPress={() => {}}
        />
        <AssetCard
          assetName="DUCAT•RUNE"
          assetLogo="ducat_logo"
          amountValue="Đ 0.00"
          displayInBTC={false}
          btcValue="0.00"
          usdValue="0.00"
          styles={styles}
          isLast={true}
        />
      </View>
    </View>
  );
};

// ============================================================================
// LOADING SKELETON STORY
// ============================================================================
interface LoadingStoryProps {
  deviceSize: DeviceSize;
}

const LoadingStory = ({ deviceSize }: LoadingStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <SkeletonLoader width="100%" height={config.cardHeight} borderRadius={12} />
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={localStyles.overviewScrollContent}>
    {Object.entries(DEVICE_SIZES).map(([key, config]) => (
      <View key={key} style={localStyles.deviceSection}>
        <View style={[localStyles.deviceHeader, { width: config.width }]}>
          <Text style={localStyles.deviceLabel}>{config.label}</Text>
          <Text style={localStyles.deviceWidth}>{config.subtitle} ({config.width}px)</Text>
        </View>
        <View style={{ width: config.width }}>
          <AssetCard
            assetName="Bitcoin"
            assetLogo="btc_logo"
            amountLabel="btc_symbol"
            amountValue="0.05420000"
            displayInBTC={false}
            btcValue="0.05420000"
            usdValue={5420.0}
            styles={getScaledStyles(config)}
            onPress={() => {}}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof AssetCardStory> = {
  title: 'Components/AssetCard',
  component: AssetCardStory,
  argTypes: {
    assetName: {
      control: 'text',
      description: 'Asset display name',
    },
    assetLogo: {
      control: 'select',
      options: ['btc_logo', 'unit_logo', 'ducat_logo'],
      description: 'Icon to display',
    },
    amountLabel: {
      control: 'select',
      options: ['btc_symbol', 'unit_symbol', undefined],
      description: 'Amount label icon',
    },
    amountValue: {
      control: 'text',
      description: 'Amount to display',
    },
    usdValue: {
      control: 'number',
      description: 'USD value',
    },
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AssetCardStory>;

export const AssetCard_: Story = {
  args: {
    assetName: 'Bitcoin',
    assetLogo: 'btc_logo',
    amountLabel: 'btc_symbol',
    amountValue: '0.05420000',
    usdValue: 5420.0,
    deviceSize: 'M',
  },
};

export const AllAssets: Story = {
  render: (args) => <AllAssetsStory deviceSize={args.deviceSize || 'M'} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    assetName: { table: { disable: true } },
    assetLogo: { table: { disable: true } },
    amountLabel: { table: { disable: true } },
    amountValue: { table: { disable: true } },
    usdValue: { table: { disable: true } },
  },
};

export const Loading: Story = {
  render: (args) => <LoadingStory deviceSize={args.deviceSize || 'M'} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    assetName: { table: { disable: true } },
    assetLogo: { table: { disable: true } },
    amountLabel: { table: { disable: true } },
    amountValue: { table: { disable: true } },
    usdValue: { table: { disable: true } },
  },
};

export const DeviceSizeOverview: Story = {
  render: () => <DeviceSizeOverviewStory />,
  parameters: {
    controls: { disable: true },
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
  assetList: {
    gap: 8,
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
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
  },
});
