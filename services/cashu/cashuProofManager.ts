import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { logger } from '../../utils/logger';
import { checkProofsSpent, CheckStateResponse } from './cashuMintClient';
import { CashuProof } from './crypto';

/**
 * Cashu Proof Manager
 * Handles proof storage, retrieval, and account management
 * Extracted from cashuWalletService.js for better separation of concerns
 */

// Account-scoped mutex locks for proof operations to prevent concurrent read-modify-write races
// Each account gets its own lock chain so operations on different accounts don't serialize
const _proofLocks: Map<string, Promise<unknown>> = new Map();

function withProofLock<T>(fn: () => Promise<T>): Promise<T> {
  const key = currentAccount || '__default__';
  const existing = _proofLocks.get(key) || Promise.resolve();
  const run = async () => fn();
  const next = existing.then(run, run);
  _proofLocks.set(key, next);
  return next as Promise<T>;
}

/**
 * Compute SHA-256 integrity hash for proof data
 */
const computeProofHash = async (serialized: string): Promise<string> => {
  const bytes = Buffer.from(serialized, 'utf-8');
  const hashBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Buffer.from(hashBuffer).toString('hex');
};

// Current account address for account-specific storage
let currentAccount: string | null = null;

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
    await SecureStore.setItemAsync(newKey, oldProofs);

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
};

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
      proofs = JSON.parse(stored);
    } catch (parseError) {
      logger.error('Failed to parse stored proofs', { error: (parseError as Error).message });
      return [];
    }

    // Log stack trace to see who's calling this
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';

    logger.info('Loaded proofs from storage', {
      count: proofs.length,
      caller: caller.substring(0, 100), // Truncate to avoid huge logs
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
    const serialized = JSON.stringify(proofs);

    // Atomic write operation - SecureStore.setItemAsync overwrites existing data
    // No need to delete first, which eliminates the race condition
    await SecureStore.setItemAsync(STORAGE_KEY, serialized);

    // Store integrity hash alongside proofs
    const hash = await computeProofHash(serialized);
    await SecureStore.setItemAsync(`${STORAGE_KEY}_hash`, hash);

    if (verify) {
      const verification = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!verification) {
        logger.error('SecureStore write verification failed - no data returned');
        throw new Error('Failed to save proofs - verification returned null');
      }

      try {
        const verified = JSON.parse(verification);
        if (!Array.isArray(verified) || verified.length !== proofs.length) {
          logger.error('SecureStore write verification failed!', {
            expected: proofs.length,
            actual: Array.isArray(verified) ? verified.length : 'non-array',
          });
          throw new Error('Failed to save proofs - verification failed');
        }

        // Verify integrity hash matches
        const verifyHash = await computeProofHash(verification);
        if (verifyHash !== hash) {
          logger.error('Proof integrity hash mismatch after write');
          throw new Error('Failed to save proofs - integrity check failed');
        }
      } catch (parseError) {
        if ((parseError as Error).message.includes('Failed to save proofs')) {
          throw parseError;
        }
        logger.error('SecureStore write verification failed - invalid JSON', {
          error: (parseError as Error).message,
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
    const combined = [...existing, ...newProofs];
    await saveProofs(combined, verify);
    logger.info('Added proofs', { added: newProofs.length, total: combined.length });
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
