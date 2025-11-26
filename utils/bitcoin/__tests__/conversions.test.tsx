// @ts-nocheck
/**
 * Tests for Bitcoin Conversion Utilities
 */

import {
  SATS_PER_BTC,
  satsToBTC,
  btcToSats,
  formatBTC,
  formatBTCSmart,
  parseBTCInput,
  formatBTCAuto,
} from '../conversions';

// Mock logger
jest.mock('../../logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('SATS_PER_BTC', () => {
  it('should equal 100 million', () => {
    expect(SATS_PER_BTC).toBe(100000000);
  });
});

describe('satsToBTC', () => {
  it('should convert satoshis to BTC', () => {
    expect(satsToBTC(100000000)).toBe(1);
    expect(satsToBTC(50000000)).toBe(0.5);
    expect(satsToBTC(1)).toBe(0.00000001);
  });

  it('should handle zero', () => {
    expect(satsToBTC(0)).toBe(0);
  });

  it('should handle null and undefined', () => {
    expect(satsToBTC(null)).toBe(0);
    expect(satsToBTC(undefined)).toBe(0);
  });

  it('should handle invalid input', () => {
    expect(satsToBTC('invalid')).toBe(0);
    expect(satsToBTC(NaN)).toBe(0);
  });

  it('should handle negative values', () => {
    expect(satsToBTC(-100000000)).toBe(-1);
  });
});

describe('btcToSats', () => {
  it('should convert BTC to satoshis', () => {
    expect(btcToSats(1)).toBe(100000000);
    expect(btcToSats(0.5)).toBe(50000000);
    expect(btcToSats(0.00000001)).toBe(1);
  });

  it('should floor fractional satoshis', () => {
    expect(btcToSats(0.000000015)).toBe(1);
    expect(btcToSats(0.000000019)).toBe(1);
  });

  it('should handle string input', () => {
    expect(btcToSats('1')).toBe(100000000);
    expect(btcToSats('0.5')).toBe(50000000);
  });

  it('should handle comma decimal separator', () => {
    expect(btcToSats('1,5')).toBe(150000000);
    expect(btcToSats('0,00000001')).toBe(1);
  });

  it('should handle zero', () => {
    expect(btcToSats(0)).toBe(0);
    expect(btcToSats('0')).toBe(0);
  });

  it('should handle null, undefined, and empty string', () => {
    expect(btcToSats(null)).toBe(0);
    expect(btcToSats(undefined)).toBe(0);
    expect(btcToSats('')).toBe(0);
  });

  it('should handle invalid input', () => {
    expect(btcToSats('invalid')).toBe(0);
    expect(btcToSats(NaN)).toBe(0);
  });

  it('should handle negative values', () => {
    expect(btcToSats(-1)).toBe(-100000000);
  });
});

describe('formatBTC', () => {
  it('should format satoshis as BTC with 8 decimals by default', () => {
    expect(formatBTC(100000000)).toBe('1.00000000');
    expect(formatBTC(50000000)).toBe('0.50000000');
  });

  it('should format with custom decimal places', () => {
    expect(formatBTC(100000000, 2)).toBe('1.00');
    expect(formatBTC(123456789, 4)).toBe('1.2346');
  });

  it('should handle zero', () => {
    expect(formatBTC(0)).toBe('0.00000000');
    expect(formatBTC(0, 2)).toBe('0.00');
  });

  it('should handle null and undefined', () => {
    expect(formatBTC(null, 2)).toBe('0.00');
    expect(formatBTC(undefined, 2)).toBe('0.00');
  });

  it('should handle invalid input', () => {
    expect(formatBTC('invalid', 2)).toBe('0.00');
    expect(formatBTC(NaN, 2)).toBe('0.00');
  });

  it('should handle zero decimals', () => {
    expect(formatBTC(100000000, 0)).toBe('1');
  });
});

describe('formatBTCSmart', () => {
  it('should remove trailing zeros', () => {
    expect(formatBTCSmart(100000000, 0)).toBe('1');
    expect(formatBTCSmart(150000000, 0)).toBe('1.5');
    expect(formatBTCSmart(123456789, 0)).toBe('1.23456789');
  });

  it('should keep minimum decimals', () => {
    expect(formatBTCSmart(100000000, 2)).toBe('1.00');
    expect(formatBTCSmart(100000000, 4)).toBe('1.0000');
  });

  it('should respect max decimals', () => {
    expect(formatBTCSmart(123456789, 2, 4)).toBe('1.2346');
  });

  it('should handle zero', () => {
    expect(formatBTCSmart(0)).toBe('0.00');
  });

  it('should handle null and undefined', () => {
    expect(formatBTCSmart(null)).toBe('0.00');
    expect(formatBTCSmart(undefined)).toBe('0.00');
  });

  it('should handle invalid input', () => {
    expect(formatBTCSmart('invalid')).toBe('0.00');
  });

  it('should handle small amounts', () => {
    expect(formatBTCSmart(1)).toBe('0.00000001');
  });
});

describe('parseBTCInput', () => {
  it('should parse valid BTC input', () => {
    const result = parseBTCInput('1.5');
    expect(result.valid).toBe(true);
    expect(result.satoshis).toBe(150000000);
    expect(result.error).toBeUndefined();
  });

  it('should handle comma decimal separator', () => {
    const result = parseBTCInput('1,5');
    expect(result.valid).toBe(true);
    expect(result.satoshis).toBe(150000000);
  });

  it('should handle integer input', () => {
    const result = parseBTCInput('2');
    expect(result.valid).toBe(true);
    expect(result.satoshis).toBe(200000000);
  });

  it('should reject empty input', () => {
    const result = parseBTCInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount is required');
  });

  it('should reject whitespace-only input', () => {
    const result = parseBTCInput('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount is required');
  });

  it('should reject invalid number format', () => {
    const result = parseBTCInput('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid number format');
  });

  it('should reject multiple decimal points', () => {
    const result = parseBTCInput('1.2.3');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid number format');
  });

  it('should reject zero amount', () => {
    const result = parseBTCInput('0');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount must be greater than 0');
  });

  it('should reject negative amount', () => {
    const result = parseBTCInput('-1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid number format');
  });

  it('should reject amount too small (less than 1 satoshi)', () => {
    const result = parseBTCInput('0.000000001');
    expect(result.valid).toBe(false);
    // 0.000000001 rounds to 0 sats, so gets "must be greater than 0" error
    expect(result.error).toBe('Amount must be greater than 0');
  });

  it('should accept 1 satoshi', () => {
    const result = parseBTCInput('0.00000001');
    expect(result.valid).toBe(true);
    expect(result.satoshis).toBe(1);
  });

  it('should trim whitespace', () => {
    const result = parseBTCInput('  1.5  ');
    expect(result.valid).toBe(true);
    expect(result.satoshis).toBe(150000000);
  });
});

describe('formatBTCAuto', () => {
  it('should use sats for small amounts', () => {
    const result = formatBTCAuto(50000);
    expect(result.value).toBe('50000');
    expect(result.unit).toBe('sats');
  });

  it('should use BTC for large amounts', () => {
    const result = formatBTCAuto(100000000);
    expect(result.value).toBe('1.00'); // formatBTCSmart has minDecimals=2 default
    expect(result.unit).toBe('BTC');
  });

  it('should use custom threshold', () => {
    const result = formatBTCAuto(50000, 10000);
    expect(result.unit).toBe('BTC');
  });

  it('should handle zero', () => {
    const result = formatBTCAuto(0);
    expect(result.value).toBe('0');
    expect(result.unit).toBe('BTC');
  });

  it('should handle null and undefined', () => {
    expect(formatBTCAuto(null)).toEqual({ value: '0', unit: 'BTC' });
    expect(formatBTCAuto(undefined)).toEqual({ value: '0', unit: 'BTC' });
  });

  it('should handle invalid input', () => {
    const result = formatBTCAuto('invalid');
    expect(result.value).toBe('0');
    expect(result.unit).toBe('BTC');
  });

  it('should handle negative values', () => {
    const result = formatBTCAuto(-50000);
    expect(result.value).toBe('-50000');
    expect(result.unit).toBe('sats');
  });

  it('should use default threshold of 100000', () => {
    expect(formatBTCAuto(99999).unit).toBe('sats');
    expect(formatBTCAuto(100000).unit).toBe('BTC');
  });
});
