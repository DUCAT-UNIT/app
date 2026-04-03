/**
 * Tests for cryptoHelpers utilities
 */

// Mock dependencies BEFORE imports
jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

jest.mock('bip32', () => ({
  BIP32Factory: jest.fn(() => ({
    fromSeed: jest.fn(() => ({
      derivePath: jest.fn(() => ({
        publicKey: Buffer.alloc(33),
        privateKey: Buffer.alloc(32),
      })),
    })),
  })),
}));

jest.mock('ecpair', () => jest.fn(() => ({
  fromPrivateKey: jest.fn(() => ({
    publicKey: Buffer.alloc(33),
  })),
})));

jest.mock('../../bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
}));

import * as bip39 from 'bip39';
import {
  writeVarInt,
  varIntSize,
  deriveKeyFromMnemonic,
  getDerivationPath,
  getECPair,
  bip32,
} from '../cryptoHelpers';

describe('cryptoHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('writeVarInt', () => {
    it('should write single byte for values < 0xfd', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 100, 0);

      expect(offset).toBe(1);
      expect(buffer[0]).toBe(100);
    });

    it('should write 3 bytes for values 0xfd to 0xffff', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0x1000, 0);

      expect(offset).toBe(3);
      expect(buffer[0]).toBe(0xfd);
    });

    it('should write 5 bytes for values 0x10000 to 0xffffffff', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0x10000, 0);

      expect(offset).toBe(5);
      expect(buffer[0]).toBe(0xfe);
    });

    it('should handle boundary value 0xfc', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0xfc, 0);

      expect(offset).toBe(1);
      expect(buffer[0]).toBe(0xfc);
    });

    it('should handle boundary value 0xfd', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0xfd, 0);

      expect(offset).toBe(3);
      expect(buffer[0]).toBe(0xfd);
    });

    it('should handle boundary value 0xffff', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0xffff, 0);

      expect(offset).toBe(3);
      expect(buffer[0]).toBe(0xfd);
    });

    it('should handle boundary value 0x10000', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0x10000, 0);

      expect(offset).toBe(5);
      expect(buffer[0]).toBe(0xfe);
    });

    it('should handle boundary value 0xffffffff', () => {
      const buffer = Buffer.alloc(10);
      const offset = writeVarInt(buffer, 0xffffffff, 0);

      expect(offset).toBe(5);
      expect(buffer[0]).toBe(0xfe);
    });
  });

  describe('varIntSize', () => {
    it('should return 1 for values < 0xfd', () => {
      expect(varIntSize(0)).toBe(1);
      expect(varIntSize(100)).toBe(1);
      expect(varIntSize(0xfc)).toBe(1);
    });

    it('should return 3 for values 0xfd to 0xffff', () => {
      expect(varIntSize(0xfd)).toBe(3);
      expect(varIntSize(0x1000)).toBe(3);
      expect(varIntSize(0xffff)).toBe(3);
    });

    it('should return 5 for values 0x10000 to 0xffffffff', () => {
      expect(varIntSize(0x10000)).toBe(5);
      expect(varIntSize(0x100000)).toBe(5);
      expect(varIntSize(0xffffffff)).toBe(5);
    });
  });

  describe('deriveKeyFromMnemonic', () => {
    it('should derive key from mnemonic using correct path (lines 68-70)', () => {
      const mnemonic = 'test mnemonic phrase';
      const path = "m/86'/1'/0'/0/0";

      const result = deriveKeyFromMnemonic(mnemonic, path);

      expect(bip39.mnemonicToSeedSync).toHaveBeenCalledWith(mnemonic);
      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('privateKey');
    });

    it('should use MUTINYNET_NETWORK for derivation', () => {
      const mnemonic = 'test mnemonic';
      const path = "m/84'/1'/0'/0/0";

      deriveKeyFromMnemonic(mnemonic, path);

      // Verify mnemonicToSeedSync was called
      expect(bip39.mnemonicToSeedSync).toHaveBeenCalled();
    });
  });

  describe('getDerivationPath', () => {
    it('should return BIP84 path for SegWit addresses (tb1q)', () => {
      const path = getDerivationPath('tb1qtest123', 5);
      expect(path).toBe("m/84'/1'/5'/0/0");
    });

    it('should return BIP86 path for Taproot addresses (tb1p)', () => {
      const path = getDerivationPath('tb1ptest123', 10);
      expect(path).toBe("m/86'/1'/10'/0/0");
    });

    it('should return path for account index 0', () => {
      const path = getDerivationPath('tb1qaddress', 0);
      expect(path).toBe("m/84'/1'/0'/0/0");
    });

    it('should throw error for unsupported address type', () => {
      expect(() => {
        getDerivationPath('bc1qmainnet', 0);
      }).toThrow('Unsupported address type: bc1qmainnet');
    });

    it('should throw error for legacy addresses', () => {
      expect(() => {
        getDerivationPath('mlegacyaddress', 0);
      }).toThrow('Unsupported address type: mlegacyaddress');
    });
  });

  describe('getECPair', () => {
    it('should return ECPair factory', () => {
      const ecpair = getECPair();
      expect(ecpair).toBeDefined();
      expect(ecpair).toHaveProperty('fromPrivateKey');
    });

    it('should return cached ECPair on subsequent calls', () => {
      const ecpair1 = getECPair();
      const ecpair2 = getECPair();
      expect(ecpair1).toBe(ecpair2);
    });
  });
});
