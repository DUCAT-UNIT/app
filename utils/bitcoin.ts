/**
 * Bitcoin utilities - network configuration and address derivation
 */

import * as bitcoin from 'bitcoinjs-lib';
import type { Network } from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  getDerivationPathSet,
  type WalletDerivationMode,
} from '../constants/bitcoin';
import { APP_NETWORK_CONFIG } from './networkConfig';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

export const BITCOIN_NETWORK: Network = APP_NETWORK_CONFIG.bitcoinjs;
// Backward-compatible alias while the codebase finishes migrating to generic naming.
export const MUTINYNET_NETWORK: Network = BITCOIN_NETWORK;

const EXPECTED_NETWORK_CONFIG = {
  name: APP_NETWORK_CONFIG.id,
  bech32Prefix: APP_NETWORK_CONFIG.bitcoinjs.bech32,
  pubKeyHash: APP_NETWORK_CONFIG.bitcoinjs.pubKeyHash,
  scriptHash: APP_NETWORK_CONFIG.bitcoinjs.scriptHash,
} as const;

export const SEGWIT_ADDRESS_PREFIX = APP_NETWORK_CONFIG.addressPrefixes.segwit;
export const TAPROOT_ADDRESS_PREFIX = APP_NETWORK_CONFIG.addressPrefixes.taproot;
export const NETWORK_ADDRESS_PREFIXES = APP_NETWORK_CONFIG.addressPrefixes.all;

function getOppositeNetworkError(): string {
  const currentName = APP_NETWORK_CONFIG.isTestNetwork
    ? `${APP_NETWORK_CONFIG.displayName.toLowerCase()} testnet`
    : APP_NETWORK_CONFIG.displayName.toLowerCase();
  const expectedPrefixes = NETWORK_ADDRESS_PREFIXES.join(', ');
  const oppositeName = APP_NETWORK_CONFIG.addressPrefixes.oppositeDisplayName;
  return (
    `${oppositeName[0].toUpperCase()}${oppositeName.slice(1)} address detected. ` +
    `Please use a ${currentName} address (starting with ${expectedPrefixes})`
  );
}

function matchesPrefix(address: string, prefixes: string[]): boolean {
  const lower = address.toLowerCase();
  return prefixes.some(prefix => lower.startsWith(prefix.toLowerCase()));
}

/**
 * Validate that the app is configured for the selected Bitcoin network.
 * @throws Error if runtime network configuration is inconsistent
 */
export const validateNetworkConfig = (): boolean => {
  if (BITCOIN_NETWORK.bech32 !== EXPECTED_NETWORK_CONFIG.bech32Prefix) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected ${EXPECTED_NETWORK_CONFIG.name} bech32 prefix ${EXPECTED_NETWORK_CONFIG.bech32Prefix}, ` +
      `but found: ${BITCOIN_NETWORK.bech32}.`
    );
  }

  if (BITCOIN_NETWORK.pubKeyHash !== EXPECTED_NETWORK_CONFIG.pubKeyHash) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected ${EXPECTED_NETWORK_CONFIG.name} pubKeyHash (0x${EXPECTED_NETWORK_CONFIG.pubKeyHash.toString(16)}), ` +
      `but found: 0x${BITCOIN_NETWORK.pubKeyHash.toString(16)}.`
    );
  }

  if (BITCOIN_NETWORK.scriptHash !== EXPECTED_NETWORK_CONFIG.scriptHash) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected ${EXPECTED_NETWORK_CONFIG.name} scriptHash (0x${EXPECTED_NETWORK_CONFIG.scriptHash.toString(16)}), ` +
      `but found: 0x${BITCOIN_NETWORK.scriptHash.toString(16)}.`
    );
  }

  return true;
};

export interface DerivedAddresses {
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
}

/**
 * Derive SegWit and Taproot addresses from a BIP39 mnemonic
 * @param mnemonic - BIP39 mnemonic phrase
 * @param accountIndex - Account index for derivation (default: 0)
 * @param derivationMode - Wallet derivation mode (defaults to BIP44/BIP84/BIP86 account isolation)
 * @returns Object containing segwitAddress, taprootAddress, segwitPubkey, taprootPubkey
 */
export const deriveAddressesFromMnemonic = (
  mnemonic: string,
  accountIndex = 0,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): DerivedAddresses => {
  validateNetworkConfig();

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, BITCOIN_NETWORK);
  const derivationPaths = getDerivationPathSet(derivationMode);
  const segwitPath = derivationPaths.SEGWIT(accountIndex);
  const segwitChild = root.derivePath(segwitPath);
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: segwitChild.publicKey,
    network: BITCOIN_NETWORK,
  });

  const taprootPath = derivationPaths.TAPROOT(accountIndex);
  const taprootChild = root.derivePath(taprootPath);
  const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: BITCOIN_NETWORK,
  });

  if (!segwitPayment.address) {
    throw new Error('Failed to generate SegWit address from public key');
  }
  if (!taprootPayment.address) {
    throw new Error('Failed to generate Taproot address from public key');
  }

  return {
    segwitAddress: segwitPayment.address,
    taprootAddress: taprootPayment.address,
    segwitPubkey: Buffer.from(segwitChild.publicKey).toString('hex'),
    taprootPubkey: Buffer.from(xOnlyPubkey).toString('hex'), // Use x-only pubkey (32 bytes) for Taproot
  };
};

// AddressType canonical definition in utils/formatters/addresses.ts
import type { AddressType } from './formatters/addresses';
export type { AddressType };

export interface AddressValidation {
  valid: boolean;
  type?: AddressType;
  error?: string;
}

/**
 * Validate a Bitcoin address for the current network
 * @param address - Bitcoin address to validate
 * @returns Validation result
 */
export const validateBitcoinAddress = (address: string | null | undefined): AddressValidation => {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return { valid: false, error: 'Address cannot be empty' };
  }

  try {
    bitcoin.address.toOutputScript(trimmedAddress, BITCOIN_NETWORK);

    let addressType: AddressType = 'unknown';
    const lowerAddress = trimmedAddress.toLowerCase();
    if (lowerAddress.startsWith(TAPROOT_ADDRESS_PREFIX)) {
      addressType = 'taproot';
    } else if (lowerAddress.startsWith(SEGWIT_ADDRESS_PREFIX)) {
      addressType = 'segwit';
    } else if (matchesPrefix(lowerAddress, APP_NETWORK_CONFIG.addressPrefixes.legacy)) {
      addressType = 'legacy';
    }

    return {
      valid: true,
      type: addressType,
    };
  } catch (error: unknown) {
    if (matchesPrefix(trimmedAddress, APP_NETWORK_CONFIG.addressPrefixes.oppositeAll)) {
      return {
        valid: false,
        error: getOppositeNetworkError(),
      };
    }

    return {
      valid: false,
      error: 'Invalid Bitcoin address format',
    };
  }
};

/**
 * Validate and normalize a Bitcoin address
 * @param address - Bitcoin address to validate and normalize
 * @returns Normalized address (trimmed)
 * @throws Error if address is invalid
 */
export const validateAndNormalizeAddress = (address: string): string => {
  const validation = validateBitcoinAddress(address);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return address.trim();
};

/**
 * Extract public key from a Taproot address
 * For Taproot (P2TR) addresses, the address encodes the x-only pubkey (32 bytes)
 * @param address - Taproot Bitcoin address
 * @returns Hex-encoded public key (64 characters for x-only pubkey)
 * @throws Error if address is not a valid Taproot address
 */
export const extractPubkeyFromTaprootAddress = (address: string): string => {
  const trimmedAddress = address.trim();

  const lowerAddress = trimmedAddress.toLowerCase();
  if (!lowerAddress.startsWith('tb1p') && !lowerAddress.startsWith('bc1p')) {
    throw new Error('Address must be a Taproot address (tb1p... or bc1p...)');
  }

  try {
    // Decode the bech32m address
    const decoded = bitcoin.address.fromBech32(trimmedAddress);

    // For Taproot, the data is the 32-byte x-only pubkey
    if (decoded.version !== 1 || decoded.data.length !== 32) {
      throw new Error('Invalid Taproot address format');
    }

    // Convert the data buffer to hex string (ensure proper conversion)
    return Buffer.from(decoded.data).toString('hex');
  } catch (error: unknown) {
    throw new Error(`Failed to extract pubkey from Taproot address: ${(error as Error).message}`);
  }
};
