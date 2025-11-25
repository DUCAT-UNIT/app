/**
 * EcashTransactionItem Component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatTransactionDate } from '../../utils/formatters/dates';
import localStyles from './TransactionItem.styles';

export default function EcashTransactionItem({ tx, styles, onPress }) {
  const { amount } = tx.txData;
  const isClaimed = tx.claimed === true;
  const isPartial = tx.partiallySpent === true;

  // Determine status
  let statusText = 'Unspent';
  let chipStyle = localStyles.confirmedChip;
  let chipTextStyle = localStyles.confirmedChipText;

  if (isClaimed) {
    statusText = 'Claimed';
    chipStyle = localStyles.claimedChip;
    chipTextStyle = localStyles.claimedChipText;
  } else if (isPartial) {
    statusText = 'Partial';
    chipStyle = localStyles.partialChip;
    chipTextStyle = localStyles.partialChipText;
  }

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

EcashTransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
};
