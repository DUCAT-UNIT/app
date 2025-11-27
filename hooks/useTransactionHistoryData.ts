/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import * as bitcoin from 'bitcoinjs-lib';
import { useTransactionHistory } from '../contexts/WalletDataContext';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { getSentLockedTokens, getReceivedTokens, subscribeToTokenChanges } from '../services/cashu/cashuLockedTokensService';
import { loadTokensWithStatus, TokenWithStatus } from '../services/cashu/tokenStatusService';
import { logger } from '../utils/logger';

/** Type alias for EcashToken - uses TokenWithStatus from the service */
type EcashToken = TokenWithStatus;

interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
  isSelfTransfer?: boolean;
  isAutoclaim?: boolean;
}

export interface ProcessedTransaction extends Transaction {
  txData?: TxData;
  ecashToken?: boolean;
  tokenData?: EcashToken;
  claimed?: boolean;
  partiallySpent?: boolean;
  isAutoclaim?: boolean;
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

  const [ecashTokens, setEcashTokens] = useState<EcashToken[]>([]);
  // Loading state - true until first successful load when sheet opens
  const [loading, setLoading] = useState(false);
  // Track if we've done initial load for this sheet session
  const hasLoadedRef = useRef(false);
  // Counter to trigger ecash token refetch when tokens change
  const [ecashRefetchTrigger, setEcashRefetchTrigger] = useState(0);
  // Cache for parsed transaction data - keyed by txid, persists across renders
  // This prevents recalculating amounts when just confirmation status changes
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Subscribe to token changes to trigger refetch (debounced to prevent rapid updates)
  useEffect(() => {
    if (!showHistorySheet || advancedMode) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToTokenChanges(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.debug('[useTransactionHistoryData] Token change detected, triggering refetch');
        setEcashRefetchTrigger(prev => prev + 1);
      }, 300);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [showHistorySheet, advancedMode]);

  // Fetch both transaction history and ecash tokens in parallel when sheet opens
  useEffect(() => {
    if (!showHistorySheet) {
      // Reset when sheet closes so next open shows spinner
      setEcashTokens([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Only show loading spinner on initial load, not background refetches
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
    }

    // Start fetches
    const loadData = async () => {
      try {
        // Fire off transaction history fetch (doesn't return data directly, updates context)
        const txHistoryPromise = fetchTransactionHistory();

        // Fire off ecash tokens fetch if not in advanced mode
        let ecashPromise: Promise<EcashToken[]> = Promise.resolve([]);
        if (!advancedMode) {
          ecashPromise = loadTokensWithStatus(
            taprootAddress,
            getSentLockedTokens,
            getReceivedTokens
          );
        }

        // Wait for both to complete
        const [, tokensWithStatus] = await Promise.all([txHistoryPromise, ecashPromise]);
        setEcashTokens(tokensWithStatus);
      } catch (error: unknown) {
        logger.error('[useTransactionHistoryData] Failed to load data:', { error: error instanceof Error ? error.message : String(error) });
        setEcashTokens([]);
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorySheet, advancedMode, taprootAddress, ecashRefetchTrigger]);

  // Cache taproot pubkey decoding - only changes when address changes
  const currentPubkeyHex = useMemo(() => {
    if (!taprootAddress) return null;
    try {
      const decoded = bitcoin.address.fromBech32(taprootAddress);
      return Buffer.from(decoded.data).toString('hex');
    } catch (e) {
      logger.warn('[useTransactionHistoryData] Failed to decode taproot address for self-claim detection', { error: e });
      return null;
    }
  }, [taprootAddress]);

  // Filter out self-transfers and prepare display data
  const displayTransactions = useMemo(() => {
    if (!segwitAddress || !taprootAddress) {
      return [];
    }

    // Process regular transactions in a single pass (filter + map combined)
    // This avoids calling calculateTransactionAmount twice per transaction
    // Uses cache to avoid recalculating when only confirmation status changes
    const regularTxs: ProcessedTransaction[] = [];
    const cache = txDataCacheRef.current;

    for (const tx of transactionHistory) {
      // Always show vault transactions
      if (tx.vaultTransaction) {
        regularTxs.push(tx as ProcessedTransaction);
        continue;
      }

      // Check cache first - txid is immutable so amount won't change
      let processedTxData = cache.get(tx.txid);

      if (!processedTxData) {
        // Calculate amount and cache it
        const txData = calculateTransactionAmount(tx, segwitAddress, taprootAddress);

        // Check for isSelfTransfer (only on BTC transactions) or zero amount
        const isSelfTransfer = ('isSelfTransfer' in txData && txData.isSelfTransfer) ||
          txData.amount === 0n || txData.amount === 0;

        // Skip self-transfers but still cache to avoid recalculating
        if (isSelfTransfer) {
          // Cache as a marker that this is a self-transfer
          cache.set(tx.txid, { amount: 0, assetType: 'BTC', numericAmount: 0, isSent: false, isReceived: false, isSelfTransfer: true });
          continue;
        }

        const amount = txData.amount;
        const assetType = txData.type;

        // Handle BigInt for UNIT amounts
        const numericAmount = typeof amount === 'bigint' ? Number(amount) : amount;
        const isSent = numericAmount < 0;
        const isReceived = numericAmount > 0;

        processedTxData = {
          amount,
          assetType,
          numericAmount,
          isSent,
          isReceived,
        };

        // Cache for future use
        cache.set(tx.txid, processedTxData);
      } else if ('isSelfTransfer' in processedTxData && processedTxData.isSelfTransfer) {
        // Skip cached self-transfers
        continue;
      }

      regularTxs.push({
        ...tx,
        txData: processedTxData,
      });
    }

    // First pass: identify self-claimed sent tokens
    const selfClaimedSentTokenIds = new Set<string>();
    ecashTokens.forEach((token) => {
      const isSentToken = 'recipient' in token;
      if (isSentToken && token.claimed) {
        const sentToken = token as { recipient: string; taprootAddress: string | null };
        // Check if this is a self-claim
        const isSelfClaim =
          (sentToken.taprootAddress && taprootAddress && sentToken.taprootAddress === taprootAddress) ||
          (currentPubkeyHex && sentToken.recipient === currentPubkeyHex);
        if (isSelfClaim) {
          selfClaimedSentTokenIds.add(token.id);
        }
      }
    });

    // Process ecash tokens, filtering out received tokens that are self-claims
    const ecashTxs: ProcessedTransaction[] = ecashTokens
      .filter((token) => {
        const isReceivedToken = 'sender' in token;
        // Filter out received tokens if they match the same account (self-claim duplicate)
        if (isReceivedToken) {
          const receivedToken = token as { sender: string; taprootAddress: string | null };
          // If this received token is from the same account, it's a self-claim duplicate - filter it out
          if (receivedToken.taprootAddress && taprootAddress && receivedToken.taprootAddress === taprootAddress) {
            logger.debug('[useTransactionHistoryData] Filtering out self-claim received token:', { tokenId: token.id });
            return false;
          }
        }
        return true;
      })
      .map((token): ProcessedTransaction => {
        // Keep amount as integer (smallest units) - conversion to display happens in UI
        const amount = token.amount;
        // Check if this is a sent token (has 'recipient') or received token (has 'sender')
        const isSentToken = 'recipient' in token;

        // Check for self-claim - sent token that was claimed by the same account
        const isAutoclaim = selfClaimedSentTokenIds.has(token.id);

        if (isAutoclaim) {
          logger.info('[useTransactionHistoryData] Self-claim token:', { tokenId: token.id });
        }

        return {
          txid: token.id,
          timestamp: token.timestamp,
          ecashToken: true, // Flag to identify as ecash transaction
          tokenData: token, // Include full token data for TokenDetailsSheet
          claimed: token.claimed, // Whether token has been claimed
          partiallySpent: token.partiallySpent, // Whether token has been partially spent
          isAutoclaim, // Flag for self-claimed tokens
          txData: {
            // For self-claim, show positive amount (got funds back)
            // Amount stays as integer (smallest units)
            amount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            assetType: 'UNIT', // Set to UNIT for consistency
            numericAmount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            isSent: isSentToken && !isAutoclaim,
            isReceived: !isSentToken || isAutoclaim,
            isAutoclaim,
          },
        } as ProcessedTransaction;
      });

    // Merge and sort by timestamp (most recent first)
    const merged: ProcessedTransaction[] = [...regularTxs, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return bTime - aTime;
    });

    return merged;
  }, [transactionHistory, ecashTokens, segwitAddress, taprootAddress, currentPubkeyHex]);

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
