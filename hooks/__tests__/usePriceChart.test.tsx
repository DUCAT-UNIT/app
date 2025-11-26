// @ts-nocheck
/**
 * Tests for usePriceChart Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePriceChart } from '../usePriceChart';

// Mock dependencies
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

// Mock fetch before importing
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to render hooks with react-test-renderer
function renderHookWithProps(props) {
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = usePriceChart(hookProps.assetType, hookProps.timeframe);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });

  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('usePriceChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        prices: [
          [1699000000000, 35000],
          [1699010000000, 35100],
          [1699020000000, 35200],
          [1699030000000, 35050],
        ],
      }),
    });
  });

  describe('initial state', () => {
    it('should return initial state with priceDirection', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(result.current.priceError).toBe(null);
      expect(result.current.priceDirection).toMatchObject({
        isPositive: expect.any(Boolean),
        percentChange: expect.any(String),
        dollarChange: expect.any(String),
      });
    });

    it('should not show loading for non-BTC assets', () => {
      const { result } = renderHookWithProps({ assetType: 'UNIT', timeframe: '1D' });

      expect(result.current.priceLoading).toBe(false);
    });

    it('should return setPriceError function', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(typeof result.current.setPriceError).toBe('function');
    });
  });

  describe('fetching price data', () => {
    it('should not fetch for non-BTC assets', async () => {
      // Use a fresh mock call count check
      const fetchCallsBefore = mockFetch.mock.calls.length;

      renderHookWithProps({ assetType: 'UNIT', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
      });

      // No additional fetch calls should have been made
      const fetchCallsAfter = mockFetch.mock.calls.length;
      expect(fetchCallsAfter).toBe(fetchCallsBefore);
    });

    it('should set priceLoading to false for non-BTC assets', async () => {
      const { result } = renderHookWithProps({ assetType: 'UNIT', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.priceLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle API rate limit (429)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.priceError).toBe(null);
    });

    it('should handle non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should not throw error
      expect(result.current.priceError).toBe(null);
    });

    it('should handle empty prices array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ prices: [] }),
      });

      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.priceError).toBe(null);
    });
  });

  describe('setPriceError', () => {
    it('should allow setting custom error', async () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setPriceError('Custom error');
      });

      expect(result.current.priceError).toBe('Custom error');
    });

    it('should allow clearing error', async () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setPriceError('Error');
      });

      expect(result.current.priceError).toBe('Error');

      act(() => {
        result.current.setPriceError(null);
      });

      expect(result.current.priceError).toBe(null);
    });
  });

  describe('price direction structure', () => {
    it('should have correct structure for priceDirection', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(result.current.priceDirection).toHaveProperty('isPositive');
      expect(result.current.priceDirection).toHaveProperty('percentChange');
      expect(result.current.priceDirection).toHaveProperty('dollarChange');
    });

    it('should return numeric string for percentChange', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      // percentChange should be a numeric string
      expect(result.current.priceDirection.percentChange).toMatch(/^-?\d+\.?\d*$/);
    });
  });

  describe('return type', () => {
    it('should return all expected properties', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(result.current).toHaveProperty('priceData');
      expect(result.current).toHaveProperty('priceDirection');
      expect(result.current).toHaveProperty('priceLoading');
      expect(result.current).toHaveProperty('priceError');
      expect(result.current).toHaveProperty('setPriceError');
    });

    it('should have priceData as null or array', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(result.current.priceData === null || Array.isArray(result.current.priceData)).toBe(true);
    });

    it('should have priceLoading as boolean', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });

      expect(typeof result.current.priceLoading).toBe('boolean');
    });
  });

  describe('timeframe handling', () => {
    it('should handle 1D timeframe', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1D' });
      expect(result.current).toBeDefined();
    });

    it('should handle 1W timeframe', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1W' });
      expect(result.current).toBeDefined();
    });

    it('should handle 1M timeframe', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1M' });
      expect(result.current).toBeDefined();
    });

    it('should handle 1Y timeframe', () => {
      const { result } = renderHookWithProps({ assetType: 'BTC', timeframe: '1Y' });
      expect(result.current).toBeDefined();
    });
  });
});
