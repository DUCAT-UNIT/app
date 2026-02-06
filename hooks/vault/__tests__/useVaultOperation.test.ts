/**
 * Tests for useVaultOperation base hook
 *
 * Tests the unified vault operation hook with mock configurations.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useVaultOperation } from '../useVaultOperation';
import type {
  VaultOperationConfig,
  VaultStore,
  VaultValidationParams,
  UseVaultOperationResult,
} from '../vaultOperationTypes';

// Mock dependencies
jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      segwitAddress: 'tb1qmock...',
      segwitPubkey: 'mockSegwitPubkey',
      taprootAddress: 'tb1pmock...',
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

describe('useVaultOperation', () => {
  // Create a mock store for testing
  const createMockStore = (): VaultStore => {
    const state: {
      amount: number;
      selectedFeeRate: number;
      currentUnitBorrowed: number;
      currentBtcLocked: number;
      loading: boolean;
      error: string | null;
      issueTxid: string | null;
      vaultTxid: string | null;
    } = {
      amount: 100,
      selectedFeeRate: 1,
      currentUnitBorrowed: 1000,
      currentBtcLocked: 0.1,
      loading: false,
      error: null,
      issueTxid: null,
      vaultTxid: null,
    };

    return {
      state,
      actions: {
        setLoading: jest.fn((loading) => {
          state.loading = loading;
        }),
        setError: jest.fn((error) => {
          state.error = error;
        }),
        setVaultTxid: jest.fn((txid) => {
          state.vaultTxid = txid;
        }),
        setIssueTxid: jest.fn((txid) => {
          state.issueTxid = txid;
        }),
        setCurrentStep: jest.fn(),
        setProcessingStep: jest.fn(),
        setCurrentVaultData: jest.fn((unitBorrowed, btcLocked) => {
          state.currentUnitBorrowed = unitBorrowed;
          state.currentBtcLocked = btcLocked;
        }),
        setBitcoinPrice: jest.fn(),
        reset: jest.fn(),
      },
    };
  };

  // Create a mock config for testing
  const createMockConfig = (
    mockStore: VaultStore
  ): VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> => ({
    operationType: 'borrow',
    operationName: 'TestOperation',
    needsReservation: false,
    hasIssueTxid: false,
    useStore: () => mockStore,
    validate: (params: VaultValidationParams) => {
      if (!params.wallet) return 'Wallet not connected';
      if (!params.btcPrice) return 'Bitcoin price not available';
      if (params.amount <= 0) return 'Please enter an amount';
      return null;
    },
    createConfig: (amount: number) => ({ amount }),
    createRequest: jest.fn().mockResolvedValue({ signed: true }),
    sendRequest: jest.fn().mockResolvedValue({ vaultTxid: 'mockVaultTxid' }),
    extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
    createPendingTransaction: jest.fn().mockReturnValue({
      txid: 'mockVaultTxid',
      vaultTxid: 'mockVaultTxid',
      action: 'borrow',
      btcAmt: 0,
      unitAmt: 100,
      timestamp: Date.now(),
      vaultPubkey: 'mockPubkey',
    }),
    calculateLiquidationPrice: () => 45000,
  });

  it('should return the expected interface', () => {
    const mockStore = createMockStore();
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    expect(result.current).toHaveProperty('execute');
    expect(result.current).toHaveProperty('loadVaultData');
    expect(result.current).toHaveProperty('cancel');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('vaultTxid');
    expect(result.current).toHaveProperty('vaultDataLoaded');
  });

  it('should load vault data from context', async () => {
    const mockStore = createMockStore();
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      const success = await result.current!.loadVaultData();
      expect(success).toBe(true);
    });

    expect(result.current!.vaultDataLoaded).toBe(true);
    expect(mockStore.actions.setCurrentVaultData).toHaveBeenCalledWith(1000, 0.1);
  });

  it('should validate before executing', async () => {
    const mockStore = createMockStore();
    mockStore.state.amount = 0; // Invalid amount
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      const executeResult = await result.current!.execute();
      expect(executeResult).toBeNull();
    });

    expect(mockStore.actions.setError).toHaveBeenCalledWith('Please enter an amount');
  });

  it('should reset state on cancel', () => {
    const mockStore = createMockStore();
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    act(() => {
      result.current!.cancel();
    });

    expect(mockStore.actions.reset).toHaveBeenCalled();
  });

  it('should return loading state from store', () => {
    const mockStore = createMockStore();
    mockStore.state.loading = true;
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    expect(result.current!.isLoading).toBe(true);
  });

  it('should return error state from store', () => {
    const mockStore = createMockStore();
    mockStore.state.error = 'Test error';
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    expect(result.current!.error).toBe('Test error');
  });

  it('should return vaultTxid from store', () => {
    const mockStore = createMockStore();
    mockStore.state.vaultTxid = 'testTxid';
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    expect(result.current!.vaultTxid).toBe('testTxid');
  });

  it('should return issueTxid from store', () => {
    const mockStore = createMockStore();
    mockStore.state.issueTxid = 'testIssueTxid';
    const mockConfig = createMockConfig(mockStore);

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    expect(result.current!.issueTxid).toBe('testIssueTxid');
  });
});

describe('useVaultOperation successful execution', () => {
  const createMockStore = (): VaultStore => ({
    state: {
      amount: 100,
      selectedFeeRate: 1,
      currentUnitBorrowed: 1000,
      currentBtcLocked: 0.1,
      loading: false,
      error: null,
      issueTxid: null,
      vaultTxid: null,
    },
    actions: {
      setLoading: jest.fn(),
      setError: jest.fn(),
      setVaultTxid: jest.fn(),
      setIssueTxid: jest.fn(),
      setCurrentStep: jest.fn(),
      setProcessingStep: jest.fn(),
      setCurrentVaultData: jest.fn(),
      setBitcoinPrice: jest.fn(),
      reset: jest.fn(),
    },
  });

  it('should execute successfully and return vaultTxid', async () => {
    const mockStore = createMockStore();

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> = {
      operationType: 'deposit',
      operationName: 'TestDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => mockStore,
      validate: () => null,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockResolvedValue({ signed: true }),
      sendRequest: jest.fn().mockResolvedValue({ vaultTxid: 'mockVaultTxid' }),
      extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn().mockReturnValue({
        txid: 'mockVaultTxid',
        vaultTxid: 'mockVaultTxid',
        action: 'deposit',
        btcAmt: 100,
        unitAmt: 0,
        timestamp: Date.now(),
        vaultPubkey: 'mockPubkey',
      }),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    let executeResult: { txid?: string; vaultTxid: string } | null = null;
    await act(async () => {
      executeResult = await result.current!.execute();
    });

    expect(executeResult).not.toBeNull();
    expect((executeResult as { vaultTxid: string } | null)?.vaultTxid).toBe('mockVaultTxid');
    expect(mockStore.actions.setVaultTxid).toHaveBeenCalledWith('mockVaultTxid');
    expect(mockStore.actions.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('should execute with reservation when needsReservation is true', async () => {
    const mockStore = createMockStore();
    const mockPerformReservation = jest.fn().mockResolvedValue({ reserved: true });

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { txid: string; vaultTxid: string }> = {
      operationType: 'borrow',
      operationName: 'TestBorrow',
      needsReservation: true,
      hasIssueTxid: true,
      useStore: () => mockStore,
      validate: () => null,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockResolvedValue({ signed: true }),
      performReservation: mockPerformReservation,
      sendRequest: jest.fn().mockResolvedValue({ txid: 'mockTxid', vaultTxid: 'mockVaultTxid' }),
      extractResult: (result) => ({ txid: result.txid, vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn().mockReturnValue({
        txid: 'mockTxid',
        vaultTxid: 'mockVaultTxid',
        action: 'borrow',
        btcAmt: 0,
        unitAmt: 100,
        timestamp: Date.now(),
        vaultPubkey: 'mockPubkey',
      }),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockPerformReservation).toHaveBeenCalled();
    expect(mockStore.actions.setIssueTxid).toHaveBeenCalledWith('mockTxid');
  });

  it('should handle execution error and set error state', async () => {
    const mockStore = createMockStore();

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> = {
      operationType: 'deposit',
      operationName: 'TestDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => mockStore,
      validate: () => null,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockRejectedValue(new Error('Request creation failed')),
      sendRequest: jest.fn(),
      extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn(),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      const executeResult = await result.current!.execute();
      expect(executeResult).toBeNull();
    });

    expect(mockStore.actions.setError).toHaveBeenCalledWith('Request creation failed');
    expect(mockStore.actions.setCurrentStep).toHaveBeenCalledWith('confirm');
  });

  it('should handle non-Error thrown during execution', async () => {
    const mockStore = createMockStore();

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> = {
      operationType: 'deposit',
      operationName: 'TestDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => mockStore,
      validate: () => null,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockRejectedValue('string error'),
      sendRequest: jest.fn(),
      extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn(),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      const executeResult = await result.current!.execute();
      expect(executeResult).toBeNull();
    });

    expect(mockStore.actions.setError).toHaveBeenCalledWith('TestDeposit operation failed');
  });

  it('should prevent double execution', async () => {
    const mockStore = createMockStore();
    let callCount = 0;
    const mockSendRequest = jest.fn().mockImplementation(() => {
      callCount++;
      return new Promise((resolve) => setTimeout(() => resolve({ vaultTxid: 'mockVaultTxid' }), 100));
    });

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> = {
      operationType: 'deposit',
      operationName: 'TestDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => mockStore,
      validate: () => null,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockResolvedValue({ signed: true }),
      sendRequest: mockSendRequest,
      extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn().mockReturnValue({
        txid: 'mockVaultTxid',
        vaultTxid: 'mockVaultTxid',
        action: 'deposit',
        btcAmt: 100,
        unitAmt: 0,
        timestamp: Date.now(),
        vaultPubkey: 'mockPubkey',
      }),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    // Start first execution without await
    act(() => {
      result.current!.execute();
    });

    // Try second execution immediately
    await act(async () => {
      const secondResult = await result.current!.execute();
      // Second call should return null (prevented)
      expect(secondResult).toBeNull();
    });
  });
});

describe('useVaultOperation validation', () => {
  const createMockStore = (): VaultStore => ({
    state: {
      amount: 100,
      selectedFeeRate: 1,
      currentUnitBorrowed: 1000,
      currentBtcLocked: 0.1,
      loading: false,
      error: null,
      issueTxid: null,
      vaultTxid: null,
    },
    actions: {
      setLoading: jest.fn(),
      setError: jest.fn(),
      setVaultTxid: jest.fn(),
      setIssueTxid: jest.fn(),
      setCurrentStep: jest.fn(),
      setProcessingStep: jest.fn(),
      setCurrentVaultData: jest.fn(),
      setBitcoinPrice: jest.fn(),
      reset: jest.fn(),
    },
  });

  it('should call validation function with correct params', async () => {
    const mockStore = createMockStore();
    const validateFn = jest.fn().mockReturnValue(null);

    const mockConfig: VaultOperationConfig<{ amount: number }, { signed: boolean }, { vaultTxid: string }> = {
      operationType: 'deposit',
      operationName: 'TestDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => mockStore,
      validate: validateFn,
      createConfig: (amount: number) => ({ amount }),
      createRequest: jest.fn().mockResolvedValue({ signed: true }),
      sendRequest: jest.fn().mockResolvedValue({ vaultTxid: 'mockVaultTxid' }),
      extractResult: (result) => ({ vaultTxid: result.vaultTxid }),
      createPendingTransaction: jest.fn().mockReturnValue({
        txid: 'mockVaultTxid',
        vaultTxid: 'mockVaultTxid',
        action: 'deposit',
        btcAmt: 100,
        unitAmt: 0,
        timestamp: Date.now(),
        vaultPubkey: 'mockPubkey',
      }),
      calculateLiquidationPrice: () => 45000,
    };

    const { result } = renderHook(() => useVaultOperation(mockConfig));

    await act(async () => {
      await result.current!.execute();
    });

    expect(validateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: expect.objectContaining({
          segwitAddress: expect.any(String),
          taprootAddress: expect.any(String),
        }),
        btcPrice: 50000,
        amount: 100,
        currentUnitBorrowed: 1000,
        currentBtcLocked: 0.1,
      })
    );
  });
});
