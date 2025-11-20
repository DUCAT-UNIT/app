/**
 * Runes Transaction Service
 * Handles creation of UNIT (Runes) transaction intents with runestone encoding
 */

import { validateAndNormalizeAddress } from '../../utils/bitcoin';
import { ERRORS } from '../../utils/messages';
import { findRuneUtxo, findSatUtxo } from './runesUtxoSelection';
import { buildRunesPsbt } from './runesPsbtBuilder';

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
 * @param {string} amount - Amount string to parse
 * @returns {number} Amount in runes (multiplied by 100)
 */
function parseRuneAmount(amount) {
  const normalizedAmount = amount.replace(',', '.');
  const userAmount = parseFloat(normalizedAmount);

  if (isNaN(userAmount) || userAmount <= 0) {
    throw new Error(ERRORS.INVALID_AMOUNT);
  }

  // Multiply by 100 for runestone encoding (UNIT display amount * 100)
  // Use Math.floor to ensure we get an integer for the runestone
  return Math.floor(userAmount * 100);
}
