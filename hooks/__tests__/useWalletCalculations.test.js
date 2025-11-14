/**
 * Tests for useWalletCalculations Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletCalculations } from '../useWalletCalculations';
import { COLORS } from '../../theme';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
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

describe('useWalletCalculations', () => {
  const mockVaultData = {
    totalDebt: 100, // 100 UNIT (already in UNIT, not cents)
    totalCollateral: 0.5, // 0.5 BTC
    currentPrice: 50000,
    latestTransaction: {
      amountBorrowed: 10000, // 100 UNIT in cents
      vaultAmount: 50000000, // 0.5 BTC in sats
      oraclePrice: 50000,
    },
  };

  describe('totalBalanceBTC', () => {
    it('should calculate total BTC balance with only BTC', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.5,
          runesBalance: [],
          btcPrice: 50000,
        })
      );

      expect(result.current.totalBalanceBTC).toBe(1.5);
    });

    it('should calculate total BTC balance with BTC and UNIT', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '5000']], // $5000 worth of UNIT
          btcPrice: 50000, // $50k BTC
        })
      );

      // 1 BTC + (5000 / 50000) BTC = 1 + 0.1 = 1.1 BTC
      expect(result.current.totalBalanceBTC).toBe(1.1);
    });

    it('should handle zero BTC price gracefully', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '5000']],
          btcPrice: 0,
        })
      );

      // Should use fallback of 1 for division
      expect(result.current.totalBalanceBTC).toBe(5001);
    });

    it('should handle empty balances', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 0,
          runesBalance: [],
          btcPrice: 50000,
        })
      );

      expect(result.current.totalBalanceBTC).toBe(0);
    });
  });

  describe('totalBalanceUSD', () => {
    it('should calculate total USD balance with only BTC', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 2.0,
          runesBalance: [],
          btcPrice: 50000,
        })
      );

      expect(result.current.totalBalanceUSD).toBe(100000); // 2 * 50000
    });

    it('should calculate total USD balance with BTC and UNIT', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '5000']],
          btcPrice: 50000,
        })
      );

      // (1 * 50000) + 5000 = 55000
      expect(result.current.totalBalanceUSD).toBe(55000);
    });

    it('should handle zero BTC price', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '5000']],
          btcPrice: 0,
        })
      );

      expect(result.current.totalBalanceUSD).toBe(5000); // Only UNIT value
    });
  });

  describe('vaultCollateralRatio', () => {
    it('should calculate vault collateral ratio correctly', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: mockVaultData,
        })
      );

      // Collateral = 0.5 BTC * $50000 = $25000
      // Debt = 10000 / 100 = $100
      // Ratio = (25000 / 100) * 100 = 25000%
      expect(result.current.vaultCollateralRatio).toBe(25000);
    });

    it('should return 0 when no vault data', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.vaultCollateralRatio).toBe(0);
    });

    it('should return 0 when debt is 0', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: {
            totalDebt: 0,
            totalCollateral: 0.5,
            currentPrice: 50000,
            latestTransaction: {
              amountBorrowed: 0,
              vaultAmount: 50000000,
              oraclePrice: 50000,
            },
          },
        })
      );

      expect(result.current.vaultCollateralRatio).toBe(0);
    });

    it('should use oracle price when btcPrice is not available', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 0,
          vaultData: mockVaultData,
        })
      );

      // Should use oracle price (50000) from mockVaultData
      expect(result.current.vaultCollateralRatio).toBe(25000);
    });
  });

  describe('vaultHealthPercentage', () => {
    it('should return floored collateral ratio', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: mockVaultData,
        })
      );

      expect(result.current.vaultHealthPercentage).toBe(25000);
    });

    it('should return 0 when no vault', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.vaultHealthPercentage).toBe(0);
    });
  });

  describe('vaultHealthColor', () => {
    it('should return GREEN when ratio >= 200%', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: {
            totalDebt: 100, // 100 UNIT
            totalCollateral: 0.004, // 0.004 * 50000 = $200
            currentPrice: 50000,
            latestTransaction: {
              amountBorrowed: 10000, // $100
              vaultAmount: 50000000,
              oraclePrice: 50000,
            },
          },
        })
      );

      // Ratio = (200 / 100) * 100 = 200%
      expect(result.current.vaultHealthColor).toBe(COLORS.GREEN);
    });

    it('should return YELLOW when ratio >= 161% and < 200%', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: {
            totalDebt: 100, // 100 UNIT
            totalCollateral: 0.0035, // 0.0035 * 50000 = $175
            currentPrice: 50000,
            latestTransaction: {
              amountBorrowed: 10000, // $100
              vaultAmount: 50000000,
              oraclePrice: 50000,
            },
          },
        })
      );

      // Ratio = (175 / 100) * 100 = 175%
      expect(result.current.vaultHealthColor).toBe(COLORS.YELLOW);
    });

    it('should return RED when ratio < 161%', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: {
            totalDebt: 100, // 100 UNIT
            totalCollateral: 0.003, // 0.003 * 50000 = $150
            currentPrice: 50000,
            latestTransaction: {
              amountBorrowed: 10000, // $100
              vaultAmount: 50000000,
              oraclePrice: 50000,
            },
          },
        })
      );

      // Ratio = (150 / 100) * 100 = 150%
      expect(result.current.vaultHealthColor).toBe(COLORS.RED);
    });

    it('should return SECONDARY_TEXT (gray) when no vault', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.vaultHealthColor).toBe(COLORS.SECONDARY_TEXT);
    });
  });

  describe('unitValueInBTC', () => {
    it('should calculate UNIT value in BTC', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '10000']], // $10000 worth
          btcPrice: 50000,
        })
      );

      // 10000 / 50000 = 0.2 BTC
      expect(result.current.unitValueInBTC).toBe(0.2);
    });

    it('should return 0 when no runes balance', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
        })
      );

      expect(result.current.unitValueInBTC).toBe(0);
    });

    it('should return 0 when BTC price is 0', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [['UNIT', '10000']],
          btcPrice: 0,
        })
      );

      expect(result.current.unitValueInBTC).toBe(0);
    });
  });

  describe('vaultDebt', () => {
    it('should return vault debt divided by 100', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: mockVaultData,
        })
      );

      expect(result.current.vaultDebt).toBe(100); // 10000 / 100
    });

    it('should return 0 when no vault', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.vaultDebt).toBe(0);
    });
  });

  describe('vaultCollateral', () => {
    it('should return vault collateral in BTC', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: mockVaultData,
        })
      );

      expect(result.current.vaultCollateral).toBe(0.5); // 50000000 / 100000000
    });

    it('should return 0 when no vault', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.vaultCollateral).toBe(0);
    });
  });

  describe('hasVault', () => {
    it('should return true when vault exists', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: mockVaultData,
        })
      );

      expect(result.current.hasVault).toBe(true);
    });

    it('should return false when no vault data', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: null,
        })
      );

      expect(result.current.hasVault).toBe(false);
    });

    it('should return false when vault data has no latestTransaction', () => {
      const { result } = renderHook(() =>
        useWalletCalculations({
          segwitBalance: 1.0,
          runesBalance: [],
          btcPrice: 50000,
          vaultData: { latestTransaction: null },
        })
      );

      expect(result.current.hasVault).toBe(false);
    });
  });

  describe('useMemo optimization', () => {
    it('should not recalculate when unrelated props change', () => {
      const { result, rerender } = renderHook(
        ({ segwitBalance }) =>
          useWalletCalculations({
            segwitBalance,
            runesBalance: [],
            btcPrice: 50000,
          }),
        { initialProps: { segwitBalance: 1.0 } }
      );

      const firstCalc = result.current.totalBalanceBTC;

      // Rerender with same props
      rerender({ segwitBalance: 1.0 });

      // Should be the same reference (memoized)
      expect(result.current.totalBalanceBTC).toBe(firstCalc);
    });

    it('should recalculate when relevant props change', () => {
      const { result, rerender } = renderHook(
        ({ segwitBalance }) =>
          useWalletCalculations({
            segwitBalance,
            runesBalance: [],
            btcPrice: 50000,
          }),
        { initialProps: { segwitBalance: 1.0 } }
      );

      expect(result.current.totalBalanceBTC).toBe(1.0);

      // Change balance
      rerender({ segwitBalance: 2.0 });

      expect(result.current.totalBalanceBTC).toBe(2.0);
    });
  });
});
