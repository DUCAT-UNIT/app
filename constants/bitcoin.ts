/**
 * Bitcoin-related constants
 */

import { APP_NETWORK_CONFIG } from '../utils/networkConfig';

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
 * BIP44 derivation path constants
 */
const COIN_TYPE = APP_NETWORK_CONFIG.coinType;

export type WalletDerivationMode = 'legacy_address_index' | 'bip44_account';
export type WalletProfile = 'xverse' | 'unisat' | 'private_key';
export type WalletImportProfile = Exclude<WalletProfile, 'private_key'>;

// Match Xverse/Quanta account discovery: fixed BIP account 0, increment external address index.
export const XVERSE_WALLET_DERIVATION_MODE: WalletDerivationMode = 'legacy_address_index';
export const UNISAT_WALLET_DERIVATION_MODE: WalletDerivationMode = 'bip44_account';
export const DEFAULT_WALLET_DERIVATION_MODE: WalletDerivationMode = XVERSE_WALLET_DERIVATION_MODE;

export const WALLET_PROFILES = {
  xverse: {
    id: 'xverse',
    label: 'Xverse',
    description: 'Use this for Xverse seed phrases.',
    kind: 'mnemonic',
    derivationMode: XVERSE_WALLET_DERIVATION_MODE,
  },
  unisat: {
    id: 'unisat',
    label: 'UniSat',
    description: 'Use this for UniSat HD wallet seed phrases.',
    kind: 'mnemonic',
    derivationMode: UNISAT_WALLET_DERIVATION_MODE,
  },
  private_key: {
    id: 'private_key',
    label: 'Private key',
    description: 'Single-address fallback for exported UniSat private keys.',
    kind: 'private_key',
    derivationMode: null,
  },
} as const satisfies Record<
  WalletProfile,
  {
    id: WalletProfile;
    label: string;
    description: string;
    kind: 'mnemonic' | 'private_key';
    derivationMode: WalletDerivationMode | null;
  }
>;

export const WALLET_IMPORT_PROFILES = {
  xverse: WALLET_PROFILES.xverse,
  unisat: WALLET_PROFILES.unisat,
} as const satisfies Record<
  WalletImportProfile,
  {
    id: WalletImportProfile;
    label: string;
    description: string;
    kind: 'mnemonic';
    derivationMode: WalletDerivationMode;
  }
>;

export const WALLET_IMPORT_PROFILE_OPTIONS = [
  WALLET_IMPORT_PROFILES.xverse,
  WALLET_IMPORT_PROFILES.unisat,
] as const;

export function getWalletDerivationModeForProfile(
  profile: WalletImportProfile
): WalletDerivationMode {
  return WALLET_IMPORT_PROFILES[profile].derivationMode;
}

export function getWalletProfileForDerivationMode(mode: WalletDerivationMode): WalletImportProfile {
  return mode === UNISAT_WALLET_DERIVATION_MODE ? 'unisat' : 'xverse';
}

export function getWalletProfileLabel(profile: WalletProfile): string {
  return WALLET_PROFILES[profile].label;
}

export function getWalletProfileLabelForDerivationMode(mode: WalletDerivationMode): string {
  return getWalletProfileLabel(getWalletProfileForDerivationMode(mode));
}

export const LEGACY_DERIVATION_PATHS = {
  // BIP49: Nested SegWit P2SH-P2WPKH used by Xverse payment addresses
  LEGACY: (account = 0): string => `m/49'/${COIN_TYPE}'/0'/0/${account}`,

  // BIP84: Native SegWit P2WPKH
  SEGWIT: (account = 0): string => `m/84'/${COIN_TYPE}'/0'/0/${account}`,

  // BIP86: Taproot P2TR
  TAPROOT: (account = 0): string => `m/86'/${COIN_TYPE}'/0'/0/${account}`,
} as const;

export const DERIVATION_PATHS = {
  // BIP49: Nested SegWit P2SH-P2WPKH used by Xverse payment addresses
  LEGACY: (account = 0): string => `m/49'/${COIN_TYPE}'/${account}'/0/0`,

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
