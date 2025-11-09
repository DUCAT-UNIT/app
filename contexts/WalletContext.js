import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';
import * as WalletService from '../services/walletService';
import { fetchVaultData } from '../services/vaultService';
import { SECURE_KEYS } from '../utils/constants';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  // Wallet state
  const [wallet, setWallet] = useState(null); // { segwitAddress, taprootAddress, taprootPubkey }
  const [currentAccount, setCurrentAccount] = useState(0);

  // Balance state
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Vault state
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

  // BTC price state
  const [btcPrice, setBtcPrice] = useState(null);
  const [loadingBtcPrice, setLoadingBtcPrice] = useState(false);

  // UTXOs state
  const [utxos, setUtxos] = useState([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // Display preferences
  const [showTotalInBTC, setShowTotalInBTC] = useState(false);
  const [showBTCInBTC, setShowBTCInBTC] = useState(false);
  const [showUnitInUnit, setShowUnitInUnit] = useState(false);

  // Fetch BTC price
  const fetchBtcPrice = useCallback(async () => {
    try {
      setLoadingBtcPrice(true);
      const price = await fetchBtcPriceService();
      setBtcPrice(price);
    } catch (error) {
      console.error('Failed to fetch BTC price:', error);
      setBtcPrice(null);
    } finally {
      setLoadingBtcPrice(false);
    }
  }, []);

  // Fetch vault data
  const fetchVault = useCallback(async () => {
    try {
      if (!wallet?.taprootPubkey) {
        console.log('No vault pubkey available');
        return;
      }
      setLoadingVault(true);
      const data = await fetchVaultData(wallet.taprootPubkey);
      setVaultData(data);
    } catch (error) {
      console.error('Failed to fetch vault data:', error);
      setVaultData(null);
    } finally {
      setLoadingVault(false);
    }
  }, [wallet?.taprootPubkey]);

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
      console.error('Balance fetch error:', error);
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
      console.error('Failed to fetch UTXOs:', error);
      throw error;
    } finally {
      setLoadingUtxos(false);
    }
  }, []);

  // Load wallet from secure storage
  const loadWallet = useCallback(async () => {
    try {
      const { mnemonic, accountIndex } = await WalletService.loadWalletFromStorage();

      if (mnemonic) {
        const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);
        setWallet({
          segwitAddress: addresses.segwitAddress,
          taprootAddress: addresses.taprootAddress,
          taprootPubkey: addresses.taprootPubkey,
        });
        setCurrentAccount(accountIndex);

        // Fetch balances in background
        fetchBalance(addresses.segwitAddress, addresses.taprootAddress);

        return { exists: true, addresses };
      }

      return { exists: false };
    } catch (error) {
      console.error('Failed to load wallet:', error);
      return { exists: false };
    }
  }, [fetchBalance]);

  // Set wallet addresses (for creating/importing wallet)
  const setWalletAddresses = useCallback((addresses, accountIndex = 0) => {
    setWallet({
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
      taprootPubkey: addresses.taprootPubkey,
    });
    setCurrentAccount(accountIndex);

    // Fetch balances for new wallet
    fetchBalance(addresses.segwitAddress, addresses.taprootAddress);
  }, [fetchBalance]);

  // Reset wallet (for logout/delete)
  const resetWallet = useCallback(() => {
    setWallet(null);
    setCurrentAccount(0);
    setSegwitBalance(0);
    setTaprootBalance(0);
    setRunesBalance([]);
    setUtxos([]);
  }, []);

  // Switch account
  const switchAccount = useCallback(async (accountIndex) => {
    try {
      const { mnemonic } = await WalletService.loadWalletFromStorage();
      if (!mnemonic) {
        throw new Error('No wallet found');
      }

      const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
        taprootPubkey: addresses.taprootPubkey,
      });
      setCurrentAccount(accountIndex);

      // Save new account index
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());

      // Fetch balances and vault data for new account
      await fetchBalance(addresses.segwitAddress, addresses.taprootAddress);
      // fetchVault will be called automatically when wallet.taprootPubkey is set

      return addresses;
    } catch (error) {
      console.error('Failed to switch account:', error);
      throw error;
    }
  }, [fetchBalance, fetchVault]);

  // Fetch BTC price on mount and refresh every 60 seconds
  useEffect(() => {
    fetchBtcPrice();
    fetchVault();
    const interval = setInterval(() => {
      fetchBtcPrice();
      fetchVault();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice, fetchVault]);

  // Auto-refresh balance every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) return;

    // Fetch balance immediately
    fetchBalance();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchBalance();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchBalance]);

  const value = {
    // Wallet state
    wallet,
    currentAccount,

    // Balance state
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBalance,
    refreshing,

    // Vault state
    vaultData,
    loadingVault,

    // BTC price state
    btcPrice,
    loadingBtcPrice,

    // UTXOs state
    utxos,
    loadingUtxos,

    // Display preferences
    showTotalInBTC,
    setShowTotalInBTC,
    showBTCInBTC,
    setShowBTCInBTC,
    showUnitInUnit,
    setShowUnitInUnit,

    // Functions
    fetchBalance,
    onRefresh,
    fetchUtxos,
    fetchBtcPrice,
    fetchVault,
    loadWallet,
    setWalletAddresses,
    switchAccount,
    resetWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
