/**
 * Token Status Service
 * Centralized service for checking and caching ecash token claim status
 * Eliminates duplicate validation logic across hooks
 */

import type { ProofState } from '../../types/cashu';
import { logger } from '../../utils/logger';
import { EcashTokenRecord, updateTokenClaimedStatus } from './cashuLockedTokensService';
import { checkProofsSpent } from './cashuMintClient';
import { decodeTokenMetadata } from './crypto';

interface CheckProofsResult {
  states?: ProofState[];
}

export type TokenWithStatus = EcashTokenRecord & {
  claimed: boolean;
  partiallySpent?: boolean;
};

// In-memory cache for token status checks (cleared on app restart)
// Key: token ID, Value: { claimed, partiallySpent, checkedAt }
const statusCache = new Map<string, { claimed: boolean; partiallySpent?: boolean; checkedAt: number }>();

// Cache TTL: 30 seconds for unclaimed tokens, permanent for claimed tokens
const UNCLAIMED_CACHE_TTL = 30 * 1000;

/**
 * Clear the in-memory status cache
 * Call this when user manually refreshes or on significant events
 */
export const clearTokenStatusCache = (): void => {
  statusCache.clear();
};

/**
 * Check if a token string is valid for status checking
 */
const isValidTokenString = (tokenString: string | undefined): boolean => {
  if (!tokenString || typeof tokenString !== 'string') return false;
  if (tokenString.startsWith('http') || tokenString.startsWith('ducat://')) return false;
  if (!/^cashuB/i.test(tokenString)) return false;
  return true;
};

/**
 * Check the claim status of a single token
 * Uses caching to avoid redundant API calls
 */
export const checkTokenStatus = async (
  token: EcashTokenRecord
): Promise<TokenWithStatus> => {
  // If already marked as claimed in storage, return immediately
  if (token.claimed === true) {
    return { ...token, claimed: true };
  }

  // Check in-memory cache
  const cached = statusCache.get(token.id);
  if (cached) {
    // Claimed tokens stay cached forever
    if (cached.claimed) {
      return { ...token, claimed: true, partiallySpent: cached.partiallySpent };
    }
    // Unclaimed tokens have a TTL
    if (Date.now() - cached.checkedAt < UNCLAIMED_CACHE_TTL) {
      return { ...token, claimed: false, partiallySpent: cached.partiallySpent };
    }
  }

  // Validate token string
  if (!isValidTokenString(token.token)) {
    statusCache.set(token.id, { claimed: false, checkedAt: Date.now() });
    return { ...token, claimed: false };
  }

  try {
    // Decode token to get proofs
    const { proofs } = decodeTokenMetadata(token.token);

    // Check if proofs are spent
    const result: CheckProofsResult = await checkProofsSpent(proofs);
    if (!Array.isArray(result.states) || result.states.length !== proofs.length) {
      logger.warn('[tokenStatusService] Incomplete proof-state response', {
        tokenId: token.id,
        expected: proofs.length,
        actual: result.states?.length ?? 0,
      });
      statusCache.set(token.id, { claimed: false, partiallySpent: false, checkedAt: Date.now() });
      return { ...token, claimed: false, partiallySpent: false };
    }

    const spentCount = result.states.filter((s: ProofState) => s.state === 'SPENT').length;
    const totalCount = result.states.length;
    const allSpent = spentCount === totalCount && totalCount > 0;
    const partiallySpent = spentCount > 0 && spentCount < totalCount;

    // Update cache
    statusCache.set(token.id, { claimed: allSpent, partiallySpent, checkedAt: Date.now() });

    // If token is now claimed, persist to storage
    if (allSpent && !token.claimed) {
      if ('sender' in token) {
        await updateTokenClaimedStatus(token.id, true, 'received');
      } else {
        await updateTokenClaimedStatus(token.id, true);
      }
    }

    return { ...token, claimed: allSpent, partiallySpent };
  } catch (error: unknown) {
    // Cache the failure briefly to avoid hammering the API
    statusCache.set(token.id, { claimed: false, checkedAt: Date.now() });
    throw error;
  }
};

/**
 * Check the claim status of multiple tokens in parallel
 * Efficiently batches checks and uses caching
 */
export const checkTokensStatus = async (
  tokens: EcashTokenRecord[]
): Promise<TokenWithStatus[]> => {
  let errorCount = 0;
  const MAX_ERRORS_TO_LOG = 3;

  const results = await Promise.all(
    tokens.map(async (token) => {
      try {
        return await checkTokenStatus(token);
      } catch (error: unknown) {
        if (errorCount < MAX_ERRORS_TO_LOG) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('[tokenStatusService] Failed to check token status:', { error: errorMessage, tokenId: token.id });
          errorCount++;
          if (errorCount === MAX_ERRORS_TO_LOG) {
            logger.warn('[tokenStatusService] Suppressing further errors...');
          }
        }
        return { ...token, claimed: false };
      }
    })
  );

  return results;
};

/**
 * Load and check status of all tokens for an address
 * Combines fetching and status checking in one call
 */
export const loadTokensWithStatus = async (
  taprootAddress: string | undefined,
  getSentLockedTokens: (address?: string) => Promise<EcashTokenRecord[]>,
  getReceivedTokens: (address?: string) => Promise<EcashTokenRecord[]>
): Promise<TokenWithStatus[]> => {
  const sentTokens = await getSentLockedTokens(taprootAddress);
  const receivedTokens = await getReceivedTokens(taprootAddress);
  const allTokens: EcashTokenRecord[] = [...sentTokens, ...receivedTokens];

  return checkTokensStatus(allTokens);
};
