/**
 * Edge case tests for keyDerivation utilities
 * Tests odd Y coordinate handling, cache expiry, and boundary conditions
 */

// Mock dependencies BEFORE imports
jest.mock('bitcoinjs-lib', () => {
  const { Buffer: B } = require('buffer');
  return {
    payments: {
      p2tr: jest.fn(),
      p2wpkh: jest.fn(),
    },
    crypto: {
      taggedHash: jest.fn(() => B.alloc(32)),
    },
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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

jest.mock('../cryptoHelpers', () => {
  const { Buffer: B } = require('buffer');
  return {
    bip32: {
      fromSeed: jest.fn(),
    },
    ecc: {
      privateAdd: jest.fn(() => B.alloc(32)),
      privateNegate: jest.fn(() => B.alloc(32)),
    },
    getECPair: jest.fn(() => ({
      fromPrivateKey: jest.fn(() => ({
        publicKey: B.alloc(33),
      })),
    })),
    getDerivationPath: jest.fn((_address: string, accountIndex: number) => `m/86'/1'/0'/0/${accountIndex}`),
  };
});

jest.mock('bip39', () => {
  const { Buffer: B } = require('buffer');
  return {
    mnemonicToSeedSync: jest.fn(() => B.alloc(64)),
  };
});

import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as bitcoin from 'bitcoinjs-lib';
import { withMnemonic } from '../../../services/secureStorageService';
import {
  getPrivateKeyForAddress,
  purgeExpiredKeys,
  clearAllDerivedKeys,
} from '../keyDerivation';

describe('keyDerivation - Edge Cases', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearAllDerivedKeys(); // Reset in-memory cache between tests
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('In-memory cache behavior', () => {
    it('should use cached result on second call for same address', async () => {
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
        address: 'tb1pcachetest',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // First call — derives from mnemonic
      await getPrivateKeyForAddress('tb1pcachetest');
      expect(withMnemonic).toHaveBeenCalledTimes(1);

      // Second call — should use in-memory cache, not call withMnemonic again
      (withMnemonic as jest.Mock).mockClear();
      await getPrivateKeyForAddress('tb1pcachetest');
      expect(withMnemonic).not.toHaveBeenCalled();
    });

    it('should not write cached keys to SecureStore', async () => {
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
        address: 'tb1pnosecurestore',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      await getPrivateKeyForAddress('tb1pnosecurestore');

      // Memory-only cache: no SecureStore writes for key material
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should re-derive after clearAllDerivedKeys', async () => {
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
        address: 'tb1prederive',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // First call — derives
      await getPrivateKeyForAddress('tb1prederive');
      expect(withMnemonic).toHaveBeenCalledTimes(1);

      // Clear cache
      await clearAllDerivedKeys();

      // Second call — must re-derive
      (withMnemonic as jest.Mock).mockClear();
      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });
      await getPrivateKeyForAddress('tb1prederive');
      expect(withMnemonic).toHaveBeenCalledTimes(1);
    });
  });

  describe('Odd Y coordinate handling (Taproot)', () => {
    it('should negate private key when public key has odd Y coordinate (0x03 prefix)', async () => {
      const mockChild = {
        publicKey: Buffer.concat([Buffer.from([0x03]), Buffer.alloc(32, 0xaa)]), // Odd Y!
        privateKey: Buffer.alloc(32, 0xbb),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32, ecc } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1poddY',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1poddY');

      expect(ecc.privateNegate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should NOT negate private key when public key has even Y coordinate (0x02 prefix)', async () => {
      const mockChild = {
        publicKey: Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0xaa)]), // Even Y!
        privateKey: Buffer.alloc(32, 0xbb),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32, ecc } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pevenY',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      const result = await getPrivateKeyForAddress('tb1pevenY');

      expect(ecc.privateNegate).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error when privateNegate returns null', async () => {
      const mockChild = {
        publicKey: Buffer.concat([Buffer.from([0x03]), Buffer.alloc(32, 0xaa)]), // Odd Y
        privateKey: Buffer.alloc(32, 0xbb),
      };

      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };

      const { bip32, ecc } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);
      ecc.privateNegate.mockReturnValue(null); // Negate fails!

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pfailnegate',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      await expect(getPrivateKeyForAddress('tb1pfailnegate')).rejects.toThrow(
        'Failed to negate internal private key'
      );
    });
  });

  describe('purgeExpiredKeys (memory-only)', () => {
    it('should not throw when called with empty cache', async () => {
      await clearAllDerivedKeys(); // ensure clean state
      await purgeExpiredKeys();
      // No error = pass
    });
  });

  describe('clearAllDerivedKeys (memory-only)', () => {
    it('should clear cached keys so next call re-derives', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };
      const mockRoot = { derivePath: jest.fn(() => mockChild) };
      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pcleartest',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // First call populates cache
      await getPrivateKeyForAddress('tb1pcleartest');
      expect(withMnemonic).toHaveBeenCalledTimes(1);

      // Clear cache
      await clearAllDerivedKeys();

      // Second call must re-derive
      (withMnemonic as jest.Mock).mockClear();
      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });
      await getPrivateKeyForAddress('tb1pcleartest');
      expect(withMnemonic).toHaveBeenCalledTimes(1);
    });

    it('should not throw on double clear', async () => {
      await clearAllDerivedKeys();
      await clearAllDerivedKeys();
    });
  });

  describe('Boundary account index', () => {
    it('should search up to account 100 by default', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const derivedAccounts: number[] = [];
      const mockRoot = {
        derivePath: jest.fn((path: string) => {
          const match = path.match(/(\d+)$/);
          if (match) derivedAccounts.push(parseInt(match[1], 10));
          return mockChild;
        }),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pdifferent',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      await expect(getPrivateKeyForAddress('tb1pnotfound')).rejects.toThrow('not found in first 100 accounts');

      // Should have tried 100 accounts
      expect(derivedAccounts.length).toBe(100);
    });

    it('should expand search range when known account index is high', async () => {
      const mockChild = {
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      };

      const derivedAccounts: number[] = [];
      const mockRoot = {
        derivePath: jest.fn((path: string) => {
          const match = path.match(/(\d+)$/);
          if (match) derivedAccounts.push(parseInt(match[1], 10));
          return mockChild;
        }),
      };

      const { bip32 } = require('../cryptoHelpers');
      bip32.fromSeed.mockReturnValue(mockRoot);

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1pdifferent',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // Known account 150 - should search up to 160 (150 + 10)
      await expect(getPrivateKeyForAddress('tb1pnotfound', 150)).rejects.toThrow();

      // Should have tried 160 accounts (0 through 159)
      expect(derivedAccounts.length).toBe(160);
      expect(Math.max(...derivedAccounts)).toBe(159);
    });
  });

  describe('Memory cache miss behavior', () => {
    it('should derive from mnemonic on cache miss', async () => {
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
        address: 'tb1pmiss',
        pubkey: Buffer.alloc(32),
      });

      (withMnemonic as jest.Mock).mockImplementation(async (callback: (m: string) => Promise<unknown>) => {
        return callback('test mnemonic');
      });

      // No cache entry — should derive from mnemonic
      const result = await getPrivateKeyForAddress('tb1pmiss');
      expect(result).toBeDefined();
      expect(withMnemonic).toHaveBeenCalledTimes(1);
      // No SecureStore reads for cache
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });
  });
});
