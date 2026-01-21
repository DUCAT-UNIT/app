/**
 * FeeBreakdown - Display transaction details (network and fees)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { formatFiat } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

interface FeeBreakdownProps {
  actualFee: number;
  feeRate?: number;
}

export default function FeeBreakdown({ actualFee, feeRate }: FeeBreakdownProps) {
  const { s, sf } = useResponsive();

  return (
    <>
      <Text style={[styles.sectionTitle, { fontSize: sf(16), marginBottom: s(12) }]}>Transaction details</Text>
      <View style={[styles.detailsCard, { borderRadius: s(12), padding: s(16), marginBottom: s(24) }]}>
        <View style={[styles.detailRow, { marginBottom: s(10) }]}>
          <Text style={[styles.detailLabel, { fontSize: sf(14) }]}>Network:</Text>
          <Text style={[styles.detailValue, { fontSize: sf(14) }]}>Mutinynet</Text>
        </View>
        {feeRate !== undefined && (
          <View style={[styles.detailRow, { marginBottom: s(10) }]}>
            <Text style={[styles.detailLabel, { fontSize: sf(14) }]}>Fee rate:</Text>
            <Text style={[styles.detailValue, { fontSize: sf(14) }]}>{feeRate} sat/vB</Text>
          </View>
        )}
        <View style={styles.detailRowLast}>
          <Text style={[styles.detailLabel, { fontSize: sf(14) }]}>Total fees:</Text>
          <Text style={[styles.detailValue, { fontSize: sf(14) }]}>{formatFiat(actualFee, 0)} sats</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  detailsCard: {
    backgroundColor: COLORS.CARD_BG,
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  detailRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  detailLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
  },
  detailValue: {
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'right',
  },
});
