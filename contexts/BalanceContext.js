import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';
import { fetchVaultData } from '../services/vaultService';
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

  // Vault data state
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

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

  // Fetch vault data
  const fetchVault = useCallback(async () => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) return;

    try {
      setLoadingVault(true);
      const data = await fetchVaultData(vaultPubkey);
      setVaultData(data);
    } catch (error) {
      setVaultData(null);
    } finally {
      setLoadingVault(false);
    }
  }, [wallet]);

  // Refresh balances and vault data (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchVault()]);
    setRefreshing(false);
  }, [fetchBalance, fetchVault]);

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

  // Reset balances and vault data (called when wallet is reset)
  const resetBalances = useCallback(() => {
    setSegwitBalance(0);
    setTaprootBalance(0);
    setRunesBalance([]);
    setUtxos([]);
    setVaultData(null);
  }, []);

  // Track if airdrop is in progress using ref + lock mechanism
  // Using ref avoids infinite loops from state updates triggering effects
  const airdropInProgress = useRef(false);

  // Store balance values in refs so airdrop logic always reads fresh values
  const segwitBalanceRef = useRef(segwitBalance);
  const taprootBalanceRef = useRef(taprootBalance);

  // Update refs whenever balances change
  useEffect(() => {
    segwitBalanceRef.current = segwitBalance;
    taprootBalanceRef.current = taprootBalance;
  }, [segwitBalance, taprootBalance]);

  // Clean up expired airdrop locks on mount
  useEffect(() => {
    const cleanupExpiredLocks = async () => {
      if (!wallet?.segwitAddress) return;

      const lockKey = `airdropLock_${wallet.segwitAddress}_${currentAccount}`;
      try {
        const existingLock = await SecureStore.getItemAsync(lockKey);
        if (existingLock) {
          const lockTime = parseInt(existingLock);
          const now = Date.now();
          const lockTimeout = 60 * 1000; // 60 second timeout

          // If lock is expired (older than 60 seconds), clean it up
          if (now - lockTime >= lockTimeout) {
            await SecureStore.deleteItemAsync(lockKey);
          }
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    };

    cleanupExpiredLocks();
  }, [wallet?.segwitAddress, currentAccount]);

  // Check for pending airdrop modal on mount and when balance updates
  useEffect(() => {
    const checkPendingAirdrop = async () => {
      if (!wallet?.segwitAddress) return;

      const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
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
  }, [wallet, currentAccount, segwitBalance, taprootBalance]);

  // Fetch BTC price on mount and refresh every 60 seconds
  useEffect(() => {
    fetchBtcPrice();
    const interval = setInterval(() => {
      fetchBtcPrice();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice]);

  // Auto-refresh balance and vault data every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      // Reset balances when no wallet
      resetBalances();
      return;
    }

    // Fetch balance and vault data immediately
    fetchBalance();
    fetchVault();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchBalance();
      fetchVault();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchBalance, fetchVault, resetBalances]);

  // Auto-request airdrop when BTC balance is 0 (check once per day)
  useEffect(() => {
    if (!wallet?.segwitAddress) return;
    if (!isAuthenticated) return;
    if (!seedConfirmed) return;

    const requestAirdropIfNeeded = async () => {
      // Skip if already in progress
      if (airdropInProgress.current) return;

      const airdropKey = `lastAirdropTime_${wallet.segwitAddress}_${currentAccount}`;
      const lockKey = `airdropLock_${wallet.segwitAddress}_${currentAccount}`;

      try {
        // Check for existing lock (prevents race conditions across mounts)
        const existingLock = await SecureStore.getItemAsync(lockKey);
        if (existingLock) {
          const lockTime = parseInt(existingLock);
          const now = Date.now();
          const lockTimeout = 60 * 1000; // 60 second timeout for locks

          // If lock is less than 60 seconds old, skip
          if (now - lockTime < lockTimeout) {
            return;
          }
          // Lock expired, we can proceed and will create a new one
        }

        // Get current balance from refs (always fresh, not stale closure values)
        const totalBtcBalance = segwitBalanceRef.current + taprootBalanceRef.current;

        // If balance is 0, request airdrop
        if (totalBtcBalance === 0) {
          // Check when we last requested an airdrop for this specific wallet+account combo
          const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours

          // Only allow airdrop once every 24 hours per account
          if (lastAirdropTime && now - parseInt(lastAirdropTime) < twentyFourHours) {
            return;
          }

          // Acquire lock BEFORE setting ref
          await SecureStore.setItemAsync(lockKey, now.toString());
          airdropInProgress.current = true;

          try {
            // Store attempt time immediately to prevent duplicate requests (per account)
            await SecureStore.setItemAsync(airdropKey, now.toString());

            // Request airdrop
            const result = await AirdropService.requestAirdrop(wallet.segwitAddress);

            // Store pending airdrop in SecureStore (survives state resets during onboarding)
            const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
            await SecureStore.setItemAsync(pendingKey, result.txId);

            // Show modal immediately - don't wait for balance update
            setTimeout(() => {
              setAirdropTxId(result.txId);
              setShowAirdropModal(true);
              // Clean up pending state
              SecureStore.deleteItemAsync(pendingKey);
            }, 500);

          } catch (error) {
            // Keep the lastAirdropTime to prevent immediate retries
          } finally {
            // Release lock and clear ref
            airdropInProgress.current = false;
            await SecureStore.deleteItemAsync(lockKey);
          }
        }
      } catch (error) {
        // Ensure we clean up on any error
        airdropInProgress.current = false;
        await SecureStore.deleteItemAsync(lockKey).catch(() => {});
      }
    };

    // Wait for app to be fully ready before checking airdrop
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

    // Vault data state
    vaultData,
    loadingVault,

    // Airdrop modal state
    showAirdropModal,
    setShowAirdropModal,
    airdropTxId,

    // Functions
    fetchBalance,
    fetchVault,
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
