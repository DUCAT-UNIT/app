import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';

const PriceContext = createContext();

export const usePrice = () => {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error('usePrice must be used within a PriceProvider');
  }
  return context;
};

export const PriceProvider = ({ children }) => {
  // BTC price state
  const [btcPrice, setBtcPrice] = useState(null);
  const [loadingBtcPrice, setLoadingBtcPrice] = useState(false);

  /**
   * Fetch BTC price from CoinGecko API
   */
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

  // Fetch BTC price on mount and refresh every 60 seconds
  useEffect(() => {
    fetchBtcPrice();
    const interval = setInterval(() => {
      fetchBtcPrice();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice]);

  const value = useMemo(() => ({
    // State
    btcPrice,
    loadingBtcPrice,

    // Functions
    fetchBtcPrice,
  }), [btcPrice, loadingBtcPrice, fetchBtcPrice]);

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};
