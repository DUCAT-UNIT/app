/**
 * InputOutputList - Display transaction inputs and outputs in detail
 * Shows PSBT inputs, outputs with UNIT chips, runestone details, etc.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function InputOutputList({
  psbtInputs,
  outputs,
  sendIntent,
  runeUtxoBalance,
  btcPrice
}) {
  return (
    <View style={styles.txDetailsContainer}>
      {/* Inputs Section */}
      <View style={styles.txSection}>
        <Text style={styles.txSectionTitle}>
          Inputs ({psbtInputs.length})
        </Text>
        {psbtInputs.map((input, index) => (
          <TransactionInput
            key={`input-${index}`}
            input={input}
            btcPrice={btcPrice}
          />
        ))}
      </View>

      {/* Outputs Section */}
      <View style={styles.txSection}>
        <Text style={styles.txSectionTitle}>
          Outputs ({outputs.length})
        </Text>
        {outputs.map((output, index) => (
          <TransactionOutput
            key={`output-${index}`}
            output={output}
            sendIntent={sendIntent}
            runeUtxoBalance={runeUtxoBalance}
            btcPrice={btcPrice}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * TransactionInput - Display a single transaction input
 */
function TransactionInput({ input, btcPrice }) {
  return (
    <View style={styles.txItem}>
      <View style={styles.txItemHeader}>
        <Text style={styles.txAddress} selectable numberOfLines={1}>
          {input.address.substring(0, 5)}...{input.address.substring(input.address.length - 5)}
        </Text>
        {input.type === 'rune' && input.runeAmount && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {(input.runeAmount / 100).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.txValueRow}>
        <Text style={styles.txValue}>
          {(input.value / 100000000).toFixed(8)} BTC
        </Text>
        <Text style={styles.txUsd}>
          ${((input.value / 100000000) * (btcPrice || 0)).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
    </View>
  );
}

/**
 * TransactionOutput - Display a single transaction output
 */
function TransactionOutput({ output, sendIntent, runeUtxoBalance, btcPrice }) {
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
          {output.address.length > 20
            ? `${output.address.substring(0, 5)}...${output.address.substring(output.address.length - 5)}`
            : output.address}
        </Text>

        {/* Show UNIT chip for rune outputs */}
        {isRuneOutput && output.type === 'recipient' && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {(unitAmount / 100).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        )}
        {isRuneOutput && output.type === 'rune_return' && runeUtxoBalance && (
          <View style={styles.unitChip}>
            <Icon name="unit_symbol" size={10} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.unitChipText}>
              {remainingUnit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
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
          sourceAddress={sendIntent.sourceAddress}
        />
      ) : (
        <View style={styles.txValueRow}>
          <Text style={styles.txValue}>
            {(output.value / 100000000).toFixed(8)} BTC
          </Text>
          <Text style={styles.txUsd}>
            ${((output.value / 100000000) * (btcPrice || 0)).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * RunestoneInfo - Display runestone protocol details
 */
function RunestoneInfo({ unitAmount, recipient, sourceAddress }) {
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
          })} UNIT to {recipient.substring(0, 5)}...{recipient.substring(recipient.length - 5)}
        </Text>
      </View>
      <View style={styles.runestoneDetail}>
        <Text style={styles.runestoneDetailLabel}>Pointer</Text>
        <Text style={styles.runestoneDetailValue}>
          Send the rest to {sourceAddress.substring(0, 5)}...{sourceAddress.substring(sourceAddress.length - 5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  txDetailsContainer: {
    marginBottom: 24,
  },
  txSection: {
    marginBottom: 20,
  },
  txSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 10,
  },
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
