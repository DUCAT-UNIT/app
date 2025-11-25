/**
 * VaultTransactionItem Component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import localStyles from './TransactionItem.styles';

function VaultAmountDisplay({ vaultData, action, styles }) {
  const isPositiveAction = action === 'Deposit' || action === 'Repay';
  const color = isPositiveAction ? COLORS.GREEN : COLORS.RED;

  if (vaultData.btcAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="btc_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {(vaultData.btcAmount / 100000000).toLocaleString('en-US', {
            minimumFractionDigits: 8, maximumFractionDigits: 8,
          })}
        </Text>
      </View>
    );
  }

  if (vaultData.unitAmount > 0) {
    return (
      <View style={styles.balanceWithIcon}>
        <Icon name="unit_symbol" size={12} color={color} style={styles.assetAmountIcon} />
        <Text style={[styles.assetAmount, { color }]}>
          {(vaultData.unitAmount / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })}
        </Text>
      </View>
    );
  }

  return null;
}

export default function VaultTransactionItem({ tx, styles, onPress }) {
  const vaultData = tx.vaultData;
  const action = vaultData.action;
  const actionLabel = { Borrow: 'Borrow', Repay: 'Repay', Deposit: 'Deposit', Withdraw: 'Withdraw' }[action] || action;

  return (
    <TouchableOpacity style={styles.historyTxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.vaultLogo}>
        <Icon name="vault_logo" size={40} />
      </View>
      <View style={localStyles.txContentContainer}>
        <View style={styles.historyTxTopRow}>
          <View style={styles.historyTxColumn1}>
            <Text style={[styles.historyTxAmount, localStyles.actionText]}>{actionLabel}</Text>
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

VaultAmountDisplay.propTypes = {
  vaultData: PropTypes.object.isRequired,
  action: PropTypes.string.isRequired,
  styles: PropTypes.object.isRequired,
};

VaultTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};
