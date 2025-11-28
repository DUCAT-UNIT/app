import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import globalStyles from '../../../styles';
import { history, vault, wallet } from '../../../styles/screens';

// Real components
import TransactionItem from '../../../components/transaction/TransactionItem';
import { AssetActivityList } from '../../../components/assetDetail/AssetActivityList';

// ============================================================================
// DEVICE SIZE CONFIG (same as AssetCards)
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5', iconSize: 28, fontSize: 11, dateFontSize: 10, padding: 12, minWidth: 70, chipFontSize: 9, chipPaddingH: 5, chipPaddingV: 2, chipMinWidth: 60, amountFontSize: 11, amountIconSize: 9 },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8', iconSize: 32, fontSize: 12, dateFontSize: 11, padding: 14, minWidth: 80, chipFontSize: 11, chipPaddingH: 6, chipPaddingV: 3, chipMinWidth: 70, amountFontSize: 12, amountIconSize: 10 },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14', iconSize: 36, fontSize: 14, dateFontSize: 12, padding: 16, minWidth: 85, chipFontSize: 12, chipPaddingH: 8, chipPaddingV: 4, chipMinWidth: 80, amountFontSize: 14, amountIconSize: 12 },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro', iconSize: 38, fontSize: 14, dateFontSize: 12, padding: 16, minWidth: 88, chipFontSize: 13, chipPaddingH: 8, chipPaddingV: 4, chipMinWidth: 82, amountFontSize: 14, amountIconSize: 12 },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max', iconSize: 40, fontSize: 15, dateFontSize: 12, padding: 18, minWidth: 95, chipFontSize: 14, chipPaddingH: 10, chipPaddingV: 5, chipMinWidth: 90, amountFontSize: 15, amountIconSize: 13 },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// Generate scaled styles for each device size
const getScaledStyles = (config: DeviceConfig) => ({
  ...globalStyles,
  historyTxRow: {
    ...history.historyTxRow,
    paddingVertical: config.padding,
    alignItems: 'center',
  },
  historyLogoImage: {
    ...history.historyLogoImage,
    width: config.iconSize,
    height: config.iconSize,
  },
  historyTxAmount: {
    ...history.historyTxAmount,
    fontSize: config.fontSize,
  },
  historyTxDate: {
    ...history.historyTxDate,
    fontSize: config.dateFontSize,
  },
  historyTxRight: {
    ...history.historyTxRight,
    minWidth: config.minWidth,
  },
  // Status chip (Confirmed/Pending)
  vaultAmountChip: {
    ...vault.vaultAmountChip,
    paddingHorizontal: config.chipPaddingH,
    paddingVertical: config.chipPaddingV,
    minWidth: config.chipMinWidth,
  },
  vaultAmountChipText: {
    ...vault.vaultAmountChipText,
    fontSize: config.chipFontSize,
  },
  // BTC/UNIT amount value
  assetAmount: {
    ...wallet.assetAmount,
    fontSize: config.amountFontSize,
  },
  assetAmountIcon: {
    ...wallet.assetAmountIcon,
    width: config.amountIconSize,
    height: config.amountIconSize,
    marginRight: 2,
  },
  balanceWithIcon: {
    ...wallet.balanceWithIcon,
    alignItems: 'center',
  },
  // Amount column - right aligned with fixed min width for vertical alignment
  historyTxColumn3: {
    ...history.historyTxColumn3,
    minWidth: config.minWidth,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // Logo size for the main asset icon
  logoSize: config.iconSize,
});

// ============================================================================
// MOCK TRANSACTION HELPERS
// ============================================================================
const createTransaction = (
  id: string,
  amount: number,
  assetType: 'BTC' | 'UNIT',
  action: 'send' | 'receive',
  status: 'confirmed' | 'pending',
  hoursAgo: number
) => ({
  txid: id,
  timestamp: Math.floor(Date.now() / 1000) - hoursAgo * 3600,
  status: {
    confirmed: status === 'confirmed',
    block_time: status === 'confirmed' ? Math.floor(Date.now() / 1000) - hoursAgo * 3600 : undefined,
  },
  txData: {
    amount,
    assetType,
    isSent: action === 'send',
    isReceived: action === 'receive',
  },
});

// Sample transactions for list stories
const sampleTransactions = [
  createTransaction('tx-1', 5420000, 'BTC', 'receive', 'confirmed', 1),
  createTransaction('tx-2', 100000, 'BTC', 'send', 'confirmed', 24),
  createTransaction('tx-3', 1234567, 'UNIT', 'receive', 'confirmed', 2),
  createTransaction('tx-4', 500000, 'UNIT', 'send', 'confirmed', 12),
  createTransaction('tx-5', 1000000, 'BTC', 'receive', 'pending', 0.1),
];

// ============================================================================
// CONFIGURABLE SINGLE TRANSACTION STORY
// ============================================================================
interface TransactionStoryProps {
  amount: number;
  assetType: 'BTC' | 'UNIT';
  action: 'send' | 'receive';
  status: 'confirmed' | 'pending';
  deviceSize: DeviceSize;
}

const TransactionStory = ({ amount, assetType, action, status, deviceSize }: TransactionStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const tx = createTransaction('story-tx', amount, assetType, action, status, 1);
  const scaledStyles = getScaledStyles(config);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <TransactionItem
          tx={tx}
          styles={scaledStyles}
          onPress={() => {}}
        />
      </View>
    </View>
  );
};

// ============================================================================
// ALL TRANSACTIONS LIST STORY
// ============================================================================
interface AllTransactionsStoryProps {
  deviceSize: DeviceSize;
}

const AllTransactionsStory = ({ deviceSize }: AllTransactionsStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const scaledStyles = getScaledStyles(config);
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        {sampleTransactions.map((tx) => (
          <TransactionItem
            key={tx.txid}
            tx={tx}
            styles={scaledStyles}
            onPress={() => {}}
          />
        ))}
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
        <AssetActivityList
          transactions={[]}
          isLoading={true}
          onTransactionPress={() => {}}
        />
      </View>
    </View>
  );
};

// ============================================================================
// EMPTY STATE STORY
// ============================================================================
interface EmptyStoryProps {
  deviceSize: DeviceSize;
}

const EmptyStory = ({ deviceSize }: EmptyStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        <AssetActivityList
          transactions={[]}
          isLoading={false}
          onTransactionPress={() => {}}
        />
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => {
  const tx = createTransaction('overview-tx', 5420000, 'BTC', 'receive', 'confirmed', 1);

  return (
    <ScrollView contentContainerStyle={localStyles.overviewScrollContent}>
      {Object.entries(DEVICE_SIZES).map(([key, config]) => (
        <View key={key} style={localStyles.deviceSection}>
          <View style={localStyles.deviceHeader}>
            <Text style={localStyles.deviceLabel}>{config.label}</Text>
            <Text style={localStyles.deviceWidth}>{config.subtitle} ({config.width}px)</Text>
          </View>
          <View style={{ width: config.width }}>
            <TransactionItem
              tx={tx}
              styles={getScaledStyles(config)}
              onPress={() => {}}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof TransactionStory> = {
  title: 'Components/Transactions',
  component: TransactionStory,
  argTypes: {
    amount: {
      control: 'number',
      description: 'Transaction amount (sats for BTC, micros for UNIT)',
    },
    assetType: {
      control: 'select',
      options: ['BTC', 'UNIT'],
      description: 'Asset type',
    },
    action: {
      control: 'select',
      options: ['send', 'receive'],
      description: 'Transaction action',
    },
    status: {
      control: 'select',
      options: ['confirmed', 'pending'],
      description: 'Transaction status',
    },
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TransactionStory>;

export const Transaction_: Story = {
  args: {
    amount: 5420000,
    assetType: 'BTC',
    action: 'receive',
    status: 'confirmed',
    deviceSize: 'M',
  },
};

export const AllTransactions: Story = {
  render: (args) => <AllTransactionsStory deviceSize={args.deviceSize || 'M'} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    amount: { table: { disable: true } },
    assetType: { table: { disable: true } },
    action: { table: { disable: true } },
    status: { table: { disable: true } },
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
    amount: { table: { disable: true } },
    assetType: { table: { disable: true } },
    action: { table: { disable: true } },
    status: { table: { disable: true } },
  },
};

export const Empty: Story = {
  render: (args) => <EmptyStory deviceSize={args.deviceSize || 'M'} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    amount: { table: { disable: true } },
    assetType: { table: { disable: true } },
    action: { table: { disable: true } },
    status: { table: { disable: true } },
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
});
