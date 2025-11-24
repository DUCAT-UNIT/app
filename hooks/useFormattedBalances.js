/**
 * useFormattedBalances
 * Memoizes expensive number formatting operations
 * Prevents repeated toLocaleString() calls on every render
 */

import { useMemo } from 'react';

export const useFormattedBalances = ({
  totalBalanceBTC = 0,
  totalBalanceUSD = 0,
  segwitBalance = 0,
  taprootBalance = 0,
  runesBalance = 0,
  btcPrice = 0,
}) => {
  return useMemo(() => {
    // Format BTC amounts with 8 decimal places
    const formatBTC = (value) =>
      value.toLocaleString('en-US', {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
      });

    // Format USD amounts with 2 decimal places
    const formatUSD = (value) =>
      value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    // Format UNIT amounts (runes) as integers
    const formatUnit = (value) =>
      value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

    return {
      // Total balance formatted
      totalBTC: formatBTC(totalBalanceBTC),
      totalUSD: formatUSD(totalBalanceUSD),

      // Segwit balance formatted
      segwitBTC: formatBTC(segwitBalance),
      segwitUSD: formatUSD(segwitBalance * btcPrice),

      // Taproot balance formatted
      taprootBTC: formatBTC(taprootBalance),
      taprootUSD: formatUSD(taprootBalance * btcPrice),

      // Runes balance formatted
      runes: formatUnit(runesBalance),
    };
  }, [totalBalanceBTC, totalBalanceUSD, segwitBalance, taprootBalance, runesBalance, btcPrice]);
};
