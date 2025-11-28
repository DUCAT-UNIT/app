import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import { history, vault, wallet } from '../../../styles/screens';

// Real components
import TransactionItem from '../../../components/transaction/TransactionItem';
import type { Transaction, TransactionItemStyles } from '../../../components/transaction/TransactionItem';

// Build the transaction item styles object
const transactionStyles: TransactionItemStyles = {
  historyTxRow: history.historyTxRow,
  historyTxTopRow: history.historyTxTopRow,
  historyTxBottomRow: history.historyTxBottomRow,
  historyTxColumn1: history.historyTxColumn1,
  historyTxColumn2: history.historyTxColumn2,
  historyTxColumn3: history.historyTxColumn3,
  historyTxRightGroup: history.historyTxRightGroup,
  historyTxAmount: history.historyTxAmount,
  historyTxDate: history.historyTxDate,
  vaultAmountChip: vault.vaultAmountChip,
  vaultAmountChipText: vault.vaultAmountChipText,
  balanceWithIcon: wallet.balanceWithIcon,
  assetAmountIcon: wallet.assetAmountIcon,
  assetAmount: wallet.assetAmount,
};

// ============================================================================
// SAMPLE TRANSACTIONS
// ============================================================================

const btcReceiveTx: Transaction = {
  txid: 'abc123btcreceive',
  timestamp: Date.now() / 1000 - 3600,
  status: { confirmed: true, block_time: Date.now() / 1000 - 3600 },
  txData: {
    amount: 5420000,
    assetType: 'BTC',
    isSent: false,
    isReceived: true,
  },
};

const btcSendTx: Transaction = {
  txid: 'def456btcsend',
  timestamp: Date.now() / 1000 - 7200,
  status: { confirmed: true, block_time: Date.now() / 1000 - 7200 },
  txData: {
    amount: 100000,
    assetType: 'BTC',
    isSent: true,
    isReceived: false,
  },
};

const btcPendingTx: Transaction = {
  txid: 'pending123',
  timestamp: Date.now() / 1000,
  status: { confirmed: false },
  txData: {
    amount: 1000000,
    assetType: 'BTC',
    isSent: false,
    isReceived: true,
  },
};

const unitReceiveTx: Transaction = {
  txid: 'unitreceive123',
  timestamp: Date.now() / 1000 - 86400,
  status: { confirmed: true, block_time: Date.now() / 1000 - 86400 },
  txData: {
    amount: 1234567,
    assetType: 'UNIT',
    isSent: false,
    isReceived: true,
  },
};

const unitSendTx: Transaction = {
  txid: 'unitsend123',
  timestamp: Date.now() / 1000 - 172800,
  status: { confirmed: true, block_time: Date.now() / 1000 - 172800 },
  txData: {
    amount: 500000,
    assetType: 'UNIT',
    isSent: true,
    isReceived: false,
  },
};

const vaultDepositTx: Transaction = {
  txid: 'vaultdeposit123',
  timestamp: Date.now() / 1000 - 14400,
  status: { confirmed: true, block_time: Date.now() / 1000 - 14400 },
  vaultTransaction: true,
  vaultData: {
    action: 'deposit' as const,
    assetType: 'BTC',
    amount: 5000000,
    confirmations: 6,
    timestamp: Date.now() / 1000 - 14400,
  },
};

const vaultBorrowTx: Transaction = {
  txid: 'vaultborrow123',
  timestamp: Date.now() / 1000 - 28800,
  status: { confirmed: true, block_time: Date.now() / 1000 - 28800 },
  vaultTransaction: true,
  vaultData: {
    action: 'borrow' as const,
    assetType: 'UNIT',
    amount: 100000000,
    confirmations: 12,
    timestamp: Date.now() / 1000 - 28800,
  },
};

// ============================================================================
// STORIES
// ============================================================================

const BTCReceiveStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>BTC Receive - incoming Bitcoin transaction</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={btcReceiveTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const BTCSendStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>BTC Send - outgoing Bitcoin transaction</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={btcSendTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const PendingStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>Pending - awaiting confirmation</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={btcPendingTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const UNITReceiveStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>UNIT Receive - incoming UNIT transaction</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={unitReceiveTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const UNITSendStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>UNIT Send - outgoing UNIT transaction</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={unitSendTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const VaultDepositStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>Vault Deposit - BTC collateral deposit</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={vaultDepositTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const VaultBorrowStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>Vault Borrow - UNIT loan</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={vaultBorrowTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

const AllTypesStory = () => (
  <View style={localStyles.container}>
    <Text style={localStyles.hint}>All transaction types</Text>
    <View style={localStyles.txList}>
      <TransactionItem tx={btcReceiveTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={btcSendTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={btcPendingTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={unitReceiveTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={unitSendTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={vaultDepositTx} styles={transactionStyles} onPress={() => {}} />
      <TransactionItem tx={vaultBorrowTx} styles={transactionStyles} onPress={() => {}} />
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/AssetTransaction',
};

export default meta;
type Story = StoryObj;

export const BTCReceive: Story = {
  render: () => <BTCReceiveStory />,
};

export const BTCSend: Story = {
  render: () => <BTCSendStory />,
};

export const Pending: Story = {
  render: () => <PendingStory />,
};

export const UNITReceive: Story = {
  render: () => <UNITReceiveStory />,
};

export const UNITSend: Story = {
  render: () => <UNITSendStory />,
};

export const VaultDeposit: Story = {
  render: () => <VaultDepositStory />,
};

export const VaultBorrow: Story = {
  render: () => <VaultBorrowStory />,
};

export const AllTypes: Story = {
  render: () => <AllTypesStory />,
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
  hint: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
  },
  txList: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
