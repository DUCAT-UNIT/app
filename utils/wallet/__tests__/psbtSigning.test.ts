// @ts-nocheck
/**
 * Tests for PSBT Signing Utilities
 */

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn().mockReturnValue(Buffer.alloc(64, 0xab)),
}));

jest.mock('../../constants', () => ({
  SECURE_KEYS: {
    CURRENT_ACCOUNT: 'current_account',
    MNEMONIC: 'mnemonic',
    AUTH_METHOD: 'auth_method',
  },
}));

jest.mock('../../bitcoin', () => ({
  MUTINYNET_NETWORK: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
  },
}));

jest.mock('../../../services/secureStorageService', () => ({
  withMnemonic: jest.fn((callback) =>
    callback('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  ),
}));

jest.mock('../cryptoHelpers', () => ({
  bip32: {
    fromSeed: jest.fn().mockReturnValue({
      derivePath: jest.fn().mockReturnValue({
        privateKey: Buffer.alloc(32, 0x01),
        publicKey: Buffer.alloc(33, 0x02),
      }),
    }),
  },
  ecc: {
    signSchnorr: jest.fn().mockReturnValue(Buffer.alloc(64, 0x03)),
  },
  getECPair: jest.fn().mockReturnValue({
    fromPrivateKey: jest.fn().mockReturnValue({
      privateKey: Buffer.alloc(32, 0x01),
      publicKey: Buffer.alloc(33, 0x02),
    }),
  }),
  writeVarInt: jest.fn(),
  varIntSize: jest.fn().mockReturnValue(1),
}));

jest.mock('../../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock bitcoinjs-lib
jest.mock('bitcoinjs-lib', () => ({
  Psbt: {
    fromBase64: jest.fn().mockReturnValue({
      data: {
        inputs: [],
      },
      signInput: jest.fn(),
      toBase64: jest.fn().mockReturnValue('signed_psbt_base64'),
      txInputs: [],
    }),
  },
  crypto: {
    taggedHash: jest.fn().mockReturnValue(Buffer.alloc(32, 0x04)),
  },
}));

import * as SecureStore from 'expo-secure-store';
import { signPsbt, signPsbtRaw } from '../psbtSigning';

describe('psbtSigning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signPsbt', () => {
    it('should be defined', () => {
      expect(signPsbt).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof signPsbt).toBe('function');
    });

    it('should get account index from SecureStore', async () => {
      try {
        await signPsbt('test_psbt_base64', {});
      } catch {
        // May fail due to incomplete mocking, but we just want to verify SecureStore call
      }
      // The function should attempt to get account index
      expect(SecureStore.getItemAsync).toHaveBeenCalled();
    });
  });

  describe('signPsbtRaw', () => {
    it('should be defined', () => {
      expect(signPsbtRaw).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof signPsbtRaw).toBe('function');
    });
  });
});
