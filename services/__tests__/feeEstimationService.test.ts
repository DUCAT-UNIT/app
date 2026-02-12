/**
 * Tests for feeEstimationService
 * Covers fee estimation for all transaction types
 */

import {
  TransactionType,
  estimateTransactionFee,
  estimateTransactionFeeQuick,
  hasSufficientBtcForFees,
  hasSufficientBtcForFeesSync,
  calculateMaxAfterFees,
  calculateMaxAfterFeesSync,
} from '../feeEstimationService';

// Mock dependencies
jest.mock('../../utils/constants', () => ({
  BITCOIN_TX: {
    ESTIMATED_TX_FEE: 1000,
    DUST_LIMIT: 546,
  },
  VAULT_CONFIG: {
    VIN_ALLOWANCE: 350,
  },
  getAddressUtxoUrl: jest.fn(),
}));

jest.mock('../transactionCalculationService', () => ({
  fetchUtxosForAddress: jest.fn(),
  calculateTransactionFee: jest.fn(),
}));

import { fetchUtxosForAddress, calculateTransactionFee } from '../transactionCalculationService';
import { BITCOIN_TX } from '../../utils/constants';

describe('feeEstimationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (calculateTransactionFee as jest.Mock).mockImplementation(
      (inputs: number, outputs: number, feeRate: number) => {
        // Simplified calculation: (inputs * 68 + outputs * 31 + 10) * feeRate
        return (inputs * 68 + outputs * 31 + 10) * feeRate;
      }
    );
  });

  describe('estimateTransactionFeeQuick', () => {
    it('should estimate BTC_SEND fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.BTC_SEND);
      expect(fee).toBe(250); // 250 vbytes at 1 sat/vB
    });

    it('should estimate UNIT_SEND fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.UNIT_SEND);
      expect(fee).toBe(500); // 500 vbytes at 1 sat/vB
    });

    it('should estimate VAULT_DEPOSIT fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.VAULT_DEPOSIT);
      // 1000 * 1 + vinAllowance (350 * 1) = 1350
      expect(fee).toBe(1350);
    });

    it('should estimate VAULT_WITHDRAW fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.VAULT_WITHDRAW);
      // 500 * 1 + vinAllowance (350 * 1) = 850
      expect(fee).toBe(850);
    });

    it('should estimate VAULT_BORROW fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.VAULT_BORROW);
      // 1000 * 1 + vinAllowance (350 * 1) = 1350
      expect(fee).toBe(1350);
    });

    it('should estimate VAULT_REPAY fee correctly', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.VAULT_REPAY);
      // 800 * 1 + vinAllowance (350 * 1) + vinAllowance (350 * 1) = 1500
      expect(fee).toBe(1500);
    });

    it('should scale fees with feeRate', () => {
      const fee1 = estimateTransactionFeeQuick(TransactionType.BTC_SEND, 1);
      const fee2 = estimateTransactionFeeQuick(TransactionType.BTC_SEND, 2);
      expect(fee2).toBe(fee1 * 2);
    });

    it('should handle high fee rates', () => {
      const fee = estimateTransactionFeeQuick(TransactionType.BTC_SEND, 100);
      expect(fee).toBe(25000); // 250 * 100
    });
  });

  describe('estimateTransactionFee', () => {
    it('should return quick estimate when no source address provided', async () => {
      const result = await estimateTransactionFee(TransactionType.BTC_SEND);

      expect(result.feeSats).toBeGreaterThan(0);
      expect(result.feeRate).toBe(1);
      expect(result.numInputs).toBe(1);
      expect(result.numOutputs).toBe(2);
    });

    it('should fetch UTXOs when source address provided', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000 },
        { txid: 'tx2', vout: 1, value: 20000 },
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.BTC_SEND,
        'tb1qtest123'
      );

      expect(fetchUtxosForAddress).toHaveBeenCalledWith('tb1qtest123');
      expect(result.numInputs).toBe(2);
    });

    it('should fall back to estimate on UTXO fetch error', async () => {
      (fetchUtxosForAddress as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await estimateTransactionFee(
        TransactionType.BTC_SEND,
        'tb1qtest123'
      );

      expect(result.numInputs).toBe(1); // Falls back to default
    });

    it('should calculate vault deposit fee with base cost and VIN allowance', async () => {
      const result = await estimateTransactionFee(TransactionType.VAULT_DEPOSIT);

      // Base cost 1000 + VIN allowance (350 * 1)
      expect(result.feeSats).toBe(1350);
    });

    it('should calculate vault borrow fee correctly', async () => {
      const result = await estimateTransactionFee(TransactionType.VAULT_BORROW);
      expect(result.feeSats).toBe(1350); // 1000 + 350
    });

    it('should calculate vault repay fee with extra rune allowance', async () => {
      const result = await estimateTransactionFee(TransactionType.VAULT_REPAY);
      // Base 800 + VIN 350 + extra rune allowance 350 = 1500
      expect(result.feeSats).toBe(1500);
    });

    it('should calculate vault withdraw fee correctly', async () => {
      const result = await estimateTransactionFee(TransactionType.VAULT_WITHDRAW);
      expect(result.feeSats).toBe(850); // 500 + 350
    });

    it('should apply custom fee rate', async () => {
      const result = await estimateTransactionFee(TransactionType.VAULT_DEPOSIT, undefined, 5);

      // For vault operations: baseCost + (VIN_ALLOWANCE * feeRate)
      // baseCost = 1000, vinAllowance = 350 * 5 = 1750
      // Total = 1000 + 1750 = 2750
      expect(result.feeSats).toBe(2750);
      expect(result.feeRate).toBe(5);
    });
  });

  describe('hasSufficientBtcForFeesSync', () => {
    it('should return true when balance exceeds required with buffer', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.BTC_SEND, 1000);

      expect(result.hasSufficientBtc).toBe(true);
      expect(result.shortfallSats).toBe(0);
      expect(result.errorMessage).toBeNull();
    });

    it('should return false when balance is insufficient', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.BTC_SEND, 100);

      expect(result.hasSufficientBtc).toBe(false);
      expect(result.shortfallSats).toBeGreaterThan(0);
      expect(result.errorMessage).not.toBeNull();
    });

    it('should include 10% buffer in required amount', () => {
      const quickFee = estimateTransactionFeeQuick(TransactionType.BTC_SEND);
      const result = hasSufficientBtcForFeesSync(TransactionType.BTC_SEND, 10000);

      expect(result.requiredBtcSats).toBe(Math.ceil(quickFee * 1.1));
    });

    it('should generate zero balance error message', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.UNIT_SEND, 0);

      expect(result.errorMessage).toContain('You need BTC in your wallet to send UNIT');
    });

    it('should generate shortfall error message for VAULT_BORROW', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_BORROW, 100);

      expect(result.errorMessage).toContain('more BTC for fees to borrow');
    });

    it('should generate shortfall error message for VAULT_REPAY', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_REPAY, 100);

      expect(result.errorMessage).toContain('more BTC for fees to repay');
    });

    it('should generate shortfall error message for VAULT_WITHDRAW', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_WITHDRAW, 100);

      expect(result.errorMessage).toContain('more BTC for fees to withdraw');
    });

    it('should generate shortfall error message for VAULT_DEPOSIT', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_DEPOSIT, 100);

      expect(result.errorMessage).toContain('more BTC for deposit fees');
    });

    it('should generate zero balance error for VAULT_BORROW', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_BORROW, 0);

      expect(result.errorMessage).toContain('You need BTC in your wallet to borrow UNIT');
    });

    it('should generate zero balance error for VAULT_REPAY', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_REPAY, 0);

      expect(result.errorMessage).toContain('You need BTC in your wallet to repay your vault');
    });

    it('should generate zero balance error for VAULT_WITHDRAW', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_WITHDRAW, 0);

      expect(result.errorMessage).toContain('You need BTC in your wallet to withdraw from your vault');
    });

    it('should generate zero balance error for VAULT_DEPOSIT', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.VAULT_DEPOSIT, 0);

      expect(result.errorMessage).toContain('You need more BTC to cover the deposit and transaction fees');
    });
  });

  describe('hasSufficientBtcForFees', () => {
    it('should return true when balance is sufficient', async () => {
      const result = await hasSufficientBtcForFees(TransactionType.BTC_SEND, 10000);

      expect(result.hasSufficientBtc).toBe(true);
      expect(result.errorMessage).toBeNull();
    });

    it('should return false when balance is insufficient', async () => {
      const result = await hasSufficientBtcForFees(TransactionType.BTC_SEND, 10);

      expect(result.hasSufficientBtc).toBe(false);
      expect(result.errorMessage).not.toBeNull();
    });

    it('should use UTXO-based estimation when source address provided', async () => {
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 10000 },
      ]);

      const result = await hasSufficientBtcForFees(
        TransactionType.BTC_SEND,
        10000,
        'tb1qtest123'
      );

      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.hasSufficientBtc).toBe(true);
    });

    it('should fall back to quick estimate on error', async () => {
      (fetchUtxosForAddress as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await hasSufficientBtcForFees(
        TransactionType.BTC_SEND,
        10000,
        'tb1qtest123'
      );

      expect(result.hasSufficientBtc).toBe(true);
    });

    it('should calculate shortfall correctly', async () => {
      const result = await hasSufficientBtcForFees(TransactionType.BTC_SEND, 100);

      expect(result.shortfallSats).toBe(result.requiredBtcSats - 100);
    });
  });

  describe('calculateMaxAfterFeesSync', () => {
    it('should return max sendable after deducting fees', () => {
      const balance = 10000;
      const max = calculateMaxAfterFeesSync(TransactionType.BTC_SEND, balance);

      expect(max).toBeLessThan(balance);
      expect(max).toBeGreaterThan(0);
    });

    it('should return 0 when balance is below dust after fees', () => {
      const max = calculateMaxAfterFeesSync(TransactionType.BTC_SEND, 300);

      expect(max).toBe(0);
    });

    it('should return 0 when balance is less than fees', () => {
      const max = calculateMaxAfterFeesSync(TransactionType.BTC_SEND, 100);

      expect(max).toBe(0);
    });

    it('should handle vault operations', () => {
      const max = calculateMaxAfterFeesSync(TransactionType.VAULT_DEPOSIT, 10000);

      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThan(10000);
    });

    it('should handle zero balance', () => {
      const max = calculateMaxAfterFeesSync(TransactionType.BTC_SEND, 0);

      expect(max).toBe(0);
    });
  });

  describe('calculateMaxAfterFees', () => {
    it('should return max sendable after deducting fees', async () => {
      const balance = 10000;
      const max = await calculateMaxAfterFees(TransactionType.BTC_SEND, balance);

      expect(max).toBeLessThan(balance);
      expect(max).toBeGreaterThan(0);
    });

    it('should use UTXO-based estimation when source address provided', async () => {
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 10000 },
      ]);

      const max = await calculateMaxAfterFees(
        TransactionType.BTC_SEND,
        10000,
        'tb1qtest123'
      );

      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(max).toBeGreaterThan(0);
    });

    it('should fall back to quick estimate on error', async () => {
      (fetchUtxosForAddress as jest.Mock).mockRejectedValue(new Error('Network error'));

      const max = await calculateMaxAfterFees(
        TransactionType.BTC_SEND,
        10000,
        'tb1qtest123'
      );

      expect(max).toBeGreaterThan(0);
    });

    it('should return 0 when max is below dust limit', async () => {
      const max = await calculateMaxAfterFees(TransactionType.BTC_SEND, 300);

      expect(max).toBe(0);
    });
  });

  describe('TransactionType enum', () => {
    it('should have all expected transaction types', () => {
      expect(TransactionType.BTC_SEND).toBe('BTC_SEND');
      expect(TransactionType.UNIT_SEND).toBe('UNIT_SEND');
      expect(TransactionType.VAULT_DEPOSIT).toBe('VAULT_DEPOSIT');
      expect(TransactionType.VAULT_WITHDRAW).toBe('VAULT_WITHDRAW');
      expect(TransactionType.VAULT_BORROW).toBe('VAULT_BORROW');
      expect(TransactionType.VAULT_REPAY).toBe('VAULT_REPAY');
    });
  });

  describe('estimateTransactionFeeQuick default case', () => {
    it('should return default fee for unknown transaction type', () => {
      // Cast to TransactionType to test the default branch
      const unknownType = 'UNKNOWN_TYPE' as TransactionType;
      const fee = estimateTransactionFeeQuick(unknownType);
      // Default is ESTIMATED_TX_FEE * feeRate = 1000 * 1
      expect(fee).toBe(1000);
    });

    it('should scale default fee with feeRate', () => {
      const unknownType = 'UNKNOWN_TYPE' as TransactionType;
      const fee = estimateTransactionFeeQuick(unknownType, 5);
      expect(fee).toBe(5000);
    });
  });

  describe('hasSufficientBtcForFeesSync default error message', () => {
    it('should generate default error message for unknown type with zero balance', () => {
      const unknownType = 'UNKNOWN_TYPE' as TransactionType;
      const result = hasSufficientBtcForFeesSync(unknownType, 0);

      expect(result.errorMessage).toContain('You need BTC in your wallet for transaction fees');
    });

    it('should generate default shortfall error message for unknown type', () => {
      const unknownType = 'UNKNOWN_TYPE' as TransactionType;
      const result = hasSufficientBtcForFeesSync(unknownType, 100);

      expect(result.errorMessage).toContain('BTC for fees');
    });
  });

  describe('hasSufficientBtcForFees error handling', () => {
    it('should handle errors and fall back to quick estimate with insufficient balance', async () => {
      (fetchUtxosForAddress as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await hasSufficientBtcForFees(
        TransactionType.BTC_SEND,
        100, // Insufficient
        'tb1qtest123'
      );

      expect(result.hasSufficientBtc).toBe(false);
      expect(result.errorMessage).not.toBeNull();
      expect(result.shortfallSats).toBeGreaterThan(0);
    });
  });

  describe('calculateMaxAfterFees error handling with dust', () => {
    it('should fall back and return 0 when error and below dust', async () => {
      (fetchUtxosForAddress as jest.Mock).mockRejectedValue(new Error('Network error'));

      const max = await calculateMaxAfterFees(
        TransactionType.BTC_SEND,
        300, // Below dust after fees
        'tb1qtest123'
      );

      expect(max).toBe(0);
    });
  });

  describe('estimateTransactionFee with UTXOs', () => {
    it('should handle empty UTXOs array from fetch', async () => {
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue([]);

      const result = await estimateTransactionFee(
        TransactionType.BTC_SEND,
        'tb1qtest123'
      );

      // Should fall back to default inputs
      expect(result.numInputs).toBe(1);
    });

    it('should calculate UNIT_SEND fee correctly without source address', async () => {
      const result = await estimateTransactionFee(TransactionType.UNIT_SEND);

      // UNIT_SEND shape: 2 inputs, 4 outputs
      // Fee calculated via mock: (2 * 68 + 4 * 31 + 10) * 1 = 260
      expect(result.numInputs).toBe(2);
      expect(result.numOutputs).toBe(4);
    });
  });

  describe('BTC_SEND shortfall error message', () => {
    it('should generate shortfall error for BTC_SEND', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.BTC_SEND, 100);

      expect(result.errorMessage).toContain('more BTC to cover fees');
    });
  });

  describe('UNIT_SEND shortfall error message', () => {
    it('should generate shortfall error for UNIT_SEND', () => {
      const result = hasSufficientBtcForFeesSync(TransactionType.UNIT_SEND, 100);

      expect(result.errorMessage).toContain('more BTC for fees to send UNIT');
    });
  });

  describe('getInputSizeForScript branches (via calculateDynamicVinAllowance)', () => {
    // These tests cover internal branches via UTXOs with different script types

    it('should handle Taproot scripts (5120 prefix)', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, script: '5120abcd1234' }, // Taproot
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        'tb1ptest123', // Taproot address
        10
      );

      // Should use P2TR_INPUT_SIZE (57.5 vbytes)
      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.feeSats).toBeGreaterThan(0);
    });

    it('should handle Native SegWit scripts (0014 prefix)', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, script: '0014abcd1234' }, // Native SegWit
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        'tb1qtest123', // SegWit address
        10
      );

      // Should use P2WPKH_INPUT_SIZE (68 vbytes)
      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.feeSats).toBeGreaterThan(0);
    });

    it('should handle P2SH scripts (a914 prefix)', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, script: 'a914abcd1234' }, // P2SH
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        '2Ntest123', // P2SH address
        10
      );

      // Should use P2SH_INPUT_SIZE (91 vbytes)
      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.feeSats).toBeGreaterThan(0);
    });

    it('should handle Legacy scripts (fallback)', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000, script: '76a914abcd1234' }, // Legacy P2PKH
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        'mtest123', // Legacy address
        10
      );

      // Should use P2PKH_INPUT_SIZE (148 vbytes)
      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.feeSats).toBeGreaterThan(0);
    });

    it('should handle UTXOs with no script (default to SegWit)', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 10000 }, // No script field
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        'tb1qtest123',
        10
      );

      // Should default to P2WPKH_INPUT_SIZE (68 vbytes)
      expect(fetchUtxosForAddress).toHaveBeenCalled();
      expect(result.feeSats).toBeGreaterThan(0);
    });

    it('should calculate VIN allowance with multiple UTXOs of different types', async () => {
      const mockUtxos = [
        { txid: 'tx1', vout: 0, value: 5000, script: '5120abcd1234' },  // Taproot
        { txid: 'tx2', vout: 1, value: 5000, script: '0014efgh5678' },  // SegWit
        { txid: 'tx3', vout: 2, value: 5000, script: 'a914ijkl9012' },  // P2SH
      ];
      (fetchUtxosForAddress as jest.Mock).mockResolvedValue(mockUtxos);

      const result = await estimateTransactionFee(
        TransactionType.VAULT_DEPOSIT,
        'tb1qtest123',
        5
      );

      expect(fetchUtxosForAddress).toHaveBeenCalled();
      // Total vsize: 57.5 + 68 + 91 = 216.5 vbytes
      // VIN allowance: 216.5 * 5 = ~1083 sats (rounded)
      expect(result.feeSats).toBeGreaterThan(1000); // baseCost + calculated VIN
    });
  });
});
