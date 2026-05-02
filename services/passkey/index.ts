/**
 * Passkey Service - WebAuthn-based wallet authentication and recovery
 *
 * This service provides secure wallet backup with passkey encryption:
 * - Random BIP39 Mnemonic → Encrypt with Passkey-Derived Key → Store in iCloud
 * - Passkey syncs via iCloud Keychain (iOS) / Google Password Manager (Android)
 * - Encrypted backup syncs via iCloud (Apple can't decrypt it)
 * - No server storage required - encrypted client-side only
 * - Recoverable across devices with same Apple ID
 *
 * BARREL EXPORT - All functions re-exported for backward compatibility
 */

// Core utilities and constants
export { isPasskeySupported, PASSKEY_KEYS } from './core';

// Wallet creation functions
export { createWalletWithPasskey, addPasskeyToExistingWallet } from './creation';

// Unlock and recovery functions
export { unlockWithPasskey, recoverWithPasskey } from './unlock';

// PIN change functions
export { atomicPinChangeWithPasskey, reencryptPasskeyMnemonicAfterPinChange } from './pinChange';

// Storage management functions
export {
  clearPasskeyData,
  getPasskeyDerivationVersion,
  getWalletCreationMethod,
  isPasskeyEnabled,
  isPasskeyUpgradeRecommended,
  removePasskey,
} from './storage';

// Re-export iCloud functions for convenience
export { hasICloudBackup } from '../icloudStorage';
