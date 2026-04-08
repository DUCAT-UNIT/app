/**
 * VaultTransactionItem Component
 * Uses responsive scaling with s() and sf() functions
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatBalance } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';
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
  s: (value: number) => number;
  sf: (value: number) => number;
}

function VaultAmountDisplay({ vaultData, action, styles, s, sf }: VaultAmountDisplayProps) {
  // Per-action, per-asset color rules:
  // BTC green: Deposit, Repossess   |  BTC red: Withdraw
  // UNIT green: Repay, Swap         |  UNIT red: Open, Borrow, Repossess
  const btcColor = (action === 'Withdraw') ? COLORS.RED : COLORS.GREEN;
  const unitColor = (action === 'Repay' || action === 'Swap') ? COLORS.GREEN : COLORS.RED;

  const hasBtc = vaultData.btcAmount > 0;
  const hasUnit = vaultData.unitAmount > 0;

  if (hasBtc && hasUnit) {
    return (
      <View style={{ alignItems: 'flex-end', gap: s(2) }}>
        <View style={styles.balanceWithIcon}>
          <Icon name="unit_symbol" size={s(12)} color={unitColor} style={styles.assetAmountIcon} />
          <Text style={[styles.assetAmount, { color: unitColor, fontSize: sf(14) }]}>
            {formatUnitAmount(vaultData.unitAmount)}
          </Text>
        </View>
        <View style={styles.balanceWithIcon}>
          <Icon name="btc_symbol" size={s(12)} color={btcColor} style={styles.assetAmountIcon} />
          <Text style={[styles.assetAmount, { color: btcColor, fontSize: sf(14) }]}>
            {formatBalance(vaultData.btcAmount / 100000000)}
          </Text>
        </View>
      </View>
    );
  }

  if (hasBtc) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="btc_symbol" size={s(12)} color={btcColor} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color: btcColor, fontSize: sf(14) }]}>
          {formatBalance(vaultData.btcAmount / 100000000)}
        </Text>
      </View>
    );
  }

  if (hasUnit) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="unit_symbol" size={s(12)} color={unitColor} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color: unitColor, fontSize: sf(14) }]}>
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
  const { s, sf } = useResponsive();
  const vaultData = tx.vaultData;
  const action: VaultAction = vaultData.action;
  const actionLabel: Record<VaultAction, string> = { Borrow: 'Borrow', Repay: 'Repay', Deposit: 'Deposit', Withdraw: 'Withdraw', Open: 'Open', Repossess: 'Repossess', Swap: 'Swap' };
  const label = actionLabel[action] || action;

  return (
    <TouchableOpacity
      style={[styles.historyTxRow, { paddingLeft: 5, paddingTop: 12, paddingBottom: 12 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ marginRight: s(16), alignSelf: 'center' }}>
        <Icon name={action === 'Swap' ? 'unit_logo' : 'vault_logo'} size={s(28)} />
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={[styles.historyTxTopRow, { marginBottom: s(4) }]}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText, { fontSize: sf(14), marginBottom: s(4) }]}>{label}</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, localStyles.vaultConfirmedChip, { paddingHorizontal: s(6), paddingVertical: s(4), borderRadius: s(4), marginLeft: s(4) }]}>
                <Text style={[styles.vaultAmountChipText, localStyles.vaultConfirmedText, { fontSize: sf(10) }]}>Confirmed</Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <VaultAmountDisplay vaultData={vaultData} action={action} styles={styles} s={s} sf={sf} />
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={[styles.historyTxDate, { fontSize: sf(12) }]}>{formatTransactionDate(tx.status.block_time)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
