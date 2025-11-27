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
import type { PSBTInput } from '../../services/psbtService';

// Re-export for backwards compatibility
export type { PSBTInput };

export interface TransactionInputProps {
  input: PSBTInput;
  btcPrice: number | null;
}

export function TransactionInput({ input, btcPrice }: TransactionInputProps) {
  return (
    <View style={styles.txItem}>
      <View style={styles.txItemHeader}>
        <Text style={styles.txAddress} selectable numberOfLines={1}>
          {truncateAddress(input.address, 5, 5)}
        </Text>
        {input.type === 'rune' && input.runeAmount && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {formatUnitAmount(input.runeAmount)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.txValueRow}>
        <Text style={styles.txValue}>
          {formatBTC(input.value)} BTC
        </Text>
        <Text style={styles.txUsd}>
          ${formatFiat(satsToBTC(input.value) * (btcPrice || 0))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  txItem: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  txItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  txAddress: {
    fontSize: 12,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 8,
  },
  txValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  txUsd: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  unitChipText: {
    fontSize: 10,
    color: COLORS.PRIMARY_BLUE,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
