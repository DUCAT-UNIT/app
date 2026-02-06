/**
 * Mock Types for Vault Tests
 *
 * Provides properly typed mock objects for testing vault operations
 * without using `as any` casts which can mask type errors.
 *
 * IMPORTANT: These types should match the minimal interface required
 * by the functions being tested, not the full SDK types.
 */

/**
 * Minimal VaultWallet mock for checkBatchAllowed tests
 * Only includes the fields actually accessed by the function
 */
export interface MockVaultWalletForBatchCheck {
  acct?: {
    sats?: {
      address?: string;
    };
  };
}

/**
 * Create a mock wallet for checkBatchAllowed tests
 */
export function createMockWalletForBatchCheck(address: string): MockVaultWalletForBatchCheck {
  return {
    acct: {
      sats: {
        address,
      },
    },
  };
}

/**
 * Minimal transaction output for vault prevout tests
 */
export interface MockTxOutput {
  script: Buffer | { type: string; hex?: string };
  value?: number;
}

/**
 * Minimal transaction for computeVaultPrevoutFromTx tests
 */
export interface MockTxForPrevout {
  outs: MockTxOutput[];
  toHex?: () => string;
}

/**
 * Create a mock transaction for prevout tests
 */
export function createMockTxForPrevout(outputs: MockTxOutput[]): MockTxForPrevout {
  return {
    outs: outputs,
  };
}

/**
 * Vault history transaction for computeVaultPrevoutFromTx tests
 * Matches the inline type in utils.ts
 */
export interface MockVaultHistoryTx {
  transaction_id?: string;
  utxo?: string;
  utxo_script?: string;
  liquidation_hash?: string;
  liquidation_threshold?: number;
  amount_borrowed: number;
  oracle_price: number;
  timestamp: number;
  action: string;
  vault_amount: number;
}

/**
 * Vault profile data for buildVaultProfile tests
 */
export interface MockVaultReturnData {
  master_id?: string;
  utxo?: {
    value?: number;
    vout?: number;
    [key: string]: unknown;
  };
  debt?: number;
  [key: string]: unknown;
}

/**
 * Full mock wallet for vault operation tests
 */
export interface MockVaultWallet {
  acct: {
    sats: {
      address: string;
      pubkey: string;
      internal_pubkey?: string;
    };
    runes: {
      address: string;
      pubkey: string;
      internal_pubkey?: string;
    };
    vault: {
      address: string;
      pubkey: string;
      internal_pubkey?: string;
    };
    oracle: {
      address: string;
      pubkey: string;
    };
  };
  getUtxos: () => Promise<MockUtxo[]>;
  signPsbt: (psbt: unknown, options?: unknown) => Promise<unknown>;
  getOracleQuote?: () => Promise<unknown>;
}

/**
 * Mock UTXO for wallet operations
 */
export interface MockUtxo {
  txid: string;
  vout: number;
  value: number;
  script?: string;
  address?: string;
}

/**
 * Create a mock vault wallet with all required fields
 */
export function createMockVaultWallet(overrides?: Partial<MockVaultWallet>): MockVaultWallet {
  const defaultWallet: MockVaultWallet = {
    acct: {
      sats: {
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        pubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      },
      runes: {
        address: 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
        pubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      },
      vault: {
        address: 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
        pubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      },
      oracle: {
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        pubkey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      },
    },
    getUtxos: jest.fn().mockResolvedValue([
      { txid: 'abc123', vout: 0, value: 100000 },
    ]),
    signPsbt: jest.fn().mockResolvedValue({ toHex: () => 'signed_psbt_hex' }),
  };

  return { ...defaultWallet, ...overrides };
}

/**
 * Mock vault config for open operation
 */
export interface MockVaultConfig {
  collateral: number;
  borrow: number;
  fee_rate: number;
  oracle_pubkey?: string;
}

/**
 * Mock borrow config
 */
export interface MockBorrowConfig {
  amount: number;
  fee_rate: number;
}

/**
 * Mock deposit config
 */
export interface MockDepositConfig {
  amount: number;
  fee_rate: number;
}

/**
 * Mock repay config
 */
export interface MockRepayConfig {
  amount: number;
  fee_rate: number;
}

/**
 * Mock withdraw config
 */
export interface MockWithdrawConfig {
  amount: number;
  fee_rate: number;
}

/**
 * Mock account reservation response
 */
export interface MockAcctRes {
  expiry: number;
  nonce: string;
  signature?: string;
}

/**
 * Create a mock account reservation
 */
export function createMockAcctRes(overrides?: Partial<MockAcctRes>): MockAcctRes {
  return {
    expiry: Date.now() + 300000, // 5 minutes from now
    nonce: 'test_nonce_12345',
    ...overrides,
  };
}

/**
 * Mock options for vault operations
 */
export interface MockVaultOperationOptions {
  utxos?: MockUtxo[];
  feeRate?: number;
  vaultPrevout?: unknown;
  oracleQuote?: unknown;
}

/**
 * Create mock operation options
 */
export function createMockOperationOptions(overrides?: Partial<MockVaultOperationOptions>): MockVaultOperationOptions {
  return {
    utxos: [
      { txid: 'utxo1', vout: 0, value: 50000 },
      { txid: 'utxo2', vout: 1, value: 75000 },
    ],
    feeRate: 10,
    ...overrides,
  };
}
