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
import {
  checkMintQuote,
  mintRequiresDleqProofs,
  restoreSignatures,
  type MintResponse,
} from './cashuMintClient';
import { deriveMintQuoteState, getMintQuoteAvailableAmount } from './mintClient/mintQuotes';
// Lazy import to break circular dependency:
// cashuMintOperations → cashuMintQuoteRecovery → cashuMintOperations
// Uses require() for Jest compatibility (dynamic import() not supported without --experimental-vm-modules)
const lazyCompleteMint = async (
  ...args: Parameters<typeof import('./operations/cashuMintOperations').completeMint>
) => {
  const { completeMint } =
    require('./operations/cashuMintOperations') as typeof import('./operations/cashuMintOperations');
  return completeMint(...args);
};
import { DEVICE_ONLY } from '../storagePolicy';
import { getCurrentCashuAccount } from './cashuProofManager';
import type { BlindingData } from './crypto';
import { assertResponseSignaturesUseExpectedKeyset } from './cashuKeysetUtils';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from './cashuUnits';

const PENDING_MINT_QUOTES_KEY = 'cashu_pending_mint_quotes';

// Quote expiry: 24 hours (quotes older than this are removed)
const QUOTE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Max consecutive failures before marking a quote as permanently failed
// This handles cases like amount mismatch where the on-chain deposit
// doesn't match what the mint expects (e.g., floating-point rounding errors)
const MAX_CONSECUTIVE_FAILURES = 3;
const STALE_PENDING_MS = 2 * 60 * 1000;

export interface PersistedMintQuote {
  quoteId: string;
  amount: number;
  depositAddress: string;
  taprootAddress?: string | null;
  createdAt: number;
  state: 'UNPAID' | 'PAID' | 'ISSUED' | 'PENDING';
  unit?: CashuUnit;
  purpose?: 'turbo_send';
  failCount?: number; // Track consecutive claim failures
  lastError?: string; // Last recoverable claim error.
  claim?: PersistedMintClaim;
}

export interface PersistedMintClaim {
  amount: number;
  signatures?: MintResponse['signatures'];
  blindingData: BlindingData[];
  keys: Record<number | string, string>;
  keysetId: string;
  signedKeysetId?: string;
  createdAt: number;
}

const quarantineCorruptMintQuoteStorage = async (stored: string, reason: string): Promise<void> => {
  const quarantineKey = `${PENDING_MINT_QUOTES_KEY}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[MintQuoteRecovery] Quarantined corrupt mint quote storage', {
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to quarantine corrupt mint quote storage', {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Save a new mint quote to persistent storage
 */
export const saveMintQuote = async (
  quote: Omit<PersistedMintQuote, 'createdAt' | 'state' | 'taprootAddress'>
): Promise<void> => {
  try {
    const quotes = await loadAllMintQuotes();

    const existingQuote = quotes.find((q) => q.quoteId === quote.quoteId);
    if (existingQuote) {
      const nextUnit = quote.unit ?? existingQuote.unit ?? DEFAULT_CASHU_UNIT;
      const nextTaprootAddress =
        existingQuote.taprootAddress ?? getCurrentCashuAccount() ?? undefined;
      const changed =
        existingQuote.amount !== quote.amount ||
        existingQuote.depositAddress !== quote.depositAddress ||
        (existingQuote.unit ?? DEFAULT_CASHU_UNIT) !== nextUnit ||
        existingQuote.taprootAddress !== nextTaprootAddress;

      if (changed) {
        existingQuote.amount = quote.amount;
        existingQuote.depositAddress = quote.depositAddress;
        existingQuote.unit = nextUnit;
        existingQuote.taprootAddress = nextTaprootAddress;
        await SecureStore.setItemAsync(
          PENDING_MINT_QUOTES_KEY,
          JSON.stringify(quotes),
          DEVICE_ONLY
        );
        logger.info('[MintQuoteRecovery] Updated existing mint quote recovery record', {
          quoteId: quote.quoteId.substring(0, 8),
          amount: quote.amount,
          unit: nextUnit,
        });
      } else {
        logger.debug('[MintQuoteRecovery] Quote already exists', {
          quoteId: quote.quoteId.substring(0, 8),
        });
      }
      return;
    }

    const newQuote: PersistedMintQuote = {
      ...quote,
      unit: quote.unit ?? DEFAULT_CASHU_UNIT,
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
    throw error;
  }
};

/**
 * Remove a mint quote (after successful claim or expiry)
 */
export const removeMintQuote = async (quoteId: string): Promise<void> => {
  try {
    const quotes = await loadAllMintQuotes();
    const currentAccount = getCurrentCashuAccount();
    const filtered = quotes.filter(
      (q) => !(q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount))
    );

    if (filtered.length !== quotes.length) {
      await SecureStore.setItemAsync(
        PENDING_MINT_QUOTES_KEY,
        JSON.stringify(filtered),
        DEVICE_ONLY
      );
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
  const quotes = await loadAllMintQuotes();
  const currentAccount = getCurrentCashuAccount();
  return quotes.filter((q) => belongsToCurrentCashuAccount(q, currentAccount));
};

/**
 * Update a quote's state
 */
export const updateMintQuoteState = async (
  quoteId: string,
  state: PersistedMintQuote['state']
): Promise<void> => {
  try {
    const quotes = await loadAllMintQuotes();
    const currentAccount = getCurrentCashuAccount();
    const quote = quotes.find(
      (q) => q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount)
    );

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

export const markMintQuoteAsTurboSend = async (quoteId: string): Promise<void> => {
  try {
    const quotes = await loadAllMintQuotes();
    const currentAccount = getCurrentCashuAccount();
    const quote = quotes.find(
      (q) => q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount)
    );

    if (!quote) {
      logger.warn('[MintQuoteRecovery] Cannot mark missing quote as Turbo send', {
        quoteId: quoteId.substring(0, 8),
      });
      return;
    }

    quote.purpose = 'turbo_send';
    await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(quotes), DEVICE_ONLY);
    logger.info('[MintQuoteRecovery] Marked quote as Turbo send', {
      quoteId: quoteId.substring(0, 8),
    });
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to mark quote as Turbo send', {
      quoteId: quoteId.substring(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const ensureMintQuoteClaimCanBePersisted = async (quoteId: string): Promise<void> => {
  const quotes = await loadAllMintQuotes();
  const currentAccount = getCurrentCashuAccount();
  const quote = quotes.find(
    (q) => q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount)
  );

  if (!quote) {
    throw new Error(`Mint quote recovery record missing for quote ${quoteId}`);
  }
};

export const persistMintQuoteClaim = async (
  quoteId: string,
  claim: Omit<PersistedMintClaim, 'createdAt'>
): Promise<void> => {
  try {
    const quotes = await loadAllMintQuotes();
    const currentAccount = getCurrentCashuAccount();
    const quote = quotes.find(
      (q) => q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount)
    );

    if (!quote) {
      logger.error('[MintQuoteRecovery] Cannot persist claim for missing quote', {
        quoteId: quoteId.substring(0, 8),
      });
      throw new Error(`Mint quote recovery record missing for quote ${quoteId}`);
    }

    quote.claim = {
      ...claim,
      createdAt: Date.now(),
    };
    quote.state = 'PENDING';
    await SecureStore.setItemAsync(PENDING_MINT_QUOTES_KEY, JSON.stringify(quotes), DEVICE_ONLY);

    logger.info('[MintQuoteRecovery] Persisted mint claim response', {
      quoteId: quoteId.substring(0, 8),
      signatureCount: claim.signatures?.length ?? 0,
      amount: claim.amount,
    });
  } catch (error) {
    logger.error('[MintQuoteRecovery] Failed to persist mint claim response', {
      quoteId: quoteId.substring(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Increment fail count for a quote and record the error
 * Returns the new fail count, or -1 if quote should be removed (max failures reached)
 */
const incrementFailCount = async (quoteId: string, errorMsg: string): Promise<number> => {
  try {
    const quotes = await loadAllMintQuotes();
    const currentAccount = getCurrentCashuAccount();
    const quote = quotes.find(
      (q) => q.quoteId === quoteId && belongsToCurrentCashuAccount(q, currentAccount)
    );

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
  const permanentErrorPatterns = ['amount mismatch', 'deposit amount', 'SECURITY'];

  return permanentErrorPatterns.some((pattern) =>
    errorMsg.toLowerCase().includes(pattern.toLowerCase())
  );
};

const isExpiredMintQuote = (quote: PersistedMintQuote): boolean =>
  Date.now() - quote.createdAt >= QUOTE_EXPIRY_MS;

const isMintQuoteAlreadyIssued = (
  mintQuote: Awaited<ReturnType<typeof checkMintQuote>>
): boolean => {
  const mintState = deriveMintQuoteState(mintQuote);
  const hasMintAccounting =
    mintQuote.amount_paid !== undefined || mintQuote.amount_issued !== undefined;

  return (
    mintState === 'ISSUED' ||
    (hasMintAccounting &&
      (mintQuote.amount_paid ?? 0) > 0 &&
      (mintQuote.amount_issued ?? 0) >= (mintQuote.amount_paid ?? 0))
  );
};

const belongsToCurrentCashuAccount = (
  quote: PersistedMintQuote,
  currentAccount = getCurrentCashuAccount()
): boolean => {
  if (!quote.taprootAddress) {
    return true;
  }
  if (!currentAccount) {
    return false;
  }
  return quote.taprootAddress === currentAccount;
};

const normalizePersistedMintQuote = (quote: PersistedMintQuote): PersistedMintQuote => {
  const unit =
    quote.unit === undefined || quote.unit === null
      ? DEFAULT_CASHU_UNIT
      : normalizeCashuUnit(quote.unit);
  return { ...quote, unit };
};

const loadAllMintQuotes = async (): Promise<PersistedMintQuote[]> => {
  const stored = await SecureStore.getItemAsync(PENDING_MINT_QUOTES_KEY);
  if (!stored) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored) as unknown;
  } catch (error) {
    await quarantineCorruptMintQuoteStorage(stored, 'invalid JSON');
    logger.error('[MintQuoteRecovery] Failed to parse mint quote storage', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Mint quote recovery storage corrupted: invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptMintQuoteStorage(stored, 'invalid quote list');
    throw new Error('Mint quote recovery storage corrupted: invalid quote list');
  }

  return (parsed as PersistedMintQuote[]).map(normalizePersistedMintQuote);
};

export interface MintQuoteRecoveryResult {
  checked: number;
  recovered: number;
  totalAmountRecovered: number;
  errors: string[];
}

const recoverPersistedMintClaim = async (
  quote: PersistedMintQuote,
  result: MintQuoteRecoveryResult
): Promise<void> => {
  if (!quote.claim) {
    return;
  }

  // Lazy require keeps the original circular dependency boundary intact and
  // lets completeMint import this recovery module.
  const { addProofs } = require('./cashuProofManager') as typeof import('./cashuProofManager');
  const { sumProofs, unblindSignatures } = require('./crypto') as typeof import('./crypto');

  let signatures = quote.claim.signatures;
  let signedKeysetId = quote.claim.signedKeysetId || quote.claim.keysetId;
  const keys = quote.claim.keys;

  if (!signatures || signatures.length === 0) {
    const isActivePendingClaim =
      quote.state === 'PENDING' && Date.now() - quote.claim.createdAt < STALE_PENDING_MS;
    const mintQuote = await checkMintQuote(quote.quoteId);
    const mintState = deriveMintQuoteState(mintQuote);
    const alreadyIssued = isMintQuoteAlreadyIssued(mintQuote);

    if (isActivePendingClaim && !alreadyIssued) {
      logger.debug('[MintQuoteRecovery] Skipping active persisted mint claim without signatures', {
        quoteId: quote.quoteId.substring(0, 8),
      });
      return;
    }

    const availableAmount = getMintQuoteAvailableAmount(mintQuote);
    const hasMintAccounting =
      mintQuote.amount_paid !== undefined || mintQuote.amount_issued !== undefined;
    const canClaim = availableAmount > 0 || (!hasMintAccounting && mintState === 'PAID');

    if (canClaim) {
      const claimAmount =
        availableAmount > 0 ? availableAmount : (mintQuote.amount ?? quote.amount);
      const proofs =
        (quote.unit ?? DEFAULT_CASHU_UNIT) === DEFAULT_CASHU_UNIT
          ? await lazyCompleteMint(quote.quoteId, claimAmount)
          : await lazyCompleteMint(quote.quoteId, claimAmount, quote.unit);

      result.recovered++;
      result.totalAmountRecovered += claimAmount;

      logger.info('[MintQuoteRecovery] Recovered persisted mint claim by retrying claim', {
        quoteId: quote.quoteId.substring(0, 8),
        amount: claimAmount,
        proofCount: proofs.length,
      });
      return;
    }

    const outputs = quote.claim.blindingData.map((item) => ({
      amount: item.amount,
      B_: item.B_,
      id: quote.claim!.keysetId,
    }));
    const restoredResponse = await restoreSignatures(outputs);
    if (restoredResponse.signatures.length !== quote.claim.blindingData.length) {
      throw new Error('Restored mint signature count does not match claim outputs');
    }
    signatures = restoredResponse.signatures;
    signedKeysetId = assertResponseSignaturesUseExpectedKeyset(
      signatures,
      quote.claim.keysetId,
      `Recovered mint ${quote.unit ?? DEFAULT_CASHU_UNIT} claim`
    );
    await persistMintQuoteClaim(quote.quoteId, {
      amount: quote.claim.amount,
      signatures,
      blindingData: quote.claim.blindingData,
      keys,
      keysetId: quote.claim.keysetId,
      signedKeysetId,
    });

    logger.info('[MintQuoteRecovery] Restored interrupted mint claim signatures', {
      quoteId: quote.quoteId.substring(0, 8),
      signatureCount: signatures.length,
    });
  }

  if (!signatures || signatures.length === 0) {
    throw new Error('Persisted mint claim has no recoverable signatures');
  }

  signedKeysetId = assertResponseSignaturesUseExpectedKeyset(
    signatures,
    quote.claim.keysetId,
    `Recovered mint ${quote.unit ?? DEFAULT_CASHU_UNIT} claim`
  );

  const requireDleq = await mintRequiresDleqProofs();
  const proofs = unblindSignatures(
    signatures,
    quote.claim.blindingData,
    keys,
    signedKeysetId || quote.claim.keysetId,
    { requireDleq }
  );
  const proofTotal = sumProofs(proofs);
  if (proofTotal !== quote.claim.amount) {
    throw new Error(
      `Recovered mint claim verification failed: expected ${quote.claim.amount} but received ${proofTotal}`
    );
  }

  await addProofs(proofs, true, quote.unit ?? DEFAULT_CASHU_UNIT);
  await removeMintQuote(quote.quoteId);

  result.recovered++;
  result.totalAmountRecovered += quote.claim.amount;

  logger.info('[MintQuoteRecovery] Recovered persisted mint claim', {
    quoteId: quote.quoteId.substring(0, 8),
    amount: quote.claim.amount,
    proofCount: proofs.length,
  });
};

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

      if (quote.claim) {
        try {
          await recoverPersistedMintClaim(quote, result);
        } catch (claimRecoveryError) {
          const errorMsg =
            claimRecoveryError instanceof Error
              ? claimRecoveryError.message
              : String(claimRecoveryError);
          logger.error('[MintQuoteRecovery] Failed to recover persisted mint claim', {
            quoteId: quote.quoteId.substring(0, 8),
            error: errorMsg,
          });
          result.errors.push(
            `${quote.quoteId.substring(0, 8)}: persisted claim recovery failed - ${errorMsg}`
          );
        }
        continue;
      }

      if (quote.purpose === 'turbo_send') {
        logger.debug('[MintQuoteRecovery] Skipping Turbo send quote; Turbo recovery owns it', {
          quoteId: quote.quoteId.substring(0, 8),
        });
        continue;
      }

      // Skip quotes that are actively being processed by turbo flow. If the app
      // died mid-claim, do not leave the quote stuck in PENDING forever.
      if (quote.state === 'PENDING' && Date.now() - quote.createdAt < STALE_PENDING_MS) {
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

        const mintState = deriveMintQuoteState(mintQuote);
        const availableAmount = getMintQuoteAvailableAmount(mintQuote);
        const hasMintAccounting =
          mintQuote.amount_paid !== undefined || mintQuote.amount_issued !== undefined;
        const canClaim = availableAmount > 0 || (!hasMintAccounting && mintState === 'PAID');

        if (canClaim) {
          // Quote is paid but not yet claimed - recover it!
          // Use the mint's reported amount (actual deposit), not the locally saved amount
          const claimAmount =
            availableAmount > 0 ? availableAmount : (mintQuote.amount ?? quote.amount);
          logger.info('[MintQuoteRecovery] Found paid unclaimed quote, recovering...', {
            quoteId: quote.quoteId.substring(0, 8),
            savedAmount: quote.amount,
            mintAmount: mintQuote.amount,
            amountPaid: mintQuote.amount_paid,
            amountIssued: mintQuote.amount_issued,
            claimAmount,
          });

          try {
            // Mark as pending to prevent double-claim attempts
            await updateMintQuoteState(quote.quoteId, 'PENDING');

            // Complete the mint (claim tokens) - use mint's amount to match deposit
            const proofs =
              (quote.unit ?? DEFAULT_CASHU_UNIT) === DEFAULT_CASHU_UNIT
                ? await lazyCompleteMint(quote.quoteId, claimAmount)
                : await lazyCompleteMint(quote.quoteId, claimAmount, quote.unit);

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
                result.errors.push(
                  `${quote.quoteId.substring(0, 8)}: REMOVED after ${failCount} failures - ${errorMsg}`
                );
              } else {
                result.errors.push(
                  `${quote.quoteId.substring(0, 8)}: ${errorMsg} (attempt ${failCount}/${MAX_CONSECUTIVE_FAILURES})`
                );
                // Reset state so we can try again
                await updateMintQuoteState(quote.quoteId, 'PAID');
              }
            }
          }
        } else if (isMintQuoteAlreadyIssued(mintQuote)) {
          // Already claimed - remove from our list
          logger.info('[MintQuoteRecovery] Quote already issued, removing', {
            quoteId: quote.quoteId.substring(0, 8),
          });
          await removeMintQuote(quote.quoteId);
        } else if (mintState === 'UNPAID') {
          if (isExpiredMintQuote(quote)) {
            logger.info(
              '[MintQuoteRecovery] Expired unpaid quote still unpaid, keeping for late payment recovery',
              {
                quoteId: quote.quoteId.substring(0, 8),
              }
            );
          } else {
            // Still waiting for payment - keep in list
            await updateMintQuoteState(quote.quoteId, 'UNPAID');
          }
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
