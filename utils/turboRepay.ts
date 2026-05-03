const TURBOUNIT_SMALLEST_UNITS_PER_UNIT = 100;

// Ducat onchain/unit melts burn UNIT only for the withdrawn amount. The mint
// backend absorbs the BTC miner fee needed to broadcast the Runes transaction.
export const TURBOUNIT_ONCHAIN_MELT_FEE_SMALLEST_UNITS = 0;

export function getRepayableTurboUnitContribution(
  cashuBalanceSmallestUnits: number | null | undefined,
  meltFeeSmallestUnits = TURBOUNIT_ONCHAIN_MELT_FEE_SMALLEST_UNITS,
): number {
  const balance = Math.floor(cashuBalanceSmallestUnits ?? 0);
  const fee = Math.max(0, Math.floor(meltFeeSmallestUnits));

  if (!Number.isFinite(balance) || balance <= fee) {
    return 0;
  }

  return Math.round(((balance - fee) / TURBOUNIT_SMALLEST_UNITS_PER_UNIT) * 100) / 100;
}
