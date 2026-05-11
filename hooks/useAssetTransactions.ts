/**
 * useAssetTransactions Hook
 * Filters and processes transactions for a specific asset type
 * Uses pre-loaded ecash tokens from WalletDataContext for instant display
 */

import * as bitcoin from 'bitcoinjs-lib';
import { useEffect,useMemo,useRef } from 'react';
import { useEcashTokens } from '../contexts/WalletDataContext';
import { TokenWithStatus } from '../services/cashu/tokenStatusService';
import { calculateTransactionAmount,Transaction } from '../services/transactionHistoryService';
import { usePendingTxs } from '../stores/pendingTransactionsStore';
import { useVaultSettlementStore } from '../stores/vaultSettlementStore';
import type { DisplayAssetType } from '../types/assets';
import { logger } from '../utils/logger';
import {
findSelfClaimedTokenIds,
mergeAndSortTransactions,
processEcashTokens,
processPendingTransactions,
type PendingTx,
} from '../utils/transactionMerging';

interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
  isAutoclaim?: boolean;
  displayKind?: 'turbo_mint_claim';
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
  isPending?: boolean;
  [key: string]: unknown;
}

/** Type alias for EcashToken - uses TokenWithStatus from the service */
type EcashToken = TokenWithStatus;

const ecashTokenStateKey = (token: EcashToken): string => {
  const recipient = 'recipient' in token ? token.recipient ?? '' : '';
  const sender = 'sender' in token ? token.sender ?? '' : '';
  const shortUrl = 'shortUrl' in token ? token.shortUrl ?? '' : '';
  return [
    token.id,
    token.unit ?? 'unit',
    token.amount,
    token.timestamp,
    token.claimed ? 1 : 0,
    token.partiallySpent ? 1 : 0,
    recipient,
    sender,
    shortUrl,
  ].join(':');
};

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

  // Get pending transactions from store
  const pendingTransactions = usePendingTxs();
  const turboMintSendTxid = useVaultSettlementStore((state) =>
    state.requestedPayoutAsset === 'TURBOUNIT' ? state.cashuMintSendTxid : null
  );
  const turboMintClaimTxids = useMemo(
    () => new Set(turboMintSendTxid ? [turboMintSendTxid] : []),
    [turboMintSendTxid],
  );

  // Use pre-loaded ecash tokens from context (no more on-demand fetching)
  const { ecashTokens: preloadedEcashTokens, fetchEcashTokens } = useEcashTokens();

  // Include ecash tokens for UNIT and BTC asset views (Turbo UNIT / Turbo BTC transactions)
  // Stabilize reference — only update when token count, IDs, or status change
  const ecashTokensRef = useRef<typeof preloadedEcashTokens>([]);
  const ecashTokens = useMemo(() => {
    if (assetType !== 'UNIT' && assetType !== 'BTC') return [];
    const prevKey = ecashTokensRef.current.map(ecashTokenStateKey).join(',');
    const newKey = preloadedEcashTokens.map(ecashTokenStateKey).join(',');
    if (prevKey === newKey) {
      return ecashTokensRef.current;
    }
    ecashTokensRef.current = preloadedEcashTokens;
    return preloadedEcashTokens;
  }, [assetType, preloadedEcashTokens]);

  // Trigger background refresh when viewing Cashu-backed asset history
  useEffect(() => {
    if (assetType === 'UNIT' || assetType === 'BTC') {
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);

  const ecashTokenHash = useMemo(
    () => ecashTokens.map(ecashTokenStateKey).join(','),
    [ecashTokens],
  );

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
    if (assetType === 'USDC') {
      transactionsProcessedRef.current = true;
      filteredTxRef.current = [];
      return filteredTxRef.current;
    }

    if (!transactionHistory || !segwitAddress || !taprootAddress) {
      return filteredTxRef.current;
    }

    // Create a hash to check if we need to recalculate
    const pendingTxIds = Object.keys(pendingTransactions).join(',');
    const txHash = transactionHistory
      .map(t => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
      .join('|') + `-${assetType}-ecash:${ecashTokenHash}-pending:${pendingTxIds}-turboMint:${turboMintSendTxid || ''}`;

    const hashChanged = txHash !== lastTxHashRef.current;

    if (!hashChanged && filteredTxRef.current.length > 0) {
      return filteredTxRef.current;
    }

    // Process transactions in a single pass with caching
    const filtered: ProcessedTransaction[] = [];
    const cache = txDataCacheRef.current;

    for (const tx of transactionHistory) {
      // Include swap TXs in UNIT asset view (they deliver UNIT to wallet)
      if (tx.vaultTransaction && tx.vaultData?.action === 'Swap' && assetType === 'UNIT') {
        filtered.push(tx as ProcessedTransaction);
        continue;
      }
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

      const isTurboMintClaim = processedTxData.assetType === 'UNIT' && turboMintClaimTxids.has(tx.txid);
      const displayTxData: TxData = isTurboMintClaim
        ? {
          ...processedTxData,
          amount: Math.abs(processedTxData.numericAmount),
          numericAmount: Math.abs(processedTxData.numericAmount),
          isSent: false,
          isReceived: true,
          displayKind: 'turbo_mint_claim',
        }
        : processedTxData;

      if (displayTxData.assetType !== assetType) continue;
      if (!displayTxData.numericAmount || displayTxData.numericAmount === 0) continue;

      filtered.push({
        ...tx,
        txData: displayTxData,
      } as ProcessedTransaction);
    }

    // Use shared utilities for ecash and pending transaction processing
    const selfClaimedSentTokenIds = findSelfClaimedTokenIds(ecashTokens, currentPubkeyHex, taprootAddress);
    const ecashTxs = processEcashTokens(ecashTokens, selfClaimedSentTokenIds, taprootAddress)
      .filter((tx) => tx.txData?.assetType === assetType) as ProcessedTransaction[];

    const confirmedTxids = new Set(transactionHistory.map(tx => tx.txid));
    const pendingTxs = processPendingTransactions(
      pendingTransactions as unknown as Record<string, PendingTx>,
      assetType,
      confirmedTxids,
      { turboMintClaimTxids },
    ) as ProcessedTransaction[];

    const merged = mergeAndSortTransactions(pendingTxs, filtered, ecashTxs) as unknown as ProcessedTransaction[];

    lastTxHashRef.current = txHash;
    filteredTxRef.current = merged;
    transactionsProcessedRef.current = true;

    return merged;
  }, [transactionHistory, segwitAddress, taprootAddress, assetType, ecashTokens, ecashTokenHash, currentPubkeyHex, pendingTransactions, turboMintClaimTxids, turboMintSendTxid]);

  // Loading is true only on FIRST load — never flicker after data has been shown
  const isLoading = !transactionsProcessedRef.current && filteredTransactions.length === 0;

  return {
    transactions: filteredTransactions,
    isLoading,
  };
}
