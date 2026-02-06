/**
 * Tests for useDepositVault hook
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
  createDepositConfig: jest.fn(() => ({ deposit_amount: 10000 })),
  guardianSendReqDeposit: jest.fn().mockResolvedValue({ vault_txid: 'vtxid123' }),
  createVaultReqDeposit: jest.fn().mockResolvedValue({ psbt: 'psbt123' }),
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
const mockDepositStore = {
  depositAmountSats: 50000,
  selectedFeeRate: 10,
  currentUnitBorrowed: 100,
  currentBtcLocked: 0.01,
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

jest.mock('../../stores/depositStore', () => ({
  useDepositStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockDepositStore);
    }
    return mockDepositStore;
  }),
  useDeposit: jest.fn(() => mockDepositStore),
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

import { useDepositVault } from '../useDepositVault';
import { getGuardianClient } from '../../services/guardianService';
import { guardianSendReqDeposit } from '../../services/vaultOperationsService';
import { fetchVaultData } from '../../services/vaultService';

describe('useDepositVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDepositStore.loading = false;
    mockDepositStore.error = null;
    mockDepositStore.vaultTxid = null;
    mockDepositStore.depositAmountSats = 50000;
    mockDepositStore.currentBtcLocked = 0.01;
    mockDepositStore.currentUnitBorrowed = 100;
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useDepositVault());

    expect(result.current!.isLoading).toBe(false);
    expect(result.current!.error).toBeNull();
    expect(result.current!.vaultTxid).toBeNull();
    expect(result.current!.vaultDataLoaded).toBe(false);
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockDepositStore.setCurrentVaultData).toHaveBeenCalledWith(100, 0.01);
    });

    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return false if no vault found', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: null });

      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockDepositStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('deposit', () => {
    it('should deposit successfully', async () => {
      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toEqual({ vaultTxid: 'vtxid123' });
      expect(mockDepositStore.setVaultTxid).toHaveBeenCalledWith('vtxid123');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return null if bitcoin price not available', async () => {
      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: null });

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if deposit amount is zero', async () => {
      mockDepositStore.depositAmountSats = 0;

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Please enter an amount to deposit');
    });

    it('should return null if no vault data loaded', async () => {
      mockDepositStore.currentBtcLocked = 0;
      mockDepositStore.currentUnitBorrowed = 0;

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('No vault data. Please load vault data first.');
    });

    it('should handle guardian error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Connection failed');
    });

    it('should handle send error', async () => {
      (guardianSendReqDeposit as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useDepositVault());

      await act(async () => {
        await result.current!.deposit();
      });

      expect(mockDepositStore.setProcessingStep).toHaveBeenCalledWith(1);
      expect(mockDepositStore.setProcessingStep).toHaveBeenCalledWith(2);
      expect(mockDepositStore.setProcessingStep).toHaveBeenCalledWith(3);
      expect(mockDepositStore.setProcessingStep).toHaveBeenCalledWith(4);
    });
  });

  describe('cancel', () => {
    it('should reset state and disconnect guardian', () => {
      const { disconnectGuardian } = require('../../services/guardianService');

      const { result } = renderHook(() => useDepositVault());

      act(() => {
        result.current!.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockDepositStore.reset).toHaveBeenCalled();
    });
  });

  describe('loadVaultData', () => {
    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useDepositVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
    });

    it('should handle missing vault data from context', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: null });

      const { result } = renderHook(() => useDepositVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockDepositStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });

    it('should handle undefined vault data from context', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({ vaultData: undefined });

      const { result } = renderHook(() => useDepositVault());

      let loadResult;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(false);
      expect(mockDepositStore.setError).toHaveBeenCalledWith('No vault found. Please create a vault first.');
    });
  });

  describe('deposit with profile errors', () => {
    it('should handle error when vaultInfo is missing during deposit', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockResolvedValueOnce({ vaultId: 'v1', vaultInfo: null });

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
    });

    it('should handle error when history is empty during deposit', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
    });

    it('should handle error when computeVaultPrevoutFromTx returns null', async () => {
      const { computeVaultPrevoutFromTx } = require('../../services/vaultOperationsService');
      computeVaultPrevoutFromTx.mockReturnValueOnce(null);

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
    });

    it('should handle wallet not connected in buildVaultProfileFromData (line 136)', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        taprootAddress: 'tb1ptest...',
        taprootPubkey: null, // null pubkey
      }});

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      // Should fail when trying to build profile
      expect(depositResult).toBeNull();
    });

    it('should handle error in buildVaultProfileFromData (lines 179-180)', async () => {
      const { fetchVaultData } = require('../../services/vaultService');
      fetchVaultData.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      const { logger } = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        '[useDepositVault] Error building VaultProfile:',
        { error: expect.any(Error) }
      );
    });

    it('should return null if operation already in progress (lines 187-188)', async () => {
      const { result } = renderHook(() => useDepositVault());

      // Start first deposit
      const firstDeposit = act(async () => {
        return result.current!.deposit();
      });

      // Try to start second deposit immediately
      let secondResult;
      await act(async () => {
        secondResult = await result.current!.deposit();
      });

      // Second call should return null due to operation in progress
      expect(secondResult).toBeNull();
      const { logger } = require('../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith('[useDepositVault] Operation already in progress');

      // Wait for first to complete
      await firstDeposit;
    });

    it('should handle history array with null', async () => {
      const { fetchVaultHistory } = require('../../services/vaultService');
      fetchVaultHistory.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
    });

    it('should handle wallet with null pubkeys', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      (useWallet as jest.Mock).mockReturnValueOnce({ wallet: {
        segwitAddress: 'tb1qtest...',
        segwitPubkey: null, // null pubkey
        taprootAddress: 'tb1ptest...',
        taprootPubkey: 'pubkey2',
      }});

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      // Should succeed with empty string for null pubkeys
      expect(depositResult).toEqual({ vaultTxid: 'vtxid123' });
    });

    it('should handle non-Error exception', async () => {
      const { guardianSendReqDeposit } = require('../../services/vaultOperationsService');
      // Throw a non-Error object
      guardianSendReqDeposit.mockRejectedValueOnce({ message: 'Custom error' });

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Deposit operation failed');
    });

    it('should handle vault data with null totalDebt and totalCollateral (lines 108-109)', async () => {
      const { useVaultData } = require('../../contexts/WalletDataContext');
      useVaultData.mockReturnValueOnce({
        vaultData: {
          vaultId: 'vault1',
          totalDebt: null,
          totalCollateral: null,
        },
      });

      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current!.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockDepositStore.setCurrentVaultData).toHaveBeenCalledWith(0, 0);
    });
  });
});
