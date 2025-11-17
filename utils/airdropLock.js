/**
 * Airdrop Lock Utilities
 * Manages airdrop request locks and timing to prevent duplicate requests
 */

import * as SecureStore from 'expo-secure-store';

const LOCK_TIMEOUT = 60 * 1000; // 60 seconds
const AIRDROP_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate lock key for a wallet address and account
 * @param {string} address - Wallet address
 * @param {number} account - Account index
 * @returns {string} Lock key
 */
export function getLockKey(address, account) {
  return `airdropLock_${address}_${account}`;
}

/**
 * Generate airdrop time key for a wallet address and account
 * @param {string} address - Wallet address
 * @param {number} account - Account index
 * @returns {string} Airdrop time key
 */
export function getAirdropKey(address, account) {
  return `lastAirdropTime_${address}_${account}`;
}

/**
 * Generate pending airdrop key for a wallet address and account
 * @param {string} address - Wallet address
 * @param {number} account - Account index
 * @returns {string} Pending airdrop key
 */
export function getPendingKey(address, account) {
  return `pendingAirdrop_${address}_${account}`;
}

/**
 * Check if a lock exists and is still valid
 * @param {string} lockKey - Lock key to check
 * @returns {Promise<boolean>} True if lock is active
 */
export async function isLockActive(lockKey) {
  try {
    const existingLock = await SecureStore.getItemAsync(lockKey);
    if (!existingLock) {
      return false;
    }

    const lockTime = parseInt(existingLock, 10);
    const now = Date.now();

    // Lock is active if less than timeout period old
    return now - lockTime < LOCK_TIMEOUT;
  } catch (error) {
    return false;
  }
}

/**
 * Acquire an airdrop lock
 * @param {string} lockKey - Lock key
 * @returns {Promise<void>}
 */
export async function acquireLock(lockKey) {
  const now = Date.now();
  await SecureStore.setItemAsync(lockKey, now.toString());
}

/**
 * Release an airdrop lock
 * @param {string} lockKey - Lock key
 * @returns {Promise<void>}
 */
export async function releaseLock(lockKey) {
  try {
    await SecureStore.deleteItemAsync(lockKey);
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Clean up expired lock if it exists
 * @param {string} lockKey - Lock key
 * @returns {Promise<void>}
 */
export async function cleanupExpiredLock(lockKey) {
  try {
    const existingLock = await SecureStore.getItemAsync(lockKey);
    if (existingLock) {
      const lockTime = parseInt(existingLock, 10);
      const now = Date.now();

      // If lock is expired (older than timeout), clean it up
      if (now - lockTime >= LOCK_TIMEOUT) {
        await SecureStore.deleteItemAsync(lockKey);
      }
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Check if airdrop cooldown period has passed
 * @param {string} airdropKey - Airdrop time key
 * @returns {Promise<boolean>} True if cooldown has passed
 */
export async function isCooldownExpired(airdropKey) {
  try {
    const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
    if (!lastAirdropTime) {
      return true; // No previous airdrop
    }

    const now = Date.now();
    const timeSinceLastAirdrop = now - parseInt(lastAirdropTime, 10);

    return timeSinceLastAirdrop >= AIRDROP_COOLDOWN;
  } catch (error) {
    return true; // On error, allow airdrop attempt
  }
}

/**
 * Record airdrop request time
 * @param {string} airdropKey - Airdrop time key
 * @returns {Promise<void>}
 */
export async function recordAirdropTime(airdropKey) {
  const now = Date.now();
  await SecureStore.setItemAsync(airdropKey, now.toString());
}

/**
 * Store pending airdrop transaction ID
 * @param {string} pendingKey - Pending airdrop key
 * @param {string} txId - Transaction ID
 * @returns {Promise<void>}
 */
export async function storePendingAirdrop(pendingKey, txId) {
  await SecureStore.setItemAsync(pendingKey, txId);
}

/**
 * Get pending airdrop transaction ID
 * @param {string} pendingKey - Pending airdrop key
 * @returns {Promise<string|null>} Transaction ID or null
 */
export async function getPendingAirdrop(pendingKey) {
  try {
    return await SecureStore.getItemAsync(pendingKey);
  } catch (error) {
    return null;
  }
}

/**
 * Clear pending airdrop
 * @param {string} pendingKey - Pending airdrop key
 * @returns {Promise<void>}
 */
export async function clearPendingAirdrop(pendingKey) {
  try {
    await SecureStore.deleteItemAsync(pendingKey);
  } catch (error) {
    // Ignore errors
  }
}
