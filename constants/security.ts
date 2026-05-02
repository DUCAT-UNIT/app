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
  // OWASP recommendation: 310,000+ iterations for PBKDF2-SHA512
  // NIST minimum: 100,000 iterations
  // Updated from 10,000 to 310,000 per security audit
  PIN_HASH_ITERATIONS: 310000,

  // Legacy iteration count for migration
  LEGACY_PIN_HASH_ITERATIONS: 10000,

  // Salt length in bytes
  SALT_LENGTH_BYTES: 32,

  // Version tracking for hash algorithm changes
  PIN_HASH_VERSION: 2, // v1 = 10k iterations, v2 = 310k iterations
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
