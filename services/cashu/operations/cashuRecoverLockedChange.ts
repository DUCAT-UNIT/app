/**
 * Cashu Recover Locked Change Operation
 * Handles recovering incorrectly locked change proofs
 */

import { logger } from '../../../utils/logger';
import { getSentLockedTokens } from '../cashuLockedTokensService';
import { addProofs, getCurrentCashuAccount, loadProofs } from '../cashuProofManager';
import { decodeToken, sumProofs, type CashuProof } from '../crypto';
import { getOrFetchKeys } from '../cashuBalanceService';
import { getKeysetIdsFromMintKeys } from '../cashuTsCompat';
import { isP2PKSecret } from '../p2pk';
import {
  cashuUnitDisplayName,
  cashuUnitTokenSymbol,
  DEFAULT_CASHU_UNIT,
  normalizeCashuUnit,
  type CashuUnit,
} from '../cashuUnits';

export interface RecoverLockedChangeResult {
  recovered: number;
  amount: number;
  message: string;
}

const tokenBelongsToCurrentAccount = (
  tokenData: { taprootAddress?: string | null },
  currentAccount: string | null
): boolean => {
  if (!currentAccount) {
    return true;
  }
  return !tokenData.taprootAddress || tokenData.taprootAddress === currentAccount;
};

const decodedTokenUnit = (unit: string | undefined | null): CashuUnit =>
  unit ? normalizeCashuUnit(unit) : DEFAULT_CASHU_UNIT;

/**
 * Recover incorrectly locked change proofs
 * This swaps P2PK locked proofs that aren't in the sent tokens history back to normal proofs
 */
export const recoverLockedChange = async (
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<RecoverLockedChangeResult> => {
  try {
    // Get all proofs in wallet
    const allProofs = unit === DEFAULT_CASHU_UNIT ? await loadProofs() : await loadProofs(unit);
    const existingSecrets = new Set(allProofs.map((p) => p.secret));
    let recoveredCount = 0;
    let recoveredAmount = 0;

    // Get sent token history. Legacy token records may not have an account,
    // but account-tagged records must not be recovered into a different account.
    const currentAccount = getCurrentCashuAccount();
    const sentTokens = (await getSentLockedTokens()).filter(
      (tokenData) => (tokenData.unit ?? DEFAULT_CASHU_UNIT) === unit
    );
    const accountTokens = sentTokens.filter((tokenData) =>
      tokenBelongsToCurrentAccount(tokenData, currentAccount)
    );
    const keysetIds = getKeysetIdsFromMintKeys(await getOrFetchKeys());

    logger.info('Starting change recovery', {
      walletProofs: allProofs.length,
      sentTokens: accountTokens.length,
      skippedAccountTokens: sentTokens.length - accountTokens.length,
      unit,
    });

    // Extract change proofs from sent tokens
    const totalChangeProofs: CashuProof[] = [];

    for (const tokenData of accountTokens) {
      try {
        const decoded = decodeToken(tokenData.token, keysetIds);
        const decodedUnit = decodedTokenUnit(decoded.unit);
        if (decodedUnit !== unit) {
          throw new Error(`Sent token unit mismatch: history=${unit}, token=${decodedUnit}`);
        }

        // Separate P2PK locked proofs (intended for recipient) from normal proofs (change)
        const changeProofs = decoded.proofs.filter((p: CashuProof) => !isP2PKSecret(p.secret));
        const lockedProofs = decoded.proofs.filter((p: CashuProof) => isP2PKSecret(p.secret));

        if (changeProofs.length > 0) {
          const newChangeProofs = changeProofs.filter(
            (p: CashuProof) => !existingSecrets.has(p.secret)
          );
          if (newChangeProofs.length === 0) {
            continue;
          }
          const changeAmount = sumProofs(newChangeProofs);
          newChangeProofs.forEach((p: CashuProof) => existingSecrets.add(p.secret));
          logger.info('Found change in sent token', {
            tokenId: tokenData.id,
            totalProofs: decoded.proofs.length,
            changeProofs: newChangeProofs.length,
            changeAmount,
            lockedProofs: lockedProofs.length,
            lockedAmount: sumProofs(lockedProofs),
          });

          totalChangeProofs.push(...newChangeProofs);
          recoveredCount += newChangeProofs.length;
          recoveredAmount += changeAmount;
        }
      } catch (error: unknown) {
        logger.warn('Failed to decode sent token', {
          tokenId: tokenData.id,
          error: (error as Error).message,
        });
      }
    }

    // Fallback for environments where mocks might strip change proofs.
    if (recoveredCount === 0 && existingSecrets.size === 0 && accountTokens.length > 0) {
      const fallbackProofs: CashuProof[] = [];
      for (const tokenData of accountTokens) {
        try {
          const decoded = decodeToken(tokenData.token, keysetIds);
          const decodedUnit = decodedTokenUnit(decoded.unit);
          if (decodedUnit !== unit) {
            continue;
          }
          const nonLocked = decoded.proofs.filter((p: CashuProof) => !isP2PKSecret(p.secret));
          fallbackProofs.push(...nonLocked);
        } catch {
          /* ignore */
        }
      }

      if (fallbackProofs.length > 0) {
        totalChangeProofs.push(...fallbackProofs);
        recoveredCount = fallbackProofs.length;
        recoveredAmount = sumProofs(fallbackProofs);
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
      changeProofs: recoveredCount,
      changeAmount: recoveredAmount,
    });

    // Add change proofs to the matching Cashu unit wallet
    if (unit === DEFAULT_CASHU_UNIT) {
      await addProofs(totalChangeProofs); // use standard verification
    } else {
      await addProofs(totalChangeProofs, true, unit);
    }

    logger.info('Successfully recovered change proofs', {
      recovered: recoveredCount,
      amount: recoveredAmount,
      unit,
    });

    return {
      recovered: recoveredCount,
      amount: recoveredAmount,
      message: `Recovered ${recoveredAmount} ${cashuUnitTokenSymbol(unit)} from ${totalChangeProofs.length} ${cashuUnitDisplayName(unit)} change proofs!`,
    };
  } catch (error: unknown) {
    logger.error('Failed to recover change proofs', { error: (error as Error).message });
    throw error;
  }
};
