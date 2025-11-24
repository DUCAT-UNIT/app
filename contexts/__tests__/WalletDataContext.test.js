/**
 * Tests for WalletDataContext
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { WalletDataProvider, useWalletData, useBalance, useTransactionHistory, useVaultData } from '../WalletDataContext';
import { useWallet } from '../WalletContext';
import { usePendingTransactions } from '../PendingTransactionsContext';
import { usePolling } from '../../hooks/usePolling';
import { useBalanceData } from '../../hooks/useBalanceData';
import { useTransactionHistoryFetch } from '../../hooks/useTransactionHistoryFetch';
import { useVaultDataFetch } from '../../hooks/useVaultDataFetch';

// Mock all dependencies
jest.mock('../WalletContext');
jest.mock('../PendingTransactionsContext');
jest.mock('../../hooks/usePolling');
jest.mock('../../hooks/useBalanceData');
jest.mock('../../hooks/useTransactionHistoryFetch');
jest.mock('../../hooks/useVaultDataFetch');
jest.mock('../CashuContext', () => ({
  useCashu: () => ({
    balance: 0,
    isLoading: false,
    fetchBalance: jest.fn(),
  }),
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useWallet.mockReturnValue({ wallet: mockWallet });
    usePendingTransactions.mockReturnValue({ getUnconfirmedBalance: jest.fn() });
    useBalanceData.mockReturnValue(mockBalance);
    useTransactionHistoryFetch.mockReturnValue(mockHistory);
    useVaultDataFetch.mockReturnValue(mockVault);
    usePolling.mockImplementation(() => {});
  });

  describe('useWalletData', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletData());
      }).toThrow('useWalletData must be used within a WalletDataProvider');

      consoleError.mockRestore();
    });

    it('should return context value when used inside provider', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useWalletData(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.balance).toBe(mockBalance);
      expect(result.current.history).toBe(mockHistory);
      expect(result.current.vault).toBe(mockVault);
    });
  });

  describe('Backwards compatibility hooks', () => {
    it('should provide useBalance hook', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useBalance(), { wrapper });

      expect(result.current).toBe(mockBalance);
    });

    it('should provide useTransactionHistory hook', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useTransactionHistory(), { wrapper });

      expect(result.current).toBe(mockHistory);
    });

    it('should provide useVaultData hook', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useVaultData(), { wrapper });

      expect(result.current).toBe(mockVault);
    });
  });

  describe('WalletDataProvider', () => {
    it('should render provider', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useWalletData(), { wrapper });

      expect(result.current).toBeDefined();
    });

    it('should call useBalanceData with wallet and getUnconfirmedBalance', () => {
      const mockGetUnconfirmed = jest.fn();
      usePendingTransactions.mockReturnValue({ getUnconfirmedBalance: mockGetUnconfirmed });

      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      expect(useBalanceData).toHaveBeenCalledWith(mockWallet, mockGetUnconfirmed);
    });

    it('should call useTransactionHistoryFetch with wallet', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      expect(useTransactionHistoryFetch).toHaveBeenCalledWith(mockWallet);
    });

    it('should call useVaultDataFetch with wallet', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      expect(useVaultDataFetch).toHaveBeenCalledWith(mockWallet);
    });

    it('should set up polling with correct parameters', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      expect(usePolling).toHaveBeenCalledWith({
        onPoll: expect.any(Function),
        interval: 10000,
        enabled: true,
        immediate: true,
      });
    });

    it('should disable polling when wallet is null', () => {
      useWallet.mockReturnValue({ wallet: null });

      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      expect(usePolling).toHaveBeenCalledWith({
        onPoll: expect.any(Function),
        interval: 10000,
        enabled: false,
        immediate: true,
      });
    });

    it('should fetch balance and vault on poll', () => {
      let pollCallback;
      usePolling.mockImplementation(({ onPoll }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      act(() => {
        pollCallback();
      });

      expect(mockBalance.fetchBalance).toHaveBeenCalled();
      expect(mockVault.fetchVault).toHaveBeenCalled();
    });

    it('should fetch transaction history on every poll', () => {
      jest.useFakeTimers();
      let pollCallback;
      usePolling.mockImplementation(({ onPoll }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

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
      useWallet.mockReturnValue({ wallet: null });
      let pollCallback;
      usePolling.mockImplementation(({ onPoll }) => {
        pollCallback = onPoll;
      });

      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      renderHook(() => useWalletData(), { wrapper });

      act(() => {
        pollCallback();
      });

      expect(mockBalance.fetchBalance).not.toHaveBeenCalled();
      expect(mockVault.fetchVault).not.toHaveBeenCalled();
    });

    it('should reset data when wallet is removed', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useWalletData(), { wrapper });

      // Change wallet to null
      useWallet.mockReturnValue({ wallet: null });

      act(() => {
        rerender();
      });

      expect(mockBalance.resetBalances).toHaveBeenCalled();
      expect(mockHistory.resetTransactionHistory).toHaveBeenCalled();
      expect(mockVault.resetVaultData).toHaveBeenCalled();
    });

    it('should fetch balance and vault when wallet account changes', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useWalletData(), { wrapper });

      jest.clearAllMocks();

      // Change to different wallet
      const newWallet = {
        segwitAddress: 'bc1qnew',
        taprootAddress: 'bc1pnew',
        taprootPubkey: 'newpubkey',
      };
      useWallet.mockReturnValue({ wallet: newWallet });

      act(() => {
        rerender();
      });

      expect(mockBalance.fetchBalance).toHaveBeenCalled();
      expect(mockVault.fetchVault).toHaveBeenCalled();
      // Transaction history is not fetched immediately - it will be fetched by pollAllData once balances load
      expect(mockHistory.fetchTransactionHistory).not.toHaveBeenCalled();
    });

    it('should not fetch when wallet object changes but addresses are same', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { rerender } = renderHook(() => useWalletData(), { wrapper });

      jest.clearAllMocks();

      // Same addresses, different object
      const sameWallet = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
        taprootPubkey: 'pubkeytest',
      };
      useWallet.mockReturnValue({ wallet: sameWallet });

      act(() => {
        rerender();
      });

      expect(mockBalance.fetchBalance).not.toHaveBeenCalled();
      expect(mockVault.fetchVault).not.toHaveBeenCalled();
      expect(mockHistory.fetchTransactionHistory).not.toHaveBeenCalled();
    });

    it('should expose all balance properties', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useWalletData(), { wrapper });

      expect(result.current.segwitBalance).toBe(mockBalance.segwitBalance);
      expect(result.current.taprootBalance).toBe(mockBalance.taprootBalance);
      expect(result.current.runesBalance).toBe(mockBalance.runesBalance);
      expect(result.current.loadingBalance).toBe(mockBalance.loadingBalance);
      expect(result.current.fetchBalance).toBe(mockBalance.fetchBalance);
    });

    it('should expose all history properties', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useWalletData(), { wrapper });

      expect(result.current.transactionHistory).toBe(mockHistory.transactionHistory);
      expect(result.current.loadingTransactionHistory).toBe(mockHistory.loadingTransactionHistory);
      expect(result.current.fetchTransactionHistory).toBe(mockHistory.fetchTransactionHistory);
    });

    it('should expose all vault properties', () => {
      const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
      const { result } = renderHook(() => useWalletData(), { wrapper });

      expect(result.current.vaultData).toBe(mockVault.vaultData);
      expect(result.current.loadingVault).toBe(mockVault.loadingVault);
      expect(result.current.fetchVault).toBe(mockVault.fetchVault);
    });
  });
});
