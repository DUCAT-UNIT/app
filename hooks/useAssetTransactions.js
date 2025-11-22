/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useEffect, useRef } from 'react';
import { calculateTransactionAmount } from '../services/transactionHistoryService';
import { getSentLockedTokens } from '../services/cashu/cashuLockedTokensService';

/**
 * Hook to filter and process transactions by asset type
 */
export function useAssetTransactions(transactionHistory, assetType, segwitAddress, taprootAddress, advancedMode = false) {
  // Stable ref for filtered transactions
  const filteredTxRef = useRef([]);
  const lastTxHashRef = useRef('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [ecashTokens, setEcashTokens] = useState([]);

  // Fetch ecash tokens when assetType is UNIT and advanced mode is off
  useEffect(() => {
    console.log('[useAssetTransactions] Ecash fetch check:', { assetType, advancedMode });
    if (assetType === 'UNIT' && !advancedMode) {
      let isMounted = true;

      // Defer ecash token loading to prevent blocking screen render
      const timeoutId = setTimeout(() => {
        const loadEcashTokens = async () => {
          try {
            const tokens = await getSentLockedTokens(taprootAddress);
            if (!isMounted) return;
            console.log('[useAssetTransactions] Loaded ecash tokens:', tokens.length);

          // Check which tokens have been claimed
          const { decodeToken } = await import('../services/cashu/cashuCrypto');
          const { checkProofsSpent } = await import('../services/cashu/cashuMintClient');
          const { updateTokenClaimedStatus } = await import('../services/cashu/cashuLockedTokensService');

          let errorCount = 0;
          const MAX_ERRORS_TO_LOG = 3;

          // Process tokens in parallel
          const tokensWithStatus = await Promise.all(
            tokens.map(async (token) => {
              try {
                // If token already has cached claimed status, use it
                if (token.claimed === true) {
                  console.log('[useAssetTransactions] Using cached claimed status for token:', token.id);
                  return {
                    ...token,
                    claimed: true,
                  };
                }

                // Debug: Log what we're trying to decode
                console.log('[useAssetTransactions] Checking token:', {
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
                  console.warn('[useAssetTransactions] Missing or invalid token:', token.id);
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Skip if it's a URL instead of a token
                if (token.token.startsWith('http') || token.token.startsWith('ducat://')) {
                  console.warn('[useAssetTransactions] Token contains URL instead of Cashu token:', token.token.substring(0, 50));
                  return {
                    ...token,
                    claimed: false,
                  };
                }

                // Validate Cashu token format
                if (!token.token.startsWith('cashu')) {
                  console.warn('[useAssetTransactions] Invalid Cashu token format:', token.token.substring(0, 50));
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
                if (allSpent && token.claimed !== true) {
                  console.log('[useAssetTransactions] Token newly claimed, updating cache:', token.id);
                  await updateTokenClaimedStatus(token.id, true);
                }

                return {
                  ...token,
                  claimed: allSpent,
                };
              } catch (error) {
                // Only log first few errors to avoid spam
                if (errorCount < MAX_ERRORS_TO_LOG) {
                  console.error('[useAssetTransactions] Failed to check token status:', error.message);
                  errorCount++;
                  if (errorCount === MAX_ERRORS_TO_LOG) {
                    console.warn('[useAssetTransactions] Suppressing further errors...');
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
          }
        } catch (error) {
          console.error('[useAssetTransactions] Failed to load ecash tokens:', error);
          if (isMounted) {
            setEcashTokens([]);
          }
        }
      };
        loadEcashTokens();
      }, 500); // 500ms delay to let screen render first

      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
      };
    } else {
      console.log('[useAssetTransactions] Not loading ecash tokens - clearing');
      // Clear ecash tokens when not UNIT or when advanced mode is on
      setEcashTokens([]);
    }
  }, [assetType, advancedMode, taprootAddress]);

  // Filter and process transactions - deferred to avoid blocking navigation
  useEffect(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      setFilteredTransactions(filteredTxRef.current);
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
    const filtered = transactionHistory
      .filter(tx => {
        // Quick filter first to reduce processing
        if (tx.vaultTransaction) return false;

        // If already has txData, use it for filtering
        if (tx.txData) {
          return tx.txData.assetType === assetType;
        }

        // For unprocessed transactions, we'll process them next
        return true;
      })
      .map(tx => {
        // If already processed, return as-is
        if (tx.txData) return tx;

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
        };
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
    const ecashTxs = ecashTokens.map((token) => {
      const amount = token.amount / 100; // Convert from smallest units to display units
      console.log('[useAssetTransactions] Creating ecash tx:', { tokenId: token.id, amount, claimed: token.claimed });
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
      };
    });

    console.log('[useAssetTransactions] Merging transactions:', {
      assetType,
      advancedMode,
      regularTxCount: filtered.length,
      ecashTxCount: ecashTxs.length,
      totalEcashTokens: ecashTokens.length
    });

    // Merge and sort by timestamp (most recent first)
    const merged = [...filtered, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || a.status?.block_time || 0;
      const bTime = b.timestamp || b.status?.block_time || 0;
      return bTime - aTime;
    });

    lastTxHashRef.current = txHash;
    filteredTxRef.current = merged;
    setFilteredTransactions(merged);
  }, [transactionHistory, segwitAddress, taprootAddress, assetType, ecashTokens]);

  return filteredTransactions;
}
