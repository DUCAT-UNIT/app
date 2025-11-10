/**
 * Wallet Service - Wallet creation, import, and management
 */

import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import * as AuthService from './authService';

/**
 * Generate a new wallet with a 12-word mnemonic
 * @param {number} accountIndex - Account index for derivation (default: 0)
 * @returns {Promise<{mnemonic: string, addresses: {segwitAddress: string, taprootAddress: string}}>}
 */
export const generateWallet = async (accountIndex = 0) => {
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
  } catch (error) {
    throw new Error('Failed to generate wallet: ' + error.message);
  }
};

/**
 * Validate and import a wallet from mnemonic
 * @param {string} mnemonic - BIP39 mnemonic phrase (space-separated words)
 * @param {number} accountIndex - Account index for derivation (default: 0)
 * @returns {Promise<{addresses: {segwitAddress: string, taprootAddress: string}}>}
 */
export const importWallet = async (mnemonic, accountIndex = 0) => {
  try {
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
  } catch (error) {
    throw error;
  }
};

/**
 * Load wallet from secure storage
 * @returns {Promise<{mnemonic: string|null, accountIndex: number}>}
 */
export const loadWalletFromStorage = async () => {
  try {
    const mnemonic = await AuthService.getMnemonic();
    const accountIndex = await AuthService.getCurrentAccount();

    return {
      mnemonic,
      accountIndex,
    };
  } catch (error) {
    throw new Error('Failed to load wallet from storage: ' + error.message);
  }
};

/**
 * Switch to a different account in the HD wallet
 * @param {number} accountIndex - New account index
 * @returns {Promise<{addresses: {segwitAddress: string, taprootAddress: string}}>}
 */
export const switchToAccount = async (accountIndex) => {
  try {
    // Retrieve mnemonic from secure storage
    const mnemonic = await AuthService.getMnemonic();
    if (!mnemonic) {
      throw new Error('Failed to retrieve wallet from secure storage');
    }

    // Derive new addresses for the selected account
    const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

    // Save the new account index
    await AuthService.saveCurrentAccount(accountIndex);

    return {
      addresses,
    };
  } catch (error) {
    throw new Error('Failed to switch account: ' + error.message);
  }
};

/**
 * Save wallet to secure storage
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @param {number} accountIndex - Account index
 * @returns {Promise<boolean>} Success status
 */
export const saveWalletToStorage = async (mnemonic, accountIndex = 0) => {
  try {
    const mnemonicSaved = await AuthService.saveMnemonic(mnemonic);
    const accountSaved = await AuthService.saveCurrentAccount(accountIndex);

    return mnemonicSaved && accountSaved;
  } catch (error) {
    return false;
  }
};
