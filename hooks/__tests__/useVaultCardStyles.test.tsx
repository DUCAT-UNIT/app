/**
 * Tests for useVaultCardStyles hook
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useVaultCardStyles } from '../useVaultCardStyles';
import { ResponsiveContext } from '../../contexts/ResponsiveContext';

// Mock the styles
jest.mock('../../styles/screens', () => ({
  vault: {
    vaultCard: { backgroundColor: '#1a1a1a' },
    vaultIconContainer: { borderRadius: 8 },
    vaultStatusIndicator: { backgroundColor: 'green' },
    vaultContentWrapper: { flexDirection: 'column' },
    vaultHeader: { flexDirection: 'row' },
    vaultHeaderLeft: { flex: 1 },
    vaultAssetName: { color: '#fff' },
    vaultDetailsContainer: { flexDirection: 'row' },
    vaultDetailRow: { alignItems: 'center' },
    vaultLabel: { color: '#888' },
    vaultValueContainer: { flexDirection: 'row' },
    vaultOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' },
    createVaultButton: { padding: 10 },
    createVaultButtonText: { color: '#fff' },
  },
  wallet: {
    assetInfo: { flex: 1 },
    assetValue: { color: '#888' },
    assetAmountIcon: { marginRight: 4 },
    assetAmount: { color: '#fff' },
  },
}));

describe('useVaultCardStyles', () => {
  const createWrapper = (scale: number = 1, size: 'XS' | 'S' | 'M' | 'L' | 'XL' = 'M') => {
    const contextValue = {
      width: 375,
      height: 812,
      screenSize: size,
      scale,
      deviceConfig: { width: 375, size, label: 'Test', scale },
    };

    return ({ children }: { children: React.ReactNode }) => (
      <ResponsiveContext.Provider value={contextValue}>
        {children}
      </ResponsiveContext.Provider>
    );
  };

  it('should return styles with 1x scale', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1),
    });

    // Check base styles are merged
    expect(result.current!.vaultCard).toBeDefined();
    expect(result.current.vaultCard.backgroundColor).toBe('#1a1a1a');

    // Check scaled values at 1x
    expect(result.current.vaultCard.paddingLeft).toBe(12);
    expect(result.current.vaultCard.paddingRight).toBe(12);
    expect(result.current.vaultCard.paddingVertical).toBe(12);
    expect(result.current.vaultCard.height).toBe(80);
  });

  it('should scale values with 0.85x scale (small screen)', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(0.85),
    });

    // Check scaled values at 0.85x (rounded)
    expect(result.current.vaultCard.paddingLeft).toBe(10); // 12 * 0.85 = 10.2 -> 10
    expect(result.current.vaultCard.height).toBe(68); // 80 * 0.85 = 68
    expect(result.current.vaultIconContainer.width).toBe(34); // 40 * 0.85 = 34
    expect(result.current.vaultIconContainer.height).toBe(34);
  });

  it('should scale values with 1.1x scale (large screen)', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1.1),
    });

    // Check scaled values at 1.1x (rounded)
    expect(result.current.vaultCard.paddingLeft).toBe(13); // 12 * 1.1 = 13.2 -> 13
    expect(result.current.vaultCard.height).toBe(88); // 80 * 1.1 = 88
    expect(result.current.vaultIconContainer.width).toBe(44); // 40 * 1.1 = 44
  });

  it('should apply sf() for font sizes with minimum', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(0.5), // Very small scale
    });

    // sf() should apply minimum of 10
    expect(result.current.vaultAssetName.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.current.assetValue.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.current.vaultLabel.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.current.assetAmount.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.current.createVaultButtonText.fontSize).toBeGreaterThanOrEqual(10);
  });

  it('should include all required style properties', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1),
    });

    // Check all expected properties exist
    expect(result.current!.vaultCard).toBeDefined();
    expect(result.current!.vaultIconContainer).toBeDefined();
    expect(result.current!.vaultStatusIndicator).toBeDefined();
    expect(result.current!.vaultContentWrapper).toBeDefined();
    expect(result.current!.vaultHeader).toBeDefined();
    expect(result.current!.vaultHeaderLeft).toBeDefined();
    expect(result.current!.assetInfo).toBeDefined();
    expect(result.current!.vaultAssetName).toBeDefined();
    expect(result.current!.assetValue).toBeDefined();
    expect(result.current!.vaultDetailsContainer).toBeDefined();
    expect(result.current!.vaultDetailRow).toBeDefined();
    expect(result.current!.vaultLabel).toBeDefined();
    expect(result.current!.vaultValueContainer).toBeDefined();
    expect(result.current!.assetAmountIcon).toBeDefined();
    expect(result.current!.assetAmount).toBeDefined();
    expect(result.current!.vaultOverlay).toBeDefined();
    expect(result.current!.createVaultButton).toBeDefined();
    expect(result.current!.createVaultButtonText).toBeDefined();
  });

  it('should set fixed margin to 0', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1),
    });

    expect(result.current.vaultCard.margin).toBe(0);
  });

  it('should position status indicator absolutely', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1),
    });

    expect(result.current.vaultStatusIndicator.position).toBe('absolute');
    expect(result.current.vaultStatusIndicator.top).toBe(5);
    expect(result.current.vaultStatusIndicator.right).toBe(5);
  });

  it('should set content wrapper flex to 1', () => {
    const { result } = renderHook(() => useVaultCardStyles(), {
      wrapper: createWrapper(1),
    });

    expect(result.current.vaultContentWrapper.flex).toBe(1);
  });
});
