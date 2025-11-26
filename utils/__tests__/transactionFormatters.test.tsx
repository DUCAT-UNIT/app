// @ts-nocheck
/**
 * Tests for transaction formatters
 */

import { formatTransactionDate } from '../formatters/dates';
import {
  formatTxid,
  formatTransactionAmount,
} from '../transactionFormatters';

describe('transactionFormatters', () => {
  describe('formatTransactionDate', () => {
    it('should return "Pending" for null timestamp', () => {
      expect(formatTransactionDate(null)).toBe('Pending');
    });

    it('should return "Pending" for undefined timestamp', () => {
      expect(formatTransactionDate(undefined)).toBe('Pending');
    });

    it('should format valid timestamp correctly', () => {
      // January 1, 2024, 12:00 PM UTC
      const timestamp = 1704110400;
      const result = formatTransactionDate(timestamp);

      // Check that it contains expected parts
      expect(result).toContain('Jan');
      expect(result).toContain('1');
      expect(result).toContain('2024');
    });
  });

  describe('formatTxid', () => {
    it('should return empty string for null txid', () => {
      expect(formatTxid(null)).toBe('');
    });

    it('should return empty string for undefined txid', () => {
      expect(formatTxid(undefined)).toBe('');
    });

    it('should shorten long txid correctly', () => {
      const txid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = formatTxid(txid);

      expect(result).toBe('abcdef12...34567890');
    });

    it('should handle short txid', () => {
      const txid = 'short';
      const result = formatTxid(txid);

      expect(result).toContain('...');
    });
  });

  describe('formatTransactionAmount', () => {
    it('should format UNIT amount correctly', () => {
      const amount = 10000; // 100 UNIT (stored with 100x multiplier)
      const result = formatTransactionAmount(amount, 'UNIT');

      expect(result).toBe('100');
    });

    it('should format fractional UNIT amount', () => {
      const amount = 12345; // 123.45 UNIT
      const result = formatTransactionAmount(amount, 'UNIT');

      expect(result).toBe('123.45');
    });

    it('should format BTC amount correctly', () => {
      const amount = 100000000; // 1 BTC in satoshis
      const result = formatTransactionAmount(amount, 'BTC');

      expect(result).toBe('1.00000000');
    });

    it('should format small BTC amount', () => {
      const amount = 1000; // 0.00001 BTC
      const result = formatTransactionAmount(amount, 'BTC');

      expect(result).toBe('0.00001000');
    });

    it('should handle zero amount', () => {
      expect(formatTransactionAmount(0, 'BTC')).toBe('0.00000000');
      expect(formatTransactionAmount(0, 'UNIT')).toBe('0');
    });
  });
});
