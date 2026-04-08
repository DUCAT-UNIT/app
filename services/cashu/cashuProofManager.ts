import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha256';
import { logger } from '../../utils/logger';
import { checkProofsSpent, CheckStateResponse } from './cashuMintClient';
import { CashuProof } from './crypto';
import { DEVICE_ONLY } from '../storagePolicy';

/**
 * Cashu Proof Manager
 * Handles proof storage, retrieval, and account management
 * Extracted from cashuWalletService.js for better separation of concerns
 */

// Current account address for account-specific storage
let currentAccount: string | null = null;
const PROOF_REGISTRY_KEY = 'cashu_proof_keys_v1';

// Account-scoped mutex locks for proof operations to prevent concurrent read-modify-write races
// Each account gets its own lock chain so operations on different accounts don't serialize
const _proofLocks: Map<string, Promise<unknown>> = new Map();

export function withProofLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!currentAccount) {
    logger.warn('[CashuProofManager] withProofLock called before account initialization');
    throw new Error('[CashuProofManager] withProofLock called before account initialization');
  }
  const existing = _proofLocks.get(currentAccount) || Promise.resolve();
  const run = async () => fn();
  const next = existing.then(run, run);
  _proofLocks.set(currentAccount, next);
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
  proofChangeListeners.forEach(listener => {
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
const migrateGlobalProofs = async (taprootAddress: string): Promise<void> => {
  try {
    const oldKey = 'cashu_proofs';
    const newKey = `cashu_proofs_${taprootAddress}`;

    // Check if old global proofs exist
    const oldProofs = await SecureStore.getItemAsync(oldKey);
    if (!oldProofs) {
      return; // No migration needed
    }

    // Check if account-specific proofs already exist
    const existingProofs = await SecureStore.getItemAsync(newKey);
    if (existingProofs) {
      logger.info('Account-specific proofs already exist, skipping migration');
      return;
    }

    // Migrate: copy old proofs to new account-specific key
    await SecureStore.setItemAsync(newKey, oldProofs, DEVICE_ONLY);

    // Parse proof count safely for logging
    let proofCount = 0;
    try {
      proofCount = JSON.parse(oldProofs).length;
    } catch (parseError) {
      logger.warn('Failed to parse old proofs for count', { error: (parseError as Error).message });
    }

    logger.info('Migrated proofs from global storage to account-specific storage', {
      address: taprootAddress,
      proofCount
    });

    // Delete old global key
    await SecureStore.deleteItemAsync(oldKey);
    logger.info('Deleted old global proofs storage');
  } catch (error: unknown) {
    logger.error('Failed to migrate global proofs', { error: (error as Error).message });
  }
};

/**
 * Set the current account for account-specific storage
 */
export const setCurrentAccount = async (taprootAddress: string): Promise<void> => {
  currentAccount = taprootAddress;
  logger.info('Set current Cashu account', { address: taprootAddress });

  // Migrate old global proofs if this is the first time
  await migrateGlobalProofs(taprootAddress);
  await registerProofStorageKey(getStorageKey());
};

export const getCurrentCashuAccount = (): string | null => currentAccount;

/**
 * Get account-specific storage key
 */
export const getStorageKey = (): string => {
  if (!currentAccount) {
    logger.warn('No current account set, using default storage key');
    return 'cashu_proofs';
  }
  return `cashu_proofs_${currentAccount}`;
};

const registerProofStorageKey = async (storageKey: string): Promise<void> => {
  try {
    const existing = await SecureStore.getItemAsync(PROOF_REGISTRY_KEY);
    const keys = new Set<string>(existing ? JSON.parse(existing) as string[] : []);
    keys.add(storageKey);
    await SecureStore.setItemAsync(PROOF_REGISTRY_KEY, JSON.stringify(Array.from(keys)), DEVICE_ONLY);
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
    return stored ? JSON.parse(stored) as string[] : [];
  } catch (error: unknown) {
    logger.warn('Failed to load Cashu proof storage registry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

const readProofsUnsafe = async (): Promise<CashuProof[]> => {
  try {
    const STORAGE_KEY = getStorageKey();
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) {
      logger.info('Loaded proofs from storage', { count: 0, source: 'empty' });
      return [];
    }

    let proofs: CashuProof[];
    try {
      const parsed = JSON.parse(stored) as CashuProof[] | StoredProofEnvelope;
      if (Array.isArray(parsed)) {
        proofs = parsed;
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
            storageKey: STORAGE_KEY,
          });
          return [];
        }
        proofs = parsed.proofs;
      } else {
        logger.error('Invalid stored Cashu proof envelope', { storageKey: STORAGE_KEY });
        return [];
      }
    } catch (parseError) {
      logger.error('Failed to parse stored proofs', { error: (parseError as Error).message });
      return [];
    }

    logger.info('Loaded proofs from storage', {
      count: proofs.length,
    });

    return proofs;
  } catch (error: unknown) {
    logger.error('Failed to load proofs', { error: (error as Error).message });
    return [];
  }
};

/**
 * Load proofs from secure storage (non-locking; callers that mutate should lock separately)
 */
export const loadProofs = async (): Promise<CashuProof[]> => {
  return readProofsUnsafe();
};

/**
 * Save proofs to secure storage
 */
export const saveProofs = async (proofs: CashuProof[], verify = true): Promise<void> => {
  try {
    const STORAGE_KEY = getStorageKey();
    const serializedProofs = JSON.stringify(proofs);
    const integrityHash = await computeProofHash(serializedProofs);
    const serialized = JSON.stringify({
      version: 1,
      proofs,
      integrityHash,
    } satisfies StoredProofEnvelope);
    await registerProofStorageKey(STORAGE_KEY);

    // Atomic write operation - SecureStore.setItemAsync overwrites existing data
    await SecureStore.setItemAsync(STORAGE_KEY, serialized, DEVICE_ONLY);

    if (verify) {
      const verification = await SecureStore.getItemAsync(STORAGE_KEY);
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
          expected: proofs.length,
          actual: 'invalid-envelope',
        });
        throw new Error('Failed to save proofs - verification failed');
      }

      const verifiedHash = await computeProofHash(JSON.stringify(verified.proofs));
      if (verifiedHash !== verified.integrityHash || verified.proofs.length !== proofs.length) {
        logger.error('SecureStore write verification failed!', {
          expected: proofs.length,
          actual: verified.proofs.length,
        });
        throw new Error('Failed to save proofs - verification failed');
      }
    }

    logger.info('Saved proofs to storage', { count: proofs.length });
  } catch (error: unknown) {
    logger.error('Failed to save proofs', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Add new proofs to wallet
 * Uses mutex lock to prevent concurrent read-modify-write race conditions
 */
export const addProofs = async (newProofs: CashuProof[], verify = true): Promise<void> => {
  await withProofLock(async () => {
    const existing = await loadProofs();

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
    await saveProofs(combined, verify);
    logger.info('Added proofs', { added: uniqueNewProofs.length, total: combined.length });
  });

  // Notify listeners that proofs have changed (triggers balance refresh)
  notifyProofChange();
};

/**
 * Remove proofs from wallet (after spending)
 * Uses mutex lock to prevent concurrent read-modify-write race conditions
 */
export const removeProofs = async (proofsToRemove: CashuProof[]): Promise<void> => {
  await withProofLock(async () => {
    const existing = await loadProofs();
    const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret));

    const remaining = existing.filter((p) => !secretsToRemove.has(p.secret));
    await saveProofs(remaining);

    logger.info('Removed proofs', {
      removed: proofsToRemove.length,
      remaining: remaining.length,
    });
  });

  // Notify listeners that proofs have changed (triggers balance refresh)
  notifyProofChange();
};

/**
 * Load proofs with optional limit for faster initial loading
 */
export const loadProofsPartial = async (limit: number | null = null): Promise<CashuProof[]> => {
  const proofs = await readProofsUnsafe();
  if (limit !== null && proofs.length > limit) {
    logger.info('Loaded partial proofs from storage', {
      requested: limit,
      total: proofs.length,
      remaining: proofs.length - limit
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
export const removeSpentProofs = async (): Promise<RemoveSpentProofsResult> => {
  return withProofLock(async () => {
    logger.info('Starting cleanup of spent proofs');

    // Get all proofs from wallet
    const allProofs = await loadProofs();

    if (allProofs.length === 0) {
      logger.info('No proofs in wallet to check');
      return { removed: 0, kept: allProofs.length };
    }

    logger.info('Checking proof states', { totalProofs: allProofs.length });

    // Check which proofs are spent
    const stateResult: CheckStateResponse = await checkProofsSpent(allProofs);

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
      await saveProofs(validProofs);
      logger.info('Removed spent proofs from wallet', { removed: spentProofs.length });
    }

    return {
      removed: spentProofs.length,
      kept: validProofs.length,
    };
  });
};
