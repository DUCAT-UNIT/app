/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import { useTransactionHistory } from '../contexts/WalletDataContext';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { getSentLockedTokens } from '../services/cashu/cashuLockedTokensService';
import { logger } from '../utils/logger';

interface Proof {
  id: string;
  amount: number;
  secret: string;
  C: string;
}

interface ProofState {
  state: 'UNSPENT' | 'SPENT' | 'PENDING';
}

interface CheckProofsResult {
  states?: ProofState[];
}

interface EcashToken {
  id: string;
  token?: string;
  amount: number;
  timestamp: number;
  claimed?: boolean;
  partiallySpent?: boolean;
  recipient?: string;
  shortUrl?: string;
  [key: string]: unknown;
}

interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
  isSelfTransfer?: boolean;
}

export interface ProcessedTransaction extends Transaction {
  txData?: TxData;
  ecashToken?: boolean;
  tokenData?: EcashToken;
  claimed?: boolean;
  partiallySpent?: boolean;
  timestamp?: number;
}

// Alias for backwards compatibility
export type DisplayTransaction = ProcessedTransaction;

interface UseTransactionHistoryDataReturn {
  loading: boolean;
  displayTransactions: ProcessedTransaction[];
  openTxInExplorer: (txid: string, assetType: string) => Promise<void>;
}

export function useTransactionHistoryData(
  showHistorySheet: boolean,
  segwitAddress: string | undefined,
  taprootAddress: string | undefined
): UseTransactionHistoryDataReturn {
  const { transactionHistory: rawTransactionHistory, loadingTransactionHistory, fetchTransactionHistory } =
    useTransactionHistory();
  const transactionHistory = rawTransactionHistory as Transaction[];
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers.advancedMode;

  const [loading, setLoading] = useState(false);
  const [ecashTokens, setEcashTokens] = useState<EcashToken[]>([]);
  const [ecashLoading, setEcashLoading] = useState(false);
  const [, setEcashInitialLoadDone] = useState(false);
  const hasCalculatedInitialTransactions = useRef(false);

  // Set initial loading state immediately when sheet opens
  useEffect(() => {
    if (showHistorySheet && !advancedMode) {
      // About to load ecash - set loading immediately
      setLoading(true);
    }
  }, [showHistorySheet, advancedMode]);

  // Fetch ecash tokens when sheet opens and advanced mode is off
  useEffect(() => {
    if (showHistorySheet && !advancedMode) {
      // Reset flags immediately to prevent showing transactions before ecash loads
      setEcashInitialLoadDone(false);
      hasCalculatedInitialTransactions.current = false;

      const loadEcashTokens = async () => {
        try {
          setEcashLoading(true);
          const { getReceivedTokens } = await import('../services/cashu/cashuLockedTokensService');
          const sentTokens = await getSentLockedTokens(taprootAddress) as unknown as EcashToken[];
          const receivedTokens = await getReceivedTokens(taprootAddress) as unknown as EcashToken[];
          const tokens: EcashToken[] = [...sentTokens, ...receivedTokens];

          // Check which tokens have been claimed
          const { decodeToken } = await import('../services/cashu/crypto') as { decodeToken: (token: string) => { proofs: Proof[] } };
          const { checkProofsSpent } = await import('../services/cashu/cashuMintClient') as { checkProofsSpent: (proofs: Proof[]) => Promise<CheckProofsResult> };
          const { updateTokenClaimedStatus } = await import('../services/cashu/cashuLockedTokensService') as { updateTokenClaimedStatus: (id: string, claimed: boolean) => Promise<void> };

          let errorCount = 0;
          const MAX_ERRORS_TO_LOG = 3;

          const tokensWithStatus = await Promise.all(
            tokens.map(async (token) => {
              try {
                // If token already has cached claimed status, use it
                if (token.claimed === true) {
                  logger.debug('[useTransactionHistoryData] Using cached claimed status for token:', token.id);
                  return {
                    ...token,
                    claimed: true,
                  };
                }

                // Debug: Log what we're trying to decode
                logger.debug('[useTransactionHistoryData] Checking token:', {
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
                  logger.warn('[useTransactionHistoryData] Missing or invalid token:', { tokenId: token.id });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Skip if it's a URL instead of a token
                if (token.token.startsWith('http') || token.token.startsWith('ducat://')) {
                  logger.warn('[useTransactionHistoryData] Token contains URL instead of Cashu token:', { tokenStart: token.token.substring(0, 50) });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Validate Cashu token format
                if (!token.token.startsWith('cashu')) {
                  logger.warn('[useTransactionHistoryData] Invalid Cashu token format:', { tokenStart: token.token.substring(0, 50) });
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Decode token to get proofs
                const { proofs } = decodeToken(token.token);

                // Check if proofs are spent
                const result = await checkProofsSpent(proofs);
                const spentCount = result.states?.filter(s => s.state === 'SPENT').length || 0;
                const totalCount = result.states?.length || 0;
                const allSpent = spentCount === totalCount && totalCount > 0;
                const partiallySpent = spentCount > 0 && spentCount < totalCount;

                // If token is now claimed, update cache
                if (allSpent && !token.claimed) {
                  logger.debug('[useTransactionHistoryData] Token newly claimed, updating cache:', { tokenId: token.id });
                  await updateTokenClaimedStatus(token.id, true);
                }

                return {
                  ...token,
                  claimed: allSpent,
                  partiallySpent,
                };
              } catch (error) {
                // Only log first few errors to avoid spam
                if (errorCount < MAX_ERRORS_TO_LOG) {
                  logger.error('[useTransactionHistoryData] Failed to check token status:', { error: error instanceof Error ? error.message : String(error) });
                  errorCount++;
                  if (errorCount === MAX_ERRORS_TO_LOG) {
                    logger.warn('[useTransactionHistoryData] Suppressing further errors...');
                  }
                }
                return {
                  ...token,
                  claimed: false, // Default to unclaimed if check fails
                };
              }
            })
          );

          setEcashTokens(tokensWithStatus);
          setEcashLoading(false);
          setEcashInitialLoadDone(true);
        } catch (error) {
          logger.error('[useTransactionHistoryData] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
          setEcashTokens([]);
          setEcashLoading(false);
          setEcashInitialLoadDone(true);
        }
      };
      loadEcashTokens();
    } else {
      // Clear ecash tokens when advanced mode is on or sheet is closed
      setEcashTokens([]);
      setEcashInitialLoadDone(true); // Mark as done immediately when not loading
    }
  }, [showHistorySheet, advancedMode, taprootAddress]);

  // Manage loading state when sheet opens
  useEffect(() => {
    if (showHistorySheet) {
      // Only show loading spinner if we don't have any cached data
      setLoading(transactionHistory.length === 0 && loadingTransactionHistory);

      // Trigger a fresh fetch in background
      fetchTransactionHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorySheet]);

  // Update loading state when context loading changes or ecash is loading
  useEffect(() => {
    // Show loading only if we have no data and are actively loading
    const hasNoData = transactionHistory.length === 0 && ecashTokens.length === 0;
    const isLoadingData = loadingTransactionHistory || ecashLoading;

    if (hasNoData && isLoadingData) {
      setLoading(true);
    } else {
      setLoading(false);
      hasCalculatedInitialTransactions.current = true;
    }
  }, [loadingTransactionHistory, transactionHistory, ecashLoading, ecashTokens]);

  // Filter out self-transfers and prepare display data
  const displayTransactions = useMemo(() => {
    if (!segwitAddress || !taprootAddress) {
      return [];
    }

    // Process regular transactions
    const regularTxs = transactionHistory
      .filter((tx) => {
        if (tx.vaultTransaction) return true; // Always show vault transactions

        const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
        // Check for isSelfTransfer (only on BTC transactions) or zero amount
        const isSelfTransfer = ('isSelfTransfer' in txData && txData.isSelfTransfer) ||
          txData.amount === 0n || txData.amount === 0;

        return !isSelfTransfer; // Filter out self-transfers
      })
      .map((tx): ProcessedTransaction => {
        // For regular transactions, calculate and attach txData
        if (!tx.vaultTransaction) {
          const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
          const amount = txData.amount;
          const assetType = txData.type;

          // Handle BigInt for UNIT amounts
          const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;
          const isSent = numericAmount < 0;
          const isReceived = numericAmount > 0;

          return {
            ...tx,
            txData: {
              amount,
              assetType,
              numericAmount,
              isSent,
              isReceived,
            },
          };
        }
        return tx as ProcessedTransaction;
      });

    // Process ecash tokens (only when advanced mode is off)
    const ecashTxs: ProcessedTransaction[] = ecashTokens.map((token): ProcessedTransaction => {
      const amount = token.amount / 100; // Convert from smallest units to display units
      return {
        txid: token.id,
        timestamp: token.timestamp,
        ecashToken: true, // Flag to identify as ecash transaction
        tokenData: token, // Include full token data for TokenDetailsSheet
        claimed: token.claimed, // Whether token has been claimed
        partiallySpent: token.partiallySpent, // Whether token has been partially spent
        txData: {
          amount: -amount, // Negative because it's sent
          assetType: 'UNIT', // Set to UNIT for consistency
          numericAmount: -amount,
          isSent: true,
          isReceived: false,
        },
      } as ProcessedTransaction;
    });

    // Merge and sort by timestamp (most recent first)
    const merged: ProcessedTransaction[] = [...regularTxs, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return bTime - aTime;
    });

    // Mark that we've calculated initial transactions (only if we actually processed them)
    hasCalculatedInitialTransactions.current = true;

    return merged;
  }, [transactionHistory, ecashTokens, segwitAddress, taprootAddress]);

  // Open transaction in blockchain explorer
  const openTxInExplorer = useCallback(async (txid: string, assetType: string): Promise<void> => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(txid) : getTxUrl(txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Silently fail
    }
  }, []);

  return {
    loading,
    displayTransactions,
    openTxInExplorer,
  };
}
