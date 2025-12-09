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
jest.mock('@ducat-unit/client-sdk', () => ({}));

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
}));

jest.mock('../../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn((n) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5)),
}));

import {
  readVarInt,
  extractOpReturnFromTxHex,
  checkBatchAllowed,
  normalizeMasterId,
  normalizeVaultAction,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from '../utils';
import { createVaultConfig } from '../open';
import { createBorrowConfig } from '../borrow';
import { createDepositConfig } from '../deposit';
import { createRepayConfig } from '../repay';
import { createWithdrawConfig } from '../withdraw';

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
  });

  describe('checkBatchAllowed', () => {
    it('should return true for native segwit testnet address (tb1q)', () => {
      const wallet = {
        acct: {
          sats: {
            address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
          },
        },
      };
      expect(checkBatchAllowed(wallet as any)).toBe(true);
    });

    it('should return true for native segwit mainnet address (bc1q)', () => {
      const wallet = {
        acct: {
          sats: {
            address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          },
        },
      };
      expect(checkBatchAllowed(wallet as any)).toBe(true);
    });

    it('should return false for taproot address (tb1p)', () => {
      const wallet = {
        acct: {
          sats: {
            address: 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
          },
        },
      };
      expect(checkBatchAllowed(wallet as any)).toBe(false);
    });

    it('should return false for legacy address', () => {
      const wallet = {
        acct: {
          sats: {
            address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
          },
        },
      };
      expect(checkBatchAllowed(wallet as any)).toBe(false);
    });

    it('should return false for empty address', () => {
      const wallet = {
        acct: {
          sats: {
            address: '',
          },
        },
      };
      expect(checkBatchAllowed(wallet as any)).toBe(false);
    });

    it('should return false and not throw for missing acct', () => {
      const wallet = {};
      expect(checkBatchAllowed(wallet as any)).toBe(false);
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
  });

  describe('normalizeVaultAction', () => {
    it('should map full action names to codes', () => {
      expect(normalizeVaultAction('Open')).toBe('o');
      expect(normalizeVaultAction('Borrow')).toBe('b');
      expect(normalizeVaultAction('Repay')).toBe('r');
      expect(normalizeVaultAction('Deposit')).toBe('d');
      expect(normalizeVaultAction('Withdraw')).toBe('w');
      expect(normalizeVaultAction('Liquidate')).toBe('l');
      expect(normalizeVaultAction('Close')).toBe('x');
    });

    it('should map lowercase action names to codes', () => {
      expect(normalizeVaultAction('open')).toBe('o');
      expect(normalizeVaultAction('borrow')).toBe('b');
      expect(normalizeVaultAction('repay')).toBe('r');
      expect(normalizeVaultAction('deposit')).toBe('d');
      expect(normalizeVaultAction('withdraw')).toBe('w');
      expect(normalizeVaultAction('liquidate')).toBe('l');
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
    it('should return null if utxo is missing', () => {
      const tx = {
        transaction_id: 'abc123',
        utxo: undefined,
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };
      expect(computeVaultPrevoutFromTx(tx as any)).toBeNull();
    });

    it('should return null if transaction_id is missing', () => {
      const tx = {
        transaction_id: undefined,
        utxo: 'txid:0',
        amount_borrowed: 1000,
        oracle_price: 50000,
        timestamp: 1234567890,
        action: 'Open',
        vault_amount: 100000,
      };
      expect(computeVaultPrevoutFromTx(tx as any)).toBeNull();
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

    it('should handle missing optional fields', () => {
      const tx = {
        transaction_id: 'abc123',
        utxo: 'abc123:0',
        amount_borrowed: 500,
        oracle_price: 40000,
        timestamp: 1234567890,
        action: 'Borrow',
        vault_amount: 50000,
      };

      const result = computeVaultPrevoutFromTx(tx as any);

      expect(result).not.toBeNull();
      expect(result?.rdata.thold_hash).toBe('');
      expect(result?.rdata.thold_price).toBe(0);
      expect(result?.utxo.script).toBe('');
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

    it('should normalize master_id with i suffix', () => {
      const vaultPubkey = 'pk';
      const vaultInfo = {
        creation_account: 'acct',
        guard_pubkey: 'guard',
        master_id: 'masterid5',
      };
      const vaultPrevout = {
        rdata: {} as any,
        utxo: {} as any,
      };

      const profile = buildVaultProfile(vaultPubkey, vaultInfo, vaultPrevout);
      expect(profile.master_id).toBe('masterid5'); // Already has i, no change
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
    it('should be defined', () => {
      const { guardianSendReqBorrow } = require('../borrow');
      expect(guardianSendReqBorrow).toBeDefined();
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
    it('should be defined', () => {
      const { guardianSendReqRepay } = require('../repay');
      expect(guardianSendReqRepay).toBeDefined();
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
