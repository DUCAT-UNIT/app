/**
 * InputOutputList - Display transaction inputs and outputs
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { TransactionInput, PSBTInput } from './TransactionInput';
import { TransactionOutput, PSBTOutput, SendIntent } from './TransactionOutput';
import { useResponsive } from '../../hooks/useResponsive';

export interface InputOutputListProps {
  psbtInputs: PSBTInput[];
  outputs: PSBTOutput[];
  sendIntent: SendIntent;
  runeUtxoBalance: number;
  btcPrice: number | null;
}

export function InputOutputList({
  psbtInputs,
  outputs,
  sendIntent,
  runeUtxoBalance,
  btcPrice
}: InputOutputListProps) {
  const { s, sf } = useResponsive();

  return (
    <>
      {psbtInputs && psbtInputs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { fontSize: sf(16), marginBottom: s(12) }]}>Inputs</Text>
          {psbtInputs.map((input: PSBTInput, index: number) => (
            <TransactionInput key={index} input={input} btcPrice={btcPrice} />
          ))}
        </>
      )}

      {outputs && outputs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { fontSize: sf(16), marginBottom: s(12) }]}>Outputs</Text>
          {outputs.map((output: PSBTOutput, index: number) => (
            <TransactionOutput
              key={index}
              output={output}
              sendIntent={sendIntent}
              runeUtxoBalance={runeUtxoBalance}
              btcPrice={btcPrice}
            />
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: '400',
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
