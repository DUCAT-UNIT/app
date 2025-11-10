import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';
import { useWallet } from './WalletContext';
import * as SecureStore from 'expo-secure-store';
import * as AirdropService from '../services/airdropService';

const BalanceContext = createContext();

export const useBalance = () => {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
};

export const BalanceProvider = ({ children }) => {
  const { wallet, currentAccount } = useWallet();

  // Balance state
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // BTC price state
  const [btcPrice, setBtcPrice] = useState(null);
  const [loadingBtcPrice, setLoadingBtcPrice] = useState(false);

  // UTXOs state
  const [utxos, setUtxos] = useState([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // Airdrop modal state
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropTxId, setAirdropTxId] = useState('');

  // Fetch BTC price
  const fetchBtcPrice = useCallback(async () => {
    try {
      setLoadingBtcPrice(true);
      const price = await fetchBtcPriceService();
      setBtcPrice(price);
    } catch (error) {
      setBtcPrice(null);
    } finally {
      setLoadingBtcPrice(false);
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (segwitAddr, taprootAddr) => {
    // If addresses are provided, use them; otherwise use wallet state
    const segwitAddress = segwitAddr || wallet?.segwitAddress;
    const taprootAddress = taprootAddr || wallet?.taprootAddress;

    if (!segwitAddress || !taprootAddress) return;

    try {
      setLoadingBalance(true);
      const balances = await fetchWalletBalances(segwitAddress, taprootAddress);
      setSegwitBalance(balances.segwitBalance);
      setTaprootBalance(balances.taprootBalance);
      setRunesBalance(balances.runesBalance);
    } catch (error) {
      setSegwitBalance(0);
      setTaprootBalance(0);
      setRunesBalance([]);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet]);

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

  // Track if airdrop is in progress to prevent duplicate requests
  const airdropInProgress = useRef(false);

  // Fetch BTC price on mount and refresh every 60 seconds
  useEffect(() => {
    fetchBtcPrice();
    const interval = setInterval(() => {
      fetchBtcPrice();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice]);

  // Auto-refresh balance every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      // Reset balances when no wallet
      resetBalances();
      return;
    }

    // Fetch balance immediately
    fetchBalance();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchBalance();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchBalance, resetBalances]);

  // Auto-request airdrop when BTC balance is 0
  useEffect(() => {
    const requestAirdropIfNeeded = async () => {
      // Only check if wallet exists and balances are loaded
      if (!wallet?.segwitAddress || loadingBalance || airdropInProgress.current) {
        console.log('Airdrop check skipped:', {
          hasWallet: !!wallet?.segwitAddress,
          loadingBalance,
          airdropInProgress: airdropInProgress.current
        });
        return;
      }

      const totalBtcBalance = segwitBalance + taprootBalance;
      console.log('Checking airdrop - Balance:', totalBtcBalance);

      // If balance is 0, request airdrop (with rate limiting to respect faucet limits)
      if (totalBtcBalance === 0) {
        console.log('Balance is 0, checking cooldown...');
        try {
          // Check when we last requested an airdrop for this specific account
          const airdropKey = `lastAirdropTime_${currentAccount}`;
          const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
          const now = Date.now();
          const fifteenMinutes = 15 * 60 * 1000; // 15 minutes

          // Only allow airdrop once every 15 minutes per account
          if (lastAirdropTime && now - parseInt(lastAirdropTime) < fifteenMinutes) {
            console.log('Airdrop on cooldown. Last request:', Math.floor((now - parseInt(lastAirdropTime)) / 60000), 'min ago');
            return;
          }

          console.log('Requesting airdrop for account', currentAccount);
          airdropInProgress.current = true;

          // Store attempt time immediately to prevent duplicate requests (per account)
          await SecureStore.setItemAsync(airdropKey, now.toString());

          // Request airdrop
          const result = await AirdropService.requestAirdrop(wallet.segwitAddress);
          console.log('Airdrop successful! TxId:', result.txId);

          // Show celebration modal
          setAirdropTxId(result.txId);
          setShowAirdropModal(true);
          console.log('Showing airdrop modal');

          // Fetch balance again after a few seconds to see the new balance
          setTimeout(() => {
            fetchBalance();
          }, 3000);

        } catch (error) {
          console.error('Airdrop failed:', error.message || error);
          // Keep the lastAirdropTime to prevent immediate retries
        } finally {
          airdropInProgress.current = false;
        }
      }
    };

    requestAirdropIfNeeded();
  }, [segwitBalance, taprootBalance, wallet, loadingBalance, fetchBalance, currentAccount]);

  const value = {
    // Balance state
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBalance,
    refreshing,

    // BTC price state
    btcPrice,
    loadingBtcPrice,

    // UTXOs state
    utxos,
    loadingUtxos,

    // Airdrop modal state
    showAirdropModal,
    setShowAirdropModal,
    airdropTxId,

    // Functions
    fetchBalance,
    onRefresh,
    fetchUtxos,
    fetchBtcPrice,
    resetBalances,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
};
