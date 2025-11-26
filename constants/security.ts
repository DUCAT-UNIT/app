/**
 * Security-related constants
 */

/**
 * PIN security configuration
 */
export const PIN = {
  // PIN length requirements
  MIN_LENGTH: 6,
  MAX_LENGTH: 6,

  // Rate limiting
  MAX_ATTEMPTS: 10,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  LOCKOUT_DURATION_MINUTES: 30,
} as const;

/**
 * Cryptographic hash iterations
 */
export const CRYPTO = {
  // PBKDF2 iterations for PIN hashing
  // Balance between security and mobile performance
  PIN_HASH_ITERATIONS: 10000,

  // Salt length in bytes
  SALT_LENGTH_BYTES: 32,
} as const;

/**
 * Session timeout (for auto-lock)
 */
export const SESSION = {
  // Time before auto-lock (in milliseconds)
  TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  TIMEOUT_MINUTES: 5,

  // Background timeout (when app goes to background)
  BACKGROUND_TIMEOUT_MS: 1 * 60 * 1000, // 1 minute
} as const;

/**
 * Biometric authentication
 */
export const BIOMETRIC = {
  PROMPT_MESSAGE: 'Authenticate to access your wallet',
  FALLBACK_LABEL: 'Use PIN',
  CANCEL_LABEL: 'Cancel',
} as const;

/**
 * Passkey authentication (WebAuthn)
 */
export const PASSKEY = {
  // Relying Party configuration
  RP_NAME: 'Ducat Wallet',
  // Use domain for passkey association - must match associatedDomains in app.json
  RP_ID: 'ducatprotocol.com',
  TIMEOUT_MS: 60000, // 60 seconds

  // User verification requirements
  USER_VERIFICATION: 'required', // Always require biometric/PIN
  RESIDENT_KEY: 'required', // Store passkey on device
  ATTESTATION: 'none', // Don't need attestation

  // HKDF derivation parameters
  DERIVATION_SALT: 'ducat-wallet-v1', // Version-specific salt
  DERIVATION_INFO: 'bip39-mnemonic-seed', // Domain separation
  ENTROPY_BITS: 128, // 128 bits = 12-word mnemonic
  ENCRYPTION_KEY_BITS: 256, // AES-256 encryption

  // Prompts
  CREATE_PROMPT: 'Create passkey for wallet recovery',
  AUTH_PROMPT: 'Authenticate to unlock wallet',
  RECOVER_PROMPT: 'Authenticate to recover wallet',
} as const;

/**
 * Secure storage keys versions
 * Increment when changing storage schema
 */
export const STORAGE_VERSION = {
  MNEMONIC: 'v1',
  PIN: 'v1',
  ACCOUNT: 'v1',
} as const;

// Type exports for use in other files
export type PinConfig = typeof PIN;
export type CryptoConfig = typeof CRYPTO;
export type SessionConfig = typeof SESSION;
export type BiometricConfig = typeof BIOMETRIC;
export type PasskeyConfig = typeof PASSKEY;
export type StorageVersionConfig = typeof STORAGE_VERSION;
