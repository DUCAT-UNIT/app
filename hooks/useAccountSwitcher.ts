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
  fetchBalance?: () => void | Promise<void>;
  resetTransactionHistory?: () => void;
  fetchTransactionHistory?: () => void | Promise<void>;
  resetVaultData?: () => void;
  fetchVault?: () => void | Promise<void>;
  resetAndRefreshCashu?: (newTaprootAddress?: string) => void | Promise<void>;
  onAccountSwitched?: (accountIndex: number) => void;
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
  resetAndRefreshCashu,
  onAccountSwitched,
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
      // This is the only blocking operation - must complete before dismissing modal
      const newAddresses = await switchAccountContext(accountIndex);
      const newTaprootAddress = newAddresses?.taprootAddress;

      // STEP 2: Dismiss modal immediately - don't wait for data fetches
      // User sees wallet screen with loading indicators instead of blocked modal
      setShowAccountPicker(false);
      setNewAccountIndex('');
      setSwitchingAccount(false);

      if (onAccountSwitched) {
        onAccountSwitched(accountIndex);
      }

      // STEP 3: Reset data AFTER modal closes (prevents UI flash during modal)
      // These resets are fast and synchronous
      if (resetBalances) resetBalances();
      if (resetTransactionHistory) resetTransactionHistory();
      if (resetVaultData) resetVaultData();

      // STEP 4: Fetch ALL data in background (fire-and-forget)
      // Each component will show its own loading state
      if (fetchBalance) {
        Promise.resolve(fetchBalance()).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchBalance failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }

      if (fetchVault) {
        Promise.resolve(fetchVault()).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchVault failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }

      if (resetAndRefreshCashu) {
        Promise.resolve(resetAndRefreshCashu(newTaprootAddress)).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] resetAndRefreshCashu failed', { error: err instanceof Error ? err.message : String(err) });
        });
      }

      if (fetchTransactionHistory) {
        Promise.resolve(fetchTransactionHistory()).catch((err: unknown) => {
          logger.warn('[useAccountSwitcher] fetchTransactionHistory failed', { error: err instanceof Error ? err.message : String(err) });
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
