/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 * Uses pre-loaded ecash tokens from WalletDataContext for instant display
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import * as bitcoin from 'bitcoinjs-lib';
import { useTransactionHistory, useEcashTokens } from '../contexts/WalletDataContext';
import { usePendingTxs } from '../stores/pendingTransactionsStore';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import { useSettingsHandlers } from '../contexts/NavigationHandlersContext';
import { TokenWithStatus } from '../services/cashu/tokenStatusService';
import { logger } from '../utils/logger';
import {
  processPendingTransactions,
  findSelfClaimedTokenIds,
  processEcashTokens,
  mergeAndSortTransactions,
  type PendingTx,
} from '../utils/transactionMerging';

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
  const { settingsHandlers } = useSettingsHandlers();
  const advancedMode = settingsHandlers.advancedMode;

  // Get pending transactions from store
  const pendingTransactions = usePendingTxs();

  // Use pre-loaded ecash tokens from context (no more on-demand fetching)
  const { ecashTokens: preloadedEcashTokens, loadingEcashTokens, fetchEcashTokens } = useEcashTokens();

  // Filter tokens by advanced mode - show ecash tokens only in advanced mode
  const ecashTokens = advancedMode ? preloadedEcashTokens : [];

  // Cache for parsed transaction data - keyed by txid, persists across renders
  // This prevents recalculating amounts when just confirmation status changes
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Refresh data when sheet opens (background refresh, data is already available)
  useEffect(() => {
    if (!showHistorySheet) return;

    // Trigger background refresh to ensure data is fresh
    fetchTransactionHistory();
    if (advancedMode) {
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorySheet]);

  // Loading is only true when both transaction history AND ecash tokens are loading
  // and we have no data to show yet
  const loading = (loadingTransactionHistory && transactionHistory.length === 0) ||
    (advancedMode && loadingEcashTokens && ecashTokens.length === 0);

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

    // Use shared utilities for ecash and pending transaction processing
    const selfClaimedSentTokenIds = findSelfClaimedTokenIds(ecashTokens, currentPubkeyHex);
    const ecashTxs = processEcashTokens(ecashTokens, selfClaimedSentTokenIds, taprootAddress) as ProcessedTransaction[];

    const confirmedTxids = new Set(transactionHistory.map(tx => tx.txid));
    const pendingTxs = processPendingTransactions(
      pendingTransactions as unknown as Record<string, PendingTx>,
      undefined,
      confirmedTxids
    ) as ProcessedTransaction[];

    return mergeAndSortTransactions(pendingTxs, regularTxs, ecashTxs) as unknown as ProcessedTransaction[];
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
