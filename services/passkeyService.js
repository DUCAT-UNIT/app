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
 * BARREL EXPORT - All functions re-exported from modular structure
 * This file maintains backward compatibility with existing imports
 */

// Re-export everything from the passkey module
export * from './passkey';
