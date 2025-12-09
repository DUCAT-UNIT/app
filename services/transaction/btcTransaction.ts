/**
 * BTC Transaction Service
 * Handles creation of Bitcoin transaction intents
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../../utils/bitcoin';
import { fetchUtxos as fetchUtxosService } from '../balanceService';
import { ERRORS } from '../../utils/messages';
import { getTxHexUrl } from '../../utils/constants';
import { logger } from '../../utils/logger';
import {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
  UTXO,
} from './utxoSelection';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * Safe BTC to satoshi conversion avoiding floating point errors
 * @param btcString - BTC amount as string (e.g. "0.001")
 * @returns Amount in satoshis
 * @throws Error if amount is negative
 */
function btcToSats(btcString: string): number {
  // Check for negative amounts
  if (btcString.startsWith('-')) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  // Split on decimal point and handle each part as integer
  const parts = btcString.replace(',', '.').split('.');
  const wholePart = parseInt(parts[0] || '0', 10) * 100000000;
  if (parts.length === 1) return wholePart;

  // Pad or truncate decimal part to 8 digits
  const decimalPart = (parts[1] || '').padEnd(8, '0').slice(0, 8);
  return wholePart + parseInt(decimalPart, 10);
}

export interface BtcTransactionIntent {
  id: string;
  type: 'send';
  assetType: 'BTC';
  amount: number;
  amountBTC: string;
  recipient: string;
  fee: number;
  addressType: 'segwit';
  sourceAddress: string;
  inputs: UTXO[];
  inputCount: number;
  totalInput: number;
  change: number;
  psbt: string;
  timestamp: number;
}

interface UtxoWithTx extends UTXO {
  txHex: string;
}

/**
 * Create a BTC transaction intent (unsigned PSBT)
 * @param recipient - Recipient Bitcoin address
 * @param amount - Amount in BTC (as string, e.g. "0.001")
 * @param segwitAddress - Source SegWit address
 * @param currentAccount - Current account index
 * @param unconfirmedUtxos - Array of unconfirmed UTXOs to include
 * @param spentUtxos - Set of spent UTXO keys (txid:vout) to exclude
 * @returns Transaction intent object
 */
export async function createBtcIntent(
  recipient: string,
  amount: string,
  segwitAddress: string,
  _currentAccount: number,
  unconfirmedUtxos: UTXO[] = [],
  spentUtxos: Set<string> = new Set()
): Promise<BtcTransactionIntent> {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Parse amount using safe conversion to avoid floating point precision errors
    const amountInSats = btcToSats(amount);

    if (isNaN(amountInSats) || amountInSats <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }

    const sourceAddress = segwitAddress;
    const addressType = 'segwit' as const;

    // Fetch and merge UTXOs
    const confirmedUtxos = await fetchUtxosService(sourceAddress);

    // Log UTXO sources for debugging
    logger.transaction('utxo_fetch', {
      confirmed: confirmedUtxos.length,
      unconfirmed: unconfirmedUtxos.length,
      spent: spentUtxos.size,
    });

    const availableUtxos = mergeAndFilterUtxos(confirmedUtxos, unconfirmedUtxos, spentUtxos);

    logger.debug('[BTC Intent] Available UTXOs after merge:', { count: availableUtxos.length });

    if (availableUtxos.length === 0) {
      // Provide more context in the error
      const hasUnconfirmed = unconfirmedUtxos.length > 0;
      const allSpent = spentUtxos.size > 0 && confirmedUtxos.length === 0 && unconfirmedUtxos.length === 0;
      logger.error(new Error('[BTC Intent] No available UTXOs'), {
        confirmedCount: confirmedUtxos.length,
        unconfirmedCount: unconfirmedUtxos.length,
        spentCount: spentUtxos.size,
        spentKeys: Array.from(spentUtxos).slice(0, 5),
      });
      throw new Error(hasUnconfirmed ? ERRORS.NO_CONFIRMED_FUNDS : (allSpent ? 'All UTXOs are currently locked' : ERRORS.NO_CONFIRMED_FUNDS));
    }

    // Create fee calculator
    const calculateFee = createFeeCalculator(1); // 1 sat/vbyte for testnet

    // Select UTXOs and calculate fee
    const DUST_LIMIT = 546;
    const { selectedUtxos, totalInput, fee, change } = selectUtxosForTransaction(
      availableUtxos,
      amountInSats,
      calculateFee,
      DUST_LIMIT
    );

    // Final check for sufficient funds
    const requiredAmount = amountInSats + fee;
    if (totalInput < requiredAmount) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Fetch transaction hex for each input
    const inputsWithTx = await fetchInputTransactions(selectedUtxos);

    // Create PSBT
    const psbt = buildBtcPsbt(
      inputsWithTx,
      validatedRecipient,
      amountInSats,
      sourceAddress,
      change,
      DUST_LIMIT
    );

    // Create intent object
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'send',
      assetType: 'BTC',
      amount: amountInSats,
      amountBTC: amount,
      recipient: validatedRecipient,
      fee,
      addressType,
      sourceAddress,
      inputs: selectedUtxos,
      inputCount: selectedUtxos.length,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      operation: 'createBtcIntent',
      recipient,
      amount,
    });
    throw error;
  }
}

/**
 * Fetch transaction hex for each input UTXO
 * Required for constructing witness data in SegWit transactions
 * @param selectedUtxos - Array of selected UTXOs to fetch transaction data for
 * @returns Array of UTXOs with their full transaction hex attached
 * @throws Error if any transaction fetch fails
 */
async function fetchInputTransactions(selectedUtxos: UTXO[]): Promise<UtxoWithTx[]> {
  return Promise.all(
    selectedUtxos.map(async (utxo) => {
      const txResponse = await fetch(getTxHexUrl(utxo.txid));
      if (!txResponse.ok) {
        throw new Error(`Failed to fetch transaction ${utxo.txid}: HTTP ${txResponse.status}`);
      }
      const txHex = await txResponse.text();
      return {
        ...utxo,
        txHex,
      };
    })
  );
}

/**
 * Build a Partially Signed Bitcoin Transaction (PSBT) for a BTC send
 * Creates inputs from selected UTXOs and outputs for recipient and change
 * @param inputsWithTx - UTXOs with transaction hex for witness construction
 * @param recipient - Destination Bitcoin address
 * @param amountInSats - Amount to send in satoshis
 * @param sourceAddress - Source address for change output
 * @param change - Change amount in satoshis
 * @param dustLimit - Minimum output value (outputs below this are omitted)
 * @returns Unsigned PSBT ready for signing
 */
function buildBtcPsbt(
  inputsWithTx: UtxoWithTx[],
  recipient: string,
  amountInSats: number,
  sourceAddress: string,
  change: number,
  dustLimit: number
): bitcoin.Psbt {
  const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

  // Add inputs (BTC always uses segwit)
  for (let i = 0; i < inputsWithTx.length; i++) {
    const utxo = inputsWithTx[i];
    const tx = bitcoin.Transaction.fromHex(utxo.txHex);

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(tx.outs[utxo.vout].script),
        value: BigInt(utxo.value),
      },
    });
  }

  // Add recipient output
  psbt.addOutput({
    address: recipient,
    value: BigInt(amountInSats),
  });

  // Add change output if above dust limit
  if (change > dustLimit) {
    psbt.addOutput({
      address: sourceAddress,
      value: BigInt(change),
    });
  }

  return psbt;
}
