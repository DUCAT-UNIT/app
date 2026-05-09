/**
 * Cashu Swap Recovery Service
 * Handles atomic swap operations with recovery capability
 *
 * The critical issue: If app crashes after swap succeeds (proofs spent on mint)
 * but before change proofs are saved locally, those proofs are lost.
 *
 * Solution: Use a transaction log that persists the expected outputs BEFORE
 * calling the mint. On recovery, we can restore the change proofs.
 */

import { Buffer } from 'buffer';
import * as crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { DEVICE_ONLY } from '../storagePolicy';
import { checkProofsSpent, MINT_URL, restoreSignatures } from './cashuMintClient';
import { assertResponseSignaturesUseExpectedKeyset } from './cashuKeysetUtils';
import {
  getCurrentCashuAccount,
  loadProofsForStorageKey,
  saveProofsForStorageKey,
  withProofLock,
} from './cashuProofManager';
import { encodeToken, sumProofs, unblindSignatures, type BlindingData, type CashuProof } from './crypto';
import type { CashuAmountLike } from './cashuTsCompat';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from './cashuUnits';

const PENDING_SWAP_KEY = 'cashu_pending_swap';
const PENDING_SWAP_REGISTRY_KEY = 'cashu_pending_swaps_v1';
const RECOVERED_OUTGOING_SWAP_TOKENS_KEY = 'cashu_recovered_outgoing_swap_tokens_v1';
const MAX_RECOVERED_OUTGOING_TOKENS = 25;

export interface PendingSwapTransaction {
  // Transaction identifier
  id: string;
  timestamp: number;

  // Input proofs that will be spent
  inputProofs: CashuProof[];

  // Blinding data needed to unblind the signatures
  blindingData: BlindingData[];

  // Keys needed to unblind
  keys: Record<string, string>;
  keysetId: string;

  // Which secrets are P2PK/send vs change (to split after unblinding)
  // 'p2pk' = P2PK locked tokens for recipient
  // 'send' = regular unlocked tokens for recipient
  // 'change' = change proofs to return to wallet
  secretTypeMap: Record<string, 'p2pk' | 'send' | 'change'>;

  // Mint response (set after swap succeeds)
  swapResponse?: {
    signatures: Array<{ C_: string; id?: string; amount?: CashuAmountLike }>;
  };

  // Status tracking
  status: 'pending' | 'swapped' | 'completed' | 'failed';
  taprootAddress?: string | null;
  unit?: CashuUnit;
  recipient?: string | null;
}

export interface RecoveredSwapProofs {
  recovered: true;
  swapId: string;
  taprootAddress?: string | null;
  unit?: CashuUnit;
  recipient?: string | null;
  changeProofs: CashuProof[];
  sendProofs: CashuProof[];
  sendProofKind: 'send' | 'p2pk' | 'mixed' | 'none';
}

export interface RecoveredOutgoingSwapToken {
  id: string;
  token: string;
  amount: number;
  kind: 'send' | 'p2pk' | 'mixed';
  sourceSwapId: string;
  taprootAddress?: string | null;
  unit?: CashuUnit;
  recipient?: string | null;
  proofsToRemove?: CashuProof[];
  createdAt: number;
}

type SwapResponse = NonNullable<PendingSwapTransaction['swapResponse']>;
interface PendingSwapEntry {
  txn: PendingSwapTransaction;
  storageKey: string;
  legacy: boolean;
}

type UnblindSignatures = (
  signatures: SwapResponse['signatures'],
  blindingData: BlindingData[],
  keys: Record<string, string>,
  keysetId: string
) => CashuProof[];

const getPendingSwapStorageKey = (swapId: string): string => `${PENDING_SWAP_KEY}_${swapId}`;

const normalizeStoredSwapUnit = (unit: unknown): CashuUnit | undefined => {
  if (unit === undefined || unit === null) {
    return undefined;
  }
  if (typeof unit !== 'string') {
    throw new Error('Invalid Cashu swap recovery unit');
  }
  const normalized = normalizeCashuUnit(unit);
  return normalized === DEFAULT_CASHU_UNIT ? undefined : normalized;
};

const parsePendingSwapTransaction = (stored: string): PendingSwapTransaction => {
  const txn = JSON.parse(stored) as PendingSwapTransaction;
  return {
    ...txn,
    unit: normalizeStoredSwapUnit(txn.unit),
  };
};

const parseRecoveredOutgoingSwapTokens = (stored: string): RecoveredOutgoingSwapToken[] => {
  const tokens = JSON.parse(stored) as RecoveredOutgoingSwapToken[];
  if (!Array.isArray(tokens)) {
    throw new Error('Invalid recovered outgoing token list');
  }
  return tokens.map((token) => ({
    ...token,
    unit: normalizeStoredSwapUnit(token.unit),
  }));
};

const quarantineCorruptRecoveryBlob = async (
  key: string,
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${key}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[SwapRecovery] Quarantined corrupt recovery blob', {
      key,
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[SwapRecovery] Failed to quarantine corrupt recovery blob', {
      key,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const quarantineCorruptSwapRegistry = async (
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${PENDING_SWAP_REGISTRY_KEY}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[SwapRecovery] Quarantined corrupt pending swap registry', {
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[SwapRecovery] Failed to quarantine corrupt pending swap registry', {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const loadPendingSwapRegistry = async (strict = false): Promise<string[]> => {
  const stored = await SecureStore.getItemAsync(PENDING_SWAP_REGISTRY_KEY);
  if (!stored) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored) as unknown;
  } catch (error) {
    await quarantineCorruptSwapRegistry(stored, 'invalid JSON');
    logger.warn('[SwapRecovery] Failed to parse pending swap registry', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (strict) {
      throw new Error('Pending swap registry corrupted: invalid JSON');
    }
    return [];
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptSwapRegistry(stored, 'invalid registry');
    if (strict) {
      throw new Error('Pending swap registry corrupted: invalid registry');
    }
    return [];
  }

  return parsed.filter((id): id is string => typeof id === 'string');
};

const savePendingSwapRegistry = async (ids: string[]): Promise<void> => {
  await SecureStore.setItemAsync(
    PENDING_SWAP_REGISTRY_KEY,
    JSON.stringify(Array.from(new Set(ids))),
    DEVICE_ONLY
  );
};

const registerPendingSwap = async (swapId: string): Promise<void> => {
  const ids = await loadPendingSwapRegistry(true);
  await savePendingSwapRegistry([...ids, swapId]);
};

const unregisterPendingSwap = async (swapId: string): Promise<void> => {
  const ids = await loadPendingSwapRegistry();
  const filtered = ids.filter((id) => id !== swapId);
  if (filtered.length !== ids.length) {
    await savePendingSwapRegistry(filtered);
  }
};

const isCurrentAccountSwap = (txn: PendingSwapTransaction): boolean => {
  const currentAccount = getCurrentCashuAccount();
  if (!txn.taprootAddress) {
    return true;
  }
  if (!currentAccount) {
    return false;
  }
  return txn.taprootAddress === currentAccount;
};

const loadPendingSwapEntryById = async (swapId: string): Promise<PendingSwapEntry | null> => {
  const storageKey = getPendingSwapStorageKey(swapId);
  const stored = await SecureStore.getItemAsync(storageKey);
  if (!stored) {
    return null;
  }

  return {
    txn: parsePendingSwapTransaction(stored),
    storageKey,
    legacy: false,
  };
};

const loadLegacyPendingSwapEntry = async (): Promise<PendingSwapEntry | null> => {
  const stored = await SecureStore.getItemAsync(PENDING_SWAP_KEY);
  if (!stored) {
    return null;
  }

  return {
    txn: parsePendingSwapTransaction(stored),
    storageKey: PENDING_SWAP_KEY,
    legacy: true,
  };
};

const swapRecoveryRank = (entry: PendingSwapEntry): number => {
  if (entry.txn.status === 'swapped' && entry.txn.swapResponse) {
    return 4;
  }
  if (entry.txn.swapResponse) {
    return 3;
  }
  if (entry.txn.status === 'pending') {
    return 2;
  }
  return 1;
};

const chooseRecoverableSwapEntry = (
  current: PendingSwapEntry,
  candidate: PendingSwapEntry
): PendingSwapEntry => {
  const currentRank = swapRecoveryRank(current);
  const candidateRank = swapRecoveryRank(candidate);

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank ? candidate : current;
  }

  if (candidate.txn.timestamp !== current.txn.timestamp) {
    return candidate.txn.timestamp > current.txn.timestamp ? candidate : current;
  }

  return current.legacy && !candidate.legacy ? candidate : current;
};

const mergePendingSwapEntries = (entries: PendingSwapEntry[]): PendingSwapEntry[] => {
  const byId = new Map<string, PendingSwapEntry>();

  for (const entry of entries) {
    const existing = byId.get(entry.txn.id);
    byId.set(entry.txn.id, existing ? chooseRecoverableSwapEntry(existing, entry) : entry);
  }

  return Array.from(byId.values());
};

const deletePendingSwapEntry = async (swapId: string, legacy = false): Promise<void> => {
  await SecureStore.deleteItemAsync(getPendingSwapStorageKey(swapId));
  await unregisterPendingSwap(swapId);

  if (legacy) {
    await SecureStore.deleteItemAsync(PENDING_SWAP_KEY);
  } else {
    const legacyEntry = await loadLegacyPendingSwapEntry().catch(() => null);
    if (legacyEntry?.txn.id === swapId) {
      await SecureStore.deleteItemAsync(PENDING_SWAP_KEY);
    }
  }
};

const loadPendingSwapEntries = async (): Promise<PendingSwapEntry[]> => {
  const ids = await loadPendingSwapRegistry();
  const entries: PendingSwapEntry[] = [];

  for (const id of ids) {
    try {
      const entry = await loadPendingSwapEntryById(id);
      if (!entry) {
        await unregisterPendingSwap(id);
        continue;
      }
      entries.push(entry);
    } catch (error) {
      logger.error('[SwapRecovery] Failed to load pending swap entry', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const legacyEntry = await loadLegacyPendingSwapEntry();
    if (legacyEntry) {
      entries.push(legacyEntry);
    }
  } catch (error) {
    logger.error('[SwapRecovery] Failed to load legacy pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return mergePendingSwapEntries(entries);
};

const findPendingSwapEntry = async (swapId?: string): Promise<PendingSwapEntry | null> => {
  if (swapId) {
    const entry = await loadPendingSwapEntryById(swapId);
    if (entry) {
      return entry;
    }

    const legacyEntry = await loadLegacyPendingSwapEntry();
    return legacyEntry?.txn.id === swapId ? legacyEntry : null;
  }

  const entries = (await loadPendingSwapEntries())
    .filter((entry) => isCurrentAccountSwap(entry.txn))
    .sort((a, b) => b.txn.timestamp - a.txn.timestamp);

  return entries[0] ?? null;
};

/**
 * Save a pending swap transaction before calling the mint
 */
export const savePendingSwap = async (
  txn: Omit<PendingSwapTransaction, 'id' | 'timestamp' | 'status' | 'taprootAddress'>
): Promise<string> => {
  const random = Buffer.from(crypto.getRandomBytes(8)).toString('hex');
  const id = `swap_${Date.now()}_${random}`;
  const { unit, ...txnWithoutUnit } = txn;
  const pendingTxn: PendingSwapTransaction = {
    ...txnWithoutUnit,
    id,
    timestamp: Date.now(),
    status: 'pending',
    taprootAddress: getCurrentCashuAccount(),
  };
  if (unit && unit !== DEFAULT_CASHU_UNIT) {
    pendingTxn.unit = unit;
  }

  try {
    let fallbackSaved = false;
    let registrySaved = false;
    try {
      await SecureStore.setItemAsync(PENDING_SWAP_KEY, JSON.stringify(pendingTxn), DEVICE_ONLY);
      fallbackSaved = true;
    } catch (fallbackError) {
      logger.warn('[SwapRecovery] Failed to write pending swap legacy fallback', {
        id,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }

    await SecureStore.setItemAsync(
      getPendingSwapStorageKey(id),
      JSON.stringify(pendingTxn),
      DEVICE_ONLY
    );

    try {
      await registerPendingSwap(id);
      registrySaved = true;
    } catch (registryError) {
      logger.warn('[SwapRecovery] Failed to update swap registry; relying on legacy fallback', {
        id,
        error: registryError instanceof Error ? registryError.message : String(registryError),
      });
    }

    if (!registrySaved && !fallbackSaved) {
      throw new Error('Failed to persist pending swap recovery index');
    }
    logger.info('[SwapRecovery] Saved pending swap transaction', {
      id,
      inputCount: txn.inputProofs.length,
      blindingCount: txn.blindingData.length,
    });
    return id;
  } catch (error) {
    logger.error('[SwapRecovery] Failed to save pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Update the pending swap with the mint's response
 */
export const updateSwapWithResponse = async (
  swapResponse: PendingSwapTransaction['swapResponse'],
  swapId?: string,
  signedKeyset?: { keysetId: string; keys: Record<string | number, string> }
): Promise<void> => {
  try {
    const entry = await findPendingSwapEntry(swapId);
    if (!entry) {
      logger.warn('[SwapRecovery] No pending swap to update');
      return;
    }

    const txn = entry.txn;
    const currentAccount = getCurrentCashuAccount();

    if (txn.taprootAddress && (!currentAccount || txn.taprootAddress !== currentAccount)) {
      logger.info('[SwapRecovery] Pending swap is not for the active account, ignoring', {
        pendingAccount: txn.taprootAddress,
        currentAccount,
      });
      return;
    }
    txn.swapResponse = swapResponse;
    txn.status = 'swapped';
    if (signedKeyset) {
      txn.keysetId = signedKeyset.keysetId;
      txn.keys = signedKeyset.keys as Record<string, string>;
    }

    let fallbackSaved = false;
    let primarySaved = false;
    let primaryError: unknown = null;
    let fallbackError: unknown = null;

    try {
      await SecureStore.setItemAsync(PENDING_SWAP_KEY, JSON.stringify(txn), DEVICE_ONLY);
      fallbackSaved = true;
    } catch (error) {
      fallbackError = error;
      logger.warn('[SwapRecovery] Failed to write swapped legacy fallback', {
        id: txn.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await SecureStore.setItemAsync(entry.storageKey, JSON.stringify(txn), DEVICE_ONLY);
      primarySaved = true;
    } catch (error) {
      primaryError = error;
      logger.warn('[SwapRecovery] Failed to write swapped primary entry', {
        id: txn.id,
        key: entry.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!fallbackSaved && !primarySaved) {
      throw primaryError || fallbackError || new Error('Failed to persist swapped Cashu response');
    }

    logger.info('[SwapRecovery] Updated swap with mint response', {
      id: txn.id,
      signatureCount: swapResponse?.signatures?.length,
    });
  } catch (error) {
    logger.error('[SwapRecovery] Failed to update swap with response', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Clear the pending swap after successful completion
 */
export const clearPendingSwap = async (swapId?: string): Promise<void> => {
  try {
    if (swapId) {
      await deletePendingSwapEntry(swapId);
      logger.info('[SwapRecovery] Cleared pending swap transaction', { id: swapId });
      return;
    }

    await SecureStore.deleteItemAsync(PENDING_SWAP_KEY);

    const currentAccount = getCurrentCashuAccount();
    const entries = await loadPendingSwapEntries();
    const entriesToClear = entries.filter((entry) => {
      if (entry.legacy) {
        return false;
      }
      if (!entry.txn.taprootAddress) {
        return true;
      }
      if (!currentAccount) {
        return false;
      }
      return entry.txn.taprootAddress === currentAccount;
    });

    for (const entry of entriesToClear) {
      await deletePendingSwapEntry(entry.txn.id);
    }

    logger.info('[SwapRecovery] Cleared pending swap transaction', {
      id: swapId,
      clearedCount: entriesToClear.length,
    });
  } catch (error) {
    logger.error('[SwapRecovery] Failed to clear pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const loadRecoveredOutgoingSwapTokens = async (): Promise<RecoveredOutgoingSwapToken[]> => {
  const stored = await SecureStore.getItemAsync(RECOVERED_OUTGOING_SWAP_TOKENS_KEY);
  if (!stored) {
    return [];
  }

  let tokens: RecoveredOutgoingSwapToken[];
  try {
    const parsedTokens = parseRecoveredOutgoingSwapTokens(stored);
    parsedTokens.forEach((token) => {
      if (
        typeof token.id !== 'string' ||
        typeof token.token !== 'string' ||
        typeof token.amount !== 'number' ||
        !Number.isFinite(token.amount) ||
        typeof token.sourceSwapId !== 'string' ||
        typeof token.createdAt !== 'number' ||
        !Number.isFinite(token.createdAt) ||
        !['send', 'p2pk', 'mixed'].includes(token.kind)
      ) {
        throw new Error('Invalid recovered outgoing token record');
      }
    });
    tokens = parsedTokens;
  } catch (error) {
    await quarantineCorruptRecoveryBlob(
      RECOVERED_OUTGOING_SWAP_TOKENS_KEY,
      stored,
      error instanceof Error ? error.message : String(error)
    );
    logger.error('[SwapRecovery] Failed to load recovered outgoing tokens', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const currentAccount = getCurrentCashuAccount();

  return tokens.filter((token) => {
    if (!token.taprootAddress) {
      return true;
    }
    if (!currentAccount) {
      return false;
    }
    return token.taprootAddress === currentAccount;
  });
};

export const persistOutgoingSwapToken = async (
  token: RecoveredOutgoingSwapToken
): Promise<void> => {
  try {
    const stored = await SecureStore.getItemAsync(RECOVERED_OUTGOING_SWAP_TOKENS_KEY);
    const existing = stored ? parseRecoveredOutgoingSwapTokens(stored) : [];
    const withoutDuplicate = existing.filter(
      (item) => item.token !== token.token && item.sourceSwapId !== token.sourceSwapId
    );
    const tokensToStore = [...withoutDuplicate, token].slice(-MAX_RECOVERED_OUTGOING_TOKENS);

    await SecureStore.setItemAsync(
      RECOVERED_OUTGOING_SWAP_TOKENS_KEY,
      JSON.stringify(tokensToStore),
      DEVICE_ONLY
    );

    logger.info('[SwapRecovery] Persisted outgoing swap token recovery record', {
      id: token.id,
      sourceSwapId: token.sourceSwapId,
      amount: token.amount,
      kind: token.kind,
    });
  } catch (error) {
    logger.error('[SwapRecovery] Failed to persist outgoing swap token', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const clearRecoveredOutgoingSwapToken = async (token: string): Promise<void> => {
  try {
    const stored = await SecureStore.getItemAsync(RECOVERED_OUTGOING_SWAP_TOKENS_KEY);
    if (!stored) {
      return;
    }

    const existing = parseRecoveredOutgoingSwapTokens(stored);
    const filtered = existing.filter((item) => item.token !== token);

    if (filtered.length !== existing.length) {
      await SecureStore.setItemAsync(
        RECOVERED_OUTGOING_SWAP_TOKENS_KEY,
        JSON.stringify(filtered),
        DEVICE_ONLY
      );
    }
  } catch (error) {
    logger.error('[SwapRecovery] Failed to clear outgoing swap token recovery record', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Load pending swap transactions for recovery
 */
export const loadPendingSwaps = async (): Promise<PendingSwapTransaction[]> => {
  try {
    const entries = await loadPendingSwapEntries();
    const recoverable: PendingSwapTransaction[] = [];

    for (const entry of entries) {
      const { txn } = entry;

      if (!isCurrentAccountSwap(txn)) {
        logger.info('[SwapRecovery] Pending swap belongs to a different account, ignoring', {
          id: txn.id,
          pendingAccount: txn.taprootAddress,
          currentAccount: getCurrentCashuAccount(),
        });
        continue;
      }

      const ageMs = Date.now() - txn.timestamp;

      if (ageMs > 60 * 60 * 1000) {
        logger.warn('[SwapRecovery] Found old recoverable swap; keeping recovery record', {
          id: txn.id,
          status: txn.status,
          ageMinutes: Math.round(ageMs / 60000),
        });
      }

      logger.info('[SwapRecovery] Found pending swap transaction', {
        id: txn.id,
        status: txn.status,
        hasResponse: !!txn.swapResponse,
        ageSeconds: Math.round(ageMs / 1000),
      });

      recoverable.push(txn);
    }

    return recoverable.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    logger.error('[SwapRecovery] Failed to load pending swaps', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

/**
 * Load any pending swap transaction for recovery
 */
export const loadPendingSwap = async (): Promise<PendingSwapTransaction | null> => {
  const swaps = await loadPendingSwaps();
  return swaps[0] ?? null;
};

export function recoverSwapProofsFromTransaction(
  pendingTxn: PendingSwapTransaction,
  unblindSignatures: UnblindSignatures
): RecoveredSwapProofs {
  if (pendingTxn.status !== 'swapped' || !pendingTxn.swapResponse) {
    throw new Error('Pending swap is not recoverable');
  }

  const signedKeysetId = assertResponseSignaturesUseExpectedKeyset(
    pendingTxn.swapResponse.signatures,
    pendingTxn.keysetId,
    `Recovered Cashu ${pendingTxn.unit ?? DEFAULT_CASHU_UNIT} swap`
  );
  const allNewProofs = unblindSignatures(
    pendingTxn.swapResponse.signatures,
    pendingTxn.blindingData,
    pendingTxn.keys,
    signedKeysetId
  );
  const unknownProofs = allNewProofs.filter((proof) => !pendingTxn.secretTypeMap[proof.secret]);
  if (unknownProofs.length > 0) {
    throw new Error(`Recovered swap has ${unknownProofs.length} unclassified outputs`);
  }

  const changeProofs = allNewProofs.filter(
    (proof) => pendingTxn.secretTypeMap[proof.secret] === 'change'
  );
  const sendProofs = allNewProofs.filter(
    (proof) =>
      pendingTxn.secretTypeMap[proof.secret] === 'p2pk' ||
      pendingTxn.secretTypeMap[proof.secret] === 'send'
  );
  const sendTypes = new Set(sendProofs.map((proof) => pendingTxn.secretTypeMap[proof.secret]));
  const sendProofKind =
    sendProofs.length === 0
      ? 'none'
      : sendTypes.size === 1 && sendTypes.has('p2pk')
        ? 'p2pk'
        : sendTypes.size === 1 && sendTypes.has('send')
          ? 'send'
          : 'mixed';
  const expectedOutputAmount = pendingTxn.blindingData.reduce((sum, item) => sum + item.amount, 0);
  const recoveredOutputAmount = sumProofs([...changeProofs, ...sendProofs]);
  if (recoveredOutputAmount !== expectedOutputAmount) {
    throw new Error(
      `Recovered swap amount mismatch: expected ${expectedOutputAmount} but recovered ${recoveredOutputAmount}`
    );
  }

  logger.info('[SwapRecovery] Recovered proofs from pending swap', {
    id: pendingTxn.id,
    totalProofs: allNewProofs.length,
    changeProofs: changeProofs.length,
    sendProofs: sendProofs.length,
    sendProofKind,
  });

  const recovered: RecoveredSwapProofs = {
    recovered: true,
    swapId: pendingTxn.id,
    taprootAddress: pendingTxn.taprootAddress,
    recipient: pendingTxn.recipient,
    changeProofs,
    sendProofs,
    sendProofKind,
  };
  if (pendingTxn.unit && pendingTxn.unit !== DEFAULT_CASHU_UNIT) {
    recovered.unit = pendingTxn.unit;
  }
  return recovered;
}

export async function persistRecoveredSwapChangeProofs(
  recovery: RecoveredSwapProofs
): Promise<void> {
  await withProofLock(async ({ storageKey }) => {
    const existingProofs = await loadProofsForStorageKey(storageKey);
    const existingSecrets = new Set(existingProofs.map((p) => p.secret));

    const newChangeProofs = recovery.changeProofs.filter((p) => !existingSecrets.has(p.secret));

    if (newChangeProofs.length > 0) {
      const combined = [...existingProofs, ...newChangeProofs];
      await saveProofsForStorageKey(combined, storageKey);
      logger.info('[SwapRecovery] Added recovered change proofs to wallet', {
        count: newChangeProofs.length,
        totalAmount: newChangeProofs.reduce((sum, p) => sum + p.amount, 0),
      });
    } else {
      logger.info('[SwapRecovery] Change proofs already in wallet, skipping');
    }
  }, recovery.unit ?? DEFAULT_CASHU_UNIT);
}

export async function persistRecoveredSwapSendProofs(recovery: RecoveredSwapProofs): Promise<void> {
  if (recovery.sendProofs.length === 0 || recovery.sendProofKind === 'none') {
    return;
  }

  const unit = recovery.unit ?? DEFAULT_CASHU_UNIT;
  const token = encodeToken(recovery.sendProofs, MINT_URL, unit);
  await persistOutgoingSwapToken({
    id: `${recovery.swapId}:outgoing`,
    token,
    amount: sumProofs(recovery.sendProofs),
    kind: recovery.sendProofKind,
    sourceSwapId: recovery.swapId,
    taprootAddress: recovery.taprootAddress,
    recipient: recovery.recipient ?? null,
    unit,
    createdAt: Date.now(),
  });
}

const buildRestoreOutputs = (pendingTxn: PendingSwapTransaction) =>
  pendingTxn.blindingData.map((item) => ({
    amount: item.amount,
    B_: item.B_,
    id: pendingTxn.keysetId,
  }));

const restorePendingSwapResponse = async (
  pendingTxn: PendingSwapTransaction
): Promise<PendingSwapTransaction | null> => {
  try {
    const restoredResponse = await restoreSignatures(buildRestoreOutputs(pendingTxn));
    if (restoredResponse.signatures.length !== pendingTxn.blindingData.length) {
      throw new Error('Restored signature count does not match pending swap outputs');
    }

    const swapResponse = { signatures: restoredResponse.signatures };
    await updateSwapWithResponse(swapResponse, pendingTxn.id);

    logger.info('[SwapRecovery] Restored interrupted swap response via mint restore', {
      id: pendingTxn.id,
      signatureCount: restoredResponse.signatures.length,
    });

    return {
      ...pendingTxn,
      status: 'swapped',
      swapResponse,
    };
  } catch (error) {
    logger.warn('[SwapRecovery] Mint restore did not recover pending swap response', {
      id: pendingTxn.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const pendingSwapInputsMayBeSpent = async (
  pendingTxn: PendingSwapTransaction
): Promise<boolean> => {
  try {
    const stateResult = await checkProofsSpent(pendingTxn.inputProofs);
    if (
      !Array.isArray(stateResult.states) ||
      stateResult.states.length !== pendingTxn.inputProofs.length
    ) {
      logger.warn('[SwapRecovery] Proof state response was incomplete; keeping pending swap', {
        id: pendingTxn.id,
        expected: pendingTxn.inputProofs.length,
        actual: Array.isArray(stateResult.states) ? stateResult.states.length : null,
      });
      return true;
    }

    return stateResult.states.some((state) => state.state !== 'UNSPENT');
  } catch (error) {
    logger.warn('[SwapRecovery] Could not verify pending swap inputs; keeping recovery record', {
      id: pendingTxn.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
};

/**
 * Attempt to recover from a pending swap transaction
 * Returns the recovered change proofs if successful
 * Note: sendProofs includes both 'p2pk' and regular 'send' proofs (tokens for recipient)
 */
export const recoverPendingSwaps = async (): Promise<RecoveredSwapProofs[]> => {
  const recovered: RecoveredSwapProofs[] = [];
  const pendingTxns = await loadPendingSwaps();

  for (const pendingTxn of pendingTxns) {
    // If status is 'pending', the app may have exited before storing the mint
    // response. Try NUT-09 restore first; only clear if inputs are provably
    // still unspent.
    if (pendingTxn.status === 'pending') {
      const restoredTxn = await restorePendingSwapResponse(pendingTxn);
      if (restoredTxn?.swapResponse) {
        try {
          recovered.push(recoverSwapProofsFromTransaction(restoredTxn, unblindSignatures));
        } catch (error) {
          logger.error('[SwapRecovery] Failed to recover restored pending swap', {
            id: pendingTxn.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        continue;
      }

      if (await pendingSwapInputsMayBeSpent(pendingTxn)) {
        logger.error('[SwapRecovery] Pending swap inputs are not safely unspent; keeping record', {
          id: pendingTxn.id,
        });
        continue;
      }

      logger.info('[SwapRecovery] Pending swap inputs are unspent, clearing stale record', {
        id: pendingTxn.id,
      });
      await clearPendingSwap(pendingTxn.id);
      continue;
    }

    // If status is 'swapped', we have the response but haven't saved proofs yet
    if (pendingTxn.status === 'swapped' && pendingTxn.swapResponse) {
      try {
        logger.info('[SwapRecovery] Recovering from swapped state', { id: pendingTxn.id });
        recovered.push(recoverSwapProofsFromTransaction(pendingTxn, unblindSignatures));
      } catch (error) {
        logger.error('[SwapRecovery] Failed to recover swapped transaction', {
          id: pendingTxn.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    // Status is 'completed' or 'failed' - just clear
    logger.info('[SwapRecovery] Clearing completed/failed swap', {
      id: pendingTxn.id,
      status: pendingTxn.status,
    });
    await clearPendingSwap(pendingTxn.id);
  }

  return recovered;
};

export const recoverPendingSwap = async (): Promise<RecoveredSwapProofs | null> => {
  const recovered = await recoverPendingSwaps();
  return recovered[0] ?? null;
};

/**
 * Check for and handle any pending swap recovery on app startup
 * Should be called early in the app initialization
 */
export const checkAndRecoverSwaps = async (): Promise<void> => {
  try {
    const recoveries = await recoverPendingSwaps();

    for (const recovery of recoveries) {
      if (!recovery.recovered) {
        continue;
      }

      try {
        await persistRecoveredSwapChangeProofs(recovery);
        await persistRecoveredSwapSendProofs(recovery);

        // Clear the pending swap now that recovery is complete
        await clearPendingSwap(recovery.swapId);
      } catch (recoveryError) {
        logger.error('[SwapRecovery] Error persisting recovered swap', {
          swapId: recovery.swapId,
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        });
      }
    }
  } catch (error) {
    logger.error('[SwapRecovery] Error during swap recovery check', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
