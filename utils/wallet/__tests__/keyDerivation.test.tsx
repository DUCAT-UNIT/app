// @ts-nocheck
/**
 * Tests for keyDerivation utilities
 */

// Mock dependencies BEFORE imports
jest.mock('bitcoinjs-lib', () => ({
  payments: {
    p2tr: jest.fn(),
    p2wpkh: jest.fn(),
  },
  crypto: {
    taggedHash: jest.fn(() => Buffer.alloc(32)),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('../../bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
}));

jest.mock('../../../services/secureStorageService', () => ({
  withMnemonic: jest.fn(),
}));

jest.mock('../../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../cryptoHelpers', () => ({
  bip32: {
    fromSeed: jest.fn(),
  },
  ecc: {
    privateAdd: jest.fn(() => Buffer.alloc(32)),
  },
  getECPair: jest.fn(() => ({
    fromPrivateKey: jest.fn(() => ({
      publicKey: Buffer.alloc(33),
    })),
  })),
  getDerivationPath: jest.fn((address, accountIndex) => `m/86'/1'/0'/0/${accountIndex}`),
}));

jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

import * as SecureStore from 'expo-secure-store';
import * as bitcoin from 'bitcoinjs-lib';
import { withMnemonic } from '../../../services/secureStorageService';
import { getPrivateKeyForAddress } from '../keyDerivation';

describe('keyDerivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();
  });

  describe('getPrivateKeyForAddress', () => {
    it('should return cached key if available', async () => {
      const cachedData = {
        privateKey: 'cached_privkey',
        xOnlyPubkey: 'cached_pubkey',
        accountIndex: 5,
      };
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getPrivateKeyForAddress('tb1ptest123');

      expect(result).toEqual(cachedData);
      expect(withMnemonic).not.toHaveBeenCalled();
    });

    it('should search for account if not cached', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest123',
        pubkey: Buffer.alloc(32),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1ptest123');

      expect(withMnemonic).toHaveBeenCalled();
      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('xOnlyPubkey');
      expect(result).toHaveProperty('accountIndex');
    });

    it('should throw error if address not found in 50 accounts', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // Make p2tr return different address
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1pdifferent',
        pubkey: Buffer.alloc(32),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      await expect(getPrivateKeyForAddress('tb1pnotfound')).rejects.toThrow(
        'Address tb1pnotfound not found in first 100 accounts'
      );
    });

    it('should cache result after finding account', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest456',
        pubkey: Buffer.alloc(32),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      await getPrivateKeyForAddress('tb1ptest456');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringContaining('derived_key_'),
        expect.any(String)
      );
    });

    it('should handle cache read errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Cache read error'));

      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1perror',
        pubkey: Buffer.alloc(32),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      // Should not throw
      const result = await getPrivateKeyForAddress('tb1perror');
      expect(result).toBeDefined();
    });

    it('should handle cache write errors gracefully', async () => {
      SecureStore.setItemAsync.mockRejectedValue(new Error('Cache write error'));

      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1pwrite',
        pubkey: Buffer.alloc(32),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      // Should not throw
      const result = await getPrivateKeyForAddress('tb1pwrite');
      expect(result).toBeDefined();
    });

    it('should handle SegWit addresses (tb1q)', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32, getECPair } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // For SegWit, p2wpkh is used
      bitcoin.payments.p2wpkh.mockReturnValue({
        address: 'tb1qtest123',
        pubkey: Buffer.alloc(33),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1qtest123');

      expect(bitcoin.payments.p2wpkh).toHaveBeenCalled();
      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('xOnlyPubkey');
      expect(result).toHaveProperty('accountIndex');
    });

    it('should throw error when SegWit address not found in 50 accounts', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // Make p2wpkh return different address - tests findSegwitAccount returning null
      bitcoin.payments.p2wpkh.mockReturnValue({
        address: 'tb1qdifferent',
        pubkey: Buffer.alloc(33),
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      await expect(getPrivateKeyForAddress('tb1qnotfound')).rejects.toThrow(
        'Address tb1qnotfound not found in first 100 accounts'
      );
    });

    it('should handle Taproot account when payment.pubkey is undefined', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // Return undefined pubkey to test fallback to Buffer.alloc(0)
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1pnopubkey',
        pubkey: undefined,
      });

      withMnemonic.mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pnopubkey');

      expect(result).toHaveProperty('privateKey');
      expect(result.xOnlyPubkey).toBe(''); // Empty buffer toString('hex')
      expect(result).toHaveProperty('accountIndex');
    });
  });
});
