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
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 8,
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

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

describe('keyDerivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getPrivateKeyForAddress', () => {
    it('should return cached key on second call', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };
      const mockRoot = { derivePath: jest.fn(() => mockChild) };
      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pcached',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // First call — derives from mnemonic
      const result1 = await getPrivateKeyForAddress('tb1pcached');
      expect(withMnemonic).toHaveBeenCalledTimes(1);

      // Second call — should use in-memory cache
      (withMnemonic as jest.Mock).mockClear();
      const result2 = await getPrivateKeyForAddress('tb1pcached');
      expect(withMnemonic).not.toHaveBeenCalled();
      expect(result2).toEqual(result1);
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

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest123',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
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
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pdifferent',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      await expect(getPrivateKeyForAddress('tb1pnotfound')).rejects.toThrow(
        'Address tb1pnotfound not found in first 100 accounts'
      );
    });

    it('should cache result in memory after finding account', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };
      const mockRoot = { derivePath: jest.fn(() => mockChild) };
      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest456',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1ptest456');
      expect(result).toHaveProperty('privateKey');

      // Verify no SecureStore writes (memory-only cache)
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
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
      (bitcoin.payments.p2wpkh as jest.Mock).mockReturnValue({
        address: 'tb1qtest123',
        pubkey: Buffer.alloc(33),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
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
      (bitcoin.payments.p2wpkh as jest.Mock).mockReturnValue({
        address: 'tb1qdifferent',
        pubkey: Buffer.alloc(33),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
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
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pnopubkey',
        pubkey: undefined,
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pnopubkey');

      expect(result).toHaveProperty('privateKey');
      expect(result.xOnlyPubkey).toBe(''); // Empty buffer toString('hex')
      expect(result).toHaveProperty('accountIndex');
    });

    it('should try known account index first for Taproot and return if found', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pknown',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pknown', 5);

      expect(result).toHaveProperty('accountIndex');
      expect(result.accountIndex).toBe(5);
    });

    it('should try known account index first for SegWit and return if found', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2wpkh as jest.Mock).mockReturnValue({
        address: 'tb1qknown',
        pubkey: Buffer.alloc(33),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1qknown', 3);

      expect(result).toHaveProperty('accountIndex');
      expect(result.accountIndex).toBe(3);
    });

    it('should fall back to search when known Taproot account does not match', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32, getDerivationPath } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // First call (known account) returns wrong address, subsequent calls find match
      let callCount = 0;
      (bitcoin.payments.p2tr as jest.Mock).mockImplementation(() => {
        callCount++;
        // First call is for known account (returns wrong),
        // second call (account 0, since we skip account 5) finds the address
        if (callCount === 1) {
          return { address: 'tb1pdifferent', pubkey: Buffer.alloc(32) };
        }
        return { address: 'tb1pfallback', pubkey: Buffer.alloc(32) };
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pfallback', 5);

      // Should have found it via fallback search, not from known account
      expect(result).toHaveProperty('privateKey');
      expect(result.accountIndex).toBe(0); // Found at account 0 (first account searched after skipping 5)
    });

    it('should fall back to search when known SegWit account does not match', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      let callCount = 0;
      (bitcoin.payments.p2wpkh as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { address: 'tb1qdifferent', pubkey: Buffer.alloc(33) };
        }
        return { address: 'tb1qfallback', pubkey: Buffer.alloc(33) };
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1qfallback', 2);

      expect(result).toHaveProperty('privateKey');
      expect(result.accountIndex).toBe(0); // Found at account 0
    });

    it('should skip known account index during fallback search to avoid double-checking', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const derivedPaths: string[] = [];
      const mockRoot = {
        derivePath: jest.fn((path: string) => {
          derivedPaths.push(path);
          return mockChild;
        }),
      };

      const { bip32, getDerivationPath } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      // Make it find match at account 1
      let callCount = 0;
      (bitcoin.payments.p2tr as jest.Mock).mockImplementation(() => {
        callCount++;
        // First call: known account (0) - wrong address
        // Second call: account 0 in loop - but this is skipped!
        // So second call is actually account 1 - finds match
        if (callCount <= 1) {
          return { address: 'tb1pdifferent', pubkey: Buffer.alloc(32) };
        }
        return { address: 'tb1pskiptest', pubkey: Buffer.alloc(32) };
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pskiptest', 0);

      // Known account 0 was tried first and failed
      // Then loop starts at 0, but skips 0, goes to 1 where it finds match
      expect(result.accountIndex).toBe(1);
    });
  });
});
