/**
 * Tests for VaultWallet Service Module
 * Tests PSBT utilities, types, and wallet API functions
 */

// Mock SDK utilities before imports
jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: {
    get_txid: jest.fn(() => 'mock_txid'),
    parse_script_meta: jest.fn(() => ({})),
  },
  PSBT: {
    decode: jest.fn(() => ({
      inputsLength: 1,
      getInput: jest.fn(() => ({})),
    })),
  },
  hash160: jest.fn(() => Buffer.alloc(20)),
  taptweak_pubkey: jest.fn(() => Buffer.alloc(32)),
}));

// Mock SDK before imports
jest.mock('@ducat-unit/client-sdk', () => ({
  VaultWallet: jest.fn(),
  OracleAPI: {
    proto: {
      fetch_master_ctx: jest.fn(),
    },
  },
}));

// Mock signing service
jest.mock('../../signing', () => ({
  signPsbtRaw: jest.fn(),
  signPsbtWithSdkObject: jest.fn(),
  patchPreProcessFields: jest.fn((psbt) => psbt),
  patchPostProcessFields: jest.fn((psbt) => psbt),
  psbtPreProcess: jest.fn(),
  psbtPostProcess: jest.fn(),
}));

// Mock @cmdcode/buff
jest.mock('@cmdcode/buff', () => ({
  Buff: {
    hex: jest.fn(() => Buffer.alloc(32)),
    bytes: jest.fn(() => Buffer.alloc(32)),
  },
}));

// Mock bitcoinjs-lib
jest.mock('bitcoinjs-lib', () => ({
  Psbt: {
    fromBase64: jest.fn(() => ({
      data: { inputs: [] },
      signInput: jest.fn(),
      finalizeAllInputs: jest.fn(),
      extractTransaction: jest.fn(() => ({
        toHex: jest.fn(() => 'mocktxhex'),
        getId: jest.fn(() => 'mocktxid'),
      })),
    })),
  },
  Transaction: {
    fromHex: jest.fn(() => ({})),
  },
  crypto: {
    taggedHash: jest.fn(() => Buffer.alloc(32)),
  },
  initEccLib: jest.fn(),
}));

// Mock bip39
jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

// Mock bip32
jest.mock('bip32', () => ({
  BIP32Factory: jest.fn(() => ({
    fromSeed: jest.fn(() => ({
      derivePath: jest.fn(() => ({
        publicKey: Buffer.alloc(33),
        tweak: jest.fn(() => ({})),
      })),
    })),
  })),
}));

// Mock @bitcoinerlab/secp256k1
jest.mock('@bitcoinerlab/secp256k1', () => ({}));

// Mock secure storage
jest.mock('../../secureStorageService', () => ({
  withMnemonic: jest.fn(async (fn) => fn('mock mnemonic')),
  getCurrentAccountIndex: jest.fn(() => Promise.resolve(0)),
}));

// Mock balance service
jest.mock('../../balanceService', () => ({
  fetchUtxos: jest.fn(() => Promise.resolve([])),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock constants
jest.mock('../../../utils/constants', () => ({
  API: {
    VALIDATOR: 'https://validator.test',
    ESPLORA_URL: 'https://test.esplora.url',
    ORD_URL: 'https://test.ord.url',
  },
  VAULT_CONFIG: {
    UNIT_POSTAGE: 1000,
    TOKEN_POSTAGE: 1000,
  },
}));

jest.mock('../../../utils/apiClient', () => ({
  getJSON: jest.fn(),
}));

// Mock crypto helpers
jest.mock('../../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn((n: number) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5)),
  writeVarInt: jest.fn((buf: Buffer, value: number, offset: number) => {
    if (value < 0xfd) {
      buf[offset] = value;
      return 1;
    } else if (value <= 0xffff) {
      buf[offset] = 0xfd;
      buf.writeUInt16LE(value, offset + 1);
      return 3;
    }
    buf[offset] = 0xfe;
    buf.writeUInt32LE(value, offset + 1);
    return 5;
  }),
}));

import { readVarInt, createPsbtKv, encodeWitnessStack } from '../psbtBinaryUtils';
import { MASTER_CONTRACT_ID, WALLET_CFG } from '../types';

const MOCK_PROTO_PROFILE = {
  anchor_id: 'anchor',
  anchor_height: 1,
  anchor_index: 0,
  anchor_txid: 'anchor-txid',
  boot_height: 1,
  chain_network: 'mutiny',
  domain_hash: 'domain',
  chain_height: 2,
  contract_height: 3,
  contract_index: 0,
  contract_txid: 'contract-txid',
  contract_id: MASTER_CONTRACT_ID,
  proto_assets: [{ div: 2, id: '3007902:1', label: 'DUCAT•UNIT•MTNY', symbol: '$', supply: '1' }],
  proto_members: [
    { group: 21, idx: 0, pubkey: 'guard-pubkey' },
    { group: 22, idx: 0, pubkey: 'oracle-pubkey' },
  ],
  proto_terms: [],
};

describe('VaultWallet Types', () => {
  describe('MASTER_CONTRACT_ID', () => {
    it('should be a valid protocol contract ID format', () => {
      expect(MASTER_CONTRACT_ID).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should match the Dev mutinynet proto id', () => {
      expect(MASTER_CONTRACT_ID).toBe('4c7a39a8e71b5d891fe5321a2e6fc6cf72039c60096ee63f591ecc7ecfaba115');
    });
  });

  describe('WALLET_CFG', () => {
    it('should have required indexer config', () => {
      expect(WALLET_CFG.indexer).toBeDefined();
      expect(WALLET_CFG.indexer.esp).toBe('https://test.esplora.url');
      expect(WALLET_CFG.indexer.ord).toBe('https://test.ord.url');
    });

    it('should have network set to mutiny', () => {
      expect(WALLET_CFG.network).toBe('mutiny');
    });

    it('should have postage values', () => {
      expect(WALLET_CFG.postage).toBeDefined();
      expect(WALLET_CFG.postage.unit).toBe(1000);
      expect(WALLET_CFG.postage.vault).toBe(1000);
    });
  });
});

describe('PSBT Binary Utils', () => {
  describe('readVarInt', () => {
    it('should read single-byte varint (< 0xfd)', () => {
      const buffer = Buffer.from([0x05]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(5);
      expect(result.bytesRead).toBe(1);
    });

    it('should read 0x00 as zero', () => {
      const buffer = Buffer.from([0x00]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(0);
      expect(result.bytesRead).toBe(1);
    });

    it('should read 0xfc as 252', () => {
      const buffer = Buffer.from([0xfc]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(252);
      expect(result.bytesRead).toBe(1);
    });

    it('should read two-byte varint (0xfd prefix)', () => {
      const buffer = Buffer.from([0xfd, 0xfd, 0x00]); // 253 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(253);
      expect(result.bytesRead).toBe(3);
    });

    it('should read larger two-byte varint', () => {
      const buffer = Buffer.from([0xfd, 0xff, 0xff]); // 65535 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(65535);
      expect(result.bytesRead).toBe(3);
    });

    it('should read four-byte varint (0xfe prefix)', () => {
      const buffer = Buffer.from([0xfe, 0x00, 0x00, 0x01, 0x00]); // 65536 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(65536);
      expect(result.bytesRead).toBe(5);
    });

    it('should throw for 64-bit varint (0xff prefix)', () => {
      const buffer = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
      expect(() => readVarInt(buffer, 0)).toThrow('64-bit varint not supported');
    });

    it('should read varint at non-zero offset', () => {
      const buffer = Buffer.from([0xaa, 0xbb, 0x10]); // varint at offset 2
      const result = readVarInt(buffer, 2);
      expect(result.value).toBe(16);
      expect(result.bytesRead).toBe(1);
    });
  });

  describe('createPsbtKv', () => {
    it('should create key-value pair with small key and value', () => {
      const key = Buffer.from([0x01]);
      const value = Buffer.from([0xaa, 0xbb]);

      const result = createPsbtKv(key, value);

      // Should be: keyLen(1) + key(1) + valLen(1) + value(2) = 5 bytes
      expect(result.length).toBe(5);
      expect(result[0]).toBe(1); // key length
      expect(result[1]).toBe(0x01); // key
      expect(result[2]).toBe(2); // value length
      expect(result[3]).toBe(0xaa); // value byte 1
      expect(result[4]).toBe(0xbb); // value byte 2
    });

    it('should create key-value pair with empty value', () => {
      const key = Buffer.from([0x02]);
      const value = Buffer.alloc(0);

      const result = createPsbtKv(key, value);

      expect(result.length).toBe(3); // keyLen(1) + key(1) + valLen(1)
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(0x02);
      expect(result[2]).toBe(0);
    });

    it('should handle larger keys', () => {
      const key = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const value = Buffer.from([0xff]);

      const result = createPsbtKv(key, value);

      expect(result[0]).toBe(5); // key length
      expect(result.slice(1, 6)).toEqual(key);
      expect(result[6]).toBe(1); // value length
      expect(result[7]).toBe(0xff);
    });
  });

  describe('encodeWitnessStack', () => {
    it('should encode empty witness stack', () => {
      const witness: Buffer[] = [];
      const result = encodeWitnessStack(witness);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // item count = 0
    });

    it('should encode single witness element', () => {
      const witness = [Buffer.from([0xaa, 0xbb])];
      const result = encodeWitnessStack(witness);

      // count(1) + len(1) + data(2) = 4 bytes
      expect(result.length).toBe(4);
      expect(result[0]).toBe(1); // 1 item
      expect(result[1]).toBe(2); // length of first item
      expect(result[2]).toBe(0xaa);
      expect(result[3]).toBe(0xbb);
    });

    it('should encode multiple witness elements', () => {
      const witness = [
        Buffer.from([0x01]),
        Buffer.from([0x02, 0x03]),
        Buffer.from([0x04, 0x05, 0x06]),
      ];
      const result = encodeWitnessStack(witness);

      // count(1) + (len(1)+data(1)) + (len(1)+data(2)) + (len(1)+data(3)) = 10 bytes
      expect(result.length).toBe(10);
      expect(result[0]).toBe(3); // 3 items
    });

    it('should handle witness element with zero bytes', () => {
      const witness = [Buffer.alloc(0)];
      const result = encodeWitnessStack(witness);

      expect(result.length).toBe(2);
      expect(result[0]).toBe(1); // 1 item
      expect(result[1]).toBe(0); // length 0
    });

    it('should correctly encode 64-byte signature', () => {
      const sig = Buffer.alloc(64, 0xab);
      const witness = [sig];
      const result = encodeWitnessStack(witness);

      expect(result.length).toBe(1 + 1 + 64); // count + len + sig
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(64);
      expect(result.slice(2)).toEqual(sig);
    });
  });
});

describe('VaultWallet Index Re-exports', () => {
  it('should export types', () => {
    const index = require('../index');

    expect(index.MASTER_CONTRACT_ID).toBeDefined();
    expect(index.WALLET_CFG).toBeDefined();
  });

  it('should export PSBT utilities', () => {
    const index = require('../index');

    expect(index.readVarInt).toBeDefined();
    expect(index.countPsbtInputs).toBeDefined();
    expect(index.createPsbtKv).toBeDefined();
    expect(index.encodeWitnessStack).toBeDefined();
    expect(index.extractOpReturnFromPsbt).toBeDefined();
    expect(index.patchPsbtSignatures).toBeDefined();
    expect(index.patchPsbtInputFields).toBeDefined();
  });

  it('should export signing functions', () => {
    const index = require('../index');

    expect(index.signPsbtWithSdkObject).toBeDefined();
    expect(index.patchPreProcessFields).toBeDefined();
    expect(index.patchPostProcessFields).toBeDefined();
    expect(index.psbtPreProcess).toBeDefined();
    expect(index.psbtPostProcess).toBeDefined();
  });

  it('should export wallet creation functions', () => {
    const index = require('../index');

    expect(index.createMobileWalletAPI).toBeDefined();
    expect(index.fetchProtocolContract).toBeDefined();
    expect(index.createVaultWallet).toBeDefined();
  });
});

describe('Protocol contract loading', () => {
  const walletInfo = {
    segwitAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    segwitPubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    taprootAddress: 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
    taprootPubkey: 'a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c',
  };

  beforeEach(() => {
    jest.resetModules();
    const { OracleAPI } = require('@ducat-unit/client-sdk');
    const { getJSON } = require('../../../utils/apiClient');
    OracleAPI.proto.fetch_master_ctx.mockReset();
    getJSON.mockReset();
    getJSON.mockResolvedValue(MOCK_PROTO_PROFILE);
  });

  it('fetches the latest protocol contract from the validator', async () => {
    const { OracleAPI } = require('@ducat-unit/client-sdk');
    const { getJSON } = require('../../../utils/apiClient');
    const index = require('../index');

    const contract = await index.fetchProtocolContract();

    expect(contract.contract_id).toBe(index.MASTER_CONTRACT_ID);
    expect(getJSON).toHaveBeenCalledWith(
      'https://validator.test/api/proto/latest',
      expect.objectContaining({
        cacheKey: 'validator-proto-latest',
      })
    );
    expect(OracleAPI.proto.fetch_master_ctx).not.toHaveBeenCalled();
  });

  it('creates a VaultWallet from the validator protocol contract', async () => {
    const { OracleAPI, VaultWallet } = require('@ducat-unit/client-sdk');
    const index = require('../index');

    await index.createVaultWallet(walletInfo);

    expect(OracleAPI.proto.fetch_master_ctx).not.toHaveBeenCalled();
    expect(VaultWallet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ contract_id: index.MASTER_CONTRACT_ID }),
      expect.any(Object),
      index.WALLET_CFG
    );
  });
});

describe('MobileWalletInfo interface', () => {
  it('should accept valid wallet info', () => {
    const walletInfo = {
      segwitAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      segwitPubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      taprootAddress: 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
      taprootPubkey: 'a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c',
    };

    // Type check - this should compile without errors
    expect(walletInfo.segwitAddress).toMatch(/^tb1q/);
    expect(walletInfo.taprootAddress).toMatch(/^tb1p/);
    expect(walletInfo.segwitPubkey.length).toBe(66); // compressed pubkey
    expect(walletInfo.taprootPubkey.length).toBe(64); // x-only pubkey
  });
});
