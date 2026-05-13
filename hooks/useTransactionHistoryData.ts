/**
 * useTransactionHistoryData Hook
 * Manages transaction history data, filtering, and loading state
 * Uses pre-loaded ecash tokens from WalletDataContext for instant display
 */

import * as bitcoin from 'bitcoinjs-lib';
import { useCallback,useEffect,useMemo,useRef } from 'react';
import { Linking } from 'react-native';
import { EVM_CONFIG } from '../constants/evm';
import { useSettingsHandlers } from '../contexts/NavigationHandlersContext';
import { useEcashTokens,useEvmAssets,useTransactionHistory } from '../contexts/WalletDataContext';
import { useWallet } from '../contexts/WalletContext';
import { TokenWithStatus } from '../services/cashu/tokenStatusService';
import { calculateTransactionAmount,Transaction } from '../services/transactionHistoryService';
import { useEvmTransactionCheckpointStore } from '../stores/evmTransactionCheckpointStore';
import { usePendingTxs } from '../stores/pendingTransactionsStore';
import { useVaultSettlementStore } from '../stores/vaultSettlementStore';
import { getOrdTxUrl,getTxUrl } from '../utils/constants';
import { mapEvmCheckpointToHistoryItem } from '../utils/evmCheckpointDisplay';
import { logger } from '../utils/logger';
import {
findSelfClaimedTokenIds,
mergeAndSortTransactions,
processEcashTokens,
processPendingTransactions,
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
  displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
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
  const {
    usdcHistory,
    ethHistory,
    loadingUsdcHistory,
    loadingEthHistory,
    refreshUsdcHistory,
    refreshEthHistory,
  } = useEvmAssets();
  const { settingsHandlers } = useSettingsHandlers();
  const advancedMode = settingsHandlers.advancedMode;
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const { currentAccount } = useWallet();
  const evmCheckpoints = useEvmTransactionCheckpointStore((state) => state.checkpoints);

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
  const { ecashTokens: preloadedEcashTokens, loadingEcashTokens, fetchEcashTokens } = useEcashTokens();

  // Filter tokens by advanced mode - show ecash tokens only in advanced mode
  const ecashTokens = useMemo(
    () => (advancedMode ? preloadedEcashTokens : []),
    [advancedMode, preloadedEcashTokens]
  );

  // Cache for parsed transaction data - keyed by txid, persists across renders
  // This prevents recalculating amounts when just confirmation status changes
  const txDataCacheRef = useRef<Map<string, TxData>>(new Map());

  // Refresh data when sheet opens (background refresh, data is already available)
  useEffect(() => {
    if (!showHistorySheet) return;

    // Trigger background refresh to ensure data is fresh
    fetchTransactionHistory();
    if (usdcFeaturesEnabled) {
      refreshUsdcHistory();
      refreshEthHistory();
    }
    if (advancedMode) {
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistorySheet]);

  const visibleUsdcHistory = usdcFeaturesEnabled ? usdcHistory : [];
  const visibleEthHistory = usdcFeaturesEnabled ? ethHistory : [];
  const hasAnyLoadedHistory = transactionHistory.length > 0
    || ecashTokens.length > 0
    || visibleUsdcHistory.length > 0
    || visibleEthHistory.length > 0;
  const loading = !hasAnyLoadedHistory && (
    loadingTransactionHistory
    || (usdcFeaturesEnabled && loadingUsdcHistory)
    || (usdcFeaturesEnabled && loadingEthHistory)
    || (advancedMode && loadingEcashTokens)
  );

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

      regularTxs.push({
        ...tx,
        txData: displayTxData,
      });
    }

    // Use shared utilities for ecash and pending transaction processing
    const selfClaimedSentTokenIds = findSelfClaimedTokenIds(ecashTokens, currentPubkeyHex, taprootAddress);
    const ecashTxs = processEcashTokens(ecashTokens, selfClaimedSentTokenIds, taprootAddress) as ProcessedTransaction[];

    const confirmedTxids = new Set(
      transactionHistory.filter(tx => tx.status?.confirmed).map(tx => tx.txid)
    );
    const pendingTxs = processPendingTransactions(
      pendingTransactions as unknown as Record<string, PendingTx>,
      undefined,
      confirmedTxids,
      { turboMintClaimTxids },
    ) as ProcessedTransaction[];
    const pendingTxids = new Set(pendingTxs.map(tx => tx.txid));
    const visibleRegularTxs = regularTxs.filter(
      tx => !(pendingTxids.has(tx.txid) && tx.status?.confirmed !== true)
    );

    const indexedEvmTxids = new Set([...visibleUsdcHistory, ...visibleEthHistory].map((tx) => tx.txid.toLowerCase()));
    const checkpointTxs = usdcFeaturesEnabled
      ? evmCheckpoints
        .filter((checkpoint) => checkpoint.accountIndex === currentAccount)
        .map((checkpoint) => mapEvmCheckpointToHistoryItem(checkpoint))
        .filter((tx): tx is NonNullable<ReturnType<typeof mapEvmCheckpointToHistoryItem>> => (
          tx !== null && !indexedEvmTxids.has(tx.txid.toLowerCase())
        ))
      : [];

    const evmTxs = [...visibleUsdcHistory, ...visibleEthHistory, ...checkpointTxs].map((tx) => ({
      ...tx,
      status: {
        confirmed: tx.status.confirmed,
        block_time: tx.status.block_time ?? 0,
        failed: tx.status.failed,
      },
      timestamp: tx.status.block_time,
      isPending: !tx.status.confirmed && !tx.status.failed,
      txData: {
        ...tx.txData,
        numericAmount: tx.txData.amount,
      },
    })) as ProcessedTransaction[];

    return mergeAndSortTransactions(pendingTxs, visibleRegularTxs, ecashTxs, evmTxs) as unknown as ProcessedTransaction[];
  }, [
    transactionHistory,
    ecashTokens,
    segwitAddress,
    taprootAddress,
    currentPubkeyHex,
    pendingTransactions,
    visibleUsdcHistory,
    visibleEthHistory,
    usdcFeaturesEnabled,
    evmCheckpoints,
    currentAccount,
    turboMintClaimTxids,
  ]);

  // Open transaction in blockchain explorer
  const openTxInExplorer = useCallback(async (txid: string, assetType: string): Promise<void> => {
    try {
      const url = assetType === 'UNIT'
        ? getOrdTxUrl(txid)
        : assetType === 'USDC' || assetType === 'ETH'
          ? `${EVM_CONFIG.explorerBaseUrl}/tx/${txid}`
          : getTxUrl(txid);

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
