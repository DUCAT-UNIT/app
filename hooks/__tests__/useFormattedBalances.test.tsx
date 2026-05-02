import { renderHook } from '@testing-library/react-native';
import { useFormattedBalances } from '../useFormattedBalances';

describe('useFormattedBalances', () => {
  it('formats BTC, fiat, and UNIT balances consistently', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        totalBalanceBTC: 0.12345678,
        totalBalanceUSD: 12_345.678,
        segwitBalance: 0.01,
        taprootBalance: 0.02,
        runesBalance: 123_456,
        btcPrice: 100_000,
      }),
    );

    expect(result.current).toEqual({
      totalBTC: '0.12345678',
      totalUSD: '12,345.68',
      segwitBTC: '0.01000000',
      segwitUSD: '1,000.00',
      taprootBTC: '0.02000000',
      taprootUSD: '2,000.00',
      runes: '123,456',
    });
  });

  it('defaults missing and null values to zero-safe formatted strings', () => {
    const { result } = renderHook(() =>
      useFormattedBalances({
        btcPrice: null,
      }),
    );

    expect(result.current).toEqual({
      totalBTC: '0.00000000',
      totalUSD: '0.00',
      segwitBTC: '0.00000000',
      segwitUSD: '0.00',
      taprootBTC: '0.00000000',
      taprootUSD: '0.00',
      runes: '0',
    });
  });

  it('memoizes the formatted object until an input changes', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useFormattedBalances>[0]) => useFormattedBalances(props),
      {
        initialProps: {
          totalBalanceBTC: 1,
          totalBalanceUSD: 2,
          segwitBalance: 3,
          taprootBalance: 4,
          runesBalance: 5,
          btcPrice: 6,
        },
      },
    );
    const initial = result.current;

    rerender({
      totalBalanceBTC: 1,
      totalBalanceUSD: 2,
      segwitBalance: 3,
      taprootBalance: 4,
      runesBalance: 5,
      btcPrice: 6,
    });

    expect(result.current).toBe(initial);

    rerender({
      totalBalanceBTC: 1,
      totalBalanceUSD: 2,
      segwitBalance: 3,
      taprootBalance: 4,
      runesBalance: 6,
      btcPrice: 6,
    });

    expect(result.current).not.toBe(initial);
    expect(result.current.runes).toBe('6');
  });
});
