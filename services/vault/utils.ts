/**
 * Vault Operations Utility Functions
 */

import type {
  BaseUtxo,
  VaultPrevout,
  VaultProfile,
  VaultReturnData,
  VaultWallet,
} from '@ducat-unit/client-sdk';
import { Buffer } from 'buffer';
import { SEGWIT_ADDRESS_PREFIX } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';

/**
 * Vault operation mutex — serializes vault operations to prevent concurrent
 * UTXO usage that could cause double-spend rejections from Guardian.
 * Without this, simultaneous deposit + borrow could select the same UTXOs.
 *
 * Uses a Map keyed by vault pubkey so that operations on different accounts
 * (different vault pubkeys) can proceed independently, while operations on
 * the same vault are properly serialized.
 */
const _vaultOpLocks: Map<string, Promise<void>> = new Map();

export function withVaultOperationLock<T>(fn: () => Promise<T>, key = '__default__'): Promise<T> {
  let release: () => void;
  const _next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const existing = _vaultOpLocks.get(key) || Promise.resolve();
  const result = existing.then(fn);
  _vaultOpLocks.set(key, result.then(
    () => { release(); },
    () => { release(); }
  ));
  return result;
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  script: string;
}

/**
 * Read a varint from buffer
 */
export function readVarInt(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  if (!Number.isInteger(offset) || offset < 0 || offset >= buffer.length) {
    throw new Error('Varint offset out of bounds');
  }

  const first = buffer[offset];
  if (first < 0xfd) {
    return { value: first, bytesRead: 1 };
  } else if (first === 0xfd) {
    if (offset + 2 >= buffer.length) {
      throw new Error('Truncated 16-bit varint');
    }
    return { value: buffer.readUInt16LE(offset + 1), bytesRead: 3 };
  } else if (first === 0xfe) {
    if (offset + 4 >= buffer.length) {
      throw new Error('Truncated 32-bit varint');
    }
    return { value: buffer.readUInt32LE(offset + 1), bytesRead: 5 };
  } else {
    throw new Error('64-bit varint not supported');
  }
}

/**
 * Extract OP_RETURN from raw transaction hex for debugging
 */
export function extractOpReturnFromTxHex(txHex: string | undefined): string | null {
  if (!txHex) return null;
  try {
    const txBuffer = Buffer.from(txHex, 'hex');
    let offset = 0;
    offset += 4; // version

    // Check for witness marker
    const hasWitness = txBuffer[offset] === 0x00 && txBuffer[offset + 1] === 0x01;
    if (hasWitness) {
      offset += 2;
    }

    // Skip inputs
    const inputCount = readVarInt(txBuffer, offset);
    offset += inputCount.bytesRead;
    for (let i = 0; i < inputCount.value; i++) {
      offset += 32; // txid
      offset += 4;  // vout
      const scriptLen = readVarInt(txBuffer, offset);
      offset += scriptLen.bytesRead + scriptLen.value;
      offset += 4;  // sequence
    }

    // Read outputs
    const outputCount = readVarInt(txBuffer, offset);
    offset += outputCount.bytesRead;

    for (let i = 0; i < outputCount.value; i++) {
      offset += 8; // value (8 bytes)
      const scriptLen = readVarInt(txBuffer, offset);
      offset += scriptLen.bytesRead;
      const scriptPubKey = txBuffer.slice(offset, offset + scriptLen.value);
      offset += scriptLen.value;

      // Check if OP_RETURN (starts with 0x6a)
      if (scriptPubKey[0] === 0x6a) {
        return scriptPubKey.toString('hex');
      }
    }
    return null;
  } catch (e) {
    return `error: ${e}`;
  }
}

/**
 * Checks if batch signing is allowed based on wallet address type
 * Batch signing is only allowed for native SegWit addresses
 */
export function checkBatchAllowed(wallet: VaultWallet): boolean {
  try {
    const satsAddress = wallet.acct?.sats?.address || '';
    const lowerAddress = satsAddress.toLowerCase();
    return lowerAddress.startsWith(SEGWIT_ADDRESS_PREFIX);
  } catch (error: unknown) {
    logger.warn('[VaultOps] Failed to check batch allowed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Normalizes master_id by adding 'i0' suffix if not present
 */
export function normalizeMasterId(masterId: string): string {
  if (!masterId) return '';
  return /i\d+$/.test(masterId) ? masterId : `${masterId}i0`;
}

/**
 * Maps vault action strings from API to SDK single character codes
 * API returns: "Open", "Borrow", "Repay", "Deposit", "Withdraw", "Liquidate", "Close"
 * SDK expects: "o", "b", "r", "d", "w", "l", "x"
 */
export type VaultActionCode = 'o' | 'b' | 'r' | 'd' | 'w' | 'l' | 'x';

export function normalizeVaultAction(action: string): VaultActionCode {
  const actionMap: Record<string, VaultActionCode> = {
    // Full names (from API)
    'Open': 'o',
    'Borrow': 'b',
    'Repay': 'r',
    'Deposit': 'd',
    'Withdraw': 'w',
    'Liquidate': 'l',
    'Close': 'x',
    // Lowercase versions
    'open': 'o',
    'borrow': 'b',
    'repay': 'r',
    'deposit': 'd',
    'withdraw': 'w',
    'liquidate': 'l',
    'close': 'x',
    // Already single char codes (passthrough)
    'o': 'o',
    'b': 'b',
    'r': 'r',
    'd': 'd',
    'w': 'w',
    'l': 'l',
    'x': 'x',
  };

  const normalized = actionMap[action];
  if (!normalized) {
    logger.warn('[VaultOps] Unknown vault action, defaulting to "o":', { action });
    return 'o';
  }
  return normalized;
}

/**
 * Creates VaultPrevout from vault history transaction
 * Used for constructing VaultProfile for borrow/repay operations
 */
export function computeVaultPrevoutFromTx(tx: {
  transaction_id?: string;
  utxo?: string;
  utxo_script?: string;
  liquidation_hash?: string;
  liquidation_threshold?: number;
  amount_borrowed: number;
  oracle_price: number;
  timestamp: number;
  action: string;
  vault_amount: number;
}): VaultPrevout | null {
  if (!tx.utxo || !tx.transaction_id) {
    logger.warn('[VaultOps] Cannot compute VaultPrevout: missing utxo or transaction_id');
    return null;
  }

  const rdata: VaultReturnData = {
    is_locked: false,
    thold_hash: tx.liquidation_hash || '',
    thold_price: tx.liquidation_threshold || 0,
    unit_balance: tx.amount_borrowed,
    unit_price: tx.oracle_price,
    unit_stamp: tx.timestamp,
    vault_action: normalizeVaultAction(tx.action),
  };

  const [utxoTxid, voutRaw, ...extraParts] = tx.utxo.split(':');
  const vout = Number(voutRaw);
  if (
    !utxoTxid ||
    extraParts.length > 0 ||
    !Number.isInteger(vout) ||
    vout < 0
  ) {
    logger.warn('[VaultOps] Cannot compute VaultPrevout: malformed utxo reference', {
      utxo: tx.utxo,
    });
    return null;
  }

  const utxo: BaseUtxo = {
    value: tx.vault_amount,
    script: tx.utxo_script || '',
    txid: tx.transaction_id,
    vout,
  };

  return { rdata, utxo };
}

/**
 * Builds a VaultProfile from vault data
 * Used for borrow/repay/withdraw operations on existing vaults
 */
export function buildVaultProfile(
  vaultPubkey: string,
  vaultInfo: {
    creation_account: string;
    guard_pubkey: string;
    master_id: string;
  },
  vaultPrevout: VaultPrevout
): VaultProfile {
  return {
    acct_id: vaultInfo.creation_account,
    guard_pk: vaultInfo.guard_pubkey,
    master_id: normalizeMasterId(vaultInfo.master_id),
    vault_pk: vaultPubkey,
    rdata: vaultPrevout.rdata,
    utxo: vaultPrevout.utxo,
  };
}
