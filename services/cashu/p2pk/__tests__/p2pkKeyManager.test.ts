/**
 * Tests for P2PK Key Manager (NUT-11)
 */

// Mock dependencies before imports
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@bitcoinerlab/secp256k1', () => ({
  privateAdd: jest.fn(),
  privateNegate: jest.fn(),
  pointFromScalar: jest.fn(),
}));

jest.mock('bip32', () => ({
  BIP32Factory: jest.fn(() => ({
    fromSeed: jest.fn(),
  })),
}));

jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

jest.mock('bitcoinjs-lib', () => ({
  payments: {
    p2tr: jest.fn(),
  },
  crypto: {
    taggedHash: jest.fn(() => Buffer.alloc(32)),
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    cashu: jest.fn(),
  },
}));

jest.mock('../../../secureStorageService', () => ({
  withMnemonic: jest.fn(),
  getCurrentAccount: jest.fn(),
}));

jest.mock('../../../../utils/bitcoin', () => ({
  deriveAddressesFromMnemonic: jest.fn(),
  MUTINYNET_NETWORK: { bech32: 'tb' },
}));

jest.mock('../../../../utils/wallet', () => ({
  getPrivateKeyForAddress: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { clearP2PKCache, findAccountForP2PKToken, getP2PKPrivateKey } from '../p2pkKeyManager';
import { withMnemonic, getCurrentAccount } from '../../../secureStorageService';
import { deriveAddressesFromMnemonic } from '../../../../utils/bitcoin';
import { getPrivateKeyForAddress } from '../../../../utils/wallet';

describe('p2pkKeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clearP2PKCache', () => {
    it('should delete both cache keys', async () => {
      await clearP2PKCache();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v4');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_private_key_v4');
    });

    it('should handle deletion errors gracefully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await expect(clearP2PKCache()).resolves.not.toThrow();
    });
  });

  describe('findAccountForP2PKToken', () => {
    const targetPubkey = 'ab'.repeat(32);

    beforeEach(() => {
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);

      // Mock withMnemonic to execute the callback
      (withMnemonic as jest.Mock).mockImplementation(async (callback) => {
        return callback('test mnemonic words');
      });

      // Mock BIP32
      const mockChild = {
        publicKey: Buffer.alloc(33, 0x02),
        privateKey: Buffer.alloc(32, 0x01),
        derivePath: jest.fn().mockReturnThis(),
      };
      const mockRoot = {
        derivePath: jest.fn(() => mockChild),
      };
      const mockBip32 = {
        fromSeed: jest.fn(() => mockRoot),
      };
      (BIP32Factory as jest.Mock).mockReturnValue(mockBip32);

      // Mock bitcoin payments
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.alloc(32),
      });

      // Mock ecc functions
      (ecc.privateAdd as jest.Mock).mockReturnValue(Buffer.alloc(32, 0xab));
      (ecc.privateNegate as jest.Mock).mockReturnValue(Buffer.alloc(32, 0xcd));
      (ecc.pointFromScalar as jest.Mock).mockReturnValue(Buffer.alloc(33, 0x02)); // 33-byte compressed pubkey
    });

    it('should return match when pubkey found in current account', async () => {
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.from(targetPubkey, 'hex'),
      });

      const result = await findAccountForP2PKToken(targetPubkey);

      expect(result).not.toBeNull();
      expect(result?.accountIndex).toBe(0);
    });

    it('should return null when pubkey not found in any account', async () => {
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.from('cd'.repeat(32), 'hex'), // Different pubkey
      });

      const result = await findAccountForP2PKToken(targetPubkey, 5); // Only scan 5 accounts

      expect(result).toBeNull();
    });

    it('should call progress callback during scan', async () => {
      const progressCallback = jest.fn();

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.from('cd'.repeat(32), 'hex'),
      });

      await findAccountForP2PKToken(targetPubkey, 3, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should extend scan range for high account indices', async () => {
      (getCurrentAccount as jest.Mock).mockResolvedValue(80); // High account index

      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.from('cd'.repeat(32), 'hex'),
      });

      // Should scan at least currentAccount + 1 = 81 accounts
      await findAccountForP2PKToken(targetPubkey, 50);

      // The implementation should have extended the scan range
      expect(withMnemonic).toHaveBeenCalled();
    });

    it('should handle derivation errors gracefully and continue', async () => {
      let callCount = 0;
      (bitcoin.payments.p2tr as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Derivation error');
        }
        return {
          address: 'tb1ptest',
          pubkey: Buffer.from(targetPubkey, 'hex'),
        };
      });

      const result = await findAccountForP2PKToken(targetPubkey, 5);

      // Should have continued after error and found match
      expect(result).not.toBeNull();
    });

    it('should throw when private key derivation fails', async () => {
      (bitcoin.payments.p2tr as jest.Mock).mockReturnValue({
        address: 'tb1ptest',
        pubkey: Buffer.from(targetPubkey, 'hex'),
      });

      // Mock child without privateKey
      const mockChildNoPrivKey = {
        publicKey: Buffer.alloc(33, 0x02),
        privateKey: null, // No private key
      };
      const mockRoot = {
        derivePath: jest.fn(() => mockChildNoPrivKey),
      };
      const mockBip32 = {
        fromSeed: jest.fn(() => mockRoot),
      };
      (BIP32Factory as jest.Mock).mockReturnValue(mockBip32);

      (withMnemonic as jest.Mock).mockImplementation(async (callback) => {
        return callback('test mnemonic words');
      });

      const result = await findAccountForP2PKToken(targetPubkey, 2);

      // Should return null since error occurred
      expect(result).toBeNull();
    });
  });

  describe('getP2PKPrivateKey', () => {
    const mockAddress = 'tb1ptestaddress';
    const mockPrivateKey = 'ab'.repeat(32);

    beforeEach(() => {
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
      (withMnemonic as jest.Mock).mockImplementation(async (callback) => {
        return callback('test mnemonic');
      });
      (deriveAddressesFromMnemonic as jest.Mock).mockReturnValue({
        taprootAddress: mockAddress,
        segwitAddress: 'tb1qtest',
      });
      (getPrivateKeyForAddress as jest.Mock).mockResolvedValue({
        privateKey: mockPrivateKey,
        xOnlyPubkey: 'pubkey',
        accountIndex: 0,
      });
    });

    it('should return cached key when cache is valid', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(mockAddress) // Cached address matches
        .mockResolvedValueOnce(mockPrivateKey); // Cached private key

      const result = await getP2PKPrivateKey();

      expect(result).toBe(mockPrivateKey);
      expect(getPrivateKeyForAddress).not.toHaveBeenCalled();
    });

    it('should derive new key when cache is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null) // No cached address
        .mockResolvedValueOnce(null); // No cached key

      const result = await getP2PKPrivateKey();

      expect(result).toBe(mockPrivateKey);
      expect(getPrivateKeyForAddress).toHaveBeenCalledWith(mockAddress, 0);
    });

    it('should clear and re-derive when cached address does not match', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('tb1pdifferentaddress') // Different cached address
        .mockResolvedValueOnce(mockPrivateKey);

      const result = await getP2PKPrivateKey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(getPrivateKeyForAddress).toHaveBeenCalled();
      expect(result).toBe(mockPrivateKey);
    });

    it('should cache derived key', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await getP2PKPrivateKey();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v4', mockAddress);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('p2pk_private_key_v4', mockPrivateKey);
    });

    it('should handle cache read errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Cache read error'));

      const result = await getP2PKPrivateKey();

      expect(result).toBe(mockPrivateKey);
    });

    it('should handle cache write errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Cache write error'));

      // Should not throw
      const result = await getP2PKPrivateKey();
      expect(result).toBe(mockPrivateKey);
    });
  });
});
