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
import { useResponsive } from '../../hooks/useResponsive';

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
  const { s, sf } = useResponsive();
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
    outputLabel = 'UNIT Return';
  } else if (output.type === 'op_return') {
    outputLabel = 'Runestone';
  }

  return (
    <View style={[styles.txItem, { borderRadius: s(8), padding: s(12), marginBottom: s(8) }]}>
      <View style={[styles.txItemHeader, { marginBottom: s(6) }]}>
        <Text style={[styles.txAddress, { fontSize: sf(12), marginRight: s(8) }]} selectable numberOfLines={1}>
          {truncateAddress(output.address, 5, 5)}
        </Text>

        {/* Show UNIT chip for rune outputs */}
        {isRuneOutput && output.type === 'recipient' && (
          <View style={[styles.unitChip, { paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4), gap: s(4) }]}>
            <Icon name="unit_symbol" size={s(10)} color={COLORS.PRIMARY_BLUE} />
            <Text style={[styles.unitChipText, { fontSize: sf(10) }]}>
              {formatUnitAmount(unitAmount)}
            </Text>
          </View>
        )}
        {isRuneOutput && output.type === 'rune_return' && runeUtxoBalance && remainingUnit > 0 && (
          <View style={[styles.unitChip, { paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4), gap: s(4) }]}>
            <Icon name="unit_symbol" size={s(10)} color={COLORS.PRIMARY_BLUE} />
            <Text style={[styles.unitChipText, { fontSize: sf(10) }]}>
              {formatFiat(remainingUnit)}
            </Text>
          </View>
        )}

        {/* Show regular labels for non-rune outputs */}
        {!isRuneOutput && outputLabel && output.type !== 'op_return' && (
          <Text style={[styles.txChangeLabel, { fontSize: sf(10), paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4) }]}>{outputLabel}</Text>
        )}
        {output.type === 'op_return' && (
          <Text style={[styles.txChangeLabel, { fontSize: sf(10), paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4) }]}>Runestone</Text>
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
          <Text style={[styles.txValue, { fontSize: sf(14) }]}>
            {formatBTC(output.value)} BTC
          </Text>
          <Text style={[styles.txUsd, { fontSize: sf(13) }]}>
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
  txChangeLabel: {
    color: COLORS.PRIMARY_BLUE,
    backgroundColor: COLORS.PRIMARY_BLUE + '20',
    fontWeight: '500',
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
