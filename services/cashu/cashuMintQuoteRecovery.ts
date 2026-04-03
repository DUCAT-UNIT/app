/**
 * Cashu Mint Quote Recovery Service
 * Persists mint quotes and recovers unclaimed tokens on manual refresh
 *
 * Problem: If app crashes after payment is made but before tokens are claimed,
 * the user loses their funds because the quote ID is only in memory.
 *
 * Solution: Persist all mint quotes to SecureStore. On manual refresh,
 * check each quote with the mint and claim any that are paid but unclaimed.
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { checkMintQuote } from './cashuMintClient';
import { completeMint } from './operations/cashuMintOperations';
import { DEVICE_ONLY } from '../storagePolicy';
import { getCurrentCashuAccount } from './cashuProofManager';

const PENDING_MINT_QUOTES_KEY = 'cashu_pending_mint_quotes';

// Quote expiry: 24 hours (quotes older than this are removed)
const QUOTE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Max consecutive failures before marking a quote as permanently failed
// This handles cases like amount mismatch where the on-chain deposit
// doesn't match what the mint expects (e.g., floating-point rounding errors)
const MAX_CONSECUTIVE_FAILURES = 3;

export interface PersistedMintQuote {
  quoteId: string;
  amount: number;
  depositAddress: string;
  taprootAddress?: string | null;
  createdAt: number;
  state: 'UNPAID' | 'PAID' | 'ISSUED' | 'PENDING';
  failCount?: number; // Track consecutive claim failures
  lastError?: string; // Last error message for debugging
}

/**
 * Save a new mint quote to persistent storage
 */
export const saveMintQuote = async (
  quote: Omit<PersistedMintQuote, 'createdAt' | 'state' | 'taprootAddress'>
): Promise<void> => {
  try {
    const quotes = await loadMintQuotes();

    // Don't add duplicates
    if (quotes.some(q => q.quoteId === quote.quoteId)) {
      logger.debug('[MintQuoteRecovery] Quote already exists', { quoteId: quote.quoteId.substring(0, 8) });
      return;
    }

    const newQuote: PersistedMintQuote = {
      ...quote,
      taprootAddress: getCurrentCashuAccount(),
      createdAt: Date.now(),
      state: 'UNPAID',
    };

    quotes.push(newQuote);
    await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(quotes), DEVICE_ONLY);

    logger.info('[MintQuoteRecovery] Saved mint quote', {
      quoteId: quote.quoteId.substring(0, 8),
      amount: quote.amount,
    });
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to save mint quote', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Remove a mint quote (after successful claim or expiry)
 */
export const removeMintQuote = async (quoteId: string): Promise<void> => {
  try {
    const quotes = await loadMintQuotes();
    const filtered = quotes.filter(q => q.quoteId !== quoteId);

    if (filtered.length !== quotes.length) {
      await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(filtered), DEVICE_ONLY);
      logger.info('[MintQuoteRecovery] Removed mint quote', { quoteId: quoteId.substring(0, 8) });
    }
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to remove mint quote', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Load all persisted mint quotes
 */
export const loadMintQuotes = async (): Promise<PersistedMintQuote[]> => {
  try {
    const stored = await SecureStore.getItemAsync(PENDING_MINT_QUOTES_KEY);
    if (!stored) {
      return [];
    }

    const quotes: PersistedMintQuote[] = JSON.parse(stored);
    const currentAccount = getCurrentCashuAccount();

    // Filter out expired quotes (older than 24 hours)
    const now = Date.now();
    const nonExpiredQuotes = quotes.filter(q => now - q.createdAt < QUOTE_EXPIRY_MS);
    const validQuotes = nonExpiredQuotes.filter(
      (q) => !q.taprootAddress || !currentAccount || q.taprootAddress === currentAccount
    );

    // Only persist cleanup for expired quotes.
    if (nonExpiredQuotes.length !== quotes.length) {
      await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(nonExpiredQuotes), DEVICE_ONLY);
      logger.info('[MintQuoteRecovery] Cleaned up expired quotes', {
        removed: quotes.length - nonExpiredQuotes.length,
        remaining: nonExpiredQuotes.length,
      });
    }

    return validQuotes;
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to load mint quotes', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

/**
 * Update a quote's state
 */
export const updateMintQuoteState = async (
  quoteId: string,
  state: PersistedMintQuote['state']
): Promise<void> => {
  try {
    const quotes = await loadMintQuotes();
    const quote = quotes.find(q => q.quoteId === quoteId);

    if (quote) {
      quote.state = state;
      await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(quotes), DEVICE_ONLY);
      logger.debug('[MintQuoteRecovery] Updated quote state', {
        quoteId: quoteId.substring(0, 8),
        state,
      });
    }
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to update quote state', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Increment fail count for a quote and record the error
 * Returns the new fail count, or -1 if quote should be removed (max failures reached)
 */
const incrementFailCount = async (quoteId: string, errorMsg: string): Promise<number> => {
  try {
    const quotes = await loadMintQuotes();
    const quote = quotes.find(q => q.quoteId === quoteId);

    if (quote) {
      quote.failCount = (quote.failCount || 0) + 1;
      quote.lastError = errorMsg;
      await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(quotes), DEVICE_ONLY);

      logger.debug('[MintQuoteRecovery] Incremented fail count', {
        quoteId: quoteId.substring(0, 8),
        failCount: quote.failCount,
        lastError: errorMsg.substring(0, 50),
      });

      return quote.failCount;
    }
    return 0;
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to increment fail count', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};

/**
 * Check if an error indicates a permanent failure that won't resolve with retries
 * These include amount mismatches (on-chain deposit differs from expected)
 */
const isPermanentFailure = (errorMsg: string): boolean => {
  const permanentErrorPatterns = [
    'amount mismatch',
    'deposit amount',
    'SECURITY',
  ];

  return permanentErrorPatterns.some(pattern =>
    errorMsg.toLowerCase().includes(pattern.toLowerCase())
  );
};

export interface MintQuoteRecoveryResult {
  checked: number;
  recovered: number;
  totalAmountRecovered: number;
  errors: string[];
}

/**
 * Check all persisted mint quotes and recover any that are paid but unclaimed
 * Call this on manual refresh to recover lost funds
 */
export const recoverUnclaimedMintQuotes = async (): Promise<MintQuoteRecoveryResult> => {
  const result: MintQuoteRecoveryResult = {
    checked: 0,
    recovered: 0,
    totalAmountRecovered: 0,
    errors: [],
  };

  try {
    const quotes = await loadMintQuotes();

    if (quotes.length === 0) {
      logger.debug('[MintQuoteRecovery] No pending mint quotes to check');
      return result;
    }

    logger.info('[MintQuoteRecovery] Checking pending mint quotes', { count: quotes.length });

    for (const quote of quotes) {
      result.checked++;

      // Skip quotes that are actively being processed by turbo flow
      if (quote.state === 'PENDING') {
        logger.debug('[MintQuoteRecovery] Skipping PENDING quote (active processing)', {
          quoteId: quote.quoteId.substring(0, 8),
        });
        continue;
      }

      try {
        // Check quote status with mint
        const mintQuote = await checkMintQuote(quote.quoteId);

        logger.debug('[MintQuoteRecovery] Quote status', {
          quoteId: quote.quoteId.substring(0, 8),
          localState: quote.state,
          mintState: mintQuote.state,
        });

        if (mintQuote.state === 'PAID') {
          // Quote is paid but not yet claimed - recover it!
          // Use the mint's reported amount (actual deposit), not the locally saved amount
          const claimAmount = mintQuote.amount ?? quote.amount;
          logger.info('[MintQuoteRecovery] Found paid unclaimed quote, recovering...', {
            quoteId: quote.quoteId.substring(0, 8),
            savedAmount: quote.amount,
            mintAmount: mintQuote.amount,
            claimAmount,
          });

          try {
            // Mark as pending to prevent double-claim attempts
            await updateMintQuoteState(quote.quoteId, 'PENDING');

            // Complete the mint (claim tokens) - use mint's amount to match deposit
            const proofs = await completeMint(quote.quoteId, claimAmount);

            // Remove the quote after successful claim
            await removeMintQuote(quote.quoteId);

            result.recovered++;
            result.totalAmountRecovered += claimAmount;

            logger.info('[MintQuoteRecovery] Successfully recovered mint quote', {
              quoteId: quote.quoteId.substring(0, 8),
              savedAmount: quote.amount,
              claimedAmount: claimAmount,
              proofCount: proofs.length,
            });
          } catch (claimError) {
            const errorMsg = claimError instanceof Error ? claimError.message : String(claimError);

            // Check if already issued (tokens already claimed)
            if (errorMsg.includes('ISSUED') || errorMsg.includes('already')) {
              logger.info('[MintQuoteRecovery] Quote already claimed, removing', {
                quoteId: quote.quoteId.substring(0, 8),
              });
              await removeMintQuote(quote.quoteId);
            } else if (isPermanentFailure(errorMsg)) {
              // This is a permanent failure (e.g., amount mismatch) - remove immediately
              logger.warn('[MintQuoteRecovery] Permanent failure detected, removing quote', {
                quoteId: quote.quoteId.substring(0, 8),
                error: errorMsg,
                reason: 'Amount mismatch or similar unrecoverable error',
              });
              await removeMintQuote(quote.quoteId);
              result.errors.push(`${quote.quoteId.substring(0, 8)}: REMOVED - ${errorMsg}`);
            } else {
              // Increment fail count and check if we should give up
              const failCount = await incrementFailCount(quote.quoteId, errorMsg);

              if (failCount >= MAX_CONSECUTIVE_FAILURES) {
                logger.warn('[MintQuoteRecovery] Max failures reached, removing quote', {
                  quoteId: quote.quoteId.substring(0, 8),
                  failCount,
                  lastError: errorMsg,
                });
                await removeMintQuote(quote.quoteId);
                result.errors.push(`${quote.quoteId.substring(0, 8)}: REMOVED after ${failCount} failures - ${errorMsg}`);
              } else {
                result.errors.push(`${quote.quoteId.substring(0, 8)}: ${errorMsg} (attempt ${failCount}/${MAX_CONSECUTIVE_FAILURES})`);
                // Reset state so we can try again
                await updateMintQuoteState(quote.quoteId, 'PAID');
              }
            }
          }
        } else if (mintQuote.state === 'ISSUED') {
          // Already claimed - remove from our list
          logger.info('[MintQuoteRecovery] Quote already issued, removing', {
            quoteId: quote.quoteId.substring(0, 8),
          });
          await removeMintQuote(quote.quoteId);
        } else if (mintQuote.state === 'UNPAID') {
          // Still waiting for payment - keep in list
          await updateMintQuoteState(quote.quoteId, 'UNPAID');
        }
      } catch (checkError) {
        const errorMsg = checkError instanceof Error ? checkError.message : String(checkError);

        // If quote not found, it's expired - remove it
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          logger.info('[MintQuoteRecovery] Quote expired or not found, removing', {
            quoteId: quote.quoteId.substring(0, 8),
          });
          await removeMintQuote(quote.quoteId);
        } else {
          result.errors.push(`${quote.quoteId.substring(0, 8)}: ${errorMsg}`);
        }
      }
    }

    logger.info('[MintQuoteRecovery] Recovery complete', {
      checked: result.checked,
      recovered: result.recovered,
      totalAmountRecovered: result.totalAmountRecovered,
      errorCount: result.errors.length,
    });
    return result;
  } catch (error) {
    logger.error('[MintQuoteRecovery] Recovery failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
};

/**
 * Clear all persisted mint quotes (for testing/reset)
 */
export const clearAllMintQuotes = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(PENDING_MINT_QUOTES_KEY);
    logger.info('[MintQuoteRecovery] Cleared all mint quotes');
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to clear mint quotes', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
