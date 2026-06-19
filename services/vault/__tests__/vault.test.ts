/**
 * Tests for Vault Operations Module
 * Tests utility functions and config creators for vault operations
 */

// Mock SDK utilities before imports
jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: {
    get_txid: jest.fn(() => 'mock_txid'),
  },
  PSBT: {
    decode: jest.fn(() => ({
      inputsLength: 1,
      getInput: jest.fn(() => ({})),
    })),
  },
}));

// Mock SDK
jest.mock('@ducat-unit/client-sdk', () => ({
  CONST: {
    TXMAP: {
      repay: {
        vault_tx: { vin: { vault: 0, conn: 1 } },
        acct_tx: { vin: { acct: 1 } },
      },
    },
  },
  VaultAPI: {
    deposit: {
      get_change: jest.fn(() => 1_000),
    },
    open: {
      get_change: jest.fn(() => 1_000),
    },
    repay: {
      create_psbt1: jest.fn(() => 'repay-account-psbt'),
      create_psbt2: jest.fn(() => 'repay-vault-psbt'),
      create_req: jest.fn(() => ({
        sats_inputs: [{}],
        unit_inputs: [{}],
      })),
    },
  },
  OracleAPI: {
    vault: {
      fetch_vault_prevout: jest.fn(),
    },
  },
}));

// Mock logger to prevent console output during tests
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock generateVaultName for consistent test output
jest.mock('../../../utils/vaultUtils', () => ({
  generateVaultName: jest.fn(() => 'Test Vault'),
}));

// Mock other dependencies
jest.mock('../../oracleService', () => ({
  fetchPriceQuote: jest.fn(),
}));

jest.mock('../../guardianService', () => ({
  withGuardianTimeout: jest.fn((promise) => promise),
}));

jest.mock('../../../utils/constants', () => ({
  API: {
    ORD_BASE: 'https://ord.test',
    VAULT: 'https://validator.test/api',
  },
  VAULT_CONFIG: {
    VIN_ALLOWANCE: 200,
    TX_TIMEOUT: 30000,
    RUNE_LABEL: 'UNIT',
  },
  BITCOIN_TX: {
    DUST_LIMIT: 546,
    SATOSHIS_PER_BTC: 100_000_000,
    ESTIMATED_TX_FEE: 1_000,
    RUNE_OUTPUT_AMOUNT: 10_000,
    TX_TIMEOUT_BUFFER: 5_000,
  },
  getTxOutspendUrl: jest.fn(
    (txid: string, vout: number) => `https://esplora.test/tx/${txid}/outspend/${vout}`
  ),
}));

jest.mock('../../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn((n) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5)),
}));

jest.mock('../../../utils/nativeHttp', () => ({
  getJsonWithNativeTimeout: jest.fn(),
}));

import {
  readVarInt,
  extractOpReturnFromTxHex,
  checkBatchAllowed,
  normalizeMasterId,
  normalizeVaultAction,
  computeVaultPrevoutFromTx,
  resolveLatestUnspentVaultPrevout,
  buildVaultProfile,
} from '../utils';
import { createVaultConfig } from '../open';
import { createBorrowConfig } from '../borrow';
import { createDepositConfig } from '../deposit';
import { createRepayConfig } from '../repay';
import { createWithdrawConfig } from '../withdraw';
import {
  createMockWalletForBatchCheck,
  createMockTxForPrevout,
  type MockVaultWalletForBatchCheck,
  type MockTxForPrevout,
  type MockVaultHistoryTx,
} from './mockTypes';
import { getJsonWithNativeTimeout } from '../../../utils/nativeHttp';

describe('Vault Utils', () => {
  describe('readVarInt', () => {
    it('should read single-byte varint (< 0xfd)', () => {
      const buffer = Buffer.from([0x05]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(5);
      expect(result.bytesRead).toBe(1);
    });

    it('should read two-byte varint (0xfd prefix)', () => {
      const buffer = Buffer.from([0xfd, 0x00, 0x01]); // 256 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(256);
      expect(result.bytesRead).toBe(3);
    });

    it('should read four-byte varint (0xfe prefix)', () => {
      const buffer = Buffer.from([0xfe, 0x00, 0x00, 0x01, 0x00]); // 65536 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(65536);
      expect(result.bytesRead).toBe(5);
    });

    it('should throw for 64-bit varint', () => {
      const buffer = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
      expect(() => readVarInt(buffer, 0)).toThrow('64-bit varint not supported');
    });

    it('should reject out-of-bounds offsets', () => {
      const buffer = Buffer.from([0x05]);
      expect(() => readVarInt(buffer, -1)).toThrow('Varint offset out of bounds');
      expect(() => readVarInt(buffer, 1)).toThrow('Varint offset out of bounds');
    });

    it('should reject truncated multi-byte varints', () => {
      expect(() => readVarInt(Buffer.from([0xfd, 0x01]), 0)).toThrow('Truncated 16-bit varint');
      expect(() => readVarInt(Buffer.from([0xfe, 0x01, 0x02, 0x03]), 0)).toThrow(
        'Truncated 32-bit varint'
      );
    });

    it('should read varint at offset', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x10]); // varint at offset 2
      const result = readVarInt(buffer, 2);
      expect(result.value).toBe(16);
      expect(result.bytesRead).toBe(1);
    });
  });

  describe('extractOpReturnFromTxHex', () => {
    it('should return null for undefined input', () => {
      expect(extractOpReturnFromTxHex(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractOpReturnFromTxHex('')).toBeNull();
    });

    it('should return error string for invalid hex', () => {
      const result = extractOpReturnFromTxHex('invalidhex');
      expect(result).toContain('error:');
    });

    it('should extract OP_RETURN from a non-witness raw transaction', () => {
      const p2wpkhScript = `0014${'11'.repeat(20)}`;
      const txHex = [
        '01000000',
        '01',
        '00'.repeat(32),
        '00000000',
        '00',
        'ffffffff',
        '02',
        'e803000000000000',
        '16',
        p2wpkhScript,
        '0000000000000000',
        '03',
        '6a5d01',
        '00000000',
      ].join('');

      expect(extractOpReturnFromTxHex(txHex)).toBe('6a5d01');
    });

    it('should extract OP_RETURN from a witness raw transaction', () => {
      const txHex = [
        '02000000',
        '0001',
        '01',
        '11'.repeat(32),
        '01000000',
        '00',
        'ffffffff',
        '01',
        '0000000000000000',
        '03',
        '6a5d02',
        '01',
        '00',
        '00000000',
      ].join('');

      expect(extractOpReturnFromTxHex(txHex)).toBe('6a5d02');
    });

    it('should return null when no OP_RETURN output exists', () => {
      const p2wpkhScript = `0014${'11'.repeat(20)}`;
      const txHex = [
        '01000000',
        '01',
        '00'.repeat(32),
        '00000000',
        '00',
        'ffffffff',
        '01',
        'e803000000000000',
        '16',
        p2wpkhScript,
        '00000000',
      ].join('');

      expect(extractOpReturnFromTxHex(txHex)).toBeNull();
    });
  });

  describe('checkBatchAllowed', () => {
    it('should return true for native segwit testnet address (tb1q)', () => {
      const wallet = createMockWalletForBatchCheck('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(true);
    });

    it('should return false for native segwit mainnet address (bc1q)', () => {
      const wallet = createMockWalletForBatchCheck('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(false);
    });

    it('should return false for taproot address (tb1p)', () => {
      const wallet = createMockWalletForBatchCheck(
        'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv'
      );
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(false);
    });

    it('should return false for legacy address', () => {
      const wallet = createMockWalletForBatchCheck('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(false);
    });

    it('should return false for empty address', () => {
      const wallet = createMockWalletForBatchCheck('');
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(false);
    });

    it('should return false and not throw for missing acct', () => {
      const wallet: MockVaultWalletForBatchCheck = {};
      expect(checkBatchAllowed(wallet as Parameters<typeof checkBatchAllowed>[0])).toBe(false);
    });
  });

  describe('normalizeMasterId', () => {
    it('should add i0 suffix if not present', () => {
      expect(normalizeMasterId('abc123')).toBe('abc123i0');
    });

    it('should not add suffix if i is already present', () => {
      expect(normalizeMasterId('abc123i5')).toBe('abc123i5');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeMasterId('')).toBe('');
    });

    it('should handle master_id with i0 suffix', () => {
      expect(normalizeMasterId('abc123i0')).toBe('abc123i0');
    });

    it('should only treat a trailing inscription index as already normalized', () => {
      expect(normalizeMasterId('mix123')).toBe('mix123i0');
    });
  });

  describe('normalizeVaultAction', () => {
    it('should map full action names to codes', () => {
      expect(normalizeVaultAction('Open')).toBe('o');
      expect(normalizeVaultAction('Borrow')).toBe('b');
      expect(normalizeVaultAction('Repay')).toBe('r');
      expect(normalizeVaultAction('Deposit')).toBe('d');
      expect(normalizeVaultAction('Withdraw')).toBe('w');
      expect(normalizeVaultAction('Liquidate')).toBe('l');
      expect(normalizeVaultAction('Liquidation')).toBe('l');
      expect(normalizeVaultAction('Repo')).toBe('l');
      expect(normalizeVaultAction('Trim')).toBe('l');
      expect(normalizeVaultAction('Close')).toBe('x');
    });

    it('should map lowercase action names to codes', () => {
      expect(normalizeVaultAction('open')).toBe('o');
      expect(normalizeVaultAction('borrow')).toBe('b');
      expect(normalizeVaultAction('repay')).toBe('r');
      expect(normalizeVaultAction('deposit')).toBe('d');
      expect(normalizeVaultAction('withdraw')).toBe('w');
      expect(normalizeVaultAction('liquidate')).toBe('l');
      expect(normalizeVaultAction('liquidation')).toBe('l');
      expect(normalizeVaultAction('repo')).toBe('l');
      expect(normalizeVaultAction('trim')).toBe('l');
      expect(normalizeVaultAction('close')).toBe('x');
    });

    it('should pass through single char codes', () => {
      expect(normalizeVaultAction('o')).toBe('o');
      expect(normalizeVaultAction('b')).toBe('b');
      expect(normalizeVaultAction('r')).toBe('r');
      expect(normalizeVaultAction('d')).toBe('d');
      expect(normalizeVaultAction('w')).toBe('w');
      expect(normalizeVaultAction('l')).toBe('l');
      expect(normalizeVaultAction('x')).toBe('x');
    });

    it('should default to "o" for unknown action', () => {
      expect(normalizeVaultAction('unknown')).toBe('o');
      expect(normalizeVaultAction('')).toBe('o');
    });
  });

  describe('computeVaultPrevoutFromTx', () => {
    // These tests verify defensive behavior with missing required fields
    it('should return null if utxo is missing', () => {
      const tx: MockVaultHistoryTx = {
        transaction_id: 'abc123',
        utxo: undefined, // Intentionally missing to test defensive handling
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };
      expect(computeVaultPrevoutFromTx(tx)).toBeNull();
    });

    it('should return null if transaction_id is missing', () => {
      const tx: MockVaultHistoryTx = {
        transaction_id: undefined, // Intentionally missing to test defensive handling
        utxo: 'txid:0',
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };
      expect(computeVaultPrevoutFromTx(tx)).toBeNull();
    });

    it('should create VaultPrevout from valid transaction', () => {
      const tx = {
        transaction_id: 'abc123def456',
        utxo: 'abc123def456:1',
        utxo_script: '5120abcd1234',
        liquidation_hash: 'liquidhash',
        liquidation_threshold: 135,
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };

      const result = computeVaultPrevoutFromTx(tx);

      expect(result).not.toBeNull();
      expect(result?.rdata.unit_balance).toBe(1000);
      expect(result?.rdata.unit_price).toBe(50000);
      expect(result?.rdata.unit_stamp).toBe(1234567890);
      expect(result?.rdata.vault_action).toBe('o');
      expect(result?.utxo.txid).toBe('abc123def456');
      expect(result?.utxo.vout).toBe(1);
      expect(result?.utxo.value).toBe(100000);
    });

    it('should return null for malformed utxo references', () => {
      const baseTx: MockVaultHistoryTx = {
        transaction_id: 'abc123',
        utxo: 'abc123:not-a-vout',
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };

      expect(computeVaultPrevoutFromTx(baseTx)).toBeNull();
      expect(computeVaultPrevoutFromTx({ ...baseTx, utxo: 'abc123:-1' })).toBeNull();
      expect(computeVaultPrevoutFromTx({ ...baseTx, utxo: 'abc123:0:extra' })).toBeNull();
      expect(computeVaultPrevoutFromTx({ ...baseTx, utxo: ':0' })).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const tx: MockVaultHistoryTx = {
        transaction_id: 'abc123',
        utxo: 'abc123:0',
        amount_borrowed: 500,
        oracle_price: 40000,
        timestamp: 1234567890,
        action: 'Borrow',
        vault_amount: 50000,
      };

      const result = computeVaultPrevoutFromTx(tx);

      expect(result).not.toBeNull();
      expect(result?.rdata.thold_hash).toBe('');
      expect(result?.rdata.thold_price).toBe(0);
      expect(result?.utxo.script).toBe('');
    });
  });

  describe('resolveLatestUnspentVaultPrevout', () => {
    const mockGetJsonWithNativeTimeout = getJsonWithNativeTimeout as jest.MockedFunction<
      typeof getJsonWithNativeTimeout
    >;

    beforeEach(() => {
      mockGetJsonWithNativeTimeout.mockReset();
    });

    function makePrevout(txid: string, vout = 0) {
      return {
        rdata: {
          is_locked: false,
          thold_hash: 'hash',
          thold_price: 135,
          unit_balance: 1000,
          unit_price: 50000,
          unit_stamp: 1234567890,
          vault_action: 'o' as const,
        },
        utxo: {
          value: 100000,
          script: '5120abcd',
          txid,
          vout,
        },
      };
    }

    it('should follow a long stale validator chain to the unspent vault head', async () => {
      const replacementCount = 65;
      const txids = Array.from({ length: replacementCount + 1 }, (_, index) => `vault-tx-${index}`);

      mockGetJsonWithNativeTimeout.mockImplementation(async (url: string) => {
        const match = /\/tx\/([^/]+)\/outspend\/(\d+)$/.exec(url);
        if (match) {
          const txid = match[1];
          const index = txids.indexOf(txid || '');

          if (index >= 0 && index < replacementCount) {
            return {
              spent: true,
              txid: txids[index + 1],
              vin: 0,
            };
          }

          return { spent: false };
        }

        const latestMatch = /\/vault\/([^/]+)\/latest$/.exec(url);
        if (latestMatch) {
          const rootTxid = latestMatch[1];
          const nextIndex = txids.indexOf(rootTxid) + mockGetJsonWithNativeTimeout.mock.calls
            .filter(([calledUrl]) => /\/vault\/([^/]+)\/latest$/.test(String(calledUrl)))
            .length;
          return {
            coin_id: `${txids[nextIndex]}:0`,
            root_txid: txids[0],
            price_commits: [{ base_price: 50000, thold_hash: 'hash', thold_price: 135 }],
            price_stamp: 1234567890,
            unit_balance: 1000,
            unit_price: 50000,
            vault_action: 'open',
            vault_balance: 100000,
            vault_script: '5120abcd',
          };
        }

        throw new Error(`unexpected url: ${url}`);
      });

      const result = await resolveLatestUnspentVaultPrevout(makePrevout(txids[0]));

      expect(result.replaced).toBe(true);
      expect(result.hopCount).toBe(replacementCount);
      expect(result.prevout.utxo.txid).toBe(txids[replacementCount]);
      expect(
        mockGetJsonWithNativeTimeout.mock.calls.filter(([url]) =>
          /\/vault\/([^/]+)\/latest$/.test(String(url))
        )
      ).toHaveLength(replacementCount);
    });

    it('should still fail closed when the spend chain exceeds the hard cap', async () => {
      mockGetJsonWithNativeTimeout.mockImplementation(async (url: string) => {
        const match = /\/tx\/([^/]+)\/outspend\/(\d+)$/.exec(url);
        if (match) {
          return {
            spent: true,
            txid: `${match[1]}-spend`,
            vin: 0,
          };
        }

        const latestMatch = /\/vault\/([^/]+)\/latest$/.exec(url);
        if (latestMatch) {
          return {
            coin_id: `${latestMatch[1]}-spend:0`,
            root_txid: latestMatch[1],
            price_commits: [{ base_price: 50000, thold_hash: 'hash', thold_price: 135 }],
            price_stamp: 1234567890,
            unit_balance: 1000,
            unit_price: 50000,
            vault_action: 'open',
            vault_balance: 100000,
            vault_script: '5120abcd',
          };
        }

        throw new Error(`unexpected url: ${url}`);
      });

      await expect(resolveLatestUnspentVaultPrevout(makePrevout('loop-tx-start'), 1)).rejects.toThrow(
        'Could not resolve the latest vault UTXO before the safety hop limit.'
      );
    });
  });

  describe('buildVaultProfile', () => {
    it('should build VaultProfile from vault data', () => {
      const vaultPubkey = 'vaultpubkey123';
      const vaultInfo = {
        creation_account: 'acct123',
        guard_pubkey: 'guard456',
        master_id: 'master789',
      };
      const vaultPrevout = {
        rdata: {
          is_locked: false,
          thold_hash: 'hash',
          thold_price: 135,
          unit_balance: 1000,
          unit_price: 50000,
          unit_stamp: 1234567890,
          vault_action: 'o' as const,
        },
        utxo: {
          value: 100000,
          script: 'script',
          txid: 'txid',
          vout: 0,
        },
      };

      const profile = buildVaultProfile(vaultPubkey, vaultInfo, vaultPrevout);

      expect(profile.acct_id).toBe('acct123');
      expect(profile.guard_pk).toBe('guard456');
      expect(profile.master_id).toBe('master789i0'); // Should be normalized
      expect(profile.vault_pk).toBe('vaultpubkey123');
      expect(profile.rdata).toEqual(vaultPrevout.rdata);
      expect(profile.utxo).toEqual(vaultPrevout.utxo);
    });

    it('should preserve signed latest validator profiles for follow-up actions', () => {
      const latestProfile = {
        coin_id: 'txid:0',
        client_pubkey: 'a'.repeat(64),
        contract_id: 'b'.repeat(64),
        guard_members: ['c'.repeat(64)],
        guard_pubkey: 'c'.repeat(64),
        price_commits: [
          {
            base_price: 50000,
            oracle_pubkey: 'd'.repeat(64),
            oracle_sig: 'e'.repeat(128),
            thold_hash: 'f'.repeat(40),
            thold_price: 30000,
          },
        ],
        price_stamp: 1234567890,
        root_txid: '1'.repeat(64),
        thold_price: 30000,
        unit_balance: 1000,
        unit_price: 50000,
        vault_action: 'open',
        vault_balance: 100000,
        vault_config: { label: 'vault-test' },
        vault_ratio: 2,
        vault_script: '5120abcd',
        vault_value: 100000,
        vault_version: 3,
      };
      const vaultPrevout = {
        rdata: {
          is_locked: false,
          thold_hash: 'hash',
          thold_price: 135,
          unit_balance: 1000,
          unit_price: 50000,
          unit_stamp: 1234567890,
          vault_action: 'o' as const,
        },
        utxo: {
          value: 100000,
          script: 'script',
          txid: 'txid',
          vout: 0,
        },
      };

      const profile = buildVaultProfile('a'.repeat(64), {
        creation_account: 'acct123',
        guard_pubkey: 'c'.repeat(64),
        latest_profile: latestProfile,
        master_id: 'b'.repeat(64),
      }, vaultPrevout);

      expect(profile).toMatchObject({
        coin_id: 'txid:0',
        client_pubkey: 'a'.repeat(64),
        price_commits: [
          expect.objectContaining({
            oracle_sig: 'e'.repeat(128),
          }),
        ],
      });
      expect((profile as { rdata?: unknown }).rdata).toBeUndefined();
    });

    it('should normalize master_id with i suffix', () => {
      const vaultPubkey = 'pk';
      const vaultInfo = {
        creation_account: 'acct',
        guard_pubkey: 'guard',
        master_id: 'masteri5',
      };
      const vaultPrevout = {
        rdata: {} as any,
        utxo: {} as any,
      };

      const profile = buildVaultProfile(vaultPubkey, vaultInfo, vaultPrevout);
      expect(profile.master_id).toBe('masteri5'); // Already has trailing index, no change
    });
  });
});

describe('Vault Config Creators', () => {
  describe('createVaultConfig (open)', () => {
    it('should create vault open config with correct conversions', () => {
      const config = createVaultConfig(100, 0.001, 5);

      expect(config.borrow_amount).toBe(10000); // 100 * 100 = 10000 cents
      expect(config.deposit_amount).toBe(100000); // 0.001 * 100_000_000 = 100000 sats
      expect(config.vault_label).toBe('Test Vault');
      expect(config.tx_feerate).toBe(5);
    });

    it('should handle decimal unit amounts', () => {
      const config = createVaultConfig(10.5, 0.0001, 1);

      expect(config.borrow_amount).toBe(1050); // 10.5 * 100 = 1050 cents
      expect(config.deposit_amount).toBe(10000); // 0.0001 * 100_000_000 = 10000 sats
    });

    it('should handle zero values', () => {
      const config = createVaultConfig(0, 0, 1);

      expect(config.borrow_amount).toBe(0);
      expect(config.deposit_amount).toBe(0);
    });
  });

  describe('createBorrowConfig', () => {
    it('should create borrow config with correct conversions', () => {
      const config = createBorrowConfig(50, 3);

      expect(config.borrow_amount).toBe(5000); // 50 * 100 = 5000 cents
      expect(config.deposit_amount).toBe(0);
      expect(config.tx_feerate).toBe(3);
    });

    it('should handle decimal amounts', () => {
      const config = createBorrowConfig(25.75, 2);

      expect(config.borrow_amount).toBe(2575); // 25.75 * 100 = 2575 cents
    });
  });

  describe('createDepositConfig', () => {
    it('should create deposit config in satoshis', () => {
      const config = createDepositConfig(50000, 5);

      expect(config.deposit_amount).toBe(50000);
      expect(config.tx_feerate).toBe(5);
    });

    it('should handle large sats amounts', () => {
      const config = createDepositConfig(100000000, 1); // 1 BTC in sats

      expect(config.deposit_amount).toBe(100000000);
    });
  });

  describe('createRepayConfig', () => {
    it('should create repay config with correct conversions', () => {
      const config = createRepayConfig(75, 4);

      expect(config.repay_amount).toBe(7500); // 75 * 100 = 7500 cents
      expect(config.deposit_amount).toBe(0);
      expect(config.tx_feerate).toBe(4);
    });

    it('should handle decimal repay amounts', () => {
      const config = createRepayConfig(33.33, 2);

      expect(config.repay_amount).toBe(3333); // 33.33 * 100 = 3333 cents
    });
  });

  describe('createWithdrawConfig', () => {
    it('should create withdraw config in satoshis', () => {
      const config = createWithdrawConfig(25000, 3);

      expect(config.change_amount).toBe(25000);
      expect(config.tx_feerate).toBe(3);
    });
  });
});

describe('Vault Guardian Operations', () => {
  describe('guardianOpenVaultReserve', () => {
    it('should reserve UNIT from guardian for vault opening', async () => {
      const { guardianOpenVaultReserve } = require('../open');
      const mockGuardianClient = {
        req: {
          unit: {
            reserve: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                mint_account: 'mint_acct_123',
                unit_amount: 10000,
              }),
            }),
          },
        },
      };

      const vaultConfig = {
        borrow_amount: 10000,
        deposit_amount: 100000,
        vault_label: 'test-vault',
        tx_feerate: 5,
      };

      const result = await guardianOpenVaultReserve(
        mockGuardianClient,
        vaultConfig,
        'vault_pubkey_123'
      );

      expect(result.mint_account).toBe('mint_acct_123');
      expect(mockGuardianClient.req.unit.reserve).toHaveBeenCalledWith({
        unit_amount: 10000,
        vault_action: 'open',
        vault_pubkey: 'vault_pubkey_123',
      });
    });
  });

  describe('guardianSendReqOpen', () => {
    it('should submit vault request to guardian', async () => {
      const { guardianSendReqOpen } = require('../open');
      const mockGuardianClient = {
        req: {
          vault: {
            open: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                issue_txid: 'txid_abc123',
              }),
            }),
          },
        },
      };

      const vaultReq = {
        issue_txid: 'txid_abc123',
        vault_txid: 'vault_txid_456',
      };

      const result = await guardianSendReqOpen(mockGuardianClient, vaultReq);

      expect(result).toBe('txid_abc123');
      expect(mockGuardianClient.req.vault.open).toHaveBeenCalledWith(vaultReq);
    });

    it('should throw on guardian error', async () => {
      const { guardianSendReqOpen } = require('../open');
      const mockGuardianClient = {
        req: {
          vault: {
            open: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(new Error('Guardian error')),
            }),
          },
        },
      };

      await expect(guardianSendReqOpen(mockGuardianClient, {})).rejects.toThrow('Guardian error');
    });
  });

  describe('guardianBorrowReserve', () => {
    it('should reserve UNIT from guardian for borrowing', async () => {
      const { guardianBorrowReserve } = require('../borrow');
      const mockGuardianClient = {
        req: {
          unit: {
            reserve: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                mint_account: 'borrow_acct_123',
              }),
            }),
          },
        },
      };

      const borrowConfig = {
        borrow_amount: 5000,
        deposit_amount: 0,
        tx_feerate: 3,
      };

      const result = await guardianBorrowReserve(
        mockGuardianClient,
        borrowConfig,
        'vault_pubkey_borrow'
      );

      expect(result.mint_account).toBe('borrow_acct_123');
      expect(mockGuardianClient.req.unit.reserve).toHaveBeenCalledWith({
        unit_amount: 5000,
        vault_action: 'borrow',
        vault_pubkey: 'vault_pubkey_borrow',
      });
    });
  });

  describe('guardianSendReqBorrow', () => {
    it('should submit borrow request to guardian and return txids', async () => {
      const { guardianSendReqBorrow } = require('../borrow');
      const mockGuardianClient = {
        req: {
          vault: {
            borrow: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                issue_txid: 'borrow_issue_txid',
                vault_txid: 'borrow_vault_txid',
              }),
            }),
          },
        },
      };

      const borrowReq = {
        issue_txid: 'borrow_issue_txid',
        vault_txid: 'borrow_vault_txid',
      };

      const result = await guardianSendReqBorrow(mockGuardianClient, borrowReq);

      expect(result.txid).toBe('borrow_issue_txid');
      expect(result.vault_txid).toBe('borrow_vault_txid');
      expect(mockGuardianClient.req.vault.borrow).toHaveBeenCalledWith(borrowReq);
    });

    it('should throw on guardian error', async () => {
      const { guardianSendReqBorrow } = require('../borrow');
      const mockGuardianClient = {
        req: {
          vault: {
            borrow: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(new Error('Borrow failed')),
            }),
          },
        },
      };

      await expect(guardianSendReqBorrow(mockGuardianClient, {})).rejects.toThrow('Borrow failed');
    });
  });

  describe('guardianRepayReserve', () => {
    it('should reserve account from guardian for repay', async () => {
      const { guardianRepayReserve } = require('../repay');
      const mockGuardianClient = {
        req: {
          unit: {
            reserve: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                burn_account: 'burn_acct_123',
              }),
            }),
          },
        },
      };

      const repayConfig = {
        repay_amount: 7500,
        deposit_amount: 0,
        tx_feerate: 4,
      };

      const result = await guardianRepayReserve(
        mockGuardianClient,
        repayConfig,
        'vault_pubkey_repay'
      );

      expect(result.burn_account).toBe('burn_acct_123');
    });
  });

  describe('guardianSendReqRepay', () => {
    it('should submit repay request to guardian and return txids', async () => {
      const { guardianSendReqRepay } = require('../repay');
      const mockGuardianClient = {
        req: {
          vault: {
            repay: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                repay_txid: 'repay_burn_txid',
                vault_txid: 'repay_vault_txid',
              }),
            }),
          },
        },
      };

      const repayReq = {
        repay_txid: 'repay_burn_txid',
        vault_txid: 'repay_vault_txid',
      };

      const result = await guardianSendReqRepay(mockGuardianClient, repayReq);

      expect(result.txid).toBe('repay_burn_txid');
      expect(result.vault_txid).toBe('repay_vault_txid');
      expect(mockGuardianClient.req.vault.repay).toHaveBeenCalledWith(repayReq);
    });

    it('should throw on guardian error', async () => {
      const { guardianSendReqRepay } = require('../repay');
      const mockGuardianClient = {
        req: {
          vault: {
            repay: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(new Error('Repay failed')),
            }),
          },
        },
      };

      await expect(guardianSendReqRepay(mockGuardianClient, {})).rejects.toThrow('Repay failed');
    });
  });

  describe('guardianSendReqDeposit', () => {
    it('should submit deposit request to guardian', async () => {
      const { guardianSendReqDeposit } = require('../deposit');
      const mockGuardianClient = {
        req: {
          vault: {
            deposit: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                vault_txid: 'deposit_vault_txid',
              }),
            }),
          },
        },
      };

      const result = await guardianSendReqDeposit(mockGuardianClient, {});

      expect(result.vault_txid).toBe('deposit_vault_txid');
    });
  });

  describe('guardianSendReqWithdraw', () => {
    it('should submit withdraw request to guardian', async () => {
      const { guardianSendReqWithdraw } = require('../withdraw');
      const mockGuardianClient = {
        req: {
          vault: {
            withdraw: jest.fn().mockReturnValue({
              resolve: jest.fn().mockResolvedValue({
                vault_txid: 'withdraw_vault_txid',
              }),
            }),
          },
        },
      };

      const result = await guardianSendReqWithdraw(mockGuardianClient, {});

      expect(result.vault_txid).toBe('withdraw_vault_txid');
    });
  });
});

describe('Vault Request Creation', () => {
  const mockVaultProfile = {
    acct_id: 'test_acct',
    guard_pk: 'guard_pubkey_12345678901234567890',
    master_id: 'master123i0',
    vault_pk: 'vault_pubkey_12345678901234567890',
    rdata: {
      is_locked: false,
      thold_hash: 'hash',
      thold_price: 135,
      unit_balance: 1000,
      unit_price: 50000,
      unit_stamp: 1234567890,
      vault_action: 'o' as const,
    },
    utxo: {
      value: 100000,
      script: 'script',
      txid: 'txid',
      vout: 0,
    },
  };

  const mockOracleQuote = {
    price: 50000,
    timestamp: 1234567890,
  };

  describe('createVaultReqOpen', () => {
    it('should create vault open request successfully', async () => {
      const { createVaultReqOpen } = require('../open');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockResolvedValue(mockOracleQuote);

      const mockWallet = {
        vault: {
          open: {
            ctx: jest.fn().mockReturnValue({ config: 'open_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 1500 }),
            req: jest.fn().mockResolvedValue({
              issue_txid: 'open_issue',
              vault_txid: 'open_vault',
              issue_txhex: '0200000001',
              vault_txhex: '0200000002',
              issue_psbt: Buffer.from('psbt1'),
              vault_psbt: Buffer.from('psbt2'),
              sats_inputs: [{ txid: 'sats', vout: 0, value: 5000, witness: [] }],
              connect_input: { txid: 'connect', vout: 1, value: 10000, witness: [] },
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 10000 }]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const vaultConfig = {
        borrow_amount: 10000,
        deposit_amount: 100000,
        vault_label: 'test',
        tx_feerate: 5,
      };
      const acctRes = { mint_account: 'mint_open' };
      const options = { feeRate: 5, isMaxDeposit: false, liquidationPrice: 45000 };

      const result = await createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options);

      expect(fetchPriceQuote).toHaveBeenCalledWith(45000);
      expect(mockWallet.vault.open.ctx).toHaveBeenCalledWith(
        'mint_open',
        mockOracleQuote,
        vaultConfig
      );
      expect(result.issue_txid).toBe('open_issue');
      expect(result.vault_txid).toBe('open_vault');
    });

    it('should throw when no UTXOs available', async () => {
      const { createVaultReqOpen } = require('../open');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockResolvedValue(mockOracleQuote);

      const mockWallet = {
        vault: {
          open: {
            ctx: jest.fn().mockReturnValue({ config: 'open_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 1500 }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const vaultConfig = {
        borrow_amount: 10000,
        deposit_amount: 100000,
        vault_label: 'test',
        tx_feerate: 5,
      };
      const acctRes = { mint_account: 'mint_open' };
      const options = { feeRate: 5, isMaxDeposit: false, liquidationPrice: 45000 };

      await expect(
        createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options)
      ).rejects.toThrow('No UTXOs available for vault deposit');
    });

    it('should use provided UTXOs for max deposit', async () => {
      const { createVaultReqOpen } = require('../open');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockResolvedValue(mockOracleQuote);

      const mockWallet = {
        vault: {
          open: {
            ctx: jest.fn().mockReturnValue({ config: 'open_ctx' }),
            req: jest.fn().mockResolvedValue({
              issue_txid: 'open_issue',
              vault_txid: 'open_vault',
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn(),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const providedUtxos = [{ txid: 'provided', vout: 0, value: 50000 }];
      const vaultConfig = {
        borrow_amount: 10000,
        deposit_amount: 100000,
        vault_label: 'test',
        tx_feerate: 5,
      };
      const acctRes = { mint_account: 'mint_open' };
      const options = {
        feeRate: 5,
        isMaxDeposit: true,
        liquidationPrice: 45000,
        utxos: providedUtxos,
      };

      await createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options);

      expect(mockWallet.fetch.sats_utxos).not.toHaveBeenCalled();
      expect(mockWallet.vault.open.req).toHaveBeenCalledWith(
        expect.anything(),
        providedUtxos,
        true
      );
    });

    it('should adjust a near-max vault open deposit to the exact safe amount', async () => {
      const { createVaultReqOpen } = require('../open');
      const { VaultAPI } = require('@ducat-unit/client-sdk');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockResolvedValue(mockOracleQuote);

      const getChange = VaultAPI.open.get_change as jest.Mock;
      getChange.mockImplementation((ctx: { deposit_amount?: number }) => {
        if (ctx.deposit_amount === 10_000) return -250;
        if (ctx.deposit_amount === 0) return 9_750;
        if (ctx.deposit_amount === 9_750) return 0;
        return 1_000;
      });

      try {
        const mockWallet = {
          vault: {
            open: {
              ctx: jest.fn((_acct, _quote, config) => ({ ...config })),
              quote: jest.fn().mockReturnValue({ total_cost: 1_500 }),
              req: jest.fn().mockResolvedValue({
                issue_txid: 'open_issue',
                vault_txid: 'open_vault',
                issue_txhex: '0200000001',
                vault_txhex: '0200000002',
              }),
            },
          },
          fetch: {
            sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 10_000 }]),
          },
          acct: {
            sats: { address: 'tb1qtest' },
          },
        };

        const vaultConfig = {
          borrow_amount: 1_000,
          deposit_amount: 10_000,
          vault_label: 'test',
          tx_feerate: 5,
        };
        const acctRes = { mint_account: 'mint_open' };
        const options = { feeRate: 5, isMaxDeposit: false, liquidationPrice: 45_000 };

        await createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options);

        expect(vaultConfig.deposit_amount).toBe(9_750);
        expect(mockWallet.vault.open.req).toHaveBeenCalledWith(
          expect.objectContaining({ deposit_amount: 9_750 }),
          [{ txid: 'utxo1', vout: 0, value: 10_000 }],
          true
        );
      } finally {
        getChange.mockReturnValue(1_000);
      }
    });

    it('should preserve requested post-open BTC reserve when adjusting max deposit', async () => {
      const { createVaultReqOpen } = require('../open');
      const { VaultAPI } = require('@ducat-unit/client-sdk');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockResolvedValue(mockOracleQuote);

      const getChange = VaultAPI.open.get_change as jest.Mock;
      getChange.mockImplementation((ctx: { deposit_amount?: number }) => {
        if (ctx.deposit_amount === 10_500) return 500;
        if (ctx.deposit_amount === 0) return 11_000;
        if (ctx.deposit_amount === 10_000) return 1_000;
        return 1_000;
      });

      try {
        const mockWallet = {
          vault: {
            open: {
              ctx: jest.fn((_acct, _quote, config) => ({ ...config })),
              quote: jest.fn().mockReturnValue({ total_cost: 1_500 }),
              req: jest.fn().mockResolvedValue({
                issue_txid: 'open_issue',
                vault_txid: 'open_vault',
                issue_txhex: '0200000001',
                vault_txhex: '0200000002',
              }),
            },
          },
          fetch: {
            sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 12_000 }]),
          },
          acct: {
            sats: { address: 'tb1qtest' },
          },
        };

        const vaultConfig = {
          borrow_amount: 1_000,
          deposit_amount: 10_500,
          vault_label: 'test',
          tx_feerate: 5,
        };
        const acctRes = { mint_account: 'mint_open' };
        const options = {
          feeRate: 5,
          isMaxDeposit: true,
          liquidationPrice: 45_000,
          postOpenReserveSats: 1_000,
        };

        await createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options);

        expect(vaultConfig.deposit_amount).toBe(10_000);
        expect(mockWallet.vault.open.req).toHaveBeenCalledWith(
          expect.objectContaining({ deposit_amount: 10_000 }),
          [{ txid: 'utxo1', vout: 0, value: 12_000 }],
          true
        );
      } finally {
        getChange.mockReturnValue(1_000);
      }
    });

    it('should handle errors during vault creation', async () => {
      const { createVaultReqOpen } = require('../open');
      const fetchPriceQuote = require('../../oracleService').fetchPriceQuote;
      fetchPriceQuote.mockRejectedValue(new Error('Oracle unavailable'));

      const mockWallet = {
        vault: {
          open: {
            ctx: jest.fn(),
          },
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const vaultConfig = {
        borrow_amount: 10000,
        deposit_amount: 100000,
        vault_label: 'test',
        tx_feerate: 5,
      };
      const acctRes = { mint_account: 'mint_open' };
      const options = { feeRate: 5, isMaxDeposit: false, liquidationPrice: 45000 };

      await expect(
        createVaultReqOpen(mockWallet as any, vaultConfig, acctRes, options)
      ).rejects.toThrow('Oracle unavailable');
    });
  });

  describe('createVaultReqBorrow', () => {
    it('should create borrow request with wallet vault operations', async () => {
      const { createVaultReqBorrow } = require('../borrow');

      const mockWallet = {
        vault: {
          borrow: {
            ctx: jest.fn().mockReturnValue({ config: 'borrow_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 1000 }),
            req: jest.fn().mockResolvedValue({
              issue_txid: 'borrow_issue',
              vault_txid: 'borrow_vault',
              sats_inputs: [{}, {}],
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 10000 }]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const borrowConfig = { borrow_amount: 5000, deposit_amount: 0, tx_feerate: 3 };
      const acctRes = { mint_account: 'mint_123' };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      const result = await createVaultReqBorrow(mockWallet as any, borrowConfig, acctRes, options);

      expect(mockWallet.vault.borrow.ctx).toHaveBeenCalledWith(
        'mint_123',
        mockOracleQuote,
        mockVaultProfile,
        borrowConfig
      );
      expect(result.issue_txid).toBe('borrow_issue');
      expect(result.vault_txid).toBe('borrow_vault');
      expect(result.sats_inputs).toHaveLength(2);
    });

    it('should throw when no UTXOs available', async () => {
      const { createVaultReqBorrow } = require('../borrow');

      const mockWallet = {
        vault: {
          borrow: {
            ctx: jest.fn().mockReturnValue({ config: 'borrow_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 1000 }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const borrowConfig = { borrow_amount: 5000, deposit_amount: 0, tx_feerate: 3 };
      const acctRes = { mint_account: 'mint_123' };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqBorrow(mockWallet as any, borrowConfig, acctRes, options)
      ).rejects.toThrow('No UTXOs available for borrow transaction fees');
    });

    it('should use provided UTXOs if given', async () => {
      const { createVaultReqBorrow } = require('../borrow');

      const mockWallet = {
        vault: {
          borrow: {
            ctx: jest.fn().mockReturnValue({ config: 'borrow_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 1000 }),
            req: jest.fn().mockResolvedValue({
              issue_txid: 'borrow_issue',
              vault_txid: 'borrow_vault',
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn(),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const providedUtxos = [{ txid: 'provided', vout: 0, value: 20000 }];
      const borrowConfig = { borrow_amount: 5000, deposit_amount: 0, tx_feerate: 3 };
      const acctRes = { mint_account: 'mint_123' };
      const options = {
        feeRate: 3,
        oracleQuote: mockOracleQuote,
        vaultProfile: mockVaultProfile,
        utxos: providedUtxos,
      };

      await createVaultReqBorrow(mockWallet as any, borrowConfig, acctRes, options);

      expect(mockWallet.fetch.sats_utxos).not.toHaveBeenCalled();
      expect(mockWallet.vault.borrow.req).toHaveBeenCalledWith(
        expect.anything(),
        providedUtxos,
        true
      );
    });
  });

  describe('createVaultReqDeposit', () => {
    it('should create deposit request successfully', async () => {
      const { createVaultReqDeposit } = require('../deposit');

      const mockWallet = {
        vault: {
          deposit: {
            ctx: jest.fn().mockReturnValue({ config: 'deposit_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 500 }),
            req: jest.fn().mockResolvedValue({
              vault_txid: 'deposit_vault',
              sats_inputs: [{}],
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 5000 }]),
        },
      };

      const depositConfig = { deposit_amount: 10000, tx_feerate: 5 };
      const options = { feeRate: 5, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      const result = await createVaultReqDeposit(mockWallet as any, depositConfig, options);

      expect(mockWallet.vault.deposit.ctx).toHaveBeenCalledWith(
        mockOracleQuote,
        mockVaultProfile,
        depositConfig
      );
      expect(result.vault_txid).toBe('deposit_vault');
    });

    it('should throw when no UTXOs available', async () => {
      const { createVaultReqDeposit } = require('../deposit');

      const mockWallet = {
        vault: {
          deposit: {
            ctx: jest.fn().mockReturnValue({ config: 'deposit_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 500 }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([]),
        },
      };

      const depositConfig = { deposit_amount: 10000, tx_feerate: 5 };
      const options = { feeRate: 5, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqDeposit(mockWallet as any, depositConfig, options)
      ).rejects.toThrow('No UTXOs available for deposit transaction');
    });

    it('should skip UTXO fetch for max amount', async () => {
      const { createVaultReqDeposit } = require('../deposit');

      const mockWallet = {
        vault: {
          deposit: {
            ctx: jest.fn().mockReturnValue({ config: 'deposit_ctx' }),
            req: jest.fn().mockResolvedValue({ vault_txid: 'deposit_vault' }),
          },
        },
        fetch: {
          sats_utxos: jest.fn(),
        },
      };

      const providedUtxos = [{ txid: 'utxo1', vout: 0, value: 10000 }];
      const depositConfig = { deposit_amount: 10000, tx_feerate: 5 };
      const options = {
        feeRate: 5,
        oracleQuote: mockOracleQuote,
        vaultProfile: mockVaultProfile,
        isMaxAmount: true,
        utxos: providedUtxos,
      };

      await createVaultReqDeposit(mockWallet as any, depositConfig, options);

      expect(mockWallet.fetch.sats_utxos).not.toHaveBeenCalled();
    });

    it('should use provided utxos even when not isMaxAmount', async () => {
      const { createVaultReqDeposit } = require('../deposit');

      const mockWallet = {
        vault: {
          deposit: {
            ctx: jest.fn().mockReturnValue({ config: 'deposit_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 500 }),
            req: jest.fn().mockResolvedValue({ vault_txid: 'deposit_vault' }),
          },
        },
        fetch: {
          sats_utxos: jest.fn(),
        },
      };

      const providedUtxos = [{ txid: 'utxo1', vout: 0, value: 10000 }];
      const depositConfig = { deposit_amount: 10000, tx_feerate: 5 };
      const options = {
        feeRate: 5,
        oracleQuote: mockOracleQuote,
        vaultProfile: mockVaultProfile,
        isMaxAmount: false,
        utxos: providedUtxos,
      };

      await createVaultReqDeposit(mockWallet as any, depositConfig, options);

      // Should NOT call fetch.sats_utxos since utxos were provided
      expect(mockWallet.fetch.sats_utxos).not.toHaveBeenCalled();
    });

    it('should adjust a near-max vault deposit to the exact safe amount', async () => {
      const { createVaultReqDeposit } = require('../deposit');
      const { VaultAPI } = require('@ducat-unit/client-sdk');

      const getChange = VaultAPI.deposit.get_change as jest.Mock;
      getChange.mockImplementation((ctx: { deposit_amount?: number }) => {
        if (ctx.deposit_amount === 10_000) return -250;
        if (ctx.deposit_amount === 0) return 9_750;
        if (ctx.deposit_amount === 9_750) return 0;
        return 1_000;
      });

      try {
        const mockWallet = {
          vault: {
            deposit: {
              ctx: jest.fn((_quote, _profile, config) => ({ ...config })),
              quote: jest.fn().mockReturnValue({ total_cost: 500 }),
              req: jest.fn().mockResolvedValue({ vault_txid: 'deposit_vault' }),
            },
          },
          fetch: {
            sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 10_000 }]),
          },
        };

        const depositConfig = { deposit_amount: 10_000, tx_feerate: 5 };
        const options = {
          feeRate: 5,
          oracleQuote: mockOracleQuote,
          vaultProfile: mockVaultProfile,
        };

        await createVaultReqDeposit(mockWallet as any, depositConfig, options);

        expect(depositConfig.deposit_amount).toBe(9_750);
        expect(mockWallet.vault.deposit.req).toHaveBeenCalledWith(
          expect.objectContaining({ deposit_amount: 9_750 }),
          [{ txid: 'utxo1', vout: 0, value: 10_000 }]
        );
      } finally {
        getChange.mockReturnValue(1_000);
      }
    });

    it('should handle errors during deposit request creation', async () => {
      const { createVaultReqDeposit } = require('../deposit');

      const mockWallet = {
        vault: {
          deposit: {
            ctx: jest.fn().mockReturnValue({ config: 'deposit_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 500 }),
            req: jest.fn().mockRejectedValue(new Error('Deposit validation failed')),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'utxo1', vout: 0, value: 5000 }]),
        },
      };

      const depositConfig = { deposit_amount: 10000, tx_feerate: 5 };
      const options = { feeRate: 5, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqDeposit(mockWallet as any, depositConfig, options)
      ).rejects.toThrow('Deposit validation failed');
    });
  });

  describe('guardianSendReqDeposit error handling', () => {
    it('should handle Error exceptions with proper message formatting', async () => {
      const { guardianSendReqDeposit } = require('../deposit');
      const mockGuardianClient = {
        req: {
          vault: {
            deposit: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(new Error('Deposit failed')),
            }),
          },
        },
      };

      await expect(guardianSendReqDeposit(mockGuardianClient, {})).rejects.toThrow(
        'Failed to submit deposit request: Deposit failed'
      );
    });

    it('should handle object exceptions with JSON stringification', async () => {
      const { guardianSendReqDeposit } = require('../deposit');
      const mockGuardianClient = {
        req: {
          vault: {
            deposit: jest.fn().mockReturnValue({
              resolve: jest
                .fn()
                .mockRejectedValue({ code: 'DEPOSIT_ERROR', reason: 'Insufficient funds' }),
            }),
          },
        },
      };

      await expect(guardianSendReqDeposit(mockGuardianClient, {})).rejects.toThrow(
        'Failed to submit deposit request: {"code":"DEPOSIT_ERROR","reason":"Insufficient funds"}'
      );
    });

    it('should handle non-Error non-object exceptions with String conversion', async () => {
      const { guardianSendReqDeposit } = require('../deposit');
      const mockGuardianClient = {
        req: {
          vault: {
            deposit: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue('Plain string error'),
            }),
          },
        },
      };

      await expect(guardianSendReqDeposit(mockGuardianClient, {})).rejects.toThrow(
        'Failed to submit deposit request: Plain string error'
      );
    });

    it('should handle null exceptions', async () => {
      const { guardianSendReqDeposit } = require('../deposit');
      const mockGuardianClient = {
        req: {
          vault: {
            deposit: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(null),
            }),
          },
        },
      };

      await expect(guardianSendReqDeposit(mockGuardianClient, {})).rejects.toThrow(
        'Failed to submit deposit request: null'
      );
    });
  });

  describe('createVaultReqRepay', () => {
    it('should create repay request with sats and unit UTXOs', async () => {
      const { createVaultReqRepay } = require('../repay');

      const mockWallet = {
        vault: {
          repay: {
            ctx: jest.fn().mockReturnValue({ repay_amount: 5000, config: 'repay_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 800 }),
            req: jest.fn().mockResolvedValue({
              sats_inputs: [{ txid: 'sats_utxo', vout: 0, value: 5000 }],
              unit_inputs: [{ txid: 'unit_utxo', vout: 0, amount: 5000 }],
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'sats_utxo', vout: 0, value: 5000 }]),
          rune_utxos: jest.fn().mockResolvedValue([{ txid: 'unit_utxo', vout: 0, amount: 5000 }]),
        },
        sign: {
          psbt: jest.fn(async (psbt: string) => `signed-${psbt}`),
        },
        acct: {
          sats: { address: 'tb1qtest' },
          runes: { address: 'tb1ptest' },
          vault: { address: 'tb1pvault' },
        },
        contract_id: 'contract-id',
        network: 'mutinynet',
      };

      const repayConfig = { repay_amount: 5000, deposit_amount: 0, tx_feerate: 4 };
      const acctRes = { mint_account: 'burn_123' };
      const options = { feeRate: 4, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      const result = await createVaultReqRepay(mockWallet as any, repayConfig, acctRes, options);

      expect(mockWallet.fetch.rune_utxos).toHaveBeenCalledWith('UNIT', 5000);
      expect(mockWallet.vault.repay.req).toHaveBeenCalledWith(
        expect.anything(),
        [{ txid: 'sats_utxo', vout: 0, value: 5000 }],
        [{ txid: 'unit_utxo', vout: 0, amount: 5000 }]
      );
      expect(result.sats_inputs).toHaveLength(1);
    });

    it('should use preferred TurboUNIT melt UTXOs when provided', async () => {
      const {
        clearPreferredRepayUnitTxids,
        createVaultReqRepay,
        setPreferredRepayUnitTxids,
      } = require('../repay');
      const directUnitUtxo = {
        txid: 'direct_unit_txid',
        vout: 0,
        value: 10000,
        runes: new Map([['UNIT', { amount: 5000 }]]),
      };
      const meltedUnitUtxo = {
        txid: 'melted_unit_txid',
        vout: 1,
        value: 10000,
        runes: new Map([['UNIT', { amount: 5000 }]]),
      };

      const mockWallet = {
        vault: {
          repay: {
            ctx: jest.fn().mockReturnValue({ repay_amount: 5000, config: 'repay_ctx' }),
            quote: jest.fn().mockReturnValue({ total_cost: 800 }),
            req: jest.fn().mockResolvedValue({
              sats_inputs: [{ txid: 'sats_utxo', vout: 0, value: 5000 }],
              unit_inputs: [meltedUnitUtxo],
            }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'sats_utxo', vout: 0, value: 5000 }]),
          rune_utxos: jest.fn().mockResolvedValue([directUnitUtxo, meltedUnitUtxo]),
        },
        sign: {
          psbt: jest.fn(async (psbt: string) => `signed-${psbt}`),
        },
        acct: {
          sats: { address: 'tb1qtest' },
          runes: { address: 'tb1ptest' },
          vault: { address: 'tb1pvault' },
        },
        contract_id: 'contract-id',
        network: 'mutinynet',
      };

      const repayConfig = { repay_amount: 5000, deposit_amount: 0, tx_feerate: 4 };
      const acctRes = { mint_account: 'burn_123' };
      const options = { feeRate: 4, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      setPreferredRepayUnitTxids(['melted_unit_txid']);
      try {
        await createVaultReqRepay(mockWallet as any, repayConfig, acctRes, options);
      } finally {
        clearPreferredRepayUnitTxids();
      }

      expect(mockWallet.fetch.rune_utxos).toHaveBeenCalledWith('UNIT');
      expect(mockWallet.vault.repay.req).toHaveBeenCalledWith(
        expect.anything(),
        [{ txid: 'sats_utxo', vout: 0, value: 5000 }],
        [meltedUnitUtxo]
      );
    });

    it('should throw when no sats UTXOs available', async () => {
      const { createVaultReqRepay } = require('../repay');

      const mockWallet = {
        vault: {
          repay: {
            ctx: jest.fn().mockReturnValue({ repay_amount: 5000 }),
            quote: jest.fn().mockReturnValue({ total_cost: 800 }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const repayConfig = { repay_amount: 5000, deposit_amount: 0, tx_feerate: 4 };
      const acctRes = { mint_account: 'burn_123' };
      const options = { feeRate: 4, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqRepay(mockWallet as any, repayConfig, acctRes, options)
      ).rejects.toThrow('No sats UTXOs available for repay transaction fees');
    });

    it('should throw when no UNIT UTXOs available', async () => {
      const { createVaultReqRepay } = require('../repay');

      const mockWallet = {
        vault: {
          repay: {
            ctx: jest.fn().mockReturnValue({ repay_amount: 5000 }),
            quote: jest.fn().mockReturnValue({ total_cost: 800 }),
          },
        },
        fetch: {
          sats_utxos: jest.fn().mockResolvedValue([{ txid: 'sats', vout: 0, value: 5000 }]),
          rune_utxos: jest.fn().mockResolvedValue([]),
        },
        acct: {
          sats: { address: 'tb1qtest' },
        },
      };

      const repayConfig = { repay_amount: 5000, deposit_amount: 0, tx_feerate: 4 };
      const acctRes = { mint_account: 'burn_123' };
      const options = { feeRate: 4, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqRepay(mockWallet as any, repayConfig, acctRes, options)
      ).rejects.toThrow('No UNIT UTXOs available to repay');
    });

    it('should time out UNIT UTXO fetching when repay inputs stall', async () => {
      jest.useFakeTimers();

      try {
        const { createVaultReqRepay } = require('../repay');

        const mockWallet = {
          vault: {
            repay: {
              ctx: jest.fn().mockReturnValue({ repay_amount: 5000 }),
              quote: jest.fn().mockReturnValue({ total_cost: 800 }),
              req: jest.fn().mockResolvedValue({ sats_inputs: [{}] }),
            },
          },
          fetch: {
            sats_utxos: jest.fn(
              () =>
                new Promise((resolve) => {
                  setTimeout(() => {
                    resolve([{ txid: 'sats', vout: 0, value: 5000 }]);
                  }, 25_000);
                })
            ),
            rune_utxos: jest.fn(() => new Promise(() => undefined)),
          },
          acct: {
            sats: { address: 'tb1qtest' },
          },
        };

        const repayConfig = { repay_amount: 5000, deposit_amount: 0, tx_feerate: 4 };
        const acctRes = { mint_account: 'burn_123' };
        const options = {
          feeRate: 4,
          oracleQuote: mockOracleQuote,
          vaultProfile: mockVaultProfile,
        };

        const result = createVaultReqRepay(mockWallet as any, repayConfig, acctRes, options);
        const expectation = expect(result).rejects.toThrow(
          'Timed out fetching UNIT UTXOs for repay. Please try again.'
        );

        await jest.advanceTimersByTimeAsync(25_000);
        expect(mockWallet.fetch.rune_utxos).toHaveBeenCalledWith('UNIT', 5000);

        await jest.advanceTimersByTimeAsync(30_000);
        await expectation;
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('createVaultReqWithdraw', () => {
    it('should create withdraw request successfully', async () => {
      const { createVaultReqWithdraw } = require('../withdraw');

      const mockWallet = {
        vault: {
          withdraw: {
            ctx: jest.fn().mockReturnValue({ config: 'withdraw_ctx' }),
            req: jest.fn().mockResolvedValue({
              vault_txid: 'withdraw_vault',
            }),
          },
        },
      };

      const withdrawConfig = { change_amount: 50000, tx_feerate: 3 };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      const result = await createVaultReqWithdraw(mockWallet as any, withdrawConfig, options);

      expect(mockWallet.vault.withdraw.ctx).toHaveBeenCalledWith(
        mockOracleQuote,
        mockVaultProfile,
        withdrawConfig
      );
      expect(result.vault_txid).toBe('withdraw_vault');
    });

    it('should force zero txfee reserve for compat withdraw contexts', async () => {
      const { createVaultReqWithdraw } = require('../withdraw');

      const buildBaseConfig = jest.fn((overrides = {}) => ({
        txfee_reserve: 1000,
        ...overrides,
      }));
      const withdrawCtx = {
        config: 'withdraw_ctx',
        __base_config: buildBaseConfig,
      };
      const mockWallet = {
        vault: {
          withdraw: {
            ctx: jest.fn().mockReturnValue(withdrawCtx),
            req: jest.fn().mockImplementation((ctx) => {
              expect(ctx.__base_config()).toEqual({ txfee_reserve: 0 });
              return Promise.resolve({
                vault_txid: 'withdraw_vault',
              });
            }),
          },
        },
      };

      const withdrawConfig = { change_amount: 50000, tx_feerate: 3 };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      const result = await createVaultReqWithdraw(mockWallet as any, withdrawConfig, options);

      expect(result.vault_txid).toBe('withdraw_vault');
      expect(buildBaseConfig).toHaveBeenCalledWith({ txfee_reserve: 0 });
    });

    it('should handle errors during withdraw request creation', async () => {
      const { createVaultReqWithdraw } = require('../withdraw');

      const mockWallet = {
        vault: {
          withdraw: {
            ctx: jest.fn().mockReturnValue({ config: 'withdraw_ctx' }),
            req: jest.fn().mockRejectedValue(new Error('Withdrawal validation failed')),
          },
        },
      };

      const withdrawConfig = { change_amount: 50000, tx_feerate: 3 };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(
        createVaultReqWithdraw(mockWallet as any, withdrawConfig, options)
      ).rejects.toThrow('Withdrawal validation failed');
    });

    it('should handle non-Error exceptions in withdraw request creation', async () => {
      const { createVaultReqWithdraw } = require('../withdraw');

      const mockWallet = {
        vault: {
          withdraw: {
            ctx: jest.fn().mockReturnValue({ config: 'withdraw_ctx' }),
            req: jest.fn().mockRejectedValue('String error'),
          },
        },
      };

      const withdrawConfig = { change_amount: 50000, tx_feerate: 3 };
      const options = { feeRate: 3, oracleQuote: mockOracleQuote, vaultProfile: mockVaultProfile };

      await expect(createVaultReqWithdraw(mockWallet as any, withdrawConfig, options)).rejects.toBe(
        'String error'
      );
    });
  });
});

describe('Vault Guardian Error Handling', () => {
  describe('guardianSendReqWithdraw', () => {
    it('should handle Error exceptions', async () => {
      const { guardianSendReqWithdraw } = require('../withdraw');
      const mockGuardianClient = {
        req: {
          vault: {
            withdraw: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue(new Error('Withdraw failed')),
            }),
          },
        },
      };

      await expect(guardianSendReqWithdraw(mockGuardianClient, {})).rejects.toThrow(
        'Withdraw failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      const { guardianSendReqWithdraw } = require('../withdraw');
      const mockGuardianClient = {
        req: {
          vault: {
            withdraw: jest.fn().mockReturnValue({
              resolve: jest.fn().mockRejectedValue('Non-error exception'),
            }),
          },
        },
      };

      await expect(guardianSendReqWithdraw(mockGuardianClient, {})).rejects.toBe(
        'Non-error exception'
      );
    });
  });
});

describe('Vault Index Re-exports', () => {
  it('should export all utils', () => {
    const index = require('../index');

    expect(index.readVarInt).toBeDefined();
    expect(index.extractOpReturnFromTxHex).toBeDefined();
    expect(index.checkBatchAllowed).toBeDefined();
    expect(index.normalizeMasterId).toBeDefined();
    expect(index.normalizeVaultAction).toBeDefined();
    expect(index.computeVaultPrevoutFromTx).toBeDefined();
    expect(index.buildVaultProfile).toBeDefined();
  });

  it('should export all operation functions', () => {
    const index = require('../index');

    // Open operations
    expect(index.createVaultConfig).toBeDefined();
    expect(index.guardianOpenVaultReserve).toBeDefined();
    expect(index.createVaultReqOpen).toBeDefined();
    expect(index.guardianSendReqOpen).toBeDefined();

    // Borrow operations
    expect(index.createBorrowConfig).toBeDefined();
    expect(index.guardianBorrowReserve).toBeDefined();
    expect(index.createVaultReqBorrow).toBeDefined();
    expect(index.guardianSendReqBorrow).toBeDefined();

    // Deposit operations
    expect(index.createDepositConfig).toBeDefined();
    expect(index.createVaultReqDeposit).toBeDefined();
    expect(index.guardianSendReqDeposit).toBeDefined();

    // Repay operations
    expect(index.createRepayConfig).toBeDefined();
    expect(index.guardianRepayReserve).toBeDefined();
    expect(index.createVaultReqRepay).toBeDefined();
    expect(index.guardianSendReqRepay).toBeDefined();

    // Withdraw operations
    expect(index.createWithdrawConfig).toBeDefined();
    expect(index.createVaultReqWithdraw).toBeDefined();
    expect(index.guardianSendReqWithdraw).toBeDefined();
  });
});
