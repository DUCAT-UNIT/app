/**
 * Bitcoin-related constants
 */

import { APP_NETWORK_CONFIG } from '../utils/networkConfig';

/**
 * Bitcoin dust limit in satoshis
 * Outputs below this amount are considered "dust" and may not be relayed by nodes
 */
export const DUST_LIMIT_SATS = 546 as const;

/**
 * Default fee rate for wallet transactions (sats per virtual byte)
 */
export const DEFAULT_FEE_RATE_SAT_PER_VBYTE = 1 as const;

/**
 * Minimum fee rate (sats per vByte)
 * Below this, transactions may not propagate
 */
export const MIN_FEE_RATE = 1 as const;

/**
 * Maximum reasonable fee rate (sats per vByte)
 * Safety check to prevent accidental high fees
 */
export const MAX_FEE_RATE = 1000 as const;

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
} as const;

/**
 * BIP44 derivation path constants
 */
const COIN_TYPE = APP_NETWORK_CONFIG.coinType;

export type WalletDerivationMode = 'legacy_address_index' | 'bip44_account';

export const DEFAULT_WALLET_DERIVATION_MODE: WalletDerivationMode = 'bip44_account';

export const LEGACY_DERIVATION_PATHS = {
  // BIP44: Legacy P2PKH
  LEGACY: (account = 0): string => `m/44'/${COIN_TYPE}'/0'/0/${account}`,

  // BIP84: Native SegWit P2WPKH
  SEGWIT: (account = 0): string => `m/84'/${COIN_TYPE}'/0'/0/${account}`,

  // BIP86: Taproot P2TR
  TAPROOT: (account = 0): string => `m/86'/${COIN_TYPE}'/0'/0/${account}`,
} as const;

export const DERIVATION_PATHS = {
  // BIP44: Legacy P2PKH
  LEGACY: (account = 0): string => `m/44'/${COIN_TYPE}'/${account}'/0/0`,

  // BIP84: Native SegWit P2WPKH
  SEGWIT: (account = 0): string => `m/84'/${COIN_TYPE}'/${account}'/0/0`,

  // BIP86: Taproot P2TR
  TAPROOT: (account = 0): string => `m/86'/${COIN_TYPE}'/${account}'/0/0`,
} as const;

export function getDerivationPathSet(
  mode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): typeof DERIVATION_PATHS {
  return mode === 'legacy_address_index' ? LEGACY_DERIVATION_PATHS : DERIVATION_PATHS;
}

export function getDerivationPathForType(
  type: 'legacy' | 'segwit' | 'taproot',
  accountIndex = 0,
  mode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): string {
  const paths = getDerivationPathSet(mode);
  if (type === 'legacy') return paths.LEGACY(accountIndex);
  if (type === 'segwit') return paths.SEGWIT(accountIndex);
  return paths.TAPROOT(accountIndex);
}

/**
 * Bitcoin network magic numbers
 */
export const NETWORK = {
  MAINNET_BIP32_PUBLIC: 0x0488b21e,
  MAINNET_BIP32_PRIVATE: 0x0488ade4,
  TESTNET_BIP32_PUBLIC: 0x043587cf,
  TESTNET_BIP32_PRIVATE: 0x04358394,
} as const;

/**
 * Transaction confirmation targets
 */
export const CONFIRMATION_TARGET = {
  URGENT: 1, // Next block
  NORMAL: 3, // ~30 minutes
  ECONOMY: 6, // ~1 hour
} as const;

/**
 * Satoshis per Bitcoin
 */
export const SATS_PER_BTC = 100_000_000 as const;

/**
 * Minimum amount for sends (in satoshis)
 * Prevents accidental dust sends
 */
export const MIN_SEND_AMOUNT = 1000 as const;

// Type exports for use in other files
export type TxSizeConfig = typeof TX_SIZE;
export type NetworkConfig = typeof NETWORK;
export type ConfirmationTargetConfig = typeof CONFIRMATION_TARGET;
