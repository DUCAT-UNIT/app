import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EVM_CONFIG } from '../constants/evm';
import { usePolling } from '../hooks/usePolling';
import {
  fetchSepoliaTokenHistory,
  getEvmBalances,
  type EvmBalances,
  type SepoliaAssetHistoryItem,
} from '../services/evmBridgeService';
import { useWallet } from './WalletContext';

const BALANCE_POLL_INTERVAL_MS = 5_000;
const HISTORY_POLL_INTERVAL_MS = 15_000;

export interface EvmAssetsValue {
  evmBalances: EvmBalances | null;
  usdcHistory: SepoliaAssetHistoryItem[];
  loadingEvmBalances: boolean;
  loadingUsdcHistory: boolean;
  isEvmConfigured: boolean;
  refreshEvmBalances: () => Promise<void>;
  refreshUsdcHistory: () => Promise<void>;
}

const EvmAssetsContext = createContext<EvmAssetsValue | undefined>(undefined);

export const useEvmAssets = (): EvmAssetsValue => {
  const context = useContext(EvmAssetsContext);
  if (!context) {
    throw new Error('useEvmAssets must be used within an EvmAssetsProvider');
  }
  return context;
};

interface EvmAssetsProviderProps {
  children: ReactNode;
}

export const EvmAssetsProvider: React.FC<EvmAssetsProviderProps> = ({ children }) => {
  const { wallet, currentAccount } = useWallet();
  const isEvmConfigured = Boolean(
    EVM_CONFIG.rpcUrl
    && EVM_CONFIG.bridgeApiBaseUrl
    && EVM_CONFIG.wunitAddress
    && EVM_CONFIG.bridgeRouterAddress
    && EVM_CONFIG.stablePoolAddress,
  );

  const [evmBalances, setEvmBalances] = useState<EvmBalances | null>(null);
  const [usdcHistory, setUsdcHistory] = useState<SepoliaAssetHistoryItem[]>([]);
  const [loadingEvmBalances, setLoadingEvmBalances] = useState(false);
  const [loadingUsdcHistory, setLoadingUsdcHistory] = useState(false);
  const accountRef = useRef(currentAccount);
  const balanceInFlightRef = useRef(false);
  const historyInFlightRef = useRef(false);
  const balancesLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);

  useEffect(() => {
    accountRef.current = currentAccount;
  }, [currentAccount]);

  const refreshEvmBalances = useCallback(async () => {
    if (!wallet || !isEvmConfigured || balanceInFlightRef.current) {
      return;
    }

    balanceInFlightRef.current = true;
    const shouldShowLoading = !balancesLoadedRef.current && !evmBalances;
    if (shouldShowLoading) {
      setLoadingEvmBalances(true);
    }

    try {
      const nextBalances = await getEvmBalances(currentAccount);
      if (accountRef.current === currentAccount) {
        setEvmBalances(nextBalances);
        balancesLoadedRef.current = true;
      }
    } catch {
      if (accountRef.current === currentAccount && !balancesLoadedRef.current) {
        setEvmBalances(null);
      }
    } finally {
      balanceInFlightRef.current = false;
      if (accountRef.current === currentAccount && shouldShowLoading) {
        setLoadingEvmBalances(false);
      }
    }
  }, [currentAccount, evmBalances, isEvmConfigured, wallet]);

  const refreshUsdcHistory = useCallback(async () => {
    if (!wallet || !isEvmConfigured || historyInFlightRef.current) {
      return;
    }

    historyInFlightRef.current = true;
    const shouldShowLoading = !historyLoadedRef.current && usdcHistory.length === 0;
    if (shouldShowLoading) {
      setLoadingUsdcHistory(true);
    }

    try {
      const nextHistory = await fetchSepoliaTokenHistory(currentAccount, 'USDC');
      if (accountRef.current === currentAccount) {
        setUsdcHistory(nextHistory);
        historyLoadedRef.current = true;
      }
    } catch {
      if (accountRef.current === currentAccount && !historyLoadedRef.current) {
        setUsdcHistory([]);
      }
    } finally {
      historyInFlightRef.current = false;
      if (accountRef.current === currentAccount && shouldShowLoading) {
        setLoadingUsdcHistory(false);
      }
    }
  }, [currentAccount, isEvmConfigured, usdcHistory.length, wallet]);

  useEffect(() => {
    if (!wallet || !isEvmConfigured) {
      setEvmBalances(null);
      setUsdcHistory([]);
      setLoadingEvmBalances(false);
      setLoadingUsdcHistory(false);
      balanceInFlightRef.current = false;
      historyInFlightRef.current = false;
      balancesLoadedRef.current = false;
      historyLoadedRef.current = false;
      return;
    }

    refreshEvmBalances().catch(() => undefined);
    refreshUsdcHistory().catch(() => undefined);
  }, [currentAccount, isEvmConfigured, refreshEvmBalances, refreshUsdcHistory, wallet]);

  usePolling({
    onPoll: refreshEvmBalances,
    interval: BALANCE_POLL_INTERVAL_MS,
    enabled: Boolean(wallet && isEvmConfigured),
    immediate: false,
  });

  usePolling({
    onPoll: refreshUsdcHistory,
    interval: HISTORY_POLL_INTERVAL_MS,
    enabled: Boolean(wallet && isEvmConfigured),
    immediate: false,
  });

  const value = useMemo<EvmAssetsValue>(() => ({
    evmBalances,
    usdcHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    isEvmConfigured,
    refreshEvmBalances,
    refreshUsdcHistory,
  }), [
    evmBalances,
    usdcHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    isEvmConfigured,
    refreshEvmBalances,
    refreshUsdcHistory,
  ]);

  return (
    <EvmAssetsContext.Provider value={value}>
      {children}
    </EvmAssetsContext.Provider>
  );
};
