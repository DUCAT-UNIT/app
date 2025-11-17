/**
 * useBalanceData Hook
 * Manages wallet balance state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService } from '../services/balanceService';
import logger from '../utils/logger';

export function useBalanceData(wallet, getUnconfirmedBalance) {
  // Balance state
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState(null);

  // Unconfirmed balance from pending transactions
  const [unconfirmedSegwitBalance, setUnconfirmedSegwitBalance] = useState(0);
  const [unconfirmedTaprootBalance, setUnconfirmedTaprootBalance] = useState(0);
  const [unconfirmedRunesBalance, setUnconfirmedRunesBalance] = useState(0);

  // UTXOs state
  const [utxos, setUtxos] = useState([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // Keep refs to previous balance values for comparison
  const prevBalancesRef = useRef({ segwit: 0, taproot: 0, runes: [] });

  // Fetch wallet balance
  const fetchBalance = useCallback(
    async (segwitAddr, taprootAddr) => {
      // If addresses are provided, use them; otherwise use wallet state
      const segwitAddress = segwitAddr || wallet?.segwitAddress;
      const taprootAddress = taprootAddr || wallet?.taprootAddress;

      logger.debug('[useBalanceData] fetchBalance called', {
        segwitAddr,
        taprootAddr,
        walletSegwit: wallet?.segwitAddress,
        walletTaproot: wallet?.taprootAddress,
        finalSegwit: segwitAddress,
        finalTaproot: taprootAddress,
      });

      if (!segwitAddress || !taprootAddress) {
        logger.debug('[useBalanceData] Missing addresses, returning early');
        return;
      }

      try {
        logger.debug('[useBalanceData] Fetching balances...');
        setLoadingBalance(true);
        setBalanceError(null);
        const balances = await fetchWalletBalances(segwitAddress, taprootAddress);
        logger.debug('[useBalanceData] Balances fetched', balances);

        // Only update state if balances have actually changed
        const prevBalances = prevBalancesRef.current;
        const balancesChanged =
          balances.segwitBalance !== prevBalances.segwit ||
          balances.taprootBalance !== prevBalances.taproot ||
          JSON.stringify(balances.runesBalance) !== JSON.stringify(prevBalances.runes);

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
        const unconfirmedSegwit = getUnconfirmedBalance('segwit');
        const unconfirmedTaproot = getUnconfirmedBalance('taproot');
        setUnconfirmedSegwitBalance(unconfirmedSegwit.btc);
        setUnconfirmedTaprootBalance(unconfirmedTaproot.btc);
        setUnconfirmedRunesBalance(unconfirmedTaproot.runes);
      } catch (error) {
        setBalanceError('Failed to fetch balance. Tap to retry.');
      } finally {
        setLoadingBalance(false);
      }
    },
    [wallet, getUnconfirmedBalance]
  );

  // Refresh balances (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  }, [fetchBalance]);

  // Fetch UTXOs for transaction creation
  const fetchUtxos = useCallback(async (address) => {
    try {
      setLoadingUtxos(true);
      const formattedUtxos = await fetchUtxosService(address);
      setUtxos(formattedUtxos);
      return formattedUtxos;
    } catch (error) {
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
