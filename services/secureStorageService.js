/**
 * Secure Storage Service
 * Handles mnemonic and wallet data storage in secure storage
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory overwriting, but we try our best
 * @param {string} str - String to clear
 * @returns {string} Cleared string (filled with zeros)
 */
const securelyWipeString = (str) => {
  if (!str || typeof str !== 'string') return '';

  // Create a new string filled with zeros
  let cleared = '';
  for (let i = 0; i < str.length; i++) {
    cleared += '\0';
  }

  // Overwrite multiple times
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < str.length; i++) {
      cleared =
        cleared.substring(0, i) +
        String.fromCharCode(Math.floor(Math.random() * 256)) +
        cleared.substring(i + 1);
    }
  }

  return cleared;
};

/**
 * Save mnemonic to secure storage
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @returns {Promise<boolean>} Success status
 */
export const saveMnemonic = async (mnemonic) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Retrieve mnemonic from secure storage
 * IMPORTANT: Caller must clear the returned mnemonic from memory after use
 * @returns {Promise<string|null>} Mnemonic or null if not found
 */
export const getMnemonic = async () => {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  } catch (error) {
    return null;
  }
};

/**
 * Retrieve mnemonic and automatically clear it after callback execution
 * Use this when you need temporary access to mnemonic
 * @param {Function} callback - Function that receives mnemonic
 * @returns {Promise<any>} Result from callback
 */
export const withMnemonic = async (callback) => {
  let mnemonic = null;
  try {
    mnemonic = await getMnemonic();
    if (!mnemonic) {
      throw new Error('Mnemonic not found');
    }
    return await callback(mnemonic);
  } finally {
    // Best effort to clear from memory
    if (mnemonic) {
      mnemonic = securelyWipeString(mnemonic);
      mnemonic = null;
    }
  }
};

/**
 * Delete mnemonic from secure storage
 * @returns {Promise<boolean>} Success status
 */
export const deleteMnemonic = async () => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Save current account index to secure storage
 * @param {number} accountIndex - Account index
 * @returns {Promise<boolean>} Success status
 */
export const saveCurrentAccount = async (accountIndex) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Retrieve current account index from secure storage
 * @returns {Promise<number>} Account index (defaults to 0)
 */
export const getCurrentAccount = async () => {
  try {
    const account = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    return account ? parseInt(account, 10) : 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Delete all wallet data from secure storage
 * IMPORTANT: This clears ALL wallet data including PIN, passkey, and lockout state
 * NOTE: iCloud backup is preserved by default to allow wallet recovery
 * @param {boolean} clearICloudBackup - Whether to also clear iCloud passkey backup (default: false)
 * @returns {Promise<boolean>} Success status
 */
export const deleteWalletData = async (clearICloudBackup = false) => {
  try {
    // Clear passkey data if it exists (iCloud backup preserved by default for recovery)
    try {
      const { clearPasskeyData } = await import('./passkey');
      await clearPasskeyData(clearICloudBackup);
    } catch (passkeyError) {
      // Passkey service might not be available or error clearing - continue anyway
      logger.warn('Failed to clear passkey data', { error: passkeyError.message });
    }

    // Clear all wallet-related secure storage keys
    await Promise.all([
      // Wallet data
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT),

      // PIN and authentication
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_VERSION),
      SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),

      // PIN lockout state (from pinService.js LOCKOUT_KEYS)
      SecureStore.deleteItemAsync('pin_failed_attempts'),
      SecureStore.deleteItemAsync('pin_lockout_until'),

      // Pending operations (from useWalletActions.js, usePostAuthHandler.js)
      SecureStore.deleteItemAsync('pendingWalletDelete'),
      SecureStore.deleteItemAsync('pendingFaceIdEnable'),
      SecureStore.deleteItemAsync('pendingNotificationsEnable'),

      // Settings navigation state (from useSettingsNavigation.js)
      SecureStore.deleteItemAsync('returnToSettingsAfterAuth'),
      SecureStore.deleteItemAsync('returnToSettingsAfterPinChange'),
      SecureStore.deleteItemAsync('returnToSettingsAfterSeedPhrase'),

      // User preferences (optional - you might want to keep these)
      SecureStore.deleteItemAsync('notificationsEnabled'),
      SecureStore.deleteItemAsync('showZeroAssets'),

      // Passkey-related keys (belt and suspenders - clearPasskeyData should handle these)
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_ENABLED),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_ID),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_USER_HANDLE),
      SecureStore.deleteItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
    ]);

    return true;
  } catch (error) {
    logger.error('Error deleting wallet data', { error: error.message });
    return false;
  }
};
