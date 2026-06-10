/**
 * Tests for useSendBalances hook
 */

import { renderHook } from '@testing-library/react-native';
import { useSendBalances } from '../hooks/useSendBalances';
import { useBalance } from '../../../contexts/WalletDataContext';

// Mock dependencies
jest.mock('../../../contexts/WalletDataContext', () => ({
  useBalance: jest.fn(() => ({
    segwitBalance: 0.05,
    taprootBalance: 0.02,
    runesBalance: [],
    unconfirmedSegwitBalance: 0.01,
    unconfirmedTaprootBalance: 0.005,
  })),
}));

jest.mock('../../../contexts/CashuContext', () => ({
  useCashuBalanceState: jest.fn(() => ({
    balance: 5000, // 50.00 UNIT in smallest units
  })),
}));

jest.mock('../../../utils/runesHelper', () => ({
  getRunesAmount: jest.fn(() => 25), // 25 UNIT from runes
}));

describe('useSendBalances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate BTC balance including unconfirmed', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 1000 })
    );

    // (0.05 + 0.01) + (0.02 + 0.005) = 0.085 BTC
    expect(result.current!.btcBalance).toBeCloseTo(0.085);
  });

  it('should calculate UNIT balance from runes and cashu', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 1000 })
    );

    // 25 (runes) + 50 (cashu 5000/100) = 75 UNIT
    expect(result.current!.unitBalance).toBe(75);
  });

  it('should calculate max sendable BTC after fees', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 100000 }) // 0.001 BTC fee
    );

    // max(source balances 0.06 vs 0.025) - 0.001 BTC fee = 0.059 BTC
    expect(result.current!.maxSendableBtc).toBeCloseTo(0.059);
  });

  it('should allow Taproot-funded BTC sends when Taproot has the larger source balance', () => {
    (useBalance as jest.Mock).mockReturnValueOnce({
      segwitBalance: 0,
      taprootBalance: 0.04,
      runesBalance: [],
      unconfirmedSegwitBalance: 0,
      unconfirmedTaprootBalance: 0,
    });

    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 50000 }) // 0.0005 BTC fee
    );

    expect(result.current!.btcBalance).toBeCloseTo(0.04);
    expect(result.current!.maxSendableBtc).toBeCloseTo(0.0395);
  });

  it('should return 0 max sendable if fees exceed balance', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 10000000 }) // 0.1 BTC fee (more than balance)
    );

    expect(result.current!.maxSendableBtc).toBe(0);
  });

  it('should calculate BTC balance in sats', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 1000 })
    );

    // 0.085 BTC = 8,500,000 sats
    expect(result.current!.btcBalanceSats).toBe(8500000);
  });

  it('should return true for hasSufficientBtcForUnitFees when BTC covers fees', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 1000 }) // Low fee
    );

    expect(result.current!.hasSufficientBtcForUnitFees).toBe(true);
  });

  it('should return false for hasSufficientBtcForUnitFees when BTC is insufficient', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 10000000 }) // 0.1 BTC fee
    );

    expect(result.current!.hasSufficientBtcForUnitFees).toBe(false);
  });

  it('should set maxSendableUnit equal to unitBalance', () => {
    const { result } = renderHook(() =>
      useSendBalances({ estimatedFeeSats: 1000 })
    );

    expect(result.current!.maxSendableUnit).toBe(result.current.unitBalance);
  });
});
