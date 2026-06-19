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
import { API, getTxOutspendUrl } from '../../utils/constants';
import { getErrorMessage } from '../../utils/errorUtils';
import { logger } from '../../utils/logger';
import { getJsonWithNativeTimeout } from '../../utils/nativeHttp';

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

export const VAULT_OPERATION_LOCK_WAIT_TIMEOUT_MS = 30_000;

const VAULT_PREVOUT_OUTSPEND_TIMEOUT_MS = 8_000;
const VAULT_PREVOUT_MAX_SPEND_HOPS = 256;

interface TxOutspendResponse {
  spent: boolean;
  txid?: string;
  vin?: number;
}

export interface ResolvedVaultPrevout {
  prevout: VaultPrevout;
  replaced: boolean;
  hopCount: number;
  sourceTxids: string[];
}

interface LatestVaultProfile {
  block_timestamp?: number | null;
  client_pubkey?: string | null;
  coin_id?: string | null;
  contract_id?: string | null;
  guard_members?: string[] | null;
  guard_pubkey?: string | null;
  price_commits?: Array<{
    base_price?: number | null;
    oracle_pubkey?: string | null;
    oracle_sig?: string | null;
    thold_hash?: string | null;
    thold_price?: number | null;
  }> | null;
  price_stamp?: number | null;
  root_txid?: string | null;
  thold_price?: number | null;
  unit_balance?: number | null;
  unit_price?: number | null;
  vault_action?: string | null;
  vault_balance?: number | null;
  vault_config?: { label?: string | null } | null;
  vault_ratio?: number | null;
  vault_script?: string | null;
  vault_value?: number | null;
  vault_version?: number | null;
}

type VaultPrevoutWithLatestProfile = VaultPrevout & {
  root_txid?: string;
  latest_profile?: LatestVaultProfile;
};

async function waitForPreviousVaultOperation(
  previous: Promise<void>,
  key: string,
  timeoutMs: number
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const previousOperation = previous.catch((error) => {
    logger.warn('[VaultOps] Previous vault operation failed before lock handoff', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logger.warn('[VaultOps] Timed out waiting for previous vault operation lock', {
        key,
        timeoutMs,
      });
      reject(new Error('Timed out waiting for a previous vault operation. Please try again.'));
    }, timeoutMs);
    (timeoutId as { unref?: () => void }).unref?.();
  });

  try {
    await Promise.race([previousOperation, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function withVaultOperationLock<T>(
  fn: () => Promise<T>,
  key = '__default__',
  timeoutMs = VAULT_OPERATION_LOCK_WAIT_TIMEOUT_MS
): Promise<T> {
  let release: () => void = () => undefined;
  const previous = _vaultOpLocks.get(key) || Promise.resolve();
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const lockChain = previous.catch(() => undefined).then(() => current);

  _vaultOpLocks.set(key, lockChain);

  try {
    await waitForPreviousVaultOperation(previous, key, timeoutMs);
    return await fn();
  } finally {
    release();
    if (_vaultOpLocks.get(key) === lockChain) {
      _vaultOpLocks.delete(key);
    }
  }
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
 * Extract OP_RETURN from raw transaction hex for vault diagnostics.
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
      offset += 4; // vout
      const scriptLen = readVarInt(txBuffer, offset);
      offset += scriptLen.bytesRead + scriptLen.value;
      offset += 4; // sequence
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
    logger.warn('[VaultOps] Failed to check batch allowed', {
      error: error instanceof Error ? error.message : String(error),
    });
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
 * API returns: "Open", "Borrow", "Repay", "Deposit", "Withdraw", "Liquidate",
 * "Liquidation", "Repo", "Trim", "Close"
 * SDK expects: "o", "b", "r", "d", "w", "l", "x"
 */
export type VaultActionCode = 'o' | 'b' | 'r' | 'd' | 'w' | 'l' | 'x';

export function normalizeVaultAction(action: string): VaultActionCode {
  const actionMap: Record<string, VaultActionCode> = {
    // Full names (from API)
    Open: 'o',
    Borrow: 'b',
    Repay: 'r',
    Deposit: 'd',
    Withdraw: 'w',
    Liquidate: 'l',
    Liquidation: 'l',
    Repo: 'l',
    Trim: 'l',
    Close: 'x',
    // Lowercase versions
    open: 'o',
    borrow: 'b',
    repay: 'r',
    deposit: 'd',
    withdraw: 'w',
    liquidate: 'l',
    liquidation: 'l',
    repo: 'l',
    trim: 'l',
    close: 'x',
    // Already single char codes (passthrough)
    o: 'o',
    b: 'b',
    r: 'r',
    d: 'd',
    w: 'w',
    l: 'l',
    x: 'x',
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
  root_txid?: string;
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
  latest_profile?: LatestVaultProfile;
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
  if (!utxoTxid || extraParts.length > 0 || !Number.isInteger(vout) || vout < 0) {
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

  return {
    rdata,
    utxo,
    root_txid: tx.root_txid,
    latest_profile: tx.latest_profile,
  } as VaultPrevoutWithLatestProfile;
}

function latestVaultProfileToPrevout(
  profile: LatestVaultProfile,
  expectedCoinTxid: string
): VaultPrevout {
  const [coinTxid, voutRaw, ...extra] = (profile.coin_id ?? '').split(':');
  const vout = Number(voutRaw);
  if (
    !coinTxid ||
    coinTxid !== expectedCoinTxid ||
    extra.length > 0 ||
    !Number.isInteger(vout) ||
    vout < 0
  ) {
    throw new Error('Validator latest vault profile has not advanced to the observed spend.');
  }

  const priceCommit = profile.price_commits?.[0];
  const rdata: VaultReturnData = {
    is_locked: false,
    thold_hash: priceCommit?.thold_hash ?? '',
    thold_price: profile.thold_price ?? priceCommit?.thold_price ?? 0,
    unit_balance: profile.unit_balance ?? 0,
    unit_price: profile.unit_price ?? priceCommit?.base_price ?? null,
    unit_stamp: profile.price_stamp ?? undefined,
    vault_action: normalizeVaultAction(profile.vault_action ?? 'open'),
  };

  return {
    rdata,
    utxo: {
      value: profile.vault_balance ?? profile.vault_value ?? 0,
      script: profile.vault_script ?? '',
      txid: coinTxid,
      vout,
    },
    root_txid: profile.root_txid ?? undefined,
    latest_profile: profile,
  } as VaultPrevoutWithLatestProfile;
}

async function fetchNextVaultPrevoutFromSpend(
  rootTxid: string,
  spendingTxid: string
): Promise<VaultPrevout> {
  const profile = await getJsonWithNativeTimeout<LatestVaultProfile>(
    `${API.VAULT.replace(/\/$/, '')}/vault/${encodeURIComponent(rootTxid)}/latest`,
    {
      timeout: VAULT_PREVOUT_OUTSPEND_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    }
  );

  return latestVaultProfileToPrevout(profile, spendingTxid);
}

/**
 * Validator history can lag the chain or omit a recently confirmed vault action.
 * Before signing a vault operation, follow the current vault outpoint on-chain so
 * Guardian never receives a request spending an already-spent vault UTXO.
 */
export async function resolveLatestUnspentVaultPrevout(
  initialPrevout: VaultPrevout,
  maxHops = VAULT_PREVOUT_MAX_SPEND_HOPS
): Promise<ResolvedVaultPrevout> {
  let current = initialPrevout;
  const rootTxid = (initialPrevout as VaultPrevout & { root_txid?: string }).root_txid
    ?? initialPrevout.utxo.txid;
  const sourceTxids = [initialPrevout.utxo.txid];
  const visitedSpendTxids = new Set<string>();

  for (let hop = 0; hop <= maxHops; hop += 1) {
    const outspend = await getJsonWithNativeTimeout<TxOutspendResponse>(
      getTxOutspendUrl(current.utxo.txid, current.utxo.vout),
      {
        timeout: VAULT_PREVOUT_OUTSPEND_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      }
    );

    if (!outspend.spent) {
      return {
        prevout: current,
        replaced: sourceTxids.length > 1,
        hopCount: sourceTxids.length - 1,
        sourceTxids,
      };
    }

    if (!outspend.txid) {
      throw new Error(
        'The vault UTXO is spent, but the explorer did not return the spending transaction.'
      );
    }

    if (visitedSpendTxids.has(outspend.txid)) {
      throw new Error('Detected a cycle while resolving the latest vault UTXO.');
    }

    if (hop === maxHops) {
      throw new Error('Could not resolve the latest vault UTXO before the safety hop limit.');
    }

    visitedSpendTxids.add(outspend.txid);
    logger.warn('[VaultOps] Validator vault prevout is spent; following on-chain vault state', {
      previousTxid: current.utxo.txid,
      previousVout: current.utxo.vout,
      spendingTxid: outspend.txid,
      spendingVin: outspend.vin,
    });

    try {
      current = await fetchNextVaultPrevoutFromSpend(rootTxid, outspend.txid);
      sourceTxids.push(current.utxo.txid);
    } catch (error) {
      throw new Error(
        `The vault state is ahead of the validator, but the latest vault transaction could not be parsed: ${getErrorMessage(
          error,
          'unknown parser error'
        )}`
      );
    }
  }

  return {
    prevout: current,
    replaced: sourceTxids.length > 1,
    hopCount: sourceTxids.length - 1,
    sourceTxids,
  };
}

function getVaultPrevoutCoinId(vaultPrevout: VaultPrevout): string {
  return `${vaultPrevout.utxo.txid}:${vaultPrevout.utxo.vout}`;
}

function hasSignedPriceCommit(profile: LatestVaultProfile): boolean {
  return (profile.price_commits ?? []).some((commit) => (
    typeof commit.oracle_sig === 'string'
    && /^[0-9a-f]{128}$/i.test(commit.oracle_sig)
  ));
}

function getLatestProfileForPrevout(
  vaultPubkey: string,
  vaultInfo: {
    creation_account: string;
    guard_pubkey: string;
    master_id: string;
    latest_profile?: LatestVaultProfile | null;
  },
  vaultPrevout: VaultPrevout
): VaultProfile | null {
  const profile = (vaultPrevout as VaultPrevoutWithLatestProfile).latest_profile
    ?? vaultInfo.latest_profile;

  if (!profile) {
    return null;
  }

  const expectedCoinId = getVaultPrevoutCoinId(vaultPrevout);
  if (profile.coin_id !== expectedCoinId) {
    logger.warn('[VaultOps] Ignoring validator latest profile for mismatched vault UTXO', {
      expectedCoinId,
      profileCoinId: profile.coin_id,
    });
    return null;
  }

  if (!hasSignedPriceCommit(profile)) {
    logger.warn('[VaultOps] Ignoring validator latest profile without signed price commits', {
      coinId: profile.coin_id,
      priceCommitCount: profile.price_commits?.length ?? 0,
    });
    return null;
  }

  if (!profile.contract_id || !profile.root_txid) {
    logger.warn('[VaultOps] Ignoring incomplete validator latest profile', {
      coinId: profile.coin_id,
      hasContractId: !!profile.contract_id,
      hasRootTxid: !!profile.root_txid,
    });
    return null;
  }

  return {
    ...profile,
    coin_id: profile.coin_id,
    client_pubkey: profile.client_pubkey ?? vaultPubkey,
    contract_id: profile.contract_id,
    guard_members: profile.guard_members ?? [vaultInfo.guard_pubkey],
    guard_pubkey: profile.guard_pubkey ?? vaultInfo.guard_pubkey,
    price_commits: profile.price_commits ?? [],
    price_stamp: profile.price_stamp ?? vaultPrevout.rdata.unit_stamp ?? null,
    root_txid: profile.root_txid,
    thold_price: profile.thold_price ?? vaultPrevout.rdata.thold_price ?? null,
    unit_balance: profile.unit_balance ?? vaultPrevout.rdata.unit_balance,
    unit_price: profile.unit_price ?? vaultPrevout.rdata.unit_price ?? null,
    vault_action: profile.vault_action ?? 'open',
    vault_balance: profile.vault_balance ?? profile.vault_value ?? vaultPrevout.utxo.value,
    vault_config: profile.vault_config ?? null,
    vault_ratio: profile.vault_ratio ?? null,
    vault_script: profile.vault_script ?? vaultPrevout.utxo.script ?? null,
    vault_value: profile.vault_value ?? profile.vault_balance ?? vaultPrevout.utxo.value,
    vault_version: profile.vault_version ?? 3,
  } as VaultProfile;
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
    latest_profile?: LatestVaultProfile | null;
  },
  vaultPrevout: VaultPrevout
): VaultProfile {
  const latestProfile = getLatestProfileForPrevout(vaultPubkey, vaultInfo, vaultPrevout);
  if (latestProfile) {
    return latestProfile;
  }

  return {
    acct_id: vaultInfo.creation_account,
    guard_pk: vaultInfo.guard_pubkey,
    master_id: normalizeMasterId(vaultInfo.master_id),
    vault_pk: vaultPubkey,
    rdata: vaultPrevout.rdata,
    utxo: vaultPrevout.utxo,
  };
}
