// @ts-nocheck
/**
 * Tests for useCreateVault hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

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
  validateVaultParams: jest.fn(() => ({ isValid: true, errors: [] })),
}));

jest.mock('../../services/guardianService', () => ({
  getGuardianClient: jest.fn().mockResolvedValue({ connected: true }),
  disconnectGuardian: jest.fn(),
}));

jest.mock('../../services/vaultOperationsService', () => ({
  createVaultConfig: jest.fn(() => ({ unit_amount: 100, btc_amount: 0.001 })),
  guardianOpenVaultReserve: jest.fn().mockResolvedValue({ account: 'res123' }),
  guardianSendReqOpen: jest.fn().mockResolvedValue('txid123'),
  createVaultReqOpen: jest.fn().mockResolvedValue({ psbt: 'psbt123' }),
}));

jest.mock('../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({ wallet: true }),
}));

// Mock stores
const mockVaultCreationStore = {
  btcAmount: 0.001,
  unitAmount: 100,
  selectedFeeRate: 10,
  loading: false,
  error: null,
  txid: null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores/vaultCreationStore', () => ({
  useVaultCreationStore: jest.fn(() => mockVaultCreationStore),
  useVaultCreation: jest.fn(() => mockVaultCreationStore),
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

jest.mock('../../contexts/WalletDataContext', () => ({
  useBalance: jest.fn(() => ({
    segwitBalance: 0.01,
  })),
}));

jest.mock('../../stores/priceStore', () => ({
  usePrice: jest.fn(() => ({
    btcPrice: 100000,
  })),
}));

import { useCreateVault } from '../useCreateVault';
import { validateVaultParams } from '../../utils/vaultUtils';
import { getGuardianClient } from '../../services/guardianService';
import { guardianSendReqOpen } from '../../services/vaultOperationsService';

describe('useCreateVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    mockVaultCreationStore.loading = false;
    mockVaultCreationStore.error = null;
    mockVaultCreationStore.txid = null;
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useCreateVault());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.txid).toBeNull();
    expect(typeof result.current.createVault).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  describe('createVault', () => {
    it('should create vault successfully', async () => {
      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBe('txid123');
      expect(mockVaultCreationStore.setLoading).toHaveBeenCalledWith(true);
      expect(mockVaultCreationStore.setCurrentStep).toHaveBeenCalledWith('processing');
      expect(mockVaultCreationStore.setTxid).toHaveBeenCalledWith('txid123');
      expect(mockVaultCreationStore.setCurrentStep).toHaveBeenCalledWith('success');
    });

    it('should return null if wallet not connected', async () => {
      const { useWallet } = require('../../contexts/WalletContext');
      useWallet.mockReturnValueOnce({ wallet: null });

      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBeNull();
      expect(mockVaultCreationStore.setError).toHaveBeenCalledWith('Wallet not connected');
    });

    it('should return null if bitcoin price not available', async () => {
      const { usePrice } = require('../../stores/priceStore');
      usePrice.mockReturnValueOnce({ btcPrice: null });

      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBeNull();
      expect(mockVaultCreationStore.setError).toHaveBeenCalledWith('Bitcoin price not available');
    });

    it('should return null if validation fails', async () => {
      (validateVaultParams as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: ['Insufficient BTC balance'],
      });

      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBeNull();
      expect(mockVaultCreationStore.setError).toHaveBeenCalledWith('Insufficient BTC balance');
    });

    it('should handle guardian connection error', async () => {
      (getGuardianClient as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBeNull();
      expect(mockVaultCreationStore.setError).toHaveBeenCalledWith('Connection failed');
      expect(mockVaultCreationStore.setCurrentStep).toHaveBeenCalledWith('confirm');
    });

    it('should handle guardian send error', async () => {
      (guardianSendReqOpen as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useCreateVault());

      let txid;
      await act(async () => {
        txid = await result.current.createVault();
      });

      expect(txid).toBeNull();
      expect(mockVaultCreationStore.setError).toHaveBeenCalledWith('Send failed');
    });

    it('should prevent double execution', async () => {
      // Slow down the guardian response
      (guardianSendReqOpen as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('txid123'), 100))
      );

      const { result } = renderHook(() => useCreateVault());

      // Start first call
      const firstCall = result.current.createVault();

      // Try second call immediately
      const secondCall = await result.current.createVault();

      expect(secondCall).toBeNull();

      // Wait for first call to complete
      await act(async () => {
        await firstCall;
      });
    });

    it('should update processing steps', async () => {
      const { result } = renderHook(() => useCreateVault());

      await act(async () => {
        await result.current.createVault();
      });

      expect(mockVaultCreationStore.setProcessingStep).toHaveBeenCalledWith(1);
      expect(mockVaultCreationStore.setProcessingStep).toHaveBeenCalledWith(2);
      expect(mockVaultCreationStore.setProcessingStep).toHaveBeenCalledWith(3);
      expect(mockVaultCreationStore.setProcessingStep).toHaveBeenCalledWith(4);
    });

    it('should pass isMaxDeposit param', async () => {
      const { createVaultReqOpen } = require('../../services/vaultOperationsService');

      const { result } = renderHook(() => useCreateVault());

      await act(async () => {
        await result.current.createVault({ isMaxDeposit: true });
      });

      expect(createVaultReqOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ isMaxDeposit: true })
      );
    });
  });

  describe('cancel', () => {
    it('should reset state and disconnect guardian', () => {
      const { disconnectGuardian } = require('../../services/guardianService');

      const { result } = renderHook(() => useCreateVault());

      act(() => {
        result.current.cancel();
      });

      expect(disconnectGuardian).toHaveBeenCalled();
      expect(mockVaultCreationStore.reset).toHaveBeenCalled();
    });
  });
});
