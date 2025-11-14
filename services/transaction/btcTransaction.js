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
import {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
} from './utxoSelection';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * Create a BTC transaction intent (unsigned PSBT)
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount in BTC (as string, e.g. "0.001")
 * @param {string} segwitAddress - Source SegWit address
 * @param {number} currentAccount - Current account index
 * @param {Array} unconfirmedUtxos - Array of unconfirmed UTXOs to include
 * @param {Set} spentUtxos - Set of spent UTXO keys (txid:vout) to exclude
 * @returns {Promise<Object>} Transaction intent object
 */
export async function createBtcIntent(
  recipient,
  amount,
  segwitAddress,
  _currentAccount,
  unconfirmedUtxos = [],
  spentUtxos = new Set()
) {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Parse amount
    const normalizedAmount = amount.replace(',', '.');
    const amountInSats = Math.floor(parseFloat(normalizedAmount) * 100000000);

    if (isNaN(amountInSats) || amountInSats <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }

    const sourceAddress = segwitAddress;
    const addressType = 'segwit';

    // Fetch and merge UTXOs
    const confirmedUtxos = await fetchUtxosService(sourceAddress);
    const availableUtxos = mergeAndFilterUtxos(confirmedUtxos, unconfirmedUtxos, spentUtxos);

    if (availableUtxos.length === 0) {
      throw new Error(ERRORS.NO_CONFIRMED_FUNDS);
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
      id: Date.now().toString(),
      type: 'send',
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
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch transaction hex for each input UTXO
 */
async function fetchInputTransactions(selectedUtxos) {
  return Promise.all(
    selectedUtxos.map(async (utxo) => {
      const txResponse = await fetch(getTxHexUrl(utxo.txid));
      const txHex = await txResponse.text();
      return {
        ...utxo,
        txHex,
      };
    })
  );
}

/**
 * Build PSBT for BTC transaction
 */
function buildBtcPsbt(
  inputsWithTx,
  recipient,
  amountInSats,
  sourceAddress,
  change,
  dustLimit
) {
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
