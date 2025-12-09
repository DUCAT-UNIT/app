// @ts-nocheck
/**
 * Tests for Vault Utilities
 */

// Mock Buffer globally
global.Buffer = require('buffer').Buffer;

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn(() => new Uint8Array([0xab, 0xcd, 0xef, 0x12])),
}));

jest.mock('@ducat-unit/client-sdk', () => ({
  VaultAPI: {
    open: {
      get_quote: jest.fn(() => ({ total_cost: 5000 })),
    },
  },
}));

jest.mock('../constants', () => ({
  VAULT_CONFIG: {
    MIN_COL_RATE: 1.6,
    LIQUIDATION_RATE: 1.5,
    VIN_ALLOWANCE: 100,
    UNIT_POSTAGE: 330,
    TOKEN_POSTAGE: 546,
  },
}));

import {
  generateVaultName,
  getOpCostOpen,
  getMaxUnit,
  getMaxUnitRounded,
  computeLiquidationPrice,
  computeHealthFactor,
  getHealthStatus,
  getHealthColor,
  validateVaultParams,
} from '../vaultUtils';

describe('vaultUtils', () => {
  describe('generateVaultName', () => {
    it('should generate a vault name with correct format', () => {
      const name = generateVaultName();
      expect(name).toMatch(/^vault-[a-f0-9]{8}$/);
    });

    it('should use crypto random bytes', () => {
      const name = generateVaultName();
      expect(name).toBe('vault-abcdef12');
    });
  });

  describe('getOpCostOpen', () => {
    it('should calculate operation cost without UTXOs', () => {
      const cost = getOpCostOpen(10);
      // 5000 (from quote) + 100 * 10 (VIN_ALLOWANCE * feeRate)
      expect(cost).toBe(6000);
    });

    it('should calculate operation cost with p2tr UTXOs', () => {
      const utxos = [
        { txid: 'abc', vout: 0, value: 10000, script: '5120abcd' },
      ];
      const cost = getOpCostOpen(10, utxos);
      // 5000 (from quote) + 57 * 10 (p2tr size * feeRate)
      expect(cost).toBe(5570);
    });

    it('should calculate operation cost with p2w-pkh UTXOs', () => {
      const utxos = [
        { txid: 'abc', vout: 0, value: 10000, script: '0014abcd' },
      ];
      const cost = getOpCostOpen(10, utxos);
      // 5000 (from quote) + 68 * 10 (p2w-pkh size * feeRate)
      expect(cost).toBe(5680);
    });

    it('should calculate operation cost with p2sh UTXOs', () => {
      const utxos = [
        { txid: 'abc', vout: 0, value: 10000, script: 'a914abcd' },
      ];
      const cost = getOpCostOpen(10, utxos);
      // 5000 (from quote) + 108 * 10 (p2sh size * feeRate)
      expect(cost).toBe(6080);
    });

    it('should calculate operation cost with legacy UTXOs', () => {
      const utxos = [
        { txid: 'abc', vout: 0, value: 10000, script: '76a914abcd' },
      ];
      const cost = getOpCostOpen(10, utxos);
      // 5000 (from quote) + 148 * 10 (legacy size * feeRate)
      expect(cost).toBe(6480);
    });

    it('should handle multiple UTXOs', () => {
      const utxos = [
        { txid: 'abc', vout: 0, value: 10000, script: '5120abcd' },
        { txid: 'def', vout: 1, value: 20000, script: '5120efgh' },
      ];
      const cost = getOpCostOpen(10, utxos);
      // 5000 (from quote) + (57 + 57) * 10
      expect(cost).toBe(6140);
    });
  });

  describe('getMaxUnit', () => {
    it('should calculate max UNIT correctly', () => {
      // btc * price / MIN_COL_RATE = 1 * 100000 / 1.6 = 62500
      const maxUnit = getMaxUnit(1, 100000);
      expect(maxUnit).toBe(62500);
    });

    it('should return null for undefined price', () => {
      const maxUnit = getMaxUnit(1, undefined);
      expect(maxUnit).toBeNull();
    });

    it('should return null for zero BTC', () => {
      const maxUnit = getMaxUnit(0, 100000);
      expect(maxUnit).toBeNull();
    });

    it('should return null for negative BTC', () => {
      const maxUnit = getMaxUnit(-1, 100000);
      expect(maxUnit).toBeNull();
    });

    it('should handle decimal BTC amounts', () => {
      const maxUnit = getMaxUnit(0.5, 100000);
      expect(maxUnit).toBe(31250);
    });
  });

  describe('getMaxUnitRounded', () => {
    it('should return floored max UNIT', () => {
      const maxUnit = getMaxUnitRounded(0.001, 100000);
      // 0.001 * 100000 / 1.6 = 62.5 -> 62
      expect(maxUnit).toBe(62);
    });

    it('should return null for invalid inputs', () => {
      expect(getMaxUnitRounded(0, 100000)).toBeNull();
      expect(getMaxUnitRounded(1, undefined)).toBeNull();
    });
  });

  describe('computeLiquidationPrice', () => {
    it('should calculate liquidation price correctly', () => {
      // (unitInVault * LIQUIDATION_RATE) / btcInVault
      // (1000 * 1.5) / 0.01 = 150000
      const price = computeLiquidationPrice(1000, 0.01);
      expect(price).toBe(150000);
    });

    it('should return 0 for zero BTC', () => {
      const price = computeLiquidationPrice(1000, 0);
      expect(price).toBe(0);
    });

    it('should floor to 2 decimal places', () => {
      // Result should be floored
      const price = computeLiquidationPrice(1000, 0.015);
      // 1000 * 1.5 / 0.015 = 100000
      expect(price).toBe(100000);
    });
  });

  describe('computeHealthFactor', () => {
    it('should calculate health factor correctly', () => {
      // (btc * price / unit) * 100
      // (1 * 100000 / 50000) * 100 = 200
      const health = computeHealthFactor(1, 100000, 50000);
      expect(health).toBe(200);
    });

    it('should return 0 for zero UNIT', () => {
      const health = computeHealthFactor(1, 100000, 0);
      expect(health).toBe(0);
    });

    it('should round to whole number', () => {
      const health = computeHealthFactor(1, 100000, 33333);
      // (1 * 100000 / 33333) * 100 = 300.003...
      expect(health).toBe(300);
    });

    it('should handle very small values', () => {
      const health = computeHealthFactor(0.001, 100000, 100);
      // (0.001 * 100000 / 100) * 100 = 100
      expect(health).toBe(100);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy for factor >= 200', () => {
      expect(getHealthStatus(200)).toBe('healthy');
      expect(getHealthStatus(250)).toBe('healthy');
      expect(getHealthStatus(500)).toBe('healthy');
    });

    it('should return warning for factor 161-199', () => {
      expect(getHealthStatus(161)).toBe('warning');
      expect(getHealthStatus(180)).toBe('warning');
      expect(getHealthStatus(199)).toBe('warning');
    });

    it('should return danger for factor < 161', () => {
      expect(getHealthStatus(160)).toBe('danger');
      expect(getHealthStatus(100)).toBe('danger');
      expect(getHealthStatus(0)).toBe('danger');
    });
  });

  describe('getHealthColor', () => {
    it('should return green for healthy', () => {
      expect(getHealthColor('healthy')).toBe('#22C55E');
    });

    it('should return yellow/orange for warning', () => {
      expect(getHealthColor('warning')).toBe('#F59E0B');
    });

    it('should return red for danger', () => {
      expect(getHealthColor('danger')).toBe('#EF4444');
    });
  });

  describe('validateVaultParams', () => {
    it('should return valid for good params', () => {
      const result = validateVaultParams(1, 50000, 100000, 2);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject zero BTC amount', () => {
      const result = validateVaultParams(0, 50000, 100000, 2);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('BTC deposit amount must be greater than 0');
    });

    it('should reject negative BTC amount', () => {
      const result = validateVaultParams(-1, 50000, 100000, 2);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('BTC deposit amount must be greater than 0');
    });

    it('should reject zero UNIT amount', () => {
      const result = validateVaultParams(1, 0, 100000, 2);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('UNIT borrow amount must be greater than 0');
    });

    it('should reject insufficient BTC balance', () => {
      const result = validateVaultParams(2, 50000, 100000, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient BTC balance');
    });

    it('should reject low health factor', () => {
      // Health factor: (1 * 100000 / 70000) * 100 = 142.8%
      const result = validateVaultParams(1, 70000, 100000, 2);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Health factor too low (minimum 160%)');
    });

    it('should return multiple errors', () => {
      const result = validateVaultParams(0, 0, 100000, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should handle undefined price gracefully', () => {
      const result = validateVaultParams(1, 50000, undefined, 2);
      // Only BTC and UNIT amount validations should run
      expect(result.isValid).toBe(true);
    });
  });
});
