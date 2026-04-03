/**
 * Edge case tests for UTXO Selection Utilities
 * Covers boundary conditions, insufficient funds scenarios, and fee edge cases
 */

import {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
  UTXO,
} from '../utxoSelection';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('utxoSelection - Edge Cases', () => {
  describe('mergeAndFilterUtxos - Edge Cases', () => {
    it('should handle all UTXOs being spent', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 20000, status: { confirmed: true } },
      ];
      const unconfirmed = [
        { txid: 'tx3', vout: 0, value: 5000, status: { confirmed: false } },
      ];
      const spent = new Set(['tx1:0', 'tx2:0', 'tx3:0']); // All spent

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toEqual([]);
    });

    it('should handle same UTXO in both confirmed and unconfirmed (confirmed wins)', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
      ];
      const unconfirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: false } },
      ];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(1);
      expect(result[0].status.confirmed).toBe(true);
    });

    it('should handle multiple UTXOs with same txid but different vout', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx1', vout: 1, value: 20000, status: { confirmed: true } },
        { txid: 'tx1', vout: 2, value: 30000, status: { confirmed: true } },
      ];
      const unconfirmed: UTXO[] = [];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(3);
      expect(result.map(u => u.vout)).toEqual([0, 1, 2]);
    });

    it('should handle empty spent set', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
      ];
      const unconfirmed: UTXO[] = [];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(1);
    });

    it('should handle large number of UTXOs', () => {
      const confirmed = Array.from({ length: 1000 }, (_, i) => ({
        txid: `tx${i}`,
        vout: 0,
        value: 10000,
        status: { confirmed: true },
      }));
      const unconfirmed: UTXO[] = [];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(1000);
    });
  });

  describe('selectUtxosForTransaction - Edge Cases', () => {
    const createMockCalculateFee = () => jest.fn((inputs, outputs) => {
      return 10 + inputs * 68 + outputs * 31;
    });

    it('should return insufficient funds when UTXOs are too small', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 100, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 200, status: { confirmed: true } },
      ];
      const amountInSats = 100000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.totalInput).toBeLessThan(amountInSats + result.fee);
      expect(result.change).toBeLessThan(0);
    });

    it('should handle single UTXO exactly matching amount + fee', () => {
      const calculateFee = jest.fn(() => 1000);
      const utxos = [
        { txid: 'tx1', vout: 0, value: 101000, status: { confirmed: true } }, // Exact: 100k + 1k fee
      ];
      const amountInSats = 100000;

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos).toHaveLength(1);
      expect(result.totalInput).toBe(101000);
      expect(result.change).toBe(0);
    });

    it('should handle change exactly at dust limit', () => {
      const calculateFee = jest.fn(() => 454);
      const dustLimit = 546;
      const utxos = [
        { txid: 'tx1', vout: 0, value: 101000, status: { confirmed: true } },
      ];
      const amountInSats = 100000; // 101000 - 100000 - 454 = 546 (exactly dust)

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, dustLimit);

      // Change exactly at dust limit is NOT below dust, so it's returned as change
      // Only change < dustLimit is added to fee
      expect(result.change).toBe(546);
    });

    it('should handle all UTXOs being unconfirmed', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 100000, status: { confirmed: false } },
        { txid: 'tx2', vout: 0, value: 50000, status: { confirmed: false } },
      ];
      const amountInSats = 80000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos.every(u => !u.status.confirmed)).toBe(true);
    });

    it('should select all available UTXOs when total is barely sufficient', () => {
      const calculateFee = jest.fn(() => 500);
      const utxos = [
        { txid: 'tx1', vout: 0, value: 30000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 30000, status: { confirmed: true } },
        { txid: 'tx3', vout: 0, value: 40500, status: { confirmed: true } },
      ];
      const amountInSats = 100000; // Total: 100,500; Amount: 100,000; Fee: 500; Change: 0

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos).toHaveLength(3);
      expect(result.totalInput).toBe(100500);
    });

    it('should handle zero amount (should fail in validation but test selection logic)', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
      ];
      const amountInSats = 0;
      const calculateFee = jest.fn(() => 100);

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos).toHaveLength(1);
      expect(result.totalInput).toBeGreaterThan(result.fee);
    });

    it('should handle empty UTXO array', () => {
      const utxos: UTXO[] = [];
      const amountInSats = 10000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos).toEqual([]);
      expect(result.totalInput).toBe(0);
      expect(result.change).toBeLessThan(0);
    });

    it('should handle very large amount requiring many UTXOs', () => {
      const utxos = Array.from({ length: 50 }, (_, i) => ({
        txid: `tx${i}`,
        vout: 0,
        value: 10000,
        status: { confirmed: true },
      }));
      const amountInSats = 400000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos.length).toBeGreaterThan(40);
      expect(result.totalInput).toBeGreaterThanOrEqual(amountInSats + result.fee);
    });

    it('should handle fee increasing with more inputs', () => {
      const utxos = Array.from({ length: 10 }, (_, i) => ({
        txid: `tx${i}`,
        vout: 0,
        value: 20000,
        status: { confirmed: true },
      }));
      const amountInSats = 150000;
      const calculateFee = jest.fn((inputs, outputs) => {
        // Fee increases with inputs
        return 10 + inputs * 100 + outputs * 50;
      });

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      // Should iterate and recalculate fee as more UTXOs are added
      expect(result.fee).toBeGreaterThan(100);
      expect(result.selectedUtxos.length).toBeGreaterThan(1);
    });

    it('should handle negative change (insufficient funds edge)', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: true } },
      ];
      const amountInSats = 100000;
      const calculateFee = jest.fn(() => 1000);

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.change).toBeLessThan(0);
      expect(result.totalInput).toBeLessThan(amountInSats + result.fee);
    });
  });

  describe('createFeeCalculator - Edge Cases', () => {
    it('should throw error for zero fee rate resulting in zero fee', () => {
      const calculateFee = createFeeCalculator(0);
      expect(() => calculateFee(1, 1)).toThrow('Transaction fee too low');
    });

    it('should throw error for negative fee rate', () => {
      const calculateFee = createFeeCalculator(-1);
      expect(() => calculateFee(1, 1)).toThrow('Transaction fee too low');
    });

    it('should handle very high fee rate', () => {
      const calculateFee = createFeeCalculator(1000);
      const fee = calculateFee(1, 2);
      // BASE (10) + 1 input (68) + 2 outputs (62) = 140 * 1000 = 140,000
      expect(fee).toBe(140000);
    });

    it('should handle fractional fee rate and round up', () => {
      const calculateFee = createFeeCalculator(0.5);
      const fee = calculateFee(1, 1);
      // (10 + 68 + 31) * 0.5 = 54.5, rounded up = 55
      expect(fee).toBe(55);
    });

    it('should handle zero inputs and outputs', () => {
      const calculateFee = createFeeCalculator(1);
      const fee = calculateFee(0, 0);
      // BASE (10) only
      expect(fee).toBe(10);
    });

    it('should handle very large number of inputs', () => {
      const calculateFee = createFeeCalculator(1);
      const fee = calculateFee(100, 2);
      // BASE (10) + 100 inputs (6800) + 2 outputs (62) = 6872
      expect(fee).toBe(6872);
    });

    it('should handle very large number of outputs', () => {
      const calculateFee = createFeeCalculator(1);
      const fee = calculateFee(1, 100);
      // BASE (10) + 1 input (68) + 100 outputs (3100) = 3178
      expect(fee).toBe(3178);
    });

    it('should handle fractional fee rate near zero that still produces positive fee', () => {
      const calculateFee = createFeeCalculator(0.01);
      const fee = calculateFee(1, 1);
      // (10 + 68 + 31) * 0.01 = 1.09, rounded up = 2
      expect(fee).toBe(2);
    });

    it('should ceil small fractional amounts correctly', () => {
      const calculateFee = createFeeCalculator(0.1);
      const fee = calculateFee(1, 1);
      // (10 + 68 + 31) * 0.1 = 10.9, rounded up = 11
      expect(fee).toBe(11);
    });
  });
});
