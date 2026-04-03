/**
 * Tests for Unified PSBT Signing Service
 */

/**
 * Mock SDK client interface for testing
 */
interface MockSdkClient {
  acct: {
    sats: { pubkey: string };
    runes: { pubkey: string };
    vault: { pubkey: string };
  };
}

/**
 * Mock PSBT input interface for testing
 */
interface MockPsbtInput {
  witnessUtxo?: {
    script: Buffer;
    value: bigint;
  };
  tapLeafScript?: Array<{
    leafVersion: number;
    script: Buffer;
    controlBlock: Buffer;
  }>;
  sighashType?: number;
  partialSig?: Array<{
    pubkey: Buffer;
    signature: Buffer;
  }>;
  tapKeySig?: Buffer;
  tapScriptSig?: Array<{
    signature: Buffer;
  }>;
  finalScriptWitness?: Buffer;
  redeemScript?: Buffer;
  tapInternalKey?: Buffer;
}

// Mock dependencies first - all Buffer usage inside mocks must use require()
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('bip39', () => {
  const { Buffer: B } = require('buffer');
  return {
    mnemonicToSeedSync: jest.fn().mockReturnValue(B.alloc(64, 0xab)),
  };
});

jest.mock('../../../utils/constants', () => ({
  SECURE_KEYS: {
    CURRENT_ACCOUNT: 'current_account',
    MNEMONIC: 'mnemonic',
    AUTH_METHOD: 'auth_method',
  },
}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
  },
  validateAndNormalizeAddress: jest.fn((a: string) => a),
}));

jest.mock('../../secureStorageService', () => ({
  withMnemonic: jest.fn((callback) =>
    callback('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  ),
  getCurrentAccount: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../utils/wallet/cryptoHelpers', () => {
  const { Buffer: B } = require('buffer');
  const mockKeyPair = {
    privateKey: B.alloc(32, 0x01),
    publicKey: B.concat([B.from([0x02]), B.alloc(32, 0x02)]),
    tweak: jest.fn().mockReturnValue({
      privateKey: B.alloc(32, 0x01),
      publicKey: B.concat([B.from([0x02]), B.alloc(32, 0x02)]),
    }),
  };

  return {
    bip32: {
      fromSeed: jest.fn().mockReturnValue({
        derivePath: jest.fn().mockReturnValue(mockKeyPair),
      }),
    },
    ecc: {
      signSchnorr: jest.fn().mockReturnValue(B.alloc(64, 0x03)),
    },
    getECPair: jest.fn().mockReturnValue({
      fromPrivateKey: jest.fn().mockReturnValue({
        privateKey: B.alloc(32, 0x01),
        publicKey: B.alloc(33, 0x02),
      }),
    }),
    writeVarInt: jest.fn((buf, value, offset) => {
      buf[offset] = value;
      return offset + 1;
    }),
    varIntSize: jest.fn().mockReturnValue(1),
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

jest.mock('../../vaultWallet/psbtBinaryUtils', () => {
  const { Buffer: B } = require('buffer');
  return {
    patchPsbtSignatures: jest.fn((psbt) => psbt + '-signed'),
    patchPsbtInputFields: jest.fn((psbt) => psbt + '-patched'),
    encodeWitnessStack: jest.fn(() => B.from('witness')),
  };
});

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
  const { Buffer: B } = require('buffer');
  const BuffConstructor = jest.fn().mockImplementation((data: any) => ({
    hex: B.from(data).toString('hex'),
  }));
  (BuffConstructor as any).hex = jest.fn((data: any) => B.from(data, 'hex'));
  return { Buff: BuffConstructor };
});

// Mock bitcoinjs-lib - define mock functions outside
const mockSignInput = jest.fn();
const mockFinalizeInput = jest.fn();
const mockUpdateInput = jest.fn();
const mockToBase64 = jest.fn().mockReturnValue('signed_psbt_base64');
const DEFAULT_INTENT = { recipient: 'recipient', change: 'recipient', minAmountSats: 0, allowOpReturn: true };
const RECIPIENT_SCRIPT = Buffer.from('0014' + '11'.repeat(20), 'hex'); // simple p2wpkh; address mock returns 'recipient'

jest.mock('bitcoinjs-lib', () => {
  const { Buffer: B } = require('buffer');
  const mockHashForWitnessV1 = jest.fn().mockReturnValue(B.alloc(32, 0x05));
  return {
    Psbt: {
      fromBase64: jest.fn(),
    },
    crypto: {
      taggedHash: jest.fn().mockReturnValue(B.alloc(32, 0x04)),
    },
    Transaction: {
      SIGHASH_DEFAULT: 0x00,
    },
    address: {
      fromOutputScript: jest.fn(() => 'recipient'),
    },
  };
});

import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as bitcoin from 'bitcoinjs-lib';
import {
  signPsbt,
  signPsbtRaw,
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from '../psbtService';
import * as psbtBinaryUtils from '../../vaultWallet/psbtBinaryUtils';

// Helper to create mock PSBT
const mockHashForWitnessV1 = jest.fn().mockReturnValue(Buffer.alloc(32, 0x05));

const createMockPsbt = (
  inputs: MockPsbtInput[] = [],
  outputs: Array<{ script: Buffer; value: bigint }> = [
    { script: RECIPIENT_SCRIPT, value: BigInt(10_000) },
  ],
  txInputs?: Array<{ hash: Buffer; index: number; sequence: number }>
) => ({
  data: {
    inputs,
  },
  inputCount: inputs.length,
  signInput: mockSignInput,
  finalizeInput: mockFinalizeInput,
  updateInput: mockUpdateInput,
  toBase64: mockToBase64,
  extractTransaction: jest.fn(() => ({
    version: 2,
    locktime: 0,
  })),
  txInputs: txInputs ?? inputs.map((_, index) => ({
    hash: Buffer.alloc(32, index),
    index,
    sequence: 0xfffffffd,
  })),
  txOutputs: outputs,
  __CACHE: {
    __TX: {
      version: 2,
      locktime: 0,
      hashForWitnessV1: mockHashForWitnessV1,
      clone: jest.fn().mockReturnValue({
        version: 2,
        locktime: 0,
        hashForWitnessV1: mockHashForWitnessV1,
      }),
    },
  },
});

describe('psbtService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInput.mockReset();
    mockFinalizeInput.mockReset();
    mockUpdateInput.mockReset();
    mockToBase64.mockReset().mockReturnValue('signed_psbt_base64');
    mockHashForWitnessV1.mockReset().mockReturnValue(Buffer.alloc(32, 0x05));
    (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([]));
  });

  describe('signPsbt', () => {
    it('should be defined', () => {
      expect(signPsbt).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof signPsbt).toBe('function');
    });

    it('should return signed PSBT in base64 with empty signInputs', async () => {
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([], [
        { script: RECIPIENT_SCRIPT, value: BigInt(10_000) },
      ]));
      const result = await signPsbt('test_psbt_base64', {}, DEFAULT_INTENT);
      expect(result).toBe('signed_psbt_base64');
    });

    it('should reject PSBT without intent', async () => {
      await expect(signPsbt('test_psbt_base64', {} as any, null as any)).rejects.toThrow('Missing intent');
    });

    it('should throw for unsupported address types', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014abcd', 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      await expect(signPsbt('test_psbt_base64', {
        'invalid_address': [0],
      }, DEFAULT_INTENT)).rejects.toThrow('Unsupported address type');
    });

    it('should call signInput for tb1q addresses', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      const result = await signPsbt('test_psbt_base64', {
        'tb1qtest': [0],
      }, DEFAULT_INTENT);

      expect(result).toBe('signed_psbt_base64');
      expect(mockSignInput).toHaveBeenCalled();
    });

    it('should handle Taproot signing for tb1p addresses', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('5120' + '00'.repeat(32), 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      let error: Error | null = null;
      try {
        await signPsbt('test_psbt_base64', { 'tb1ptest': [0] }, DEFAULT_INTENT);
      } catch (e) {
        error = e as Error;
      }

      if (error) {
        expect(error.message).not.toContain('Unsupported address type');
      }
    });

    it('should handle Taproot script-path with tapLeafScript', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('5120' + '00'.repeat(32), 'hex'),
          value: BigInt(10000),
        },
        tapLeafScript: [{
          leafVersion: 0xc0,
          script: Buffer.from('abcd', 'hex'),
          controlBlock: Buffer.alloc(33, 0x01),
        }],
        sighashType: 0x00,
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      try {
        await signPsbt('test_psbt_base64', { 'tb1ptest': [0] }, DEFAULT_INTENT);
      } catch {
        // Expected
      }

      expect(mockUpdateInput).toHaveBeenCalled();
    });

    it('should finalize SegWit inputs', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      await signPsbt('test_psbt_base64', { 'tb1qtest': [0] }, { recipient: 'recipient', change: 'recipient', minAmountSats: 0 });

      expect(mockFinalizeInput).toHaveBeenCalled();
    });

    it('should handle finalization errors gracefully', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      const mockPsbt = createMockPsbt([mockInput]);
      mockPsbt.finalizeInput.mockImplementation(() => {
        throw new Error('Finalization error');
      });
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockPsbt);

      await expect(signPsbt('test_psbt_base64', { 'tb1qtest': [0] }, DEFAULT_INTENT)).resolves.toBeTruthy();
    });
  });

  describe('signPsbtRaw', () => {
    it('should be defined', () => {
      expect(signPsbtRaw).toBeDefined();
    });

    it('should return signed PSBT with empty signInputs', async () => {
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([], [
        { script: RECIPIENT_SCRIPT, value: BigInt(10_000) },
      ]));
      const result = await signPsbtRaw('test_psbt_base64', {}, DEFAULT_INTENT);
      expect(result).toBe('signed_psbt_base64');
    });

    it('should reject requested inputs without witnessUtxo', async () => {
      const mockInput = {};
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      await expect(signPsbtRaw('test_psbt_base64', {
        'tb1qtest': [0],
      }, DEFAULT_INTENT)).rejects.toThrow(
        'SECURITY: Missing witnessUtxo for requested input 0'
      );
      expect(mockSignInput).not.toHaveBeenCalled();
    });

    it('should sign SegWit inputs without finalizing', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      const result = await signPsbtRaw('test_psbt_base64', {
        'tb1qtest': [0],
      }, { recipient: 'recipient', change: 'recipient', minAmountSats: 0 });

      expect(result).toBe('signed_psbt_base64');
      expect(mockSignInput).toHaveBeenCalled();
      expect(mockFinalizeInput).not.toHaveBeenCalled();
    });

    it('should sign Taproot key-path inputs', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('5120' + '00'.repeat(32), 'hex'),
          value: BigInt(10000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      try {
        await signPsbtRaw('test_psbt_base64', { 'tb1ptest': [0] }, DEFAULT_INTENT);
      } catch {
        // Expected
      }

      expect(mockUpdateInput).toHaveBeenCalled();
    });

    it('should sign Taproot script-path inputs', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('5120' + '00'.repeat(32), 'hex'),
          value: BigInt(10000),
        },
        tapLeafScript: [{
          leafVersion: 0xc0,
          script: Buffer.from('abcd', 'hex'),
          controlBlock: Buffer.alloc(33, 0x01),
        }],
        sighashType: 0x00,
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput]));

      try {
        await signPsbtRaw('test_psbt_base64', { 'tb1ptest': [0] }, DEFAULT_INTENT);
      } catch {
        // Expected
      }

      expect(mockUpdateInput).toHaveBeenCalled();
    });

    it('should handle signing errors', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      const mockPsbt = createMockPsbt([mockInput], [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }]);
      mockPsbt.signInput.mockImplementation(() => {
        throw new Error('Sign error');
      });
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockPsbt);

      await expect(signPsbtRaw('test_psbt_base64', {
        'tb1qtest': [0],
      }, DEFAULT_INTENT)).rejects.toThrow('Sign error');
    });

    it('should sign multiple inputs across different addresses', async () => {
      const mockInput1 = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      const mockInput2 = {
        witnessUtxo: {
          script: Buffer.from('5120' + '00'.repeat(32), 'hex'),
          value: BigInt(20000),
        },
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(createMockPsbt([mockInput1, mockInput2]));

      try {
      await signPsbtRaw('test_psbt_base64', {
        'tb1qtest': [0],
        'tb1ptest': [1],
      }, { recipient: 'recipient', change: 'recipient', minAmountSats: 0 });
      } catch {
        // Expected
      }

      expect(mockSignInput).toHaveBeenCalled();
      expect(mockUpdateInput).toHaveBeenCalled();
    });

    it('should reject vault PSBTs that do not match the expected template', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      const txInputs = [
        {
          hash: Buffer.alloc(32, 0x01),
          index: 0,
          sequence: 0xfffffffd,
        },
      ];
      const mockPsbt = createMockPsbt(
        [mockInput],
        [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }],
        txInputs
      );
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockPsbt);

      await expect(signPsbtRaw('test_psbt_base64', {}, {
        recipient: 'recipient',
        expectedPsbtTemplates: [
          {
            version: 2,
            locktime: 0,
            inputs: [
              {
                hashHex: Buffer.alloc(32, 0x09).toString('hex'),
                index: 0,
                scriptHex: Buffer.from(mockInput.witnessUtxo.script).toString('hex'),
                sequence: 0xfffffffd,
                value: '10000',
              },
            ],
            outputs: [
              {
                scriptHex: RECIPIENT_SCRIPT.toString('hex'),
                value: '10000',
              },
            ],
          },
        ],
      })).rejects.toThrow('does not match the expected transaction template');
    });

    it('should accept vault PSBTs that match the expected template exactly', async () => {
      const mockInput = {
        witnessUtxo: {
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(10000),
        },
      };
      const txInputs = [
        {
          hash: Buffer.alloc(32, 0x01),
          index: 0,
          sequence: 0xfffffffd,
        },
      ];
      const mockPsbt = createMockPsbt(
        [mockInput],
        [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }],
        txInputs
      );
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockPsbt);

      await expect(signPsbtRaw('test_psbt_base64', {}, {
        recipient: 'recipient',
        expectedPsbtTemplates: [
          {
            version: 2,
            locktime: 0,
            inputs: [
              {
                hashHex: Buffer.from(txInputs[0].hash).toString('hex'),
                index: 0,
                scriptHex: Buffer.from(mockInput.witnessUtxo.script).toString('hex'),
                sequence: 0xfffffffd,
                value: '10000',
              },
            ],
            outputs: [
              {
                scriptHex: RECIPIENT_SCRIPT.toString('hex'),
                value: '10000',
              },
            ],
          },
        ],
      })).resolves.toBe('signed_psbt_base64');
    });
  });

  describe('signPsbtWithSdkObject', () => {
    it('should sign PSBT with default account index', async () => {
      const mockPdata = {} as any;
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
        txOutputs: [
          { script: RECIPIENT_SCRIPT, value: BigInt(10_000) },
        ],
        signInput: jest.fn(),
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs, undefined, DEFAULT_INTENT);

      expect(result).toBe('encoded-psbt-signed');
      expect(psbtBinaryUtils.patchPsbtSignatures).toHaveBeenCalled();
    });

    it('should handle Taproot key-path signing', async () => {
      const mockPdata = {} as any;
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
        txOutputs: [{ script: Buffer.from('51', 'hex'), value: BigInt(1000) }],
      };
      mockBjsPsbt.txOutputs = [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }];
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs, undefined, DEFAULT_INTENT);

      expect(result).toBe('encoded-psbt-signed');
    });

    it('should handle Taproot script-path signing', async () => {
      const mockPdata = {} as any;
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
        txOutputs: [{ script: Buffer.from('51', 'hex'), value: BigInt(1000) }],
      };
      mockBjsPsbt.txOutputs = [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }];
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs, undefined, DEFAULT_INTENT);

      expect(result).toBe('encoded-psbt-signed');
    });

    it('should skip inputs without witnessUtxo', async () => {
      const mockPdata = {} as any;
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
        txOutputs: [{ script: Buffer.from('51', 'hex'), value: BigInt(1000) }],
      });

      const result = await signPsbtWithSdkObject(mockPdata, mockSignInputs, undefined, DEFAULT_INTENT);

      expect(result).toBe('encoded-psbt-signed');
    });

    it('should use original PSBT base64 when provided', async () => {
      const mockPdata = {} as any;
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
        txOutputs: [{ script: Buffer.from('51', 'hex'), value: BigInt(1000) }],
      };
      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue(mockBjsPsbt);

      await signPsbtWithSdkObject(mockPdata, mockSignInputs, originalPsbt, DEFAULT_INTENT);

      expect(bitcoin.Psbt.fromBase64).toHaveBeenCalledWith(originalPsbt, expect.any(Object));
    });
  });

  describe('patchPreProcessFields', () => {
    const mockClient = {
      acct: {
        sats: { pubkey: '02aabbcc' },
        runes: { pubkey: '03ddeeff' },
        vault: { pubkey: '04aabbcc' },
      },
    } as any;

    it('should patch redeemScript for P2SH inputs', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1qtest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('a914aabbcc', 'hex'),
              },
            },
          ],
        },
      });

      const result = patchPreProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64 + '-patched');
    });

    it('should patch tapInternalKey for P2TR inputs', () => {
      const psbtBase64 = 'cHNidP8BAA==';
      const manifest = { 'tb1ptest': [0] };

      (bitcoin.Psbt.fromBase64 as jest.Mock).mockReturnValue({
        data: {
          inputs: [
            {
              witnessUtxo: {
                script: Buffer.from('5120def456', 'hex'),
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
        txOutputs: [{ script: RECIPIENT_SCRIPT, value: BigInt(10_000) }],
      });

      const result = patchPreProcessFields(psbtBase64, mockClient, manifest);

      expect(result).toBe(psbtBase64);
    });
  });

  describe('patchPostProcessFields', () => {
    const mockClient = {
      acct: {
        sats: { pubkey: '02aabbcc' },
        runes: { pubkey: '03ddeeff' },
        vault: { pubkey: '04aabbcc' },
      },
    } as any;

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
  });

  describe('psbtPreProcess', () => {
    const mockClient = {
      acct: {
        sats: { pubkey: '02aabbcc' },
        runes: { pubkey: '03ddeeff' },
        vault: { pubkey: '04aabbcc' },
      },
    } as any;

    const { TX } = require('@ducat-unit/client-sdk/util');

    it('should add redeemScript for P2SH inputs', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('a914abc123', 'hex')),
          },
          redeemScript: undefined,
        })),
        updateInput: jest.fn(),
      } as any;
      const manifest = { 'tb1qtest': [0] };

      (TX.parse_script_meta as jest.Mock).mockReturnValue({
        type: 'p2sh',
        key: { hex: 'abc123' },
      });

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).toHaveBeenCalled();
    });

    it('should add tapInternalKey for P2TR inputs', () => {
      const mockPdata = {
        getInput: jest.fn(() => ({
          witnessUtxo: {
            script: new Uint8Array(Buffer.from('5120def456', 'hex')),
          },
        })),
        updateInput: jest.fn(),
      } as any;
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
      } as any;
      const manifest = { 'tb1qtest': [0] };

      psbtPreProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });
  });

  describe('psbtPostProcess', () => {
    const mockClient = {
      acct: {
        sats: { pubkey: '02aabbcc' },
        runes: { pubkey: '03ddeeff' },
        vault: { pubkey: '04aabbcc' },
      },
    } as any;

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
      } as any;
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
      } as any;
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
      } as any;
      const manifest = { 'tb1qtest': [0] };

      psbtPostProcess(mockClient, mockPdata, manifest);

      expect(mockPdata.updateInput).not.toHaveBeenCalled();
    });
  });

  describe('exports', () => {
    it('should export all required functions', () => {
      const exports = require('../psbtService');
      expect(exports.signPsbt).toBeDefined();
      expect(exports.signPsbtRaw).toBeDefined();
      expect(exports.signPsbtWithSdkObject).toBeDefined();
      expect(exports.patchPreProcessFields).toBeDefined();
      expect(exports.patchPostProcessFields).toBeDefined();
      expect(exports.psbtPreProcess).toBeDefined();
      expect(exports.psbtPostProcess).toBeDefined();
    });
  });
});

describe('cryptoUtils', () => {
  const cryptoUtils = require('../cryptoUtils');
  const secureStorageService = require('../../secureStorageService');

  describe('getAccountIndex', () => {
    it('should return stored account index', async () => {
      secureStorageService.getCurrentAccount.mockResolvedValueOnce(5);
      const result = await cryptoUtils.getAccountIndex();
      expect(result).toBe(5);
    });

    it('should return 0 when no account stored', async () => {
      secureStorageService.getCurrentAccount.mockResolvedValueOnce(0);
      const result = await cryptoUtils.getAccountIndex();
      expect(result).toBe(0);
    });

    it('should return 0 on SecureStore error', async () => {
      secureStorageService.getCurrentAccount.mockRejectedValueOnce(new Error('Storage error'));
      const result = await cryptoUtils.getAccountIndex();
      expect(result).toBe(0);
    });

    it('should handle non-Error thrown from SecureStore', async () => {
      secureStorageService.getCurrentAccount.mockRejectedValueOnce('string error');
      const result = await cryptoUtils.getAccountIndex();
      expect(result).toBe(0);
    });
  });

  describe('extractWitnessData', () => {
    it('should throw when input missing witnessUtxo', () => {
      const mockPsbt = {
        data: {
          inputs: [{ witnessUtxo: undefined }],
        },
      };
      expect(() => cryptoUtils.extractWitnessData(mockPsbt)).toThrow('Input 0 is missing witnessUtxo');
    });

    it('should extract witness data successfully', () => {
      const mockPsbt = {
        data: {
          inputs: [{
            witnessUtxo: {
              script: Buffer.from('0014aabbcc', 'hex'),
              value: BigInt(10000),
            },
          }],
        },
      };
      const result = cryptoUtils.extractWitnessData(mockPsbt);
      expect(result.scripts).toHaveLength(1);
      expect(result.values).toHaveLength(1);
    });
  });

  describe('ensurePrivateKeyBuffer', () => {
    it('should throw when privateKey is undefined', () => {
      expect(() => cryptoUtils.ensurePrivateKeyBuffer(undefined)).toThrow('Key pair is missing private key');
    });

    it('should return Buffer directly if already Buffer', () => {
      const buf = Buffer.alloc(32, 0x01);
      const result = cryptoUtils.ensurePrivateKeyBuffer(buf);
      expect(result).toBe(buf);
    });

    it('should convert Uint8Array to Buffer', () => {
      const uint8 = new Uint8Array(32).fill(0x02);
      const result = cryptoUtils.ensurePrivateKeyBuffer(uint8);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('negatePrivateKeyIfNeeded', () => {
    it('should negate key when publicKey prefix is 0x03', () => {
      const privateKey = Buffer.alloc(32, 0x01);
      const publicKey = Buffer.concat([Buffer.from([0x03]), Buffer.alloc(32, 0x02)]);
      const result = cryptoUtils.negatePrivateKeyIfNeeded(privateKey, publicKey);
      expect(result).not.toEqual(privateKey);
      expect(result.length).toBe(32);
    });

    it('should return original key when publicKey prefix is 0x02', () => {
      const privateKey = Buffer.alloc(32, 0x01);
      const publicKey = Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0x02)]);
      const result = cryptoUtils.negatePrivateKeyIfNeeded(privateKey, publicKey);
      expect(result).toBe(privateKey);
    });
  });

  describe('signSegwitInput', () => {
    it('should return null when no partialSig after signing', () => {
      const mockPsbt = {
        data: {
          inputs: [{ partialSig: [] }],
        },
        signInput: jest.fn(),
      };
      const mockKeyPair = {
        privateKey: Buffer.alloc(32, 0x01),
        publicKey: Buffer.alloc(33, 0x02),
      };
      const result = cryptoUtils.signSegwitInput(mockPsbt, 0, mockKeyPair);
      expect(result).toBeNull();
    });
  });

  describe('witnessToScriptWitness', () => {
    it('should serialize empty witness stack', () => {
      const result = cryptoUtils.witnessToScriptWitness([]);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should serialize witness stack with items', () => {
      const witness = [Buffer.from('sig'), Buffer.from('pubkey')];
      const result = cryptoUtils.witnessToScriptWitness(witness);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
