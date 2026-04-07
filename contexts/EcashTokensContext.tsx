/**
 * EcashTokensContext - Manages ecash token state and subscriptions
 * Extracted from WalletDataContext for single-responsibility
 */

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getReceivedTokens, getSentLockedTokens, subscribeToTokenChanges } from '../services/cashu/cashuLockedTokensService';
import { loadTokensWithStatus, TokenWithStatus } from '../services/cashu/tokenStatusService';
import { logger } from '../utils/logger';
import { useWallet } from './WalletContext';

export interface EcashTokensValue {
  ecashTokens: TokenWithStatus[];
  loadingEcashTokens: boolean;
  fetchEcashTokens: () => Promise<void>;
  resetEcashTokens: () => void;
}

const EcashTokensCtx = createContext<EcashTokensValue | undefined>(undefined);

export const useEcashTokens = (): EcashTokensValue => {
  const context = useContext(EcashTokensCtx);
  if (!context) {
    throw new Error('useEcashTokens must be used within an EcashTokensProvider');
  }
  return context;
};

interface EcashTokensProviderProps {
  children: ReactNode;
}

export const EcashTokensProvider: React.FC<EcashTokensProviderProps> = ({ children }) => {
  const { wallet } = useWallet();

  const [ecashTokens, setEcashTokens] = useState<TokenWithStatus[]>([]);
  const [loadingEcashTokens, setLoadingEcashTokens] = useState(false);
  const ecashFetchingRef = useRef(false);

  const fetchEcashTokens = useCallback(async () => {
    if (!wallet?.taprootAddress || ecashFetchingRef.current) return;

    ecashFetchingRef.current = true;
    // Only show loading on initial fetch, not background refreshes
    if (ecashTokens.length === 0) {
      setLoadingEcashTokens(true);
    }

    try {
      const tokensWithStatus = await loadTokensWithStatus(
        wallet.taprootAddress,
        getSentLockedTokens,
        getReceivedTokens
      );
      setEcashTokens(tokensWithStatus);
    } catch (error: unknown) {
      logger.error('[EcashTokensContext] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoadingEcashTokens(false);
      ecashFetchingRef.current = false;
    }
  }, [wallet?.taprootAddress, ecashTokens.length]);

  const resetEcashTokens = useCallback(() => {
    setEcashTokens([]);
    setLoadingEcashTokens(false);
  }, []);

  // Subscribe to token changes (send/receive) to auto-refresh
  useEffect(() => {
    if (!wallet) return;

    const unsubscribe = subscribeToTokenChanges(() => {
      logger.debug('[EcashTokensContext] Token change detected, refreshing ecash tokens');
      fetchEcashTokens().catch((error: unknown) => {
        logger.error('[EcashTokensContext] Failed to refresh ecash tokens after token change', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    return () => {
      unsubscribe();
    };
  }, [wallet, fetchEcashTokens]);

  const ecashValue = useMemo((): EcashTokensValue => ({
    ecashTokens,
    loadingEcashTokens,
    fetchEcashTokens,
    resetEcashTokens,
  }), [ecashTokens, loadingEcashTokens, fetchEcashTokens, resetEcashTokens]);

  return <EcashTokensCtx.Provider value={ecashValue}>{children}</EcashTokensCtx.Provider>;
};
