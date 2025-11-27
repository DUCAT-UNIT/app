/**
 * AppProvidersWrapper - Provider composition for AppNavigator
 * Wraps the app content with all necessary context providers
 */

import React, { MutableRefObject } from 'react';

// Contexts
import { useOnboardingFlow } from '../contexts/AuthContext';
import { SendFlowProvider } from '../contexts/SendFlowContext';
import { TransactionBuildProvider } from '../contexts/TransactionBuildContext';
import { TransactionExecutionProvider } from '../contexts/TransactionExecutionContext';
import { VaultProvider } from '../contexts/VaultContext';
import { SeedPhraseProvider } from '../contexts/SeedPhraseContext';
import { AirdropProvider } from '../contexts/AirdropContext';
import { NavigationHandlersProvider } from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { WalletAddresses } from '../contexts/WalletContext';

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
  isBiometricSupported,
  walletExists,
}: AppProvidersWrapperProps): React.JSX.Element {
  const { seedConfirmed } = useOnboardingFlow();
  const { showToast, showSnackbar } = useNotifications();

  return (
    <AirdropProvider seedConfirmed={seedConfirmed}>
      <SendFlowProvider>
        <TransactionBuildProvider
          wallet={wallet}
          currentAccount={currentAccount}
          showToast={showToast as (message: string, type?: string) => void}
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
            <VaultProvider currentAccount={currentAccount}>
              <SeedPhraseProvider showToast={showToast as (message: string, type?: string) => void} setIsAuthenticated={setIsAuthenticated}>
                <NavigationHandlersProvider walletExists={walletExists}>
                  <AppNavigatorContent
                    loadWallet={loadWallet}
                    loadBiometricPreference={loadBiometricPreference}
                  />
                </NavigationHandlersProvider>
              </SeedPhraseProvider>
            </VaultProvider>
          </TransactionExecutionProvider>
        </TransactionBuildProvider>
      </SendFlowProvider>
    </AirdropProvider>
  );
}
