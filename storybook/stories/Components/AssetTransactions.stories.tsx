import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import globalStyles from '../../../styles';
import { history, vault, wallet } from '../../../styles/screens';
import Icon from '../../../components/icons';
import { formatUnitAmount, formatBalance } from '../../../utils/formatters';

// Real components
import TransactionItem from '../../../components/transaction/TransactionItem';
import { AssetActivityList } from '../../../components/assetDetail/AssetActivityList';
import { VaultActivityList } from '../../../components/vaultDetail/VaultActivityList';
import type { VaultHistoryTransaction } from '../../../services/vaultService';

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
// MOCK VAULT TRANSACTION HELPERS
// ============================================================================
const createVaultHistoryTransaction = (
  action: 'open' | 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'liquidate',
  btcAmt: number,
  unitAmt: number,
  hoursAgo: number
): VaultHistoryTransaction => ({
  action,
  vault_amount: 15000000,
  amount_borrowed: 500000,
  btc_amt: btcAmt,
  unit_amt: unitAmt,
  oracle_price: 95000,
  timestamp: Math.floor(Date.now() / 1000) - hoursAgo * 3600,
});

// Sample vault transactions
const sampleVaultTransactions: VaultHistoryTransaction[] = [
  createVaultHistoryTransaction('open', 50000000, 300000, 1),
  createVaultHistoryTransaction('deposit', 25000000, 0, 3),
  createVaultHistoryTransaction('borrow', 0, 1500000, 6),
  createVaultHistoryTransaction('repay', 0, 500000, 12),
  createVaultHistoryTransaction('withdraw', 10000000, 0, 24),
  createVaultHistoryTransaction('liquidate', 75000000, 35000000, 72),
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
// ALL TRANSACTIONS LIST STORY (includes vault transactions)
// ============================================================================
interface AllTransactionsStoryProps {
  deviceSize: DeviceSize;
  includeVault: boolean;
}

const AllTransactionsStory = ({ deviceSize, includeVault }: AllTransactionsStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const scaledStyles = getScaledStyles(config);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width }}>
        {/* Regular transactions */}
        <Text style={localStyles.sectionTitle}>Asset Transactions</Text>
        {sampleTransactions.map((tx) => (
          <TransactionItem
            key={tx.txid}
            tx={tx}
            styles={scaledStyles}
            onPress={() => {}}
          />
        ))}

        {/* Vault transactions */}
        {includeVault && (
          <View style={{ width: '100%' }}>
            <Text style={[localStyles.sectionTitle, { marginTop: 24 }]}>Vault Transactions</Text>
            <VaultActivityList
              transactions={sampleVaultTransactions}
              isLoading={false}
              onTransactionPress={() => {}}
            />
          </View>
        )}
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
  render: (args) => <AllTransactionsStory deviceSize={args.deviceSize || 'M'} includeVault={args.includeVault ?? true} />,
  args: {
    deviceSize: 'M',
    includeVault: true,
  },
  argTypes: {
    deviceSize: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    includeVault: {
      control: 'boolean',
      description: 'Include vault transactions',
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
// SCALED VAULT TRANSACTION ITEM (for Storybook only)
// ============================================================================

const formatVaultAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'open': 'Open Vault',
    'borrow': 'Borrow',
    'repay': 'Repay',
    'deposit': 'Deposit',
    'withdraw': 'Withdraw',
    'liquidate': 'Liquidation',
  };
  return actionMap[action.toLowerCase()] || action;
};

const formatVaultDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface ScaledVaultTransactionItemProps {
  transaction: VaultHistoryTransaction;
  config: DeviceConfig;
}

const ScaledVaultTransactionItem = ({ transaction, config }: ScaledVaultTransactionItemProps) => {
  const actionLower = transaction.action.toLowerCase();

  const getUnitColor = () => {
    if (actionLower === 'borrow' || actionLower === 'open') return COLORS.GREEN;
    return COLORS.RED;
  };

  const getBtcColor = () => {
    if (actionLower === 'deposit') return COLORS.GREEN;
    return COLORS.RED;
  };

  const unitColor = getUnitColor();
  const btcColor = getBtcColor();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: config.padding,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.VERY_DARK_GRAY,
        paddingHorizontal: 8,
      }}
    >
      {/* Vault Icon - scaled */}
      <View style={{ marginRight: config.padding * 0.6 }}>
        <Icon name="vault_logo" size={config.iconSize} color="#DDDDDD" />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {/* Top Row: Action | Confirmed | Amounts */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          {/* Column 1: Action label */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: config.fontSize, fontWeight: '600', color: '#DDDDDD' }}>
              {formatVaultAction(transaction.action)}
            </Text>
          </View>
          {/* Right group: Confirmed chip + Amounts */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 3, justifyContent: 'space-between' }}>
            {/* Column 2: Confirmed chip */}
            <View style={{
              backgroundColor: 'rgba(89, 170, 138, 0.2)',
              paddingHorizontal: config.chipPaddingH,
              paddingVertical: config.chipPaddingV,
              borderRadius: 4,
              minWidth: config.chipMinWidth,
              alignItems: 'center',
            }}>
              <Text style={{ color: COLORS.GREEN, fontSize: config.chipFontSize, fontWeight: '600' }}>
                Confirmed
              </Text>
            </View>
            {/* Column 3: Amounts */}
            <View style={{ alignItems: 'flex-end', minWidth: config.minWidth }}>
              {transaction.unit_amt !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="unit_symbol" size={config.amountIconSize} color={unitColor} style={{ marginRight: 2 }} />
                  <Text style={{ fontSize: config.amountFontSize, fontWeight: '600', color: unitColor }}>
                    {formatUnitAmount(Math.abs(transaction.unit_amt))}
                  </Text>
                </View>
              )}
              {transaction.btc_amt !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="btc_symbol" size={config.amountIconSize} color={btcColor} style={{ marginRight: 2 }} />
                  <Text style={{ fontSize: config.amountFontSize, fontWeight: '600', color: btcColor }}>
                    {formatBalance(Math.abs(transaction.btc_amt) / 100_000_000)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Row: Date */}
        <Text style={{ fontSize: config.dateFontSize, color: COLORS.SECONDARY_TEXT }}>
          {formatVaultDate(transaction.timestamp)}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// SINGLE VAULT TRANSACTION STORY
// ============================================================================
type VaultActionType = 'open' | 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'liquidate';

interface VaultTransactionStoryProps {
  vaultAction: VaultActionType;
  btcAmount: number;
  unitAmount: number;
  deviceSize: DeviceSize;
}

const VaultTransactionStory = ({ vaultAction, btcAmount, unitAmount, deviceSize }: VaultTransactionStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const tx = createVaultHistoryTransaction(vaultAction, btcAmount, unitAmount, 1);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={{ width: config.width, paddingHorizontal: 16 }}>
        <ScaledVaultTransactionItem transaction={tx} config={config} />
      </View>
    </View>
  );
};

export const VaultTransaction: Story = {
  render: (args) => (
    <VaultTransactionStory
      vaultAction={(args as any).vaultAction || 'deposit'}
      btcAmount={(args as any).btcAmount ?? 25000000}
      unitAmount={(args as any).unitAmount ?? 0}
      deviceSize={args.deviceSize || 'M'}
    />
  ),
  args: {
    vaultAction: 'deposit',
    btcAmount: 25000000,
    unitAmount: 0,
    deviceSize: 'M',
  } as any,
  argTypes: {
    vaultAction: {
      control: 'select',
      options: ['open', 'deposit', 'withdraw', 'borrow', 'repay', 'liquidate'],
      description: 'Vault action type',
    },
    btcAmount: {
      control: 'number',
      description: 'BTC amount in satoshis',
    },
    unitAmount: {
      control: 'number',
      description: 'UNIT amount in micros',
    },
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
