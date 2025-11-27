// @ts-nocheck
/**
 * Tests for formatters/index.ts barrel export and formatBalance function
 */

import { formatBalance } from '../index';

describe('formatters/index', () => {
  describe('formatBalance', () => {
    it('should format balance with default 8 decimals', () => {
      expect(formatBalance(1.5)).toBe('1.50000000');
      expect(formatBalance(0.12345678)).toBe('0.12345678');
      expect(formatBalance(100)).toBe('100.00000000');
    });

    it('should format zero balance', () => {
      expect(formatBalance(0)).toBe('0.00000000');
    });

    it('should format balance with custom decimals', () => {
      expect(formatBalance(1.5, 2)).toBe('1.50');
      expect(formatBalance(0.123, 4)).toBe('0.1230');
      expect(formatBalance(100, 0)).toBe('100');
    });

    it('should return default string for null balance', () => {
      expect(formatBalance(null)).toBe('0.00000000');
    });

    it('should return default string for undefined balance', () => {
      expect(formatBalance(undefined)).toBe('0.00000000');
    });

    it('should handle very small numbers', () => {
      expect(formatBalance(0.00000001)).toBe('0.00000001');
      expect(formatBalance(0.000001, 6)).toBe('0.000001');
    });

    it('should handle large numbers', () => {
      expect(formatBalance(21000000)).toBe('21,000,000.00000000');
      expect(formatBalance(999999.99999999)).toBe('999,999.99999999');
    });

    it('should handle negative numbers', () => {
      expect(formatBalance(-1.5)).toBe('-1.50000000');
      expect(formatBalance(-0.5, 2)).toBe('-0.50');
    });
  });

  describe('re-exports', () => {
    // Test that all expected exports are available
    it('should export address formatters', () => {
      const {
        truncateAddress,
        truncateTxid,
        looksLikeBitcoinAddress,
        getAddressType,
      } = require('../index');

      expect(typeof truncateAddress).toBe('function');
      expect(typeof truncateTxid).toBe('function');
      expect(typeof looksLikeBitcoinAddress).toBe('function');
      expect(typeof getAddressType).toBe('function');
    });

    it('should export amount formatters', () => {
      const {
        formatFiat,
        formatSatoshis,
        formatAbbreviated,
        formatPercentage,
        parseFormattedAmount,
      } = require('../index');

      expect(typeof formatFiat).toBe('function');
      expect(typeof formatSatoshis).toBe('function');
      expect(typeof formatAbbreviated).toBe('function');
      expect(typeof formatPercentage).toBe('function');
      expect(typeof parseFormattedAmount).toBe('function');
    });

    it('should export date formatters', () => {
      const {
        formatTimestamp,
        formatTransactionDate,
        formatRelativeTime,
        formatDateRange,
        isToday,
      } = require('../index');

      expect(typeof formatTimestamp).toBe('function');
      expect(typeof formatTransactionDate).toBe('function');
      expect(typeof formatRelativeTime).toBe('function');
      expect(typeof formatDateRange).toBe('function');
      expect(typeof isToday).toBe('function');
    });

    it('should export bitcoin conversions', () => {
      const {
        satsToBTC,
        btcToSats,
        formatBTC,
        formatBTCSmart,
        formatBTCAuto,
        parseBTCInput,
        SATS_PER_BTC,
      } = require('../index');

      expect(typeof satsToBTC).toBe('function');
      expect(typeof btcToSats).toBe('function');
      expect(typeof formatBTC).toBe('function');
      expect(typeof formatBTCSmart).toBe('function');
      expect(typeof formatBTCAuto).toBe('function');
      expect(typeof parseBTCInput).toBe('function');
      expect(SATS_PER_BTC).toBe(100000000);
    });
  });
});
