/**
 * TransactionOutput - Display a single transaction output
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { RunestoneInfo } from './RunestoneInfo';
import { truncateAddress } from '../../utils/formatters/addresses';
import { formatBTC, satsToBTC } from '../../utils/bitcoin/conversions';
import { formatUnitAmount, formatFiat } from '../../utils/formatters/amounts';

export type OutputType = 'recipient' | 'change' | 'rune_return' | 'op_return';
export type AssetType = 'BTC' | 'UNIT' | 'RUNE';

export interface PSBTOutput {
  address: string;
  value: number;
  type: OutputType;
}

export interface SendIntent {
  assetType: AssetType;
  amount: string;
  recipient: string;
  sourceAddress?: string;
}

export interface TransactionOutputProps {
  output: PSBTOutput;
  sendIntent: SendIntent;
  runeUtxoBalance: number;
  btcPrice?: number | null;
}

export function TransactionOutput({ output, sendIntent, runeUtxoBalance, btcPrice }: TransactionOutputProps) {
  const unitAmount = sendIntent.assetType === 'UNIT' ? parseFloat(sendIntent.amount) : 0;
  const isRuneOutput = sendIntent.assetType === 'UNIT' &&
    (output.type === 'recipient' || output.type === 'rune_return');

  // Calculate remaining UNIT for rune_return output
  const remainingUnit = runeUtxoBalance ? (runeUtxoBalance / 100) - (unitAmount / 100) : 0;

  // Determine label based on output type
  let outputLabel = null;
  if (output.type === 'change') {
    outputLabel = 'Change';
  } else if (output.type === 'rune_return') {
    outputLabel = 'Rune Return';
  } else if (output.type === 'op_return') {
    outputLabel = 'Runestone';
  }

  return (
    <View style={styles.txItem}>
      <View style={styles.txItemHeader}>
        <Text style={styles.txAddress} selectable numberOfLines={1}>
          {truncateAddress(output.address, 5, 5)}
        </Text>

        {/* Show UNIT chip for rune outputs */}
        {isRuneOutput && output.type === 'recipient' && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {formatUnitAmount(unitAmount)}
            </Text>
          </View>
        )}
        {isRuneOutput && output.type === 'rune_return' && runeUtxoBalance && remainingUnit > 0 && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {formatFiat(remainingUnit)}
            </Text>
          </View>
        )}

        {/* Show regular labels for non-rune outputs */}
        {!isRuneOutput && outputLabel && output.type !== 'op_return' && (
          <Text style={styles.txChangeLabel}>{outputLabel}</Text>
        )}
        {output.type === 'op_return' && (
          <Text style={styles.txChangeLabel}>Runestone</Text>
        )}
      </View>

      {/* Special rendering for OP_RETURN runestone */}
      {output.type === 'op_return' && sendIntent.assetType === 'UNIT' ? (
        <RunestoneInfo
          unitAmount={unitAmount}
          recipient={sendIntent.recipient}
          sourceAddress={sendIntent.sourceAddress || ''}
        />
      ) : (
        <View style={styles.txValueRow}>
          <Text style={styles.txValue}>
            {formatBTC(output.value)} BTC
          </Text>
          <Text style={styles.txUsd}>
            ${formatFiat(satsToBTC(output.value) * (btcPrice || 0))}
          </Text>
        </View>
      )}
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
  txChangeLabel: {
    fontSize: 10,
    color: COLORS.PRIMARY_BLUE,
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontWeight: '500',
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
