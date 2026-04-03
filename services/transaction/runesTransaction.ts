/**
 * Runes Transaction Service
 * Handles creation of UNIT (Runes) transaction intents with runestone encoding
 */

import { MUTINYNET_NETWORK, validateAndNormalizeAddress } from '../../utils/bitcoin';
import { ERRORS } from '../../utils/messages';
import { BITCOIN_TX } from '../../utils/constants';
import { findRuneUtxo, findSatUtxo, RuneUtxo, SatUtxo } from './runesUtxoSelection';
import { buildRunesPsbt } from './runesPsbtBuilder';
import { getRecommendedFeeRate } from '../feeEstimationService';
import { createFeeCalculator } from './utxoSelection';
import { logger } from '../../utils/logger';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

export interface UnitTransactionIntent {
  id: string;
  type: 'send';
  assetType: 'UNIT';
  amount: number;
  amountDisplay: string;
  recipient: string;
  fee: number;
  addressType: 'taproot';
  sourceAddress: string;
  feeAddress: string;
  runeUtxos: RuneUtxo[];
  runeUtxo: RuneUtxo; // Keep backward compatibility (first UTXO)
  satUtxo: SatUtxo;
  totalInput: number;
  change: number;
  psbt: string;
  timestamp: number;
}

interface UnconfirmedUtxo {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
}

/**
 * Create a UNIT (Runes) transaction intent with runestone encoding
 * @param recipient - Recipient Bitcoin address
 * @param amount - Amount of runes (as string, e.g. "100")
 * @param taprootAddress - Source Taproot address
 * @param segwitAddress - SegWit address for fees
 * @param currentAccount - Current account index
 * @param unconfirmedTaprootUtxos - Unconfirmed taproot UTXOs
 * @param unconfirmedSegwitUtxos - Unconfirmed segwit UTXOs
 * @param spentUtxos - Set of spent UTXO keys
 * @returns Transaction intent object
 */
export async function createUnitIntent(
  recipient: string,
  amount: string,
  taprootAddress: string,
  segwitAddress: string,
  _currentAccount: number,
  unconfirmedTaprootUtxos: UnconfirmedUtxo[] = [],
  unconfirmedSegwitUtxos: UnconfirmedUtxo[] = [],
  spentUtxos: Set<string> = new Set()
): Promise<UnitTransactionIntent> {
  try {
    // Validate recipient address (must be Taproot)
    const validatedRecipient = validateAndNormalizeAddress(recipient);
    const bech32Hrp = typeof MUTINYNET_NETWORK.bech32 === 'string' ? MUTINYNET_NETWORK.bech32 : 'tb';
    const expectedTaprootPrefix = `${bech32Hrp}1p`;

    if (!validatedRecipient.toLowerCase().startsWith(expectedTaprootPrefix)) {
      throw new Error(`UNIT transfers require a Taproot address (starting with ${expectedTaprootPrefix})`);
    }

    // Parse amount and multiply by 100 for runestone encoding
    const amountInRunes = parseRuneAmount(amount);

    // Find rune UTXOs with sufficient balance (may return multiple)
    const runeUtxos = await findRuneUtxo(
      taprootAddress,
      amountInRunes,
      unconfirmedTaprootUtxos,
      spentUtxos
    );

    if (!runeUtxos || runeUtxos.length === 0) {
      throw new Error(ERRORS.NO_UNIT_BALANCE);
    }

    // Find sat UTXO for fees
    const satUtxo = await findSatUtxo(segwitAddress, unconfirmedSegwitUtxos, spentUtxos);

    if (!satUtxo) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    }

    // Calculate transaction amounts
    const recipientSats = BITCOIN_TX.RUNE_OUTPUT_AMOUNT;
    const runeReturnSats = BITCOIN_TX.RUNE_OUTPUT_AMOUNT;
    const dustLimit = BITCOIN_TX.DUST_LIMIT;

    // H-06: Wrap fee rate in try-catch with fallback, matching BTC implementation
    let feeRate: number;
    try {
      feeRate = await getRecommendedFeeRate();
    } catch {
      logger.warn('[Runes Intent] Fee rate estimation failed, using fallback rate of 1 sat/vB');
      feeRate = 1;
    }

    const inputCount = runeUtxos.length + 1; // rune inputs + sat input
    const feeCalculator = createFeeCalculator(feeRate);

    // Sum up all rune UTXO values
    const totalRuneUtxoValue = runeUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalInput = satUtxo.value + totalRuneUtxoValue;

    // H-07: Calculate initial fee estimate with conservative 4 outputs,
    // then compute change to determine actual output count and recalculate
    const initialFee = feeCalculator(inputCount, 4);
    const initialTotalRequired = recipientSats + runeReturnSats + initialFee;
    const initialChange = totalInput - initialTotalRequired;

    // Now that change is known, determine actual output count:
    // outputs = rune return + recipient + OP_RETURN + optional change
    const outputCount = initialChange > dustLimit ? 4 : 3;
    const fee = feeCalculator(inputCount, outputCount);

    // Recalculate with final fee
    const totalRequired = recipientSats + runeReturnSats + fee;
    const change = totalInput - totalRequired;

    if (change < 0) {
      throw new Error(ERRORS.INSUFFICIENT_FUNDS);
    }

    // Build PSBT with multiple rune UTXOs
    const psbt = await buildRunesPsbt(
      runeUtxos,
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
      id: `${Date.now()}-${Buffer.from(Crypto.getRandomBytes(8)).toString('hex')}`,
      type: 'send',
      assetType: 'UNIT',
      amount: amountInRunes,
      amountDisplay: `${amountInRunes} UNIT`,
      recipient: validatedRecipient,
      fee,
      addressType: 'taproot',
      sourceAddress: taprootAddress,
      feeAddress: segwitAddress,
      runeUtxos, // Now an array
      runeUtxo: runeUtxos[0], // Keep backward compatibility (first UTXO)
      satUtxo,
      totalInput,
      change,
      psbt: psbt.toBase64(),
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    throw error;
  }
}

/**
 * Parse rune amount from string input
 * @param amount - Amount string to parse
 * @returns Amount in runes (multiplied by 100)
 */
function parseRuneAmount(amount: string): number {
  const normalized = amount.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  const [whole, frac = ''] = normalized.split('.');
  const wholeInt = BigInt(whole);
  const fracInt = BigInt(frac.padEnd(2, '0'));

  const total = wholeInt * 100n + fracInt;

  if (total <= 0) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  return Number(total);
}
