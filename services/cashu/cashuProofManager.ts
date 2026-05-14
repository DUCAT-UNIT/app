import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha256';
import { logger } from '../../utils/logger';
import { checkProofsSpent, CheckStateResponse } from './cashuMintClient';
import { CashuProof } from './crypto';
import { normalizeCashuProofs } from './cashuTsCompat';
import { DEVICE_ONLY } from '../storagePolicy';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from './cashuUnits';

/**
 * Cashu Proof Manager
 * Handles proof storage, retrieval, and account management
 * Extracted from cashuWalletService.js for better separation of concerns
 */

// Current account address for account-specific storage
let currentAccount: string | null = null;
const PROOF_REGISTRY_KEY = 'cashu_proof_keys_v1';

export interface ProofStorageContext {
  account: string;
  unit: CashuUnit;
  storageKey: string;
}

const getStorageKeyForAccount = (
  account: string | null,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): string => {
  const normalizedUnit = normalizeCashuUnit(unit);
  if (!account) {
    return normalizedUnit === DEFAULT_CASHU_UNIT
      ? 'cashu_proofs'
      : `cashu_proofs_${normalizedUnit}`;
  }
  return normalizedUnit === DEFAULT_CASHU_UNIT
    ? `cashu_proofs_${account}`
    : `cashu_proofs_${account}_${normalizedUnit}`;
};

const getCurrentProofStorageContext = (
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): ProofStorageContext => {
  if (!currentAccount) {
    logger.warn('[CashuProofManager] withProofLock called before account initialization');
    throw new Error('[CashuProofManager] withProofLock called before account initialization');
  }
  const normalizedUnit = normalizeCashuUnit(unit);

  return {
    account: currentAccount,
    unit: normalizedUnit,
    storageKey: getStorageKeyForAccount(currentAccount, normalizedUnit),
  };
};

// Account-scoped mutex locks for proof operations to prevent concurrent read-modify-write races
// Each account gets its own lock chain so operations on different accounts don't serialize
const _proofLocks: Map<string, Promise<unknown>> = new Map();

export function withProofLock<T>(
  fn: (context: ProofStorageContext) => Promise<T>,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<T> {
  const context = getCurrentProofStorageContext(unit);
  const lockKey = `${context.account}:${context.unit}`;
  const existing = _proofLocks.get(lockKey) || Promise.resolve();
  const run = async () => fn(context);
  const next = existing.then(run, run);
  const settled = next.catch(() => undefined);
  _proofLocks.set(lockKey, settled);
  void settled.finally(() => {
    if (_proofLocks.get(lockKey) === settled) {
      _proofLocks.delete(lockKey);
    }
  });
  return next as Promise<T>;
}

/**
 * Compute SHA-256 integrity hash for proof data
 */
const computeProofHash = async (serialized: string): Promise<string> => {
  const hashBytes = sha256(new Uint8Array(Buffer.from(serialized, 'utf-8')));
  return Buffer.from(hashBytes).toString('hex');
};

interface StoredProofEnvelope {
  version: 1;
  proofs: CashuProof[];
  integrityHash: string;
}

// Simple event emitter for proof changes (balance updates)
type ProofChangeListener = () => void;
const proofChangeListeners: Set<ProofChangeListener> = new Set();

interface ProofMutationOptions {
  notify?: boolean;
}

/**
 * Subscribe to proof changes (when proofs are added/removed)
 * Returns unsubscribe function
 */
export const subscribeToProofChanges = (listener: ProofChangeListener): (() => void) => {
  proofChangeListeners.add(listener);
  return () => {
    proofChangeListeners.delete(listener);
  };
};

/**
 * Notify all listeners that proofs have changed
 */
const notifyProofChange = (): void => {
  proofChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logger.error('Error in proof change listener', { error: (error as Error).message });
    }
  });
};

/**
 * Migrate proofs from global storage to account-specific storage
 */
const migrateGlobalProofsForUnit = async (
  taprootAddress: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<void> => {
  try {
    const oldKey = getStorageKeyForAccount(null, unit);
    const newKey = getStorageKeyForAccount(taprootAddress, unit);

    // Check if old global proofs exist
    const oldProofs = await SecureStore.getItemAsync(oldKey);
    if (!oldProofs) {
      return; // No migration needed
    }

    const globalProofs = await readProofsUnsafe(oldKey);
    const existingProofs = await SecureStore.getItemAsync(newKey);
    const accountProofs = existingProofs ? await readProofsUnsafe(newKey) : [];
    const existingSecrets = new Set(accountProofs.map((proof) => proof.secret));
    const mergedProofs = [
      ...accountProofs,
      ...globalProofs.filter((proof) => !existingSecrets.has(proof.secret)),
    ];

    await saveProofsForStorageKey(mergedProofs, newKey);

    logger.info('Migrated proofs from global storage to account-specific storage', {
      address: taprootAddress,
      unit,
      globalProofCount: globalProofs.length,
      accountProofCount: accountProofs.length,
      mergedProofCount: mergedProofs.length,
    });

    // Delete old global key
    await SecureStore.deleteItemAsync(oldKey);
    logger.info('Deleted old global proofs storage');
  } catch (error: unknown) {
    logger.error('Failed to migrate global proofs', { error: (error as Error).message });
  }
};

const migrateGlobalProofs = async (taprootAddress: string): Promise<void> => {
  await migrateGlobalProofsForUnit(taprootAddress, DEFAULT_CASHU_UNIT);
  await migrateGlobalProofsForUnit(taprootAddress, 'sat');
};

/**
 * Set the current account for account-specific storage
 */
export const setCurrentAccount = async (taprootAddress: string): Promise<void> => {
  currentAccount = taprootAddress;
  logger.info('Set current Cashu account', { address: taprootAddress });

  // Migrate old global proofs if this is the first time
  await migrateGlobalProofs(taprootAddress);
  await registerProofStorageKey(getStorageKey(DEFAULT_CASHU_UNIT));
  await registerProofStorageKey(getStorageKey('sat'));
};

export const getCurrentCashuAccount = (): string | null => currentAccount;

/**
 * Get account-specific storage key
 */
export const getStorageKey = (unit: CashuUnit = DEFAULT_CASHU_UNIT): string => {
  if (!currentAccount) {
    logger.warn('No current account set, using default storage key');
  }
  return getStorageKeyForAccount(currentAccount, unit);
};

const registerProofStorageKey = async (storageKey: string): Promise<void> => {
  try {
    const existing = await SecureStore.getItemAsync(PROOF_REGISTRY_KEY);
    const keys = new Set<string>(existing ? (JSON.parse(existing) as string[]) : []);
    keys.add(storageKey);
    await SecureStore.setItemAsync(
      PROOF_REGISTRY_KEY,
      JSON.stringify(Array.from(keys)),
      DEVICE_ONLY
    );
  } catch (error: unknown) {
    logger.warn('Failed to register Cashu proof storage key', {
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const getAllProofStorageKeys = async (): Promise<string[]> => {
  try {
    const stored = await SecureStore.getItemAsync(PROOF_REGISTRY_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch (error: unknown) {
    logger.warn('Failed to load Cashu proof storage registry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

const quarantineCorruptProofStorage = async (
  storageKey: string,
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${storageKey}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('Quarantined corrupt Cashu proof storage', {
      storageKey,
      quarantineKey,
      reason,
    });
  } catch (quarantineError: unknown) {
    logger.error('Failed to quarantine corrupt Cashu proof storage', {
      storageKey,
      reason,
      error: quarantineError instanceof Error ? quarantineError.message : String(quarantineError),
    });
  }
};

const failCorruptProofStorage = async (
  storageKey: string,
  stored: string,
  reason: string
): Promise<never> => {
  await quarantineCorruptProofStorage(storageKey, stored, reason);
  throw new Error(`Cashu proof storage corrupted: ${reason}`);
};

const readProofsUnsafe = async (storageKey = getStorageKey()): Promise<CashuProof[]> => {
  const stored = await SecureStore.getItemAsync(storageKey).catch((error: unknown) => {
    logger.error('Failed to load proofs', {
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  if (!stored) {
    logger.info('Loaded proofs from storage', { count: 0, source: 'empty', storageKey });
    return [];
  }

  let parsed: CashuProof[] | StoredProofEnvelope;
  try {
    parsed = JSON.parse(stored) as CashuProof[] | StoredProofEnvelope;
  } catch (parseError) {
    logger.error('Failed to parse stored proofs', {
      storageKey,
      error: (parseError as Error).message,
    });
    return failCorruptProofStorage(storageKey, stored, 'invalid JSON');
  }

  let proofs: CashuProof[];
  if (Array.isArray(parsed)) {
    proofs = normalizeCashuProofs(parsed);
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    parsed.version === 1 &&
    Array.isArray(parsed.proofs) &&
    typeof parsed.integrityHash === 'string'
  ) {
    const serialized = JSON.stringify(parsed.proofs);
    const actualHash = await computeProofHash(serialized);
    if (actualHash !== parsed.integrityHash) {
      logger.error('Cashu proof integrity check failed', {
        storageKey,
      });
      return failCorruptProofStorage(storageKey, stored, 'integrity check failed');
    }
    proofs = normalizeCashuProofs(parsed.proofs);
  } else {
    logger.error('Invalid stored Cashu proof envelope', { storageKey });
    return failCorruptProofStorage(storageKey, stored, 'invalid proof envelope');
  }

  logger.info('Loaded proofs from storage', {
    count: proofs.length,
    storageKey,
  });

  return proofs;
};

export const loadProofsForStorageKey = async (storageKey: string): Promise<CashuProof[]> => {
  return readProofsUnsafe(storageKey);
};

/**
 * Load proofs from secure storage (non-locking; callers that mutate should lock separately)
 */
export const loadProofs = async (unit: CashuUnit = DEFAULT_CASHU_UNIT): Promise<CashuProof[]> => {
  return readProofsUnsafe(getStorageKey(unit));
};

/**
 * Save proofs to secure storage
 */
export const saveProofsForStorageKey = async (
  proofs: CashuProof[],
  storageKey: string,
  verify = true
): Promise<void> => {
  try {
    const normalizedProofs = normalizeCashuProofs(proofs);
    const serializedProofs = JSON.stringify(normalizedProofs);
    const integrityHash = await computeProofHash(serializedProofs);
    const serialized = JSON.stringify({
      version: 1,
      proofs: normalizedProofs,
      integrityHash,
    } satisfies StoredProofEnvelope);
    await registerProofStorageKey(storageKey);

    // Atomic write operation - SecureStore.setItemAsync overwrites existing data
    await SecureStore.setItemAsync(storageKey, serialized, DEVICE_ONLY);

    if (verify) {
      const verification = await SecureStore.getItemAsync(storageKey);
      if (!verification) {
        logger.error('SecureStore write verification failed - no data returned');
        throw new Error('Failed to save proofs - verification returned null');
      }

      const verified = JSON.parse(verification) as StoredProofEnvelope;
      if (
        !verified ||
        verified.version !== 1 ||
        !Array.isArray(verified.proofs) ||
        typeof verified.integrityHash !== 'string'
      ) {
        logger.error('SecureStore write verification failed!', {
          expected: normalizedProofs.length,
          actual: 'invalid-envelope',
        });
        throw new Error('Failed to save proofs - verification failed');
      }

      const verifiedHash = await computeProofHash(JSON.stringify(verified.proofs));
      if (
        verifiedHash !== verified.integrityHash ||
        verified.proofs.length !== normalizedProofs.length
      ) {
        logger.error('SecureStore write verification failed!', {
          expected: normalizedProofs.length,
          actual: verified.proofs.length,
        });
        throw new Error('Failed to save proofs - verification failed');
      }
    }

    logger.info('Saved proofs to storage', { count: normalizedProofs.length, storageKey });
  } catch (error: unknown) {
    logger.error('Failed to save proofs', { error: (error as Error).message });
    throw error;
  }
};

export const saveProofs = async (
  proofs: CashuProof[],
  verify = true,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<void> => {
  await saveProofsForStorageKey(proofs, getStorageKey(unit), verify);
};

/**
 * Add new proofs to wallet
 * Uses mutex lock to prevent concurrent read-modify-write race conditions
 */
export const addProofs = async (
  newProofs: CashuProof[],
  verify = true,
  unit: CashuUnit = DEFAULT_CASHU_UNIT,
  options: ProofMutationOptions = {}
): Promise<void> => {
  await withProofLock(async ({ storageKey }) => {
    const existing = await loadProofsForStorageKey(storageKey);

    // Deduplicate incoming proofs against existing proofs by secret
    const existingSecrets = new Set(existing.map((p) => p.secret));
    const uniqueNewProofs = newProofs.filter((p) => !existingSecrets.has(p.secret));
    const duplicateCount = newProofs.length - uniqueNewProofs.length;

    if (duplicateCount > 0) {
      logger.warn('[addProofs] Filtered duplicate proofs by secret', {
        incoming: newProofs.length,
        duplicates: duplicateCount,
        unique: uniqueNewProofs.length,
      });
    }

    const combined = [...existing, ...uniqueNewProofs];
    await saveProofsForStorageKey(combined, storageKey, verify);
    logger.info('Added proofs', { added: uniqueNewProofs.length, total: combined.length });
  }, unit);

  if (options.notify !== false) {
    notifyProofChange();
  }
};

/**
 * Remove proofs from wallet (after spending)
 * Uses mutex lock to prevent concurrent read-modify-write race conditions
 */
export const removeProofs = async (
  proofsToRemove: CashuProof[],
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<void> => {
  await withProofLock(async ({ storageKey }) => {
    const existing = await loadProofsForStorageKey(storageKey);
    const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret));

    const remaining = existing.filter((p) => !secretsToRemove.has(p.secret));
    await saveProofsForStorageKey(remaining, storageKey);

    logger.info('Removed proofs', {
      removed: proofsToRemove.length,
      remaining: remaining.length,
    });
  }, unit);

  // Notify listeners that proofs have changed (triggers balance refresh)
  notifyProofChange();
};

/**
 * Load proofs with optional limit for faster initial loading
 */
export const loadProofsPartial = async (
  limit: number | null = null,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<CashuProof[]> => {
  const proofs = await readProofsUnsafe(getStorageKey(unit));
  if (limit !== null && proofs.length > limit) {
    logger.info('Loaded partial proofs from storage', {
      requested: limit,
      total: proofs.length,
      remaining: proofs.length - limit,
    });
    return proofs.slice(0, limit);
  }
  return proofs;
};

interface RemoveSpentProofsResult {
  removed: number;
  kept: number;
}

/**
 * Remove spent proofs from wallet
 * Checks proof states with the mint and removes any that are already spent
 */
export const removeSpentProofs = async (
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<RemoveSpentProofsResult> => {
  const result = await withProofLock(async ({ storageKey }) => {
    logger.info('Starting cleanup of spent proofs');

    // Get all proofs from wallet
    const allProofs = await loadProofsForStorageKey(storageKey);

    if (allProofs.length === 0) {
      logger.info('No proofs in wallet to check');
      return { removed: 0, kept: allProofs.length };
    }

    logger.info('Checking proof states', { totalProofs: allProofs.length });

    // Check which proofs are spent
    const stateResult: CheckStateResponse = await checkProofsSpent(allProofs);
    if (!Array.isArray(stateResult.states) || stateResult.states.length !== allProofs.length) {
      logger.warn('Proof state cleanup returned incomplete state response', {
        expected: allProofs.length,
        actual: Array.isArray(stateResult.states) ? stateResult.states.length : 'missing',
      });
      throw new Error('Unable to verify all proof states');
    }

    // Filter out spent proofs
    const spentProofs: CashuProof[] = [];
    const validProofs: CashuProof[] = [];

    allProofs.forEach((proof, index) => {
      const state = stateResult.states[index];
      if (state.state === 'SPENT') {
        spentProofs.push(proof);
      } else {
        validProofs.push(proof);
      }
    });

    logger.info('Proof state check complete', {
      total: allProofs.length,
      spent: spentProofs.length,
      valid: validProofs.length,
    });

    // Save only valid proofs back to wallet
    if (spentProofs.length > 0) {
      await saveProofsForStorageKey(validProofs, storageKey);
      logger.info('Removed spent proofs from wallet', { removed: spentProofs.length });
    }

    return {
      removed: spentProofs.length,
      kept: validProofs.length,
    };
  }, unit);

  if (result.removed > 0) {
    notifyProofChange();
  }

  return result;
};
