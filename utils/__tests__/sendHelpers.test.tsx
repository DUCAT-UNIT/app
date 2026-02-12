/**
 * Tests for Send Transaction Helper Functions
 */

import { formatNumberWithCommas } from '../sendHelpers';
import { validateBitcoinAddress } from '../bitcoin';

describe('sendHelpers', () => {
  describe('formatNumberWithCommas', () => {
    it('should format integers with commas', () => {
      expect(formatNumberWithCommas('1000')).toBe('1,000');
      expect(formatNumberWithCommas('1000000')).toBe('1,000,000');
      expect(formatNumberWithCommas('123456789')).toBe('123,456,789');
    });

    it('should format decimals with commas in integer part', () => {
      expect(formatNumberWithCommas('1000.50')).toBe('1,000.50');
      expect(formatNumberWithCommas('123456.789')).toBe('123,456.789');
      expect(formatNumberWithCommas('1000000.12345678')).toBe('1,000,000.12345678');
    });

    it('should handle numbers without commas needed', () => {
      expect(formatNumberWithCommas('100')).toBe('100');
      expect(formatNumberWithCommas('50.25')).toBe('50.25');
    });

    it('should handle empty or null input', () => {
      expect(formatNumberWithCommas('')).toBe('');
      expect(formatNumberWithCommas(null)).toBe('');
      expect(formatNumberWithCommas(undefined)).toBe('');
    });

    it('should preserve decimal places', () => {
      expect(formatNumberWithCommas('1000.00')).toBe('1,000.00');
      expect(formatNumberWithCommas('5000.12345678')).toBe('5,000.12345678');
    });

    it('should handle leading zeros', () => {
      expect(formatNumberWithCommas('0001000')).toBe('0,001,000');
    });

    it('should handle zero', () => {
      expect(formatNumberWithCommas('0')).toBe('0');
      expect(formatNumberWithCommas('0.0')).toBe('0.0');
    });
  });

  describe('validateBitcoinAddress', () => {
    it('should validate valid testnet addresses', () => {
      const result = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('segwit');
    });

    it('should reject invalid addresses', () => {
      const result = validateBitcoinAddress('invalid-address');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Bitcoin address format');
    });

    it('should return valid false for empty address', () => {
      const result = validateBitcoinAddress('');
      expect(result.valid).toBe(false);
    });

    it('should return valid false for null address', () => {
      const result = validateBitcoinAddress(null);
      expect(result.valid).toBe(false);
    });

    it('should return valid false for undefined address', () => {
      const result = validateBitcoinAddress(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject mainnet addresses', () => {
      const result = validateBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mainnet address detected');
    });

    it('should trim addresses before validation', () => {
      const result = validateBitcoinAddress('  tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx  ');
      expect(result.valid).toBe(true);
    });

    it('should detect address type', () => {
      const segwitResult = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
      expect(segwitResult.type).toBe('segwit');
    });
  });
});
