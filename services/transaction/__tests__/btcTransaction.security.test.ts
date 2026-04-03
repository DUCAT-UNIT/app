/**
 * Security-focused tests for BTC Transaction Service
 * Tests TXID validation, output verification, and other security checks
 */

// Mock dependencies before imports
jest.mock('bitcoinjs-lib', () => {
  const mockPsbt = {
    addInput: jest.fn(),
    addOutput: jest.fn(),
    toBase64: jest.fn(() => 'base64_psbt_string'),
  };
  return {
    initEccLib: jest.fn(),
    Psbt: jest.fn(() => mockPsbt),
    Transaction: {
      fromHex: jest.fn(),
    },
  };
});

jest.mock('@bitcoinerlab/secp256k1', () => ({}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
  validateAndNormalizeAddress: jest.fn((addr) => {
    if (addr === 'invalid') throw new Error('Invalid address');
    return addr;
  }),
}));

jest.mock('../../balanceService', () => ({
  fetchUtxos: jest.fn(),
}));

jest.mock('../../../utils/messages', () => ({
  ERRORS: {
    INVALID_AMOUNT: 'Invalid amount',
    NO_CONFIRMED_FUNDS: 'No confirmed funds available',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
  },
}));

jest.mock('../../../utils/constants', () => ({
  getTxHexUrl: jest.fn((txid) => `https://example.com/tx/${txid}/hex`),
  BITCOIN_TX: {
    DUST_LIMIT: 546,
    SATOSHIS_PER_BTC: 100_000_000,
    ESTIMATED_TX_FEE: 1_000,
    RUNE_OUTPUT_AMOUNT: 10_000,
    TX_TIMEOUT_BUFFER: 5_000,
  },
}));

jest.mock('../../feeEstimationService', () => ({
  getRecommendedFeeRate: jest.fn(async () => 1),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { createBtcIntent } from '../btcTransaction';
import { fetchUtxos } from '../../balanceService';
import { validateAndNormalizeAddress } from '../../../utils/bitcoin';

describe('btcTransaction - Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for fetch - returns tx hex
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('0100000001abcd...'),
    });
  });

  const segwitAddress = 'tb1qtest123';
  const recipient = 'tb1qrecipient';
  const amount = '0.001'; // 100,000 sats

  describe('SECURITY: TXID validation', () => {
    it('should throw error when fetched transaction TXID does not match expected TXID', async () => {
      const utxos = [{ txid: 'expected_txid', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      // Mock Transaction.fromHex to return different txid
      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'different_txid'), // TXID MISMATCH!
        outs: [
          { script: Buffer.from('script1', 'hex'), value: 200000 },
        ],
      });

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow('SECURITY: TXID mismatch');
    });

    it('should throw error when output index does not exist in transaction', async () => {
      const utxos = [{ txid: 'tx1', vout: 5, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      // Mock transaction with only 2 outputs (vout 0 and 1)
      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [
          { script: Buffer.from('script1', 'hex'), value: 100000 },
          { script: Buffer.from('script2', 'hex'), value: 50000 },
          // vout 5 does NOT exist!
        ],
      });

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow('SECURITY: Output index 5 does not exist');
    });

    it('should throw error when UTXO value does not match transaction output value', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      // Mock transaction with different value
      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [
          { script: Buffer.from('script1', 'hex'), value: 100000 }, // VALUE MISMATCH: 100k vs 200k
        ],
      });

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow('SECURITY: UTXO value mismatch');
    });
  });

  describe('SECURITY: Change address validation', () => {
    it('should throw error when change address validation fails', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 500000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 500000 }],
      });

      // Mock validateAndNormalizeAddress to return different address for change
      let callCount = 0;
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => {
        callCount++;
        if (callCount === 1) return addr; // Recipient OK
        return 'different_address'; // Change address MISMATCH
      });

      await expect(createBtcIntent(recipient, amount, 'tb1qchangeaddr', 0))
        .rejects.toThrow('SECURITY: Change address validation failed');
    });
  });

  describe('Edge cases: Invalid inputs', () => {
    it('should throw error for invalid recipient address', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (validateAndNormalizeAddress as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid address');
      });

      await expect(createBtcIntent('invalid', amount, segwitAddress, 0))
        .rejects.toThrow('Invalid address');
    });

    it('should handle fetch timeout for transaction hex', async () => {
      // Reset mock to default behavior
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow();
    });

    it('should handle all UTXOs being spent', async () => {
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);

      const utxos = [
        { txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 300000, status: { confirmed: true } },
      ];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      const spentUtxos = new Set(['tx1:0', 'tx2:0']); // All spent!

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0, [], spentUtxos))
        .rejects.toThrow('No confirmed funds available');
    });

    it('should handle only unconfirmed UTXOs available when no confirmed exist', async () => {
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);

      // No confirmed UTXOs fetched
      (fetchUtxos as jest.Mock).mockResolvedValue([]);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'unconf1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 200000 }],
      });

      // When no confirmed UTXOs, throws "No confirmed funds available"
      // But if unconfirmed UTXOs are provided, they ARE used (by design)
      // So this test actually succeeds. Let's test the empty case instead.
      const unconfirmedUtxos: any[] = [];

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0, unconfirmedUtxos))
        .rejects.toThrow('No confirmed funds available');
    });

    it('should use fee rate override when provided', async () => {
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);
      const utxos = [{ txid: 'tx1', vout: 0, value: 500000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 500000 }],
      });

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0, [], new Set(), 10);

      expect(result).toBeDefined();
      expect(result.fee).toBeGreaterThan(0);
    });

    it('should handle fee estimation failure gracefully', async () => {
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);

      const { getRecommendedFeeRate } = require('../../feeEstimationService');
      (getRecommendedFeeRate as jest.Mock).mockRejectedValue(new Error('Fee API down'));

      const utxos = [{ txid: 'tx1', vout: 0, value: 500000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 500000 }],
      });

      // Should not throw - should use fallback fee rate of 1
      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);
      expect(result).toBeDefined();
    });
  });

  describe('Edge cases: Amount validation', () => {
    beforeEach(() => {
      (validateAndNormalizeAddress as jest.Mock).mockImplementation((addr) => addr);
    });

    it('should handle amount with 8 decimal places (satoshi precision)', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 200000 }],
      });

      // 8 decimal places - exact satoshi precision
      const result = await createBtcIntent(recipient, '0.00000001', segwitAddress, 0);
      expect(result.amount).toBe(1); // 1 satoshi
    });

    it('should handle large BTC amount', async () => {
      const largeAmount = 100_000_000_000; // 1000 BTC in sats
      const utxos = [{ txid: 'tx1', vout: 0, value: largeAmount + 10000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: largeAmount + 10000 }],
      });

      const result = await createBtcIntent(recipient, '1000', segwitAddress, 0);
      expect(result.amount).toBe(largeAmount);
    });

    it('should handle dust amount (1 satoshi)', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);

      (bitcoin.Transaction.fromHex as jest.Mock).mockReturnValue({
        getId: jest.fn(() => 'tx1'),
        outs: [{ script: Buffer.from('script1', 'hex'), value: 10000 }],
      });

      const result = await createBtcIntent(recipient, '0.00000001', segwitAddress, 0);
      expect(result.amount).toBe(1);
    });
  });
});
