/**
 * TransactionSummary - Display the main transaction summary card
 * Shows recipient address, asset icon, amount, and USD value
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function TransactionSummary({
  recipient,
  assetType,
  displayAmount,
  usdAmount
}) {
  return (
    <View style={styles.card}>
      {/* To Row - Address on same line */}
      <View style={styles.toRow}>
        <Text style={styles.labelText}>To:</Text>
        <Text style={styles.addressText} selectable>
          {recipient.substring(0, 5)}...{recipient.substring(recipient.length - 5)}
        </Text>
      </View>

      {/* Amount Row with Icon */}
      <View style={styles.amountRow}>
        <View style={styles.assetIcon}>
          <Icon
            name={assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'}
            size={30}
          />
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetAmountLabel}>Amount</Text>
          <Text style={styles.assetTypeText}>
            {assetType === 'UNIT' ? 'UNIT•RUNE' : 'Bitcoin'}
          </Text>
        </View>
        <View style={styles.amountValues}>
          <Text style={styles.amountValue}>{displayAmount}</Text>
          <Text style={styles.amountUsdValue}>$ {usdAmount}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  labelText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
    marginRight: 8,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    flex: 1,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  assetIcon: {
    marginRight: 20,
  },
  assetInfo: {
    flex: 1,
  },
  assetAmountLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 3,
  },
  assetTypeText: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
  amountValues: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 3,
  },
  amountUsdValue: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
  },
});
