/**
 * Tests for UTXO Selection Utilities
 */

import {
  mergeAndFilterUtxos,
  selectUtxosForTransaction,
  createFeeCalculator,
} from '../utxoSelection';

describe('utxoSelection', () => {
  describe('mergeAndFilterUtxos', () => {
    it('should merge confirmed and unconfirmed UTXOs', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 20000, status: { confirmed: true } },
      ];
      const unconfirmed = [
        { txid: 'tx3', vout: 0, value: 5000, status: { confirmed: true } },
      ];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(3);
      expect(result.map(u => u.txid)).toEqual(['tx1', 'tx2', 'tx3']);
    });

    it('should not duplicate UTXOs that exist in both arrays', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
      ];
      const unconfirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } }, // Duplicate
        { txid: 'tx2', vout: 0, value: 5000, status: { confirmed: true } },
      ];
      const spent = new Set<string>();

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(2);
      expect(result.map(u => u.txid)).toEqual(['tx1', 'tx2']);
    });

    it('should filter out spent UTXOs', () => {
      const confirmed = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 20000, status: { confirmed: true } },
      ];
      const unconfirmed = [
        { txid: 'tx3', vout: 0, value: 5000, status: { confirmed: true } },
      ];
      const spent = new Set(['tx1:0', 'tx3:0']);

      const result = mergeAndFilterUtxos(confirmed, unconfirmed, spent);

      expect(result).toHaveLength(1);
      expect(result[0].txid).toBe('tx2');
    });

    it('should handle empty arrays', () => {
      const result = mergeAndFilterUtxos([], [], new Set());
      expect(result).toEqual([]);
    });

    it('should prioritize confirmed UTXOs in case of duplicate keys', () => {
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
  });

  describe('selectUtxosForTransaction', () => {
    const createMockCalculateFee = () => jest.fn((inputs, outputs) => {
      return 10 + inputs * 68 + outputs * 31; // Simplified fee calculation
    });

    it('should select UTXOs to cover amount plus fee', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 30000, status: { confirmed: true } },
        { txid: 'tx3', vout: 0, value: 20000, status: { confirmed: true } },
      ];
      const amountInSats = 60000;
      const calculateFee = createMockCalculateFee();
      const dustLimit = 546;

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, dustLimit);

      expect(result.selectedUtxos.length).toBeGreaterThan(0);
      expect(result.totalInput).toBeGreaterThanOrEqual(amountInSats + result.fee);
      expect(result.change).toBeGreaterThanOrEqual(0);
    });

    it('should prefer confirmed UTXOs over unconfirmed', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 100000, status: { confirmed: false } },
        { txid: 'tx2', vout: 0, value: 50000, status: { confirmed: true } },
      ];
      const amountInSats = 40000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos[0].txid).toBe('tx2'); // Confirmed first
    });

    it('should use unconfirmed UTXOs if no confirmed ones available', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: false } },
      ];
      const amountInSats = 40000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos).toHaveLength(1);
      expect(result.selectedUtxos[0].txid).toBe('tx1');
    });

    it('should recalculate fee for 1 output if change is below dust', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: true } },
      ];
      const amountInSats = 49500; // Will leave change < dust
      const calculateFee = createMockCalculateFee();
      const dustLimit = 546;

      // C-10: Instead of throwing, dust change is added to fee and change is set to 0
      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, dustLimit);
      expect(result.change).toBe(0);
      expect(result.selectedUtxos).toHaveLength(1);
    });

    it('should set change to 0 if remaining amount is below dust', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: true } },
      ];
      const amountInSats = 49500;
      const calculateFee = jest.fn(() => 100);
      const dustLimit = 546;

      // C-10: Instead of throwing, dust change is added to fee and change is set to 0
      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, dustLimit);
      expect(result.change).toBe(0);
      // The dust amount (400 = 50000 - 49500 - 100) should be added to the fee
      expect(result.fee).toBe(100 + (50000 - 49500 - 100));
    });

    it('should iterate until fee stabilizes', () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 10000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 20000, status: { confirmed: true } },
        { txid: 'tx3', vout: 0, value: 30000, status: { confirmed: true } },
      ];
      const amountInSats = 55000;
      const calculateFee = createMockCalculateFee();

      const result = selectUtxosForTransaction(utxos, amountInSats, calculateFee, 546);

      expect(result.selectedUtxos.length).toBeGreaterThanOrEqual(3);
      expect(result.totalInput).toBeGreaterThanOrEqual(amountInSats + result.fee);
    });
  });

  describe('createFeeCalculator', () => {
    it('should calculate correct fee for 1 input and 2 outputs', () => {
      const calculateFee = createFeeCalculator(1);
      const fee = calculateFee(1, 2);
      // BASE (10) + 1 input (68) + 2 outputs (31*2) = 140
      expect(fee).toBe(140);
    });

    it('should calculate correct fee for 2 inputs and 1 output', () => {
      const calculateFee = createFeeCalculator(1);
      const fee = calculateFee(2, 1);
      // BASE (10) + 2 inputs (68*2) + 1 output (31) = 177
      expect(fee).toBe(177);
    });

    it('should scale fee with different fee rates', () => {
      const calculateFee1 = createFeeCalculator(1);
      const calculateFee5 = createFeeCalculator(5);

      const fee1 = calculateFee1(1, 2);
      const fee5 = calculateFee5(1, 2);

      expect(fee5).toBe(fee1 * 5);
    });

    it('should use default fee rate of 1 if not specified', () => {
      const calculateFee = createFeeCalculator();
      const fee = calculateFee(1, 2);
      expect(fee).toBe(140);
    });

    it('should round up fees using Math.ceil', () => {
      const calculateFee = createFeeCalculator(1.5);
      const fee = calculateFee(1, 1);
      // (10 + 68 + 31) * 1.5 = 163.5, rounded up = 164
      expect(fee).toBe(164);
    });

    it('should throw if fee calculation results in non-positive fee', () => {
      const calculateFee = createFeeCalculator(0);
      expect(() => calculateFee(1, 1)).toThrow();
    });
  });
});
