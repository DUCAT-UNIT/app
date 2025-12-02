/**
 * Tests for useResponsive hook
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useResponsive } from '../useResponsive';
import { ResponsiveContext } from '../../contexts/ResponsiveContext';

describe('useResponsive', () => {
  const createWrapper = (contextValue: any) => {
    return ({ children }: { children: React.ReactNode }) => (
      <ResponsiveContext.Provider value={contextValue}>
        {children}
      </ResponsiveContext.Provider>
    );
  };

  it('should throw error when used outside ResponsiveProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useResponsive());
    }).toThrow('useResponsive must be used within a ResponsiveProvider');

    consoleError.mockRestore();
  });

  it('should return context values', () => {
    const contextValue = {
      width: 375,
      height: 812,
      screenSize: 'M' as const,
      scale: 1,
      deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 1 },
    };

    const { result } = renderHook(() => useResponsive(), {
      wrapper: createWrapper(contextValue),
    });

    expect(result.current.width).toBe(375);
    expect(result.current.height).toBe(812);
    expect(result.current.screenSize).toBe('M');
    expect(result.current.scale).toBe(1);
  });

  describe('s() scaling function', () => {
    it('should scale value by 1x', () => {
      const contextValue = {
        width: 375,
        height: 812,
        screenSize: 'M' as const,
        scale: 1,
        deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 1 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.s(10)).toBe(10);
      expect(result.current.s(16)).toBe(16);
      expect(result.current.s(100)).toBe(100);
    });

    it('should scale value with 0.85x scale (small screen)', () => {
      const contextValue = {
        width: 320,
        height: 568,
        screenSize: 'S' as const,
        scale: 0.85,
        deviceConfig: { width: 320, size: 'S' as const, label: 'Test', scale: 0.85 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.s(10)).toBe(9); // 10 * 0.85 = 8.5, rounded to 9
      expect(result.current.s(16)).toBe(14); // 16 * 0.85 = 13.6, rounded to 14
      expect(result.current.s(100)).toBe(85); // 100 * 0.85 = 85
    });

    it('should scale value with 1.1x scale (large screen)', () => {
      const contextValue = {
        width: 428,
        height: 926,
        screenSize: 'XL' as const,
        scale: 1.1,
        deviceConfig: { width: 428, size: 'XL' as const, label: 'Test', scale: 1.1 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.s(10)).toBe(11); // 10 * 1.1 = 11
      expect(result.current.s(16)).toBe(18); // 16 * 1.1 = 17.6, rounded to 18
      expect(result.current.s(100)).toBe(110); // 100 * 1.1 = 110
    });

    it('should round scaled values', () => {
      const contextValue = {
        width: 375,
        height: 812,
        screenSize: 'M' as const,
        scale: 0.9,
        deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 0.9 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      // 15 * 0.9 = 13.5, should round to 14
      expect(result.current.s(15)).toBe(14);
    });
  });

  describe('sf() scaling function with floor', () => {
    it('should scale value and apply default minimum of 10', () => {
      const contextValue = {
        width: 320,
        height: 568,
        screenSize: 'XS' as const,
        scale: 0.5,
        deviceConfig: { width: 320, size: 'XS' as const, label: 'Test', scale: 0.5 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      // 8 * 0.5 = 4, but min is 10, so should return 10
      expect(result.current.sf(8)).toBe(10);

      // 30 * 0.5 = 15, which is > 10, so should return 15
      expect(result.current.sf(30)).toBe(15);
    });

    it('should scale value with custom minimum', () => {
      const contextValue = {
        width: 320,
        height: 568,
        screenSize: 'XS' as const,
        scale: 0.5,
        deviceConfig: { width: 320, size: 'XS' as const, label: 'Test', scale: 0.5 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      // 8 * 0.5 = 4, but min is 6, so should return 6
      expect(result.current.sf(8, 6)).toBe(6);

      // 8 * 0.5 = 4, but min is 2, so should return 4
      expect(result.current.sf(8, 2)).toBe(4);
    });

    it('should return scaled value when above minimum', () => {
      const contextValue = {
        width: 375,
        height: 812,
        screenSize: 'M' as const,
        scale: 1,
        deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 1 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.sf(20)).toBe(20);
      expect(result.current.sf(16, 12)).toBe(16);
    });

    it('should round the scaled value', () => {
      const contextValue = {
        width: 375,
        height: 812,
        screenSize: 'M' as const,
        scale: 0.9,
        deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 0.9 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      // 15 * 0.9 = 13.5, should round to 14
      expect(result.current.sf(15)).toBe(14);
    });
  });

  describe('different screen sizes', () => {
    it('should handle small screen', () => {
      const contextValue = {
        width: 320,
        height: 568,
        screenSize: 'S' as const,
        scale: 0.85,
        deviceConfig: { width: 320, size: 'S' as const, label: 'Test', scale: 0.85 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.screenSize).toBe('S');
      expect(result.current.width).toBe(320);
    });

    it('should handle medium screen', () => {
      const contextValue = {
        width: 375,
        height: 812,
        screenSize: 'M' as const,
        scale: 1,
        deviceConfig: { width: 375, size: 'M' as const, label: 'Test', scale: 1 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.screenSize).toBe('M');
      expect(result.current.width).toBe(375);
    });

    it('should handle large screen', () => {
      const contextValue = {
        width: 428,
        height: 926,
        screenSize: 'XL' as const,
        scale: 1.1,
        deviceConfig: { width: 428, size: 'XL' as const, label: 'Test', scale: 1.1 },
      };

      const { result } = renderHook(() => useResponsive(), {
        wrapper: createWrapper(contextValue),
      });

      expect(result.current.screenSize).toBe('XL');
      expect(result.current.width).toBe(428);
    });
  });
});
