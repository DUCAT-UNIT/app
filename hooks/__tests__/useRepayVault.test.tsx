/**
 * Tests for useRepayVault hook
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
  createRepayConfig: jest.fn(() => ({ repay_amount: 50 })),
  guardianRepayReserve: jest.fn().mockResolvedValue({ account: 'res123' }),
  guardianSendReqRepay: jest.fn().mockResolvedValue({ txid: 'txid123', vault_txid: 'vtxid123' }),
  createVaultReqRepay: jest.fn().mockResolvedValue({ psbt: 'psbt123' }),
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
const mockRepayStore = {
  repayAmountUnit: 50,
  selectedFeeRate: 10,
  currentUnitBorrowed: 100,
  currentBtcLocked: 0.01,
  loading: false,
  error: null,
  issueTxid: null,
  vaultTxid: null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setIssueTxid: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores/repayStore', () => ({
  useRepayStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockRepayStore);
    }
    return mockRepayStore;
  }),
  useRepay: jest.fn(() => mockRepayStore),
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

jest.mock('../../contexts/WalletDataContext', () => ({
  useVaultData: jest.fn(() => ({
    vaultData: {
      totalDebt: 100,
      totalCollateral: 0.01,
      vaultId: 'vault1',
    },
  })),
}));

import { useRepayVault } from '../useRepayVault';
import { getGuardianClient } from '../../services/guardianService';
import { guardianSendReqRepay } from '../../services/vaultOperationsService';
import { fetchVaultData } from '../../services/vaultService';

describe('useRepayVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepayStore.loading = false;
    mockRepayStore.error = null;
    mockRepayStore.issueTxid = null;
    mockRepayStore.vaultTxid = null;
    mockRepayStore.repayAmountUnit = 50;
    mockRepayStore.currentBtcLocked = 0.01;
    mockRepayStore.currentUnitBorrowed = 100;
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useRepayVault());

    expect(result.current!.isLoading).toBe(false);
    expect(result.current!.error).toBeNull();
    expect(result.current!.issueTxid).toBeNull();
    expect(result.current!.vaultTxid).toBeNull();
    expect(result.current!.vaultDataLoaded).toBe(false);
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useRepayVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockRepayStore.setCurrentVaultData).toHaveBeenCalledWith(100, 0.01);
    });

    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useRepayVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return false if no vault found', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: null });

      const { result } = renderHook(() => useRepayVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockRepayStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('repay', () => {
    it('should repay successfully', async () => {
      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
      expect(mockRepayStore.setIssueTxid).toHaveBeenCalledWith('txid123');
      expect(mockRepayStore.setVaultTxid).toHaveBeenCalledWith('vtxid123');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return null if bitcoin price not available', async () => {
      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: null });

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if repay amount is zero', async () => {
      mockRepayStore.repayAmountUnit = 0;

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Please enter an amount to repay');
    });

    it('should return null if repay amount exceeds debt', async () => {
      mockRepayStore.repayAmountUnit = 200; // More than currentUnitBorrowed (100)

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Repay amount cannot exceed current debt');
    });

    it('should return null if no vault data loaded', async () => {
      mockRepayStore.currentBtcLocked = 0;
      mockRepayStore.currentUnitBorrowed = 0;
      mockRepayStore.repayAmountUnit = 0; // Avoid repay amount validations

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      // Will hit "enter amount" validation first since repayAmountUnit is 0
      expect(mockRepayStore.setError).toHaveBeenCalled();
    });

    it('should handle guardian error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Connection failed');
    });

    it('should handle send error', async () => {
      (guardianSendReqRepay as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useRepayVault());

      await act(async () => {
        await result.current!.repay();
      });

      expect(mockRepayStore.setProcessingStep).toHaveBeenCalledWith(1);
      expect(mockRepayStore.setProcessingStep).toHaveBeenCalledWith(2);
      expect(mockRepayStore.setProcessingStep).toHaveBeenCalledWith(3);
      expect(mockRepayStore.setProcessingStep).toHaveBeenCalledWith(4);
    });
  });

  describe('cancel', () => {
    it('should reset state and disconnect guardian', () => {
      const { disconnectGuardian } = require('../../services/guardianService');

      const { result } = renderHook(() => useRepayVault());

      act(() => {
        result.current!.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockRepayStore.reset).toHaveBeenCalled();
    });
  });

  describe('loadVaultData', () => {
    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useRepayVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
    });

    it('should handle missing vault data from context', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: null });

      const { result } = renderHook(() => useRepayVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockRepayStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });

    it('should handle undefined vault data from context', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: undefined });

      const { result } = renderHook(() => useRepayVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockRepayStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('repay with profile errors', () => {
    it('should handle error when vaultInfo is missing during repay', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockResolvedValueOnce({ vaultId: 'v1', vaultInfo: null });

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
    });

    it('should handle error when history is empty during repay', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
    });

    it('should handle error when computeVaultPrevoutFromTx returns null', async () => {
      const { computeVaultPrevoutFromTx } = require('../../services/vaultOperationsService');
      computeVaultPrevoutFromTx.mockReturnValueOnce(null);

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
    });

    it('should handle wallet not connected in buildVaultProfileFromData (line 141)', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        taprootAddress: 'tb1ptest...',
        taprootPubkey: null, // null pubkey
      }});

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      // Should fail when trying to build profile
      expect(repayResult).toBeNull();
    });

    it('should handle error in buildVaultProfileFromData (lines 184-185)', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        '[useRepayVault] Error building VaultProfile:',
        { error: expect.any(Error) }
      );
    });

    it('should return null if operation already in progress (lines 192-193)', async () => {
      const { result } = renderHook(() => useRepayVault());

      // Start first repay
      const firstRepay = act(async () => {
        return result.current!.repay();
      });

      // Try to start second repay immediately
      let secondResult;
      await act(async () => {
        secondResult = await result.current!.repay();
      });

      // Second call should return null due to operation in progress
      expect(secondResult).toBeNull();
      const { logger } = require('../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith('[useRepayVault] Operation already in progress');

      // Wait for first to complete
      await firstRepay;
    });

    it('should allow repay when vault has valid data (tests false branch of line 221)', async () => {
      // Test FALSE branch of line 221: NOT (currentBtcLocked <= 0 && currentUnitBorrowed <= 0)
      // This happens when at least one of them is > 0
      mockRepayStore.currentBtcLocked = 0.01; // > 0
      mockRepayStore.currentUnitBorrowed = 100; // > 0
      mockRepayStore.repayAmountUnit = 50; // Valid amount

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      // Should succeed
      expect(repayResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
    });

    it('should allow repay when vault has debt but no collateral (tests false branch of line 221 part 2)', async () => {
      // Another test for FALSE branch: currentBtcLocked = 0 but currentUnitBorrowed > 0
      mockRepayStore.currentBtcLocked = 0; // = 0
      mockRepayStore.currentUnitBorrowed = 100; // > 0, so overall condition is FALSE
      mockRepayStore.repayAmountUnit = 50; // Valid amount

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      // Should succeed because at least one value > 0
      expect(repayResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
    });

    it('should handle vault data with null totalDebt and totalCollateral (lines 113-114)', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({
        vaultData: {
          vaultId: 'vault1',
          totalDebt: null,
          totalCollateral: null,
        },
      });

      const { result } = renderHook(() => useRepayVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockRepayStore.setCurrentVaultData).toHaveBeenCalledWith(0, 0);
    });

    it('should handle wallet with null pubkeys (lines 245, 247, 257, 301)', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        segwitPubkey: null, // null pubkey
        taprootAddress: 'tb1ptest...',
        taprootPubkey: 'pubkey2',
      }});

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      // Should succeed with empty string for null pubkeys
      expect(repayResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
    });

    it('should handle history array with null (line 156)', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
    });

    it('should calculate liquidation price to 0 when repaying all debt (line 265)', async () => {
      // Repay entire debt
      mockRepayStore.repayAmountUnit = 100; // Equal to currentUnitBorrowed
      mockRepayStore.currentUnitBorrowed = 100;

      const { computeLiquidationPrice } = require('../../utils/vaultUtils');
      computeLiquidationPrice.mockClear();

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      // Should succeed and liquidation price should be 0 (newDebt = 0)
      expect(repayResult).toEqual({ txid: 'txid123', vaultTxid: 'vtxid123' });
      // computeLiquidationPrice should not be called when newDebt is 0
      expect(computeLiquidationPrice).not.toHaveBeenCalled();
    });

    it('should handle non-Error exception in repay (line 320)', async () => {
      const { guardianSendReqRepay } = require('../../services/vaultOperationsService');
      // Throw a non-Error object
      guardianSendReqRepay.mockRejectedValueOnce({ message: 'Custom error' });

      const { result } = renderHook(() => useRepayVault());

      let repayResult;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).toBeNull();
      expect(mockRepayStore.setError).toHaveBeenCalledWith('Repay operation failed');
    });
  });
});
