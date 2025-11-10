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

  // Check for pending airdrop modal on mount and when balance updates
  useEffect(() => {
    const checkPendingAirdrop = async () => {
      if (!currentAccount) return;

      const pendingKey = `pendingAirdrop_${currentAccount}`;
      const pendingTxId = await SecureStore.getItemAsync(pendingKey);

      // If there's a pending airdrop and balance is now > 0, show the modal
      if (pendingTxId && (segwitBalance > 0 || taprootBalance > 0)) {
        setAirdropTxId(pendingTxId);
        setShowAirdropModal(true);
        // Clear the pending airdrop
        await SecureStore.deleteItemAsync(pendingKey);
      }
    };

    checkPendingAirdrop();
  }, [currentAccount, segwitBalance, taprootBalance]);

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

  // Auto-request airdrop when BTC balance is 0 (check once per day)
  useEffect(() => {
    if (!wallet?.segwitAddress) return;

    const requestAirdropIfNeeded = async () => {
      // Skip if already in progress
      if (airdropInProgress.current) {
        return;
      }

      // Get current balance from state
      const totalBtcBalance = segwitBalance + taprootBalance;

      // If balance is 0, request airdrop
      if (totalBtcBalance === 0) {
        try {
          // Check when we last requested an airdrop for this specific account
          const airdropKey = `lastAirdropTime_${currentAccount}`;
          const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours

          // Only allow airdrop once every 24 hours per account
          if (lastAirdropTime && now - parseInt(lastAirdropTime) < twentyFourHours) {
            return;
          }

          airdropInProgress.current = true;

          // Store attempt time immediately to prevent duplicate requests (per account)
          await SecureStore.setItemAsync(airdropKey, now.toString());

          // Request airdrop
          const result = await AirdropService.requestAirdrop(wallet.segwitAddress);

          // Store pending airdrop in SecureStore (survives state resets during onboarding)
          const pendingKey = `pendingAirdrop_${currentAccount}`;
          await SecureStore.setItemAsync(pendingKey, result.txId);

          // Fetch balance again after a few seconds to see the new balance
          setTimeout(() => {
            fetchBalance();
          }, 5000);

        } catch (error) {
          // Keep the lastAirdropTime to prevent immediate retries
        } finally {
          airdropInProgress.current = false;
        }
      }
    };

    // Wait a bit before initial check to ensure wallet is ready
    const initialTimeout = setTimeout(() => {
      requestAirdropIfNeeded();
    }, 3000);

    // Then check once per day
    const intervalId = setInterval(() => {
      requestAirdropIfNeeded();
    }, 24 * 60 * 60 * 1000); // 24 hours

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [wallet, currentAccount]); // Removed balance from dependencies

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
