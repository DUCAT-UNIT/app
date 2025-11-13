/**
 * Tests for WalletDataContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import {
  WalletDataProvider,
  useWalletData,
  useBalance,
  useTransactionHistory,
  useVaultData,
} from '../WalletDataContext';
import { useWallet } from '../WalletContext';
import { usePendingTransactions } from '../PendingTransactionsContext';
import * as BalanceService from '../../services/balanceService';
import * as TransactionHistoryService from '../../services/transactionHistoryService';
import * as VaultService from '../../services/vaultService';

// Mock dependencies
jest.mock('../WalletContext');
jest.mock('../PendingTransactionsContext');
jest.mock('../../services/balanceService');
jest.mock('../../services/transactionHistoryService');
jest.mock('../../services/vaultService');
jest.mock('../../hooks/usePolling', () => ({
  usePolling: jest.fn(({ onPoll }) => {
    // Just return empty functions, don't auto-start polling
    return { startPolling: jest.fn(), stopPolling: jest.fn() };
  }),
}));

// Helper to render hooks
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });
  return { result, rerender: component.update, unmount: component.unmount };
}

describe('WalletDataContext', () => {
  const mockWallet = {
    segwitAddress: 'tb1qtest',
    taprootAddress: 'tb1ptest',
    taprootPubkey: 'test_pubkey',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useWallet.mockReturnValue({ wallet: mockWallet });
    usePendingTransactions.mockReturnValue({
      getUnconfirmedBalance: jest.fn().mockReturnValue({ btc: 0.001, runes: 50 }),
    });

    BalanceService.fetchWalletBalances.mockResolvedValue({
      segwitBalance: 0.5,
      taprootBalance: 0.25,
      runesBalance: [{ name: 'TEST', amount: 100 }],
    });

    TransactionHistoryService.fetchAllTransactionHistory.mockResolvedValue([
      { txid: 'tx1', type: 'receive', amount: 0.1 },
    ]);

    VaultService.fetchVaultData.mockResolvedValue({
      balance: 1.0,
      transactions: [],
    });

    BalanceService.fetchUtxos.mockResolvedValue([
      { txid: 'utxo1', vout: 0, value: 10000 },
    ]);
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useWalletData());
    }).toThrow('useWalletData must be used within a WalletDataProvider');
    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.loadingBalance).toBe(false);
    expect(result.current.transactionHistory).toEqual([]);
    expect(result.current.vaultData).toBeNull();
  });

  it('should provide backwards compatible balance hook', () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useBalance(), { wrapper });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(typeof result.current.fetchBalance).toBe('function');
  });

  it('should provide backwards compatible history hook', () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useTransactionHistory(), { wrapper });

    expect(result.current.transactionHistory).toEqual([]);
    expect(typeof result.current.fetchTransactionHistory).toBe('function');
  });

  it('should provide backwards compatible vault hook', () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useVaultData(), { wrapper });

    expect(result.current.vaultData).toBeNull();
    expect(typeof result.current.fetchVault).toBe('function');
  });

  it('should fetch balance successfully', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(BalanceService.fetchWalletBalances).toHaveBeenCalledWith(
      mockWallet.segwitAddress,
      mockWallet.taprootAddress
    );
    expect(result.current.segwitBalance).toBe(0.5);
    expect(result.current.taprootBalance).toBe(0.25);
    expect(result.current.runesBalance).toEqual([{ name: 'TEST', amount: 100 }]);
    expect(result.current.loadingBalance).toBe(false);
  });

  it('should fetch balance with provided addresses', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchBalance('custom_segwit', 'custom_taproot');
    });

    expect(BalanceService.fetchWalletBalances).toHaveBeenCalledWith(
      'custom_segwit',
      'custom_taproot'
    );
  });

  it('should handle balance fetch error', async () => {
    BalanceService.fetchWalletBalances.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.balanceError).toBe('Failed to fetch balance. Tap to retry.');
    expect(result.current.loadingBalance).toBe(false);
  });

  it('should not fetch balance when wallet addresses are missing', async () => {
    useWallet.mockReturnValue({ wallet: null });

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(BalanceService.fetchWalletBalances).not.toHaveBeenCalled();
  });

  it('should refresh balances', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(BalanceService.fetchWalletBalances).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('should fetch UTXOs', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    let fetchedUtxos;
    await act(async () => {
      fetchedUtxos = await result.current.fetchUtxos('tb1qtest');
    });

    expect(BalanceService.fetchUtxos).toHaveBeenCalledWith('tb1qtest');
    expect(result.current.utxos).toEqual([{ txid: 'utxo1', vout: 0, value: 10000 }]);
    expect(fetchedUtxos).toEqual([{ txid: 'utxo1', vout: 0, value: 10000 }]);
  });

  it('should handle UTXO fetch error', async () => {
    BalanceService.fetchUtxos.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await expect(act(async () => {
      await result.current.fetchUtxos('tb1qtest');
    })).rejects.toThrow('Network error');

    expect(result.current.loadingUtxos).toBe(false);
  });

  it('should reset balances', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    // First fetch some balances
    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.segwitBalance).toBe(0.5);
    expect(result.current.taprootBalance).toBe(0.25);

    // Then reset
    act(() => {
      result.current.resetBalances();
    });

    expect(result.current.segwitBalance).toBe(0);
    expect(result.current.taprootBalance).toBe(0);
    expect(result.current.runesBalance).toEqual([]);
    expect(result.current.utxos).toEqual([]);
  });

  it('should fetch transaction history', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(TransactionHistoryService.fetchAllTransactionHistory).toHaveBeenCalledWith(
      mockWallet.segwitAddress,
      mockWallet.taprootAddress,
      mockWallet.taprootPubkey
    );
    expect(result.current.transactionHistory).toEqual([
      { txid: 'tx1', type: 'receive', amount: 0.1 },
    ]);
  });

  it('should handle transaction history fetch error', async () => {
    TransactionHistoryService.fetchAllTransactionHistory.mockRejectedValue(
      new Error('Network error')
    );

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.historyError).toBe('Failed to fetch transaction history');
  });

  it('should not fetch history when wallet data is missing', async () => {
    useWallet.mockReturnValue({ wallet: { segwitAddress: 'tb1qtest' } }); // Missing taproot

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(TransactionHistoryService.fetchAllTransactionHistory).not.toHaveBeenCalled();
  });

  it('should reset transaction history', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    // First fetch some history
    await act(async () => {
      await result.current.fetchTransactionHistory();
    });

    expect(result.current.transactionHistory).toHaveLength(1);

    // Then reset
    act(() => {
      result.current.resetTransactionHistory();
    });

    expect(result.current.transactionHistory).toEqual([]);
  });

  it('should fetch vault data', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(VaultService.fetchVaultData).toHaveBeenCalledWith(mockWallet.taprootPubkey);
    expect(result.current.vaultData).toEqual({ balance: 1.0, transactions: [] });
  });

  it('should handle vault fetch error', async () => {
    VaultService.fetchVaultData.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(result.current.vaultError).toBe('Failed to fetch vault data');
  });

  it('should not fetch vault when pubkey is missing', async () => {
    useWallet.mockReturnValue({
      wallet: {
        segwitAddress: 'tb1qtest',
        taprootAddress: 'tb1ptest',
      },
    });

    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchVault();
    });

    expect(VaultService.fetchVaultData).not.toHaveBeenCalled();
  });

  it('should reset vault data', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    // First fetch vault data
    await act(async () => {
      await result.current.fetchVault();
    });

    expect(result.current.vaultData).toEqual({ balance: 1.0, transactions: [] });

    // Then reset
    act(() => {
      result.current.resetVaultData();
    });

    expect(result.current.vaultData).toBeNull();
  });

  it('should track unconfirmed balances', async () => {
    const wrapper = ({ children }) => <WalletDataProvider>{children}</WalletDataProvider>;
    const { result } = renderHook(() => useWalletData(), { wrapper });

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.unconfirmedSegwitBalance).toBe(0.001);
    expect(result.current.unconfirmedTaprootBalance).toBe(0.001);
    expect(result.current.unconfirmedRunesBalance).toBe(50);
  });
});
