/**
 * useSendBalances Hook
 * Calculates balance-related values for send flow
 */

import { useMemo, useRef } from 'react';
import { useBalance } from '../../../contexts/WalletDataContext';
import { useCashuBalanceState } from '../../../contexts/CashuContext';
import { getRunesAmount } from '../../../utils/runesHelper';

export interface UseSendBalancesOptions {
  /** Estimated fee in satoshis */
  estimatedFeeSats: number;
}

export interface UseSendBalancesResult {
  /** Total BTC balance (confirmed + unconfirmed) in BTC */
  btcBalance: number;
  /** Total UNIT balance (runes + cashu) */
  unitBalance: number;
  /** Max sendable BTC (balance - fees) */
  maxSendableBtc: number;
  /** Max sendable UNIT */
  maxSendableUnit: number;
  /** BTC balance in satoshis */
  btcBalanceSats: number;
  /** Whether there's sufficient BTC for UNIT transaction fees */
  hasSufficientBtcForUnitFees: boolean;
}

export function useSendBalances({
  estimatedFeeSats,
}: UseSendBalancesOptions): UseSendBalancesResult {
  const { segwitBalance, runesBalance, unconfirmedSegwitBalance } = useBalance();
  const { balance: cashuBalance } = useCashuBalanceState();

  // Balance calculations (include unconfirmed for transaction chaining)
  const btcBalance = (segwitBalance || 0) + (unconfirmedSegwitBalance || 0);

  // For UNIT, combine on-chain runes balance + ecash balance
  // Runes come in display units, ecash is in smallest units (needs /100)
  const rawRunes = useMemo(() => getRunesAmount(runesBalance), [runesBalance]);
  // E2E bypass: Ord indexer on Mutinynet is intermittent — cache last known
  // non-zero Runes balance so the send screen stays usable between polls.
  const lastKnownRunes = useRef(0);
  if (rawRunes > 0) lastKnownRunes.current = rawRunes;
  const unitRunesBalance = (__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true')
    ? (rawRunes > 0 ? rawRunes : lastKnownRunes.current)
    : rawRunes;
  const unitBalance = unitRunesBalance + ((cashuBalance || 0) / 100);

  // For BTC: max sendable = balance - fee
  const maxSendableBtc = useMemo(() => {
    const feeBtc = estimatedFeeSats / 100_000_000;
    return Math.max(0, btcBalance - feeBtc);
  }, [btcBalance, estimatedFeeSats]);

  // For UNIT: max sendable = unit balance (but need BTC for fees)
  const maxSendableUnit = unitBalance;

  const btcBalanceSats = Math.round(btcBalance * 100_000_000);
  const hasSufficientBtcForUnitFees = btcBalanceSats >= estimatedFeeSats;

  return {
    btcBalance,
    unitBalance,
    maxSendableBtc,
    maxSendableUnit,
    btcBalanceSats,
    hasSufficientBtcForUnitFees,
  };
}
