// @ts-nocheck
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
  useDepositStore: jest.fn(() => mockDepositStore),
  useDeposit: jest.fn(() => mockDepositStore),
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

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.vaultTxid).toBeNull();
    expect(result.current.vaultDataLoaded).toBe(false);
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(true);
      expect(mockDepositStore.setCurrentVaultData).toHaveBeenCalledWith(100, 0.01);
    });

    it('should return false if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
      });

      expect(success).toBe(false);
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return false if no vault found', async () => {
      (fetchVaultData as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useDepositVault());

      let success;
      await act(async () => {
        success = await result.current.loadVaultData();
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
        depositResult = await result.current.deposit();
      });

      expect(depositResult).toEqual({ vaultTxid: 'vtxid123' });
      expect(mockDepositStore.setVaultTxid).toHaveBeenCalledWith('vtxid123');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current.deposit();
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
        depositResult = await result.current.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if deposit amount is zero', async () => {
      mockDepositStore.depositAmountSats = 0;

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current.deposit();
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
        depositResult = await result.current.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('No vault data. Please load vault data first.');
    });

    it('should handle guardian error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Connection failed');
    });

    it('should handle send error', async () => {
      (guardianSendReqDeposit as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useDepositVault());

      let depositResult;
      await act(async () => {
        depositResult = await result.current.deposit();
      });

      expect(depositResult).toBeNull();
      expect(mockDepositStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useDepositVault());

      await act(async () => {
        await result.current.deposit();
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
        result.current.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockDepositStore.reset).toHaveBeenCalled();
    });
  });
});
