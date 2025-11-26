/**
 * useAccountSwitcher Hook
 * Manages account switching functionality with coordinated data refresh
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { ERRORS, DIALOGS } from '../utils/messages';
import { logger } from '../utils/logger';

export function useAccountSwitcher({
  switchAccountContext,
  // Balance functions
  resetBalances,
  fetchBalance,
  // Transaction history functions
  resetTransactionHistory,
  fetchTransactionHistory,
  // Vault functions
  resetVaultData,
  fetchVault,
  // Cashu functions (resetAndRefresh clears pending mints and fetches balance)
  resetAndRefreshCashu,
  // Callback
  onAccountSwitched,
}) {
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [newAccountIndex, setNewAccountIndex] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const switchAccount = async (accountNum) => {
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
      logger.error('[useAccountSwitcher] Account switch failed', { error: error.message });
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
