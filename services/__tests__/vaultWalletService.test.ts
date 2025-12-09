// @ts-nocheck
/**
 * Tests for Vault Wallet Service
 * This service is a re-export module
 */

// Mock all SDK dependencies
jest.mock('@ducat-unit/client-sdk', () => ({
  VaultWallet: jest.fn(),
  OracleAPI: {
    proto: { fetch_master_ctx: jest.fn() },
    wallet: { fetch_address_bal: jest.fn(), fetch_rune_utxos: jest.fn(), fetch_vault_tokens: jest.fn() },
    esplora: { esplora_get_utxos: jest.fn() },
  },
}));

jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: { parse_address: jest.fn(() => ({ hex: '' })), parse_script_meta: jest.fn(() => ({})) },
  PSBT: { decode: jest.fn(() => ({ inputsLength: 0, getInput: jest.fn() })), encode: jest.fn() },
  hash160: jest.fn(() => ''),
  taptweak_pubkey: jest.fn(() => ''),
}));

jest.mock('bitcoinjs-lib', () => ({
  Psbt: { fromBase64: jest.fn(() => ({ data: { inputs: [] } })) },
  crypto: { taggedHash: jest.fn(() => Buffer.alloc(32)) },
}));

jest.mock('bip39', () => ({
  mnemonicToSeedSync: jest.fn(() => Buffer.alloc(64)),
}));

jest.mock('@cmdcode/buff', () => ({
  Buff: { hex: jest.fn(() => Buffer.alloc(32)) },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/constants', () => ({
  API: { ESPLORA_URL: 'https://test', ORD_URL: 'https://test', GUARDIAN_WS: 'wss://test' },
  VAULT_CONFIG: { TX_TIMEOUT: 30000 },
  SECURE_KEYS: { CURRENT_ACCOUNT: 'current_account' },
}));

jest.mock('../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn(() => 1),
  writeVarInt: jest.fn(),
  bip32: { fromSeed: jest.fn(() => ({ derivePath: jest.fn(() => ({})) })) },
  ecc: { signSchnorr: jest.fn(() => Buffer.alloc(64)) },
  getECPair: jest.fn(() => ({ fromPrivateKey: jest.fn() })),
}));

jest.mock('../../utils/wallet/psbtSigning', () => ({
  signPsbtRaw: jest.fn(),
}));

jest.mock('../secureStorageService', () => ({
  withMnemonic: jest.fn(async (fn) => fn('test mnemonic')),
}));

describe('vaultWalletService', () => {
  it('should re-export from vaultWallet module', () => {
    const service = require('../vaultWalletService');
    expect(service).toBeDefined();
  });

  it('should export type constants', () => {
    const service = require('../vaultWalletService');
    expect(service.MASTER_CONTRACT_ID).toBeDefined();
    expect(service.WALLET_CFG).toBeDefined();
  });

  it('should export PSBT binary utilities', () => {
    const service = require('../vaultWalletService');
    expect(service.readVarInt).toBeDefined();
    expect(service.countPsbtInputs).toBeDefined();
    expect(service.createPsbtKv).toBeDefined();
    expect(service.encodeWitnessStack).toBeDefined();
    expect(service.extractOpReturnFromPsbt).toBeDefined();
    expect(service.patchPsbtSignatures).toBeDefined();
    expect(service.patchPsbtInputFields).toBeDefined();
  });

  it('should export signing functions', () => {
    const service = require('../vaultWalletService');
    expect(service.signPsbtWithSdkObject).toBeDefined();
    expect(service.patchPreProcessFields).toBeDefined();
    expect(service.patchPostProcessFields).toBeDefined();
    expect(service.psbtPreProcess).toBeDefined();
    expect(service.psbtPostProcess).toBeDefined();
  });

  it('should export wallet API functions', () => {
    const service = require('../vaultWalletService');
    expect(service.createMobileWalletAPI).toBeDefined();
    expect(service.fetchProtocolContract).toBeDefined();
    expect(service.createVaultWallet).toBeDefined();
  });
});
