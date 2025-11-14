/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Linking } from 'react-native';
import { useTransactionHistory } from '../contexts/WalletDataContext';
import { calculateTransactionAmount } from '../services/transactionHistoryService';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';

export function useTransactionHistoryData(
  showHistorySheet,
  segwitAddress,
  taprootAddress
) {
  const { transactionHistory, loadingTransactionHistory, fetchTransactionHistory } =
    useTransactionHistory();

  const [loading, setLoading] = useState(false);

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

  // Update loading state when context loading changes
  useEffect(() => {
    // Only show loading if we have no cached data
    if (transactionHistory.length === 0) {
      setLoading(loadingTransactionHistory);
    } else {
      setLoading(false);
    }
  }, [loadingTransactionHistory, transactionHistory]);

  // Filter out self-transfers and prepare display data
  const displayTransactions = useMemo(() => {
    return transactionHistory
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
  }, [transactionHistory, segwitAddress, taprootAddress]);

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
