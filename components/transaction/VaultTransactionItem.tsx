/**
 * VaultTransactionItem Component
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatBalance } from '../../utils/formatters';
import localStyles from './TransactionItem.styles';
import type { VaultAction, VaultTransactionData } from '../../types/assets';

interface VaultTransactionStyles {
  historyTxRow: ViewStyle;
  historyTxTopRow: ViewStyle;
  historyTxBottomRow: ViewStyle;
  historyTxColumn1: ViewStyle;
  historyTxColumn2: ViewStyle;
  historyTxColumn3: ViewStyle;
  historyTxRightGroup: ViewStyle;
  historyTxAmount: TextStyle;
  historyTxDate: TextStyle;
  vaultAmountChip: ViewStyle;
  vaultAmountChipText: TextStyle;
  balanceWithIcon: ViewStyle;
  assetAmountIcon: ViewStyle;
  assetAmount: TextStyle;
}

interface VaultAmountDisplayProps {
  vaultData: VaultTransactionData;
  action: VaultAction;
  styles: VaultTransactionStyles;
}

function VaultAmountDisplay({ vaultData, action, styles }: VaultAmountDisplayProps) {
  const isPositiveAction = action === 'Deposit' || action === 'Repay';
  const color = isPositiveAction ? COLORS.GREEN : COLORS.RED;

  if (vaultData.btcAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="btc_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {formatBalance(vaultData.btcAmount / 100000000)}
        </Text>
      </View>
    );
  }

  if (vaultData.unitAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="unit_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {formatUnitAmount(vaultData.unitAmount)}
        </Text>
      </View>
    );
  }

  return null;
}

export interface VaultTransaction {
  txid: string;
  vaultTransaction: true;
  vaultData: VaultTransactionData;
  timestamp?: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export interface VaultTransactionItemProps {
  tx: VaultTransaction;
  styles: VaultTransactionStyles;
  onPress: () => void;
}

export default function VaultTransactionItem({ tx, styles, onPress }: VaultTransactionItemProps) {
  const vaultData = tx.vaultData;
  const action: VaultAction = vaultData.action;
  const actionLabel: Record<VaultAction, string> = { Borrow: 'Borrow', Repay: 'Repay', Deposit: 'Deposit', Withdraw: 'Withdraw' };
  const label = actionLabel[action] || action;

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.vaultLogo}>
        <Icon name="vault_logo" size={40} />
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>{label}</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, localStyles.vaultConfirmedChip]}>
                <Text style={[styles.vaultAmountChipText, localStyles.vaultConfirmedText]}>Confirmed</Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <VaultAmountDisplay vaultData={vaultData} action={action} styles={styles} />
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={styles.historyTxDate}>{formatTransactionDate(tx.status.block_time)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
