// @ts-nocheck
/**
 * Tests for Amount Formatting Utilities
 */

import {
  formatFiat,
  formatSatoshis,
  formatAbbreviated,
  formatPercentage,
  parseFormattedAmount,
} from '../amounts';

describe('formatFiat', () => {
  it('should format USD amounts with default 2 decimals', () => {
    expect(formatFiat(1234.56)).toBe('1,234.56');
    expect(formatFiat(1000000)).toBe('1,000,000.00');
    expect(formatFiat(0.99)).toBe('0.99');
  });

  it('should format with custom decimal places', () => {
    expect(formatFiat(1234.56789, 4)).toBe('1,234.5679');
    expect(formatFiat(100, 0)).toBe('100');
  });

  it('should handle null and undefined', () => {
    expect(formatFiat(null)).toBe('0.00');
    expect(formatFiat(undefined)).toBe('0.00');
  });

  it('should handle NaN', () => {
    expect(formatFiat(NaN)).toBe('0.00');
  });

  it('should handle non-number types', () => {
    expect(formatFiat('invalid')).toBe('0.00');
  });

  it('should format non-USD currencies', () => {
    expect(formatFiat(1234.56, 2, 'EUR')).toBe('1234.56');
    expect(formatFiat(100.123, 3, 'GBP')).toBe('100.123');
  });

  it('should handle zero correctly', () => {
    expect(formatFiat(0)).toBe('0.00');
  });

  it('should handle negative amounts', () => {
    expect(formatFiat(-1234.56)).toBe('-1,234.56');
  });
});

describe('formatSatoshis', () => {
  it('should format satoshis with thousand separators', () => {
    expect(formatSatoshis(1000)).toBe('1,000');
    expect(formatSatoshis(1234567)).toBe('1,234,567');
    expect(formatSatoshis(100000000)).toBe('100,000,000');
  });

  it('should handle small amounts without separators', () => {
    expect(formatSatoshis(100)).toBe('100');
    expect(formatSatoshis(1)).toBe('1');
  });

  it('should handle null and undefined', () => {
    expect(formatSatoshis(null)).toBe('0');
    expect(formatSatoshis(undefined)).toBe('0');
  });

  it('should handle NaN', () => {
    expect(formatSatoshis(NaN)).toBe('0');
  });

  it('should handle non-number types', () => {
    expect(formatSatoshis('invalid')).toBe('0');
  });

  it('should handle zero', () => {
    expect(formatSatoshis(0)).toBe('0');
  });

  it('should handle negative amounts', () => {
    expect(formatSatoshis(-1000)).toBe('-1,000');
  });
});

describe('formatAbbreviated', () => {
  it('should format billions', () => {
    expect(formatAbbreviated(1500000000)).toBe('1.5B');
    expect(formatAbbreviated(12345678901)).toBe('12.3B');
  });

  it('should format millions', () => {
    expect(formatAbbreviated(1500000)).toBe('1.5M');
    expect(formatAbbreviated(12345678)).toBe('12.3M');
  });

  it('should format thousands', () => {
    expect(formatAbbreviated(1500)).toBe('1.5K');
    expect(formatAbbreviated(12345)).toBe('12.3K');
  });

  it('should not abbreviate numbers under 1000', () => {
    expect(formatAbbreviated(999)).toBe('999');
    expect(formatAbbreviated(100)).toBe('100');
    expect(formatAbbreviated(1)).toBe('1');
  });

  it('should respect custom decimal places', () => {
    expect(formatAbbreviated(1234000000, 0)).toBe('1B');
    expect(formatAbbreviated(1234000, 2)).toBe('1.23M');
  });

  it('should handle negative numbers', () => {
    expect(formatAbbreviated(-1500000)).toBe('-1.5M');
    expect(formatAbbreviated(-1500)).toBe('-1.5K');
  });

  it('should handle zero', () => {
    expect(formatAbbreviated(0)).toBe('0');
  });

  it('should handle null and undefined', () => {
    expect(formatAbbreviated(null)).toBe('0');
    expect(formatAbbreviated(undefined)).toBe('0');
  });

  it('should handle NaN', () => {
    expect(formatAbbreviated(NaN)).toBe('0');
  });

  it('should handle non-number types', () => {
    expect(formatAbbreviated('invalid')).toBe('0');
  });
});

describe('formatPercentage', () => {
  it('should format positive percentages with + sign by default', () => {
    expect(formatPercentage(0.25)).toBe('+25.00%');
    expect(formatPercentage(0.1)).toBe('+10.00%');
  });

  it('should format negative percentages without + sign', () => {
    expect(formatPercentage(-0.15)).toBe('-15.00%');
    expect(formatPercentage(-0.05)).toBe('-5.00%');
  });

  it('should respect showSign parameter', () => {
    expect(formatPercentage(0.25, 2, false)).toBe('25.00%');
    expect(formatPercentage(0.1, 2, false)).toBe('10.00%');
  });

  it('should respect custom decimal places', () => {
    expect(formatPercentage(0.12345, 4)).toBe('+12.3450%');
    expect(formatPercentage(0.5, 0)).toBe('+50%');
  });

  it('should handle zero', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('should handle null, undefined, and NaN', () => {
    expect(formatPercentage(null)).toBe('0.00%');
    expect(formatPercentage(undefined)).toBe('0.00%');
    expect(formatPercentage(NaN)).toBe('0.00%');
  });

  it('should handle very small percentages', () => {
    expect(formatPercentage(0.001)).toBe('+0.10%');
  });

  it('should handle percentages over 100%', () => {
    expect(formatPercentage(1.5)).toBe('+150.00%');
  });
});

describe('parseFormattedAmount', () => {
  it('should parse formatted numbers with commas', () => {
    expect(parseFormattedAmount('1,234.56')).toBe(1234.56);
    expect(parseFormattedAmount('1,000,000')).toBe(1000000);
  });

  it('should parse simple numbers', () => {
    expect(parseFormattedAmount('123.45')).toBe(123.45);
    expect(parseFormattedAmount('100')).toBe(100);
  });

  it('should handle numbers with spaces', () => {
    expect(parseFormattedAmount(' 1,234.56 ')).toBe(1234.56);
    expect(parseFormattedAmount('1 234.56')).toBe(1234.56);
  });

  it('should handle empty or whitespace strings', () => {
    expect(parseFormattedAmount('')).toBe(0);
    expect(parseFormattedAmount('   ')).toBe(0);
  });

  it('should handle null and undefined', () => {
    expect(parseFormattedAmount(null)).toBe(0);
    expect(parseFormattedAmount(undefined)).toBe(0);
  });

  it('should handle invalid strings', () => {
    expect(parseFormattedAmount('invalid')).toBe(0);
    expect(parseFormattedAmount('abc123')).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(parseFormattedAmount('-1,234.56')).toBe(-1234.56);
  });

  it('should handle decimal-only numbers', () => {
    expect(parseFormattedAmount('0.99')).toBe(0.99);
    expect(parseFormattedAmount('.99')).toBe(0.99);
  });
});

// Import the remaining functions for testing
import { formatUnitAmount, parseUnitToSmallestUnits } from '../amounts';

describe('formatUnitAmount', () => {
  it('should format smallest units to display format', () => {
    expect(formatUnitAmount(10000)).toBe('100.00');
    expect(formatUnitAmount(5050)).toBe('50.50');
    expect(formatUnitAmount(100)).toBe('1.00');
  });

  it('should handle null and undefined', () => {
    expect(formatUnitAmount(null)).toBe('0.00');
    expect(formatUnitAmount(undefined)).toBe('0.00');
  });

  it('should handle bigint values', () => {
    expect(formatUnitAmount(BigInt(10000))).toBe('100.00');
    expect(formatUnitAmount(BigInt(5050))).toBe('50.50');
  });

  it('should respect custom decimal places', () => {
    expect(formatUnitAmount(10000, 0)).toBe('100');
    expect(formatUnitAmount(10000, 4)).toBe('100.0000');
  });

  it('should handle zero', () => {
    expect(formatUnitAmount(0)).toBe('0.00');
  });

  it('should handle NaN', () => {
    expect(formatUnitAmount(NaN)).toBe('0.00');
  });

  it('should handle non-number types coerced to NaN', () => {
    // @ts-ignore - Testing invalid input type
    expect(formatUnitAmount('invalid')).toBe('0.00');
    // @ts-ignore - Testing invalid input type
    expect(formatUnitAmount({})).toBe('0.00');
  });

  it('should handle large values with thousand separators', () => {
    expect(formatUnitAmount(100000000)).toBe('1,000,000.00');
  });

  it('should handle negative values', () => {
    expect(formatUnitAmount(-10000)).toBe('-100.00');
  });
});

describe('parseUnitToSmallestUnits', () => {
  it('should parse display amount to smallest units', () => {
    expect(parseUnitToSmallestUnits(100)).toBe(10000);
    expect(parseUnitToSmallestUnits(50.50)).toBe(5050);
    expect(parseUnitToSmallestUnits(1)).toBe(100);
  });

  it('should parse string amounts', () => {
    expect(parseUnitToSmallestUnits('100')).toBe(10000);
    expect(parseUnitToSmallestUnits('50.50')).toBe(5050);
    expect(parseUnitToSmallestUnits('0.99')).toBe(99);
  });

  it('should handle null and undefined', () => {
    expect(parseUnitToSmallestUnits(null)).toBe(0);
    expect(parseUnitToSmallestUnits(undefined)).toBe(0);
  });

  it('should handle NaN strings', () => {
    expect(parseUnitToSmallestUnits('invalid')).toBe(0);
    expect(parseUnitToSmallestUnits('abc')).toBe(0);
  });

  it('should handle zero', () => {
    expect(parseUnitToSmallestUnits(0)).toBe(0);
    expect(parseUnitToSmallestUnits('0')).toBe(0);
  });

  it('should round to avoid floating point issues', () => {
    // 0.1 + 0.2 floating point issue
    expect(parseUnitToSmallestUnits(0.1)).toBe(10);
    expect(parseUnitToSmallestUnits(0.29)).toBe(29);
  });

  it('should handle negative values', () => {
    expect(parseUnitToSmallestUnits(-100)).toBe(-10000);
    expect(parseUnitToSmallestUnits('-50.50')).toBe(-5050);
  });

  it('should handle empty string', () => {
    expect(parseUnitToSmallestUnits('')).toBe(0);
  });
});
