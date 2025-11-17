/**
 * Runes PSBT Builder Utilities
 * Handles building PSBTs for Runes transactions with runestone encoding
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../../runestone-encoder';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { getTxHexUrl } from '../../utils/constants';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * Fetch transaction hex from API
 * @param {string} txid - Transaction ID
 * @returns {Promise<string>} Transaction hex
 */
export async function fetchTransactionHex(txid) {
  const response = await fetch(getTxHexUrl(txid));
  return await response.text();
}

/**
 * Build PSBT for Runes transaction
 * @param {Object} runeUtxo - Rune UTXO to spend
 * @param {Object} satUtxo - Sat UTXO for fees
 * @param {string} taprootAddress - Source taproot address
 * @param {string} segwitAddress - Change address
 * @param {string} recipient - Recipient address
 * @param {number} amountInRunes - Amount of runes to send
 * @param {number} recipientSats - Sats to send to recipient
 * @param {number} runeReturnSats - Sats for rune return output
 * @param {number} change - Change amount in sats
 * @param {number} dustLimit - Dust limit threshold
 * @returns {Promise<bitcoin.Psbt>} Built PSBT
 */
export async function buildRunesPsbt(
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
