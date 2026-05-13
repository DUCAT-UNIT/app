/**
 * useAccountSwitcher Hook
 * Manages account switching functionality with coordinated data refresh
 */

import { useState, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { ERRORS, DIALOGS } from '../utils/messages';
import { logger } from '../utils/logger';
import type { WalletAddresses } from '../contexts/WalletContext';

interface UseAccountSwitcherParams {
  switchAccountContext: (accountIndex: number) => Promise<WalletAddresses>;
  resetBalances?: () => void;
  fetchBalance?: (segwitAddr?: string, taprootAddr?: string) => void | Promise<void>;
  resetTransactionHistory?: () => void;
  fetchTransactionHistory?: (walletAddresses?: WalletAddresses) => void | Promise<void>;
  resetVaultData?: () => void;
  fetchVault?: (vaultPubkey?: string) => void | Promise<void>;
  fetchVaultTransactions?: (vaultPubkey?: string) => void | Promise<void>;
  resetEcashTokens?: () => void;
  fetchEcashTokens?: (taprootAddress?: string) => void | Promise<void>;
  resetAndRefreshCashu?: (newTaprootAddress?: string) => void | Promise<void>;
  resetEvmAssets?: () => void;
  refreshEvmBalances?: (accountIndex?: number) => void | Promise<void>;
  refreshUsdcHistory?: (accountIndex?: number) => void | Promise<void>;
  refreshEthHistory?: (accountIndex?: number) => void | Promise<void>;
  onAccountSwitched?: (accountIndex: number) => void;
  showToast?: (message: string, type: 'success' | 'error') => void;
}

interface UseAccountSwitcherReturn {
  showAccountPicker: boolean;
  setShowAccountPicker: Dispatch<SetStateAction<boolean>>;
  newAccountIndex: string;
  setNewAccountIndex: Dispatch<SetStateAction<string>>;
  switchingAccount: boolean;
  switchAccount: (accountNum: number) => Promise<void>;
}

export function useAccountSwitcher({
  switchAccountContext,
  resetBalances,
  fetchBalance,
  resetTransactionHistory,
  fetchTransactionHistory,
  resetVaultData,
  fetchVault,
  fetchVaultTransactions,
  resetEcashTokens,
  fetchEcashTokens,
  resetAndRefreshCashu,
  resetEvmAssets,
  refreshEvmBalances,
  refreshUsdcHistory,
  refreshEthHistory,
  onAccountSwitched,
  showToast,
}: UseAccountSwitcherParams): UseAccountSwitcherReturn {
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [newAccountIndex, setNewAccountIndex] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const switchAccount = async (accountNum: number): Promise<void> => {
    // Convert account number to index (Account 1 = index 0)
    const accountIndex = accountNum - 1;

    try {
      setSwitchingAccount(true);

      // STEP 1: Switch account context FIRST (updates wallet addresses)
      // This is fast now with multi-account cache (~5ms vs ~200ms)
      const newAddresses = await switchAccountContext(accountIndex);
      const newSegwitAddress = newAddresses?.segwitAddress;
      const newTaprootAddress = newAddresses?.taprootAddress;
      const newVaultPubkey = newAddresses?.taprootPubkey;

      // STEP 2: Dismiss modal but keep loading overlay visible
      setShowAccountPicker(false);
      setNewAccountIndex('');

      if (onAccountSwitched) {
        onAccountSwitched(accountIndex);
      }

      // STEP 3: Reset data (prevents stale data flash)
      if (resetBalances) resetBalances();
      if (resetTransactionHistory) resetTransactionHistory();
      if (resetVaultData) resetVaultData();
      if (resetEcashTokens) resetEcashTokens();
      if (resetEvmAssets) resetEvmAssets();

      // STEP 4: Fetch balance and vault data in parallel, wait for both
      // Pass addresses explicitly to avoid stale closure issue
      // Keep switchingAccount=true until critical data is loaded
      const fetchPromises: Promise<void>[] = [];

      if (fetchBalance && newSegwitAddress && newTaprootAddress) {
        fetchPromises.push(
          Promise.resolve(fetchBalance(newSegwitAddress, newTaprootAddress)).catch((err: unknown) => {
            logger.warn('[useAccountSwitcher] fetchBalance failed', { error: err instanceof Error ? err.message : String(err) });
          })
        );
      }

      if (fetchVault && newVaultPubkey) {
        fetchPromises.push(
          Promise.resolve(fetchVault(newVaultPubkey)).catch((err: unknown) => {
            logger.warn('[useAccountSwitcher] fetchVault failed', { error: err instanceof Error ? err.message : String(err) });
          })
        );
      }

      if (resetAndRefreshCashu && newTaprootAddress) {
        fetchPromises.push(Promise.resolve(resetAndRefreshCashu(newTaprootAddress)));
      }

      if (refreshEvmBalances) {
        fetchPromises.push(
          Promise.resolve(refreshEvmBalances(accountIndex)).catch((err: unknown) => {
            logger.warn('[useAccountSwitcher] refreshEvmBalances failed', { error: err instanceof Error ? err.message : String(err) });
          })
        );
      }

      // Wait for critical account-scoped state to load before the new account is interactive.
      await Promise.all(fetchPromises);

      // STEP 5: Now hide the loading overlay - critical data is loaded
      setSwitchingAccount(false);

      // STEP 6: Show success toast after data is loaded and overlay is hidden
      if (showToast) {
        showToast(`Switched to Account ${accountIndex + 1}`, 'success');
      }

      // STEP 7: Fetch remaining data in background (non-blocking)
      if (fetchTransactionHistory) {
        Promise.resolve(fetchTransactionHistory(newAddresses)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchTransactionHistory failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }
      if (fetchVaultTransactions && newVaultPubkey) {
        Promise.resolve(fetchVaultTransactions(newVaultPubkey)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchVaultTransactions failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }
      if (fetchEcashTokens && newTaprootAddress) {
        Promise.resolve(fetchEcashTokens(newTaprootAddress)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchEcashTokens failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }
      if (refreshUsdcHistory) {
        Promise.resolve(refreshUsdcHistory(accountIndex)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] refreshUsdcHistory failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }
      if (refreshEthHistory) {
        Promise.resolve(refreshEthHistory(accountIndex)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] refreshEthHistory failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }
    } catch (error: unknown) {
      logger.error('[useAccountSwitcher] Account switch failed', { error: error instanceof Error ? error.message : String(error) });
      Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.ACCOUNT_SWITCH_FAILED);
      setSwitchingAccount(false);
    }
  };

  return {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  };
}
