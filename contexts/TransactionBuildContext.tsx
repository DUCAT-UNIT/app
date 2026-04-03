/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React,{ createContext,ReactNode,useContext,useEffect,useMemo,useRef,useState } from 'react';
import type { SendIntent } from '../hooks/useTransactionBuilder';
import { useTransactionBuilder } from '../hooks/useTransactionBuilder';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { useSendFlow } from '../stores/sendFlowStore';
import type { TransactionIntent } from '../utils/pendingTransactionsUtils';
import type { WalletAddresses } from './WalletContext';
import { useBalance } from './WalletDataContext';

// Re-export SendIntent from the hook for consumers
export type { SendIntent } from '../hooks/useTransactionBuilder';

interface TransactionBuildContextValue {
  sendIntent: SendIntent | null;
  setSendIntent: React.Dispatch<React.SetStateAction<SendIntent | null>>;
  createSendIntent: () => Promise<void>;
  cancelIntent: () => void;
}

const TransactionBuildContext = createContext<TransactionBuildContextValue | undefined>(undefined);

export const useTransactionBuild = (): TransactionBuildContextValue => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

interface TransactionBuildProviderProps {
  children: ReactNode;
  wallet: WalletAddresses | null;
  currentAccount: number;
}

export const TransactionBuildProvider: React.FC<TransactionBuildProviderProps> = ({
  children,
  wallet,
  currentAccount,
}) => {
  const {
    sendRecipient,
    sendAmount,
    sendAssetType,
    requireConfirmedUtxos,
    setIntentStep,
    setSendRecipient,
  } = useSendFlow();

  const {
    getUnconfirmedUTXOs,
    getSpentUtxos,
    unmarkUtxosAsSpent,
    markUtxosAsSpent,
  } = usePendingTransactionsStore();

  const { runesBalance } = useBalance();

  // The created PSBT intent
  const [sendIntent, setSendIntent] = useState<SendIntent | null>(null);

  // Transaction building logic
  const { createSendIntent, cancelIntent } = useTransactionBuilder({
    wallet,
    currentAccount,
    sendRecipient,
    sendAmount,
    sendAssetType,
    requireConfirmedUtxos,
    runesBalance: runesBalance,
    sendIntent,
    setSendIntent,
    setIntentStep,
    getUnconfirmedUTXOs: (addressType, excludeFromIntent) =>
      getUnconfirmedUTXOs(addressType, excludeFromIntent as TransactionIntent | null),
    getSpentUtxos,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
    setSendRecipient,
  });

  // Keep ref to latest cancelIntent for unmount cleanup
  const cancelIntentRef = useRef(cancelIntent);
  useEffect(() => {
    cancelIntentRef.current = cancelIntent;
  }, [cancelIntent]);

  // Release locked UTXOs on unmount to prevent orphaned locks
  useEffect(() => {
    return () => {
      cancelIntentRef.current().catch(() => undefined);
    };
  }, []);

  const value = useMemo(
    () => ({
      sendIntent,
      setSendIntent,
      createSendIntent,
      cancelIntent,
    }),
    [sendIntent, createSendIntent, cancelIntent]
  );

  return (
    <TransactionBuildContext.Provider value={value}>{children}</TransactionBuildContext.Provider>
  );
};
