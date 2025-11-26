/**
 * PSBT Service
 * Handles parsing and analysis of PSBTs (Partially Signed Bitcoin Transactions)
 */

import * as bitcoin from 'bitcoinjs-lib';
import { logger } from '../utils/logger';

export interface PSBTInput {
  address: string;
  value: number;
  type: 'rune' | 'fee' | 'btc';
  runeAmount?: number;
}

export interface PSBTOutput {
  address: string;
  value: number;
  type: 'op_return' | 'rune_return' | 'recipient' | 'change';
  index?: number;
}

export interface ParsedPSBT {
  psbtInputs: PSBTInput[];
  psbtOutputs: PSBTOutput[];
  actualFee: number;
}

interface RuneUtxo {
  value: number;
  runeAmount: number;
  status?: {
    confirmed: boolean;
  };
}

interface SatUtxo {
  value: number;
  status?: {
    confirmed: boolean;
  };
}

interface TransactionInput {
  value: number;
  status?: {
    confirmed: boolean;
  };
}

export interface SendIntent {
  psbt: string;
  assetType?: 'UNIT' | 'BTC';
  sourceAddress?: string;
  feeAddress?: string;
  recipient?: string;
  amount?: number;
  amountBTC?: string;
  change?: number;
  runeUtxo?: RuneUtxo;
  satUtxo?: SatUtxo;
  inputs?: TransactionInput[];
}

/**
 * Parse PSBT and extract inputs, outputs, and calculate fees
 * @param sendIntent - The send intent containing PSBT and transaction details
 * @returns { psbtInputs, psbtOutputs, actualFee }
 */
export function parsePSBT(sendIntent: SendIntent): ParsedPSBT {
  try {
    const psbt = bitcoin.Psbt.fromBase64(sendIntent.psbt);

    // Build inputs based on transaction type
    const inputs = buildInputs(sendIntent);

    // Parse outputs from PSBT
    const outputs = parseOutputs(psbt, sendIntent);

    // Calculate actual fee: sum of inputs - sum of outputs
    const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0);
    const totalOutputValue = outputs.reduce((sum, output) => sum + output.value, 0);
    const fee = totalInputValue - totalOutputValue;

    return {
      psbtInputs: inputs,
      psbtOutputs: outputs,
      actualFee: fee
    };
  } catch (error) {
    logger.error(error as Error, { context: 'Error decoding PSBT' });
    return {
      psbtInputs: [],
      psbtOutputs: [],
      actualFee: 0
    };
  }
}

/**
 * Build inputs array based on transaction type
 * @param sendIntent - The send intent
 * @returns Array of input objects
 */
function buildInputs(sendIntent: SendIntent): PSBTInput[] {
  const inputs: PSBTInput[] = [];

  if (sendIntent.assetType === 'UNIT') {
    // For UNIT transactions, we have runeUtxo and satUtxo
    if (sendIntent.runeUtxo) {
      inputs.push({
        address: sendIntent.sourceAddress!,
        value: sendIntent.runeUtxo.value,
        type: 'rune',
        runeAmount: sendIntent.runeUtxo.runeAmount,
      });
    }
    if (sendIntent.satUtxo) {
      inputs.push({
        address: sendIntent.feeAddress!,
        value: sendIntent.satUtxo.value,
        type: 'fee',
      });
    }
  } else {
    // For BTC transactions, use the inputs from sendIntent
    inputs.push(...(sendIntent.inputs || []).map((input) => ({
      address: sendIntent.sourceAddress!,
      value: input.value,
      type: 'btc' as const,
    })));
  }

  return inputs;
}

/**
 * Parse outputs from PSBT transaction
 * @param psbt - The parsed PSBT object
 * @param sendIntent - The send intent
 * @returns Array of output objects
 */
function parseOutputs(psbt: bitcoin.Psbt, sendIntent: SendIntent): PSBTOutput[] {
  return psbt.txOutputs.map((output, index) => {
    // Check for OP_RETURN first (script starts with 0x6a)
    if (output.script[0] === 0x6a) {
      return {
        address: 'OP_RETURN (Runestone)',
        value: Number(output.value),
        type: 'op_return' as const,
        index,
      };
    }

    // Try to decode address from script
    let address = 'Unknown';
    try {
      address = bitcoin.address.fromOutputScript(
        output.script,
        bitcoin.networks.testnet
      );
    } catch (e) {
      // Failed to decode address - keep as 'Unknown'
    }

    // Determine output type
    const type = determineOutputType(
      sendIntent,
      index,
      address
    );

    return {
      address,
      value: Number(output.value),
      type,
      index,
    };
  });
}

/**
 * Determine the type of output based on transaction details
 * @param sendIntent - The send intent
 * @param index - Output index
 * @param address - Output address
 * @returns Output type
 */
function determineOutputType(
  sendIntent: SendIntent,
  index: number,
  address: string
): 'rune_return' | 'recipient' | 'change' {
  if (sendIntent.assetType === 'UNIT') {
    // UNIT transaction output types
    if (index === 0) {
      return 'rune_return'; // Unallocated runes return
    } else if (index === 1) {
      return 'recipient'; // UNIT recipient
    } else {
      return 'change'; // BTC change
    }
  } else {
    // BTC transaction output types
    if (address === sendIntent.recipient) {
      return 'recipient';
    } else {
      return 'change';
    }
  }
}

/**
 * Build fallback outputs when PSBT parsing fails
 * @param sendIntent - The send intent
 * @returns Array of fallback output objects
 */
export function buildFallbackOutputs(sendIntent: SendIntent): PSBTOutput[] {
  const outputs: PSBTOutput[] = [];

  // Add recipient output
  outputs.push({
    address: sendIntent.recipient!,
    value: sendIntent.assetType === 'UNIT'
      ? sendIntent.amount!
      : Math.floor(parseFloat(sendIntent.amountBTC!) * 100000000),
    type: 'recipient'
  });

  // Add change output if present
  if (sendIntent.change && sendIntent.change > 0) {
    outputs.push({
      address: sendIntent.sourceAddress!,
      value: sendIntent.change,
      type: 'change'
    });
  }

  return outputs;
}

/**
 * Check if transaction has unconfirmed inputs
 * @param sendIntent - The send intent
 * @returns True if any inputs are unconfirmed
 */
export function hasUnconfirmedInputs(sendIntent: SendIntent | null | undefined): boolean {
  if (!sendIntent) return false;

  if (sendIntent.assetType === 'UNIT') {
    // Check rune UTXO and sat UTXO
    const runeUnconfirmed = sendIntent.runeUtxo?.status?.confirmed === false;
    const satUnconfirmed = sendIntent.satUtxo?.status?.confirmed === false;
    return runeUnconfirmed || satUnconfirmed;
  } else {
    // Check BTC inputs
    return (sendIntent.inputs || []).some(
      input => input.status?.confirmed === false
    );
  }
}
