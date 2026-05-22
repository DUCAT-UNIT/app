/**
 * BTC Transaction Service
 * Handles creation of Bitcoin transaction intents
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../../utils/bitcoin';
import { btcToSats } from '../../utils/bitcoin/conversions';
import { fetchUtxos as fetchUtxosService } from '../balanceService';
import { ERRORS } from '../../utils/messages';
import { getTxHexUrl, BITCOIN_TX } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { fetchWithTimeout } from '../../utils/api';
import { getRecommendedFeeRate } from '../feeEstimationService';
import {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
  UTXO,
} from './utxoSelection';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

// Initialize ECC library
bitcoin.initEccLib(ecc);

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

function canFundWithUtxos(
  utxos: UTXO[],
  amountInSats: number,
  calculateFee: ReturnType<typeof createFeeCalculator>
): boolean {
  if (utxos.length === 0) {
    return false;
  }

  const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  if (amountInSats > totalAvailable) {
    return false;
  }

  if (amountInSats === totalAvailable) {
    const maxFee = calculateFee(utxos.length, 1);
    return totalAvailable - maxFee >= BITCOIN_TX.DUST_LIMIT;
  }

  const selection = selectUtxosForTransaction(
    utxos,
    amountInSats,
    calculateFee,
    BITCOIN_TX.DUST_LIMIT
  );

  return selection.totalInput >= amountInSats + selection.fee;
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
  spentUtxos: Set<string> = new Set(),
  feeRateOverride?: number
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

    // Fetch current explorer UTXOs first. This endpoint is the authoritative
    // current spendable set for the wallet address.
    const currentUtxos = await fetchUtxosService(sourceAddress);

    // Determine fee rate (dynamic recommendation with optional override)
    let feeRate = feeRateOverride;
    if (feeRate === undefined) {
      try {
        feeRate = await getRecommendedFeeRate();
      } catch {
        feeRate = 1;
      }
    }
    feeRate = feeRate ?? 1;

    // Create fee calculator
    const calculateFee = createFeeCalculator(feeRate);

    // Prefer current explorer UTXOs for BTC sends. Local pending UTXOs are useful
    // for short-lived chaining, but they can become stale after vault/Turbo flows.
    // Only merge them when the current explorer UTXOs cannot fund the request.
    const shouldUsePendingUtxos = !canFundWithUtxos(currentUtxos, amountInSats, calculateFee);
    const pendingUtxosForMerge = shouldUsePendingUtxos ? unconfirmedUtxos : [];

    if (!shouldUsePendingUtxos && unconfirmedUtxos.length > 0) {
      logger.info('[BTC Intent] Skipping pending UTXOs; current explorer UTXOs can fund send:', {
        skippedPendingCount: unconfirmedUtxos.length,
      });
    }

    // Record UTXO source counts for send diagnostics.
    logger.info('[BTC Intent] UTXO sources:', {
      current: currentUtxos.length,
      currentTotal: currentUtxos.reduce((sum, u) => sum + u.value, 0),
      pendingProvided: unconfirmedUtxos.length,
      pendingUsed: pendingUtxosForMerge.length,
      pendingTotal: pendingUtxosForMerge.reduce((sum, u) => sum + u.value, 0),
      pendingUtxos: pendingUtxosForMerge.map((u) => ({
        txid: u.txid.slice(0, 12) + '...',
        vout: u.vout,
        value: u.value,
      })),
      spent: spentUtxos.size,
      spentKeys: Array.from(spentUtxos).slice(0, 5),
      requestedAmountSats: amountInSats,
    });

    const availableUtxos = mergeAndFilterUtxos(currentUtxos, pendingUtxosForMerge, spentUtxos);

    logger.info('[BTC Intent] Available UTXOs after merge:', {
      count: availableUtxos.length,
      totalValue: availableUtxos.reduce((sum, u) => sum + u.value, 0),
      utxos: availableUtxos.map((u) => ({
        txid: u.txid.slice(0, 12) + '...',
        vout: u.vout,
        value: u.value,
      })),
    });

    if (availableUtxos.length === 0) {
      // Provide more context in the error
      const hasUnconfirmed = unconfirmedUtxos.length > 0;
      const allSpent =
        spentUtxos.size > 0 && currentUtxos.length === 0 && pendingUtxosForMerge.length === 0;
      logger.error(new Error('[BTC Intent] No available UTXOs'), {
        currentCount: currentUtxos.length,
        pendingUsedCount: pendingUtxosForMerge.length,
        spentCount: spentUtxos.size,
        spentKeys: Array.from(spentUtxos).slice(0, 5),
      });
      throw new Error(
        hasUnconfirmed
          ? ERRORS.NO_CONFIRMED_FUNDS
          : allSpent
            ? 'All UTXOs are currently locked'
            : ERRORS.NO_CONFIRMED_FUNDS
      );
    }

    // Detect "send max" — user is trying to send their entire balance
    const totalAvailable = availableUtxos.reduce((sum, u) => sum + u.value, 0);
    let effectiveAmountInSats = amountInSats;

    if (amountInSats >= totalAvailable) {
      // Max send: deduct fee from send amount (1 output, no change)
      const maxFee = calculateFee(availableUtxos.length, 1);
      effectiveAmountInSats = totalAvailable - maxFee;
      if (effectiveAmountInSats <= 0) {
        throw new Error(ERRORS.INSUFFICIENT_FUNDS);
      }
      // Ensure effective amount after fee is above dust limit
      if (effectiveAmountInSats < BITCOIN_TX.DUST_LIMIT) {
        throw new Error(ERRORS.INSUFFICIENT_FUNDS);
      }
      logger.info('[BTC Intent] Max send detected, reducing amount by fee', {
        originalAmount: amountInSats,
        effectiveAmount: effectiveAmountInSats,
        fee: maxFee,
        totalAvailable,
      });
    }

    // Select UTXOs and calculate fee
    const { selectedUtxos, totalInput, fee, change } = selectUtxosForTransaction(
      availableUtxos,
      effectiveAmountInSats,
      calculateFee,
      BITCOIN_TX.DUST_LIMIT
    );

    logger.info('[BTC Intent] UTXO selection result:', {
      selectedCount: selectedUtxos.length,
      totalInput,
      fee,
      change,
      amountInSats: effectiveAmountInSats,
      requiredAmount: effectiveAmountInSats + fee,
      shortfall: effectiveAmountInSats + fee - totalInput,
    });

    // Final check for sufficient funds
    const requiredAmount = effectiveAmountInSats + fee;
    if (totalInput < requiredAmount) {
      logger.error(new Error('[BTC Intent] Insufficient funds'), {
        totalInput,
        requiredAmount,
        shortfall: requiredAmount - totalInput,
        amountInSats: effectiveAmountInSats,
        fee,
      });
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Fetch transaction hex for each input
    const inputsWithTx = await fetchInputTransactions(selectedUtxos);

    // Create PSBT
    const psbt = buildBtcPsbt(
      inputsWithTx,
      validatedRecipient,
      effectiveAmountInSats,
      sourceAddress,
      change,
      BITCOIN_TX.DUST_LIMIT
    );

    // Create intent object
    return {
      id: `${Date.now()}-${Buffer.from(Crypto.getRandomBytes(8)).toString('hex')}`,
      type: 'send',
      assetType: 'BTC',
      amount: effectiveAmountInSats,
      amountBTC: (effectiveAmountInSats / 100000000).toFixed(8),
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
 * Fetch transaction hex for each input UTXO with timeout
 * Required for constructing witness data in SegWit transactions
 * @param selectedUtxos - Array of selected UTXOs to fetch transaction data for
 * @returns Array of UTXOs with their full transaction hex attached
 * @throws Error if any transaction fetch fails or times out after 30 seconds
 */
async function fetchInputTransactions(selectedUtxos: UTXO[]): Promise<UtxoWithTx[]> {
  return Promise.all(
    selectedUtxos.map(async (utxo) => {
      const txResponse = await fetchWithTimeout(getTxHexUrl(utxo.txid), {}, 30000); // 30s timeout for blockchain API
      if (!txResponse.ok) {
        throw new Error(`Failed to fetch transaction ${utxo.txid}: HTTP ${txResponse.status}`);
      }
      const txHex = await txResponse.text();

      // SECURITY: Validate that the returned tx hex matches the expected TXID
      // A compromised API could return fake transaction data to manipulate PSBT inputs
      const tx = bitcoin.Transaction.fromHex(txHex);
      const calculatedTxid = tx.getId();
      if (calculatedTxid !== utxo.txid) {
        throw new Error(
          `SECURITY: TXID mismatch for input - expected ${utxo.txid}, got ${calculatedTxid}`
        );
      }

      // Validate that the referenced output exists and has the expected value
      if (!tx.outs[utxo.vout]) {
        throw new Error(
          `SECURITY: Output index ${utxo.vout} does not exist in transaction ${utxo.txid}`
        );
      }

      const actualValue = Number(tx.outs[utxo.vout].value);
      if (actualValue !== utxo.value) {
        throw new Error(
          `SECURITY: UTXO value mismatch for ${utxo.txid}:${utxo.vout} - ` +
            `expected ${utxo.value} sats but transaction has ${actualValue} sats`
        );
      }

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
    // SECURITY: Validate change address is a valid Bitcoin address before adding output
    // This prevents fund loss if sourceAddress is corrupted or manipulated
    const changeAddressValid = validateAndNormalizeAddress(sourceAddress);
    if (changeAddressValid !== sourceAddress) {
      throw new Error('SECURITY: Change address validation failed - address mismatch');
    }
    psbt.addOutput({
      address: sourceAddress,
      value: BigInt(change),
    });
  }

  return psbt;
}
