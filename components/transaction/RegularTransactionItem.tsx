/**
 * RegularTransactionItem Component
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatBalance } from '../../utils/formatters';
import localStyles from './TransactionItem.styles';
import type { DisplayAssetType } from '../../types/assets';

const TURBO_MINT_ADDRESS = 'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em';

interface TransactionOutput {
  scriptpubkey_address?: string;
  value?: number;
}

interface RegularTransactionStyles {
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

interface RegularTransaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_time?: number;
  };
  txData: {
    amount: number | bigint;
    assetType: DisplayAssetType;
    isSent: boolean;
    isReceived: boolean;
  };
  vout?: TransactionOutput[];
}

interface RegularTransactionItemProps {
  tx: RegularTransaction;
  styles: RegularTransactionStyles;
  onPress: () => void;
  advancedMode?: boolean;
}

export default function RegularTransactionItem({ tx, styles, onPress, advancedMode = false }: RegularTransactionItemProps) {
  const { amount, assetType, isSent, isReceived } = tx.txData;
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

  // Check for Turbo/eCash Swap transaction (sending UNIT to mint)
  const isEcashSwapTransaction = assetType === 'UNIT' && isSent && tx.vout?.some((output: TransactionOutput) =>
    output.scriptpubkey_address === TURBO_MINT_ADDRESS
  );
  const showTurboUI = isEcashSwapTransaction && advancedMode;

  const getActionLabel = () => {
    if (showTurboUI) return 'Activate';
    if (isEcashSwapTransaction) return 'eCash Swap';
    // Check for self claim (same user sends and receives)
    if (isSent && isReceived) return 'Self Claim';
    return isSent ? 'Sent' : 'Received';
  };

  // Determine status text and style
  const getStatusConfig = () => {
    if (isEcashSwapTransaction && !advancedMode) {
      // Show "eCash Swap" as the status for non-advanced mode
      return {
        statusText: tx.status.confirmed ? 'Confirmed' : 'Pending',
        chipStyle: tx.status.confirmed ? localStyles.confirmedChip : localStyles.pendingChip,
        chipTextStyle: tx.status.confirmed ? localStyles.confirmedChipText : localStyles.pendingChipText,
      };
    }
    return {
      statusText: tx.status.confirmed ? 'Confirmed' : 'Pending',
      chipStyle: tx.status.confirmed ? localStyles.confirmedChip : localStyles.pendingChip,
      chipTextStyle: tx.status.confirmed ? localStyles.confirmedChipText : localStyles.pendingChipText,
    };
  };

  const { statusText, chipStyle, chipTextStyle } = getStatusConfig();
  const amountColor = isReceived ? COLORS.GREEN : COLORS.RED;

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.assetLogo}>
        <Icon name={showTurboUI ? 'turbo' : (assetType === 'UNIT' ? 'unit_logo' : 'btc_logo')}
          size={40} color={showTurboUI ? '#DDDDDD' : undefined} />
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>{getActionLabel()}</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, chipStyle]}>
                <Text style={[styles.vaultAmountChipText, chipTextStyle]}>
                  {statusText}
                </Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              {numericAmount !== 0 && (
                <View style={styles.balanceWithIcon}>
                  <Icon name={assetType === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                    size={12} color={amountColor} style={styles.assetAmountIcon} />
                  <Text style={[styles.assetAmount, { color: amountColor }]}>
                    {assetType === 'UNIT'
                      ? formatUnitAmount(Math.abs(numericAmount))
                      : formatBalance(Math.abs(numericAmount) / 100000000)}
                  </Text>
                </View>
              )}
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
