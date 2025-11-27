/**
 * Wallet Service - Wallet creation, import, and management
 */

import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import { deriveAddressesFromMnemonic, type DerivedAddresses } from '../utils/bitcoin';
import { getCurrentAccount, withMnemonic, saveMnemonic, saveCurrentAccount } from './secureStorageService';

export interface GenerateWalletResult {
  mnemonic: string;
  addresses: DerivedAddresses;
}

export interface ImportWalletResult {
  addresses: DerivedAddresses;
}

export interface LoadWalletResult {
  addresses: DerivedAddresses | null;
  accountIndex: number;
}

export interface SwitchAccountResult {
  addresses: DerivedAddresses;
}

/**
 * Generate a new wallet with a 12-word mnemonic
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns Promise with mnemonic and addresses
 */
export const generateWallet = async (accountIndex = 0): Promise<GenerateWalletResult> => {
  try {
    // Generate random bytes using expo-crypto
    const randomBytes = await Crypto.getRandomBytesAsync(16);

    // Generate a 12-word mnemonic
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(randomBytes).toString('hex'));

    // Derive addresses from mnemonic
    const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

    return {
      mnemonic,
      addresses,
    };
  } catch (error: unknown) {
    throw new Error('Failed to generate wallet: ' + (error as Error).message);
  }
};

/**
 * Validate and import a wallet from mnemonic
 * @param mnemonic - BIP39 mnemonic phrase (space-separated words)
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns Promise with addresses
 */
export const importWallet = async (mnemonic: string, accountIndex = 0): Promise<ImportWalletResult> => {
  // Trim and normalize the mnemonic
  const normalizedMnemonic = mnemonic.trim().toLowerCase();

  // Validate the mnemonic
  if (!bip39.validateMnemonic(normalizedMnemonic)) {
    throw new Error('Invalid seed phrase. Please check and try again.');
  }

  // Derive addresses from mnemonic
  const addresses = deriveAddressesFromMnemonic(normalizedMnemonic, accountIndex);

  return {
    addresses,
  };
};

/**
 * Load wallet from secure storage and derive addresses
 * @returns Promise with addresses and account index
 */
export const loadWalletFromStorage = async (): Promise<LoadWalletResult> => {
  try {
    const accountIndex = await getCurrentAccount();

    // Use withMnemonic to ensure proper cleanup
    const addresses = await withMnemonic(async (mnemonic: string) => {
      if (!mnemonic) {
        return null;
      }
      return deriveAddressesFromMnemonic(mnemonic, accountIndex);
    });

    return {
      addresses,
      accountIndex,
    };
  } catch (error: unknown) {
    throw new Error('Failed to load wallet from storage: ' + (error as Error).message);
  }
};

/**
 * Switch to a different account in the HD wallet
 * @param accountIndex - New account index
 * @returns Promise with addresses
 */
export const switchToAccount = async (accountIndex: number): Promise<SwitchAccountResult> => {
  try {
    // Use withMnemonic to ensure proper cleanup
    const addresses = await withMnemonic(async (mnemonic: string) => {
      if (!mnemonic) {
        throw new Error('Failed to retrieve wallet from secure storage');
      }

      // Derive new addresses for the selected account
      return deriveAddressesFromMnemonic(mnemonic, accountIndex);
    });

    // Save the new account index
    await saveCurrentAccount(accountIndex);

    return {
      addresses,
    };
  } catch (error: unknown) {
    throw new Error('Failed to switch account: ' + (error as Error).message);
  }
};

/**
 * Save wallet to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @param accountIndex - Account index
 * @returns Success status
 */
export const saveWalletToStorage = async (mnemonic: string, accountIndex = 0): Promise<boolean> => {
  try {
    const mnemonicSaved = await saveMnemonic(mnemonic);
    const accountSaved = await saveCurrentAccount(accountIndex);

    return mnemonicSaved && accountSaved;
  } catch (error: unknown) {
    return false;
  }
};
