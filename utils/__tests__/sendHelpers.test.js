/**
 * Tests for Send Transaction Helper Functions
 */

import {
  formatNumberWithCommas,
  removeCommas,
  formatBTC,
  validateBitcoinAddress,
} from '../sendHelpers';

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

  describe('removeCommas', () => {
    it('should remove all commas from string', () => {
      expect(removeCommas('1,000')).toBe('1000');
      expect(removeCommas('1,000,000')).toBe('1000000');
      expect(removeCommas('123,456,789')).toBe('123456789');
    });

    it('should preserve decimals', () => {
      expect(removeCommas('1,000.50')).toBe('1000.50');
      expect(removeCommas('123,456.789')).toBe('123456.789');
    });

    it('should handle strings without commas', () => {
      expect(removeCommas('1000')).toBe('1000');
      expect(removeCommas('50.25')).toBe('50.25');
    });

    it('should handle empty string', () => {
      expect(removeCommas('')).toBe('');
    });

    it('should handle multiple commas', () => {
      expect(removeCommas('1,,,000')).toBe('1000');
    });
  });

  describe('formatBTC', () => {
    it('should format BTC with 2 decimal places minimum', () => {
      expect(formatBTC('1')).toBe('1.00');
      expect(formatBTC('5')).toBe('5.00');
      expect(formatBTC('0')).toBe('0.00');
    });

    it('should preserve significant decimals', () => {
      expect(formatBTC('1.5')).toBe('1.5');
      expect(formatBTC('0.12345678')).toBe('0.12345678');
      expect(formatBTC('0.001')).toBe('0.001');
    });

    it('should trim trailing zeros', () => {
      expect(formatBTC('1.50000000')).toBe('1.5');
      expect(formatBTC('0.10000000')).toBe('0.1');
      expect(formatBTC('5.00000000')).toBe('5.00'); // Keep at least 2 decimals
    });

    it('should handle invalid input', () => {
      expect(formatBTC('invalid')).toBe('0.00');
      expect(formatBTC('')).toBe('0.00');
      expect(formatBTC(null)).toBe('0.00');
      expect(formatBTC(undefined)).toBe('0.00');
    });

    it('should handle numbers without decimals', () => {
      expect(formatBTC('100')).toBe('100.00');
      expect(formatBTC('50')).toBe('50.00');
    });

    it('should handle very small amounts', () => {
      expect(formatBTC('0.00000001')).toBe('0.00000001');
      expect(formatBTC('0.00001')).toBe('0.00001');
    });

    it('should handle large amounts', () => {
      expect(formatBTC('21000000')).toBe('21000000.00');
      expect(formatBTC('100.123')).toBe('100.123');
    });

    it('should convert to fixed 8 decimals then trim', () => {
      // This tests the internal behavior of toFixed(8) then trimming
      expect(formatBTC('1.123456789')).toBe('1.12345679'); // Rounds 9th decimal
      expect(formatBTC('0.999999999')).toBe('1.00'); // Rounds up
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
      expect(result.error).toBe('');
    });

    it('should return valid false for null address', () => {
      const result = validateBitcoinAddress(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('');
    });

    it('should return valid false for undefined address', () => {
      const result = validateBitcoinAddress(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('');
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

  describe('integration tests', () => {
    it('should format and remove commas consistently', () => {
      const original = '1000000';
      const formatted = formatNumberWithCommas(original);
      const removed = removeCommas(formatted);
      expect(removed).toBe(original);
    });

    it('should handle full BTC formatting workflow', () => {
      // User enters: 1.5 BTC
      const userInput = '1.5';
      const formatted = formatBTC(userInput);
      expect(formatted).toBe('1.5');

      // With commas for display
      const withCommas = formatNumberWithCommas(formatted);
      expect(withCommas).toBe('1.5');

      // Remove for processing
      const forProcessing = removeCommas(withCommas);
      expect(forProcessing).toBe('1.5');
    });

    it('should handle large amount workflow', () => {
      const userInput = '1000000.12345678';
      const withCommas = formatNumberWithCommas(userInput);
      expect(withCommas).toBe('1,000,000.12345678');

      const formatted = formatBTC(removeCommas(withCommas));
      expect(formatted).toBe('1000000.12345678');
    });
  });
});
