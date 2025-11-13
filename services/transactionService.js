/**
 * Transaction Service - Bitcoin and Runes transaction creation, signing, and broadcasting
 */

import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../runestone-encoder';
import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../utils/bitcoin';
import { fetchUtxos as fetchUtxosService } from './balanceService';
import * as AuthService from './authService';
import { ERRORS } from '../utils/messages';
import { retrySilently } from '../utils/retry';
import {
  getTxHexUrl,
  getOrdAddressUrl,
  getOrdOutputUrl,
  getTxOutspendUrl,
  getAddressUtxoUrl,
} from '../utils/constants';

// Initialize BIP32 and ECC library
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

/**
 * Create a BTC transaction intent (unsigned PSBT)
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount in BTC (as string, e.g. "0.001")
 * @param {string} segwitAddress - Source SegWit address
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{id: string, psbt: string, ...}>} Transaction intent object
 */
export const createBtcIntent = async (recipient, amount, segwitAddress, _currentAccount, unconfirmedUtxos = []) => {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Replace comma with period for locales that use comma as decimal separator
    const normalizedAmount = amount.replace(',', '.');
    const amountInSats = Math.floor(parseFloat(normalizedAmount) * 100000000);

    if (isNaN(amountInSats) || amountInSats <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }

    const sourceAddress = segwitAddress;
    const addressType = 'segwit';

    // Fetch confirmed UTXOs for the source address
    const confirmedUtxos = await fetchUtxosService(sourceAddress);

    // Merge confirmed and unconfirmed UTXOs, removing duplicates
    // Deduplicate by txid+vout to avoid using the same UTXO twice
    const utxoMap = new Map();

    // Add confirmed UTXOs first
    confirmedUtxos.forEach(utxo => {
      const key = `${utxo.txid}:${utxo.vout}`;
      utxoMap.set(key, utxo);
    });

    // Add unconfirmed UTXOs, but don't overwrite if already present
    unconfirmedUtxos.forEach(utxo => {
      const key = `${utxo.txid}:${utxo.vout}`;
      if (!utxoMap.has(key)) {
        utxoMap.set(key, utxo);
      }
    });

    const availableUtxos = Array.from(utxoMap.values());

    if (availableUtxos.length === 0) {
      throw new Error(ERRORS.NO_CONFIRMED_FUNDS);
    }

    /**
     * Dynamic fee calculation based on transaction size
     * Transaction size = base + (inputs * input_size) + (outputs * output_size)
     * - Base: ~10 vbytes (version, locktime, etc.)
     * - P2WPKH input: ~68 vbytes (input + witness data)
     * - P2PKH output: ~34 vbytes
     * - P2WPKH output: ~31 vbytes
     */
    const feeRate = 1; // sats per vbyte (very low for testnet)
    const BASE_TX_SIZE = 10;
    const P2WPKH_INPUT_SIZE = 68;
    const P2WPKH_OUTPUT_SIZE = 31;

    /**
     * Calculate transaction fee based on number of inputs and outputs
     */
    const calculateFee = (numInputs, numOutputs) => {
      const txSize = BASE_TX_SIZE + numInputs * P2WPKH_INPUT_SIZE + numOutputs * P2WPKH_OUTPUT_SIZE;
      return Math.ceil(txSize * feeRate);
    };

    /**
     * Iterative UTXO selection with dynamic fee calculation
     * Select UTXOs until we have enough to cover amount + fee
     * Recalculate fee if more inputs are needed
     */
    const selectedUtxos = [];
    let totalInput = 0;
    let estimatedFee = 0;
    let previousFee = 0;

    // Calculate total available balance
    const _totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

    // Iteratively select UTXOs and recalculate fee
    do {
      previousFee = estimatedFee;
      const numOutputs = 2; // recipient + change (we'll adjust if no change needed)

      // If we don't have enough, add more UTXOs
      while (selectedUtxos.length < availableUtxos.length) {
        // Find next available UTXO (prefer confirmed, but allow unconfirmed for chaining)
        let nextUtxo = availableUtxos.find(
          (utxo) => utxo.status.confirmed && !selectedUtxos.includes(utxo)
        );
        // If no confirmed UTXOs available, use unconfirmed
        if (!nextUtxo) {
          nextUtxo = availableUtxos.find(
            (utxo) => !selectedUtxos.includes(utxo)
          );
        }
        if (!nextUtxo) break;

        // Add UTXO to selection
        selectedUtxos.push(nextUtxo);
        totalInput += nextUtxo.value;

        // Calculate fee with current number of selected UTXOs
        estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
        const requiredAmount = amountInSats + estimatedFee;

        // Check if we now have enough
        if (totalInput >= requiredAmount) {
          break;
        }
      }

      // Final fee calculation with actual selected UTXOs
      estimatedFee = calculateFee(selectedUtxos.length, numOutputs);
    } while (estimatedFee !== previousFee && selectedUtxos.length < availableUtxos.length);

    // Calculate preliminary change to determine if we need 1 or 2 outputs
    const DUST_LIMIT = 546; // Bitcoin dust limit in satoshis
    let preliminaryChange = totalInput - amountInSats - estimatedFee;

    // If change would be below dust (including negative), recalculate fee for 1 output (no change)
    if (preliminaryChange < DUST_LIMIT) {
      estimatedFee = calculateFee(selectedUtxos.length, 1);
      preliminaryChange = totalInput - amountInSats - estimatedFee;
    }

    // Final check for sufficient funds
    const requiredAmount = amountInSats + estimatedFee;
    if (totalInput < requiredAmount) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Fetch transaction hex for each input
    const inputsWithTx = await Promise.all(
      selectedUtxos.map(async (utxo) => {
        const txResponse = await fetch(getTxHexUrl(utxo.txid));
        const txHex = await txResponse.text();
        return {
          ...utxo,
          txHex,
        };
      })
    );

    // Calculate final change (already adjusted for dust limit above)
    let change = totalInput - amountInSats - estimatedFee;
    let finalFee = estimatedFee;

    // If change is still below dust after fee adjustment, it goes entirely to miners
    if (change > 0 && change < DUST_LIMIT) {
      finalFee = totalInput - amountInSats; // All remaining goes to fee
      change = 0;
    }

    // Create PSBT (unsigned - no mnemonic needed)
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

    // Add output (recipient)
    psbt.addOutput({
      address: validatedRecipient,
      value: BigInt(amountInSats),
    });

    // Add change output if above dust limit
    if (change > DUST_LIMIT) {
      psbt.addOutput({
        address: sourceAddress,
        value: BigInt(change),
      });
    }

    // Create intent object
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      amount: amountInSats,
      amountBTC: amount,
      recipient: validatedRecipient,
      fee: finalFee,
      addressType, // Always 'segwit' for BTC
      sourceAddress,
      inputs: selectedUtxos,
      inputCount: selectedUtxos.length,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    return intent;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a UNIT (Runes) transaction intent with runestone encoding
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount of runes (as string, e.g. "100")
 * @param {string} taprootAddress - Source Taproot address
 * @param {string} segwitAddress - SegWit address for fees
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{id: string, psbt: string, assetType: string, ...}>} Transaction intent object
 */
export const createUnitIntent = async (
  recipient,
  amount,
  taprootAddress,
  segwitAddress,
  _currentAccount,
  unconfirmedTaprootUtxos = [],
  unconfirmedSegwitUtxos = []
) => {
  try {
    // Validate and normalize recipient address
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    // Force Taproot address for UNIT transfers
    if (!validatedRecipient.startsWith('tb1p') && !validatedRecipient.startsWith('bc1p')) {
      throw new Error('UNIT transfers require a Taproot address (starting with tb1p)');
    }

    // Parse amount and multiply by 100 for runestone encoding
    const normalizedAmount = amount.replace(',', '.');
    const userAmount = parseInt(normalizedAmount, 10);
    if (isNaN(userAmount) || userAmount <= 0) {
      throw new Error(ERRORS.INVALID_AMOUNT);
    }
    // Multiply by 100 for runestone encoding (UNIT display amount * 100)
    const amountInRunes = userAmount * 100;

    // Use addresses passed as parameters (no mnemonic needed for PSBT creation)
    // These addresses are already derived from the wallet's mnemonic

    // First check unconfirmed taproot UTXOs for runes
    let runeUtxo = null;
    for (const utxo of unconfirmedTaprootUtxos) {
      if (utxo.runeAmount && utxo.runeAmount >= amountInRunes) {
        runeUtxo = {
          transaction: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
          runeAmount: utxo.runeAmount,
        };
        break;
      }
    }

    // If no suitable unconfirmed rune UTXO, fetch from ord API
    if (!runeUtxo) {
      const ordResponse = await fetch(getOrdAddressUrl(taprootAddress), {
        headers: { Accept: 'application/json' },
      });
      const ordData = await ordResponse.json();

      // Find a UTXO with sufficient runes
      for (const output of ordData.outputs || []) {
        const utxoResponse = await fetch(getOrdOutputUrl(output), {
          headers: { Accept: 'application/json' },
        });
        const utxoData = await utxoResponse.json();

        // Check if this UTXO has DUCAT•UNIT•RUNE
        if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
          const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount, 10);

          if (runeAmount >= amountInRunes) {
            const vout = parseInt(output.match(/:(.*)$/)[1], 10);

            // Check if unspent
            const spendResponse = await fetch(getTxOutspendUrl(utxoData.transaction, vout));
            const spendData = await spendResponse.json();

            if (!spendData.spent) {
              runeUtxo = {
                transaction: utxoData.transaction,
                vout: vout,
                value: utxoData.value,
                runeAmount: runeAmount,
              };
              break;
            }
          }
        }
      }
    }

    if (!runeUtxo) {
      throw new Error(ERRORS.NO_UNIT_BALANCE);
    }

    // First check unconfirmed segwit UTXOs for fees
    let satUtxo = null;
    for (const utxo of unconfirmedSegwitUtxos) {
      if (utxo.value >= 12000) {
        satUtxo = {
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
        };
        break;
      }
    }

    // If no suitable unconfirmed UTXO, fetch confirmed UTXOs
    if (!satUtxo) {
      const utxoResponse = await fetch(getAddressUtxoUrl(segwitAddress));
      const utxos = await utxoResponse.json();

      // Find a UTXO with at least 12000 sats for fees
      for (const utxo of utxos) {
        if (utxo.status.confirmed && utxo.value >= 12000) {
          satUtxo = {
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
          };
          break;
        }
      }
    }

    if (!satUtxo) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    }

    // Calculate amounts
    const fee = 1000;
    const recipientSats = 10000; // Recipient output with runes
    const runeReturnSats = 10000; // Rune return output (also has runes)
    const dustLimit = 546;
    const totalInput = satUtxo.value + runeUtxo.value;
    const change = totalInput - fee - recipientSats - runeReturnSats;

    if (change < 0) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Create PSBT
    const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

    // Fetch transaction hex for inputs
    const satTxResponse = await fetch(getTxHexUrl(satUtxo.txid));
    const satTxHex = await satTxResponse.text();
    const satTx = bitcoin.Transaction.fromHex(satTxHex);

    const runeTxResponse = await fetch(getTxHexUrl(runeUtxo.transaction));
    const runeTxHex = await runeTxResponse.text();
    const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

    // Decode addresses to get the pubkey data
    const { data: taprootData } = bitcoin.address.fromBech32(taprootAddress);
    const tapInternalKey = Buffer.from(taprootData);

    // Add inputs - exactly like working example
    // Input 0: P2WPKH (for fees)
    psbt.addInput({
      hash: satUtxo.txid,
      index: parseInt(satUtxo.vout, 10),
      witnessUtxo: {
        script: Buffer.from(satTx.outs[satUtxo.vout].script),
        value: BigInt(satUtxo.value),
      },
    });

    // Input 1: Taproot (with runes)
    psbt.addInput({
      hash: runeUtxo.transaction,
      index: parseInt(runeUtxo.vout, 10),
      witnessUtxo: {
        script: Buffer.from(runeTx.outs[runeUtxo.vout].script),
        value: BigInt(runeUtxo.value),
      },
      tapInternalKey: tapInternalKey,
    });

    // Create runestone
    const runestoneConfig = {
      edicts: [
        {
          id: { block: 1527352n, tx: 1n }, // DUCAT•UNIT•RUNE ID
          amount: BigInt(amountInRunes),
          output: 1, // Recipient is at output 1
        },
      ],
    };

    // Try calling encodeRunestone with minimal test first
    try {
      const _testResult = encodeRunestone({ edicts: [] });
    } catch (e) {}

    const runestoneResult = encodeRunestone(runestoneConfig);

    // Check if encodedRunestone has the edict data
    if (runestoneResult.encodedRunestone) {
      const _fullHex = Buffer.from(runestoneResult.encodedRunestone).toString('hex');
    }

    const runestoneScript = runestoneResult.encodedRunestone;

    if (runestoneScript) {
      const _scriptHex = Buffer.from(runestoneScript).toString('hex');
    } else {
    }

    // Add outputs (OP_RETURN last) - exactly like working example
    // Output 0: Rune return (gets unallocated runes) - needs 10k sats for rune protocol
    psbt.addOutput({
      address: taprootAddress,
      value: BigInt(runeReturnSats),
    });

    // Output 1: Recipient (gets specified runes via edict)
    psbt.addOutput({
      address: validatedRecipient,
      value: BigInt(recipientSats),
    });

    // Output 2: Change (if any)
    if (change > dustLimit) {
      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(change),
      });
    }

    // Output 3: OP_RETURN with runestone (last)

    psbt.addOutput({
      script: runestoneScript,
      value: BigInt(0),
    });

    // Verify the OP_RETURN was added correctly
    const lastOutputIndex = psbt.txOutputs.length - 1;
    const _lastOutput = psbt.txOutputs[lastOutputIndex];

    // Create intent object
    const intent = {
      id: Date.now().toString(),
      type: 'send',
      assetType: 'UNIT',
      amount: amountInRunes,
      amountDisplay: `${amountInRunes} UNIT`,
      recipient: validatedRecipient,
      fee: fee,
      addressType: 'taproot',
      sourceAddress: taprootAddress,
      feeAddress: segwitAddress,
      runeUtxo,
      satUtxo,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };

    return intent;
  } catch (error) {
    throw error;
  }
};

// Re-export signIntent from dedicated signing service
export { signIntent } from './transactionSigningService';

// Re-export broadcastTransaction from dedicated service
export { broadcastTransaction } from './transactionBroadcastService';
