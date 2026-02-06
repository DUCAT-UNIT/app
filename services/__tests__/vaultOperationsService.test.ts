/**
 * Tests for Vault Operations Service
 * This service is a re-export module
 */

// Mock all SDK dependencies
jest.mock('@ducat-unit/client-sdk', () => ({
  VaultWallet: jest.fn(),
  GuardianSocket: jest.fn(),
  OracleAPI: {
    quote: { fetch_price_quote: jest.fn() },
    wallet: { fetch_address_bal: jest.fn() },
  },
}));

jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: { parse_address: jest.fn(), get_txid: jest.fn(), parse_script_meta: jest.fn() },
  PSBT: { decode: jest.fn(), encode: jest.fn() },
  hash160: jest.fn(() => ''),
  taptweak_pubkey: jest.fn(() => ''),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/constants', () => ({
  API: { GUARDIAN_WS: 'wss://test', ESPLORA_URL: 'https://test', ORD_URL: 'https://test' },
  VAULT_CONFIG: { TX_TIMEOUT: 30000, VIN_ALLOWANCE: 1000 },
}));

jest.mock('../oracleService', () => ({
  fetchPriceQuote: jest.fn(),
  fetchCurrentPrice: jest.fn(),
}));

jest.mock('../guardianService', () => ({
  withGuardianTimeout: jest.fn((p) => p),
}));

describe('vaultOperationsService', () => {
  it('should re-export from vault module', () => {
    const service = require('../vaultOperationsService');
    expect(service).toBeDefined();
  });

  it('should export vault config functions', () => {
    const service = require('../vaultOperationsService');
    expect(service.createVaultConfig).toBeDefined();
    expect(service.createBorrowConfig).toBeDefined();
    expect(service.createDepositConfig).toBeDefined();
    expect(service.createRepayConfig).toBeDefined();
    expect(service.createWithdrawConfig).toBeDefined();
  });

  it('should export guardian functions', () => {
    const service = require('../vaultOperationsService');
    expect(service.guardianOpenVaultReserve).toBeDefined();
    expect(service.guardianBorrowReserve).toBeDefined();
    expect(service.guardianRepayReserve).toBeDefined();
  });

  it('should export vault request functions', () => {
    const service = require('../vaultOperationsService');
    expect(service.createVaultReqOpen).toBeDefined();
    expect(service.createVaultReqBorrow).toBeDefined();
    expect(service.createVaultReqDeposit).toBeDefined();
    expect(service.createVaultReqRepay).toBeDefined();
    expect(service.createVaultReqWithdraw).toBeDefined();
  });

  it('should export guardian send functions', () => {
    const service = require('../vaultOperationsService');
    expect(service.guardianSendReqOpen).toBeDefined();
    expect(service.guardianSendReqBorrow).toBeDefined();
    expect(service.guardianSendReqDeposit).toBeDefined();
    expect(service.guardianSendReqRepay).toBeDefined();
    expect(service.guardianSendReqWithdraw).toBeDefined();
  });

  it('should export utility functions', () => {
    const service = require('../vaultOperationsService');
    expect(service.checkBatchAllowed).toBeDefined();
    expect(service.normalizeMasterId).toBeDefined();
    expect(service.normalizeVaultAction).toBeDefined();
    expect(service.computeVaultPrevoutFromTx).toBeDefined();
    expect(service.buildVaultProfile).toBeDefined();
  });
});
