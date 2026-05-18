/**
 * TransactionExecutionContext - Handles transaction signing and broadcasting
 * Signs PSBTs, broadcasts to network, and monitors confirmation
 * Depends on TransactionBuildContext for the intent and SendFlowContext for metadata
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useSendFlow } from '../stores/sendFlowStore';
import { useTransactionBuild } from './TransactionBuildContext';
import type { SendIntent } from './TransactionBuildContext';
import { usePendingTransactionsStore, usePendingTxs } from '../stores/pendingTransactionsStore';
import { useWallet } from './WalletContext';
import { useTransactionSigning, useTransactionBroadcast } from '../hooks/transaction';
import type { SnackbarParams } from '../stores/notificationStore';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';

interface BroadcastOptions {
  skipAutoConfirm?: boolean;
}

interface SignOptions {
  skipAutoConfirm?: boolean;
}

interface TransactionExecutionContextValue {
  broadcastedTxid: string | null;
  toastDismissed: boolean;
  setBroadcastedTxid: React.Dispatch<React.SetStateAction<string | null>>;
  setToastDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  signIntent: (options?: SignOptions) => Promise<string | null>;
  broadcastIntent: (intent?: SendIntent | null, options?: BroadcastOptions) => Promise<void>;
}

const TransactionExecutionContext = createContext<TransactionExecutionContextValue | undefined>(undefined);

export const useTransactionExecution = (): TransactionExecutionContextValue => {
  const context = useContext(TransactionExecutionContext);
  if (!context) {
    throw new Error('useTransactionExecution must be used within a TransactionExecutionProvider');
  }
  return context;
};

interface TransactionExecutionProviderProps {
  children: ReactNode;
  currentAccount: number;
  showSnackbar: (params: SnackbarParams) => void;
  startTransactionPolling: (
    txid: string,
    onSuccess: (isConfirmed: boolean) => void,
    onError: (error: unknown) => void
  ) => void;
  sendTransactionConfirmedNotification: (
    assetType: string,
    amount: number,
    txid: string,
    action: string
  ) => void;
  notificationsEnabled: boolean;
  fetchBalance: () => Promise<void>;
  fetchTransactionHistory?: () => Promise<void>;
}

export const TransactionExecutionProvider: React.FC<TransactionExecutionProviderProps> = ({
  children,
  currentAccount,
  showSnackbar,
  startTransactionPolling,
  sendTransactionConfirmedNotification,
  notificationsEnabled,
  fetchBalance,
  fetchTransactionHistory,
}) => {
  const { setIntentStep, sendAssetType, sendAmount, turboEnabled, btcTurboEnabled } = useSendFlow();
  const { sendIntent, setSendIntent } = useTransactionBuild();
  const { wallet } = useWallet();
  const pendingTransactions = usePendingTxs();
  const {
    addPendingTransaction,
    confirmTransaction,
    invalidateTransaction,
    markUtxoAsSpent,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
  } = usePendingTransactionsStore();

  // Execution state
  const [broadcastedTxid, setBroadcastedTxid] = useState<string | null>(null);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Helper to determine snackbar action type
  const getSnackbarAction = useCallback(() => {
    if (sendAssetType === 'unit') {
      return turboEnabled ? 'swap' : 'unit_send';
    }
    return btcTurboEnabled ? 'btc_swap' : 'btc_send';
  }, [sendAssetType, turboEnabled, btcTurboEnabled]);

  // Reset toast dismissed state when confirmed
  useEffect(() => {
    if (broadcastedTxid) {
      setToastDismissed(false);
    }
  }, [broadcastedTxid]);

  // Transaction signing hook
  const { signTransaction } = useTransactionSigning({
    currentAccount,
    sendIntent,
    setSendIntent,
    setIntentStep,
    showSnackbar,
    getSnackbarAction,
  });

  // Transaction broadcast hook
  const { broadcast } = useTransactionBroadcast({
    wallet,
    pendingTransactions,
    getPendingTransactions: () =>
      usePendingTransactionsStore.getState?.()?.pendingTransactions ?? pendingTransactions,
    sendAssetType,
    sendAmount,
    setSendIntent,
    setIntentStep,
    setBroadcastedTxid,
    setToastDismissed,
    showSnackbar,
    getSnackbarAction,
    markUtxoAsSpent,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
    addPendingTransaction,
    confirmTransaction,
    invalidateTransaction,
    startTransactionPolling,
    sendTransactionConfirmedNotification,
    notificationsEnabled,
    fetchBalance,
    fetchTransactionHistory,
  });

  // Sign and broadcast the PSBT
  const signIntent = useCallback(
    async (options: SignOptions = {}): Promise<string | null> => {
      // Legacy fixture path: skip real signing/broadcasting for mock intents.
      if (isE2E() && sendIntent?.psbt === 'e2e-mock-psbt') {
        const fakeTxid = `e2e-send-${Date.now().toString(16)}`;
        logger.info('[signIntent] E2E fixture txid', { fakeTxid });
        setBroadcastedTxid(fakeTxid);
        setIntentStep('confirmed');
        return fakeTxid;
      }

      const result = await signTransaction();
      if (!result) return null;

      // Automatically broadcast after signing
      const broadcastTxid = await broadcast(result.signedIntent, options);
      return broadcastTxid;
    },
    [signTransaction, broadcast, sendIntent, setBroadcastedTxid, setIntentStep]
  );

  // Broadcast an already-signed intent
  const broadcastIntent = useCallback(
    async (intent: SendIntent | null = sendIntent, options: BroadcastOptions = {}) => {
      // If intent is null, the broadcast hook will show the error snackbar
      await broadcast(intent as SendIntent, options);
    },
    [sendIntent, broadcast]
  );

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      broadcastedTxid,
      toastDismissed,
      setBroadcastedTxid,
      setToastDismissed,
      signIntent,
      broadcastIntent,
    }),
    [broadcastedTxid, toastDismissed, signIntent, broadcastIntent]
  );

  return (
    <TransactionExecutionContext.Provider value={value}>
      {children}
    </TransactionExecutionContext.Provider>
  );
};
