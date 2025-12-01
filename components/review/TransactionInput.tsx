/**
 * TransactionInput - Display a single transaction input
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { truncateAddress } from '../../utils/formatters/addresses';
import { formatBTC, satsToBTC } from '../../utils/bitcoin/conversions';
import { formatUnitAmount, formatFiat } from '../../utils/formatters/amounts';
import { useResponsive } from '../../hooks/useResponsive';
import type { PSBTInput } from '../../services/psbtService';

// Re-export for backwards compatibility
export type { PSBTInput };

export interface TransactionInputProps {
  input: PSBTInput;
  btcPrice: number | null;
}

export function TransactionInput({ input, btcPrice }: TransactionInputProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.txItem, { borderRadius: s(8), padding: s(12), marginBottom: s(8) }]}>
      <View style={[styles.txItemHeader, { marginBottom: s(6) }]}>
        <Text style={[styles.txAddress, { fontSize: sf(12), marginRight: s(8) }]} selectable numberOfLines={1}>
          {truncateAddress(input.address, 5, 5)}
        </Text>
        {input.type === 'rune' && input.runeAmount && (
          <View style={[styles.unitChip, { paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4), gap: s(4) }]}>
            <Icon name="unit_symbol" size={s(10)} color={COLORS.PRIMARY_BLUE} />
            <Text style={[styles.unitChipText, { fontSize: sf(10) }]}>
              {formatUnitAmount(input.runeAmount)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.txValueRow}>
        <Text style={[styles.txValue, { fontSize: sf(14) }]}>
          {formatBTC(input.value)} BTC
        </Text>
        <Text style={[styles.txUsd, { fontSize: sf(13) }]}>
          ${formatFiat(satsToBTC(input.value) * (btcPrice || 0))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  txItem: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  txItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txAddress: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'monospace',
    flex: 1,
  },
  txValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txValue: {
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  txUsd: {
    color: COLORS.SECONDARY_TEXT,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
  },
  unitChipText: {
    color: COLORS.PRIMARY_BLUE,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
