/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Uses pre-loaded ecash tokens from WalletDataContext for instant display
 */

import { useEffect, useRef, useMemo } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import { calculateTransactionAmount, Transaction } from '../services/transactionHistoryService';
import { EcashTokenRecord } from '../services/cashu/cashuLockedTokensService';
import { TokenWithStatus } from '../services/cashu/tokenStatusService';
import { useEcashTokens } from '../contexts/WalletDataContext';
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
 * Uses pre-loaded ecash tokens from WalletDataContext
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
  // Track if transactions have been processed at least once
  const transactionsProcessedRef = useRef(false);
  // Cache for parsed transaction data - keyed by txid, persists across renders
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Use pre-loaded ecash tokens from context (no more on-demand fetching)
  const { ecashTokens: preloadedEcashTokens, loadingEcashTokens, fetchEcashTokens } = useEcashTokens();

  // Filter tokens: only use for UNIT and non-advanced mode
  const ecashTokens = (assetType === 'UNIT' && !advancedMode) ? preloadedEcashTokens : [];

  // Ecash is ready if: not UNIT, or advanced mode, or tokens have loaded
  const ecashReady = assetType !== 'UNIT' || advancedMode || !loadingEcashTokens || preloadedEcashTokens.length > 0;

  // Trigger background refresh when component mounts (data is already available)
  useEffect(() => {
    if (assetType === 'UNIT' && !advancedMode) {
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType, advancedMode]);

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

  // Filter and process transactions using useMemo for instant updates
  const filteredTransactions = useMemo(() => {
    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      return filteredTxRef.current;
    }

    // Create a hash to check if we need to recalculate
    const txHash = transactionHistory
      .map(t => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
      .join('|') + `-${assetType}-ecash:${ecashTokens.length}`;

    const hashChanged = txHash !== lastTxHashRef.current;

    if (!hashChanged && filteredTxRef.current.length > 0) {
      return filteredTxRef.current;
    }

    // Process transactions in a single pass with caching
    const filtered: ProcessedTransaction[] = [];
    const cache = txDataCacheRef.current;

    for (const tx of transactionHistory) {
      if (tx.vaultTransaction) continue;

      const txWithData = tx as ProcessedTransaction;
      let processedTxData: TxData | undefined;

      if (txWithData.txData) {
        processedTxData = txWithData.txData;
      } else {
        processedTxData = cache.get(tx.txid);

        if (!processedTxData) {
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

      if (processedTxData.assetType !== assetType) continue;
      if (!processedTxData.numericAmount || processedTxData.numericAmount === 0) continue;

      filtered.push({
        ...tx,
        txData: processedTxData,
      } as ProcessedTransaction);
    }

    // First pass: identify self-claimed sent tokens
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
        if (isReceivedToken) {
          const receivedToken = token as { sender: string; taprootAddress: string | null };
          if (receivedToken.taprootAddress && taprootAddress && receivedToken.taprootAddress === taprootAddress) {
            return false;
          }
        }
        return true;
      })
      .map((token) => {
        const amount = token.amount;
        const isSentToken = 'recipient' in token;
        const isAutoclaim = selfClaimedSentTokenIds.has(token.id);

        return {
          txid: token.id,
          timestamp: token.timestamp,
          ecashToken: true,
          tokenData: token,
          claimed: token.claimed,
          isAutoclaim,
          txData: {
            amount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            assetType: 'UNIT',
            numericAmount: isAutoclaim ? amount : (isSentToken ? -amount : amount),
            isSent: isSentToken && !isAutoclaim,
            isReceived: !isSentToken || isAutoclaim,
            isAutoclaim,
          },
        } as ProcessedTransaction;
      });

    // Merge and sort by timestamp (most recent first)
    const merged: ProcessedTransaction[] = [...filtered, ...ecashTxs].sort((a, b) => {
      const aTime = a.timestamp || a.status?.block_time || 0;
      const bTime = b.timestamp || b.status?.block_time || 0;
      return bTime - aTime;
    });

    lastTxHashRef.current = txHash;
    filteredTxRef.current = merged;
    transactionsProcessedRef.current = true;

    return merged;
  }, [transactionHistory, segwitAddress, taprootAddress, assetType, ecashTokens, currentPubkeyHex]);

  // Loading is true only when we have no data yet
  const isLoading = !ecashReady || (transactionHistory !== null && filteredTransactions.length === 0 && !transactionsProcessedRef.current);

  return {
    transactions: filteredTransactions,
    isLoading,
  };
}
