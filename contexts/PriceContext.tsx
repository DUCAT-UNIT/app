/**
 * PriceContext - MIGRATED TO ZUSTAND
 *
 * This file now provides backward compatibility by wrapping the Zustand store.
 * New code should import directly from stores/priceStore.ts
 *
 * MIGRATION STATUS: Complete
 * - Provider starts auto-refresh on mount (maintains same behavior)
 * - Hook returns Zustand store values with compatible interface
 */

import React, { useEffect, ReactNode, useMemo } from 'react';
import { usePriceStore } from '../stores/priceStore';

interface PriceContextValue {
  btcPrice: number | null;
  loadingBtcPrice: boolean;
  fetchBtcPrice: () => Promise<void>;
}

/**
 * Hook that provides backward-compatible interface to Zustand store
 */
export const usePrice = (): PriceContextValue => {
  const store = usePriceStore();

  return useMemo(() => ({
    btcPrice: store.btcPrice,
    loadingBtcPrice: store.loadingBtcPrice,
    fetchBtcPrice: store.fetchBtcPrice,
  }), [store.btcPrice, store.loadingBtcPrice, store.fetchBtcPrice]);
};

interface PriceProviderProps {
  children: ReactNode;
}

/**
 * Provider now just starts the auto-refresh on mount
 * The actual state lives in Zustand store
 */
export const PriceProvider: React.FC<PriceProviderProps> = ({ children }) => {
  const startAutoRefresh = usePriceStore((state) => state.startAutoRefresh);

  // Start auto-refresh on mount, cleanup on unmount
  useEffect(() => {
    const cleanup = startAutoRefresh();
    return cleanup;
  }, [startAutoRefresh]);

  return <>{children}</>;
};
