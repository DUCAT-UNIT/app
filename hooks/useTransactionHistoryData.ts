/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 * Uses pre-loaded ecash tokens from WalletDataContext for instant display
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import * as bitcoin from 'bitcoinjs-lib';
import { useTransactionHistory, useEcashTokens } from '../contexts/WalletDataContext';
import { usePendingTxs } from '../contexts/PendingTransactionsContext';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { TokenWithStatus } from '../services/cashu/tokenStatusService';
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
  isPending?: boolean;
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

  // Get pending transactions from store
  const pendingTransactions = usePendingTxs();

  // Use pre-loaded ecash tokens from context (no more on-demand fetching)
  const { ecashTokens: preloadedEcashTokens, loadingEcashTokens, fetchEcashTokens } = useEcashTokens();

  // Filter tokens by advanced mode
  const ecashTokens = advancedMode ? [] : preloadedEcashTokens;

  // Cache for parsed transaction data - keyed by txid, persists across renders
  // This prevents recalculating amounts when just confirmation status changes
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Refresh data when sheet opens (background refresh, data is already available)
  useEffect(() => {
    if (!showHistorySheet) return;

    // Trigger background refresh to ensure data is fresh
    fetchTransactionHistory();
    if (!advancedMode) {
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorySheet]);

  // Loading is only true when both transaction history AND ecash tokens are loading
  // and we have no data to show yet
  const loading = (loadingTransactionHistory && transactionHistory.length === 0) ||
    (!advancedMode && loadingEcashTokens && ecashTokens.length === 0);

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

    // Convert pending transactions to ProcessedTransaction format
    const pendingTxs: ProcessedTransaction[] = Object.values(pendingTransactions)
      .filter(tx => {
        // Only include pending (not invalid) transactions
        if (tx.status !== 'pending') return false;
        // Exclude if already confirmed in transactionHistory
        return !transactionHistory.some(histTx => histTx.txid === tx.txid);
      })
      .map(tx => {
        // Use sentAmount if available, otherwise fall back to calculating from outputs
        let amount: number;
        if (tx.sentAmount !== undefined && tx.sentAmount > 0) {
          // Sent transactions show as negative
          amount = -tx.sentAmount;
        } else {
          // Fallback: calculate from outputs (change amounts)
          const totalValue = tx.outputs.reduce((sum, output) => sum + (output.value || 0), 0);
          const totalRuneAmount = tx.outputs.reduce((sum, output) => sum + (output.runeAmount || 0), 0);
          amount = tx.assetType === 'UNIT' ? -totalRuneAmount : -totalValue;
        }

        return {
          txid: tx.txid,
          timestamp: tx.timestamp / 1000, // Convert to seconds
          status: {
            confirmed: false,
            block_time: Math.floor(tx.timestamp / 1000),
          },
          isPending: true,
          txData: {
            amount,
            assetType: tx.assetType,
            numericAmount: amount,
            isSent: true,
            isReceived: false,
          },
        } as ProcessedTransaction;
      });

    // Helper to normalize timestamps to seconds for comparison
    const getTimeInSeconds = (tx: ProcessedTransaction): number => {
      if (tx.ecashToken && tx.timestamp) {
        // Ecash timestamps are in milliseconds
        return tx.timestamp / 1000;
      }
      // On-chain and pending transactions use seconds
      return tx.timestamp || tx.status?.block_time || 0;
    };

    // Merge and sort all transactions
    // - Pending transactions go at the top, sorted by timestamp (most recent first)
    // - Then confirmed/ecash transactions sorted by timestamp (most recent first)
    const merged: ProcessedTransaction[] = [...pendingTxs, ...regularTxs, ...ecashTxs].sort((a, b) => {
      const aIsPending = a.isPending;
      const bIsPending = b.isPending;

      // If both are pending or both are not pending, sort by timestamp
      if (aIsPending === bIsPending) {
        const aTime = getTimeInSeconds(a);
        const bTime = getTimeInSeconds(b);
        return bTime - aTime; // Most recent first
      }

      // Pending transactions always at top
      return aIsPending ? -1 : 1;
    });

    return merged;
  }, [transactionHistory, ecashTokens, segwitAddress, taprootAddress, currentPubkeyHex, pendingTransactions]);

  // Open transaction in blockchain explorer
  const openTxInExplorer = useCallback(async (txid: string, assetType: string): Promise<void> => {
    try {
      // Use ord explorer for UNIT transactions, regular explorer for BTC
      const url = assetType === 'UNIT' ? getOrdTxUrl(txid) : getTxUrl(txid);

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error: unknown) {
      logger.warn('[useTransactionHistoryData] Failed to open tx in explorer', { error: error instanceof Error ? error.message : String(error), txid });
    }
  }, []);

  return {
    loading,
    displayTransactions,
    openTxInExplorer,
  };
}
