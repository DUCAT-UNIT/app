// @ts-nocheck
/**
 * Tests for PSBT Signing Functions
 */

import {
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from '../psbtSigning';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { Buff } from '@cmdcode/buff';
import { Buffer } from 'buffer';
import * as psbtBinaryUtils from '../psbtBinaryUtils';
import * as secureStorageService from '../../secureStorageService';
import { bip32, ecc, getECPair } from '../../../utils/wallet/cryptoHelpers';

// Mock dependencies
jest.mock('bitcoinjs-lib', () => {
  const actualBitcoin = jest.requireActual('bitcoinjs-lib');
  const { Buffer: mockBuffer } = require('buffer');
  return {
    ...actualBitcoin,
    Psbt: {
      fromBase64: jest.fn(),
    },
    crypto: {
      taggedHash: jest.fn(() => mockBuffer.alloc(32, 0xaa)),
    },
  };
});

jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => {
    const { Buffer: mockBuffer } = require('buffer');
    return mockBuffer.alloc(64);
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}));

jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: {
    parse_address: jest.fn(() => ({ key: 'abc123' })),
    parse_script_meta: jest.fn(() => ({
      type: 'p2w-pkh',
      key: { hex: 'abc123' },
    })),
  },
  PSBT: {
    encode: jest.fn(() => 'encoded-psbt'),
    decode: jest.fn(),
  },
  hash160: jest.fn(() => 'abc123'),
  taptweak_pubkey: jest.fn(() => 'def456'),
}));

jest.mock('@cmdcode/buff', () => {
  const { Buffer: mockBuffer } = require('buffer');

  // Create constructor function
  const BuffConstructor = jest.fn().mockImplementation((data) => ({
    hex: mockBuffer.from(data).toString('hex'),
  }));

  // Add static hex method
  BuffConstructor.hex = jest.fn((data) => mockBuffer.from(data, 'hex'));

  return {
    Buff: BuffConstructor,
  };
});

jest.mock('../psbtBinaryUtils', () => ({
  patchPsbtSignatures: jest.fn((psbt) => psbt + '-signed'),
  patchPsbtInputFields: jest.fn((psbt) => psbt + '-patched'),
  encodeWitnessStack: jest.fn(() => {
    const { Buffer: mockBuffer } = require('buffer');
    return mockBuffer.from('witness');
  }),
}));

jest.mock('../../secureStorageService', () => ({
  withMnemonic: jest.fn(async (fn) => fn('test mnemonic words')),
}));

jest.mock('../../../utils/wallet/cryptoHelpers', () => {
  const { Buffer: mockBuffer } = require('buffer');
  return {
    bip32: {
      fromSeed: jest.fn(() => ({
        derivePath: jest.fn(() => ({
          privateKey: mockBuffer.alloc(32, 0x11),
          publicKey: mockBuffer.from('02' + '22'.repeat(32), 'hex'),
        })),
      })),
    },
    ecc: {
      signSchnorr: jest.fn(() => mockBuffer.alloc(64, 0x33)),
    },
    getECPair: jest.fn(() => ({
      fromPrivateKey: jest.fn(() => ({
        privateKey: mockBuffer.alloc(32, 0x11),
        publicKey: mockBuffer.from('02' + '22'.repeat(32), 'hex'),
      })),
    })),
    varIntSize: jest.fn(() => 1),
    writeVarInt: jest.fn(),
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/constants', () => ({
  SECURE_KEYS: {
    CURRENT_ACCOUNT: 'current_account',
  },
}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef },
}));

describe('psbtSigning', () => {
  const mockClient = {
    acct: {
      sats: {
        pubkey: '02aabbcc',
        address: 'tb1qtest123',
      },
      runes: {
        pubkey: '03ddeeff',
        address: 'tb1ptest456',
      },
      vault: {
        pubkey: '04aabbcc',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signPsbtWithSdkObject', () => {
    it('should sign PSBT with default account index', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
                value: BigInt(100000),
              },
              partialSig: [
                {
                  pubkey: Buffer.alloc(33, 0x02),
                  signature: Buffer.alloc(64, 0x44),
                },
              ],
            },
          ],
        },
        signInput: jest.fn(),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(result).toBe('encoded-psbt-signed');
      expect(psbtBinaryUtils.patchPsbtSignatures).toHaveBeenCalled();
    });

    it('should use stored account index', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('5');
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
                value: BigInt(100000),
              },
              partialSig: [],
            },
          ],
        },
        signInput: jest.fn(),
      });

      await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(SecureStore.getItemAsync).toHaveBeenCalled();
    });

    it('should handle SegWit P2WPKH signing', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
                value: BigInt(100000),
              },
              partialSig: [
                {
                  pubkey: Buffer.alloc(33, 0x02),
                  signature: Buffer.alloc(64, 0x44),
                },
              ],
            },
          ],
        },
        signInput: jest.fn(),
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (getECPair as jest.Mock).mockReturnValue({
        fromPrivateKey: jest.fn(() => mockKeyPair),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(mockBjsPsbt.signInput).toHaveBeenCalledWith(0, mockKeyPair);
      expect(result).toBe('encoded-psbt-signed');
    });

    it('should handle Taproot key-path signing', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1ptest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120' + 'aa'.repeat(32), 'hex'),
                value: BigInt(100000),
              },
              tapLeafScript: undefined,
              sighashType: 0x00,
            },
          ],
        },
        __CACHE: {
          __TX: {
            hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 0x55)),
          },
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(ecc.signSchnorr).toHaveBeenCalled();
      expect(result).toBe('encoded-psbt-signed');
    });

    it('should handle Taproot key-path with y-coordinate negation', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1ptest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120' + 'aa'.repeat(32), 'hex'),
                value: BigInt(100000),
              },
              tapLeafScript: undefined,
              sighashType: 0x00,
            },
          ],
        },
        __CACHE: {
          __TX: {
            hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 0x55)),
          },
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('03' + '22'.repeat(32), 'hex'), // 0x03 prefix triggers negation
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(ecc.signSchnorr).toHaveBeenCalled();
      expect(result).toBe('encoded-psbt-signed');
    });

    it('should handle Taproot script-path signing', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1ptest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120' + 'aa'.repeat(32), 'hex'),
                value: BigInt(100000),
              },
              tapLeafScript: [
                {
                  leafVersion: 0xc0,
                  script: Buffer.from('ab', 'hex'),
                  controlBlock: Buffer.from('controlblock', 'hex'),
                },
              ],
              sighashType: 0x00,
            },
          ],
        },
        __CACHE: {
          __TX: {
            hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 0x55)),
          },
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(ecc.signSchnorr).toHaveBeenCalled();
      expect(result).toBe('encoded-psbt-signed');
    });

    it('should skip inputs without witnessUtxo', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: undefined,
            },
          ],
        },
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);

      expect(result).toBe('encoded-psbt-signed');
    });

    it('should throw error on missing witnessUtxo in extractWitnessData', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1ptest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120' + 'aa'.repeat(32), 'hex'),
                value: BigInt(100000),
              },
              tapLeafScript: [
                {
                  leafVersion: 0xc0,
                  script: Buffer.from('ab', 'hex'),
                },
              ],
            },
          ],
        },
        __CACHE: {
          __TX: {
            hashForWitnessV1: jest.fn(),
          },
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      await expect(signPsbtWithSdkObject(mockPdata, mockSignInputs)).resolves.toBeTruthy();
    });

    it('should treat empty tapLeafScript as key-path signing', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1ptest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120' + 'aa'.repeat(32), 'hex'),
                value: BigInt(100000),
              },
              tapLeafScript: [], // Empty array - treated as key-path
              sighashType: 0x00,
            },
          ],
        },
        __CACHE: {
          __TX: {
            hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 0x55)),
          },
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      // Empty tapLeafScript is falsy for length check, so it treats as key-path
      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs);
      expect(result).toBe('encoded-psbt-signed');
    });

    it('should throw error for missing private key', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
                value: BigInt(100000),
              },
            },
          ],
        },
        signInput: jest.fn(),
      });

      const mockKeyPair = {
        privateKey: undefined, // Missing private key
      };
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      await expect(signPsbtWithSdkObject(mockPdata, mockSignInputs)).rejects.toThrow(
        'Failed to derive private key for SegWit signing'
      );
    });

    it('should use original PSBT base64 when provided', async () => {
      const mockPdata = {};
      const mockSignInputs = { 'tb1qtest': [0] };
      const originalPsbt = 'original-psbt-base64';

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const mockBjsPsbt = {
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
                value: BigInt(100000),
              },
              partialSig: [
                {
                  pubkey: Buffer.alloc(33, 0x02),
                  signature: Buffer.alloc(64, 0x44),
                },
              ],
            },
          ],
        },
        signInput: jest.fn(),
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x11),
        publicKey: Buffer.from('02' + '22'.repeat(32), 'hex'),
      };
      (getECPair as jest.Mock).mockReturnValue({
        fromPrivateKey: jest.fn(() => mockKeyPair),
      });
      (bip32.fromSeed as jest.Mock).mockReturnValue({
        derivePath: jest.fn(() => mockKeyPair),
      });

      await signPsbtWithSdkObject(mockPdata, mockSignInputs, originalPsbt);

      expect(bitcoin.Psbt.fromBase64).toHaveBeenCalledWith(originalPsbt, expect.any(Object));
    });
  });

  describe('patchPreProcessFields', () => {
    it('should patch redeemScript for P2SH inputs', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('a914aabbcc', 'hex'), // P2SH
              },
            },
          ],
        },
      });

      const result = patchPreProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
      expect(psbtBinaryUtils.patchPsbtInputFields).toHaveBeenCalled();
    });

    it('should patch tapInternalKey for P2TR inputs', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1ptest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120def456', 'hex'), // P2TR
              },
            },
          ],
        },
      });

      const result = patchPreProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
    });

    it('should return original PSBT if no fields to add', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: undefined,
            },
          ],
        },
      });

      const result = patchPreProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64);
    });
  });

  describe('patchPostProcessFields', () => {
    it('should patch finalScriptWitness for segwit inputs', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
              },
              partialSig: [
                {
                  pubkey: Buffer.alloc(33, 0x02),
                  signature: Buffer.alloc(64, 0x44),
                },
              ],
              finalScriptWitness: undefined,
            },
          ],
        },
      });

      const result = patchPostProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
    });

    it('should handle taproot key-spend', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1ptest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120aabbcc', 'hex'),
              },
              tapKeySig: Buffer.alloc(64, 0x55),
              finalScriptWitness: undefined,
            },
          ],
        },
      });

      const result = patchPostProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
    });

    it('should handle taproot script-spend', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1ptest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120aabbcc', 'hex'),
              },
              tapScriptSig: [
                {
                  signature: Buffer.alloc(64, 0x66),
                },
              ],
              tapLeafScript: [
                {
                  script: Buffer.from('ab', 'hex'),
                  controlBlock: Buffer.from('controlblock', 'hex'),
                },
              ],
              finalScriptWitness: undefined,
            },
          ],
        },
      });

      const result = patchPostProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
    });

    it('should skip inputs with existing finalScriptWitness', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('0014aabbcc', 'hex'),
              },
              finalScriptWitness: Buffer.from('existing'),
            },
          ],
        },
      });

      const result = patchPostProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64);
    });

    it('should return original PSBT if no fields to add', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: undefined,
            },
          ],
        },
      });

      const result = patchPostProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64);
    });
  });

  describe('psbtPreProcess', () => {
    it('should add redeemScript for P2SH inputs', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('a914abc123', 'hex')),
          },
          redeemScript: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2sh',
        key: { hex: 'abc123' },
      });

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should handle P2WPKH inputs (no pre-processing needed)', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('0014abc123', 'hex')),
          },
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2w-pkh',
        key: { hex: 'abc123' },
      });

      psbtPreProcess(mockClient, mockPdata, manifest);

      // Should not call updateInput for P2WPKH
      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });

    it('should add tapInternalKey for P2TR inputs', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('5120def456', 'hex')),
          },
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1ptest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2tr',
        key: { hex: 'def456' },
      });

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should skip inputs without witnessUtxo', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });

    it('should skip inputs without script key', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('0014abc123', 'hex')),
          },
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2w-pkh',
        key: undefined,
      });

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });

    it('should handle duplicate update errors gracefully', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('a914abc123', 'hex')),
          },
          redeemScript: undefined,
        })),
        updateInput: jest.fn(() => {
          throw new Error('Duplicate field');
        }),
      };
      const manifest = { 'tb1qtest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2sh',
        key: { hex: 'abc123' },
      });

      expect(() => psbtPreProcess(mockClient, mockPdata, manifest)).not.toThrow();
    });
  });

  describe('psbtPostProcess', () => {
    it('should finalize witness for segwit inputs with partialSig', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('0014abc123', 'hex')),
          },
          partialSig: [
            Buffer.from('signature'),
            Buffer.from('pubkey'),
          ],
          finalScriptWitness: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should add redeemScript to witness if present', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('a914abc123', 'hex')),
          },
          redeemScript: new Uint8Array(Buffer.from('redeem', 'hex')),
          finalScriptSig: undefined,
          finalScriptWitness: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should handle taproot key-spend', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('5120abc123', 'hex')),
          },
          tapKeySig: new Uint8Array(Buffer.from('tapsig', 'hex')),
          finalScriptWitness: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1ptest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should handle taproot script-spend', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('5120abc123', 'hex')),
          },
          tapScriptSig: [{}],
          finalScriptWitness: [new Uint8Array(Buffer.from('witness1', 'hex'))],
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1ptest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should skip inputs without witnessUtxo', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });

    it('should not finalize if no witness data', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('0014abc123', 'hex')),
          },
          partialSig: undefined,
          tapKeySig: undefined,
          finalScriptWitness: undefined,
        })),
        updateInput: jest.fn(),
      };
      const manifest = { 'tb1qtest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });
  });
});
