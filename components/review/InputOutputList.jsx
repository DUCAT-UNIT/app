/**
 * InputOutputList - Display transaction inputs and outputs in detail
 * Shows PSBT inputs, outputs with UNIT chips, runestone details, etc.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { TransactionInput } from './TransactionInput';
import { TransactionOutput } from './TransactionOutput';

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
});
