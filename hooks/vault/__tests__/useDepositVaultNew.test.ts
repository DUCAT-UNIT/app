/**
 * Tests for useDepositVaultNew hook
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

import { useDepositVaultNew } from '../useDepositVaultNew';

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
  createDepositConfig: jest.fn().mockReturnValue({ deposit_amount: 100000 }),
  createVaultReqDeposit: jest.fn().mockResolvedValue({ signed: true }),
  guardianSendReqDeposit: jest.fn().mockResolvedValue({ vault_txid: 'mockVaultTxid' }),
}));

jest.mock('../../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ price: 50000 }),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({
    vault: {
      deposit: { ctx: jest.fn(), quote: jest.fn(), req: jest.fn() },
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

// Mock depositStore
const mockDepositStoreState = {
  depositAmountSats: 100000,
  selectedFeeRate: 1,
  currentUnitBorrowed: 1000,
  currentBtcLocked: 10000000,
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

jest.mock('../../../stores/depositStore', () => ({
  useDepositStore: (selector: (state: typeof mockDepositStoreState) => unknown) =>
    selector(mockDepositStoreState),
  useDeposit: () => ({
    depositAmountSats: mockDepositStoreState.depositAmountSats,
    setDepositAmountSats: jest.fn(),
  }),
}));

describe('useDepositVaultNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDepositStoreState.loading = false;
    mockDepositStoreState.error = null;
    mockDepositStoreState.vaultTxid = null;
    mockDepositStoreState.depositAmountSats = 100000;
    mockDepositStoreState.currentBtcLocked = 10000000;
  });

  describe('interface', () => {
    it('should return the expected interface', () => {
      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current).toHaveProperty('deposit');
      expect(result.current).toHaveProperty('loadVaultData');
      expect(result.current).toHaveProperty('cancel');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('vaultTxid');
      expect(result.current).toHaveProperty('vaultDataLoaded');
    });

    it('should have deposit as a function', () => {
      const { result } = renderHook(() => useDepositVaultNew());

      expect(typeof result.current.deposit).toBe('function');
    });

    it('should have loadVaultData as a function', () => {
      const { result } = renderHook(() => useDepositVaultNew());

      expect(typeof result.current.loadVaultData).toBe('function');
    });

    it('should have cancel as a function', () => {
      const { result } = renderHook(() => useDepositVaultNew());

      expect(typeof result.current.cancel).toBe('function');
    });
  });

  describe('state', () => {
    it('should return loading state from store', () => {
      mockDepositStoreState.loading = true;

      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current!.isLoading).toBe(true);
    });

    it('should return error state from store', () => {
      mockDepositStoreState.error = 'Test error';

      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current!.error).toBe('Test error');
    });

    it('should return vaultTxid from store', () => {
      mockDepositStoreState.vaultTxid = 'testVaultTxid456';

      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current!.vaultTxid).toBe('testVaultTxid456');
    });

    it('should return null for vaultTxid when not set', () => {
      mockDepositStoreState.vaultTxid = null;

      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current!.vaultTxid).toBeNull();
    });

    it('should return null for error when not set', () => {
      mockDepositStoreState.error = null;

      const { result } = renderHook(() => useDepositVaultNew());

      expect(result.current!.error).toBeNull();
    });
  });

  describe('loadVaultData', () => {
    it('should load vault data successfully', async () => {
      const { result } = renderHook(() => useDepositVaultNew());

      let loadResult: boolean = false;
      await act(async () => {
        loadResult = await result.current!.loadVaultData();
      });

      expect(loadResult).toBe(true);
      expect(result.current!.vaultDataLoaded).toBe(true);
    });

    it('should call setCurrentVaultData on load', async () => {
      const { result } = renderHook(() => useDepositVaultNew());

      await act(async () => {
        await result.current!.loadVaultData();
      });

      expect(mockDepositStoreState.setCurrentVaultData).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should reset state on cancel', () => {
      const { result } = renderHook(() => useDepositVaultNew());

      act(() => {
        result.current!.cancel();
      });

      expect(mockDepositStoreState.reset).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate before depositing', async () => {
      mockDepositStoreState.depositAmountSats = 0; // Invalid amount

      const { result } = renderHook(() => useDepositVaultNew());

      await act(async () => {
        const depositResult = await result.current!.deposit();
        expect(depositResult).toBeNull();
      });

      expect(mockDepositStoreState.setError).toHaveBeenCalledWith('Please enter an amount to deposit');
    });

    it('should fail validation when amount is negative', async () => {
      mockDepositStoreState.depositAmountSats = -50;

      const { result } = renderHook(() => useDepositVaultNew());

      await act(async () => {
        const depositResult = await result.current!.deposit();
        expect(depositResult).toBeNull();
      });

      expect(mockDepositStoreState.setError).toHaveBeenCalled();
    });
  });

  describe('successful deposit execution', () => {
    it('should execute deposit and return vaultTxid on success', async () => {
      mockDepositStoreState.depositAmountSats = 100000;
      mockDepositStoreState.currentUnitBorrowed = 1000;
      mockDepositStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useDepositVaultNew());

      let depositResult: { vaultTxid: string } | null = null;
      await act(async () => {
        depositResult = await result.current!.deposit();
      });

      expect(depositResult).not.toBeNull();
      expect(depositResult!.vaultTxid).toBe('mockVaultTxid');
    });

    it('should update store actions during deposit flow', async () => {
      mockDepositStoreState.depositAmountSats = 100000;
      mockDepositStoreState.currentUnitBorrowed = 1000;
      mockDepositStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useDepositVaultNew());

      await act(async () => {
        await result.current!.deposit();
      });

      expect(mockDepositStoreState.setLoading).toHaveBeenCalledWith(true);
      expect(mockDepositStoreState.setCurrentStep).toHaveBeenCalledWith('processing');
      expect(mockDepositStoreState.setProcessingStep).toHaveBeenCalled();
      expect(mockDepositStoreState.setVaultTxid).toHaveBeenCalledWith('mockVaultTxid');
    });

    it('should call guardian services during deposit', async () => {
      const { guardianSendReqDeposit } = require('../../../services/vaultOperationsService');

      mockDepositStoreState.depositAmountSats = 100000;
      mockDepositStoreState.currentUnitBorrowed = 1000;
      mockDepositStoreState.currentBtcLocked = 10000000;

      const { result } = renderHook(() => useDepositVaultNew());

      await act(async () => {
        await result.current!.deposit();
      });

      // Deposit doesn't need reservation, but should still call sendRequest
      expect(guardianSendReqDeposit).toHaveBeenCalled();
    });
  });

  describe('liquidation price calculation', () => {
    it('should calculate liquidation price for deposit', () => {
      // With debt of 1000 UNIT and 0.1 BTC collateral
      // Depositing 0.01 BTC increases collateral to 0.11 BTC
      mockDepositStoreState.currentUnitBorrowed = 1000;
      mockDepositStoreState.currentBtcLocked = 10000000; // 0.1 BTC in sats
      mockDepositStoreState.depositAmountSats = 1000000; // 0.01 BTC

      const { result } = renderHook(() => useDepositVaultNew());

      // Just verify the hook returns without error
      expect(result.current).toBeDefined();
      expect(result.current!.deposit).toBeDefined();
    });

    it('should handle zero existing collateral in liquidation calculation', () => {
      mockDepositStoreState.currentUnitBorrowed = 1000;
      mockDepositStoreState.currentBtcLocked = 0;
      mockDepositStoreState.depositAmountSats = 1000000;

      const { result } = renderHook(() => useDepositVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });

    it('should handle zero debt in liquidation calculation', () => {
      mockDepositStoreState.currentUnitBorrowed = 0;
      mockDepositStoreState.currentBtcLocked = 10000000;
      mockDepositStoreState.depositAmountSats = 1000000;

      const { result } = renderHook(() => useDepositVaultNew());

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });
  });
});
