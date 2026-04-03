/**
 * Airdrop Lock Utilities
 * Manages airdrop request locks and timing to prevent duplicate requests
 */

import {
  deletePreferenceItem,
  getPreferenceItem,
  setPreferenceItem,
} from '../services/storagePolicy';

const LOCK_TIMEOUT = 60 * 1000; // 60 seconds
const AIRDROP_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate lock key for a wallet address and account
 * @param address - Wallet address
 * @param account - Account index
 * @returns Lock key
 */
export function getLockKey(address: string, account: number): string {
  return `airdropLock_${address}_${account}`;
}

/**
 * Generate airdrop time key for a wallet address and account
 * @param address - Wallet address
 * @param account - Account index
 * @returns Airdrop time key
 */
export function getAirdropKey(address: string, account: number): string {
  return `lastAirdropTime_${address}_${account}`;
}

/**
 * Generate pending airdrop key for a wallet address and account
 * @param address - Wallet address
 * @param account - Account index
 * @returns Pending airdrop key
 */
export function getPendingKey(address: string, account: number): string {
  return `pendingAirdrop_${address}_${account}`;
}

/**
 * Check if a lock exists and is still valid
 * @param lockKey - Lock key to check
 * @returns True if lock is active
 */
export async function isLockActive(lockKey: string): Promise<boolean> {
  try {
    const existingLock = await getPreferenceItem(lockKey);
    if (!existingLock) {
      return false;
    }

    const lockTime = parseInt(existingLock, 10);
    const now = Date.now();

    // Lock is active if less than timeout period old
    return now - lockTime < LOCK_TIMEOUT;
  } catch {
    return false;
  }
}

/**
 * Acquire an airdrop lock
 * @param lockKey - Lock key
 * @returns Promise<void>
 */
export async function acquireLock(lockKey: string): Promise<void> {
  const now = Date.now();
  await setPreferenceItem(lockKey, now.toString());
}

/**
 * Release an airdrop lock
 * @param lockKey - Lock key
 * @returns Promise<void>
 */
export async function releaseLock(lockKey: string): Promise<void> {
  try {
    await deletePreferenceItem(lockKey);
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Clean up expired lock if it exists
 * @param lockKey - Lock key
 * @returns Promise<void>
 */
export async function cleanupExpiredLock(lockKey: string): Promise<void> {
  try {
    const existingLock = await getPreferenceItem(lockKey);
    if (existingLock) {
      const lockTime = parseInt(existingLock, 10);
      const now = Date.now();

      // If lock is expired (older than timeout), clean it up
      if (now - lockTime >= LOCK_TIMEOUT) {
        await deletePreferenceItem(lockKey);
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Check if airdrop cooldown period has passed
 * @param airdropKey - Airdrop time key
 * @returns True if cooldown has passed
 */
export async function isCooldownExpired(airdropKey: string): Promise<boolean> {
  try {
    const lastAirdropTime = await getPreferenceItem(airdropKey);
    if (!lastAirdropTime) {
      return true; // No previous airdrop
    }

    const now = Date.now();
    const timeSinceLastAirdrop = now - parseInt(lastAirdropTime, 10);

    return timeSinceLastAirdrop >= AIRDROP_COOLDOWN;
  } catch {
    return true; // On error, allow airdrop attempt
  }
}

/**
 * Record airdrop request time
 * @param airdropKey - Airdrop time key
 * @returns Promise<void>
 */
export async function recordAirdropTime(airdropKey: string): Promise<void> {
  const now = Date.now();
  await setPreferenceItem(airdropKey, now.toString());
}

/**
 * Store pending airdrop transaction ID
 * @param pendingKey - Pending airdrop key
 * @param txId - Transaction ID
 * @returns Promise<void>
 */
export async function storePendingAirdrop(pendingKey: string, txId: string): Promise<void> {
  await setPreferenceItem(pendingKey, txId);
}

/**
 * Get pending airdrop transaction ID
 * @param pendingKey - Pending airdrop key
 * @returns Transaction ID or null
 */
export async function getPendingAirdrop(pendingKey: string): Promise<string | null> {
  try {
    return await getPreferenceItem(pendingKey);
  } catch {
    return null;
  }
}

/**
 * Clear pending airdrop
 * @param pendingKey - Pending airdrop key
 * @returns Promise<void>
 */
export async function clearPendingAirdrop(pendingKey: string): Promise<void> {
  try {
    await deletePreferenceItem(pendingKey);
  } catch {
    // Ignore errors
  }
}
