/**
 * EcashTransactionItem Component
 * Uses responsive scaling with s() and sf() functions
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { formatBalance } from '../../utils/formatters';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { useResponsive } from '../../hooks/useResponsive';
import localStyles from './TransactionItem.styles';
import type { DisplayAssetType } from '../../types/assets';

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
  isAutoclaim?: boolean;
  timestamp: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  txData: {
    amount: number;
    assetType?: DisplayAssetType;
    isSent?: boolean;
    isReceived?: boolean;
    isAutoclaim?: boolean;
  };
}

export interface EcashTransactionItemProps {
  tx: EcashTransaction;
  styles: EcashTransactionStyles;
  onPress: () => void;
}

export default function EcashTransactionItem({ tx, styles, onPress }: EcashTransactionItemProps) {
  const { s, sf } = useResponsive();
  const { amount, assetType = 'UNIT', isSent, isReceived, isAutoclaim } = tx.txData;
  const isClaimed = tx.claimed === true;
  const isPartial = tx.partiallySpent === true;
  const isBtcCashu = assetType === 'BTC';

  // Determine action text based on send/receive/autoclaim status
  const getActionText = () => {
    if (isAutoclaim || tx.isAutoclaim) return 'Self Claim';
    if (isSent) return 'Send';
    if (isReceived) return 'Received';
    return 'Send';
  };
  const actionText = getActionText();
  const assetLabel = isBtcCashu ? 'tBTC' : 'tUNIT';
  const formattedAmount = isBtcCashu
    ? formatBalance(Math.abs(amount) / 100_000_000)
    : formatUnitAmount(Math.abs(amount));

  // Determine amount color - red for sent, green for received/self claim
  const amountColor = (isSent && !isAutoclaim && !tx.isAutoclaim) ? COLORS.RED : COLORS.GREEN;

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
    <TouchableOpacity
      style={[styles.historyTxRow, { paddingHorizontal: 0, paddingLeft: 0, paddingTop: 12, paddingBottom: 12 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[localStyles.assetLogoContainer, { width: s(36), height: s(36), marginRight: s(12), marginLeft: 0, justifyContent: 'center', alignItems: 'center' }]}>
        <Icon name={isBtcCashu ? 'btc_logo' : 'unit_logo'} size={s(36)} />
        <Text style={[localStyles.lightningBadge, { bottom: s(-4), right: s(-3), fontSize: sf(16), lineHeight: sf(16) }]}>⚡</Text>
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={[styles.historyTxTopRow, { marginBottom: s(4) }]}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText, { fontSize: sf(14), marginBottom: s(4) }]}>{actionText}</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, chipStyle, { paddingHorizontal: s(6), paddingVertical: s(4), borderRadius: s(4), marginLeft: s(4) }]}>
                <Text style={[styles.vaultAmountChipText, chipTextStyle, { fontSize: sf(10) }]}>{statusText}</Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              <View style={styles.balanceWithIcon}>
                <Icon name={isBtcCashu ? 'btc_symbol' : 'unit_symbol'} size={s(12)} color={amountColor} style={styles.assetAmountIcon} />
                <Text style={[styles.assetAmount, { color: amountColor, fontSize: sf(14) }]}>
                  {formattedAmount}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={[styles.historyTxDate, { fontSize: sf(12) }]}>{formatTransactionDate(tx.timestamp / 1000)} · {assetLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
