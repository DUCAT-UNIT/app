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
import { InteractionManager } from 'react-native';
import { isEvmBridgeConfigured, isSepoliaRpcConfigured } from '../constants/evm';
import { usePolling } from '../hooks/usePolling';
import {
  fetchSepoliaEthHistory,
  fetchSepoliaTokenHistory,
  getEvmBalances,
  type EvmBalances,
  type SepoliaAssetHistoryItem,
} from '../services/evmBridgeService';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../services/evmTransactionCheckpointService';
import { refreshPersistedVaultSettlementStatus } from '../services/vaultSettlementService';
import { useEvmTransactionCheckpointStore } from '../stores/evmTransactionCheckpointStore';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import { backfillEvmHistoryFromCheckpoints } from '../utils/evmCheckpointDisplay';
import { useAuthSession } from './AuthContext';
import { useWallet } from './WalletContext';

const BALANCE_POLL_INTERVAL_MS = 15_000;
const HISTORY_POLL_INTERVAL_MS = 45_000;

export interface EvmAssetsValue {
  evmBalances: EvmBalances | null;
  usdcHistory: SepoliaAssetHistoryItem[];
  ethHistory: SepoliaAssetHistoryItem[];
  loadingEvmBalances: boolean;
  loadingUsdcHistory: boolean;
  loadingEthHistory: boolean;
  isSepoliaConfigured: boolean;
  isEvmConfigured: boolean;
  refreshEvmBalances: (accountOverride?: number) => Promise<void>;
  refreshUsdcHistory: (accountOverride?: number) => Promise<void>;
  refreshEthHistory: (accountOverride?: number) => Promise<void>;
  resetEvmAssets: () => void;
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
  const { isAuthenticated } = useAuthSession();
  const evmCheckpoints = useEvmTransactionCheckpointStore((state) => state.checkpoints);
  const usdcFeaturesEnabled = useUsdcFeatureFlagStore((state) => state.enabled);
  const activeWallet = isAuthenticated ? wallet : null;
  const isSepoliaConfigured = usdcFeaturesEnabled && isSepoliaRpcConfigured();
  const isEvmConfigured = usdcFeaturesEnabled && isEvmBridgeConfigured();

  const [evmBalances, setEvmBalances] = useState<EvmBalances | null>(null);
  const [usdcHistory, setUsdcHistory] = useState<SepoliaAssetHistoryItem[]>([]);
  const [ethHistory, setEthHistory] = useState<SepoliaAssetHistoryItem[]>([]);
  const [loadingEvmBalances, setLoadingEvmBalances] = useState(false);
  const [loadingUsdcHistory, setLoadingUsdcHistory] = useState(false);
  const [loadingEthHistory, setLoadingEthHistory] = useState(false);
  const accountRef = useRef(currentAccount);
  const balanceInFlightRef = useRef(false);
  const historyInFlightRef = useRef(false);
  const ethHistoryInFlightRef = useRef(false);
  const balancesLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const ethHistoryLoadedRef = useRef(false);
  const initialHistoryTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const settlementRecoveryTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const settlementRecoveryKeyRef = useRef<string | null>(null);
  const evmCheckpointRecoveryTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const evmCheckpointRecoveryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    accountRef.current = currentAccount;
  }, [currentAccount]);

  const resetEvmAssets = useCallback((): void => {
    setEvmBalances(null);
    setUsdcHistory([]);
    setEthHistory([]);
    setLoadingEvmBalances(false);
    setLoadingUsdcHistory(false);
    setLoadingEthHistory(false);
    balanceInFlightRef.current = false;
    historyInFlightRef.current = false;
    ethHistoryInFlightRef.current = false;
    balancesLoadedRef.current = false;
    historyLoadedRef.current = false;
    ethHistoryLoadedRef.current = false;
  }, []);

  const refreshEvmBalances = useCallback(async (accountOverride?: number) => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured || balanceInFlightRef.current) {
      return;
    }

    const targetAccount = accountOverride ?? currentAccount;
    balanceInFlightRef.current = true;
    const shouldShowLoading = !balancesLoadedRef.current;
    if (shouldShowLoading) {
      setLoadingEvmBalances(true);
    }

    try {
      const nextBalances = await getEvmBalances(targetAccount);
      if (accountOverride !== undefined || accountRef.current === currentAccount) {
        setEvmBalances(nextBalances);
        balancesLoadedRef.current = true;
      }
    } catch {
      if (accountRef.current === currentAccount && !balancesLoadedRef.current) {
        setEvmBalances(null);
      }
    } finally {
      balanceInFlightRef.current = false;
      if ((accountOverride !== undefined || accountRef.current === currentAccount) && shouldShowLoading) {
        setLoadingEvmBalances(false);
      }
    }
  }, [activeWallet, currentAccount, isSepoliaConfigured, usdcFeaturesEnabled]);

  const refreshUsdcHistory = useCallback(async (accountOverride?: number) => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured || historyInFlightRef.current) {
      return;
    }

    const targetAccount = accountOverride ?? currentAccount;
    historyInFlightRef.current = true;
    const shouldShowLoading = !historyLoadedRef.current;
    if (shouldShowLoading) {
      setLoadingUsdcHistory(true);
    }

    try {
      const nextHistory = await fetchSepoliaTokenHistory(targetAccount, 'USDC');
      if (accountOverride !== undefined || accountRef.current === currentAccount) {
        setUsdcHistory(nextHistory);
        historyLoadedRef.current = true;
      }
    } catch {
      if (accountRef.current === currentAccount && !historyLoadedRef.current) {
        setUsdcHistory([]);
      }
    } finally {
      historyInFlightRef.current = false;
      if ((accountOverride !== undefined || accountRef.current === currentAccount) && shouldShowLoading) {
        setLoadingUsdcHistory(false);
      }
    }
  }, [activeWallet, currentAccount, isSepoliaConfigured, usdcFeaturesEnabled]);

  const refreshEthHistory = useCallback(async (accountOverride?: number) => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured || ethHistoryInFlightRef.current) {
      return;
    }

    const targetAccount = accountOverride ?? currentAccount;
    ethHistoryInFlightRef.current = true;
    const shouldShowLoading = !ethHistoryLoadedRef.current;
    if (shouldShowLoading) {
      setLoadingEthHistory(true);
    }

    try {
      const nextHistory = await fetchSepoliaEthHistory(targetAccount);
      if (accountOverride !== undefined || accountRef.current === currentAccount) {
        setEthHistory(nextHistory);
        ethHistoryLoadedRef.current = true;
      }
    } catch {
      if (accountRef.current === currentAccount && !ethHistoryLoadedRef.current) {
        setEthHistory([]);
      }
    } finally {
      ethHistoryInFlightRef.current = false;
      if ((accountOverride !== undefined || accountRef.current === currentAccount) && shouldShowLoading) {
        setLoadingEthHistory(false);
      }
    }
  }, [activeWallet, currentAccount, isSepoliaConfigured, usdcFeaturesEnabled]);

  useEffect(() => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured) {
      initialHistoryTaskRef.current?.cancel();
      initialHistoryTaskRef.current = null;
      settlementRecoveryTaskRef.current?.cancel();
      settlementRecoveryTaskRef.current = null;
      settlementRecoveryKeyRef.current = null;
      evmCheckpointRecoveryTaskRef.current?.cancel();
      evmCheckpointRecoveryTaskRef.current = null;
      evmCheckpointRecoveryKeyRef.current = null;
      resetEvmAssets();
      return;
    }

    refreshEvmBalances().catch(() => undefined);

    initialHistoryTaskRef.current?.cancel();
    initialHistoryTaskRef.current = InteractionManager.runAfterInteractions(() => {
      refreshUsdcHistory().catch(() => undefined);
      refreshEthHistory().catch(() => undefined);
    });

    return () => {
      initialHistoryTaskRef.current?.cancel();
      initialHistoryTaskRef.current = null;
    };
  }, [
    activeWallet,
    currentAccount,
    isSepoliaConfigured,
    refreshEvmBalances,
    refreshEthHistory,
    refreshUsdcHistory,
    resetEvmAssets,
    usdcFeaturesEnabled,
  ]);

  useEffect(() => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured || !isEvmConfigured) {
      settlementRecoveryTaskRef.current?.cancel();
      settlementRecoveryTaskRef.current = null;
      settlementRecoveryKeyRef.current = null;
      return undefined;
    }

    const recoveryKey = `${currentAccount}:${activeWallet.taprootAddress || ''}`;
    if (settlementRecoveryKeyRef.current === recoveryKey) {
      return undefined;
    }

    settlementRecoveryKeyRef.current = recoveryKey;
    let cancelled = false;
    let recoveryStarted = false;

    settlementRecoveryTaskRef.current?.cancel();
    settlementRecoveryTaskRef.current = InteractionManager.runAfterInteractions(() => {
      recoveryStarted = true;
      refreshPersistedVaultSettlementStatus()
        .then((result) => {
          if (cancelled) {
            return;
          }

          if (result.status === 'settled' || result.status === 'ready_to_repay') {
            refreshEvmBalances().catch(() => undefined);
            refreshUsdcHistory().catch(() => undefined);
            refreshEthHistory().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      settlementRecoveryTaskRef.current?.cancel();
      settlementRecoveryTaskRef.current = null;
      if (!recoveryStarted && settlementRecoveryKeyRef.current === recoveryKey) {
        settlementRecoveryKeyRef.current = null;
      }
    };
  }, [
    activeWallet,
    activeWallet?.taprootAddress,
    currentAccount,
    isEvmConfigured,
    isSepoliaConfigured,
    refreshEvmBalances,
    refreshEthHistory,
    refreshUsdcHistory,
    usdcFeaturesEnabled,
  ]);

  useEffect(() => {
    if (!activeWallet || !usdcFeaturesEnabled || !isSepoliaConfigured) {
      evmCheckpointRecoveryTaskRef.current?.cancel();
      evmCheckpointRecoveryTaskRef.current = null;
      evmCheckpointRecoveryKeyRef.current = null;
      return undefined;
    }

    const recoveryKey = `${currentAccount}:${activeWallet.taprootAddress || ''}:evm-checkpoints`;
    if (evmCheckpointRecoveryKeyRef.current === recoveryKey) {
      return undefined;
    }

    evmCheckpointRecoveryKeyRef.current = recoveryKey;
    let cancelled = false;
    let recoveryStarted = false;

    evmCheckpointRecoveryTaskRef.current?.cancel();
    evmCheckpointRecoveryTaskRef.current = InteractionManager.runAfterInteractions(() => {
      recoveryStarted = true;
      reconcileSubmittedEvmTransactionCheckpoints()
        .then(async (result) => {
          if (cancelled) {
            return;
          }

          if (isEvmConfigured) {
            await recoverConfirmedRedemptionTracking().catch(() => undefined);
          }

          if (result.confirmed > 0 || result.failed > 0) {
            refreshEvmBalances().catch(() => undefined);
            refreshUsdcHistory().catch(() => undefined);
            refreshEthHistory().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      evmCheckpointRecoveryTaskRef.current?.cancel();
      evmCheckpointRecoveryTaskRef.current = null;
      if (!recoveryStarted && evmCheckpointRecoveryKeyRef.current === recoveryKey) {
        evmCheckpointRecoveryKeyRef.current = null;
      }
    };
  }, [
    activeWallet,
    activeWallet?.taprootAddress,
    currentAccount,
    isEvmConfigured,
    isSepoliaConfigured,
    refreshEvmBalances,
    refreshEthHistory,
    refreshUsdcHistory,
    usdcFeaturesEnabled,
  ]);

  usePolling({
    onPoll: refreshEvmBalances,
    interval: BALANCE_POLL_INTERVAL_MS,
    enabled: Boolean(activeWallet && usdcFeaturesEnabled && isSepoliaConfigured),
    immediate: false,
  });

  usePolling({
    onPoll: refreshUsdcHistory,
    interval: HISTORY_POLL_INTERVAL_MS,
    enabled: Boolean(activeWallet && usdcFeaturesEnabled && isSepoliaConfigured),
    immediate: false,
  });

  usePolling({
    onPoll: refreshEthHistory,
    interval: HISTORY_POLL_INTERVAL_MS,
    enabled: Boolean(activeWallet && usdcFeaturesEnabled && isSepoliaConfigured),
    immediate: false,
  });

  const displayUsdcHistory = useMemo(
    () => usdcFeaturesEnabled ? backfillEvmHistoryFromCheckpoints(
      usdcHistory,
      evmCheckpoints,
      'USDC',
      currentAccount,
      evmBalances?.address,
    ) : [],
    [currentAccount, evmBalances?.address, evmCheckpoints, usdcFeaturesEnabled, usdcHistory],
  );

  const displayEthHistory = useMemo(
    () => usdcFeaturesEnabled ? backfillEvmHistoryFromCheckpoints(
      ethHistory,
      evmCheckpoints,
      'ETH',
      currentAccount,
      evmBalances?.address,
    ) : [],
    [currentAccount, ethHistory, evmBalances?.address, evmCheckpoints, usdcFeaturesEnabled],
  );

  const value = useMemo<EvmAssetsValue>(() => ({
    evmBalances: usdcFeaturesEnabled ? evmBalances : null,
    usdcHistory: displayUsdcHistory,
    ethHistory: displayEthHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    loadingEthHistory,
    isSepoliaConfigured: usdcFeaturesEnabled && isSepoliaConfigured,
    isEvmConfigured: usdcFeaturesEnabled && isEvmConfigured,
    refreshEvmBalances,
    refreshUsdcHistory,
    refreshEthHistory,
    resetEvmAssets,
  }), [
    evmBalances,
    displayUsdcHistory,
    displayEthHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    loadingEthHistory,
    isSepoliaConfigured,
    isEvmConfigured,
    refreshEvmBalances,
    refreshUsdcHistory,
    refreshEthHistory,
    resetEvmAssets,
    usdcFeaturesEnabled,
  ]);

  return (
    <EvmAssetsContext.Provider value={value}>
      {children}
    </EvmAssetsContext.Provider>
  );
};
