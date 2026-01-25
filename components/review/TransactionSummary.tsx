/**
 * TransactionSummary - Display the main transaction summary card
 * Shows recipient address, asset icon, amount, and USD value
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { truncateAddress } from '../../utils/formatters/addresses';
import { useResponsive } from '../../hooks/useResponsive';

interface TransactionSummaryProps {
  recipient: string;
  assetType: 'BTC' | 'UNIT';
  displayAmount: string;
  usdAmount: string;
}

export default function TransactionSummary({
  recipient,
  assetType,
  displayAmount,
  usdAmount
}: TransactionSummaryProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.card, { borderRadius: s(12), padding: s(16), marginBottom: s(20) }]}>
      {/* To Row - Address on same line */}
      <View style={[styles.toRow, { marginBottom: s(12) }]}>
        <Text style={[styles.labelText, { fontSize: sf(14), marginRight: s(8) }]}>To:</Text>
        <Text style={[styles.addressText, { fontSize: sf(14) }]} selectable>
          {truncateAddress(recipient, 5, 5)}
        </Text>
      </View>

      {/* Amount Row with Icon */}
      <View style={styles.amountRow}>
        <View style={[styles.assetIcon, { marginRight: s(16) }]}>
          <Icon
            name={assetType === 'UNIT' ? 'unit_logo' : 'btc_logo'}
            size={s(30)}
          />
        </View>
        <View style={styles.assetInfo}>
          <Text style={[styles.assetAmountLabel, { fontSize: sf(15), marginBottom: s(3) }]}>Amount</Text>
          <Text style={[styles.assetTypeText, { fontSize: sf(11) }]}>
            {assetType === 'UNIT' ? 'UNIT' : 'Bitcoin'}
          </Text>
        </View>
        <View style={styles.amountValues}>
          <Text style={[styles.amountValue, { fontSize: sf(15), marginBottom: s(3) }]}>{displayAmount}</Text>
          <Text style={[styles.amountUsdValue, { fontSize: sf(11) }]}>$ {usdAmount}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD_BG,
    width: '100%',
  },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  labelText: {
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
  },
  addressText: {
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
    // marginRight applied inline
  },
  assetInfo: {
    flex: 1,
  },
  assetAmountLabel: {
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  assetTypeText: {
    color: COLORS.SECONDARY_TEXT,
  },
  amountValues: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  amountUsdValue: {
    color: COLORS.SECONDARY_TEXT,
  },
});
