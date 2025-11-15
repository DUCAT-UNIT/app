/**
 * Runes Transaction Service
 * Handles creation of UNIT (Runes) transaction intents with runestone encoding
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../../runestone-encoder';
import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../../utils/bitcoin';
import { ERRORS } from '../../utils/messages';
import logger from '../../utils/logger';
import {
  getTxHexUrl,
  getOrdAddressUrl,
  getOrdOutputUrl,
  getTxOutspendUrl,
  getAddressUtxoUrl,
} from '../../utils/constants';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * Create a UNIT (Runes) transaction intent with runestone encoding
 * @param {string} recipient - Recipient Bitcoin address
 * @param {string} amount - Amount of runes (as string, e.g. "100")
 * @param {string} taprootAddress - Source Taproot address
 * @param {string} segwitAddress - SegWit address for fees
 * @param {number} currentAccount - Current account index
 * @param {Array} unconfirmedTaprootUtxos - Unconfirmed taproot UTXOs
 * @param {Array} unconfirmedSegwitUtxos - Unconfirmed segwit UTXOs
 * @param {Set} spentUtxos - Set of spent UTXO keys
 * @returns {Promise<Object>} Transaction intent object
 */
export async function createUnitIntent(
  recipient,
  amount,
  taprootAddress,
  segwitAddress,
  _currentAccount,
  unconfirmedTaprootUtxos = [],
  unconfirmedSegwitUtxos = [],
  spentUtxos = new Set()
) {
  try {
    // Validate recipient address (must be Taproot)
    const validatedRecipient = validateAndNormalizeAddress(recipient);

    if (!validatedRecipient.startsWith('tb1p') && !validatedRecipient.startsWith('bc1p')) {
      throw new Error('UNIT transfers require a Taproot address (starting with tb1p)');
    }

    // Parse amount and multiply by 100 for runestone encoding
    const amountInRunes = parseRuneAmount(amount);

    // Find rune UTXO with sufficient balance
    const runeUtxo = await findRuneUtxo(
      taprootAddress,
      amountInRunes,
      unconfirmedTaprootUtxos,
      spentUtxos
    );

    if (!runeUtxo) {
      throw new Error(ERRORS.NO_UNIT_BALANCE);
    }

    // Find sat UTXO for fees
    const satUtxo = await findSatUtxo(segwitAddress, unconfirmedSegwitUtxos, spentUtxos);

    if (!satUtxo) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    }

    // Calculate transaction amounts
    const fee = 1000;
    const recipientSats = 10000;
    const runeReturnSats = 10000;
    const dustLimit = 546;
    const totalInput = satUtxo.value + runeUtxo.value;
    const change = totalInput - fee - recipientSats - runeReturnSats;

    if (change < 0) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Build PSBT
    const psbt = await buildRunesPsbt(
      runeUtxo,
      satUtxo,
      taprootAddress,
      segwitAddress,
      validatedRecipient,
      amountInRunes,
      recipientSats,
      runeReturnSats,
      change,
      dustLimit
    );

    // Create intent object
    return {
      id: Date.now().toString(),
      type: 'send',
      assetType: 'UNIT',
      amount: amountInRunes,
      amountDisplay: `${amountInRunes} UNIT`,
      recipient: validatedRecipient,
      fee,
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
  } catch (error) {
    throw error;
  }
}

/**
 * Parse rune amount from string input
 */
function parseRuneAmount(amount) {
  const normalizedAmount = amount.replace(',', '.');
  const userAmount = parseInt(normalizedAmount, 10);

  if (isNaN(userAmount) || userAmount <= 0) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  // Multiply by 100 for runestone encoding (UNIT display amount * 100)
  return userAmount * 100;
}

/**
 * Find a rune UTXO with sufficient balance
 */
async function findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos) {
  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent rune UTXO:', key);
      continue;
    }

    if (utxo.runeAmount && utxo.runeAmount >= amountInRunes) {
      return {
        transaction: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        runeAmount: utxo.runeAmount,
        status: { confirmed: false },
      };
    }
  }

  // Fetch confirmed rune UTXOs from ord API
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
        const key = `${utxoData.transaction}:${vout}`;

        // Check if already spent
        if (spentUtxos.has(key)) {
          logger.debug('⚠️ Skipping spent rune UTXO from ord API:', key);
          continue;
        }

        // Verify unspent on blockchain
        const spendResponse = await fetch(getTxOutspendUrl(utxoData.transaction, vout));
        const spendData = await spendResponse.json();

        if (!spendData.spent) {
          return {
            transaction: utxoData.transaction,
            vout: vout,
            value: utxoData.value,
            runeAmount: runeAmount,
            status: { confirmed: true },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Find a sat UTXO for fees
 */
async function findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos) {
  const MIN_FEE_SATS = 12000;

  // Check unconfirmed UTXOs first
  for (const utxo of unconfirmedUtxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO:', key);
      continue;
    }

    if (utxo.value >= MIN_FEE_SATS) {
      return {
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: { confirmed: false },
      };
    }
  }

  // Fetch confirmed UTXOs
  const utxoResponse = await fetch(getAddressUtxoUrl(segwitAddress));
  const utxos = await utxoResponse.json();

  // Find confirmed UTXO with sufficient sats
  for (const utxo of utxos) {
    const key = `${utxo.txid}:${utxo.vout}`;
    if (spentUtxos.has(key)) {
      logger.debug('⚠️ Skipping spent sat UTXO from blockchain API:', key);
      continue;
    }

    if (utxo.status.confirmed && utxo.value >= MIN_FEE_SATS) {
      return {
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: { confirmed: true },
      };
    }
  }

  return null;
}

/**
 * Build PSBT for Runes transaction
 */
async function buildRunesPsbt(
  runeUtxo,
  satUtxo,
  taprootAddress,
  segwitAddress,
  recipient,
  amountInRunes,
  recipientSats,
  runeReturnSats,
  change,
  dustLimit
) {
  const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

  // Fetch transaction hex for inputs
  const satTxHex = await fetchTransactionHex(satUtxo.txid);
  const satTx = bitcoin.Transaction.fromHex(satTxHex);

  const runeTxHex = await fetchTransactionHex(runeUtxo.transaction);
  const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

  // Decode taproot address
  const { data: taprootData } = bitcoin.address.fromBech32(taprootAddress);
  const tapInternalKey = Buffer.from(taprootData);

  // Add Input 0: P2WPKH (for fees)
  psbt.addInput({
    hash: satUtxo.txid,
    index: parseInt(satUtxo.vout, 10),
    witnessUtxo: {
      script: Buffer.from(satTx.outs[satUtxo.vout].script),
      value: BigInt(satUtxo.value),
    },
  });

  // Add Input 1: Taproot (with runes)
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

  const runestoneResult = encodeRunestone(runestoneConfig);
  const runestoneScript = runestoneResult.encodedRunestone;

  // Add outputs
  // Output 0: Rune return (gets unallocated runes)
  psbt.addOutput({
    address: taprootAddress,
    value: BigInt(runeReturnSats),
  });

  // Output 1: Recipient (gets specified runes via edict)
  psbt.addOutput({
    address: recipient,
    value: BigInt(recipientSats),
  });

  // Output 2: Change (if above dust limit)
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

  return psbt;
}

/**
 * Fetch transaction hex from API
 */
async function fetchTransactionHex(txid) {
  const response = await fetch(getTxHexUrl(txid));
  return await response.text();
}
