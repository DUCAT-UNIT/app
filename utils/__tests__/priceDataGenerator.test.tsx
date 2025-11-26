// @ts-nocheck
/**
 * Tests for Price Data Generator Utilities
 */

import { generateUnitPriceData } from '../priceDataGenerator';

describe('generateUnitPriceData', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(1000000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate 60 data points for 1D timeframe', () => {
    const data = generateUnitPriceData('1D');

    expect(data).toHaveLength(60);
  });

  it('should generate 60 data points for 1W timeframe', () => {
    const data = generateUnitPriceData('1W');

    expect(data).toHaveLength(60);
  });

  it('should generate 60 data points for 1M timeframe', () => {
    const data = generateUnitPriceData('1M');

    expect(data).toHaveLength(60);
  });

  it('should generate 60 data points for 1Y timeframe', () => {
    const data = generateUnitPriceData('1Y');

    expect(data).toHaveLength(60);
  });

  it('should default to 1M timeframe for unknown timeframe', () => {
    const data = generateUnitPriceData('UNKNOWN');

    expect(data).toHaveLength(60);
  });

  it('should generate data with timestamps and prices', () => {
    const data = generateUnitPriceData('1D');

    data.forEach(([timestamp, price]) => {
      expect(typeof timestamp).toBe('number');
      expect(typeof price).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
      expect(price).toBeGreaterThan(0);
    });
  });

  it('should keep prices within bounds (0.995 to 1.025)', () => {
    // Run multiple times to test randomness
    for (let i = 0; i < 10; i++) {
      const data = generateUnitPriceData('1M');

      data.forEach(([, price]) => {
        expect(price).toBeGreaterThanOrEqual(0.995);
        expect(price).toBeLessThanOrEqual(1.025);
      });
    }
  });

  it('should generate timestamps in ascending order', () => {
    const data = generateUnitPriceData('1W');

    for (let i = 1; i < data.length; i++) {
      expect(data[i][0]).toBeGreaterThan(data[i - 1][0]);
    }
  });

  it('should generate most recent timestamp close to current time', () => {
    const now = Date.now();
    const data = generateUnitPriceData('1D');
    const lastTimestamp = data[data.length - 1][0];

    // Last timestamp should be within one interval of now
    const interval = 24 * 60 * 60 * 1000 / 60;
    expect(lastTimestamp).toBeGreaterThan(now - interval);
    expect(lastTimestamp).toBeLessThanOrEqual(now);
  });

  it('should start price around 1.0', () => {
    const data = generateUnitPriceData('1M');
    const firstPrice = data[0][1];

    // First price should be reasonably close to 1.0 (within random walk range)
    expect(firstPrice).toBeGreaterThanOrEqual(0.995);
    expect(firstPrice).toBeLessThanOrEqual(1.025);
  });

  it('should generate different data on multiple calls due to randomness', () => {
    const data1 = generateUnitPriceData('1M');
    const data2 = generateUnitPriceData('1M');

    // Timestamps should be the same (deterministic based on Date.now())
    expect(data1[0][0]).toBe(data2[0][0]);

    // Prices should likely be different due to randomness
    // (there's a tiny chance they could be the same, but very unlikely)
    const prices1 = data1.map(([, price]) => price);
    const prices2 = data2.map(([, price]) => price);

    // At least some prices should be different
    const hasDifferences = prices1.some((price, i) => price !== prices2[i]);
    expect(hasDifferences).toBe(true);
  });
});
