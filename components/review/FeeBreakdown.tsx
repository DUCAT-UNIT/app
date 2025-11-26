/**
 * FeeBreakdown - Display transaction details (network and fees)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

interface FeeBreakdownProps {
  actualFee: number;
}

export default function FeeBreakdown({ actualFee }: FeeBreakdownProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>Transaction details</Text>
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Network:</Text>
          <Text style={styles.detailValue}>Mutinynet</Text>
        </View>
        <View style={styles.detailRowLast}>
          <Text style={styles.detailLabel}>Total fees:</Text>
          <Text style={styles.detailValue}>{actualFee.toLocaleString()} sats</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  detailRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '400',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'right',
  },
});
