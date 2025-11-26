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
} as const;

export interface SettingItem {
  key: string;
  type: 'string' | 'boolean' | 'number' | 'object';
  defaultValue: any;
}

/**
 * Get a string setting
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 */
export async function getString(key: string, defaultValue = ''): Promise<string> {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    logger.error(`settingsService: Error getting string "${key}":`, { error });
    return defaultValue;
  }
}

/**
 * Set a string setting
 * @param key - Setting key
 * @param value - Value to store
 * @returns True if successful
 */
export async function setString(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, String(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting string "${key}":`, { error });
    return false;
  }
}

/**
 * Get a boolean setting
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 */
export async function getBoolean(key: string, defaultValue = false): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    return value === 'true';
  } catch (error) {
    logger.error(`settingsService: Error getting boolean "${key}":`, { error });
    return defaultValue;
  }
}

/**
 * Set a boolean setting
 * @param key - Setting key
 * @param value - Value to store
 * @returns True if successful
 */
export async function setBoolean(key: string, value: boolean): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value ? 'true' : 'false');
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting boolean "${key}":`, { error });
    return false;
  }
}

/**
 * Get a number setting
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 */
export async function getNumber(key: string, defaultValue = 0): Promise<number> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch (error) {
    logger.error(`settingsService: Error getting number "${key}":`, { error });
    return defaultValue;
  }
}

/**
 * Set a number setting
 * @param key - Setting key
 * @param value - Value to store
 * @returns True if successful
 */
export async function setNumber(key: string, value: number): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, String(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting number "${key}":`, { error });
    return false;
  }
}

/**
 * Get a JSON object setting
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 */
export async function getObject<T = any>(key: string, defaultValue: T = {} as T): Promise<T> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error(`settingsService: Error getting object "${key}":`, { error });
    return defaultValue;
  }
}

/**
 * Set a JSON object setting
 * @param key - Setting key
 * @param value - Value to store
 * @returns True if successful
 */
export async function setObject(key: string, value: any): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`settingsService: Error setting object "${key}":`, { error });
    return false;
  }
}

/**
 * Delete a setting
 * @param key - Setting key to delete
 * @returns True if successful
 */
export async function deleteSetting(key: string): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    logger.error(`settingsService: Error deleting "${key}":`, { error });
    return false;
  }
}

/**
 * Toggle a boolean setting
 * @param key - Setting key
 * @returns New value after toggle
 */
export async function toggle(key: string): Promise<boolean> {
  const currentValue = await getBoolean(key);
  const newValue = !currentValue;
  await setBoolean(key, newValue);
  return newValue;
}

/**
 * Check if a setting exists
 * @param key - Setting key
 * @returns True if setting exists
 */
export async function exists(key: string): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value !== null;
  } catch (error) {
    logger.error(`settingsService: Error checking existence of "${key}":`, { error });
    return false;
  }
}

/**
 * Get multiple settings at once
 * @param settings - Array of setting configurations
 * @returns Object with keys mapped to values
 */
export async function getMultiple(settings: SettingItem[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

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
 * @param settings - Object with key-value pairs to set
 * @returns True if all successful
 */
export async function setMultiple(settings: Record<string, any>): Promise<boolean> {
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
    logger.error('settingsService: Error setting multiple settings:', { error });
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
