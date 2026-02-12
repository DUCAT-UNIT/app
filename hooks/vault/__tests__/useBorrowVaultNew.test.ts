/**
 * Tests for useBorrowVaultNew hook
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

import { useBorrowVaultNew } from '../useBorrowVaultNew';

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
  createBorrowConfig: jest.fn().mockReturnValue({ borrow_amount: 100 }),
  createVaultReqBorrow: jest.fn().mockResolvedValue({ signed: true }),
  guardianBorrowReserve: jest.fn().mockResolvedValue({ acct_id: 'mockAcctId' }),
  guardianSendReqBorrow: jest.fn().mockResolvedValue({ txid: 'mockTxid', vault_txid: 'mockVaultTxid' }),
}));

jest.mock('../../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ price: 50000 }),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({
    vault: {
      borrow: { ctx: jest.fn(), quote: jest.fn(), req: jest.fn() },
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

// Mock borrowStore
const mockBorrowStoreState = {
  borrowAmount: 100,
  selectedFeeRate: 1,
  currentUnitBorrowed: 1000,
  currentBtcLocked: 10000000, // 0.1 BTC in sats
  loading: false,
  error: null as string | null,
  txid: null as string | null,
  vaultTxid: null as string | null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  setTxid: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../../stores/borrowStore', () => ({
  useBorrowStore: (selector: (state: typeof mockBorrowStoreState) => unknown) =>
    selector(mockBorrowStoreState),
  useBorrow: () => ({
    borrowAmount: mockBorrowStoreState.borrowAmount,
    setBorrowAmount: jest.fn(),
  }),
}));

describe('useBorrowVaultNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBorrowStoreState.loading = false;
    mockBorrowStoreState.error = null;
    mockBorrowStoreState.txid = null;
    mockBorrowStoreState.vaultTxid = null;
    mockBorrowStoreState.borrowAmount = 100;
    mockBorrowStoreState.currentBtcLocked = 10000000;
  });

  describe('interface', () => {
    it('should return the expected interface', () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current).toHaveProperty('borrow');
      expect(result.current).toHaveProperty('loadVaultData');
      expect(result.current).toHaveProperty('cancel');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('txid');
      expect(result.current).toHaveProperty('vaultTxid');
      expect(result.current).toHaveProperty('vaultDataLoaded');
    });

    it('should have borrow as a function', () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      expect(typeof result.current.borrow).toBe('function');
    });

    it('should have loadVaultData as a function', () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      expect(typeof result.current.loadVaultData).toBe('function');
    });

    it('should have cancel as a function', () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      expect(typeof result.current.cancel).toBe('function');
    });
  });

  describe('state', () => {
    it('should return loading state from store', () => {
      mockBorrowStoreState.loading = true;

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.isLoading).toBe(true);
    });

    it('should return error state from store', () => {
      mockBorrowStoreState.error = 'Test error';

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.error).toBe('Test error');
    });

    it('should return txid from store', () => {
      mockBorrowStoreState.txid = 'testTxid123';

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.txid).toBe('testTxid123');
    });

    it('should return vaultTxid from store', () => {
      mockBorrowStoreState.vaultTxid = 'testVaultTxid456';

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.vaultTxid).toBe('testVaultTxid456');
    });

    it('should return null for txid when not set', () => {
      mockBorrowStoreState.txid = null;

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.txid).toBeNull();
    });

    it('should return null for error when not set', () => {
      mockBorrowStoreState.error = null;

      const { result } = renderHook(() => useBorrowVaultNew());

      expect(result.current!.error).toBeNull();
    });
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      let loadResult: boolean = false;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(true);
      expect(result.current!.vaultDataLoaded).toBe(true);
    });

    it('should call setCurrentVaultData on load', async () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      await act(async () => {
        await result.current!.loadVaultData();
      });

      expect(mockBorrowStoreState.setCurrentVaultData).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should reset state on cancel', () => {
      const { result } = renderHook(() => useBorrowVaultNew());

      act(() => {
        result.current!.cancel();
      });

      expect(mockBorrowStoreState.reset).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate before borrowing', async () => {
      mockBorrowStoreState.borrowAmount = 0; // Invalid amount

      const { result } = renderHook(() => useBorrowVaultNew());

      await act(async () => {
        const borrowResult = await result.current!.borrow();
        expect(borrowResult).toBeNull();
      });

      expect(mockBorrowStoreState.setError).toHaveBeenCalledWith('Please enter an amount to borrow');
    });

    it('should require collateral to be locked', async () => {
      mockBorrowStoreState.currentBtcLocked = 0; // No collateral

      const { result } = renderHook(() => useBorrowVaultNew());

      await act(async () => {
        const borrowResult = await result.current!.borrow();
        expect(borrowResult).toBeNull();
      });

      expect(mockBorrowStoreState.setError).toHaveBeenCalledWith('No vault data. Please load vault data first.');
    });
  });

  describe('successful borrow execution', () => {
    it('should execute borrow and return txid and vaultTxid on success', async () => {
      mockBorrowStoreState.borrowAmount = 100;
      mockBorrowStoreState.currentUnitBorrowed = 1000;
      mockBorrowStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useBorrowVaultNew());

      let borrowResult: { txid: string; vaultTxid: string } | null = null;
      await act(async () => {
        borrowResult = await result.current!.borrow();
      });

      expect(borrowResult).not.toBeNull();
      expect(borrowResult!.txid).toBe('mockTxid');
      expect(borrowResult!.vaultTxid).toBe('mockVaultTxid');
    });

    it('should update store actions during borrow flow', async () => {
      mockBorrowStoreState.borrowAmount = 100;
      mockBorrowStoreState.currentUnitBorrowed = 1000;
      mockBorrowStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useBorrowVaultNew());

      await act(async () => {
        await result.current!.borrow();
      });

      expect(mockBorrowStoreState.setLoading).toHaveBeenCalledWith(true);
      expect(mockBorrowStoreState.setCurrentStep).toHaveBeenCalledWith('processing');
      expect(mockBorrowStoreState.setProcessingStep).toHaveBeenCalled();
      // setVaultTxid adapter calls setTxid internally
      expect(mockBorrowStoreState.setTxid).toHaveBeenCalled();
    });

    it('should call guardian services during borrow', async () => {
      const { guardianBorrowReserve, guardianSendReqBorrow } = require('../../../services/vaultOperationsService');

      mockBorrowStoreState.borrowAmount = 100;
      mockBorrowStoreState.currentUnitBorrowed = 1000;
      mockBorrowStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useBorrowVaultNew());

      await act(async () => {
        await result.current!.borrow();
      });

      expect(guardianBorrowReserve).toHaveBeenCalled();
      expect(guardianSendReqBorrow).toHaveBeenCalled();
    });
  });
});

describe('useBorrowVaultNew validation helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBorrowStoreState.loading = false;
    mockBorrowStoreState.error = null;
    mockBorrowStoreState.borrowAmount = 100;
    mockBorrowStoreState.currentBtcLocked = 10000000;
  });

  it('should fail validation when amount is negative', async () => {
    mockBorrowStoreState.borrowAmount = -50;

    const { result } = renderHook(() => useBorrowVaultNew());

    await act(async () => {
      const borrowResult = await result.current!.borrow();
      expect(borrowResult).toBeNull();
    });

    expect(mockBorrowStoreState.setError).toHaveBeenCalled();
  });
});

describe('useBorrowVaultNew liquidation price calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBorrowStoreState.loading = false;
    mockBorrowStoreState.error = null;
    mockBorrowStoreState.borrowAmount = 100;
    mockBorrowStoreState.currentBtcLocked = 10000000;
    mockBorrowStoreState.currentUnitBorrowed = 1000;
  });

  it('should calculate liquidation price for borrow', () => {
    // With existing debt of 1000 UNIT and 0.1 BTC collateral
    // Borrowing 100 more UNIT increases debt to 1100 UNIT
    mockBorrowStoreState.currentUnitBorrowed = 1000;
    mockBorrowStoreState.currentBtcLocked = 10000000; // 0.1 BTC in sats
    mockBorrowStoreState.borrowAmount = 100;

    const { result } = renderHook(() => useBorrowVaultNew());

    // Just verify the hook returns without error
    expect(result.current).toBeDefined();
    expect(result.current!.borrow).toBeDefined();
  });

  it('should handle zero existing debt in liquidation calculation', () => {
    mockBorrowStoreState.currentUnitBorrowed = 0;
    mockBorrowStoreState.currentBtcLocked = 10000000;
    mockBorrowStoreState.borrowAmount = 100;

    const { result } = renderHook(() => useBorrowVaultNew());

    // Should handle gracefully
    expect(result.current).toBeDefined();
  });

  it('should handle zero collateral in liquidation calculation', () => {
    mockBorrowStoreState.currentUnitBorrowed = 1000;
    mockBorrowStoreState.currentBtcLocked = 0;
    mockBorrowStoreState.borrowAmount = 100;

    const { result } = renderHook(() => useBorrowVaultNew());

    // Should handle gracefully (validation will fail but hook shouldn't crash)
    expect(result.current).toBeDefined();
  });
});
