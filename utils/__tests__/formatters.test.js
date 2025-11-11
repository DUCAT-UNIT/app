/**
 * Tests for formatting utilities
 */

import {
  satoshisToBTC,
  btcToSatoshis,
  formatAddress,
  formatSatoshis,
  formatBTC,
} from '../formatters';

describe('formatters', () => {
  describe('satoshisToBTC', () => {
    it('should convert satoshis to BTC correctly', () => {
      expect(satoshisToBTC(100000000)).toBe(1);
      expect(satoshisToBTC(50000000)).toBe(0.5);
      expect(satoshisToBTC(1)).toBe(0.00000001);
      expect(satoshisToBTC(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(satoshisToBTC(2100000000000000)).toBe(21000000); // Max supply
    });

    it('should handle decimal precision', () => {
      expect(satoshisToBTC(12345678)).toBe(0.12345678);
      expect(satoshisToBTC(1234)).toBe(0.00001234);
    });
  });

  describe('btcToSatoshis', () => {
    it('should convert BTC to satoshis correctly', () => {
      expect(btcToSatoshis(1)).toBe(100000000);
      expect(btcToSatoshis(0.5)).toBe(50000000);
      expect(btcToSatoshis(0.00000001)).toBe(1);
      expect(btcToSatoshis(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(btcToSatoshis(21000000)).toBe(2100000000000000);
    });

    it('should floor decimal values', () => {
      expect(btcToSatoshis(0.123456789)).toBe(12345678); // Floors to 8 decimals
      expect(btcToSatoshis(1.999999999)).toBe(199999999); // Floors
    });

    it('should handle very small amounts', () => {
      expect(btcToSatoshis(0.000000001)).toBe(0); // Below 1 satoshi floors to 0
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain value through round-trip conversion', () => {
      const originalSats = 12345678;
      const btc = satoshisToBTC(originalSats);
      const backToSats = btcToSatoshis(btc);
      expect(backToSats).toBe(originalSats);
    });

    it('should maintain value for whole BTC amounts', () => {
      const originalBtc = 5;
      const sats = btcToSatoshis(originalBtc);
      const backToBtc = satoshisToBTC(sats);
      expect(backToBtc).toBe(originalBtc);
    });
  });

  describe('formatAddress', () => {
    it('should truncate long addresses correctly', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const formatted = formatAddress(address);
      expect(formatted).toBe('tb1qw508...7kxpjzsx');
    });

    it('should use custom start and end chars', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const formatted = formatAddress(address, 6, 6);
      expect(formatted).toBe('tb1qw5...xpjzsx');
    });

    it('should return short addresses unchanged', () => {
      const shortAddress = 'tb1qshort';
      expect(formatAddress(shortAddress)).toBe(shortAddress);
    });

    it('should handle empty or null addresses', () => {
      expect(formatAddress('')).toBe('');
      expect(formatAddress(null)).toBe(null);
      expect(formatAddress(undefined)).toBe(undefined);
    });

    it('should handle addresses exactly at length threshold', () => {
      const address = '1234567890123456'; // 16 chars (8 + 8)
      expect(formatAddress(address)).toBe(address);
    });
  });

  describe('formatSatoshis', () => {
    it('should format with commas', () => {
      expect(formatSatoshis(1000)).toBe('1,000');
      expect(formatSatoshis(1000000)).toBe('1,000,000');
      expect(formatSatoshis(100000000)).toBe('100,000,000');
    });

    it('should handle small amounts without commas', () => {
      expect(formatSatoshis(100)).toBe('100');
      expect(formatSatoshis(1)).toBe('1');
      expect(formatSatoshis(0)).toBe('0');
    });

    it('should format large amounts', () => {
      expect(formatSatoshis(2100000000000000)).toBe('2,100,000,000,000,000');
    });
  });

  describe('formatBTC', () => {
    it('should format with default 8 decimals', () => {
      expect(formatBTC(1)).toBe('1.00000000');
      expect(formatBTC(0.5)).toBe('0.50000000');
      expect(formatBTC(0.12345678)).toBe('0.12345678');
    });

    it('should respect custom decimal places', () => {
      expect(formatBTC(1, 2)).toBe('1.00');
      expect(formatBTC(0.5, 4)).toBe('0.5000');
      expect(formatBTC(1.23456789, 6)).toBe('1.234568'); // Rounded
    });

    it('should handle zero', () => {
      expect(formatBTC(0)).toBe('0.00000000');
      expect(formatBTC(0, 2)).toBe('0.00');
    });

    it('should round properly', () => {
      expect(formatBTC(0.123456789, 8)).toBe('0.12345679'); // Rounds up
      expect(formatBTC(1.999999999, 8)).toBe('2.00000000'); // Rounds up
    });
  });
});
