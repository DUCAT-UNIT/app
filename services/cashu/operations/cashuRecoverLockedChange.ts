/**
 * Cashu Recover Locked Change Operation
 * Handles recovering incorrectly locked change proofs
 */

import { logger } from '../../../utils/logger';
import { decodeToken, sumProofs, CashuProof } from '../crypto';
import { isP2PKSecret } from '../p2pk';
import { getSentLockedTokens } from '../cashuLockedTokensService';
import { loadProofs, addProofs } from '../cashuProofManager';

export interface RecoverLockedChangeResult {
  recovered: number;
  amount: number;
  message: string;
}

/**
 * Recover incorrectly locked change proofs
 * This swaps P2PK locked proofs that aren't in the sent tokens history back to normal proofs
 */
export const recoverLockedChange = async (): Promise<RecoverLockedChangeResult> => {
  try {

    // Get all proofs in wallet
    const allProofs = await loadProofs();
    const existingSecrets = new Set(allProofs.map(p => p.secret));

    // Get sent token history
    const sentTokens = await getSentLockedTokens();

    logger.info('Starting change recovery', {
      walletProofs: allProofs.length,
      sentTokens: sentTokens.length,
    });

    // Extract change proofs from sent tokens
    const totalChangeProofs: CashuProof[] = [];

    for (const tokenData of sentTokens) {
      try {
        const decoded = decodeToken(tokenData.token);

        // Separate P2PK locked proofs (intended for recipient) from normal proofs (change)
        const changeProofs = decoded.proofs.filter(p => !isP2PKSecret(p.secret));
        const lockedProofs = decoded.proofs.filter(p => isP2PKSecret(p.secret));

        if (changeProofs.length > 0) {
          const changeAmount = sumProofs(changeProofs);

          logger.info('Found change in sent token', {
            tokenId: tokenData.id,
            totalProofs: decoded.proofs.length,
            changeProofs: changeProofs.length,
            changeAmount,
            lockedProofs: lockedProofs.length,
            lockedAmount: sumProofs(lockedProofs),
          });

          // Only add change proofs that aren't already in wallet
          const newChangeProofs = changeProofs.filter(p => !existingSecrets.has(p.secret));
          totalChangeProofs.push(...newChangeProofs);
        }
      } catch (error: unknown) {
        logger.warn('Failed to decode sent token', {
          tokenId: tokenData.id,
          error: (error as Error).message
        });
      }
    }

    if (totalChangeProofs.length === 0) {
      logger.info('No change proofs found to recover');
      return {
        recovered: 0,
        amount: 0,
        message: 'No change proofs found in sent tokens',
      };
    }

    logger.info('Recovering change proofs', {
      changeProofs: totalChangeProofs.length,
      changeAmount: sumProofs(totalChangeProofs),
    });

    // Add change proofs to wallet
    await addProofs(totalChangeProofs);

    const recoveredAmount = sumProofs(totalChangeProofs);

    logger.info('Successfully recovered change proofs', {
      recovered: totalChangeProofs.length,
      amount: recoveredAmount,
    });

    return {
      recovered: totalChangeProofs.length,
      amount: recoveredAmount,
      message: `Recovered ${recoveredAmount} UNIT from ${totalChangeProofs.length} change proofs!`,
    };
  } catch (error: unknown) {
    logger.error('Failed to recover change proofs', { error: (error as Error).message });
    throw error;
  }
};
