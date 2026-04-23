/**
 * Runes PSBT Builder Utilities
 * Handles building PSBTs for Runes transactions with runestone encoding
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../../utils/runestoneEncoder';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { getTxHexUrl, RUNES_CONFIG } from '../../utils/constants';
import { RuneUtxo, SatUtxo } from './runesUtxoSelection';
import { logger } from '../../utils/logger';
import { fetchWithTimeout } from '../../utils/api';

// Initialize ECC library
bitcoin.initEccLib(ecc);

const txHexCache = new Map<string, string>();

export function clearTransactionHexCache(): void {
  txHexCache.clear();
}

/**
 * Fetch transaction hex from API with timeout
 * @param txid - Transaction ID
 * @returns Transaction hex
 * @throws Error if request times out after 30 seconds
 */
export async function fetchTransactionHex(txid: string): Promise<string> {
  const cached = txHexCache.get(txid);
  if (cached) {
    return cached;
  }

  const response = await fetchWithTimeout(getTxHexUrl(txid), {}, 12000);

  if (!response.ok) {
    throw new Error(`Failed to fetch transaction ${txid}: ${response.status} ${response.statusText}`);
  }

  const txHex = await response.text();
  txHexCache.set(txid, txHex);
  return txHex;
}

/**
 * Build PSBT for Runes transaction
 * @param runeUtxos - Rune UTXO(s) to spend (array or single object)
 * @param satUtxo - Sat UTXO for fees
 * @param taprootAddress - Source taproot address
 * @param segwitAddress - Change address
 * @param recipient - Recipient address
 * @param amountInRunes - Amount of runes to send
 * @param recipientSats - Sats to send to recipient
 * @param runeReturnSats - Sats for rune return output
 * @param change - Change amount in sats
 * @param dustLimit - Dust limit threshold
 * @returns Built PSBT
 */
export async function buildRunesPsbt(
  runeUtxos: RuneUtxo[] | RuneUtxo,
  satUtxo: SatUtxo,
  taprootAddress: string,
  segwitAddress: string,
  recipient: string,
  amountInRunes: number,
  recipientSats: number,
  runeReturnSats: number,
  change: number,
  dustLimit: number
): Promise<bitcoin.Psbt> {
  const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

  // Normalize runeUtxos to array
  const runeUtxoArray = Array.isArray(runeUtxos) ? runeUtxos : [runeUtxos];

  // Fetch all transaction hexes in parallel (sat input + all rune inputs)
  const [satTxHex, ...runeTxHexes] = await Promise.all([
    fetchTransactionHex(satUtxo.txid),
    ...runeUtxoArray.map((utxo) => fetchTransactionHex(utxo.transaction)),
  ]);
  const satTx = bitcoin.Transaction.fromHex(satTxHex);
  if (satTx.getId() !== satUtxo.txid) {
    throw new Error(`Fetched fee input transaction does not match expected txid ${satUtxo.txid}`);
  }
  if (!satTx.outs[satUtxo.vout]) {
    throw new Error(`Fee input output ${satUtxo.vout} not found in transaction ${satUtxo.txid}`);
  }
  if (BigInt(satTx.outs[satUtxo.vout].value) !== BigInt(satUtxo.value)) {
    throw new Error(`Fee input value mismatch for ${satUtxo.txid}:${satUtxo.vout}`);
  }

  // Validate addresses early to prevent malformed change/recipient outputs
  if (typeof bitcoin.address.toOutputScript === 'function') {
    try {
      bitcoin.address.toOutputScript(recipient, MUTINYNET_NETWORK);
      bitcoin.address.toOutputScript(segwitAddress, MUTINYNET_NETWORK);
    } catch (err) {
      throw new Error(`Invalid runes recipient or change address: ${(err as Error).message}`);
    }
  }

  // Decode taproot address
  const { data: taprootData } = bitcoin.address.fromBech32(taprootAddress);
  const tapInternalKey = Buffer.from(taprootData);

  // Add Input 0: P2WPKH (for fees)
  psbt.addInput({
    hash: satUtxo.txid,
    index: parseInt(String(satUtxo.vout), 10),
    witnessUtxo: {
      script: Buffer.from(satTx.outs[satUtxo.vout].script),
      value: BigInt(satUtxo.value),
    },
  });

  // Add all rune inputs (Input 1, 2, 3, ... N)
  for (let i = 0; i < runeUtxoArray.length; i++) {
    const runeUtxo = runeUtxoArray[i];
    const runeTx = bitcoin.Transaction.fromHex(runeTxHexes[i]);
    if (runeTx.getId() !== runeUtxo.transaction) {
      throw new Error(`Fetched rune input transaction does not match expected txid ${runeUtxo.transaction}`);
    }
    if (!runeTx.outs[runeUtxo.vout]) {
      throw new Error(`Rune input output ${runeUtxo.vout} not found in transaction ${runeUtxo.transaction}`);
    }
    if (BigInt(runeTx.outs[runeUtxo.vout].value) !== BigInt(runeUtxo.value)) {
      throw new Error(`Rune input value mismatch for ${runeUtxo.transaction}:${runeUtxo.vout}`);
    }

    psbt.addInput({
      hash: runeUtxo.transaction,
      index: parseInt(String(runeUtxo.vout), 10),
      witnessUtxo: {
        script: Buffer.from(runeTx.outs[runeUtxo.vout].script),
        value: BigInt(runeUtxo.value),
      },
      tapInternalKey: tapInternalKey,
    });
  }

  // Validate Rune ID before creating transaction
  // This prevents accidental use of wrong rune ID which could cause loss of funds
  const runeId = RUNES_CONFIG.DUCAT_UNIT_RUNE_ID;

  // Log rune ID being used for audit trail
  logger.transaction('Building Runes PSBT', {
    runeId: `${runeId.block}:${runeId.tx}`,
    expectedLabel: RUNES_CONFIG.DUCAT_UNIT_RUNE_LABEL,
    amountInRunes,
    recipient,
  });

  // Create runestone with validated Rune ID
  const runestoneConfig = {
    edicts: [
      {
        id: runeId, // Use centralized constant
        amount: BigInt(amountInRunes),
        output: 1, // Recipient is at output 1
      },
    ],
  };

  const runestoneResult = encodeRunestone(runestoneConfig) as { encodedRunestone: Buffer };
  const runestoneScript = runestoneResult.encodedRunestone;

  // Add outputs
  // Output 0: Rune return (gets unallocated runes)
  psbt.addOutput({
    address: taprootAddress,
    value: BigInt(runeReturnSats),
  });

  // Output 1: Recipient (gets specified runes via edict)
  if (recipientSats < dustLimit) {
    throw new Error('Recipient output below dust limit');
  }
  psbt.addOutput({
    address: recipient,
    value: BigInt(recipientSats),
  });

  // Output 2: Change (if above dust limit)
  if (change >= dustLimit) {
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
