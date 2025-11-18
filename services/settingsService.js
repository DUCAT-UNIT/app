/**
 * Settings Service
 * Unified service for managing app settings stored in SecureStore
 * Provides type-safe getters and setters for all app settings
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';

// Setting keys (centralized to avoid typos)
export const SettingKeys = {
  // Authentication settings
  BIOMETRIC_ENABLED: 'biometricEnabled',
  AUTO_LOCK_ENABLED: 'autoLockEnabled',
  AUTO_LOCK_TIMEOUT: 'autoLockTimeout',

  // App preferences
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  SHOW_ZERO_ASSETS: 'showZeroAssets',
  DISPLAY_CURRENCY: 'displayCurrency',
  PRICE_DISPLAY_MODE: 'priceDisplayMode',

  // Temporary/flow state
  PENDING_NOTIFICATIONS_ENABLE: 'pendingNotificationsEnable',
  RETURN_TO_SETTINGS_AFTER_AUTH: 'returnToSettingsAfterAuth',
  PENDING_BIOMETRIC_ENABLE: 'pendingBiometricEnable',

  // Wallet settings
  CURRENT_ACCOUNT: 'currentAccount',
  WALLET_CREATED_WITH_PASSKEY: 'walletCreatedWithPasskey',

  // Developer settings (if applicable)
  DEBUG_MODE: 'debugMode',
};

/**
 * Get a string setting
 * @param {string} key - Setting key
 * @param {string} defaultValue - Default value if not set
 * @returns {Promise<string>} Setting value
 */
export async function getString(key, defaultValue = '') {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    logger.error(`settingsService: Error getting string "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set a string setting
 * @param {string} key - Setting key
 * @param {string} value - Value to store
 * @returns {Promise<boolean>} True if successful
 */
export async function setString(key, value) {
  try {
    await SecureStore.setItemAsync(key, String(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting string "${key}":`, error);
    return false;
  }
}

/**
 * Get a boolean setting
 * @param {string} key - Setting key
 * @param {boolean} defaultValue - Default value if not set
 * @returns {Promise<boolean>} Setting value
 */
export async function getBoolean(key, defaultValue = false) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    return value === 'true';
  } catch (error) {
    logger.error(`settingsService: Error getting boolean "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set a boolean setting
 * @param {string} key - Setting key
 * @param {boolean} value - Value to store
 * @returns {Promise<boolean>} True if successful
 */
export async function setBoolean(key, value) {
  try {
    await SecureStore.setItemAsync(key, value ? 'true' : 'false');
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting boolean "${key}":`, error);
    return false;
  }
}

/**
 * Get a number setting
 * @param {string} key - Setting key
 * @param {number} defaultValue - Default value if not set
 * @returns {Promise<number>} Setting value
 */
export async function getNumber(key, defaultValue = 0) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch (error) {
    logger.error(`settingsService: Error getting number "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set a number setting
 * @param {string} key - Setting key
 * @param {number} value - Value to store
 * @returns {Promise<boolean>} True if successful
 */
export async function setNumber(key, value) {
  try {
    await SecureStore.setItemAsync(key, String(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting number "${key}":`, error);
    return false;
  }
}

/**
 * Get a JSON object setting
 * @param {string} key - Setting key
 * @param {Object} defaultValue - Default value if not set
 * @returns {Promise<Object>} Setting value
 */
export async function getObject(key, defaultValue = {}) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value);
  } catch (error) {
    logger.error(`settingsService: Error getting object "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set a JSON object setting
 * @param {string} key - Setting key
 * @param {Object} value - Value to store
 * @returns {Promise<boolean>} True if successful
 */
export async function setObject(key, value) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting object "${key}":`, error);
    return false;
  }
}

/**
 * Delete a setting
 * @param {string} key - Setting key to delete
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteSetting(key) {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    logger.error(`settingsService: Error deleting "${key}":`, error);
    return false;
  }
}

/**
 * Toggle a boolean setting
 * @param {string} key - Setting key
 * @returns {Promise<boolean>} New value after toggle
 */
export async function toggle(key) {
  const currentValue = await getBoolean(key);
  const newValue = !currentValue;
  await setBoolean(key, newValue);
  return newValue;
}

/**
 * Check if a setting exists
 * @param {string} key - Setting key
 * @returns {Promise<boolean>} True if setting exists
 */
export async function exists(key) {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value !== null;
  } catch (error) {
    logger.error(`settingsService: Error checking existence of "${key}":`, error);
    return false;
  }
}

/**
 * Get multiple settings at once
 * @param {Array<{key: string, type: 'string'|'boolean'|'number'|'object', defaultValue: any}>} settings
 * @returns {Promise<Object>} Object with keys mapped to values
 */
export async function getMultiple(settings) {
  const results = {};

  await Promise.all(
    settings.map(async ({ key, type, defaultValue }) => {
      switch (type) {
        case 'boolean':
          results[key] = await getBoolean(key, defaultValue);
          break;
        case 'number':
          results[key] = await getNumber(key, defaultValue);
          break;
        case 'object':
          results[key] = await getObject(key, defaultValue);
          break;
        case 'string':
        default:
          results[key] = await getString(key, defaultValue);
          break;
      }
    })
  );

  return results;
}

/**
 * Set multiple settings at once
 * @param {Object} settings - Object with key-value pairs to set
 * @returns {Promise<boolean>} True if all successful
 */
export async function setMultiple(settings) {
  try {
    const results = await Promise.all(
      Object.entries(settings).map(([key, value]) => {
        if (typeof value === 'boolean') {
          return setBoolean(key, value);
        }
        if (typeof value === 'number') {
          return setNumber(key, value);
        }
        if (typeof value === 'object') {
          return setObject(key, value);
        }
        return setString(key, value);
      })
    );
    return results.every(result => result === true);
  } catch (error) {
    logger.error('settingsService: Error setting multiple settings:', error);
    return false;
  }
}

// Re-export convenience methods from settingsHelpers for backward compatibility
export {
  getBiometricEnabled,
  setBiometricEnabled,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getShowZeroAssets,
  setShowZeroAssets,
  getAutoLockTimeout,
  setAutoLockTimeout,
  getCurrentAccount,
  setCurrentAccount,
} from './settingsHelpers';
