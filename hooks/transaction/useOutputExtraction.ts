/**
 * useOutputExtraction Hook
 * Extracts change outputs from signed transactions for pending tracking
 */

import { useCallback } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import type { PendingTransactionOutput } from '../../contexts/PendingTransactionsContext';
import type { SendIntent } from '../../contexts/TransactionBuildContext';

/**
 * Safe BTC to satoshi conversion avoiding floating point errors
 */
function btcToSats(btcString: string): number {
  const parts = btcString.replace(',', '.').split('.');
  const wholePart = parseInt(parts[0] || '0', 10) * 100000000;
  if (parts.length === 1) return wholePart;

  const decimalPart = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return wholePart + parseInt(decimalPart, 10);
}

export interface OutputExtractionResult {
  outputs: PendingTransactionOutput[];
  spentInputs: Array<{ txid: string; vout: number }>;
  parentTxid: string | null;
}

export interface UseOutputExtractionOptions {
  wallet: {
    segwitAddress?: string;
    taprootAddress?: string;
  } | null;
  pendingTransactions: Record<string, { status: string }>;
  markUtxoAsSpent: (txid: string, vout: number) => Promise<void>;
}

export interface UseOutputExtractionResult {
  extractOutputs: (
    intent: SendIntent,
    sendAssetType: string,
    sendAmount: string
  ) => Promise<OutputExtractionResult>;
  btcToSats: (btcString: string) => number;
}

export function useOutputExtraction({
  wallet,
  pendingTransactions,
  markUtxoAsSpent,
}: UseOutputExtractionOptions): UseOutputExtractionResult {
  const extractOutputs = useCallback(
    async (
      intent: SendIntent,
      sendAssetType: string,
      sendAmount: string
    ): Promise<OutputExtractionResult> => {
      const tx = bitcoin.Transaction.fromHex(intent.signedTxHex!);
      const outputs: PendingTransactionOutput[] = [];
      const spentInputs: Array<{ txid: string; vout: number }> = [];
      let parentTxid: string | null = null;

      logger.debug('🔍 Extracting outputs from broadcasted tx');
      logger.debug('Total outputs in tx:', tx.outs.length);

      // Process inputs - mark as spent and track parent transactions
      for (const input of tx.ins) {
        const inputTxid = Buffer.from(input.hash).reverse().toString('hex');
        const inputVout = input.index;

        logger.debug('Input:', inputTxid, 'vout:', inputVout);
        spentInputs.push({ txid: inputTxid, vout: inputVout });

        // Check if this input is spending from a pending transaction
        if (pendingTransactions[inputTxid]?.status === 'pending') {
          if (!parentTxid) {
            parentTxid = inputTxid;
          }
          logger.debug('Removing pending output:', inputTxid, 'vout:', inputVout);
          await markUtxoAsSpent(inputTxid, inputVout);
        }
      }

      // Calculate rune change amount for UNIT transactions
      let runeChangeAmount = 0;
      if (sendAssetType === 'unit' && intent.assetType === 'UNIT' && intent.amount) {
        const intentAmount = typeof intent.amount === 'string' ? parseFloat(intent.amount) : intent.amount;

        let totalRuneInput = 0;
        if (intent.runeUtxos && intent.runeUtxos.length > 0) {
          totalRuneInput = intent.runeUtxos.reduce((sum, utxo) => sum + (utxo.runeAmount || 0), 0);
          logger.debug('Total rune input from', intent.runeUtxos.length, 'UTXOs:', totalRuneInput);
        } else if (intent.runeUtxo?.runeAmount) {
          totalRuneInput = intent.runeUtxo.runeAmount;
        }

        runeChangeAmount = totalRuneInput - intentAmount;
        logger.debug('Rune change amount:', runeChangeAmount);
      }

      // Process outputs - find change outputs
      tx.outs.forEach((output, vout) => {
        try {
          const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
          const value = Number(output.value);

          logger.debug(`Output ${vout}: ${address} = ${value} sats`);

          const isChange = address === wallet?.segwitAddress || address === wallet?.taprootAddress;

          if (isChange) {
            const outputData: PendingTransactionOutput = {
              address,
              value,
              vout,
            };

            // For UNIT transactions, output 0 is the rune return (change)
            if (sendAssetType === 'unit' && vout === 0 && runeChangeAmount > 0) {
              outputData.runeAmount = runeChangeAmount;
            }

            logger.debug('✅ Adding change output:', outputData);
            outputs.push(outputData);
          }
        } catch (_error) {
          logger.debug(`Output ${vout}: OP_RETURN or non-standard`);
        }
      });

      logger.debug('Total change outputs found:', outputs.length);

      return { outputs, spentInputs, parentTxid };
    },
    [wallet, pendingTransactions, markUtxoAsSpent]
  );

  return {
    extractOutputs,
    btcToSats,
  };
}
