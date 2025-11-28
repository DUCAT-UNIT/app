import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';

// Real components
import { VaultHealthGauge } from '../../../components/assetDetail/VaultHealthGauge';
import { VaultActivityList } from '../../../components/vaultDetail/VaultActivityList';
import type { VaultHistoryTransaction } from '../../../services/vaultService';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, label: 'XS', subtitle: 'iPhone 5', scale: 0.82, fontSize: 10, iconSize: 12, buttonSize: 40, chartHeight: 110 },
  S: { width: 375, label: 'S', subtitle: 'iPhone SE/8', scale: 0.92, fontSize: 11, iconSize: 13, buttonSize: 44, chartHeight: 120 },
  M: { width: 390, label: 'M', subtitle: 'iPhone 12/13/14', scale: 1.0, fontSize: 12, iconSize: 14, buttonSize: 50, chartHeight: 140 },
  L: { width: 393, label: 'L', subtitle: 'iPhone 14 Pro', scale: 1.0, fontSize: 12, iconSize: 14, buttonSize: 50, chartHeight: 140 },
  XL: { width: 430, label: 'XL', subtitle: 'iPhone 16 Pro Max', scale: 1.08, fontSize: 13, iconSize: 15, buttonSize: 54, chartHeight: 150 },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// ============================================================================
// MOCK VAULT TRANSACTIONS
// ============================================================================
const createMockTransaction = (
  action: 'open' | 'borrow' | 'repay' | 'deposit' | 'withdraw',
  vaultAmount: number,
  amountBorrowed: number,
  btcAmt: number,
  unitAmt: number,
  oraclePrice: number,
  hoursAgo: number
): VaultHistoryTransaction => ({
  action,
  vault_amount: vaultAmount,
  amount_borrowed: amountBorrowed,
  btc_amt: btcAmt,
  unit_amt: unitAmt,
  oracle_price: oraclePrice,
  timestamp: Math.floor(Date.now() / 1000) - hoursAgo * 3600,
});

// Mock transaction history
const mockTransactions: VaultHistoryTransaction[] = [
  createMockTransaction('deposit', 15000000, 500000, 5000000, 0, 95000, 2),
  createMockTransaction('borrow', 15000000, 700000, 0, 200000, 96000, 24),
  createMockTransaction('repay', 15000000, 500000, 0, 200000, 94500, 72),
  createMockTransaction('withdraw', 12000000, 500000, 3000000, 0, 95500, 168),
  createMockTransaction('open', 10000000, 300000, 10000000, 300000, 93000, 336),
];

// ============================================================================
// VAULT HEALTH STORY COMPONENT
// ============================================================================
interface VaultHealthStoryProps {
  deviceSize: DeviceSize;
  healthPercentage: number;
  totalCollateral: number;
  totalDebt: number;
  showChart: boolean;
  showTransactions: boolean;
}

const VaultHealthStory = ({
  deviceSize,
  healthPercentage,
  totalCollateral,
  totalDebt,
  showChart,
  showTransactions,
}: VaultHealthStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const currentPrice = 95000; // Mock BTC price

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <ScrollView
        style={{ maxHeight: 600 }}
        contentContainerStyle={{ alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
          <VaultHealthGauge
            totalDebt={totalDebt}
            totalCollateral={totalCollateral}
            currentPrice={currentPrice}
            healthPercentage={healthPercentage}
            transactions={showChart ? mockTransactions : []}
            onBorrowPress={() => {}}
            onRepayPress={() => {}}
            onDepositPress={() => {}}
            onWithdrawPress={() => {}}
          />

          {showTransactions && (
            <View style={localStyles.transactionsSection}>
              <Text style={localStyles.sectionTitle}>Activity</Text>
              <VaultActivityList
                transactions={mockTransactions}
                isLoading={false}
                onTransactionPress={() => {}}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// HEALTH STATE STORIES
// ============================================================================
interface HealthStateStoryProps {
  deviceSize: DeviceSize;
}

const HealthyVaultStory = ({ deviceSize }: HealthStateStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
        <VaultHealthGauge
          totalDebt={500}
          totalCollateral={0.15}
          currentPrice={95000}
          healthPercentage={285}
          transactions={mockTransactions}
          onBorrowPress={() => {}}
          onRepayPress={() => {}}
          onDepositPress={() => {}}
          onWithdrawPress={() => {}}
        />
      </View>
    </View>
  );
};

const ModerateVaultStory = ({ deviceSize }: HealthStateStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
        <VaultHealthGauge
          totalDebt={1500}
          totalCollateral={0.15}
          currentPrice={95000}
          healthPercentage={180}
          transactions={mockTransactions}
          onBorrowPress={() => {}}
          onRepayPress={() => {}}
          onDepositPress={() => {}}
          onWithdrawPress={() => {}}
        />
      </View>
    </View>
  );
};

const RiskyVaultStory = ({ deviceSize }: HealthStateStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
        <VaultHealthGauge
          totalDebt={2500}
          totalCollateral={0.15}
          currentPrice={95000}
          healthPercentage={145}
          transactions={mockTransactions}
          onBorrowPress={() => {}}
          onRepayPress={() => {}}
          onDepositPress={() => {}}
          onWithdrawPress={() => {}}
        />
      </View>
    </View>
  );
};

// ============================================================================
// ALL HEALTH STATES STORY
// ============================================================================
const AllHealthStatesStory = ({ deviceSize }: HealthStateStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const healthStates = [
    { label: 'Healthy (285%)', health: 285, debt: 500, collateral: 0.15 },
    { label: 'Moderate (180%)', health: 180, debt: 1500, collateral: 0.15 },
    { label: 'Risky (145%)', health: 145, debt: 2500, collateral: 0.15 },
  ];

  return (
    <ScrollView contentContainerStyle={localStyles.overviewScrollContent}>
      {healthStates.map((state, index) => (
        <View key={index} style={localStyles.stateSection}>
          <View style={localStyles.stateHeader}>
            <Text style={localStyles.stateLabel}>{state.label}</Text>
          </View>
          <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
            <VaultHealthGauge
              totalDebt={state.debt}
              totalCollateral={state.collateral}
              currentPrice={95000}
              healthPercentage={state.health}
              transactions={[]}
              onBorrowPress={() => {}}
              onRepayPress={() => {}}
              onDepositPress={() => {}}
              onWithdrawPress={() => {}}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

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
        <View style={[localStyles.deviceFrame, { width: config.width, transform: [{ scale: config.scale }] }]}>
          <VaultHealthGauge
            totalDebt={1000}
            totalCollateral={0.15}
            currentPrice={95000}
            healthPercentage={225}
            transactions={mockTransactions.slice(0, 2)}
            onBorrowPress={() => {}}
            onRepayPress={() => {}}
            onDepositPress={() => {}}
            onWithdrawPress={() => {}}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/VaultHealth',
};

export default meta;
type Story = StoryObj;

export const VaultHealth_: Story = {
  render: (args: VaultHealthStoryProps) => <VaultHealthStory {...args} />,
  args: {
    deviceSize: 'M',
    healthPercentage: 225,
    totalCollateral: 0.15,
    totalDebt: 1000,
    showChart: true,
    showTransactions: false,
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    healthPercentage: {
      control: { type: 'range', min: 130, max: 350, step: 5 },
      description: 'Vault health percentage',
    },
    totalCollateral: {
      control: { type: 'number', min: 0.01, max: 10, step: 0.01 },
      description: 'Total BTC collateral',
    },
    totalDebt: {
      control: { type: 'number', min: 100, max: 50000, step: 100 },
      description: 'Total UNIT debt',
    },
    showChart: {
      control: { type: 'boolean' },
      description: 'Show health chart',
    },
    showTransactions: {
      control: { type: 'boolean' },
      description: 'Show transaction list',
    },
  },
};

export const Healthy: Story = {
  render: (args: HealthStateStoryProps) => <HealthyVaultStory {...args} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export const Moderate: Story = {
  render: (args: HealthStateStoryProps) => <ModerateVaultStory {...args} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export const Risky: Story = {
  render: (args: HealthStateStoryProps) => <RiskyVaultStory {...args} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export const AllHealthStates: Story = {
  render: (args: HealthStateStoryProps) => <AllHealthStatesStory {...args} />,
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
  },
};

export const WithTransactions: Story = {
  render: (args: HealthStateStoryProps) => (
    <VaultHealthStory
      deviceSize={args.deviceSize || 'M'}
      healthPercentage={225}
      totalCollateral={0.15}
      totalDebt={1000}
      showChart={true}
      showTransactions={true}
    />
  ),
  args: {
    deviceSize: 'M',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
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
    zIndex: 10,
  },
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
    overflow: 'hidden',
  },
  transactionsSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 12,
  },
  overviewScrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    flexGrow: 1,
    gap: 40,
    alignItems: 'center',
  },
  deviceSection: {
    gap: 12,
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
  stateSection: {
    gap: 12,
    alignItems: 'center',
  },
  stateHeader: {
    alignItems: 'center',
  },
  stateLabel: {
    fontSize: 14,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
});
