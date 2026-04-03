/**
 * AppProvidersWrapper - Provider composition for AppNavigator
 * Wraps the app content with all necessary context providers
 */

import React,{ MutableRefObject } from 'react';

// Contexts
import { useOnboardingFlow } from '../contexts/AuthContext';
// SendFlowProvider removed - using Zustand store directly
import { AirdropProvider } from '../contexts/AirdropContext';
import { NavigationHandlersProvider } from '../contexts/NavigationHandlersContext';
import { SeedPhraseProvider } from '../contexts/SeedPhraseContext';
import { TransactionBuildProvider } from '../contexts/TransactionBuildContext';
import { TransactionExecutionProvider } from '../contexts/TransactionExecutionContext';
import type { WalletAddresses } from '../contexts/WalletContext';
import { useNotifications } from '../stores/notificationStore';

// Local components
import AppNavigatorContent from './AppNavigatorContent';

// Types
import type { DisplayAssetType } from '../types/assets';

/** Transaction type for notifications */
type TransactionType = 'deposit' | 'withdraw';

export interface AppProvidersWrapperProps {
  wallet: WalletAddresses | null;
  currentAccount: number;
  notificationsEnabled: boolean;
  startPolling: (txid: string, onConfirmed: (confirmed: boolean) => void, onError?: (error: Error) => void) => void;
  sendTransactionConfirmedNotification: (assetType: DisplayAssetType, amount: string, txid: string, type?: TransactionType) => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchTransactionHistory: () => void;
  setIsAuthenticated: (value: boolean) => void;
  loadWallet: () => Promise<{ exists: boolean; addresses?: WalletAddresses }>;
  loadBiometricPreference: () => Promise<void>;
  isBiometricSupported: boolean;
  walletExists: MutableRefObject<boolean>;
}

/** Adapter to convert hook notification signature to context expectation */
function createNotificationAdapter(
  hookFn: (assetType: DisplayAssetType, amount: string, txid: string, type?: TransactionType) => Promise<void>
): (assetType: string, amount: number, txid: string, action: string) => void {
  return (assetType: string, amount: number, txid: string, action: string) => {
    hookFn(assetType as DisplayAssetType, String(amount), txid, action as TransactionType);
  };
}

/**
 * Wrapper component that sets up all context providers for the app
 * Provides transaction, vault, seed phrase, and navigation contexts
 */
export default function AppProvidersWrapper({
  wallet,
  currentAccount,
  notificationsEnabled,
  startPolling,
  sendTransactionConfirmedNotification,
  fetchBalance,
  fetchTransactionHistory,
  setIsAuthenticated,
  loadWallet,
  loadBiometricPreference,
  walletExists,
}: AppProvidersWrapperProps): React.JSX.Element {
  const { seedConfirmed } = useOnboardingFlow();
  const { showSnackbar } = useNotifications();

  return (
    <TransactionBuildProvider
      wallet={wallet}
      currentAccount={currentAccount}
    >
      <TransactionExecutionProvider
        currentAccount={currentAccount}
        showSnackbar={showSnackbar}
        startTransactionPolling={startPolling}
        sendTransactionConfirmedNotification={createNotificationAdapter(sendTransactionConfirmedNotification)}
        notificationsEnabled={notificationsEnabled}
        fetchBalance={fetchBalance}
        fetchTransactionHistory={fetchTransactionHistory as (() => Promise<void>) | undefined}
      >
        <SeedPhraseProvider setIsAuthenticated={setIsAuthenticated}>
          <NavigationHandlersProvider walletExists={walletExists}>
            <AirdropProvider seedConfirmed={seedConfirmed}>
              <AppNavigatorContent
                loadWallet={loadWallet}
                loadBiometricPreference={loadBiometricPreference}
              />
            </AirdropProvider>
          </NavigationHandlersProvider>
        </SeedPhraseProvider>
      </TransactionExecutionProvider>
    </TransactionBuildProvider>
  );
}
