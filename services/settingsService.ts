/**
 * Settings Service
 * Unified service for managing app preferences and flow flags.
 *
 * Preferences live in AsyncStorage with legacy SecureStore migration so low-sensitivity
 * state does not share storage policy with secrets.
 */

import { logger } from '../utils/logger';
import {
  deletePreferenceItem,
  getPreferenceItem,
  preferenceItemExists,
  setPreferenceItem,
} from './storagePolicy';
import {
  isBiometricEnabled as getBiometricPreference,
  setBiometricEnabled as setBiometricPreference,
} from './biometricService';

// Setting keys (centralized to avoid typos)
export const SettingKeys = {
  // Authentication settings
  BIOMETRIC_ENABLED: 'biometricEnabled',
  AUTO_LOCK_ENABLED: 'autoLockEnabled',
  AUTO_LOCK_TIMEOUT: 'autoLockTimeout',

  // App preferences
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  SHOW_ZERO_ASSETS: 'showZeroAssets',
  ADVANCED_MODE: 'advancedMode',
  ECASH_THRESHOLD: 'ecashThreshold',
  USDC_FEATURES_ENABLED: 'usdcFeaturesEnabled',
  DISPLAY_CURRENCY: 'displayCurrency',
  PRICE_DISPLAY_MODE: 'priceDisplayMode',

  // Temporary/flow state
  PENDING_FACE_ID_ENABLE: 'pendingFaceIdEnable',
  PENDING_NOTIFICATIONS_ENABLE: 'pendingNotificationsEnable',
  RETURN_TO_SETTINGS_AFTER_AUTH: 'returnToSettingsAfterAuth',
  RETURN_TO_SETTINGS_AFTER_PIN_CHANGE: 'returnToSettingsAfterPinChange',
  RETURN_TO_SETTINGS_AFTER_SEED_PHRASE: 'returnToSettingsAfterSeedPhrase',
  PENDING_WALLET_DELETE: 'pendingWalletDelete',
  PENDING_BIOMETRIC_ENABLE: 'pendingBiometricEnable',

  // Wallet settings
  CURRENT_ACCOUNT: 'currentAccount',
  WALLET_CREATED_WITH_PASSKEY: 'walletCreatedWithPasskey',

  // Developer settings (if applicable)
  DEBUG_MODE: 'debugMode',
} as const;

/**
 * Type mapping for setting types to their TypeScript equivalents
 * @example
 * // Maps 'string' -> string, 'boolean' -> boolean, etc.
 * type MyType = SettingTypeMap['boolean']; // boolean
 */
export interface SettingTypeMap {
  string: string;
  boolean: boolean;
  number: number;
  object: Record<string, unknown>;
}

/**
 * Setting item configuration with generic type inference
 * @template T - The setting type ('string' | 'boolean' | 'number' | 'object')
 * @example
 * const setting: SettingItem<'boolean'> = {
 *   key: 'darkMode',
 *   type: 'boolean',
 *   defaultValue: false // TypeScript enforces this is boolean
 * };
 */
export interface SettingItem<T extends keyof SettingTypeMap = keyof SettingTypeMap> {
  key: string;
  type: T;
  defaultValue: SettingTypeMap[T];
}

/**
 * Get a string setting
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 */
export async function getString(key: string, defaultValue = ''): Promise<string> {
  try {
    const value = await getPreferenceItem(key);
    return value !== null ? value : defaultValue;
  } catch (error: unknown) {
    logger.error(`settingsService: Error getting string "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    await setPreferenceItem(key, String(value));
    return true;
  } catch (error: unknown) {
    logger.error(`settingsService: Error setting string "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    const value = await getPreferenceItem(key);
    if (value === null) {
      return defaultValue;
    }
    return value === 'true';
  } catch (error: unknown) {
    logger.error(`settingsService: Error getting boolean "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    await setPreferenceItem(key, value ? 'true' : 'false');
    return true;
  } catch (error: unknown) {
    logger.error(`settingsService: Error setting boolean "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    const value = await getPreferenceItem(key);
    if (value === null) {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch (error: unknown) {
    logger.error(`settingsService: Error getting number "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    await setPreferenceItem(key, String(value));
    return true;
  } catch (error: unknown) {
    logger.error(`settingsService: Error setting number "${key}":`, { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Get a JSON object setting with type-safe generic
 * @template T - The expected object type
 * @param key - Setting key
 * @param defaultValue - Default value if not set
 * @returns Setting value
 * @example
 * interface UserPrefs { theme: string; fontSize: number; }
 * const prefs = await getObject<UserPrefs>('userPrefs', { theme: 'dark', fontSize: 14 });
 */
export async function getObject<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T
): Promise<T> {
  try {
    const value = await getPreferenceItem(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value) as T;
  } catch (error: unknown) {
    logger.error(`settingsService: Error getting object "${key}":`, { error: error instanceof Error ? error.message : String(error) });
    return defaultValue;
  }
}

/**
 * Set a JSON object setting with type-safe generic
 * @template T - The object type being stored
 * @param key - Setting key
 * @param value - Value to store
 * @returns True if successful
 * @example
 * interface UserPrefs { theme: string; fontSize: number; }
 * await setObject<UserPrefs>('userPrefs', { theme: 'dark', fontSize: 14 });
 */
export async function setObject<T extends Record<string, unknown>>(
  key: string,
  value: T
): Promise<boolean> {
  try {
    await setPreferenceItem(key, JSON.stringify(value));
    return true;
  } catch (error: unknown) {
    logger.error(`settingsService: Error setting object "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    await deletePreferenceItem(key);
    return true;
  } catch (error: unknown) {
    logger.error(`settingsService: Error deleting "${key}":`, { error: error instanceof Error ? error.message : String(error) });
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
    return await preferenceItemExists(key);
  } catch (error: unknown) {
    logger.error(`settingsService: Error checking existence of "${key}":`, { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Get multiple settings at once with type inference
 * @param settings - Array of setting configurations
 * @returns Object with keys mapped to their typed values
 * @example
 * const settings = await getMultiple([
 *   { key: 'darkMode', type: 'boolean', defaultValue: false },
 *   { key: 'fontSize', type: 'number', defaultValue: 14 }
 * ]);
 * // settings.darkMode is boolean, settings.fontSize is number
 */
export async function getMultiple<T extends SettingItem[]>(
  settings: T
): Promise<Record<string, SettingTypeMap[keyof SettingTypeMap]>> {
  const results: Record<string, SettingTypeMap[keyof SettingTypeMap]> = {};

  await Promise.all(
    settings.map(async ({ key, type, defaultValue }) => {
      switch (type) {
        case 'boolean':
          results[key] = await getBoolean(key, defaultValue as boolean);
          break;
        case 'number':
          results[key] = await getNumber(key, defaultValue as number);
          break;
        case 'object':
          results[key] = await getObject(key, defaultValue as Record<string, unknown>);
          break;
        case 'string':
        default:
          results[key] = await getString(key, defaultValue as string);
          break;
      }
    })
  );

  return results;
}

/**
 * Allowed value types for setMultiple
 */
export type SettingValue = string | boolean | number | Record<string, unknown>;

/**
 * Set multiple settings at once with type-safe values
 * @param settings - Object with key-value pairs to set
 * @returns True if all successful
 * @example
 * await setMultiple({
 *   darkMode: true,
 *   fontSize: 16,
 *   theme: 'dark'
 * });
 */
export async function setMultiple(settings: Record<string, SettingValue>): Promise<boolean> {
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
  } catch (error: unknown) {
    logger.error('settingsService: Error setting multiple settings:', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// ============================================================================
// Convenience methods (previously in settingsHelpers.ts - inlined to avoid circular dependency)
// ============================================================================

// Authentication settings
export async function getBiometricEnabled(): Promise<boolean> {
  return getBiometricPreference();
}

export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  return setBiometricPreference(enabled);
}

// Notification settings
export async function getNotificationsEnabled(): Promise<boolean> {
  return getBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false);
}

export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  return setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, enabled);
}

// Display preferences
export async function getShowZeroAssets(): Promise<boolean> {
  return getBoolean(SettingKeys.SHOW_ZERO_ASSETS, false);
}

export async function setShowZeroAssets(enabled: boolean): Promise<boolean> {
  return setBoolean(SettingKeys.SHOW_ZERO_ASSETS, enabled);
}

// Auto-lock settings
export async function getAutoLockTimeout(): Promise<number> {
  return getNumber(SettingKeys.AUTO_LOCK_TIMEOUT, 300000); // 5 minutes default
}

export async function setAutoLockTimeout(timeout: number): Promise<boolean> {
  return setNumber(SettingKeys.AUTO_LOCK_TIMEOUT, timeout);
}

// Account settings
export async function getCurrentAccount(): Promise<string> {
  return getString(SettingKeys.CURRENT_ACCOUNT, '0');
}

export async function setCurrentAccount(account: string): Promise<boolean> {
  return setString(SettingKeys.CURRENT_ACCOUNT, account);
}
