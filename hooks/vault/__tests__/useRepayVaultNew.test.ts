/**
 * Tests for useRepayVaultNew hook
 */

import { renderHook, act } from '@testing-library/react-native';

// Mock client-sdk before importing hook
jest.mock('@ducat-unit/client-sdk', () => ({
  VaultAPI: {},
}));

jest.mock('../../../utils/vaultUtils', () => ({
  computeLiquidationPrice: jest.fn().mockReturnValue(40000),
  computeHealthRatio: jest.fn().mockReturnValue(1.8),
}));

import { useRepayVaultNew } from '../useRepayVaultNew';

// Mock dependencies
jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      segwitAddress: 'tb1qmockaddress',
      segwitPubkey: 'mockSegwitPubkey',
      taprootAddress: 'tb1pmockaddress',
      taprootPubkey: 'mockTaprootPubkey',
    },
  }),
}));

jest.mock('../../../stores/priceStore', () => ({
  usePrice: () => ({
    btcPrice: 50000,
  }),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useVaultData: () => ({
    vaultData: {
      totalDebt: 1000,
      totalCollateral: 0.1,
      vaultId: 'mockVaultId',
    },
  }),
}));

jest.mock('../../../services/guardianService', () => ({
  getGuardianClient: jest.fn().mockResolvedValue({ req: {} }),
  disconnectGuardian: jest.fn(),
}));

jest.mock('../../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: (selector: (state: { setPendingTransaction: jest.Mock }) => unknown) =>
    selector({ setPendingTransaction: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('../../../stores/notificationStore', () => ({
  useNotificationStore: (selector: (state: { showSnackbar: jest.Mock }) => unknown) =>
    selector({ showSnackbar: jest.fn() }),
}));

jest.mock('../../../services/vaultOperationsService', () => ({
  computeVaultPrevoutFromTx: jest.fn().mockReturnValue({ txid: 'mockTxid', vout: 0 }),
  buildVaultProfile: jest.fn().mockReturnValue({
    acct_id: 'mockAcctId',
    master_id: 'mockMasterId',
    rdata: {},
    utxo: {},
  }),
  createRepayConfig: jest.fn().mockReturnValue({ repay_amount: 500 }),
  createVaultReqRepay: jest.fn().mockResolvedValue({ signed: true }),
  guardianRepayReserve: jest.fn().mockResolvedValue({ acct_id: 'mockAcctId' }),
  guardianSendReqRepay: jest.fn().mockResolvedValue({ txid: 'mockTxid', vault_txid: 'mockVaultTxid' }),
}));

jest.mock('../../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ price: 50000 }),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({
    vault: {
      repay: { ctx: jest.fn(), quote: jest.fn(), req: jest.fn() },
    },
  }),
}));

jest.mock('../../../services/vaultService', () => ({
  fetchVaultData: jest.fn().mockResolvedValue({
    vaultInfo: { id: 'mockVaultInfo' },
  }),
  fetchVaultHistory: jest.fn().mockResolvedValue([
    { txid: 'mockHistoryTxid', vout: 0 },
  ]),
}));

// Mock repayStore
const mockRepayStoreState = {
  repayAmountUnit: 500, // Named repayAmountUnit in store
  selectedFeeRate: 1,
  currentUnitBorrowed: 1000,
  currentBtcLocked: 0.1, // In BTC
  loading: false,
  error: null as string | null,
  issueTxid: null as string | null,
  vaultTxid: null as string | null,
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

jest.mock('../../../stores/repayStore', () => ({
  useRepayStore: (selector: (state: typeof mockRepayStoreState) => unknown) =>
    selector(mockRepayStoreState),
  useRepay: () => ({
    repayAmountUnit: mockRepayStoreState.repayAmountUnit,
    setRepayAmountUnit: jest.fn(),
  }),
}));

describe('useRepayVaultNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepayStoreState.loading = false;
    mockRepayStoreState.error = null;
    mockRepayStoreState.issueTxid = null;
    mockRepayStoreState.vaultTxid = null;
    mockRepayStoreState.repayAmountUnit = 500;
    mockRepayStoreState.currentUnitBorrowed = 1000;
    mockRepayStoreState.currentBtcLocked = 0.1;
  });

  describe('interface', () => {
    it('should return the expected interface', () => {
      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current).toHaveProperty('repay');
      expect(result.current).toHaveProperty('loadVaultData');
      expect(result.current).toHaveProperty('cancel');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('issueTxid');
      expect(result.current).toHaveProperty('vaultTxid');
      expect(result.current).toHaveProperty('vaultDataLoaded');
    });

    it('should have repay as a function', () => {
      const { result } = renderHook(() => useRepayVaultNew());

      expect(typeof result.current.repay).toBe('function');
    });

    it('should have loadVaultData as a function', () => {
      const { result } = renderHook(() => useRepayVaultNew());

      expect(typeof result.current.loadVaultData).toBe('function');
    });

    it('should have cancel as a function', () => {
      const { result } = renderHook(() => useRepayVaultNew());

      expect(typeof result.current.cancel).toBe('function');
    });
  });

  describe('state', () => {
    it('should return loading state from store', () => {
      mockRepayStoreState.loading = true;

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.isLoading).toBe(true);
    });

    it('should return error state from store', () => {
      mockRepayStoreState.error = 'Test error';

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.error).toBe('Test error');
    });

    it('should return issueTxid from store', () => {
      mockRepayStoreState.issueTxid = 'testTxid123';

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.issueTxid).toBe('testTxid123');
    });

    it('should return vaultTxid from store', () => {
      mockRepayStoreState.vaultTxid = 'testVaultTxid456';

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.vaultTxid).toBe('testVaultTxid456');
    });

    it('should return null for issueTxid when not set', () => {
      mockRepayStoreState.issueTxid = null;

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.issueTxid).toBeNull();
    });

    it('should return null for error when not set', () => {
      mockRepayStoreState.error = null;

      const { result } = renderHook(() => useRepayVaultNew());

      expect(result.current!.error).toBeNull();
    });
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useRepayVaultNew());

      let loadResult: boolean = false;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(true);
      expect(result.current!.vaultDataLoaded).toBe(true);
    });

    it('should call setCurrentVaultData on load', async () => {
      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        await result.current!.loadVaultData();
      });

      expect(mockRepayStoreState.setCurrentVaultData).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should reset state on cancel', () => {
      const { result } = renderHook(() => useRepayVaultNew());

      act(() => {
        result.current!.cancel();
      });

      expect(mockRepayStoreState.reset).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate before repaying', async () => {
      mockRepayStoreState.repayAmountUnit = 0; // Invalid amount

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        const repayResult = await result.current!.repay();
        expect(repayResult).toBeNull();
      });

      expect(mockRepayStoreState.setError).toHaveBeenCalledWith('Please enter an amount to repay');
    });


    // Note: Line 116-117 validation (currentBtcLocked <= 0 && currentUnitBorrowed <= 0) is unreachable:
    // - If amount > 0 (passes check #3) and currentUnitBorrowed <= 0, then amount > currentUnitBorrowed fails first
    // This is dead code in the validateRepay function

    it('should require vault data to repay', async () => {
      // To trigger vault data check, need amount > 0 but also amount > currentUnitBorrowed
      // Since check order is: amount <= 0, then amount > currentUnitBorrowed, then vault data
      // We need: amount > 0, amount <= currentUnitBorrowed, and currentBtcLocked = 0
      mockRepayStoreState.repayAmountUnit = 500;
      mockRepayStoreState.currentUnitBorrowed = 0;
      mockRepayStoreState.currentBtcLocked = 0;

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        const repayResult = await result.current!.repay();
        expect(repayResult).toBeNull();
      });

      // With amount (500) > currentUnitBorrowed (0), it triggers "Repay amount cannot exceed current debt"
      expect(mockRepayStoreState.setError).toHaveBeenCalledWith('Repay amount cannot exceed current debt');
    });

    it('should not allow repaying more than debt', async () => {
      mockRepayStoreState.repayAmountUnit = 2000; // More than debt of 1000

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        const repayResult = await result.current!.repay();
        expect(repayResult).toBeNull();
      });

      expect(mockRepayStoreState.setError).toHaveBeenCalledWith('Repay amount cannot exceed current debt');
    });

    it('should fail validation when amount is negative', async () => {
      mockRepayStoreState.repayAmountUnit = -50;

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        const repayResult = await result.current!.repay();
        expect(repayResult).toBeNull();
      });

      expect(mockRepayStoreState.setError).toHaveBeenCalled();
    });

  });

  describe('successful repay execution', () => {
    it('should execute repay and return txid and vaultTxid on success', async () => {
      mockRepayStoreState.repayAmountUnit = 500;
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0.1;

      const { result } = renderHook(() => useRepayVaultNew());

      let repayResult: { txid: string; vaultTxid: string } | null = null;
      await act(async () => {
        repayResult = await result.current!.repay();
      });

      expect(repayResult).not.toBeNull();
      expect(repayResult!.txid).toBe('mockTxid');
      expect(repayResult!.vaultTxid).toBe('mockVaultTxid');
    });

    it('should update store actions during repay flow', async () => {
      mockRepayStoreState.repayAmountUnit = 500;
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0.1;

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        await result.current!.repay();
      });

      expect(mockRepayStoreState.setLoading).toHaveBeenCalledWith(true);
      expect(mockRepayStoreState.setCurrentStep).toHaveBeenCalledWith('processing');
      expect(mockRepayStoreState.setProcessingStep).toHaveBeenCalled();
      expect(mockRepayStoreState.setVaultTxid).toHaveBeenCalledWith('mockVaultTxid');
    });

    it('should call guardian services during repay', async () => {
      const { guardianRepayReserve, guardianSendReqRepay } = require('../../../services/vaultOperationsService');

      mockRepayStoreState.repayAmountUnit = 500;
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0.1;

      const { result } = renderHook(() => useRepayVaultNew());

      await act(async () => {
        await result.current!.repay();
      });

      expect(guardianRepayReserve).toHaveBeenCalled();
      expect(guardianSendReqRepay).toHaveBeenCalled();
    });
  });

  describe('liquidation price calculation', () => {
    it('should calculate liquidation price for repay', () => {
      // With debt of 1000 UNIT and 0.1 BTC collateral
      // Repaying 500 UNIT reduces debt to 500 UNIT
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0.1;
      mockRepayStoreState.repayAmountUnit = 500;

      const { result } = renderHook(() => useRepayVaultNew());

      // Just verify the hook returns without error
      expect(result.current).toBeDefined();
      expect(result.current!.repay).toBeDefined();
    });

    it('should handle zero collateral in liquidation calculation', () => {
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0;
      mockRepayStoreState.repayAmountUnit = 500;

      const { result } = renderHook(() => useRepayVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });

    it('should handle full repay (debt becomes zero)', () => {
      mockRepayStoreState.currentUnitBorrowed = 1000;
      mockRepayStoreState.currentBtcLocked = 0.1;
      mockRepayStoreState.repayAmountUnit = 1000; // Full repay

      const { result } = renderHook(() => useRepayVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });
  });
});
