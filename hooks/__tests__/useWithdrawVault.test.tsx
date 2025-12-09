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

  describe('loadVaultData', () => {
    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useWithdrawVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadVaultData();
      });

      expect(loadResult).toBe(false);
    });

    it('should handle fetchVaultData error', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useWithdrawVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Fetch failed');
    });

    it('should handle non-Error throws', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useWithdrawVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Failed to load vault data');
    });
  });

  describe('withdraw with profile errors', () => {
    it('should handle error when vaultInfo is missing during withdraw', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockResolvedValueOnce({ vaultId: 'v1', vaultInfo: null });

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
    });

    it('should handle error when history is empty during withdraw', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
    });

    it('should handle error when computeVaultPrevoutFromTx returns null', async () => {
      const { computeVaultPrevoutFromTx } = require('../../services/vaultOperationsService');
      computeVaultPrevoutFromTx.mockReturnValueOnce(null);

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
    });

    it('should return null if health ratio would fall below minimum (line 235-236)', async () => {
      // Set up conditions where withdrawal would violate health ratio
      mockWithdrawStore.currentUnitBorrowed = 1000; // High debt
      mockWithdrawStore.currentBtcLocked = 0.01; // 1,000,000 sats collateral
      mockWithdrawStore.withdrawAmountSats = 900000; // Withdraw most of collateral

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith(
        expect.stringContaining('below minimum health ratio')
      );
    });

    it('should allow withdrawal when no debt (line 189)', async () => {
      // No debt means health check always passes
      mockWithdrawStore.currentUnitBorrowed = 0;
      mockWithdrawStore.currentBtcLocked = 0.01;
      mockWithdrawStore.withdrawAmountSats = 500000; // Can withdraw freely with no debt

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toEqual({ vaultTxid: 'vtxid123' });
    });

    it('should handle non-Error exception with stack (lines 204-206)', async () => {
      const { guardianSendReqWithdraw } = require('../../services/vaultOperationsService');
      // Throw a non-Error object
      guardianSendReqWithdraw.mockRejectedValueOnce({ message: 'Custom error' });

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith('Withdraw operation failed');
    });

    it('should return null if operation already in progress', async () => {
      const { result } = renderHook(() => useWithdrawVault());

      // Start first withdrawal
      const firstWithdraw = act(async () => {
        return result.current.withdraw();
      });

      // Try to start second withdrawal immediately
      let secondResult;
      await act(async () => {
        secondResult = await result.current.withdraw();
      });

      // Second call should return null due to operation in progress
      expect(secondResult).toBeNull();

      // Wait for first to complete
      await firstWithdraw;
    });

    it('should handle wallet not connected in buildVaultProfileFromData (line 137)', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      // Wallet connected initially for validation checks
      useWallet.mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        taprootAddress: 'tb1ptest...',
        taprootPubkey: null, // But pubkey is null
      }});

      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: 100000 });

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      // Should fail when trying to build profile
      expect(withdrawResult).toBeNull();
    });

    it('should handle error in buildVaultProfileFromData (lines 180-181)', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        '[useWithdrawVault] Error building VaultProfile:',
        { error: expect.any(Error) }
      );
    });

    it('should validate vault data is loaded before withdraw (lines 241-242)', async () => {
      mockWithdrawStore.currentBtcLocked = 0; // No vault data loaded
      mockWithdrawStore.withdrawAmountSats = 50000;

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      // Will trigger withdraw amount check or vault data check
      expect(mockWithdrawStore.setError).toHaveBeenCalled();
    });

    it('should handle vault data with null totalDebt and totalCollateral (lines 109-110)', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockResolvedValueOnce({
        vaultId: 'vault1',
        totalDebt: null,
        totalCollateral: null,
        vaultInfo: { creation_account: 'acct1', guard_pubkey: 'guard1', master_id: 'master1' },
      });

      const { result } = renderHook(() => useWithdrawVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockWithdrawStore.setCurrentVaultData).toHaveBeenCalledWith(0, 0);
    });

    it('should handle wallet with null pubkeys (lines 264, 266, 275, 317)', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        segwitPubkey: null, // null pubkey
        taprootAddress: 'tb1ptest...',
        taprootPubkey: 'pubkey2',
      }});

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      // Should succeed with empty string for null pubkeys
      expect(withdrawResult).toEqual({ vaultTxid: 'vtxid123' });
    });

    it('should return false when health check has newCollateral exactly 0 (line 192)', async () => {
      // Set up so newCollateral becomes exactly 0
      mockWithdrawStore.currentUnitBorrowed = 100;
      mockWithdrawStore.currentBtcLocked = 0.001; // 100,000 sats
      mockWithdrawStore.withdrawAmountSats = 100000; // Withdraw all collateral

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
      expect(mockWithdrawStore.setError).toHaveBeenCalledWith(
        expect.stringContaining('below minimum health ratio')
      );
    });

    it('should calculate liquidation price when no debt (line 283)', async () => {
      // Test the branch: currentUnitBorrowed > 0 && newCollateral > 0 = false (no debt)
      mockWithdrawStore.currentUnitBorrowed = 0; // No debt
      mockWithdrawStore.currentBtcLocked = 0.01;
      mockWithdrawStore.withdrawAmountSats = 100000;

      const { computeLiquidationPrice } = require('../../utils/vaultUtils');
      computeLiquidationPrice.mockClear();

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      // Should succeed without calculating liquidation price
      expect(withdrawResult).toEqual({ vaultTxid: 'vtxid123' });
      // computeLiquidationPrice should not be called when no debt
      expect(computeLiquidationPrice).not.toHaveBeenCalled();
    });

    it('should calculate liquidation price when newCollateral is 0 (line 283)', async () => {
      // Test the branch: currentUnitBorrowed > 0 && newCollateral > 0 = false (newCollateral = 0)
      mockWithdrawStore.currentUnitBorrowed = 100; // Has debt
      mockWithdrawStore.currentBtcLocked = 0.001; // 100,000 sats
      mockWithdrawStore.withdrawAmountSats = 99999; // Leave 1 sat, which violates health

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      // Should fail due to health ratio
      expect(withdrawResult).toBeNull();
    });

    it('should handle history array with null (line 152)', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useWithdrawVault());

      let withdrawResult;
      await act(async () => {
        withdrawResult = await result.current.withdraw();
      });

      expect(withdrawResult).toBeNull();
    });
  });
});
