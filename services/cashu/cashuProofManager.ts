import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { checkProofsSpent, CheckStateResponse } from './cashuMintClient';
import { CashuProof } from './crypto';

/**
 * Cashu Proof Manager
 * Handles proof storage, retrieval, and account management
 * Extracted from cashuWalletService.js for better separation of concerns
 */

// Current account address for account-specific storage
let currentAccount: string | null = null;

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
    logger.info('Migrated proofs from global storage to account-specific storage', {
      address: taprootAddress,
      proofCount: JSON.parse(oldProofs).length
    });

    // Delete old global key
    await SecureStore.deleteItemAsync(oldKey);
    logger.info('Deleted old global proofs storage');
  } catch (error) {
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

/**
 * Load proofs from secure storage
 */
export const loadProofs = async (): Promise<CashuProof[]> => {
  try {
    const STORAGE_KEY = getStorageKey();
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) {
      logger.info('Loaded proofs from storage', { count: 0, source: 'empty' });
      return [];
    }

    const proofs: CashuProof[] = JSON.parse(stored);

    // Log stack trace to see who's calling this
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';

    logger.info('Loaded proofs from storage', {
      count: proofs.length,
      caller: caller.substring(0, 100), // Truncate to avoid huge logs
    });

    return proofs;
  } catch (error) {
    logger.error('Failed to load proofs', { error: (error as Error).message });
    return [];
  }
};

/**
 * Save proofs to secure storage
 */
export const saveProofs = async (proofs: CashuProof[]): Promise<void> => {
  try {
    const STORAGE_KEY = getStorageKey();
    const serialized = JSON.stringify(proofs);

    // Delete first to force cache invalidation
    await SecureStore.deleteItemAsync(STORAGE_KEY);

    // Small delay to ensure delete completes
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now write the new value
    await SecureStore.setItemAsync(STORAGE_KEY, serialized);

    // Verify the write succeeded
    const verification = await SecureStore.getItemAsync(STORAGE_KEY);
    const verified: CashuProof[] = JSON.parse(verification || '[]');

    if (verified.length !== proofs.length) {
      logger.error('SecureStore write verification failed!', {
        expected: proofs.length,
        actual: verified.length,
      });
      throw new Error('Failed to save proofs - verification failed');
    }

    logger.info('Saved proofs to storage', { count: proofs.length });
  } catch (error) {
    logger.error('Failed to save proofs', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Add new proofs to wallet
 */
export const addProofs = async (newProofs: CashuProof[]): Promise<void> => {
  const existing = await loadProofs();
  const combined = [...existing, ...newProofs];
  await saveProofs(combined);
  logger.info('Added proofs', { added: newProofs.length, total: combined.length });
};

/**
 * Remove proofs from wallet (after spending)
 */
export const removeProofs = async (proofsToRemove: CashuProof[]): Promise<void> => {
  const existing = await loadProofs();
  const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret));

  const remaining = existing.filter((p) => !secretsToRemove.has(p.secret));
  await saveProofs(remaining);

  logger.info('Removed proofs', {
    removed: proofsToRemove.length,
    remaining: remaining.length,
  });
};

/**
 * Load proofs with optional limit for faster initial loading
 */
export const loadProofsPartial = async (limit: number | null = null): Promise<CashuProof[]> => {
  try {
    const STORAGE_KEY = getStorageKey();
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const proofs: CashuProof[] = JSON.parse(stored);

    if (limit !== null && proofs.length > limit) {
      logger.info('Loaded partial proofs from storage', {
        requested: limit,
        total: proofs.length,
        remaining: proofs.length - limit
      });
      return proofs.slice(0, limit);
    }

    return proofs;
  } catch (error) {
    logger.error('Failed to load proofs', { error: (error as Error).message });
    return [];
  }
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
  try {
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
  } catch (error) {
    logger.error('Failed to remove spent proofs', { error: (error as Error).message });
    throw error;
  }
};
