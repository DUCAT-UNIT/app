/**
 * Runes Transaction Service
 * Handles creation of UNIT (Runes) transaction intents with runestone encoding
 */

import { validateAndNormalizeAddress } from '../../utils/bitcoin';
import { ERRORS } from '../../utils/messages';
import { BITCOIN_TX } from '../../utils/constants';
import { findRuneUtxo, findSatUtxo, RuneUtxo, SatUtxo } from './runesUtxoSelection';
import { buildRunesPsbt } from './runesPsbtBuilder';

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

    if (!validatedRecipient.startsWith('tb1p') && !validatedRecipient.startsWith('bc1p')) {
      throw new Error('UNIT transfers require a Taproot address (starting with tb1p)');
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
    const fee = BITCOIN_TX.ESTIMATED_TX_FEE;
    const recipientSats = BITCOIN_TX.RUNE_OUTPUT_AMOUNT;
    const runeReturnSats = BITCOIN_TX.RUNE_OUTPUT_AMOUNT;
    const dustLimit = BITCOIN_TX.DUST_LIMIT;

    // Sum up all rune UTXO values
    const totalRuneUtxoValue = runeUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalInput = satUtxo.value + totalRuneUtxoValue;

    // Calculate total required (recipient + rune return + fee)
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
  const normalizedAmount = amount.replace(',', '.');
  const userAmount = parseFloat(normalizedAmount);

  if (isNaN(userAmount) || userAmount <= 0) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  // Multiply by 100 for runestone encoding (UNIT display amount * 100)
  // Use Math.round to ensure we get an integer and avoid floating point errors
  // (e.g., 8.45 * 100 = 844.9999... should become 845, not 844)
  return Math.round(userAmount * 100);
}
