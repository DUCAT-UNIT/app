/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useEffect, useRef } from 'react';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getSentLockedTokens } from '../services/cashu/cashuLockedTokensService';
import { logger } from '../utils/logger';
import type { DisplayAssetType } from '../types/assets';
import type { Proof, ProofState } from '../types/cashu';

interface CheckProofsResult {
  states?: ProofState[];
}

interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
}

// Use a more flexible type for processed transactions
export interface ProcessedTransaction {
  txid: string;
  status?: {
    confirmed: boolean;
    block_time: number;
    block_height?: number;
    block_hash?: string;
  };
  txData?: TxData;
  ecashToken?: boolean;
  tokenData?: EcashToken;
  claimed?: boolean;
  timestamp?: number;
  vaultTransaction?: boolean;
  [key: string]: unknown;
}

interface EcashToken {
  id: string;
  token?: string;
  amount: number;
  timestamp: number;
  claimed?: boolean;
  [key: string]: unknown;
}

interface UseAssetTransactionsReturn {
  transactions: ProcessedTransaction[];
  isLoading: boolean;
}

/**
 * Hook to filter and process transactions by asset type
 */
export function useAssetTransactions(
  transactionHistory: Transaction[] | null,
  assetType: DisplayAssetType,
  segwitAddress: string | undefined,
  taprootAddress: string | undefined,
  advancedMode: boolean = false
): UseAssetTransactionsReturn {
  // Stable ref for filtered transactions
  const filteredTxRef = useRef<ProcessedTransaction[]>([]);
  const lastTxHashRef = useRef('');
  const [filteredTransactions, setFilteredTransactions] = useState<ProcessedTransaction[]>([]);
  const [ecashTokens, setEcashTokens] = useState<EcashToken[]>([]);
  // Start with loading=true for UNIT assets so we show spinner immediately
  const [ecashLoading, setEcashLoading] = useState(assetType === 'UNIT' && !advancedMode);
  const [ecashInitialLoadDone, setEcashInitialLoadDone] = useState(assetType !== 'UNIT' || advancedMode);
  const hasCalculatedInitialTransactions = useRef(false);

  // Fetch ecash tokens when assetType is UNIT and advanced mode is off
  useEffect(() => {
    logger.debug('[useAssetTransactions] Ecash fetch check:', { assetType, advancedMode });
    if (assetType === 'UNIT' && !advancedMode) {
      let isMounted = true;

      // Load ecash tokens (no delay needed since claimed tokens are cached)
      const loadEcashTokens = async () => {
          try {
            setEcashLoading(true);
            const { getReceivedTokens } = await import('../services/cashu/cashuLockedTokensService');
            const sentTokens = await getSentLockedTokens(taprootAddress) as unknown as EcashToken[];
            const receivedTokens = await getReceivedTokens(taprootAddress) as unknown as EcashToken[];
            const tokens: EcashToken[] = [...sentTokens, ...receivedTokens];
            if (!isMounted) return;
            logger.debug('[useAssetTransactions] Loaded ecash tokens:', { total: tokens.length, sent: sentTokens.length, received: receivedTokens.length });

          // Check which tokens have been claimed
          const { decodeToken } = await import('../services/cashu/crypto') as { decodeToken: (token: string) => { proofs: Proof[] } };
          const { checkProofsSpent } = await import('../services/cashu/cashuMintClient') as { checkProofsSpent: (proofs: Proof[]) => Promise<CheckProofsResult> };
          const { updateTokenClaimedStatus } = await import('../services/cashu/cashuLockedTokensService') as { updateTokenClaimedStatus: (id: string, claimed: boolean) => Promise<void> };

          let errorCount = 0;
          const MAX_ERRORS_TO_LOG = 3;

          // Process tokens in parallel
          const tokensWithStatus = await Promise.all(
            tokens.map(async (token) => {
              try {
                // If token already has cached claimed status, use it
                if (token.claimed === true) {
                  logger.debug('[useAssetTransactions] Using cached claimed status for token:', { tokenId: token.id });
                  return {
                    ...token,
                    claimed: true,
                  };
                }

                // Debug: Log what we're trying to decode
                logger.debug('[useAssetTransactions] Checking token:', {
                  id: token.id,
                  hasToken: !!token.token,
                  tokenType: typeof token.token,
                  tokenStart: token.token?.substring(0, 20),
                  isUrl: token.token?.startsWith('http'),
                  isCashu: token.token?.startsWith('cashu'),
                  cachedClaimed: token.claimed,
                });

                // Validate that token.token exists and is a Cashu token string (not a URL)
                if (!token.token || typeof token.token !== 'string') {
                  logger.warn('[useAssetTransactions] Missing or invalid token:', { tokenId: token.id });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Skip if it's a URL instead of a token
                if (token.token.startsWith('http') || token.token.startsWith('ducat://')) {
                  logger.warn('[useAssetTransactions] Token contains URL instead of Cashu token:', { tokenStart: token.token.substring(0, 50) });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Validate Cashu token format
                if (!token.token.startsWith('cashu')) {
                  logger.warn('[useAssetTransactions] Invalid Cashu token format:', { tokenStart: token.token.substring(0, 50) });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Decode token to get proofs
                const { proofs } = decodeToken(token.token);

                // Check if proofs are spent
                const result = await checkProofsSpent(proofs);
                const allSpent = result.states?.every(s => s.state === 'SPENT');

                // If token is now claimed, update cache
                if (allSpent && !token.claimed) {
                  logger.debug('[useAssetTransactions] Token newly claimed, updating cache:', { tokenId: token.id });
                  await updateTokenClaimedStatus(token.id, true);
                }

                return {
                  ...token,
                  claimed: allSpent,
                };
              } catch (error) {
                // Only log first few errors to avoid spam
                if (errorCount < MAX_ERRORS_TO_LOG) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  logger.error('[useAssetTransactions] Failed to check token status:', { error: errorMessage });
                  errorCount++;
                  if (errorCount === MAX_ERRORS_TO_LOG) {
                    logger.warn('[useAssetTransactions] Suppressing further errors...');
                  }
                }
                return {
                  ...token,
                  claimed: false, // Default to unclaimed if check fails
                };
              }
            })
          );

          if (isMounted) {
            setEcashTokens(tokensWithStatus);
            setEcashLoading(false);
            setEcashInitialLoadDone(true);
          }
        } catch (error) {
          logger.error('[useAssetTransactions] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
          if (isMounted) {
            setEcashTokens([]);
            setEcashLoading(false);
            setEcashInitialLoadDone(true);
          }
        }
      };
      loadEcashTokens();

      return () => {
        isMounted = false;
      };
    } else {
      logger.debug('[useAssetTransactions] Not loading ecash tokens - clearing');
      // Clear ecash tokens when not UNIT or when advanced mode is on
      setEcashTokens([]);
      setEcashInitialLoadDone(true); // Mark as done immediately for non-UNIT
    }
  }, [assetType, advancedMode, taprootAddress]);

  // Filter and process transactions - deferred to avoid blocking navigation
  useEffect(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      setFilteredTransactions(filteredTxRef.current);
      return;
    }

    // For UNIT assets, wait for ecash tokens to finish loading before displaying
    // This ensures runes and ecash transactions appear together
    if (assetType === 'UNIT' && !advancedMode && !ecashInitialLoadDone) {
      logger.debug('[useAssetTransactions] Waiting for ecash tokens to load before displaying UNIT transactions');
      return;
    }

    // Create a hash to check if we need to recalculate
    // Include confirmation status AND block height to detect when transactions confirm
    // Also include ecashTokens count to trigger re-merge when tokens load
    const txHash = transactionHistory
      .map(t => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
      .join('|') + `-${assetType}-ecash:${ecashTokens.length}`;

    const hashChanged = txHash !== lastTxHashRef.current;

    if (!hashChanged && filteredTxRef.current.length > 0) {
      // Hash unchanged - no need to recalculate, use cached version
      setFilteredTransactions(filteredTxRef.current);
      return;
    }

    // First filter, then process only what we need
    const filtered: ProcessedTransaction[] = transactionHistory
      .filter(tx => {
        // Quick filter first to reduce processing
        if (tx.vaultTransaction) return false;

        // If already has txData, use it for filtering
        const txWithData = tx as ProcessedTransaction;
        if (txWithData.txData) {
          return txWithData.txData.assetType === assetType;
        }

        // For unprocessed transactions, we'll process them next
        return true;
      })
      .map(tx => {
        // If already processed, return as-is
        const txWithData = tx as ProcessedTransaction;
        if (txWithData.txData) return txWithData;

        // Process regular transaction - create new object to avoid mutation
        const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
        const amount = typeof txData === 'object' ? txData.amount : txData;
        const txAssetType = typeof txData === 'object' ? txData.type : 'BTC';
        const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

        return {
          ...tx,
          txData: {
            amount,
            assetType: txAssetType,
            numericAmount,
            isSent: numericAmount < 0,
            isReceived: numericAmount > 0,
          },
        } as ProcessedTransaction;
      })
      .filter(tx => {
        // Filter by asset type
        if (tx.txData?.assetType !== assetType) return false;

        // Filter out transactions with no amount (0 or null)
        const numericAmount = tx.txData?.numericAmount;
        if (!numericAmount || numericAmount === 0) return false;

        return true;
      });

    // Merge ecash tokens if applicable
    const ecashTxs: ProcessedTransaction[] = ecashTokens.map((token) => {
      const amount = token.amount / 100; // Convert from smallest units to display units
      logger.debug('[useAssetTransactions] Creating ecash tx:', { tokenId: token.id, amount, claimed: token.claimed });
      return {
        txid: token.id,
        timestamp: token.timestamp,
        ecashToken: true, // Flag to identify as ecash transaction
        tokenData: token, // Include full token data for TokenDetailsSheet
        claimed: token.claimed, // Whether token has been claimed
        txData: {
          amount: -amount, // Negative because it's sent
          assetType: 'UNIT', // Set to UNIT so it appears in UNIT activity
          numericAmount: -amount,
          isSent: true,
          isReceived: false,
        },
      } as ProcessedTransaction;
    });

    logger.debug('[useAssetTransactions] Merging transactions:', {
      assetType,
      advancedMode,
      regularTxCount: filtered.length,
      ecashTxCount: ecashTxs.length,
      totalEcashTokens: ecashTokens.length
    });

    // Merge and sort by timestamp (most recent first)
    const merged: ProcessedTransaction[] = [...filtered, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || a.status?.block_time || 0;
      const bTime = b.timestamp || b.status?.block_time || 0;
      return bTime - aTime;
    });

    lastTxHashRef.current = txHash;
    filteredTxRef.current = merged;
    setFilteredTransactions(merged);

    // Mark that we've calculated initial transactions for UNIT assets
    if (assetType === 'UNIT' && !advancedMode) {
      hasCalculatedInitialTransactions.current = true;
    }
  }, [transactionHistory, segwitAddress, taprootAddress, assetType, ecashTokens, ecashInitialLoadDone, advancedMode]);

  return {
    transactions: filteredTransactions,
    // Show loading if ecash is loading OR if we haven't calculated transactions yet for UNIT
    isLoading: ecashLoading || (assetType === 'UNIT' && !advancedMode && !hasCalculatedInitialTransactions.current),
  };
}
