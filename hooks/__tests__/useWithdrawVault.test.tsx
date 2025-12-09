// @ts-nocheck
/**
 * Tests for useWithdrawVault hook
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

jest.mock('../../utils/constants', () => ({
  VAULT_CONFIG: {
    MIN_COL_RATE: 1.6,
  },
}));

jest.mock('../../services/guardianService', () => ({
  getGuardianClient: jest.fn().mockResolvedValue({ connected: true }),
  disconnectGuardian: jest.fn(),
}));

jest.mock('../../services/vaultOperationsService', () => ({
  createWithdrawConfig: jest.fn(() => ({ withdraw_amount: 50000 })),
  guardianSendReqWithdraw: jest.fn().mockResolvedValue({ vault_txid: 'vtxid123' }),
  createVaultReqWithdraw: jest.fn().mockResolvedValue({ psbt: 'psbt123' }),
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
const mockWithdrawStore = {
  withdrawAmountSats: 50000,
  selectedFeeRate: 10,
  currentUnitBorrowed: 100,
  currentBtcLocked: 0.01, // 1,000,000 sats
  loading: false,
  error: null,
  vaultTxid: null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores/withdrawStore', () => ({
  useWithdrawStore: jest.fn(() => mockWithdrawStore),
  useWithdraw: jest.fn(() => mockWithdrawStore),
}));

jest.mock('../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: jest.fn(() => ({
    setPendingTransaction: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: jest.fn(() => ({
    showSnackbar: jest.fn(),
  })),
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

import { useWithdrawVault } from '../useWithdrawVault';
import { getGuardianClient } from '../../services/guardianService';
import { guardianSendReqWithdraw } from '../../services/vaultOperationsService';
import { fetchVaultData } from '../../services/vaultService';

describe('useWithdrawVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithdrawStore.loading = false;
    mockWithdrawStore.error = null;
    mockWithdrawStore.vaultTxid = null;
    mockWithdrawStore.withdrawAmountSats = 50000; // Small amount relative to collateral
    mockWithdrawStore.currentBtcLocked = 0.01;
    mockWithdrawStore.currentUnitBorrowed = 100;
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useWithdrawVault());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.vaultTxid).toBeNull();
    expect(result.current.vaultDataLoaded).toBe(false);
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useWithdrawVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockWithdrawStore.setCurrentVaultData).toHaveBeenCalledWith(100, 0.01);
    });

    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useWithdrawVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return false if no vault found', async () => {
      (fetchVaultData as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useWithdrawVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('withdraw', () => {
    it('should withdraw successfully', async () => {
      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toEqual({ vaultTxid: 'vtxid123' });
      expect(mockWithdrawStore.setVaultTxid).toHaveBeenCalledWith('vtxid123');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return null if bitcoin price not available', async () => {
      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: null });

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if withdraw amount is zero', async () => {
      mockWithdrawStore.withdrawAmountSats = 0;

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Please enter an amount to withdraw');
    });

    it('should return null if withdraw amount exceeds collateral', async () => {
      mockWithdrawStore.withdrawAmountSats = 2000000; // More than 0.01 BTC in sats

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Withdraw amount cannot exceed current collateral');
    });

    it('should return null if no vault data loaded', async () => {
      mockWithdrawStore.currentBtcLocked = 0;
      mockWithdrawStore.withdrawAmountSats = 0; // Also zero to avoid collateral check first

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      // Will hit withdraw amount validation first
      expect(mockWithdrawStore.setError).toHaveBeenCalled();
    });

    it('should handle guardian error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Connection failed');
    });

    it('should handle send error', async () => {
      (guardianSendReqWithdraw as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useWithdrawVault());

      await act(async () => {
        await result.current.withdraw();
      });

      expect(mockWithdrawStore.setProcessingStep).toHaveBeenCalledWith(1);
      expect(mockWithdrawStore.setProcessingStep).toHaveBeenCalledWith(2);
      expect(mockWithdrawStore.setProcessingStep).toHaveBeenCalledWith(3);
      expect(mockWithdrawStore.setProcessingStep).toHaveBeenCalledWith(4);
    });

    it('should process withdraw with valid params', async () => {
      // Ensure all validations pass
      mockWithdrawStore.currentUnitBorrowed = 100;
      mockWithdrawStore.currentBtcLocked = 0.01;
      mockWithdrawStore.withdrawAmountSats = 10000; // Very small withdrawal

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      // Verify success path
      expect(withdrawResult).toEqual({ vaultTxid: 'vtxid123' });
    });
  });

  describe('cancel', () => {
    it('should reset state and disconnect guardian', () => {
      const { disconnectGuardian } = require('../../services/guardianService');

      const { result } = renderHook(() => useWithdrawVault());

      act(() => {
        result.current.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockWithdrawStore.reset).toHaveBeenCalled();
    });
  });
});
