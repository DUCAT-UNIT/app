/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useEffect, useRef } from 'react';
import { calculateTransactionAmount } from '../services/transactionHistoryService';

/**
 * Hook to filter and process transactions by asset type
 */
export function useAssetTransactions(transactionHistory, assetType, segwitAddress, taprootAddress) {
  // Stable ref for filtered transactions
  const filteredTxRef = useRef([]);
  const lastTxHashRef = useRef('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);

  // Filter and process transactions - deferred to avoid blocking navigation
  useEffect(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      setFilteredTransactions(filteredTxRef.current);
      return;
    }

    // Create a hash to check if we need to recalculate
    // Include confirmation status AND block height to detect when transactions confirm
    const txHash = transactionHistory
      .map(t => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
      .join('|') + `-${assetType}`;

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

    lastTxHashRef.current = txHash;
    filteredTxRef.current = filtered;
    setFilteredTransactions(filtered);
  }, [transactionHistory, segwitAddress, taprootAddress, assetType]);

  return filteredTransactions;
}
