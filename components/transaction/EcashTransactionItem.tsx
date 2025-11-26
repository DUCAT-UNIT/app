/**
 * EcashTransactionItem Component
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import localStyles from './TransactionItem.styles';

interface EcashTransactionStyles {
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

export interface EcashTransaction {
  txid: string;
  ecashToken: true;
  claimed?: boolean;
  partiallySpent?: boolean;
  timestamp: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  txData: {
    amount: number;
  };
}

export interface EcashTransactionItemProps {
  tx: EcashTransaction;
  styles: EcashTransactionStyles;
  onPress: () => void;
}

export default function EcashTransactionItem({ tx, styles, onPress }: EcashTransactionItemProps) {
  const { amount } = tx.txData;
  const isClaimed = tx.claimed === true;
  const isPartial = tx.partiallySpent === true;

  // Determine status - use explicit type annotation to allow union
  const getStatusConfig = () => {
    if (isClaimed) {
      return {
        statusText: 'Claimed',
        chipStyle: localStyles.claimedChip,
        chipTextStyle: localStyles.claimedChipText,
      };
    }
    if (isPartial) {
      return {
        statusText: 'Partial',
        chipStyle: localStyles.partialChip,
        chipTextStyle: localStyles.partialChipText,
      };
    }
    return {
      statusText: 'Unspent',
      chipStyle: localStyles.confirmedChip,
      chipTextStyle: localStyles.confirmedChipText,
    };
  };

  const { statusText, chipStyle, chipTextStyle } = getStatusConfig();

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.assetLogoContainer}>
        <Icon name="unit_logo" size={40} />
        <Text style={localStyles.lightningBadge}>⚡</Text>
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>Sent</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, chipStyle]}>
                <Text style={[styles.vaultAmountChipText, chipTextStyle]}>{statusText}</Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <View style={styles.balanceWithIcon}>
                <Icon name="unit_symbol" size={12} color={COLORS.RED} style={styles.assetAmountIcon} />
                <Text style={[styles.assetAmount, { color: COLORS.RED }]}>
                  {Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={styles.historyTxDate}>{formatTransactionDate(tx.timestamp / 1000)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
