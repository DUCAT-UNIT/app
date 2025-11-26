/**
 * Runes PSBT Builder Utilities
 * Handles building PSBTs for Runes transactions with runestone encoding
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from '../../runestone-encoder';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { getTxHexUrl } from '../../utils/constants';
import { RuneUtxo, SatUtxo } from './runesUtxoSelection';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * Fetch transaction hex from API
 * @param txid - Transaction ID
 * @returns Transaction hex
 */
export async function fetchTransactionHex(txid: string): Promise<string> {
  const response = await fetch(getTxHexUrl(txid));
  return await response.text();
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

  // Fetch transaction hex for sat input
  const satTxHex = await fetchTransactionHex(satUtxo.txid);
  const satTx = bitcoin.Transaction.fromHex(satTxHex);

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
  for (const runeUtxo of runeUtxoArray) {
    const runeTxHex = await fetchTransactionHex(runeUtxo.transaction);
    const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

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

  const runestoneResult = encodeRunestone(runestoneConfig) as { encodedRunestone: Buffer };
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
