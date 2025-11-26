// @ts-nocheck
/**
 * Tests for Transaction Calculation Service
 */

import {
  calculateTransactionFee,
  determineSourceAddress,
  fetchUtxosForAddress,
  calculateMaxSendableBTC,
} from '../transactionCalculationService';
import type { Wallet } from '../transactionCalculationService';

// Mock fetch
(global as any).fetch = jest.fn();

jest.mock('../../utils/constants', () => ({
  getAddressUtxoUrl: jest.fn((address) => `https://api.example.com/address/${address}/utxo`),
}));

describe('transactionCalculationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTransactionFee', () => {
    it('should calculate fee for single input single output', () => {
      const fee = calculateTransactionFee(1, 1);
      // BASE_TX_SIZE(10) + 1*P2WPKH_INPUT_SIZE(68) + 1*P2WPKH_OUTPUT_SIZE(31) = 109 bytes
      // 109 * 1 sat/vbyte = 109 sats
      expect(fee).toBe(109);
    });

    it('should calculate fee for multiple inputs', () => {
      const fee = calculateTransactionFee(3, 1);
      // 10 + 3*68 + 1*31 = 245 bytes
      // 245 * 1 sat/vbyte = 245 sats
      expect(fee).toBe(245);
    });

    it('should calculate fee for multiple outputs', () => {
      const fee = calculateTransactionFee(1, 2);
      // 10 + 1*68 + 2*31 = 140 bytes
      // 140 * 1 sat/vbyte = 140 sats
      expect(fee).toBe(140);
    });

    it('should use custom fee rate', () => {
      const fee = calculateTransactionFee(1, 1, 5);
      // 109 bytes * 5 sat/vbyte = 545 sats
      expect(fee).toBe(545);
    });

    it('should handle high fee rate', () => {
      const fee = calculateTransactionFee(2, 2, 20);
      // 10 + 2*68 + 2*31 = 208 bytes
      // 208 * 20 = 4160 sats
      expect(fee).toBe(4160);
    });

    it('should ceil fractional fees', () => {
      // Create a scenario where fee would be fractional
      const fee = calculateTransactionFee(1, 1, 0.5);
      // 109 * 0.5 = 54.5, should ceil to 55
      expect(fee).toBe(55);
    });

    it('should handle zero inputs and outputs', () => {
      const fee = calculateTransactionFee(0, 0);
      // 10 + 0*68 + 0*31 = 10 bytes
      // 10 * 1 = 10 sats
      expect(fee).toBe(10);
    });

    it('should handle large number of inputs', () => {
      const fee = calculateTransactionFee(100, 2);
      // 10 + 100*68 + 2*31 = 6872 bytes
      // 6872 * 1 = 6872 sats
      expect(fee).toBe(6872);
    });

    it('should default to 1 sat/vbyte if no fee rate provided', () => {
      const fee1 = calculateTransactionFee(1, 1);
      const fee2 = calculateTransactionFee(1, 1, 1);
      expect(fee1).toBe(fee2);
    });
  });

  describe('determineSourceAddress', () => {
    const mockWallet = {
      segwitAddress: 'tb1qsegwitaddress',
      taprootAddress: 'tb1ptaprootaddress',
    };

    it('should always return segwit address for BTC transactions', () => {
      const sourceAddress = determineSourceAddress('tb1qrecipient', mockWallet);
      expect(sourceAddress).toBe('tb1qsegwitaddress');
    });

    it('should return segwit even when recipient is taproot', () => {
      const sourceAddress = determineSourceAddress('tb1precipient', mockWallet);
      expect(sourceAddress).toBe('tb1qsegwitaddress');
    });

    it('should return segwit for legacy recipient', () => {
      const sourceAddress = determineSourceAddress('2N8hwP1WmJrFF5QWABn38y63uYLhnJYJYTF', mockWallet);
      expect(sourceAddress).toBe('tb1qsegwitaddress');
    });

    it('should return null if no recipient address provided', () => {
      expect(determineSourceAddress(null, mockWallet)).toBe(null);
      expect(determineSourceAddress('', mockWallet)).toBe(null);
      expect(determineSourceAddress(undefined, mockWallet)).toBe(null);
    });

    it('should return null if no wallet provided', () => {
      expect(determineSourceAddress('tb1qrecipient', null)).toBe(null);
      expect(determineSourceAddress('tb1qrecipient', undefined)).toBe(null);
    });

    it('should return null if both params are missing', () => {
      expect(determineSourceAddress(null, null)).toBe(null);
      expect(determineSourceAddress(undefined, undefined)).toBe(null);
    });

    it('should handle wallet with missing addresses', () => {
      const incompleteWallet = { segwitAddress: 'tb1qsegwitaddress' } as Wallet;
      const sourceAddress = determineSourceAddress('tb1qrecipient', incompleteWallet);
      expect(sourceAddress).toBe('tb1qsegwitaddress');
    });
  });

  describe('transaction size calculations', () => {
    it('should calculate realistic P2WPKH transaction sizes', () => {
      // Typical transaction: 1 input, 2 outputs (recipient + change)
      const fee = calculateTransactionFee(1, 2, 1);
      // 10 + 68 + 62 = 140 bytes
      expect(fee).toBe(140);

      // This should be roughly 140 vbytes for a typical P2WPKH transaction
      expect(fee).toBeGreaterThan(100);
      expect(fee).toBeLessThan(200);
    });

    it('should calculate MAX send transaction (no change output)', () => {
      // When sending MAX, there's only 1 output (no change)
      const fee = calculateTransactionFee(1, 1, 1);
      expect(fee).toBe(109);

      // Should be smaller than 2-output transaction
      const feeWithChange = calculateTransactionFee(1, 2, 1);
      expect(fee).toBeLessThan(feeWithChange);
    });

    it('should scale linearly with number of inputs', () => {
      const fee1 = calculateTransactionFee(1, 1, 1);
      const fee2 = calculateTransactionFee(2, 1, 1);
      const fee3 = calculateTransactionFee(3, 1, 1);

      // Each additional input should add exactly 68 bytes
      expect(fee2 - fee1).toBe(68);
      expect(fee3 - fee2).toBe(68);
    });

    it('should scale linearly with number of outputs', () => {
      const fee1 = calculateTransactionFee(1, 1, 1);
      const fee2 = calculateTransactionFee(1, 2, 1);
      const fee3 = calculateTransactionFee(1, 3, 1);

      // Each additional output should add exactly 31 bytes
      expect(fee2 - fee1).toBe(31);
      expect(fee3 - fee2).toBe(31);
    });
  });

  describe('edge cases and validation', () => {
    it('should handle extremely large fee rates', () => {
      const fee = calculateTransactionFee(1, 1, 1000);
      expect(fee).toBe(109000);
    });

    it('should handle zero fee rate', () => {
      const fee = calculateTransactionFee(1, 1, 0);
      expect(fee).toBe(0);
    });

    it('should handle negative fee rate (edge case)', () => {
      const fee = calculateTransactionFee(1, 1, -1);
      // Should still calculate, though negative fees are nonsensical
      expect(fee).toBe(-109);
    });

    it('should handle fractional inputs/outputs (edge case)', () => {
      // In practice this shouldn't happen, but test behavior
      const fee = calculateTransactionFee(1.5, 2.5, 1);
      // 10 + 1.5*68 + 2.5*31 = 10 + 102 + 77.5 = 189.5, ceiled to 190
      expect(fee).toBe(190);
    });
  });

  describe('fetchUtxosForAddress', () => {
    it('should fetch and filter confirmed UTXOs', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx2', vout: 1, value: 20000, status: { confirmed: false } },
        { txid: 'tx3', vout: 0, value: 30000, status: { confirmed: true } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await fetchUtxosForAddress('tb1qtest');

      expect(result).toEqual([
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx3', vout: 0, value: 30000, status: { confirmed: true } },
      ]);
    });

    it('should return empty array if all UTXOs are unconfirmed', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: false } },
        { txid: 'tx2', vout: 1, value: 20000, status: { confirmed: false } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await fetchUtxosForAddress('tb1qtest');

      expect(result).toEqual([]);
    });

    it('should return empty array if no UTXOs', async () => {
      (global as any).fetch.mockResolvedValueOnce({
        json: async () => [],
      });

      const result = await fetchUtxosForAddress('tb1qtest');

      expect(result).toEqual([]);
    });
  });

  describe('calculateMaxSendableBTC', () => {
    it('should calculate max sendable with UTXOs', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 100000, status: { confirmed: true } },
        { txid: 'tx2', vout: 1, value: 50000, status: { confirmed: true } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.0015,
        feeRate: 1,
      });

      // Total: 150000 sats
      // Fee for 2 inputs, 1 output: 10 + 2*68 + 1*31 = 177 sats
      // Max sendable: 150000 - 177 = 149823 sats = 0.00149823 BTC
      expect(result).toBeCloseTo(0.00149823, 8);
    });

    it('should use fallback estimation when no source address', async () => {
      const result = await calculateMaxSendableBTC({
        sourceAddress: null as unknown as string,
        btcBalance: 0.001,
        feeRate: 1,
      });

      // 0.001 BTC = 100000 sats
      // Estimated fee: 250 sats
      // Max: (100000 - 250) / 100000000 = 0.0009975 BTC
      expect(result).toBe(0.0009975);
    });

    it('should return 0 if result is below dust limit', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 600, status: { confirmed: true } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.000006,
        feeRate: 1,
      });

      // 600 - fee = below 546 (dust limit)
      expect(result).toBe(0);
    });

    it('should handle fetch errors with fallback', async () => {
      (global as any).fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.001,
        feeRate: 1,
      });

      // Should fall back to balance-based estimation
      // 0.001 BTC = 100000 sats
      // Estimated fee: 250 sats
      // Max: (100000 - 250) / 100000000 = 0.0009975 BTC
      expect(result).toBe(0.0009975);
    });

    it('should handle empty UTXO list with fallback', async () => {
      (global as any).fetch.mockResolvedValueOnce({
        json: async () => [],
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.001,
        feeRate: 1,
      });

      // Total value: 0
      // Fee: 10 sats (0 inputs, 1 output)
      // Result: -10 sats, which is < 546, so returns 0
      expect(result).toBe(0);
    });

    it('should use custom fee rate', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 100000, status: { confirmed: true } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.001,
        feeRate: 5,
      });

      // Total: 100000 sats
      // Fee for 1 input, 1 output at 5 sat/vbyte: (10 + 68 + 31) * 5 = 545 sats
      // Max sendable: 100000 - 545 = 99455 sats = 0.00099455 BTC
      expect(result).toBeCloseTo(0.00099455, 8);
    });

    it('should calculate correctly with many UTXOs', async () => {
      const mockUtxos = Array.from({ length: 10 }, (_, i) => ({
        txid: `tx${i}`,
        vout: 0,
        value: 10000,
        status: { confirmed: true },
      }));

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.001,
        feeRate: 1,
      });

      // Total: 10 * 10000 = 100000 sats
      // Fee for 10 inputs, 1 output: 10 + 10*68 + 1*31 = 721 sats
      // Max sendable: 100000 - 721 = 99279 sats = 0.00099279 BTC
      expect(result).toBeCloseTo(0.00099279, 8);
    });

    it('should handle negative balance after fees', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 100, status: { confirmed: true } },
      ];

      (global as any).fetch.mockResolvedValueOnce({
        json: async () => mockUtxos,
      });

      const result = await calculateMaxSendableBTC({
        sourceAddress: 'tb1qtest',
        btcBalance: 0.000001,
        feeRate: 1,
      });

      // 100 - fee (109) = negative, which is < 546, so returns 0
      expect(result).toBe(0);
    });
  });
});
