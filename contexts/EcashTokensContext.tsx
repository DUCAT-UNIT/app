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
  fetchEcashTokens: (taprootAddressOverride?: string) => Promise<void>;
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

const ecashTokenStateKey = (token: TokenWithStatus): string => {
  const recipient = 'recipient' in token ? token.recipient ?? '' : '';
  const sender = 'sender' in token ? token.sender ?? '' : '';
  const shortUrl = 'shortUrl' in token ? token.shortUrl ?? '' : '';
  return [
    token.id,
    token.unit ?? 'unit',
    token.amount,
    token.timestamp,
    token.claimed ? 1 : 0,
    token.partiallySpent ? 1 : 0,
    token.pendingRedeem ? 1 : 0,
    recipient,
    sender,
    shortUrl,
  ].join(':');
};

interface EcashTokensProviderProps {
  children: ReactNode;
}

export const EcashTokensProvider: React.FC<EcashTokensProviderProps> = ({ children }) => {
  const { wallet } = useWallet();

  const [ecashTokens, setEcashTokens] = useState<TokenWithStatus[]>([]);
  const [loadingEcashTokens, setLoadingEcashTokens] = useState(false);
  const ecashFetchingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const prevTokenHashRef = useRef('');

  const fetchEcashTokens = useCallback(async (taprootAddressOverride?: string) => {
    const taprootAddress = taprootAddressOverride ?? wallet?.taprootAddress;
    if (!taprootAddress || ecashFetchingRef.current) return;

    ecashFetchingRef.current = true;
    // Only show loading on first fetch, not background refreshes
    if (!hasLoadedOnceRef.current) {
      setLoadingEcashTokens(true);
    }

    try {
      const tokensWithStatus = await loadTokensWithStatus(
        taprootAddress,
        getSentLockedTokens,
        getReceivedTokens
      );

      // Only update state if tokens have actually changed
      const newHash = tokensWithStatus
        .map(ecashTokenStateKey)
        .join('|');
      if (newHash !== prevTokenHashRef.current) {
        prevTokenHashRef.current = newHash;
        setEcashTokens(tokensWithStatus);
      }

      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoadingEcashTokens(false);
      }
    } catch (error: unknown) {
      logger.error('[EcashTokensContext] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoadingEcashTokens(false);
      }
    } finally {
      ecashFetchingRef.current = false;
    }
  }, [wallet?.taprootAddress]);

  const resetEcashTokens = useCallback(() => {
    setEcashTokens([]);
    setLoadingEcashTokens(false);
    ecashFetchingRef.current = false;
    hasLoadedOnceRef.current = false;
    prevTokenHashRef.current = '';
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
