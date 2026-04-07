/**
 * Tests for WalletDataContext
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { WalletDataProvider, useBalance, useTransactionHistory, useVaultData, useEcashTokens } from '../WalletDataContext';
import { useWallet } from '../WalletContext';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { usePolling } from '../../hooks/usePolling';
import { useBalanceData } from '../../hooks/useBalanceData';
import { useTransactionHistoryFetch } from '../../hooks/useTransactionHistoryFetch';
import { useVaultDataFetch } from '../../hooks/useVaultDataFetch';

// Mock all dependencies
jest.mock('../WalletContext');
jest.mock('../../stores/pendingTransactionsStore');
jest.mock('../../hooks/usePolling');
jest.mock('../../hooks/useBalanceData');
jest.mock('../../hooks/useTransactionHistoryFetch');
jest.mock('../../hooks/useVaultDataFetch');
const mockUseCashuBalanceState = jest.fn();
jest.mock('../CashuContext', () => ({
  useCashuBalanceState: () => mockUseCashuBalanceState(),
}));

// Mock cashu locked tokens service
const mockSubscribeToTokenChanges = jest.fn();
jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  getSentLockedTokens: jest.fn(),
  getReceivedTokens: jest.fn(),
  subscribeToTokenChanges: (callback: () => void) => mockSubscribeToTokenChanges(callback),
}));

// Mock token status service
const mockLoadTokensWithStatus = jest.fn();
jest.mock('../../services/cashu/tokenStatusService', () => ({
  loadTokensWithStatus: (...args: unknown[]) => mockLoadTokensWithStatus(...args),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock stores
jest.mock('../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: jest.fn((selector) => {
    if (selector) {
      return selector({ pendingTransaction: null });
    }
    return { getState: () => ({ clearPendingTransaction: jest.fn() }) };
  }),
}));

jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      snackbar: null,
      showSnackbar: jest.fn(),
    }),
  },
}));

jest.mock('../../stores/sendFlowStore', () => ({
  useSendFlowStore: {
    getState: () => ({
      intentStep: 'idle',
    }),
  },
}));

describe('WalletDataContext', () => {
  const mockWallet = {
    segwitAddress: 'bc1qtest',
    taprootAddress: 'bc1ptest',
    taprootPubkey: 'pubkeytest',
  };

  const mockBalance = {
    segwitBalance: 100000,
    taprootBalance: 50000,
    runesBalance: [],
    unconfirmedSegwitBalance: 0,
    unconfirmedTaprootBalance: 0,
    unconfirmedRunesBalance: {},
    loadingBalance: false,
    refreshing: false,
    balanceError: null,
    setBalanceError: jest.fn(),
    utxos: [],
    loadingUtxos: false,
    fetchBalance: jest.fn(),
    onRefresh: jest.fn(),
    fetchUtxos: jest.fn(),
    resetBalances: jest.fn(),
  };

  const mockHistory = {
    transactionHistory: [],
    loadingTransactionHistory: false,
    historyError: null,
    fetchTransactionHistory: jest.fn(),
    resetTransactionHistory: jest.fn(),
  };

  const mockVault = {
    vaultData: null,
    loadingVault: false,
    vaultError: null,
    fetchVault: jest.fn(),
    resetVaultData: jest.fn(),
    // Vault transactions (cached like BTC transaction history)
    vaultTransactions: [],
    loadingVaultTransactions: false,
    fetchVaultTransactions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({ wallet: mockWallet });
    (usePendingTransactionsStore as unknown as jest.Mock).mockReturnValue({ getUnconfirmedBalance: jest.fn(), getUnconfirmedUTXOs: jest.fn() });
    (useBalanceData as jest.Mock).mockReturnValue(mockBalance);
    (useTransactionHistoryFetch as jest.Mock).mockReturnValue(mockHistory);
    (useVaultDataFetch as jest.Mock).mockReturnValue(mockVault);
    (usePolling as jest.Mock).mockImplementation(() => {});
    mockUseCashuBalanceState.mockReturnValue({
      balance: 0,
      isLoading: false,
      fetchBalance: jest.fn(),
    });
    mockSubscribeToTokenChanges.mockReturnValue(jest.fn()); // Return unsubscribe function
    mockLoadTokensWithStatus.mockResolvedValue([]);
  });

  describe('Hook error handling', () => {
    it('useBalance should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useBalance());
      }).toThrow('useBalance must be used within a BalanceProvider');

      consoleError.mockRestore();
    });

    it('useTransactionHistory should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTransactionHistory());
      }).toThrow('useTransactionHistory must be used within a TransactionHistoryProvider');

      consoleError.mockRestore();
    });

    it('useVaultData should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useVaultData());
      }).toThrow('useVaultData must be used within a VaultProvider');

      consoleError.mockRestore();
    });

    it('useEcashTokens should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useEcashTokens());
      }).toThrow('useEcashTokens must be used within an EcashTokensProvider');

      consoleError.mockRestore();
    });
  });

  describe('Backwards compatibility hooks', () => {
    it('should provide useBalance hook', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useBalance(), { wrapper });

      expect(result.current).toBe(mockBalance);
    });

    it('should provide useTransactionHistory hook', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useTransactionHistory(), { wrapper });

      expect(result.current).toBe(mockHistory);
    });

    it('should provide useVaultData hook', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useVaultData(), { wrapper });

      expect(result.current).toBe(mockVault);
    });

    it('should provide useEcashTokens hook', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useEcashTokens(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current!.ecashTokens).toEqual([]);
    });
  });

  describe('WalletDataProvider', () => {
    it('should render provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useBalance(), { wrapper });

      expect(result.current).toBeDefined();
    });

    it('should call useBalanceData with wallet and getUnconfirmedBalance', () => {
      const mockGetUnconfirmed = jest.fn();
      const mockGetUnconfirmedUTXOs = jest.fn();
      (usePendingTransactionsStore as unknown as jest.Mock).mockReturnValue({
        getUnconfirmedBalance: mockGetUnconfirmed,
        getUnconfirmedUTXOs: mockGetUnconfirmedUTXOs,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      expect(useBalanceData).toHaveBeenCalledWith(mockWallet, mockGetUnconfirmed, mockGetUnconfirmedUTXOs);
    });

    it('should call useTransactionHistoryFetch with wallet', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      expect(useTransactionHistoryFetch).toHaveBeenCalledWith(mockWallet);
    });

    it('should call useVaultDataFetch with wallet', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      expect(useVaultDataFetch).toHaveBeenCalledWith(mockWallet);
    });

    it('should set up polling with correct parameters', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      expect(usePolling).toHaveBeenCalledWith({
        onPoll: expect.any(Function),
        interval: 10000,
        enabled: true,
        immediate: true,
      });
    });

    it('should disable polling when wallet is null', () => {
      (useWallet as jest.Mock).mockReturnValue({ wallet: null });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      expect(usePolling).toHaveBeenCalledWith({
        onPoll: expect.any(Function),
        interval: 10000,
        enabled: false,
        immediate: true,
      });
    });

    it('should fetch balance and vault on poll', () => {
      let pollCallback: () => void;
      (usePolling as jest.Mock).mockImplementation(({ onPoll }: { onPoll: () => void }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      act(() => {
        pollCallback();
      });

      expect(mockBalance.fetchBalance).toHaveBeenCalled();
      expect(mockVault.fetchVault).toHaveBeenCalled();
    });

    it('should fetch transaction history on every poll', () => {
      jest.useFakeTimers();
      let pollCallback: () => void;
      (usePolling as jest.Mock).mockImplementation(({ onPoll }: { onPoll: () => void }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      // Clear mock calls from initial wallet load (but keep the mock implementations)
      mockHistory.fetchTransactionHistory.mockClear();

      // First poll - should fetch history
      act(() => {
        pollCallback();
      });
      expect(mockHistory.fetchTransactionHistory).toHaveBeenCalledTimes(1);

      // Second poll - should fetch history again (no throttling)
      act(() => {
        pollCallback();
      });
      expect(mockHistory.fetchTransactionHistory).toHaveBeenCalledTimes(2);

      // Third poll - should fetch history again
      act(() => {
        pollCallback();
      });
      expect(mockHistory.fetchTransactionHistory).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should not poll when wallet is null', () => {
      (useWallet as jest.Mock).mockReturnValue({ wallet: null });
      let pollCallback: () => void;
      (usePolling as jest.Mock).mockImplementation(({ onPoll }: { onPoll: () => void }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      act(() => {
        pollCallback();
      });

      expect(mockBalance.fetchBalance).not.toHaveBeenCalled();
      expect(mockVault.fetchVault).not.toHaveBeenCalled();
    });

    it('should reset data when wallet is removed', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useBalance(), { wrapper });

      // Change wallet to null
      (useWallet as jest.Mock).mockReturnValue({ wallet: null });

      act(() => {
        rerender(undefined);
      });

      expect(mockBalance.resetBalances).toHaveBeenCalled();
      expect(mockHistory.resetTransactionHistory).toHaveBeenCalled();
      expect(mockVault.resetVaultData).toHaveBeenCalled();
    });

    it('should fetch balance and vault when wallet is first loaded', () => {
      (useWallet as jest.Mock).mockReturnValue({ wallet: null });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useBalance(), { wrapper });

      jest.clearAllMocks();

      // Wallet loaded for first time (import/creation)
      const newWallet = {
        segwitAddress: 'bc1qnew',
        taprootAddress: 'bc1pnew',
        taprootPubkey: 'newpubkey',
      };
      (useWallet as jest.Mock).mockReturnValue({ wallet: newWallet });

      act(() => {
        rerender(undefined);
      });

      // Should fetch balances on initial wallet load
      expect(mockBalance.fetchBalance).toHaveBeenCalled();
      expect(mockVault.fetchVault).toHaveBeenCalled();
    });

    it('should not fetch when wallet account changes (handled by useAccountSwitcher)', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useBalance(), { wrapper });

      jest.clearAllMocks();

      // Change to different wallet account
      const newWallet = {
        segwitAddress: 'bc1qnew',
        taprootAddress: 'bc1pnew',
        taprootPubkey: 'newpubkey',
      };
      (useWallet as jest.Mock).mockReturnValue({ wallet: newWallet });

      act(() => {
        rerender(undefined);
      });

      // Account switches are handled by useAccountSwitcher in NavigationHandlersContext
      // WalletDataContext should not trigger fetches on account changes
      expect(mockBalance.fetchBalance).not.toHaveBeenCalled();
      expect(mockVault.fetchVault).not.toHaveBeenCalled();
      expect(mockHistory.fetchTransactionHistory).not.toHaveBeenCalled();
    });

    it('should not fetch when wallet object changes but addresses are same', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useBalance(), { wrapper });

      jest.clearAllMocks();

      // Same addresses, different object
      const sameWallet = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
        taprootPubkey: 'pubkeytest',
      };
      (useWallet as jest.Mock).mockReturnValue({ wallet: sameWallet });

      act(() => {
        rerender(undefined);
      });

      expect(mockBalance.fetchBalance).not.toHaveBeenCalled();
      expect(mockVault.fetchVault).not.toHaveBeenCalled();
      expect(mockHistory.fetchTransactionHistory).not.toHaveBeenCalled();
    });

    it('should expose all balance properties via useBalance', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useBalance(), { wrapper });

      expect(result.current!.segwitBalance).toBe(mockBalance.segwitBalance);
      expect(result.current!.taprootBalance).toBe(mockBalance.taprootBalance);
      expect(result.current!.runesBalance).toBe(mockBalance.runesBalance);
      expect(result.current!.loadingBalance).toBe(mockBalance.loadingBalance);
      expect(result.current!.fetchBalance).toBe(mockBalance.fetchBalance);
    });

    it('should expose all history properties via useTransactionHistory', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useTransactionHistory(), { wrapper });

      expect(result.current!.transactionHistory).toBe(mockHistory.transactionHistory);
      expect(result.current!.loadingTransactionHistory).toBe(mockHistory.loadingTransactionHistory);
      expect(result.current!.fetchTransactionHistory).toBe(mockHistory.fetchTransactionHistory);
    });

    it('should expose all vault properties via useVaultData', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useVaultData(), { wrapper });

      expect(result.current!.vaultData).toBe(mockVault.vaultData);
      expect(result.current!.loadingVault).toBe(mockVault.loadingVault);
      expect(result.current!.fetchVault).toBe(mockVault.fetchVault);
      // Vault transactions
      expect(result.current!.vaultTransactions).toBe(mockVault.vaultTransactions);
      expect(result.current!.loadingVaultTransactions).toBe(mockVault.loadingVaultTransactions);
      expect(result.current!.fetchVaultTransactions).toBe(mockVault.fetchVaultTransactions);
    });
  });

  describe('Ecash tokens', () => {
    it('should handle ecash token loading error', async () => {
      const { logger } = require('../../utils/logger');
      mockLoadTokensWithStatus.mockRejectedValue(new Error('Token load failed'));

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useEcashTokens(), { wrapper });

      await act(async () => {
        await result.current!.fetchEcashTokens();
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[EcashTokensContext] Failed to load ecash tokens:',
        expect.objectContaining({ error: 'Token load failed' })
      );
    });

    it('should handle ecash token loading error with non-Error', async () => {
      const { logger } = require('../../utils/logger');
      mockLoadTokensWithStatus.mockRejectedValue('string error');

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useEcashTokens(), { wrapper });

      await act(async () => {
        await result.current!.fetchEcashTokens();
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[EcashTokensContext] Failed to load ecash tokens:',
        expect.objectContaining({ error: 'string error' })
      );
    });

    it('should not fetch ecash tokens when wallet has no taprootAddress', async () => {
      (useWallet as jest.Mock).mockReturnValue({ wallet: { segwitAddress: 'bc1qtest' } }); // No taprootAddress

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useEcashTokens(), { wrapper });

      await act(async () => {
        await result.current!.fetchEcashTokens();
      });

      expect(mockLoadTokensWithStatus).not.toHaveBeenCalled();
    });

    it('should reset ecash tokens', async () => {
      mockLoadTokensWithStatus.mockResolvedValue([{ id: 'token1' }]);

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useEcashTokens(), { wrapper });

      // Load tokens first
      await act(async () => {
        await result.current!.fetchEcashTokens();
      });

      expect(result.current.ecashTokens.length).toBe(1);

      // Reset
      act(() => {
        result.current!.resetEcashTokens();
      });

      expect(result.current.ecashTokens.length).toBe(0);
    });

    it('should subscribe to token changes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useEcashTokens(), { wrapper });

      expect(mockSubscribeToTokenChanges).toHaveBeenCalled();
    });
  });

  describe('Polling with balances not loaded', () => {
    it('should skip transaction history when cashu balance is not loaded', () => {
      const { logger } = require('../../utils/logger');
      mockUseCashuBalanceState.mockReturnValue({
        balance: null, // Not loaded yet
        isLoading: true,
        fetchBalance: jest.fn(),
      });

      let pollCallback: () => void;
      (usePolling as jest.Mock).mockImplementation(({ onPoll }: { onPoll: () => void }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useBalance(), { wrapper });

      jest.clearAllMocks();

      act(() => {
        pollCallback();
      });

      // Should fetch balance and vault but not history
      expect(mockBalance.fetchBalance).toHaveBeenCalled();
      expect(mockVault.fetchVault).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[WalletDataContext] Skipping transaction history - waiting for balances to load',
        expect.any(Object)
      );
    });
  });
});
