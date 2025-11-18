/**
 * Tests for Wallet Service
 * Tests wallet generation, import, loading, and account switching
 */

import {
  generateWallet,
  importWallet,
  loadWalletFromStorage,
  switchToAccount,
  saveWalletToStorage,
} from '../walletService';
import * as SecureStorageService from '../secureStorageService';

// Mock dependencies
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

jest.mock('bip39', () => ({
  entropyToMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
}));

jest.mock('../../utils/bitcoin', () => ({
  deriveAddressesFromMnemonic: jest.fn(),
}));

jest.mock('../secureStorageService');

const Crypto = require('expo-crypto');
const bip39 = require('bip39');
const { deriveAddressesFromMnemonic } = require('../../utils/bitcoin');

describe('walletService', () => {
  const mockAddresses = {
    segwitAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    taprootAddress: 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWallet', () => {
    it('should generate a new wallet with mnemonic and addresses', async () => {
      const mockRandomBytes = new Uint8Array(16);
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      Crypto.getRandomBytesAsync.mockResolvedValueOnce(mockRandomBytes);
      bip39.entropyToMnemonic.mockReturnValueOnce(mockMnemonic);
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await generateWallet();

      expect(result).toEqual({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 0);
    });

    it('should generate wallet with custom account index', async () => {
      const mockRandomBytes = new Uint8Array(16);
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      Crypto.getRandomBytesAsync.mockResolvedValueOnce(mockRandomBytes);
      bip39.entropyToMnemonic.mockReturnValueOnce(mockMnemonic);
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await generateWallet(5);

      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 5);
    });

    it('should throw error if wallet generation fails', async () => {
      Crypto.getRandomBytesAsync.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(generateWallet()).rejects.toThrow('Failed to generate wallet: Crypto error');
    });
  });

  describe('importWallet', () => {
    it('should import wallet from valid mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      bip39.validateMnemonic.mockReturnValueOnce(true);
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await importWallet(mnemonic);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(bip39.validateMnemonic).toHaveBeenCalledWith(mnemonic);
      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 0);
    });

    it('should normalize and trim mnemonic before validation', async () => {
      const mnemonic = '  ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABOUT  ';
      const normalized = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      bip39.validateMnemonic.mockReturnValueOnce(true);
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic);

      expect(bip39.validateMnemonic).toHaveBeenCalledWith(normalized);
      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(normalized, 0);
    });

    it('should import wallet with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      bip39.validateMnemonic.mockReturnValueOnce(true);
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic, 3);

      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 3);
    });

    it('should throw error for invalid mnemonic', async () => {
      const invalidMnemonic = 'invalid mnemonic phrase';

      bip39.validateMnemonic.mockReturnValueOnce(false);

      await expect(importWallet(invalidMnemonic)).rejects.toThrow(
        'Invalid seed phrase. Please check and try again.'
      );
    });
  });

  describe('loadWalletFromStorage', () => {
    it('should load wallet from storage and derive addresses', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.getCurrentAccount.mockResolvedValueOnce(0);
      SecureStorageService.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });

      expect(SecureStorageService.getCurrentAccount).toHaveBeenCalled();
      expect(SecureStorageService.withMnemonic).toHaveBeenCalled();
    });

    it('should return null addresses if no mnemonic in storage', async () => {
      SecureStorageService.getCurrentAccount.mockResolvedValueOnce(0);
      SecureStorageService.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(null);
      });

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: null,
        accountIndex: 0,
      });
    });

    it('should throw error if loading fails', async () => {
      SecureStorageService.getCurrentAccount.mockRejectedValueOnce(new Error('Storage error'));

      await expect(loadWalletFromStorage()).rejects.toThrow(
        'Failed to load wallet from storage: Storage error'
      );
    });
  });

  describe('switchToAccount', () => {
    it('should switch to a different account', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      SecureStorageService.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await switchToAccount(2);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 2);
      expect(SecureStorageService.saveCurrentAccount).toHaveBeenCalledWith(2);
    });

    it('should throw error if mnemonic cannot be retrieved', async () => {
      SecureStorageService.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(null);
      });

      await expect(switchToAccount(1)).rejects.toThrow(
        'Failed to switch account: Failed to retrieve wallet from secure storage'
      );
    });

    it('should throw error if account save fails', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      SecureStorageService.saveCurrentAccount.mockRejectedValueOnce(new Error('Save error'));

      await expect(switchToAccount(1)).rejects.toThrow('Failed to switch account: Save error');
    });
  });

  describe('saveWalletToStorage', () => {
    it('should save wallet mnemonic and account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.saveMnemonic.mockResolvedValueOnce(true);
      SecureStorageService.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await saveWalletToStorage(mnemonic, 0);

      expect(result).toBe(true);
      expect(SecureStorageService.saveMnemonic).toHaveBeenCalledWith(mnemonic);
      expect(SecureStorageService.saveCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should save with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.saveMnemonic.mockResolvedValueOnce(true);
      SecureStorageService.saveCurrentAccount.mockResolvedValueOnce(true);

      await saveWalletToStorage(mnemonic, 5);

      expect(SecureStorageService.saveCurrentAccount).toHaveBeenCalledWith(5);
    });

    it('should return false if mnemonic save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.saveMnemonic.mockResolvedValueOnce(false);
      SecureStorageService.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });

    it('should return false if account save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.saveMnemonic.mockResolvedValueOnce(true);
      SecureStorageService.saveCurrentAccount.mockResolvedValueOnce(false);

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      SecureStorageService.saveMnemonic.mockRejectedValueOnce(new Error('Storage error'));

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });
  });
});
