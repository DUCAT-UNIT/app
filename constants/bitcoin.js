/**
 * Bitcoin-related constants
 */

/**
 * Bitcoin dust limit in satoshis
 * Outputs below this amount are considered "dust" and may not be relayed by nodes
 */
export const DUST_LIMIT_SATS = 546;

/**
 * Default fee rate for testnet transactions (sats per virtual byte)
 * Lower than mainnet since testnet has less congestion
 */
export const DEFAULT_FEE_RATE_SAT_PER_VBYTE = 1;

/**
 * Minimum fee rate (sats per vByte)
 * Below this, transactions may not propagate
 */
export const MIN_FEE_RATE = 1;

/**
 * Maximum reasonable fee rate (sats per vByte)
 * Safety check to prevent accidental high fees
 */
export const MAX_FEE_RATE = 1000;

/**
 * Transaction size estimates (in virtual bytes)
 * Used for fee calculation
 */
export const TX_SIZE = {
  BASE: 10, // Base transaction overhead
  P2WPKH_INPUT: 68, // SegWit input size
  P2WPKH_OUTPUT: 31, // SegWit output size
  P2TR_INPUT: 58, // Taproot input size (slightly smaller)
  P2TR_OUTPUT: 43, // Taproot output size
};

/**
 * BIP44 derivation path constants
 */
export const DERIVATION_PATHS = {
  // BIP44: Legacy P2PKH
  LEGACY: (account = 0) => `m/44'/1'/0'/0/${account}`,

  // BIP84: Native SegWit P2WPKH
  SEGWIT: (account = 0) => `m/84'/1'/0'/0/${account}`,

  // BIP86: Taproot P2TR
  TAPROOT: (account = 0) => `m/86'/1'/0'/0/${account}`,
};

/**
 * Bitcoin network magic numbers
 */
export const NETWORK = {
  MAINNET_BIP32_PUBLIC: 0x0488b21e,
  MAINNET_BIP32_PRIVATE: 0x0488ade4,
  TESTNET_BIP32_PUBLIC: 0x043587cf,
  TESTNET_BIP32_PRIVATE: 0x04358394,
};

/**
 * Transaction confirmation targets
 */
export const CONFIRMATION_TARGET = {
  URGENT: 1, // Next block
  NORMAL: 3, // ~30 minutes
  ECONOMY: 6, // ~1 hour
};

/**
 * Satoshis per Bitcoin
 */
export const SATS_PER_BTC = 100_000_000;

/**
 * Minimum amount for sends (in satoshis)
 * Prevents accidental dust sends
 */
export const MIN_SEND_AMOUNT = 1000;
