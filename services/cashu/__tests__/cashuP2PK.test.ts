// @ts-nocheck
/**
 * Tests for cashuP2PK service
 */

// Mock dependencies BEFORE imports
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digest: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('@noble/secp256k1', () => ({
  schnorr: {
    getPublicKey: jest.fn(() => new Uint8Array(32).fill(0xab)),
    verify: jest.fn(() => true),
  },
}));

jest.mock('@bitcoinerlab/secp256k1', () => ({
  signSchnorr: jest.fn(() => new Uint8Array(64).fill(0xcd)),
  privateAdd: jest.fn(() => Buffer.alloc(32, 0xef)),
}));

jest.mock('react-native-quick-crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => Buffer.alloc(32)),
  })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
    security: jest.fn(),
    screen: jest.fn(),
    action: jest.fn(),
    wallet: jest.fn(),
    cashu: jest.fn(),
    api: jest.fn(),
    auth: jest.fn(),
    perf: jest.fn(),
    turbo: jest.fn(),
    vault: jest.fn(),
    onboarding: jest.fn(),
    startTransaction: jest.fn().mockReturnValue({ finish: jest.fn() }),
    setContext: jest.fn(),
    setTag: jest.fn(),
  },
}));

// Mock cashuCrypto for hasP2PKProofs
jest.mock('../crypto', () => ({
  decodeToken: jest.fn(),
}));

// Mock expo-secure-store for clearP2PKCache and getP2PKPrivateKey
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock secureStorageService for findAccountForP2PKToken and getP2PKPrivateKey
jest.mock('../../secureStorageService', () => ({
  withMnemonic: jest.fn(async (callback) => await callback('test mnemonic')),
  getCurrentAccount: jest.fn().mockResolvedValue(0),
}));

// Mock bitcoin utilities
jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
  deriveAddressesFromMnemonic: jest.fn().mockResolvedValue({
    taprootAddress: 'tb1ptest123',
    segwitAddress: 'tb1qtest123',
  }),
}));

// Mock wallet utilities
jest.mock('../../../utils/wallet', () => ({
  getPrivateKeyForAddress: jest.fn().mockResolvedValue({
    privateKey: 'derived_private_key_hex',
    xOnlyPubkey: 'derived_pubkey_hex',
    accountIndex: 0,
  }),
}));

// Mock bip32 factory
jest.mock('bip32', () => ({
  BIP32Factory: jest.fn(() => ({
    fromSeed: jest.fn(() => ({
      derivePath: jest.fn(() => ({
        publicKey: Buffer.alloc(33, 0x02),
        privateKey: Buffer.alloc(32, 0x01),
      })),
    })),
  })),
}));

// Mock bip39
jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

// Mock bitcoinjs-lib
jest.mock('bitcoinjs-lib', () => ({
  payments: {
    p2tr: jest.fn(() => ({
      address: 'tb1ptest123',
      pubkey: Buffer.alloc(32, 0xab),
    })),
  },
  crypto: {
    taggedHash: jest.fn(() => Buffer.alloc(32, 0x01)),
  },
}));

import * as crypto from 'expo-crypto';
import * as ecc from '@bitcoinerlab/secp256k1';
import { schnorr } from '@noble/secp256k1';
import createHash from 'react-native-quick-crypto';
import {
  generateP2PKKeyPair,
  createP2PKSecret,
  signP2PKSecret,
  isP2PKSecret,
  getP2PKRecipient,
  verifyP2PKWitness,
  isP2PKLocked,
  hasP2PKProofs,
  signP2PKProofs,
  clearP2PKCache,
  findAccountForP2PKToken,
  getP2PKPrivateKey,
} from '../p2pk';
import * as SecureStore from 'expo-secure-store';

describe('cashuP2PK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(1));
    // Reset signSchnorr to default successful implementation
    (ecc.signSchnorr as jest.Mock).mockReset();
    (ecc.signSchnorr as jest.Mock).mockReturnValue(new Uint8Array(64).fill(0xcd));
  });

  describe('isP2PKSecret', () => {
    it('should return true for valid P2PK secret', () => {
      const p2pkSecret = JSON.stringify([
        'P2PK',
        {
          nonce: 'abc123',
          data: 'pubkey123',
          tags: [['sigflag', 'SIG_INPUTS']],
        },
      ]);

      expect(isP2PKSecret(p2pkSecret)).toBe(true);
    });

    it('should return false for non-P2PK secret', () => {
      const regularSecret = 'just-a-random-secret-string';

      expect(isP2PKSecret(regularSecret)).toBe(false);
    });

    it('should return false for array without P2PK marker', () => {
      const otherArray = JSON.stringify(['OTHER', { data: 'test' }]);

      expect(isP2PKSecret(otherArray)).toBe(false);
    });

    it('should return false for invalid JSON', () => {
      expect(isP2PKSecret('not json')).toBe(false);
      expect(isP2PKSecret('{invalid}')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isP2PKSecret('')).toBe(false);
    });

    it('should return false for non-array JSON', () => {
      expect(isP2PKSecret('{"type": "P2PK"}')).toBe(false);
    });
  });

  describe('getP2PKRecipient', () => {
    it('should extract recipient pubkey from P2PK secret', () => {
      const pubkey = 'abcdef1234567890abcdef1234567890';
      const p2pkSecret = JSON.stringify([
        'P2PK',
        {
          nonce: 'nonce123',
          data: pubkey,
        },
      ]);

      const recipient = getP2PKRecipient(p2pkSecret);

      expect(recipient).toBe(pubkey);
    });

    it('should return null for non-P2PK secret', () => {
      expect(getP2PKRecipient('regular-secret')).toBeNull();
    });

    it('should return null for invalid array structure', () => {
      const invalid = JSON.stringify(['NOT_P2PK', { data: 'test' }]);

      expect(getP2PKRecipient(invalid)).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(getP2PKRecipient('not json')).toBeNull();
    });
  });

  describe('isP2PKLocked', () => {
    it('should return true for proof with P2PK secret', () => {
      const proof = {
        amount: 100,
        C: 'signature',
        id: 'keysetid',
        secret: JSON.stringify([
          'P2PK',
          { nonce: 'n', data: 'pubkey' },
        ]),
      };

      expect(isP2PKLocked(proof)).toBe(true);
    });

    it('should return false for proof with regular secret', () => {
      const proof = {
        amount: 100,
        C: 'signature',
        id: 'keysetid',
        secret: 'regular-hex-secret',
      };

      expect(isP2PKLocked(proof)).toBe(false);
    });

    it('should return falsy for proof without secret', () => {
      const proof = {
        amount: 100,
        C: 'signature',
        id: 'keysetid',
        secret: '',
      };

      expect(isP2PKLocked(proof)).toBeFalsy();
    });

    it('should return falsy for proof with empty secret', () => {
      const proof = {
        amount: 100,
        secret: '',
        C: 'signature',
        id: 'keysetid',
      };

      expect(isP2PKLocked(proof)).toBeFalsy();
    });
  });

  describe('hasP2PKProofs', () => {
    const { decodeToken } = require('../crypto');

    it('should return true when token has P2PK proofs', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { secret: JSON.stringify(['P2PK', { data: 'pubkey' }]) },
          { secret: 'regular-secret' },
        ],
      });

      const result = hasP2PKProofs('cashuAtoken...');

      expect(result).toBe(true);
    });

    it('should return false when token has no P2PK proofs', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { secret: 'regular-secret-1' },
          { secret: 'regular-secret-2' },
        ],
      });

      const result = hasP2PKProofs('cashuAtoken...');

      expect(result).toBe(false);
    });

    it('should return false when proofs array is empty', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [],
      });

      const result = hasP2PKProofs('cashuAtoken...');

      expect(result).toBe(false);
    });

    it('should return false when proofs is undefined', () => {
      (decodeToken as jest.Mock).mockReturnValue({});

      const result = hasP2PKProofs('cashuAtoken...');

      expect(result).toBe(false);
    });

    it('should return false when decodeToken throws', () => {
      (decodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = hasP2PKProofs('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false when proofs is not array', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: 'not-an-array',
      });

      const result = hasP2PKProofs('cashuAtoken...');

      expect(result).toBe(false);
    });
  });

  describe('generateP2PKKeyPair', () => {
    it('should generate a keypair with privateKey and publicKey', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0xab));
      (schnorr.getPublicKey as jest.Mock).mockReturnValue(new Uint8Array(32).fill(0xcd));

      const result = await generateP2PKKeyPair();

      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('publicKey');
      expect(result!.privateKey).toBe('abababababababababababababababababababababababababababababababab');
      expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
      expect(schnorr.getPublicKey).toHaveBeenCalled();
    });
  });

  describe('createP2PKSecret', () => {
    it('should create a P2PK secret with default options', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));
      const recipientPubkey = 'abcd1234567890';

      const result = await createP2PKSecret(recipientPubkey);
      const parsed = JSON.parse(result);

      expect(parsed[0]).toBe('P2PK');
      expect(parsed[1].data).toBe(recipientPubkey);
      expect(parsed[1].nonce).toBeDefined();
      expect(parsed[1].tags).toContainEqual(['sigflag', 'SIG_INPUTS']);
    });

    it('should include custom sigflag', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { sigflag: 'SIG_ALL' });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['sigflag', 'SIG_ALL']);
    });

    it('should include additional pubkeys', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { pubkeys: ['pk1', 'pk2'] });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['pubkeys', 'pk1', 'pk2']);
    });

    it('should include n_sigs', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { n_sigs: 2 });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['n_sigs', '2']);
    });

    it('should include locktime', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { locktime: 1700000000 });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['locktime', '1700000000']);
    });

    it('should include refund pubkeys', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { refund: ['refund1', 'refund2'] });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['refund', 'refund1', 'refund2']);
    });

    it('should include n_sigs_refund', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', { n_sigs_refund: 1 });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags).toContainEqual(['n_sigs_refund', '1']);
    });

    it('should include all options together', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0x11));

      const result = await createP2PKSecret('pubkey123', {
        sigflag: 'SIG_ALL',
        pubkeys: ['pk1'],
        n_sigs: 2,
        locktime: 1700000000,
        refund: ['refund1'],
        n_sigs_refund: 1,
      });
      const parsed = JSON.parse(result);

      expect(parsed[1].tags.length).toBe(6);
    });
  });

  describe('signP2PKSecret', () => {
    it('should sign a P2PK secret and return witness', async () => {
      const secret = JSON.stringify(['P2PK', { nonce: 'abc', data: 'pubkey' }]);
      const privateKey = 'a'.repeat(64);

      const result = await signP2PKSecret(secret, privateKey);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('signatures');
      expect(parsed.signatures).toHaveLength(1);
      expect(ecc.signSchnorr).toHaveBeenCalled();
    });

    it('should accept Buffer private key', async () => {
      const secret = JSON.stringify(['P2PK', { nonce: 'abc', data: 'pubkey' }]);
      const privateKey = Buffer.alloc(32, 0xab);

      const result = await signP2PKSecret(secret, privateKey as any);

      expect(result).toBeDefined();
    });

    it('should throw enhanced error on signing failure', async () => {
      (ecc.signSchnorr as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signing failed');
      });

      const secret = JSON.stringify(['P2PK', { data: 'test' }]);
      const privateKey = 'a'.repeat(64);

      await expect(signP2PKSecret(secret, privateKey)).rejects.toThrow('P2PK signing failed');
    });

    it('should include diagnostics for null secret', async () => {
      (ecc.signSchnorr as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signing failed');
      });

      await expect(signP2PKSecret('' as any, 'a'.repeat(64))).rejects.toThrow('Secret is null/undefined');
    });

    it('should include diagnostics for null private key', async () => {
      (ecc.signSchnorr as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signing failed');
      });

      await expect(signP2PKSecret('secret', '' as any)).rejects.toThrow('Private key is null/undefined');
    });

    it('should include diagnostics for wrong private key length', async () => {
      (ecc.signSchnorr as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signing failed');
      });

      await expect(signP2PKSecret('secret', 'short')).rejects.toThrow('Expected 64 chars');
    });

    it('should include diagnostics for non-string private key', async () => {
      (ecc.signSchnorr as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signing failed');
      });

      await expect(signP2PKSecret('secret', 12345 as any)).rejects.toThrow('expected string');
    });

    it('should throw error for invalid hash length', async () => {
      // Override createHash mock to return wrong length
      const { createHash } = require('react-native-quick-crypto');
      (createHash as jest.Mock).mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => Buffer.alloc(16)), // Wrong length - should be 32
      });

      const secret = JSON.stringify(['P2PK', { nonce: 'abc', data: 'pubkey' }]);
      const privateKey = 'a'.repeat(64);

      await expect(signP2PKSecret(secret, privateKey)).rejects.toThrow('Invalid message hash length');
    });
  });

  describe('verifyP2PKWitness', () => {
    it('should return true for valid witness signature', async () => {
      const secret = JSON.stringify(['P2PK', { data: 'pubkey' }]);
      const witness = JSON.stringify({ signatures: ['a'.repeat(128)] });
      const publicKey = 'b'.repeat(64);

      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      (schnorr.verify as jest.Mock).mockReturnValue(true);

      const result = await verifyP2PKWitness(secret, witness, publicKey);

      expect(result).toBe(true);
    });

    it('should return false for empty signatures array', async () => {
      const witness = JSON.stringify({ signatures: [] });

      const result = await verifyP2PKWitness('secret', witness, 'pubkey');

      expect(result).toBe(false);
    });

    it('should return false for missing signatures', async () => {
      const witness = JSON.stringify({});

      const result = await verifyP2PKWitness('secret', witness, 'pubkey');

      expect(result).toBe(false);
    });

    it('should handle compressed public key (66 chars)', async () => {
      const secret = JSON.stringify(['P2PK', { data: 'pubkey' }]);
      const witness = JSON.stringify({ signatures: ['a'.repeat(128)] });
      const publicKey = '02' + 'b'.repeat(64); // 66 chars

      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      (schnorr.verify as jest.Mock).mockReturnValue(true);

      const result = await verifyP2PKWitness(secret, witness, publicKey);

      expect(result).toBe(true);
    });

    it('should return false for invalid public key length', async () => {
      const witness = JSON.stringify({ signatures: ['a'.repeat(128)] });

      const result = await verifyP2PKWitness('secret', witness, 'short');

      expect(result).toBe(false);
    });

    it('should return false on verification error', async () => {
      const witness = JSON.stringify({ signatures: ['a'.repeat(128)] });
      (crypto.digest as jest.Mock).mockRejectedValue(new Error('Digest failed'));

      const result = await verifyP2PKWitness('secret', witness, 'b'.repeat(64));

      expect(result).toBe(false);
    });

    it('should return false when schnorr.verify returns false', async () => {
      const secret = JSON.stringify(['P2PK', { data: 'pubkey' }]);
      const witness = JSON.stringify({ signatures: ['a'.repeat(128)] });
      const publicKey = 'b'.repeat(64);

      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      (schnorr.verify as jest.Mock).mockReturnValue(false);

      const result = await verifyP2PKWitness(secret, witness, publicKey);

      expect(result).toBe(false);
    });
  });

  describe('signP2PKProofs', () => {
    it('should sign P2PK locked proofs', async () => {
      const proofs = [
        {
          amount: 100,
          secret: JSON.stringify(['P2PK', { nonce: 'n', data: 'pk' }]),
          C: 'sig',
          id: 'keysetid',
        },
      ];
      const privateKey = 'a'.repeat(64);

      const result = await signP2PKProofs(proofs, privateKey);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('witness');
    });

    it('should not modify non-P2PK proofs', async () => {
      const proofs = [
        {
          amount: 100,
          secret: 'regular-secret',
          C: 'sig',
          id: 'keysetid',
        },
      ];
      const privateKey = 'a'.repeat(64);

      const result = await signP2PKProofs(proofs, privateKey);

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('witness');
      expect(result[0].secret).toBe('regular-secret');
    });

    it('should handle mixed proofs', async () => {
      const proofs = [
        {
          amount: 100,
          secret: JSON.stringify(['P2PK', { nonce: 'n', data: 'pk' }]),
          C: 'sig1',
          id: 'keysetid1',
        },
        {
          amount: 200,
          secret: 'regular-secret',
          C: 'sig2',
          id: 'keysetid2',
        },
      ];
      const privateKey = 'a'.repeat(64);

      const result = await signP2PKProofs(proofs, privateKey);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('witness');
      expect(result[1]).not.toHaveProperty('witness');
    });

    it('should handle empty proofs array', async () => {
      const result = await signP2PKProofs([], 'a'.repeat(64));

      expect(result).toEqual([]);
    });
  });

  describe('clearP2PKCache', () => {
    it('should be a function', () => {
      expect(typeof clearP2PKCache).toBe('function');
    });

    it('should delete cache keys from SecureStore', async () => {
      await clearP2PKCache();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v3');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_private_key_v3');
    });

    it('should handle delete error gracefully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

      // Should not throw
      await expect(clearP2PKCache()).resolves.toBeUndefined();
    });
  });

  describe('findAccountForP2PKToken', () => {
    const { withMnemonic, getCurrentAccount } = require('../../secureStorageService');
    const bitcoin = require('bitcoinjs-lib');

    beforeEach(() => {
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
    });

    it('should be a function', () => {
      expect(typeof findAccountForP2PKToken).toBe('function');
    });

    it('should accept pubkey, maxAccounts, and onProgress params', () => {
      expect(findAccountForP2PKToken.length).toBeLessThanOrEqual(3);
    });

    it('should return null when no matching account found', async () => {
      // Mock p2tr to return a different pubkey than what we're searching for
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest123',
        pubkey: Buffer.from('ab'.repeat(32), 'hex'),
      });

      const result = await findAccountForP2PKToken('cd'.repeat(32), 5);

      expect(result).toBeNull();
      expect(getCurrentAccount).toHaveBeenCalled();
      expect(withMnemonic).toHaveBeenCalled();
    });

    it('should use default maxAccounts when not provided', async () => {
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest123',
        pubkey: Buffer.from('ab'.repeat(32), 'hex'),
      });

      // Call without maxAccounts to use default of 50
      const result = await findAccountForP2PKToken('cd'.repeat(32));

      expect(result).toBeNull();
      expect(withMnemonic).toHaveBeenCalled();
    });

    it('should return match when account pubkey matches', async () => {
      const targetPubkey = 'ab'.repeat(32);

      // Mock p2tr to return matching pubkey
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1pmatch123',
        pubkey: Buffer.from(targetPubkey as string, 'hex'),
      });

      const result = await findAccountForP2PKToken(targetPubkey, 5);

      expect(result).not.toBeNull();
      expect(result!.accountIndex).toBe(0);
      expect(result!.address).toBe('tb1pmatch123');
      expect(result!.privateKey).toBeDefined();
    });

    it('should call onProgress callback during scanning', async () => {
      const onProgress = jest.fn();
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest123',
        pubkey: Buffer.from('ab'.repeat(32), 'hex'),
      });

      await findAccountForP2PKToken('cd'.repeat(32), 3, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle errors in account derivation gracefully', async () => {
      // First call throws, subsequent calls work
      (bitcoin.payments.p2tr as jest.Mock)
        .mockImplementationOnce(() => { throw new Error('Derivation error'); })
        .mockReturnValue({
          address: 'tb1ptest123',
          pubkey: Buffer.from('ab'.repeat(32), 'hex'),
        });

      const result = await findAccountForP2PKToken('cd'.repeat(32), 2);

      // Should continue to next account after error
      expect(result).toBeNull();
    });

    it('should handle missing pubkey in p2tr result', async () => {
      // Mock p2tr to return no pubkey (edge case)
      bitcoin.payments.p2tr.mockReturnValue({
        address: 'tb1ptest123',
        pubkey: null, // Missing pubkey
      });

      const result = await findAccountForP2PKToken('cd'.repeat(32), 2);

      expect(result).toBeNull();
    });
  });

  describe('getP2PKPrivateKey', () => {
    const { withMnemonic, getCurrentAccount } = require('../../secureStorageService');
    const { deriveAddressesFromMnemonic } = require('../../../utils/bitcoin');
    const { getPrivateKeyForAddress } = require('../../../utils/wallet');

    beforeEach(() => {
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
      (deriveAddressesFromMnemonic as jest.Mock).mockResolvedValue({
        taprootAddress: 'tb1ptest123',
        segwitAddress: 'tb1qtest123',
      });
      (getPrivateKeyForAddress as jest.Mock).mockResolvedValue({
        privateKey: 'derived_private_key_hex',
        xOnlyPubkey: 'derived_pubkey_hex',
        accountIndex: 0,
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    });

    it('should be a function', () => {
      expect(typeof getP2PKPrivateKey).toBe('function');
    });

    it('should return cached private key when cache is valid', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('tb1ptest123')  // cached address
        .mockResolvedValueOnce('cached_private_key'); // cached private key

      const result = await getP2PKPrivateKey();

      expect(result).toBe('cached_private_key');
      expect(getPrivateKeyForAddress).not.toHaveBeenCalled();
    });

    it('should derive and cache new key when cache is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getP2PKPrivateKey();

      expect(result).toBe('derived_private_key_hex');
      expect(getPrivateKeyForAddress).toHaveBeenCalledWith('tb1ptest123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v3', 'tb1ptest123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('p2pk_private_key_v3', 'derived_private_key_hex');
    });

    it('should clear cache and re-derive when address mismatch', async () => {
      // Cache has different address (account changed)
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('tb1pold_address')  // cached address (different)
        .mockResolvedValueOnce('old_cached_key'); // cached private key

      const result = await getP2PKPrivateKey();

      expect(result).toBe('derived_private_key_hex');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v3');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('p2pk_private_key_v3');
      expect(getPrivateKeyForAddress).toHaveBeenCalled();
    });

    it('should handle cache read error gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Read failed'));

      const result = await getP2PKPrivateKey();

      expect(result).toBe('derived_private_key_hex');
      expect(getPrivateKeyForAddress).toHaveBeenCalled();
    });

    it('should handle cache write error gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Write failed'));

      const result = await getP2PKPrivateKey();

      // Should still return the derived key even if caching fails
      expect(result).toBe('derived_private_key_hex');
    });
  });
});
