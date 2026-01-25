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

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { CashuProof, BlindingData } from './crypto';

const PENDING_SWAP_KEY = 'cashu_pending_swap';

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
    signatures: Array<{ C_: string; id?: string; amount?: number }>;
  };

  // Status tracking
  status: 'pending' | 'swapped' | 'completed' | 'failed';
}

/**
 * Save a pending swap transaction before calling the mint
 */
export const savePendingSwap = async (txn: Omit<PendingSwapTransaction, 'id' | 'timestamp' | 'status'>): Promise<string> => {
  const id = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const pendingTxn: PendingSwapTransaction = {
    ...txn,
    id,
    timestamp: Date.now(),
    status: 'pending',
  };

  try {
    await SecureStore.setItemAsync(PENDING_SWAP_KEY, JSON.stringify(pendingTxn));
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
  swapResponse: PendingSwapTransaction['swapResponse']
): Promise<void> => {
  try {
    const stored = await SecureStore.getItemAsync(PENDING_SWAP_KEY);
    if (!stored) {
      logger.warn('[SwapRecovery] No pending swap to update');
      return;
    }

    const txn: PendingSwapTransaction = JSON.parse(stored);
    txn.swapResponse = swapResponse;
    txn.status = 'swapped';

    await SecureStore.setItemAsync(PENDING_SWAP_KEY, JSON.stringify(txn));
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
export const clearPendingSwap = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(PENDING_SWAP_KEY);
    logger.info('[SwapRecovery] Cleared pending swap transaction');
  } catch (error) {
    logger.error('[SwapRecovery] Failed to clear pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Load any pending swap transaction for recovery
 */
export const loadPendingSwap = async (): Promise<PendingSwapTransaction | null> => {
  try {
    const stored = await SecureStore.getItemAsync(PENDING_SWAP_KEY);
    if (!stored) {
      return null;
    }

    const txn: PendingSwapTransaction = JSON.parse(stored);

    // Check if transaction is too old (> 1 hour)
    if (Date.now() - txn.timestamp > 60 * 60 * 1000) {
      logger.warn('[SwapRecovery] Pending swap is too old, clearing', {
        id: txn.id,
        ageMinutes: Math.round((Date.now() - txn.timestamp) / 60000),
      });
      await clearPendingSwap();
      return null;
    }

    logger.info('[SwapRecovery] Found pending swap transaction', {
      id: txn.id,
      status: txn.status,
      hasResponse: !!txn.swapResponse,
      ageSeconds: Math.round((Date.now() - txn.timestamp) / 1000),
    });

    return txn;
  } catch (error) {
    logger.error('[SwapRecovery] Failed to load pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Attempt to recover from a pending swap transaction
 * Returns the recovered change proofs if successful
 * Note: sendProofs includes both 'p2pk' and regular 'send' proofs (tokens for recipient)
 */
export const recoverPendingSwap = async (): Promise<{
  recovered: boolean;
  changeProofs: CashuProof[];
  sendProofs: CashuProof[];
} | null> => {
  try {
    const pendingTxn = await loadPendingSwap();

    if (!pendingTxn) {
      return null;
    }

    // If status is 'pending', the swap never completed - we can just clear it
    if (pendingTxn.status === 'pending') {
      logger.info('[SwapRecovery] Pending swap never completed, clearing', { id: pendingTxn.id });
      await clearPendingSwap();
      return null;
    }

    // If status is 'swapped', we have the response but haven't saved proofs yet
    if (pendingTxn.status === 'swapped' && pendingTxn.swapResponse) {
      logger.info('[SwapRecovery] Recovering from swapped state', { id: pendingTxn.id });

      // Import unblind function
      const { unblindSignatures } = await import('./crypto');

      // Unblind the signatures to get the proofs
      const allNewProofs = unblindSignatures(
        pendingTxn.swapResponse.signatures,
        pendingTxn.blindingData,
        pendingTxn.keys,
        pendingTxn.swapResponse.signatures[0]?.id || pendingTxn.keysetId
      );

      // Split into change proofs and send proofs (includes both 'p2pk' and 'send' types)
      const changeProofs = allNewProofs.filter(
        proof => pendingTxn.secretTypeMap[proof.secret] === 'change'
      );
      const sendProofs = allNewProofs.filter(
        proof => pendingTxn.secretTypeMap[proof.secret] === 'p2pk' ||
                 pendingTxn.secretTypeMap[proof.secret] === 'send'
      );

      logger.info('[SwapRecovery] Recovered proofs from pending swap', {
        id: pendingTxn.id,
        totalProofs: allNewProofs.length,
        changeProofs: changeProofs.length,
        sendProofs: sendProofs.length,
      });

      return {
        recovered: true,
        changeProofs,
        sendProofs,
      };
    }

    // Status is 'completed' or 'failed' - just clear
    logger.info('[SwapRecovery] Clearing completed/failed swap', {
      id: pendingTxn.id,
      status: pendingTxn.status,
    });
    await clearPendingSwap();
    return null;
  } catch (error) {
    logger.error('[SwapRecovery] Failed to recover pending swap', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Check for and handle any pending swap recovery on app startup
 * Should be called early in the app initialization
 */
export const checkAndRecoverSwaps = async (): Promise<void> => {
  try {
    const recovery = await recoverPendingSwap();

    if (recovery && recovery.recovered) {
      // Import proof manager to save recovered proofs
      const { addProofs, loadProofs } = await import('./cashuProofManager');

      // Check if change proofs already exist (avoid duplicates)
      const existingProofs = await loadProofs();
      const existingSecrets = new Set(existingProofs.map(p => p.secret));

      const newChangeProofs = recovery.changeProofs.filter(
        p => !existingSecrets.has(p.secret)
      );

      if (newChangeProofs.length > 0) {
        await addProofs(newChangeProofs);
        logger.info('[SwapRecovery] Added recovered change proofs to wallet', {
          count: newChangeProofs.length,
          totalAmount: newChangeProofs.reduce((sum, p) => sum + p.amount, 0),
        });
      } else {
        logger.info('[SwapRecovery] Change proofs already in wallet, skipping');
      }

      // Clear the pending swap now that recovery is complete
      await clearPendingSwap();
    }
  } catch (error) {
    logger.error('[SwapRecovery] Error during swap recovery check', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
