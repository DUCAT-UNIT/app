/**
 * RunestoneInfo - Display runestone protocol details
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { truncateAddress } from '../../utils/formatters/addresses';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { useResponsive } from '../../hooks/useResponsive';

interface RunestoneInfoProps {
  unitAmount: number;
  recipient: string;
  sourceAddress: string;
}

export function RunestoneInfo({ unitAmount, recipient, sourceAddress }: RunestoneInfoProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.runestoneInfo, { paddingVertical: s(12), paddingHorizontal: s(12), borderRadius: s(8) }]}>
      <View style={[styles.runestoneHeader, { marginBottom: s(12), paddingBottom: s(8) }]}>
        <Text style={[styles.runestoneTitle, { fontSize: sf(14) }]}>⧉ Runestone Protocol</Text>
      </View>
      <View style={[styles.runestoneDetail, { marginBottom: s(8) }]}>
        <Text style={[styles.runestoneDetailLabel, { fontSize: sf(11), marginBottom: s(3) }]}>Edict</Text>
        <Text style={[styles.runestoneDetailValue, { fontSize: sf(13) }]}>
          Send {formatUnitAmount(unitAmount)} UNIT to {truncateAddress(recipient, 5, 5)}
        </Text>
      </View>
      <View style={styles.runestoneDetail}>
        <Text style={[styles.runestoneDetailLabel, { fontSize: sf(11), marginBottom: s(3) }]}>Pointer</Text>
        <Text style={[styles.runestoneDetailValue, { fontSize: sf(13) }]}>
          Send the rest to {truncateAddress(sourceAddress, 5, 5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  runestoneInfo: {
    backgroundColor: COLORS.PRIMARY_BLUE + '10',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneHeader: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE + '30',
  },
  runestoneTitle: {
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  runestoneDetail: {
    // marginBottom applied inline
  },
  runestoneDetailLabel: {
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Bold',
    textTransform: 'uppercase',
  },
  runestoneDetailValue: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
