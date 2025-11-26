// @ts-nocheck
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

// Typed mock references
const mockCrypto = jest.requireMock('expo-crypto') as { getRandomBytesAsync: jest.Mock };
const mockBip39 = jest.requireMock('bip39') as { entropyToMnemonic: jest.Mock; validateMnemonic: jest.Mock };
const mockBitcoin = jest.requireMock('../../utils/bitcoin') as { deriveAddressesFromMnemonic: jest.Mock };
const mockSecureStorage = SecureStorageService as jest.Mocked<typeof SecureStorageService>;

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

      mockCrypto.getRandomBytesAsync.mockResolvedValueOnce(mockRandomBytes);
      mockBip39.entropyToMnemonic.mockReturnValueOnce(mockMnemonic);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await generateWallet();

      expect(result).toEqual({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 0);
    });

    it('should generate wallet with custom account index', async () => {
      const mockRandomBytes = new Uint8Array(16);
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockCrypto.getRandomBytesAsync.mockResolvedValueOnce(mockRandomBytes);
      mockBip39.entropyToMnemonic.mockReturnValueOnce(mockMnemonic);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await generateWallet(5);

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 5);
    });

    it('should throw error if wallet generation fails', async () => {
      mockCrypto.getRandomBytesAsync.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(generateWallet()).rejects.toThrow('Failed to generate wallet: Crypto error');
    });
  });

  describe('importWallet', () => {
    it('should import wallet from valid mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockBip39.validateMnemonic.mockReturnValueOnce(true);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await importWallet(mnemonic);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(mockBip39.validateMnemonic).toHaveBeenCalledWith(mnemonic);
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 0);
    });

    it('should normalize and trim mnemonic before validation', async () => {
      const mnemonic = '  ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABOUT  ';
      const normalized = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockBip39.validateMnemonic.mockReturnValueOnce(true);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic);

      expect(mockBip39.validateMnemonic).toHaveBeenCalledWith(normalized);
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(normalized, 0);
    });

    it('should import wallet with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockBip39.validateMnemonic.mockReturnValueOnce(true);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic, 3);

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 3);
    });

    it('should throw error for invalid mnemonic', async () => {
      const invalidMnemonic = 'invalid mnemonic phrase';

      mockBip39.validateMnemonic.mockReturnValueOnce(false);

      await expect(importWallet(invalidMnemonic)).rejects.toThrow(
        'Invalid seed phrase. Please check and try again.'
      );
    });
  });

  describe('loadWalletFromStorage', () => {
    it('should load wallet from storage and derive addresses', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });

      expect(mockSecureStorage.getCurrentAccount).toHaveBeenCalled();
      expect(mockSecureStorage.withMnemonic).toHaveBeenCalled();
    });

    it('should return null addresses if no mnemonic in storage', async () => {
      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(null as unknown as string);
      });

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: null,
        accountIndex: 0,
      });
    });

    it('should throw error if loading fails', async () => {
      mockSecureStorage.getCurrentAccount.mockRejectedValueOnce(new Error('Storage error'));

      await expect(loadWalletFromStorage()).rejects.toThrow(
        'Failed to load wallet from storage: Storage error'
      );
    });
  });

  describe('switchToAccount', () => {
    it('should switch to a different account', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await switchToAccount(2);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 2);
      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(2);
    });

    it('should throw error if mnemonic cannot be retrieved', async () => {
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(null as unknown as string);
      });

      await expect(switchToAccount(1)).rejects.toThrow(
        'Failed to switch account: Failed to retrieve wallet from secure storage'
      );
    });

    it('should throw error if account save fails', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockRejectedValueOnce(new Error('Save error'));

      await expect(switchToAccount(1)).rejects.toThrow('Failed to switch account: Save error');
    });
  });

  describe('saveWalletToStorage', () => {
    it('should save wallet mnemonic and account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(true);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await saveWalletToStorage(mnemonic, 0);

      expect(result).toBe(true);
      expect(mockSecureStorage.saveMnemonic).toHaveBeenCalledWith(mnemonic);
      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should save with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(true);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      await saveWalletToStorage(mnemonic, 5);

      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(5);
    });

    it('should return false if mnemonic save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(false);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });

    it('should return false if account save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(true);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(false);

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockRejectedValueOnce(new Error('Storage error'));

      const result = await saveWalletToStorage(mnemonic);

      expect(result).toBe(false);
    });
  });
});
