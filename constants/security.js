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
};

/**
 * Cryptographic hash iterations
 */
export const CRYPTO = {
  // PBKDF2 iterations for PIN hashing
  // Balance between security and mobile performance
  PIN_HASH_ITERATIONS: 10000,

  // Salt length in bytes
  SALT_LENGTH_BYTES: 32,
};

/**
 * Session timeout (for auto-lock)
 */
export const SESSION = {
  // Time before auto-lock (in milliseconds)
  TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  TIMEOUT_MINUTES: 5,

  // Background timeout (when app goes to background)
  BACKGROUND_TIMEOUT_MS: 1 * 60 * 1000, // 1 minute
};

/**
 * Biometric authentication
 */
export const BIOMETRIC = {
  PROMPT_MESSAGE: 'Authenticate to access your wallet',
  FALLBACK_LABEL: 'Use PIN',
  CANCEL_LABEL: 'Cancel',
};

/**
 * Secure storage keys versions
 * Increment when changing storage schema
 */
export const STORAGE_VERSION = {
  MNEMONIC: 'v1',
  PIN: 'v1',
  ACCOUNT: 'v1',
};
