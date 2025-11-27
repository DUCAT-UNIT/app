/**
 * Bitcoin utilities - network configuration and address derivation
 */

import * as bitcoin from 'bitcoinjs-lib';
import type { Network } from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Mutinynet signet network configuration
export const MUTINYNET_NETWORK: Network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

// Expected network configuration for validation
const EXPECTED_NETWORK_CONFIG = {
  name: 'mutinynet',
  bech32Prefix: 'tb',
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
} as const;

/**
 * Validate that the app is configured for testnet only
 * CRITICAL: This prevents accidental use of mainnet and potential fund loss
 * @throws Error if network configuration doesn't match expected testnet config
 */
export const validateNetworkConfig = (): boolean => {
  // Verify bech32 prefix is testnet
  if (MUTINYNET_NETWORK.bech32 !== EXPECTED_NETWORK_CONFIG.bech32Prefix) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected testnet (bech32: ${EXPECTED_NETWORK_CONFIG.bech32Prefix}), ` +
      `but found: ${MUTINYNET_NETWORK.bech32}. ` +
      `This app is testnet-only and cannot use mainnet.`
    );
  }

  // Verify pubKeyHash is testnet
  if (MUTINYNET_NETWORK.pubKeyHash !== EXPECTED_NETWORK_CONFIG.pubKeyHash) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected testnet pubKeyHash (0x${EXPECTED_NETWORK_CONFIG.pubKeyHash.toString(16)}), ` +
      `but found: 0x${MUTINYNET_NETWORK.pubKeyHash.toString(16)}. ` +
      `This app is testnet-only and cannot use mainnet.`
    );
  }

  // Verify scriptHash is testnet
  if (MUTINYNET_NETWORK.scriptHash !== EXPECTED_NETWORK_CONFIG.scriptHash) {
    throw new Error(
      `CRITICAL: Network misconfiguration detected! ` +
      `Expected testnet scriptHash (0x${EXPECTED_NETWORK_CONFIG.scriptHash.toString(16)}), ` +
      `but found: 0x${MUTINYNET_NETWORK.scriptHash.toString(16)}. ` +
      `This app is testnet-only and cannot use mainnet.`
    );
  }

  // All checks passed
  return true;
};

export interface DerivedAddresses {
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
  [key: string]: unknown;
}

/**
 * Derive SegWit and Taproot addresses from a BIP39 mnemonic
 * @param mnemonic - BIP39 mnemonic phrase
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns Object containing segwitAddress, taprootAddress, segwitPubkey, taprootPubkey
 */
export const deriveAddressesFromMnemonic = (mnemonic: string, accountIndex = 0): DerivedAddresses => {
  // CRITICAL: Validate network configuration before deriving addresses
  validateNetworkConfig();

  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Create HD wallet root
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  // BIP84 - Native SegWit
  const segwitPath = `m/84'/1'/0'/0/${accountIndex}`;
  const segwitChild = root.derivePath(segwitPath);
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: segwitChild.publicKey,
    network: MUTINYNET_NETWORK,
  });

  // BIP86 - Taproot
  const taprootPath = `m/86'/1'/0'/0/${accountIndex}`;
  const taprootChild = root.derivePath(taprootPath);
  const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: MUTINYNET_NETWORK,
  });

  return {
    segwitAddress: segwitPayment.address!,
    taprootAddress: taprootPayment.address!,
    segwitPubkey: Buffer.from(segwitChild.publicKey).toString('hex'),
    taprootPubkey: Buffer.from(xOnlyPubkey).toString('hex'), // Use x-only pubkey (32 bytes) for Taproot
  };
};

export type AddressType = 'taproot' | 'segwit' | 'legacy' | 'unknown';

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
    // Try to decode the address using bitcoinjs-lib to validate it
    bitcoin.address.toOutputScript(trimmedAddress, MUTINYNET_NETWORK);

    // Determine address type based on prefix
    let addressType: AddressType = 'unknown';
    if (trimmedAddress.startsWith('tb1p')) {
      addressType = 'taproot'; // Bech32m (P2TR)
    } else if (trimmedAddress.startsWith('tb1q')) {
      addressType = 'segwit'; // Bech32 (P2WPKH)
    } else if (
      trimmedAddress.startsWith('2') ||
      trimmedAddress.startsWith('m') ||
      trimmedAddress.startsWith('n')
    ) {
      addressType = 'legacy'; // P2SH or P2PKH
    }

    return {
      valid: true,
      type: addressType,
    };
  } catch (error: unknown) {
    // Check if it might be a mainnet address
    if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) {
      return {
        valid: false,
        error:
          'Mainnet address detected. Please use a testnet address (starting with tb1, 2, m, or n)',
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
 * @param address - Taproot Bitcoin address (tb1p... or bc1p...)
 * @returns Hex-encoded public key (64 characters for x-only pubkey)
 * @throws Error if address is not a valid Taproot address
 */
export const extractPubkeyFromTaprootAddress = (address: string): string => {
  const trimmedAddress = address.trim();

  // Validate it's a Taproot address
  if (!trimmedAddress.startsWith('tb1p') && !trimmedAddress.startsWith('bc1p')) {
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
