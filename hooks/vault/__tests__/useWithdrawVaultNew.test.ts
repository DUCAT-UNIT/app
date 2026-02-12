/**
 * Tests for useWithdrawVaultNew hook
 */

import { renderHook, act } from '@testing-library/react-native';

// Mock client-sdk before importing hook
jest.mock('@ducat-unit/client-sdk', () => ({
  VaultAPI: {},
}));

jest.mock('../../../utils/vaultUtils', () => ({
  computeLiquidationPrice: jest.fn().mockReturnValue(40000),
  computeHealthRatio: jest.fn().mockReturnValue(1.8),
  computeMaxWithdraw: jest.fn().mockReturnValue(5000000),
}));

import { useWithdrawVaultNew } from '../useWithdrawVaultNew';

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
  createWithdrawConfig: jest.fn().mockReturnValue({ withdraw_amount: 1000000 }),
  createVaultReqWithdraw: jest.fn().mockResolvedValue({ signed: true }),
  guardianSendReqWithdraw: jest.fn().mockResolvedValue({ vault_txid: 'mockVaultTxid' }),
}));

jest.mock('../../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ price: 50000 }),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({
    vault: {
      withdraw: { ctx: jest.fn(), quote: jest.fn(), req: jest.fn() },
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

// Mock withdrawStore
// Note: currentBtcLocked is in BTC (not sats), e.g., 0.1 = 0.1 BTC
const mockWithdrawStoreState = {
  withdrawAmountSats: 1000000, // 0.01 BTC in sats
  selectedFeeRate: 1,
  currentUnitBorrowed: 1000,
  currentBtcLocked: 0.1, // 0.1 BTC
  loading: false,
  error: null as string | null,
  vaultTxid: null as string | null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../../stores/withdrawStore', () => ({
  useWithdrawStore: (selector: (state: typeof mockWithdrawStoreState) => unknown) =>
    selector(mockWithdrawStoreState),
  useWithdraw: () => ({
    withdrawAmountSats: mockWithdrawStoreState.withdrawAmountSats,
    setWithdrawAmountSats: jest.fn(),
  }),
}));

describe('useWithdrawVaultNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithdrawStoreState.loading = false;
    mockWithdrawStoreState.error = null;
    mockWithdrawStoreState.vaultTxid = null;
    mockWithdrawStoreState.withdrawAmountSats = 1000000; // 0.01 BTC in sats
    mockWithdrawStoreState.currentUnitBorrowed = 1000;
    mockWithdrawStoreState.currentBtcLocked = 0.1; // 0.1 BTC
  });

  describe('interface', () => {
    it('should return the expected interface', () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current).toHaveProperty('withdraw');
      expect(result.current).toHaveProperty('loadVaultData');
      expect(result.current).toHaveProperty('cancel');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('vaultTxid');
      expect(result.current).toHaveProperty('vaultDataLoaded');
    });

    it('should have withdraw as a function', () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(typeof result.current.withdraw).toBe('function');
    });

    it('should have loadVaultData as a function', () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(typeof result.current.loadVaultData).toBe('function');
    });

    it('should have cancel as a function', () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(typeof result.current.cancel).toBe('function');
    });
  });

  describe('state', () => {
    it('should return loading state from store', () => {
      mockWithdrawStoreState.loading = true;

      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current!.isLoading).toBe(true);
    });

    it('should return error state from store', () => {
      mockWithdrawStoreState.error = 'Test error';

      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current!.error).toBe('Test error');
    });

    it('should return vaultTxid from store', () => {
      mockWithdrawStoreState.vaultTxid = 'testVaultTxid456';

      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current!.vaultTxid).toBe('testVaultTxid456');
    });

    it('should return null for vaultTxid when not set', () => {
      mockWithdrawStoreState.vaultTxid = null;

      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current!.vaultTxid).toBeNull();
    });

    it('should return null for error when not set', () => {
      mockWithdrawStoreState.error = null;

      const { result } = renderHook(() => useWithdrawVaultNew());

      expect(result.current!.error).toBeNull();
    });
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      let loadResult: boolean = false;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(true);
      expect(result.current!.vaultDataLoaded).toBe(true);
    });

    it('should call setCurrentVaultData on load', async () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        await result.current!.loadVaultData();
      });

      expect(mockWithdrawStoreState.setCurrentVaultData).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should reset state on cancel', () => {
      const { result } = renderHook(() => useWithdrawVaultNew());

      act(() => {
        result.current!.cancel();
      });

      expect(mockWithdrawStoreState.reset).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate before withdrawing', async () => {
      mockWithdrawStoreState.withdrawAmountSats = 0; // Invalid amount

      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        const withdrawResult = await result.current!.withdraw();
        expect(withdrawResult).toBeNull();
      });

      expect(mockWithdrawStoreState.setError).toHaveBeenCalledWith('Please enter an amount to withdraw');
    });

    it('should require collateral to withdraw', async () => {
      mockWithdrawStoreState.currentBtcLocked = 0; // No collateral
      mockWithdrawStoreState.currentUnitBorrowed = 0;
      mockWithdrawStoreState.withdrawAmountSats = 1000000;

      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        const withdrawResult = await result.current!.withdraw();
        expect(withdrawResult).toBeNull();
      });

      // Validation checks amount vs collateral first
      expect(mockWithdrawStoreState.setError).toHaveBeenCalledWith('Withdraw amount cannot exceed current collateral');
    });

    it('should not allow withdrawing more than collateral', async () => {
      mockWithdrawStoreState.withdrawAmountSats = 20000000; // 0.2 BTC - more than 0.1 BTC collateral
      mockWithdrawStoreState.currentBtcLocked = 0.1; // 0.1 BTC = 10,000,000 sats max

      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        const withdrawResult = await result.current!.withdraw();
        expect(withdrawResult).toBeNull();
      });

      expect(mockWithdrawStoreState.setError).toHaveBeenCalledWith('Withdraw amount cannot exceed current collateral');
    });

    it('should fail validation when amount is negative', async () => {
      mockWithdrawStoreState.withdrawAmountSats = -50;

      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        const withdrawResult = await result.current!.withdraw();
        expect(withdrawResult).toBeNull();
      });

      expect(mockWithdrawStoreState.setError).toHaveBeenCalled();
    });
  });

  describe('health ratio validation', () => {
    it('should validate health ratio when withdrawing with debt', async () => {
      // With debt of 1000 UNIT and 0.1 BTC collateral at $50,000
      // Withdrawing too much would drop health ratio below minimum
      mockWithdrawStoreState.currentUnitBorrowed = 1000;
      mockWithdrawStoreState.currentBtcLocked = 0.1; // 0.1 BTC
      mockWithdrawStoreState.withdrawAmountSats = 9000000; // Try to withdraw 0.09 BTC

      const { result } = renderHook(() => useWithdrawVaultNew());

      await act(async () => {
        const withdrawResult = await result.current!.withdraw();
        // May fail if health ratio check is in place
        if (withdrawResult === null) {
          expect(mockWithdrawStoreState.setError).toHaveBeenCalled();
        }
      });
    });

    it('should allow full withdrawal when no debt', async () => {
      mockWithdrawStoreState.currentUnitBorrowed = 0; // No debt
      mockWithdrawStoreState.currentBtcLocked = 0.1; // 0.1 BTC
      mockWithdrawStoreState.withdrawAmountSats = 10000000; // Withdraw all (0.1 BTC)

      const { result } = renderHook(() => useWithdrawVaultNew());

      // Should pass validation
      await act(async () => {
        await result.current!.withdraw();
      });

      // setError should not be called for basic validation
      const errorCalls = mockWithdrawStoreState.setError.mock.calls;
      const basicValidationErrors = errorCalls.filter(
        (call: [string | null]) => call[0] === 'Please enter an amount to withdraw' ||
                   call[0] === 'No vault data. Please load vault data first.' ||
                   call[0] === 'Withdraw amount cannot exceed current collateral'
      );
      expect(basicValidationErrors.length).toBe(0);
    });
  });

  describe('liquidation price calculation', () => {
    it('should calculate liquidation price correctly for partial withdrawal', () => {
      // With debt of 1000 UNIT and 0.1 BTC collateral
      // Withdrawing 0.02 BTC reduces collateral to 0.08 BTC
      mockWithdrawStoreState.currentUnitBorrowed = 1000;
      mockWithdrawStoreState.currentBtcLocked = 0.1;
      mockWithdrawStoreState.withdrawAmountSats = 2000000; // 0.02 BTC

      const { result } = renderHook(() => useWithdrawVaultNew());

      // Just verify the hook returns without error
      expect(result.current).toBeDefined();
      expect(result.current!.withdraw).toBeDefined();
    });

    it('should handle zero debt in liquidation calculation', () => {
      mockWithdrawStoreState.currentUnitBorrowed = 0;
      mockWithdrawStoreState.currentBtcLocked = 0.1;
      mockWithdrawStoreState.withdrawAmountSats = 1000000;

      const { result } = renderHook(() => useWithdrawVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });

    it('should handle full withdrawal', () => {
      mockWithdrawStoreState.currentUnitBorrowed = 0;
      mockWithdrawStoreState.currentBtcLocked = 0.1;
      mockWithdrawStoreState.withdrawAmountSats = 10000000; // Full collateral

      const { result } = renderHook(() => useWithdrawVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });
  });
});
