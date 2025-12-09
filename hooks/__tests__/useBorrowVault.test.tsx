// @ts-nocheck
/**
 * Tests for useBorrowVault hook
 */

import { renderHook, act } from '@testing-library/react-native';

// Mock all dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/vaultUtils', () => ({
  computeLiquidationPrice: jest.fn(() => 50000),
}));

jest.mock('../../services/guardianService', () => ({
  getGuardianClient: jest.fn().mockResolvedValue({ connected: true }),
  disconnectGuardian: jest.fn(),
}));

jest.mock('../../services/vaultOperationsService', () => ({
  createBorrowConfig: jest.fn(() => ({ borrow_amount: 100 })),
  guardianBorrowReserve: jest.fn().mockResolvedValue({ account: 'res123' }),
  guardianSendReqBorrow: jest.fn().mockResolvedValue({ txid: 'txid123', vault_txid: 'vtxid123' }),
  createVaultReqBorrow: jest.fn().mockResolvedValue({ psbt: 'psbt123' }),
  computeVaultPrevoutFromTx: jest.fn(() => ({ rdata: {}, utxo: {} })),
  buildVaultProfile: jest.fn(() => ({ acct_id: 'acct1', master_id: 'master1' })),
}));

jest.mock('../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({ wallet: true }),
}));

jest.mock('../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ price: 100000 }),
}));

jest.mock('../../services/vaultService', () => ({
  fetchVaultData: jest.fn().mockResolvedValue({
    totalDebt: 100,
    totalCollateral: 0.01,
    vaultId: 'vault1',
    vaultInfo: {
      creation_account: 'acct1',
      guard_pubkey: 'guard1',
      master_id: 'master1',
    },
  }),
  fetchVaultHistory: jest.fn().mockResolvedValue([{
    transaction_id: 'tx1',
    utxo: 'utxo:0',
    utxo_script: 'script',
    amount_borrowed: 100,
    oracle_price: 100000,
    timestamp: Date.now(),
    action: 'Open',
    vault_amount: 10000,
  }]),
}));

// Mock stores
const mockBorrowStore = {
  borrowAmount: 50,
  selectedFeeRate: 10,
  currentUnitBorrowed: 100,
  currentBtcLocked: 0.01,
  loading: false,
  error: null,
  txid: null,
  vaultTxid: null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores/borrowStore', () => ({
  useBorrowStore: jest.fn(() => mockBorrowStore),
  useBorrow: jest.fn(() => mockBorrowStore),
}));

const mockSetPendingTransaction = jest.fn().mockResolvedValue(undefined);
jest.mock('../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: jest.fn((selector) => {
    const state = { setPendingTransaction: mockSetPendingTransaction };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

const mockShowSnackbar = jest.fn();
jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: jest.fn((selector) => {
    const state = { showSnackbar: mockShowSnackbar };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('../../contexts/WalletContext', () => ({
  useWallet: jest.fn(() => ({
    wallet: {
      segwitAddress: 'tb1qtest...',
      segwitPubkey: 'pubkey1',
      taprootAddress: 'tb1ptest...',
      taprootPubkey: 'pubkey2',
    },
  })),
}));

jest.mock('../../stores/priceStore', () => ({
  usePrice: jest.fn(() => ({
    btcPrice: 100000,
  })),
}));

import { useBorrowVault } from '../useBorrowVault';
import { getGuardianClient } from '../../services/guardianService';
import { guardianSendReqBorrow } from '../../services/vaultOperationsService';
import { fetchVaultData } from '../../services/vaultService';

describe('useBorrowVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBorrowStore.loading = false;
    mockBorrowStore.error = null;
    mockBorrowStore.txid = null;
    mockBorrowStore.vaultTxid = null;
    mockBorrowStore.borrowAmount = 50;
    mockBorrowStore.currentBtcLocked = 0.01;
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useBorrowVault());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.txid).toBeNull();
    expect(result.current.vaultTxid).toBeNull();
    expect(result.current.vaultDataLoaded).toBe(false);
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useBorrowVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockBorrowStore.setCurrentVaultData).toHaveBeenCalledWith(100, 0.01);
    });

    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useBorrowVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return false if no vault found', async () => {
      (fetchVaultData as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useBorrowVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('borrowMore', () => {
    it('should borrow successfully', async () => {
      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
      expect(mockBorrowStore.setTxid).toHaveBeenCalledWith('txid123', 'vtxid123');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return null if bitcoin price not available', async () => {
      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: null });

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if borrow amount is zero', async () => {
      mockBorrowStore.borrowAmount = 0;

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Please enter an amount to borrow');
    });

    it('should return null if no vault data loaded', async () => {
      mockBorrowStore.currentBtcLocked = 0;

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('No vault data. Please load vault data first.');
    });

    it('should handle guardian error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Connection failed');
    });

    it('should handle send error', async () => {
      (guardianSendReqBorrow as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useBorrowVault());

      let borrowResult;
      await act(async () => {
        borrowResult = await result.current.borrowMore();
      });

      expect(borrowResult).toBeNull();
      expect(mockBorrowStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useBorrowVault());

      await act(async () => {
        await result.current.borrowMore();
      });

      expect(mockBorrowStore.setProcessingStep).toHaveBeenCalledWith(1);
      expect(mockBorrowStore.setProcessingStep).toHaveBeenCalledWith(2);
      expect(mockBorrowStore.setProcessingStep).toHaveBeenCalledWith(3);
      expect(mockBorrowStore.setProcessingStep).toHaveBeenCalledWith(4);
    });
  });

  describe('cancel', () => {
    it('should reset state and disconnect guardian', () => {
      const { disconnectGuardian } = require('../../services/guardianService');

      const { result } = renderHook(() => useBorrowVault());

      act(() => {
        result.current.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockBorrowStore.reset).toHaveBeenCalled();
    });
  });
});
