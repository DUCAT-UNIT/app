/**
 * Tests for formatting utilities
 */

import {
  satsToBTC,
  btcToSats,
  truncateAddress,
  formatSatoshis,
  formatBTC,
} from '../formatters';

describe('formatters', () => {
  describe('satsToBTC', () => {
    it('should convert satoshis to BTC correctly', () => {
      expect(satsToBTC(100000000)).toBe(1);
      expect(satsToBTC(50000000)).toBe(0.5);
      expect(satsToBTC(1)).toBe(0.00000001);
      expect(satsToBTC(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(satsToBTC(2100000000000000)).toBe(21000000); // Max supply
    });

    it('should handle decimal precision', () => {
      expect(satsToBTC(12345678)).toBe(0.12345678);
      expect(satsToBTC(1234)).toBe(0.00001234);
    });
  });

  describe('btcToSats', () => {
    it('should convert BTC to satoshis correctly', () => {
      expect(btcToSats(1)).toBe(100000000);
      expect(btcToSats(0.5)).toBe(50000000);
      expect(btcToSats(0.00000001)).toBe(1);
      expect(btcToSats(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(btcToSats(21000000)).toBe(2100000000000000);
    });

    it('should round decimal values', () => {
      expect(btcToSats(0.123456789)).toBe(12345679); // Rounds to nearest sat
      expect(btcToSats(1.999999999)).toBe(200000000); // Rounds up
    });

    it('should handle very small amounts', () => {
      expect(btcToSats(0.000000001)).toBe(0); // Below 1 satoshi floors to 0
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain value through round-trip conversion', () => {
      const originalSats = 12345678;
      const btc = satsToBTC(originalSats);
      const backToSats = btcToSats(btc);
      expect(backToSats).toBe(originalSats);
    });

    it('should maintain value for whole BTC amounts', () => {
      const originalBtc = 5;
      const sats = btcToSats(originalBtc);
      const backToBtc = satsToBTC(sats);
      expect(backToBtc).toBe(originalBtc);
    });
  });

  describe('truncateAddress', () => {
    it('should truncate long addresses correctly', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const formatted = truncateAddress(address);
      expect(formatted).toBe('tb1qw508...7kxpjzsx');
    });

    it('should use custom start and end chars', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const formatted = truncateAddress(address, 6, 6);
      expect(formatted).toBe('tb1qw5...xpjzsx');
    });

    it('should return short addresses unchanged', () => {
      const shortAddress = 'tb1qshort';
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });

    it('should handle empty or null addresses', () => {
      expect(truncateAddress('')).toBe('');
      expect(truncateAddress(null)).toBe('');
      expect(truncateAddress(undefined)).toBe('');
    });

    it('should handle addresses exactly at length threshold', () => {
      const address = '1234567890123456'; // 16 chars (8 + 8)
      expect(truncateAddress(address)).toBe(address);
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
      expect(formatBTC(100000000)).toBe('1.00000000'); // 1 BTC in satoshis
      expect(formatBTC(50000000)).toBe('0.50000000'); // 0.5 BTC in satoshis
      expect(formatBTC(12345678)).toBe('0.12345678'); // 0.12345678 BTC in satoshis
    });

    it('should respect custom decimal places', () => {
      expect(formatBTC(100000000, 2)).toBe('1.00'); // 1 BTC with 2 decimals
      expect(formatBTC(50000000, 4)).toBe('0.5000'); // 0.5 BTC with 4 decimals
      expect(formatBTC(123456789, 6)).toBe('1.234568'); // Rounded
    });

    it('should handle zero', () => {
      expect(formatBTC(0)).toBe('0.00000000');
      expect(formatBTC(0, 2)).toBe('0.00');
    });

    it('should round properly', () => {
      expect(formatBTC(12345679, 8)).toBe('0.12345679'); // 0.12345679 BTC
      expect(formatBTC(199999999, 8)).toBe('1.99999999'); // 1.99999999 BTC
    });
  });
});
