import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';
import { useWallet } from './WalletContext';
import { useAuth } from './AuthContext';
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

export const BalanceProvider = ({ children, seedConfirmed }) => {
  const { wallet, currentAccount } = useWallet();
  const { isAuthenticated } = useAuth();

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
      if (!wallet?.segwitAddress) return;

      const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
      const pendingTxId = await SecureStore.getItemAsync(pendingKey);

      console.log('[AIRDROP CHECK] Account:', currentAccount, 'Balance:', segwitBalance + taprootBalance, 'Pending TxId:', pendingTxId);

      // If there's a pending airdrop and balance is now > 0, show the modal
      if (pendingTxId && (segwitBalance > 0 || taprootBalance > 0)) {
        console.log('[AIRDROP SHOW] Showing modal for TxId:', pendingTxId);
        setAirdropTxId(pendingTxId);
        setShowAirdropModal(true);
        // Clear the pending airdrop
        await SecureStore.deleteItemAsync(pendingKey);
      }
    };

    checkPendingAirdrop();
  }, [wallet, currentAccount, segwitBalance, taprootBalance]);

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
    if (!wallet?.segwitAddress) {
      console.log('[AIRDROP SETUP] No wallet address, skipping');
      return;
    }

    if (!isAuthenticated) {
      console.log('[AIRDROP SETUP] Not authenticated yet, skipping');
      return;
    }

    if (!seedConfirmed) {
      console.log('[AIRDROP SETUP] Seed not confirmed yet (still in onboarding), skipping');
      return;
    }

    console.log('[AIRDROP SETUP] Setting up airdrop check for account', currentAccount);

    const requestAirdropIfNeeded = async () => {
      console.log('[AIRDROP TRIGGER] requestAirdropIfNeeded called');

      // Skip if already in progress
      if (airdropInProgress.current) {
        console.log('[AIRDROP TRIGGER] Already in progress, skipping');
        return;
      }

      // Get current balance from state
      const totalBtcBalance = segwitBalance + taprootBalance;
      console.log('[AIRDROP TRIGGER] Total balance:', totalBtcBalance);

      // If balance is 0, request airdrop
      if (totalBtcBalance === 0) {
        console.log('[AIRDROP TRIGGER] Balance is 0, checking cooldown...');
        try {
          // Check when we last requested an airdrop for this specific wallet+account combo
          const airdropKey = `lastAirdropTime_${wallet.segwitAddress}_${currentAccount}`;
          const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours

          console.log('[AIRDROP TRIGGER] Last airdrop time:', lastAirdropTime);

          // Only allow airdrop once every 24 hours per account
          if (lastAirdropTime && now - parseInt(lastAirdropTime) < twentyFourHours) {
            const hoursAgo = Math.floor((now - parseInt(lastAirdropTime)) / 3600000);
            console.log('[AIRDROP TRIGGER] On cooldown, last request was', hoursAgo, 'hours ago');
            return;
          }

          console.log('[AIRDROP TRIGGER] Cooldown passed, requesting airdrop...');
          airdropInProgress.current = true;

          // Store attempt time immediately to prevent duplicate requests (per account)
          await SecureStore.setItemAsync(airdropKey, now.toString());

          // Request airdrop
          const result = await AirdropService.requestAirdrop(wallet.segwitAddress);
          console.log('[AIRDROP REQUEST] Success for account', currentAccount, 'TxId:', result.txId);

          // Store pending airdrop in SecureStore (survives state resets during onboarding)
          const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
          await SecureStore.setItemAsync(pendingKey, result.txId);
          console.log('[AIRDROP STORE] Stored pending airdrop in SecureStore with key:', pendingKey);

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

    // Wait for biometric prompt to complete (if shown) before checking airdrop
    const initialTimeout = setTimeout(() => {
      console.log('[AIRDROP SETUP] Running initial airdrop check (after 5 second delay)');
      requestAirdropIfNeeded();
    }, 5000);

    // Then check once per day
    const intervalId = setInterval(() => {
      console.log('[AIRDROP SETUP] Running daily airdrop check');
      requestAirdropIfNeeded();
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log('[AIRDROP SETUP] Timers set up - initial check in 5 seconds (after auth), then every 24 hours');

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [wallet, currentAccount, isAuthenticated, seedConfirmed]);

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
