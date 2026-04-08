/**
 * RegularTransactionItem Component
 * Uses responsive scaling with s() and sf() functions
 */

import React,{ memo,useMemo } from 'react';
import { Text,TextStyle,TouchableOpacity,View,ViewStyle } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import type { TransactionOutput } from '../../services/transactionHistoryService';
import { COLORS } from '../../theme';
import type { DisplayAssetType } from '../../types/assets';
import { TURBO_MINT_ADDRESS } from '../../utils/constants';
import { formatBalance } from '../../utils/formatters';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatTransactionDate } from '../../utils/formatters/dates';
import Icon from '../icons';
import localStyles from './TransactionItem.styles';

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
  logoSize?: number;
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

export default memo(function RegularTransactionItem({ tx, styles, onPress, advancedMode: _advancedMode = false }: RegularTransactionItemProps) {
  const { s, sf } = useResponsive();
  const { amount, assetType, isSent, isReceived } = tx.txData;
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

  // Memoize expensive calculations
  const { showTurboUI, actionLabel, statusConfig, formattedAmount, formattedDate } = useMemo(() => {
    // Check for tUNIT Swap transaction (sending UNIT to mint)
    const isEcashSwap = !!(
      TURBO_MINT_ADDRESS &&
      assetType === 'UNIT' &&
      isSent &&
      tx.vout?.some((output: TransactionOutput) => output.scriptpubkey_address === TURBO_MINT_ADDRESS)
    );
    const showTurbo = false; // Turbo UI disabled

    // Determine action label
    let label: string;
    if (isEcashSwap) label = 'tUNIT Swap';
    else if (isSent && isReceived) label = 'Self Claim';
    else label = isSent ? 'Sent' : 'Received';

    // Determine status config
    const status = {
      statusText: tx.status.confirmed ? 'Confirmed' : 'Pending',
      chipStyle: tx.status.confirmed ? localStyles.confirmedChip : localStyles.pendingChip,
      chipTextStyle: tx.status.confirmed ? localStyles.confirmedChipText : localStyles.pendingChipText,
    };

    // Format amount once
    const absAmount = Math.abs(numericAmount);
    const formatted = assetType === 'UNIT'
      ? formatUnitAmount(absAmount)
      : formatBalance(absAmount / 100000000);

    // Format date once
    const date = formatTransactionDate(tx.status.block_time);

    return {
      showTurboUI: showTurbo,
      actionLabel: label,
      statusConfig: status,
      formattedAmount: formatted,
      formattedDate: date,
    };
  }, [assetType, isSent, isReceived, tx.vout, tx.status.confirmed, tx.status.block_time, numericAmount]);

  // tUNIT Swap is a conversion (positive action) — show green
  const isEcashSwap = actionLabel === 'tUNIT Swap';
  const amountColor = (isReceived || isEcashSwap) ? COLORS.GREEN : COLORS.RED;

  return (
    <TouchableOpacity
      style={[styles.historyTxRow, { paddingHorizontal: 0, paddingLeft: 0, paddingTop: 12, paddingBottom: 12 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ width: s(36), height: s(36), marginRight: s(12), marginLeft: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={showTurboUI ? 'turbo' : (assetType === 'UNIT' ? 'unit_logo' : 'btc_logo')}
          size={s(36)} color={showTurboUI ? '#DDDDDD' : undefined} />
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={[styles.historyTxTopRow, { marginBottom: s(4) }]}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText, { fontSize: sf(14), marginBottom: s(4) }]}>{actionLabel}</Text>
          </View>
          <View style={styles.historyTxRightGroup}>
            <View style={styles.historyTxColumn2}>
              <View style={[styles.vaultAmountChip, statusConfig.chipStyle, { paddingHorizontal: s(6), paddingVertical: s(4), borderRadius: s(4), marginLeft: s(4) }]}>
                <Text style={[styles.vaultAmountChipText, statusConfig.chipTextStyle, { fontSize: sf(10) }]}>
                  {statusConfig.statusText}
                </Text>
              </View>
            </View>
            <View style={styles.historyTxColumn3}>
              {numericAmount !== 0 && (
                <View style={styles.balanceWithIcon}>
                  <Icon name={assetType === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                    size={s(12)} color={amountColor} style={styles.assetAmountIcon} />
                  <Text style={[styles.assetAmount, { color: amountColor, fontSize: sf(14) }]}>
                    {formattedAmount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.historyTxBottomRow}>
          <Text style={[styles.historyTxDate, { fontSize: sf(12) }]}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
