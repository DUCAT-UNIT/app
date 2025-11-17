/**
 * Settings Helpers
 * Convenience methods for common app settings
 */

import { SettingKeys, getBoolean, setBoolean, getString, setString, getNumber, setNumber } from './settingsService';

// Authentication settings
export async function getBiometricEnabled() {
  return getBoolean(SettingKeys.BIOMETRIC_ENABLED, false);
}

export async function setBiometricEnabled(enabled) {
  return setBoolean(SettingKeys.BIOMETRIC_ENABLED, enabled);
}

// Notification settings
export async function getNotificationsEnabled() {
  return getBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false);
}

export async function setNotificationsEnabled(enabled) {
  return setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, enabled);
}

// Display preferences
export async function getShowZeroAssets() {
  return getBoolean(SettingKeys.SHOW_ZERO_ASSETS, false);
}

export async function setShowZeroAssets(enabled) {
  return setBoolean(SettingKeys.SHOW_ZERO_ASSETS, enabled);
}

// Auto-lock settings
export async function getAutoLockTimeout() {
  return getNumber(SettingKeys.AUTO_LOCK_TIMEOUT, 300000); // 5 minutes default
}

export async function setAutoLockTimeout(timeout) {
  return setNumber(SettingKeys.AUTO_LOCK_TIMEOUT, timeout);
}

// Account settings
export async function getCurrentAccount() {
  return getString(SettingKeys.CURRENT_ACCOUNT, '0');
}

export async function setCurrentAccount(account) {
  return setString(SettingKeys.CURRENT_ACCOUNT, account);
}
