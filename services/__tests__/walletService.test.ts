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
import * as WalletDerivationService from '../walletDerivationService';

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
jest.mock('../walletDerivationService', () => ({
  getWalletDerivationMode: jest.fn(),
  setWalletDerivationMode: jest.fn(),
}));

// Typed mock references
const mockCrypto = jest.requireMock('expo-crypto') as { getRandomBytesAsync: jest.Mock };
const mockBip39 = jest.requireMock('bip39') as { entropyToMnemonic: jest.Mock; validateMnemonic: jest.Mock };
const mockBitcoin = jest.requireMock('../../utils/bitcoin') as { deriveAddressesFromMnemonic: jest.Mock };
const mockSecureStorage = SecureStorageService as jest.Mocked<typeof SecureStorageService>;
const mockWalletDerivation = WalletDerivationService as jest.Mocked<typeof WalletDerivationService>;
const NEW_MODE = 'bip44_account';
const LEGACY_MODE = 'legacy_address_index';

describe('walletService', () => {
  const mockAddresses = {
    segwitAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    taprootAddress: 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
    segwitPubkey: 'mockSegwitPubkey',
    taprootPubkey: 'mockTaprootPubkey',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletDerivation.getWalletDerivationMode.mockResolvedValue(LEGACY_MODE);
    mockWalletDerivation.setWalletDerivationMode.mockResolvedValue(undefined);
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
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 0, NEW_MODE);
    });

    it('should generate wallet with custom account index', async () => {
      const mockRandomBytes = new Uint8Array(16);
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockCrypto.getRandomBytesAsync.mockResolvedValueOnce(mockRandomBytes);
      mockBip39.entropyToMnemonic.mockReturnValueOnce(mockMnemonic);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await generateWallet(5);

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 5, NEW_MODE);
    });

    it('should throw error if wallet generation fails', async () => {
      mockCrypto.getRandomBytesAsync.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(generateWallet()).rejects.toThrow('Failed to generate wallet: Crypto error');
    });

    it('should reject invalid account indexes before generating entropy', async () => {
      await expect(generateWallet(-1)).rejects.toThrow(
        'Failed to generate wallet: Invalid account index: -1'
      );

      expect(mockCrypto.getRandomBytesAsync).not.toHaveBeenCalled();
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
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 0, NEW_MODE);
    });

    it('should normalize and trim mnemonic before validation', async () => {
      const mnemonic = '  ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABOUT  ';
      const normalized = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockBip39.validateMnemonic.mockReturnValueOnce(true);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic);

      expect(mockBip39.validateMnemonic).toHaveBeenCalledWith(normalized);
      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(normalized, 0, NEW_MODE);
    });

    it('should import wallet with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockBip39.validateMnemonic.mockReturnValueOnce(true);
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);

      await importWallet(mnemonic, 3);

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mnemonic, 3, NEW_MODE);
    });

    it('should throw error for invalid mnemonic', async () => {
      const invalidMnemonic = 'invalid mnemonic phrase';

      mockBip39.validateMnemonic.mockReturnValueOnce(false);

      await expect(importWallet(invalidMnemonic)).rejects.toThrow(
        'Invalid seed phrase. Please check and try again.'
      );
    });

    it('should reject invalid account indexes before validating mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      await expect(importWallet(mnemonic, -1)).rejects.toThrow('Invalid account index: -1');

      expect(mockBip39.validateMnemonic).not.toHaveBeenCalled();
    });
  });

  describe('loadWalletFromStorage', () => {
    it('should load wallet from multi-account cache when available', async () => {
      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(mockAddresses);

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });

      expect(mockSecureStorage.getCurrentAccount).toHaveBeenCalled();
      expect(mockSecureStorage.getMultiAccountCache).toHaveBeenCalledWith(0);
      expect(mockSecureStorage.withMnemonic).not.toHaveBeenCalled();
    });

    it('should load wallet from single-account cache when multi-account cache misses', async () => {
      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.getCachedAddresses.mockResolvedValueOnce(mockAddresses);
      mockSecureStorage.saveToMultiAccountCache.mockResolvedValueOnce(true);

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });

      expect(mockSecureStorage.getCachedAddresses).toHaveBeenCalledWith(0);
    });

    it('should continue even if saveToMultiAccountCache fails when loading from single cache', async () => {
      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.getCachedAddresses.mockResolvedValueOnce(mockAddresses);
      // saveToMultiAccountCache fails but should not break the flow
      mockSecureStorage.saveToMultiAccountCache.mockRejectedValueOnce(new Error('Cache write error'));

      const result = await loadWalletFromStorage();

      // Should still succeed even if caching fails
      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });
    });

    it('should derive addresses when all caches miss', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.getCachedAddresses.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCachedAddresses.mockResolvedValueOnce(true);
      mockSecureStorage.saveToMultiAccountCache.mockResolvedValueOnce(true);

      const result = await loadWalletFromStorage();

      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });

      expect(mockSecureStorage.withMnemonic).toHaveBeenCalled();
    });

    it('should continue even if caching derived addresses fails', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.getCachedAddresses.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      // Both cache saves fail
      mockSecureStorage.saveCachedAddresses.mockRejectedValueOnce(new Error('Cache error'));
      mockSecureStorage.saveToMultiAccountCache.mockRejectedValueOnce(new Error('Cache error'));

      const result = await loadWalletFromStorage();

      // Should still return the derived addresses even if caching fails
      expect(result).toEqual({
        addresses: mockAddresses,
        accountIndex: 0,
      });
    });

    it('should return null addresses if no mnemonic in storage', async () => {
      mockSecureStorage.getCurrentAccount.mockResolvedValueOnce(0);
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.getCachedAddresses.mockResolvedValueOnce(null);
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
    it('should reject invalid account indexes before loading wallet data', async () => {
      await expect(switchToAccount(-1)).rejects.toThrow(
        'Failed to switch account: Invalid account index: -1'
      );

      expect(mockWalletDerivation.getWalletDerivationMode).not.toHaveBeenCalled();
      expect(mockSecureStorage.getMultiAccountCache).not.toHaveBeenCalled();
      expect(mockSecureStorage.withMnemonic).not.toHaveBeenCalled();
    });

    it('should switch using cache when addresses are cached (fast path)', async () => {
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      const result = await switchToAccount(2);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(mockSecureStorage.getMultiAccountCache).toHaveBeenCalledWith(2);
      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(2);
      // Should NOT derive addresses when cache hit
      expect(mockSecureStorage.withMnemonic).not.toHaveBeenCalled();
    });

    it('should throw if saveCurrentAccount fails when using cache', async () => {
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockRejectedValueOnce(new Error('Account save error'));

      await expect(switchToAccount(2)).rejects.toThrow(
        'Failed to switch account: Account save error'
      );
    });

    it('should throw if saveCurrentAccount returns false when using cache', async () => {
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(false);

      await expect(switchToAccount(2)).rejects.toThrow(
        'Failed to switch account: Failed to save current account securely'
      );
    });

    it('should derive addresses when cache misses (slow path)', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);
      mockSecureStorage.saveCachedAddresses.mockResolvedValueOnce(true);
      mockSecureStorage.saveToMultiAccountCache.mockResolvedValueOnce(true);

      const result = await switchToAccount(2);

      expect(result).toEqual({
        addresses: mockAddresses,
      });

      expect(mockBitcoin.deriveAddressesFromMnemonic).toHaveBeenCalledWith(mockMnemonic, 2, LEGACY_MODE);
      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(2);
      expect(mockSecureStorage.saveToMultiAccountCache).toHaveBeenCalledWith(2, mockAddresses);
    });

    it('should throw error if mnemonic cannot be retrieved on cache miss', async () => {
      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(null as unknown as string);
      });

      await expect(switchToAccount(1)).rejects.toThrow(
        'Failed to switch account: Failed to retrieve wallet from secure storage'
      );
    });

    it('should throw error if account save fails after derivation', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockRejectedValueOnce(new Error('Save error'));

      await expect(switchToAccount(1)).rejects.toThrow('Failed to switch account: Save error');
    });

    it('should throw error if account save returns false after derivation', async () => {
      const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.getMultiAccountCache.mockResolvedValueOnce(null);
      mockSecureStorage.withMnemonic.mockImplementationOnce(async (callback) => {
        return callback(mockMnemonic);
      });
      mockBitcoin.deriveAddressesFromMnemonic.mockReturnValueOnce(mockAddresses);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(false);

      await expect(switchToAccount(1)).rejects.toThrow(
        'Failed to switch account: Failed to save current account securely'
      );
    });
  });

  describe('saveWalletToStorage', () => {
    it('should reject invalid account indexes before saving mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      await expect(saveWalletToStorage(mnemonic, -1)).rejects.toThrow('Invalid account index: -1');

      expect(mockSecureStorage.saveMnemonic).not.toHaveBeenCalled();
      expect(mockWalletDerivation.setWalletDerivationMode).not.toHaveBeenCalled();
    });

    it('should save wallet mnemonic and account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(undefined);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      await expect(saveWalletToStorage(mnemonic, 0)).resolves.toBeUndefined();
      expect(mockSecureStorage.saveMnemonic).toHaveBeenCalledWith(mnemonic);
      expect(mockWalletDerivation.setWalletDerivationMode).toHaveBeenCalledWith(NEW_MODE);
      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should save with custom account index', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(undefined);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(true);

      await saveWalletToStorage(mnemonic, 5);

      expect(mockSecureStorage.saveCurrentAccount).toHaveBeenCalledWith(5);
    });

    it('should throw error if mnemonic save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockRejectedValueOnce(new Error('Failed to save wallet securely'));

      await expect(saveWalletToStorage(mnemonic)).rejects.toThrow('Failed to save wallet securely');
    });

    it('should throw error if account save fails', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(undefined);
      mockSecureStorage.saveCurrentAccount.mockRejectedValueOnce(new Error('Storage error'));

      await expect(saveWalletToStorage(mnemonic)).rejects.toThrow();
    });

    it('should throw error if account save returns false', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockResolvedValueOnce(undefined);
      mockSecureStorage.saveCurrentAccount.mockResolvedValueOnce(false);

      await expect(saveWalletToStorage(mnemonic)).rejects.toThrow(
        'Failed to save current account securely'
      );
      expect(mockBitcoin.deriveAddressesFromMnemonic).not.toHaveBeenCalled();
      expect(mockSecureStorage.saveCachedAddresses).not.toHaveBeenCalled();
      expect(mockSecureStorage.saveToMultiAccountCache).not.toHaveBeenCalled();
    });

    it('should throw error on storage error', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      mockSecureStorage.saveMnemonic.mockRejectedValueOnce(new Error('Storage error'));

      await expect(saveWalletToStorage(mnemonic)).rejects.toThrow();
    });
  });
});
