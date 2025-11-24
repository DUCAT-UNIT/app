/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import { useTransactionHistory } from '../contexts/WalletDataContext';
import { calculateTransactionAmount } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { getSentLockedTokens } from '../services/cashu/cashuLockedTokensService';

export function useTransactionHistoryData(
  showHistorySheet,
  segwitAddress,
  taprootAddress
) {
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } =
    useTransactionHistory();
  const { advancedMode } = useNavigationHandlers();

  const [loading, setLoading] = useState(false);
  const [ecashTokens, setEcashTokens] = useState([]);
  const [ecashLoading, setEcashLoading] = useState(false);
  const [ecashInitialLoadDone, setEcashInitialLoadDone] = useState(false);
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
          const sentTokens = await getSentLockedTokens(taprootAddress);
          const receivedTokens = await getReceivedTokens(taprootAddress);
          const tokens = [...sentTokens, ...receivedTokens];

          // Check which tokens have been claimed
          const { decodeToken } = await import('../services/cashu/cashuCrypto');
          const { checkProofsSpent } = await import('../services/cashu/cashuMintClient');
          const { updateTokenClaimedStatus } = await import('../services/cashu/cashuLockedTokensService');

          let errorCount = 0;
          const MAX_ERRORS_TO_LOG = 3;

          const tokensWithStatus = await Promise.all(
            tokens.map(async (token) => {
              try {
                // If token already has cached claimed status, use it
                if (token.claimed === true) {
                  console.log('[useTransactionHistoryData] Using cached claimed status for token:', token.id);
                  return {
                    ...token,
                    claimed: true,
                  };
                }

                // Debug: Log what we're trying to decode
                console.log('[useTransactionHistoryData] Checking token:', {
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
                  console.warn('[useTransactionHistoryData] Missing or invalid token:', token.id);
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Skip if it's a URL instead of a token
                if (token.token.startsWith('http') || token.token.startsWith('ducat://')) {
                  console.warn('[useTransactionHistoryData] Token contains URL instead of Cashu token:', token.token.substring(0, 50));
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Validate Cashu token format
                if (!token.token.startsWith('cashu')) {
                  console.warn('[useTransactionHistoryData] Invalid Cashu token format:', token.token.substring(0, 50));
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
                if (allSpent && token.claimed !== true) {
                  console.log('[useTransactionHistoryData] Token newly claimed, updating cache:', token.id);
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
                  console.error('[useTransactionHistoryData] Failed to check token status:', error.message);
                  errorCount++;
                  if (errorCount === MAX_ERRORS_TO_LOG) {
                    console.warn('[useTransactionHistoryData] Suppressing further errors...');
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
          console.error('[useTransactionHistoryData] Failed to load ecash tokens:', error);
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
    // Show loading if:
    // 1. Transaction history is loading and we have no cached data, OR
    // 2. Ecash is loading, OR
    // 3. Haven't calculated transactions yet (prevents flash of empty state)
    if (transactionHistory.length === 0 && loadingTransactionHistory) {
      setLoading(true);
    } else if (ecashLoading || (!advancedMode && !hasCalculatedInitialTransactions.current)) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [loadingTransactionHistory, transactionHistory, ecashLoading, advancedMode]);

  // Filter out self-transfers and prepare display data
  const displayTransactions = useMemo(() => {
    // For normal mode, wait for ecash to finish loading before displaying ANY transactions
    // This ensures runes and ecash transactions appear together as a batch
    if (!advancedMode && !ecashInitialLoadDone) {
      console.log('[useTransactionHistoryData] Waiting for ecash tokens to load before displaying transactions');
      // Don't mark as calculated yet - we're still waiting
      return [];
    }

    // Process regular transactions
    const regularTxs = transactionHistory
      .filter((tx) => {
        if (tx.vaultTransaction) return true; // Always show vault transactions

        const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
        const isSelfTransfer = txData.isSelfTransfer || txData.amount === 0n || txData.amount === 0;

        return !isSelfTransfer; // Filter out self-transfers
      })
      .map((tx) => {
        // For regular transactions, calculate and attach txData
        if (!tx.vaultTransaction) {
          const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
          const amount = typeof txData === 'object' ? txData.amount : txData;
          const assetType = typeof txData === 'object' ? txData.type : 'BTC';

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
        return tx;
      });

    // Process ecash tokens (only when advanced mode is off)
    const ecashTxs = ecashTokens.map((token) => {
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
      };
    });

    // Merge and sort by timestamp (most recent first)
    const merged = [...regularTxs, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return bTime - aTime;
    });

    // Mark that we've calculated initial transactions (only if we actually processed them)
    hasCalculatedInitialTransactions.current = true;

    return merged;
  }, [transactionHistory, ecashTokens, segwitAddress, taprootAddress, ecashInitialLoadDone, advancedMode]);

  // Open transaction in blockchain explorer
  const openTxInExplorer = useCallback(async (txid, assetType) => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(txid) : getTxUrl(txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silently fail
    }
  }, []);

  return {
    loading,
    displayTransactions,
    openTxInExplorer,
  };
}
