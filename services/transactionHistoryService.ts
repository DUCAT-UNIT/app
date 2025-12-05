/**
 * Transaction History Service
 * Handles fetching and processing transaction history from blockchain APIs
 */

import { retrySilently } from '../utils/retry';
import { decodeRunestone } from '../utils/runestoneEncoder';
import { fetchVaultHistory } from './vaultService';
import { getAddressTxsUrl } from '../utils/constants';
import { logger } from '../utils/logger';

// UNIT•RUNE identifier
const UNIT_RUNE_BLOCK = 1527352n;
const UNIT_RUNE_TX = 1n;

export interface TransactionOutput {
  value: number;
  scriptpubkey?: string;
  scriptpubkey_address?: string;
  scriptpubkey_type?: string;
}

export interface TransactionInput {
  prevout?: {
    scriptpubkey_address?: string;
    value?: number;
  };
}

export interface Transaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_time: number;
    block_height?: number;
    block_hash?: string;
  };
  vin?: TransactionInput[];
  vout?: TransactionOutput[];
  vaultTransaction?: boolean;
  vaultData?: {
    action: string;
    amountBorrowed?: number;
    vaultAmount?: number;
    btcAmount?: number;
    unitAmount?: number;
    oraclePrice?: number;
  };
}

export interface RuneTransferAmount {
  amount: bigint;
  type: 'UNIT';
}

export interface BTCTransactionAmount {
  amount: number;
  type: 'BTC';
  isSelfTransfer?: boolean;
}

export type TransactionAmount = RuneTransferAmount | BTCTransactionAmount;

export interface VaultTransaction {
  transaction_id?: string;
  timestamp: number;
  action: string;
  amount_borrowed?: number;
  vault_amount?: number;
  btc_amt?: number;
  unit_amt?: number;
  oracle_price?: number;
}

interface RuneEdict {
  id: {
    block: bigint;
    tx: bigint;
  };
  amount: bigint;
  output: bigint;
}

interface Runestone {
  edicts?: RuneEdict[];
}

/**
 * Fetch all transactions for a specific address with pagination
 * Esplora API returns 25 txs per page, we need to paginate to get all
 * @param address - Bitcoin address
 * @returns Array of all transactions
 */
export const fetchAddressTransactions = async (address: string): Promise<Transaction[]> => {
  try {
    const allTxs: Transaction[] = [];
    let lastSeenTxid: string | null = null;
    let hasMore = true;

    // Fetch up to 1000 transactions (40 pages of 25)
    // This prevents infinite loops while being generous for power users
    const maxPages = 40;
    let pageCount = 0;

    while (hasMore && pageCount < maxPages) {
      const url = getAddressTxsUrl(address, lastSeenTxid);

      const response = await retrySilently(() => fetch(url));

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const txs = await response.json() as Transaction[];

      if (!txs || txs.length === 0) {
        hasMore = false;
        break;
      }

      allTxs.push(...txs);

      // If we got less than 25, we've reached the end
      if (txs.length < 25) {
        hasMore = false;
      } else {
        // Set last seen txid for next page
        lastSeenTxid = txs[txs.length - 1].txid;
      }

      pageCount++;
    }

    return allTxs;
  } catch (error: unknown) {
    logger.warn('Failed to fetch address transactions', {
      address: address.substring(0, 10) + '...',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

/**
 * Parse rune transfers from transaction outputs
 * Returns UNIT amount if this is a UNIT transfer, or null
 * @param tx - Transaction object
 * @param segwitAddress - User's segwit address
 * @param taprootAddress - User's taproot address
 * @returns { amount: bigint, type: 'UNIT' } or null
 */
export const parseRuneTransfer = (
  tx: Transaction,
  segwitAddress: string,
  taprootAddress: string
): RuneTransferAmount | null => {
  try {
    // Look for OP_RETURN output
    const opReturnOutput = tx.vout?.find((output) => {
      return output.scriptpubkey?.startsWith('6a5d'); // OP_RETURN + OP_13
    });

    if (!opReturnOutput || !opReturnOutput.scriptpubkey) {
      return null;
    }

    // Decode the runestone
    const runestone = decodeRunestone(opReturnOutput.scriptpubkey) as Runestone;
    if (!runestone || !runestone.edicts || runestone.edicts.length === 0) {
      return null;
    }

    // Find UNIT rune edicts
    const unitEdicts = runestone.edicts.filter(
      (edict) => edict.id.block === UNIT_RUNE_BLOCK && edict.id.tx === UNIT_RUNE_TX
    );

    if (unitEdicts.length === 0) {
      return null;
    }

    // Determine if we're sending or receiving
    const isOurInput = tx.vin?.some((input) => {
      return (
        input.prevout?.scriptpubkey_address === segwitAddress ||
        input.prevout?.scriptpubkey_address === taprootAddress
      );
    });

    let netUnitChange = 0n;
    let hasOurOutput = false;

    for (const edict of unitEdicts) {
      const outputIndex = Number(edict.output);
      const targetOutput = tx.vout?.[outputIndex];

      if (!targetOutput) {
        continue;
      }

      const isOurOutput =
        targetOutput.scriptpubkey_address === segwitAddress ||
        targetOutput.scriptpubkey_address === taprootAddress;

      if (isOurOutput) {
        hasOurOutput = true;
      }

      if (isOurInput) {
        // We're sending - count transfers to non-our addresses as negative
        if (!isOurOutput) {
          netUnitChange -= edict.amount;
        }
      } else {
        // We're receiving - count transfers to our addresses as positive
        if (isOurOutput) {
          netUnitChange += edict.amount;
        }
      }
    }

    // Only return UNIT transaction if we're actually involved (input or output)
    if (isOurInput || hasOurOutput) {
      return { amount: netUnitChange, type: 'UNIT' };
    }

    return null;
  } catch (error: unknown) {
    logger.debug('Failed to parse rune transfer', {
      txid: tx.txid,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Calculate the net change for this transaction
 * Positive = received, Negative = sent
 * @param tx - Transaction object
 * @param segwitAddress - User's segwit address
 * @param taprootAddress - User's taproot address
 * @returns { amount: number|bigint, type: 'BTC'|'UNIT', isSelfTransfer?: boolean }
 */
export const calculateTransactionAmount = (
  tx: Transaction,
  segwitAddress: string,
  taprootAddress: string
): TransactionAmount => {
  // First check if this is a rune transfer
  const runeTransfer = parseRuneTransfer(tx, segwitAddress, taprootAddress);
  if (runeTransfer) {
    return runeTransfer;
  }

  // Otherwise calculate BTC amount
  // Calculate total inputs from our addresses
  let ourInputs = 0;
  let ourOutputs = 0;
  let hasNonOurOutput = false;

  // Check if any inputs are from our addresses
  const isOurInput = tx.vin?.some((input) => {
    const isOurs =
      input.prevout?.scriptpubkey_address === segwitAddress ||
      input.prevout?.scriptpubkey_address === taprootAddress;
    if (isOurs) {
      ourInputs += input.prevout?.value || 0;
    }
    return isOurs;
  });

  // Sum up outputs to our addresses and check for external outputs
  tx.vout?.forEach((output) => {
    const isOurOutput =
      output.scriptpubkey_address === segwitAddress ||
      output.scriptpubkey_address === taprootAddress;
    if (isOurOutput) {
      ourOutputs += output.value;
    } else if (output.scriptpubkey_type !== 'op_return') {
      // Not our output and not OP_RETURN (ignore OP_RETURN for runes/metadata)
      hasNonOurOutput = true;
    }
  });

  // Detect self-transfer: all inputs are ours AND all non-OP_RETURN outputs are ours
  if (isOurInput && !hasNonOurOutput) {
    // This is a self-transfer (consolidation or moving to own address)
    // Return 0 to indicate self-transfer
    return { amount: 0, type: 'BTC', isSelfTransfer: true };
  }

  // Calculate net change
  // If we're sending (have inputs), net = outputs - inputs (will be negative)
  // If we're receiving (no inputs), net = outputs (will be positive)
  const netChange = isOurInput ? ourOutputs - ourInputs : ourOutputs;

  return { amount: netChange, type: 'BTC' };
};

/**
 * Fetch and aggregate all transaction history from multiple sources
 * @param segwitAddress - User's segwit address
 * @param taprootAddress - User's taproot address
 * @param vaultPubkey - User's vault public key
 * @returns Sorted array of all transactions
 */
export const fetchAllTransactionHistory = async (
  segwitAddress: string,
  taprootAddress: string,
  vaultPubkey: string
): Promise<Transaction[]> => {
  try {
    logger.debug('🌐 Making fresh API calls to blockchain explorer and vault...');
    // Fetch transactions for both addresses and vault history
    const [segwitTxs, taprootTxs, vaultHistory] = await Promise.all([
      fetchAddressTransactions(segwitAddress),
      fetchAddressTransactions(taprootAddress),
      fetchVaultHistory(vaultPubkey) as Promise<VaultTransaction[]>,
    ]);
    logger.debug('📊 API responses received:');
    logger.debug('  - Segwit transactions:', { count: segwitTxs.length });
    logger.debug('  - Taproot transactions:', { count: taprootTxs.length });
    logger.debug('  - Vault transactions:', { count: vaultHistory.length });

    // First, collect all vault transaction IDs
    const vaultTxIds = new Set<string>();
    vaultHistory.forEach((vaultTx) => {
      if (vaultTx.transaction_id) {
        vaultTxIds.add(vaultTx.transaction_id);
      }
    });

    // Combine and deduplicate by txid, but exclude any that are vault transactions
    const txMap = new Map<string, Transaction>();
    [...segwitTxs, ...taprootTxs].forEach((tx) => {
      // Skip if this txid is a vault transaction
      if (!vaultTxIds.has(tx.txid) && !txMap.has(tx.txid)) {
        txMap.set(tx.txid, tx);
      }
    });

    // Add vault transactions
    vaultHistory.forEach((vaultTx: VaultTransaction) => {
      // Create a synthetic transaction object for vault transactions
      const syntheticTx: Transaction = {
        txid: vaultTx.transaction_id || `vault-${vaultTx.timestamp}`,
        status: {
          confirmed: true,
          block_time: vaultTx.timestamp,
        },
        vaultTransaction: true,
        vaultData: {
          action: vaultTx.action,
          amountBorrowed: vaultTx.amount_borrowed,
          vaultAmount: vaultTx.vault_amount,
          btcAmount: vaultTx.btc_amt,
          unitAmount: vaultTx.unit_amt,
          oraclePrice: vaultTx.oracle_price,
        },
      };

      txMap.set(syntheticTx.txid, syntheticTx);
    });

    // Convert back to array and sort by timestamp (most recent first)
    const allTxs = Array.from(txMap.values()).sort(
      (a, b) => b.status.block_time - a.status.block_time
    );

    return allTxs;
  } catch (error: unknown) {
    throw error;
  }
};
