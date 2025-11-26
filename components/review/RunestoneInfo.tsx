/**
 * RunestoneInfo - Display runestone protocol details
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { truncateAddress } from '../../utils/formatters/addresses';

interface RunestoneInfoProps {
  unitAmount: number;
  recipient: string;
  sourceAddress: string;
}

export function RunestoneInfo({ unitAmount, recipient, sourceAddress }: RunestoneInfoProps) {
  return (
    <View style={styles.runestoneInfo}>
      <View style={styles.runestoneHeader}>
        <Text style={styles.runestoneTitle}>⧉ Runestone Protocol</Text>
      </View>
      <View style={styles.runestoneDetail}>
        <Text style={styles.runestoneDetailLabel}>Edict</Text>
        <Text style={styles.runestoneDetailValue}>
          Send {(unitAmount / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} UNIT to {truncateAddress(recipient, 5, 5)}
        </Text>
      </View>
      <View style={styles.runestoneDetail}>
        <Text style={styles.runestoneDetailLabel}>Pointer</Text>
        <Text style={styles.runestoneDetailValue}>
          Send the rest to {truncateAddress(sourceAddress, 5, 5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  runestoneInfo: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.PRIMARY_BLUE + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  runestoneDetail: {
    marginBottom: 8,
  },
  runestoneDetailLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Bold',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  runestoneDetailValue: {
    fontSize: 13,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
