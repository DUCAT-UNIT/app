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
      logger.info('[useAccountSwitcher] Starting account switch', { accountIndex });

      // STEP 1: Reset ALL data immediately (synchronous - shows loading state instantly)
      logger.debug('[useAccountSwitcher] Resetting all data...');
      if (resetBalances) resetBalances();
      if (resetTransactionHistory) resetTransactionHistory();
      if (resetVaultData) resetVaultData();

      // STEP 2: Force React to render the loading state before continuing
      // This breaks React's automatic batching so users see loading state immediately
      await new Promise(resolve => setTimeout(resolve, 0));

      // STEP 3: Switch account context (updates wallet addresses)
      logger.debug('[useAccountSwitcher] Switching account context...');
      const newAddresses = await switchAccountContext(accountIndex);
      const newTaprootAddress = newAddresses?.taprootAddress;
      logger.debug('[useAccountSwitcher] New taproot address:', newTaprootAddress?.substring(0, 20) + '...');

      // STEP 4: Close modal and trigger callback immediately (don't wait for data)
      setShowAccountPicker(false);
      setNewAccountIndex('');
      setSwitchingAccount(false);

      if (onAccountSwitched) {
        onAccountSwitched(accountIndex);
      }

      // STEP 5: Fetch fresh data in background (fire and forget)
      // Data will populate as it loads - UI already shows loading state
      logger.debug('[useAccountSwitcher] Fetching fresh data in background...');
      if (fetchBalance) fetchBalance();
      if (fetchVault) fetchVault();
      if (fetchTransactionHistory) fetchTransactionHistory();
      // CRITICAL: Pass the new taproot address to ensure cashu reads from correct storage
      if (resetAndRefreshCashu) resetAndRefreshCashu(newTaprootAddress);

      logger.info('[useAccountSwitcher] Account switch complete');
    } catch (error) {
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
