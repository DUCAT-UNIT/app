/**
 * useAccountSwitcher Hook
 * Manages account switching functionality
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { ERRORS, DIALOGS } from '../utils/messages';

export function useAccountSwitcher({ switchAccountContext }) {
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [newAccountIndex, setNewAccountIndex] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const switchAccount = async (accountNum) => {
    // Convert account number to index (Account 1 = index 0)
    const accountIndex = accountNum - 1;

    try {
      setSwitchingAccount(true);

      // Switch account using context
      await switchAccountContext(accountIndex);

      setShowAccountPicker(false);
      setNewAccountIndex('');
    } catch (error) {
      console.error('Switch account error:', error);
      Alert.alert(DIALOGS.ERROR_TITLE, ERRORS.ACCOUNT_SWITCH_FAILED);
    } finally {
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
