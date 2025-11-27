/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getSentLockedTokens, getReceivedTokens, EcashTokenRecord, subscribeToTokenChanges } from '../services/cashu/cashuLockedTokensService';
import { loadTokensWithStatus, TokenWithStatus } from '../services/cashu/tokenStatusService';
import { logger } from '../utils/logger';
import type { DisplayAssetType } from '../types/assets';

interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
  isAutoclaim?: boolean;
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
  isAutoclaim?: boolean;
  timestamp?: number;
  vaultTransaction?: boolean;
  [key: string]: unknown;
}

/** Type alias for EcashToken - uses TokenWithStatus from the service */
type EcashToken = TokenWithStatus;

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
  // Track if ecash tokens have loaded
  const [ecashReady, setEcashReady] = useState(assetType !== 'UNIT' || advancedMode);
  // Track if we've done initial load (prevents spinner on background refetches)
  const hasLoadedRef = useRef(false);
  // Track if transactions have been processed at least once
  const transactionsProcessedRef = useRef(false);
  // Counter to trigger ecash token refetch when tokens change
  const [ecashRefetchTrigger, setEcashRefetchTrigger] = useState(0);
  // Cache for parsed transaction data - keyed by txid, persists across renders
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Subscribe to token changes to trigger refetch (debounced to prevent rapid updates)
  useEffect(() => {
    if (assetType !== 'UNIT' || advancedMode) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToTokenChanges(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.debug('[useAssetTransactions] Token change detected, triggering refetch');
        setEcashRefetchTrigger(prev => prev + 1);
      }, 300);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [assetType, advancedMode]);

  // Fetch ecash tokens when assetType is UNIT and advanced mode is off
  useEffect(() => {
    if (assetType === 'UNIT' && !advancedMode) {
      let isMounted = true;

      // Only reset ecashReady on initial load, not background refetches
      const isInitialLoad = !hasLoadedRef.current;
      if (isInitialLoad) {
        setEcashReady(false);
      }

      const loadEcashTokens = async () => {
        try {
          const tokensWithStatus = await loadTokensWithStatus(
            taprootAddress,
            getSentLockedTokens,
            getReceivedTokens
          );

          if (isMounted) {
            setEcashTokens(tokensWithStatus);
            setEcashReady(true);
            hasLoadedRef.current = true;
          }
        } catch (error: unknown) {
          logger.error('[useAssetTransactions] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
          if (isMounted) {
            setEcashTokens([]);
            setEcashReady(true);
            hasLoadedRef.current = true;
          }
        }
      };
      loadEcashTokens();

      return () => {
        isMounted = false;
      };
    } else {
      // Not UNIT or advanced mode - ecash is ready immediately
      setEcashTokens([]);
      setEcashReady(true);
    }
  }, [assetType, advancedMode, taprootAddress, ecashRefetchTrigger]);

  // Cache taproot pubkey decoding - only changes when address changes
  const currentPubkeyHex = useMemo(() => {
    if (!taprootAddress) return null;
    try {
      const decoded = bitcoin.address.fromBech32(taprootAddress);
      return Buffer.from(decoded.data).toString('hex');
    } catch (e) {
      logger.warn('[useAssetTransactions] Failed to decode taproot address for self-claim detection');
      return null;
    }
  }, [taprootAddress]);

  // Filter and process transactions - deferred to avoid blocking navigation
  useEffect(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      setFilteredTransactions(filteredTxRef.current);
      return;
    }

    // For UNIT assets, wait for ecash tokens to finish loading before displaying
    // This ensures runes and ecash transactions appear together
    if (assetType === 'UNIT' && !advancedMode && !ecashReady) {
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

    // Process transactions in a single pass with caching
    // Uses cache to avoid recalculating when only confirmation status changes
    const filtered: ProcessedTransaction[] = [];
    const cache = txDataCacheRef.current;

    for (const tx of transactionHistory) {
      // Skip vault transactions
      if (tx.vaultTransaction) continue;

      // Check for existing txData on the transaction object first (from upstream processing)
      const txWithData = tx as ProcessedTransaction;
      let processedTxData: TxData | undefined;

      if (txWithData.txData) {
        // Use existing txData without recalculating
        processedTxData = txWithData.txData;
      } else {
        // Check cache - txid is immutable so amount won't change
        processedTxData = cache.get(tx.txid);

        if (!processedTxData) {
          // Calculate and cache transaction data
          const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);
          const amount = typeof txData === 'object' ? txData.amount : txData;
          const txAssetType = typeof txData === 'object' ? txData.type : 'BTC';
          const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;

          processedTxData = {
            amount,
            assetType: txAssetType,
            numericAmount,
            isSent: numericAmount < 0,
            isReceived: numericAmount > 0,
          };

          cache.set(tx.txid, processedTxData);
        }
      }

      // Filter by asset type
      if (processedTxData.assetType !== assetType) continue;

      // Filter out transactions with no amount (0 or null)
      if (!processedTxData.numericAmount || processedTxData.numericAmount === 0) continue;

      filtered.push({
        ...tx,
        txData: processedTxData,
      } as ProcessedTransaction);
    }

    // First pass: identify self-claimed sent tokens (using cached currentPubkeyHex)
    const selfClaimedSentTokenIds = new Set<string>();
    ecashTokens.forEach((token) => {
      const isSentToken = 'recipient' in token;
      if (isSentToken && token.claimed) {
        const sentToken = token as { recipient: string; taprootAddress: string | null };
        const isSelfClaim =
          (sentToken.taprootAddress && taprootAddress && sentToken.taprootAddress === taprootAddress) ||
          (currentPubkeyHex && sentToken.recipient === currentPubkeyHex);
        if (isSelfClaim) {
          selfClaimedSentTokenIds.add(token.id);
        }
      }
    });

    // Merge ecash tokens, filtering out received tokens that are self-claims
    const ecashTxs: ProcessedTransaction[] = ecashTokens
      .filter((token) => {
        const isReceivedToken = 'sender' in token;
        // Filter out received tokens if they match the same account (self-claim duplicate)
        if (isReceivedToken) {
          const receivedToken = token as { sender: string; taprootAddress: string | null };
          if (receivedToken.taprootAddress && taprootAddress && receivedToken.taprootAddress === taprootAddress) {
            logger.debug('[useAssetTransactions] Filtering out self-claim received token:', { tokenId: token.id });
            return false;
          }
        }
        return true;
      })
      .map((token) => {
        // Keep amount as integer (smallest units) - conversion to display happens in UI
        const amount = token.amount;
        const isSentToken = 'recipient' in token;
        const isAutoclaim = selfClaimedSentTokenIds.has(token.id);

        logger.debug('[useAssetTransactions] Creating ecash tx:', { tokenId: token.id, amount, claimed: token.claimed, isAutoclaim, isSentToken });

        return {
          txid: token.id,
          timestamp: token.timestamp,
          ecashToken: true, // Flag to identify as ecash transaction
          tokenData: token, // Include full token data for TokenDetailsSheet
          claimed: token.claimed, // Whether token has been claimed
          isAutoclaim, // Flag for self-claimed tokens
          txData: {
            // For self-claim, show positive amount (got funds back)
            // Amount stays as integer (smallest units)
            amount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            assetType: 'UNIT', // Set to UNIT so it appears in UNIT activity
            numericAmount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            isSent: isSentToken && !isAutoclaim,
            isReceived: !isSentToken || isAutoclaim,
            isAutoclaim,
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
    transactionsProcessedRef.current = true;
  }, [transactionHistory, segwitAddress, taprootAddress, assetType, ecashTokens, ecashReady, advancedMode, currentPubkeyHex]);

  // Loading is true until:
  // 1. Ecash is ready (for UNIT) or immediately (for BTC)
  // 2. AND transactions have been processed at least once
  const isLoading = !ecashReady || !transactionsProcessedRef.current;

  return {
    transactions: filteredTransactions,
    isLoading,
  };
}
