/**
 * RegularTransactionItem Component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import localStyles from './TransactionItem.styles';

const TURBO_MINT_ADDRESS = 'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em';

export default function RegularTransactionItem({ tx, styles, onPress, advancedMode = false }) {
  const { amount, assetType, isSent, isReceived } = tx.txData;
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

  // Check for Turbo transaction
  const isTurboTransaction = assetType === 'UNIT' && tx.vout?.some(output =>
    output.scriptpubkey_address === TURBO_MINT_ADDRESS
  );
  const showTurboUI = isTurboTransaction && advancedMode;

  const getActionLabel = () => {
    if (showTurboUI) return isSent ? 'Activate' : 'Deactivate';
    return isSent ? 'Sent' : 'Received';
  };

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
              <View style={[styles.vaultAmountChip, tx.status.confirmed ? localStyles.confirmedChip : localStyles.pendingChip]}>
                <Text style={[styles.vaultAmountChipText, tx.status.confirmed ? localStyles.confirmedChipText : localStyles.pendingChipText]}>
                  {tx.status.confirmed ? 'Confirmed' : 'Pending'}
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
                      ? (Math.abs(numericAmount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : (Math.abs(numericAmount) / 100000000).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
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

RegularTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
  advancedMode: PropTypes.bool,
};
