/**
 * useFormattedBalances
 * Memoizes expensive number formatting operations
 * Uses centralized formatters from utils/formatters
 */

import { useMemo } from 'react';
import { formatBalance, formatFiat } from '../utils/formatters';

interface UseFormattedBalancesParams {
  totalBalanceBTC?: number;
  totalBalanceUSD?: number;
  segwitBalance?: number;
  taprootBalance?: number;
  runesBalance?: number;
  btcPrice?: number | null;
}

interface FormattedBalances {
  totalBTC: string;
  totalUSD: string;
  segwitBTC: string;
  segwitUSD: string;
  taprootBTC: string;
  taprootUSD: string;
  runes: string;
}

export const useFormattedBalances = ({
  totalBalanceBTC = 0,
  totalBalanceUSD = 0,
  segwitBalance = 0,
  taprootBalance = 0,
  runesBalance = 0,
  btcPrice: btcPriceParam = 0,
}: UseFormattedBalancesParams): FormattedBalances => {
  // Ensure btcPrice is never null (default params don't handle null, only undefined)
  const btcPrice = btcPriceParam ?? 0;

  return useMemo(() => {
    const price = btcPrice ?? 0;

    return {
      // Total balance formatted
      totalBTC: formatBalance(totalBalanceBTC),
      totalUSD: formatFiat(totalBalanceUSD),

      // Segwit balance formatted
      segwitBTC: formatBalance(segwitBalance),
      segwitUSD: formatFiat(segwitBalance * price),

      // Taproot balance formatted
      taprootBTC: formatBalance(taprootBalance),
      taprootUSD: formatFiat(taprootBalance * price),

      // Runes balance formatted (as integer with commas)
      runes: formatFiat(runesBalance, 0),
    };
  }, [totalBalanceBTC, totalBalanceUSD, segwitBalance, taprootBalance, runesBalance, btcPrice]);
};
