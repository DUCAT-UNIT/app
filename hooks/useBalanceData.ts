/**
 * useBalanceData Hook
 * Manages wallet balance state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useMemo, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, RuneBalance, UTXO } from '../services/balanceService';
import type { WalletAddresses } from '../contexts/WalletContext';
import type { UnconfirmedBalance, UnconfirmedUTXO } from '../utils/pendingTransactionsUtils';
import { logger } from '../utils/logger';

export type { UnconfirmedBalance };

/**
 * Shallow equality check for RuneBalance arrays
 * Avoids JSON.stringify overhead on every comparison
 */
function areRunesBalancesEqual(a: RuneBalance[] | undefined, b: RuneBalance[]): boolean {
  // Handle undefined/empty cases
  if (!a && b.length === 0) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].runeid !== b[i].runeid || a[i].amount !== b[i].amount) return false;
  }
  return true;
}

export interface UseBalanceDataReturn {
  segwitBalance: number;
  taprootBalance: number;
  runesBalance: RuneBalance[];
  unconfirmedSegwitBalance: number;
  unconfirmedTaprootBalance: number;
  unconfirmedRunesBalance: number;
  loadingBalance: boolean;
  refreshing: boolean;
  balanceError: string | null;
  setBalanceError: Dispatch<SetStateAction<string | null>>;
  utxos: UTXO[];
  loadingUtxos: boolean;
  fetchBalance: (segwitAddr?: string, taprootAddr?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  fetchUtxos: (address: string) => Promise<UTXO[]>;
  resetBalances: () => void;
}

export function useBalanceData(
  wallet: WalletAddresses | null,
  getUnconfirmedBalance: (type: 'segwit' | 'taproot') => UnconfirmedBalance,
  getUnconfirmedUTXOs?: (type: 'segwit' | 'taproot') => UnconfirmedUTXO[]
): UseBalanceDataReturn {
  // Balance state
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState<RuneBalance[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Unconfirmed balance from pending transactions
  const [unconfirmedSegwitBalance, setUnconfirmedSegwitBalance] = useState(0);
  const [unconfirmedTaprootBalance, setUnconfirmedTaprootBalance] = useState(0);
  const [unconfirmedRunesBalance, setUnconfirmedRunesBalance] = useState(0);

  // UTXOs state
  const [utxos, setUtxos] = useState<UTXO[]>([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // Keep refs to previous balance values for comparison
  const prevBalancesRef = useRef<{ segwit: number; taproot: number; runes: RuneBalance[] }>({ segwit: 0, taproot: 0, runes: [] });
  const prevWalletAddressRef = useRef<string | null>(null);

  // Reset prevBalancesRef when wallet address changes
  useEffect(() => {
    const currentAddress = wallet?.segwitAddress;
    if (currentAddress !== prevWalletAddressRef.current) {
      prevBalancesRef.current = { segwit: 0, taproot: 0, runes: [] };
      prevWalletAddressRef.current = currentAddress ?? null;
    }
  }, [wallet?.segwitAddress]);

  // Fetch wallet balance
  const fetchBalance = useCallback(
    async (segwitAddr?: string, taprootAddr?: string) => {
      // If addresses are provided, use them; otherwise use wallet state
      const segwitAddress = segwitAddr || wallet?.segwitAddress;
      const taprootAddress = taprootAddr || wallet?.taprootAddress;

      if (!segwitAddress || !taprootAddress) {
        return;
      }

      try {
        // Only show loading on first fetch — avoids flicker on 10s poll cycles
        if (!prevBalancesRef.current.segwit && !prevBalancesRef.current.taproot) {
          setLoadingBalance(true);
        }
        const balances = await fetchWalletBalances(segwitAddress, taprootAddress);

        // Only update state if balances have actually changed
        const prevBalances = prevBalancesRef.current;
        const runesChanged = !areRunesBalancesEqual(balances.runesBalance, prevBalances.runes);
        const balancesChanged =
          balances.segwitBalance !== prevBalances.segwit ||
          balances.taprootBalance !== prevBalances.taproot ||
          runesChanged;

        logger.info('[useBalanceData] fetchBalance result:', { segwit: balances.segwitBalance, taproot: balances.taprootBalance, changed: balancesChanged });
        if (balancesChanged) {
          prevBalancesRef.current = {
            segwit: balances.segwitBalance,
            taproot: balances.taprootBalance,
            runes: balances.runesBalance
          };
          setSegwitBalance(balances.segwitBalance);
          setTaprootBalance(balances.taprootBalance);
          setRunesBalance(balances.runesBalance);
        }

        // Also fetch unconfirmed balances from pending transactions
        // But we need to filter out UTXOs that have already confirmed to avoid double-counting
        if (getUnconfirmedUTXOs) {
          // Fetch confirmed UTXOs for both addresses to check for overlap
          const [confirmedSegwitUtxos, confirmedTaprootUtxos] = await Promise.all([
            fetchUtxosService(segwitAddress),
            fetchUtxosService(taprootAddress),
          ]);
          const confirmedSegwitKeys = new Set(confirmedSegwitUtxos.map(u => `${u.txid}:${u.vout}`));
          const confirmedTaprootKeys = new Set(confirmedTaprootUtxos.map(u => `${u.txid}:${u.vout}`));

          // Get unconfirmed UTXOs and filter out any that are already confirmed
          const unconfirmedSegwitUtxos = getUnconfirmedUTXOs('segwit');
          const unconfirmedTaprootUtxos = getUnconfirmedUTXOs('taproot');

          const filteredSegwitUtxos = unconfirmedSegwitUtxos.filter(u => {
            const key = `${u.txid}:${u.vout}`;
            const isConfirmed = confirmedSegwitKeys.has(key);
            if (isConfirmed) {
              logger.info('[useBalanceData] Filtering out already-confirmed segwit UTXO:', { key, value: u.value });
            }
            return !isConfirmed;
          });

          const filteredTaprootUtxos = unconfirmedTaprootUtxos.filter(u => {
            const key = `${u.txid}:${u.vout}`;
            const isConfirmed = confirmedTaprootKeys.has(key);
            if (isConfirmed) {
              logger.info('[useBalanceData] Filtering out already-confirmed taproot UTXO:', { key, value: u.value, runeAmount: u.runeAmount });
            }
            return !isConfirmed;
          });

          // Calculate filtered unconfirmed balance
          const filteredSegwitBtc = filteredSegwitUtxos.reduce((sum, u) => sum + (u.value || 0), 0) / 100000000;
          const filteredTaprootBtc = filteredTaprootUtxos.reduce((sum, u) => sum + (u.value || 0), 0) / 100000000;
          const filteredRunesBalance = filteredTaprootUtxos.reduce((sum, u) => sum + (u.runeAmount || 0), 0) / 100;

          logger.info('[useBalanceData] Unconfirmed balance after filtering:', {
            segwitBefore: getUnconfirmedBalance('segwit').btc,
            segwitAfter: filteredSegwitBtc,
            segwitFiltered: unconfirmedSegwitUtxos.length - filteredSegwitUtxos.length,
            taprootBefore: getUnconfirmedBalance('taproot').btc,
            taprootAfter: filteredTaprootBtc,
            taprootFiltered: unconfirmedTaprootUtxos.length - filteredTaprootUtxos.length,
          });

          setUnconfirmedSegwitBalance(filteredSegwitBtc);
          setUnconfirmedTaprootBalance(filteredTaprootBtc);
          setUnconfirmedRunesBalance(filteredRunesBalance);
        } else {
          // Fallback to old behavior if getUnconfirmedUTXOs not provided
          const unconfirmedSegwit = getUnconfirmedBalance('segwit');
          const unconfirmedTaproot = getUnconfirmedBalance('taproot');
          setUnconfirmedSegwitBalance(unconfirmedSegwit.btc);
          setUnconfirmedTaprootBalance(unconfirmedTaproot.btc);
          setUnconfirmedRunesBalance(unconfirmedTaproot.runes);
        }
      } catch (error: unknown) {
        setBalanceError('Failed to fetch balance. Tap to retry.');
      } finally {
        if (loadingBalance) {
          setLoadingBalance(false);
        }
      }
    },
    [wallet, getUnconfirmedBalance, getUnconfirmedUTXOs]
  );

  // Refresh balances (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  }, [fetchBalance]);

  // Fetch UTXOs for transaction creation
  const fetchUtxos = useCallback(async (address: string): Promise<UTXO[]> => {
    try {
      setLoadingUtxos(true);
      const formattedUtxos = await fetchUtxosService(address);
      setUtxos(formattedUtxos);
      return formattedUtxos;
    } catch (error: unknown) {
      throw error;
    } finally {
      setLoadingUtxos(false);
    }
  }, []);

  // Reset balances (called when wallet is reset)
  const resetBalances = useCallback(() => {
    setSegwitBalance(0);
    setTaprootBalance(0);
    setRunesBalance([]);
    setUtxos([]);
    prevBalancesRef.current = { segwit: 0, taproot: 0, runes: [] };
  }, []);

  return useMemo(
    () => ({
      // State
      segwitBalance,
      taprootBalance,
      runesBalance,
      unconfirmedSegwitBalance,
      unconfirmedTaprootBalance,
      unconfirmedRunesBalance,
      loadingBalance,
      refreshing,
      balanceError,
      setBalanceError,
      utxos,
      loadingUtxos,
      // Functions
      fetchBalance,
      onRefresh,
      fetchUtxos,
      resetBalances,
    }),
    [
      segwitBalance,
      taprootBalance,
      runesBalance,
      unconfirmedSegwitBalance,
      unconfirmedTaprootBalance,
      unconfirmedRunesBalance,
      loadingBalance,
      refreshing,
      balanceError,
      utxos,
      loadingUtxos,
      fetchBalance,
      onRefresh,
      fetchUtxos,
      resetBalances,
    ]
  );
}
