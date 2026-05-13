/**
 * Integration tests for vault operation flow via useVaultOperation hook
 *
 * Tests the full execute() pipeline:
 *   validate -> build profile -> connect guardian -> create request -> sign -> submit -> success
 *
 * Each external dependency is mocked; the test validates the orchestration logic.
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Guardian service
const mockGetGuardianClient = jest.fn();
const mockDisconnectGuardian = jest.fn();
jest.mock('../../services/guardianService', () => ({
  getGuardianClient: (...args: unknown[]) => mockGetGuardianClient(...args),
  disconnectGuardian: () => mockDisconnectGuardian(),
}));

// Oracle service
const mockFetchPriceQuote = jest.fn();
jest.mock('../../services/oracleService', () => ({
  fetchPriceQuote: (...args: unknown[]) => mockFetchPriceQuote(...args),
}));

// Vault operations service
const mockBuildVaultProfile = jest.fn();
const mockComputeVaultPrevoutFromTx = jest.fn();
jest.mock('../../services/vaultOperationsService', () => ({
  buildVaultProfile: (...args: unknown[]) => mockBuildVaultProfile(...args),
  computeVaultPrevoutFromTx: (...args: unknown[]) => mockComputeVaultPrevoutFromTx(...args),
}));

// Vault service
const mockFetchVaultData = jest.fn();
const mockFetchVaultHistory = jest.fn();
const mockFetchLatestVaultHistoryTransaction = jest.fn();
jest.mock('../../services/vaultService', () => ({
  fetchVaultData: (...args: unknown[]) => mockFetchVaultData(...args),
  fetchVaultHistory: (...args: unknown[]) => mockFetchVaultHistory(...args),
  fetchLatestVaultHistoryTransaction: (...args: unknown[]) => mockFetchLatestVaultHistoryTransaction(...args),
}));

// Vault wallet service
const mockCreateVaultWallet = jest.fn();
jest.mock('../../services/vaultWalletService', () => ({
  createVaultWallet: (...args: unknown[]) => mockCreateVaultWallet(...args),
}));

// Analytics service
jest.mock('../../services/analyticsService', () => ({
  analytics: {
    track: jest.fn(),
    trackTransaction: jest.fn(),
  },
}));

// Analytics events
jest.mock('../../constants/analyticsEvents', () => ({
  VAULT_EVENTS: {
    VAULT_OPERATION_STARTED: 'vault_operation_started',
    VAULT_OPERATION_COMPLETED: 'vault_operation_completed',
    VAULT_OPERATION_FAILED: 'vault_operation_failed',
  },
}));

// Notification store
const mockShowSnackbar = jest.fn();
jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: (selector: (s: { showSnackbar: jest.Mock }) => unknown) =>
    selector({ showSnackbar: mockShowSnackbar }),
}));

// Pending vault transaction store
const mockSetPendingTransaction = jest.fn().mockResolvedValue(undefined);
const mockSetPendingTransactionForAccount = jest.fn().mockResolvedValue(undefined);
jest.mock('../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: (
    selector: (s: {
      pendingTransaction: null;
      setPendingTransaction: jest.Mock;
      setPendingTransactionForAccount: jest.Mock;
    }) => unknown
  ) => selector({
    pendingTransaction: null,
    setPendingTransaction: mockSetPendingTransaction,
    setPendingTransactionForAccount: mockSetPendingTransactionForAccount,
  }),
}));

// Price store
jest.mock('../../stores/priceStore', () => ({
  usePrice: () => ({ btcPrice: 50000, loadingBtcPrice: false, fetchBtcPrice: jest.fn() }),
}));

// Wallet context
const mockWallet = {
  segwitAddress: 'tb1qtest123',
  segwitPubkey: 'pubkey_segwit',
  taprootAddress: 'tb1ptest456',
  taprootPubkey: 'pubkey_taproot',
};
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({ wallet: mockWallet, currentAccount: 0 }),
}));

// Vault data context
const mockVaultData = {
  totalDebt: 1000,
  totalCollateral: 0.5,
  vaultId: 'vault-123',
};
jest.mock('../../contexts/WalletDataContext', () => ({
  useVaultData: () => ({ vaultData: mockVaultData }),
}));

// ── Import under test ────────────────────────────────────────────────────────

import { useVaultOperation } from '../../hooks/vault/useVaultOperation';
import type {
  VaultOperationConfig,
  VaultValidationParams,
  VaultRequestParams,
  LiquidationPriceParams,
  PendingTransactionParams,
  PendingVaultTransaction,
  VaultStore,
} from '../../hooks/vault/vaultOperationTypes';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Minimal renderHook for testing React hooks outside a component */
function renderHook<T>(hookFn: () => T): { result: { current: T | null }; unmount: () => void } {
  const result: { current: T | null } = { current: null };

  function TestComponent(): null {
    result.current = hookFn();
    return null;
  }

  let component: ReactTestRenderer | undefined;
  act(() => {
    component = create(React.createElement(TestComponent));
  });

  return { result, unmount: component!.unmount };
}

// ── Config factory for a fake "deposit" operation ─────────────────────────────

interface FakeConfig {
  deposit_amount: number;
  fee_rate: number;
}
interface FakeRequest {
  psbt: string;
  vault_txid: string;
}
interface FakeResult {
  vault_txid: string;
}

const mockValidate = jest.fn<string | null, [VaultValidationParams]>().mockReturnValue(null);
const mockCreateConfig = jest.fn<FakeConfig, [number, number]>().mockImplementation(
  (amount, feeRate) => ({ deposit_amount: amount, fee_rate: feeRate })
);
const mockCreateRequest = jest
  .fn<Promise<FakeRequest>, [VaultRequestParams<FakeConfig>]>()
  .mockResolvedValue({ psbt: 'signed-psbt-hex', vault_txid: 'vault-tx-abc' });
const mockSendRequest = jest
  .fn<Promise<FakeResult>, [unknown, FakeRequest]>()
  .mockResolvedValue({ vault_txid: 'vault-tx-abc' });
const mockExtractResult = jest
  .fn<{ txid?: string; vaultTxid: string }, [FakeResult]>()
  .mockImplementation((r) => ({ vaultTxid: r.vault_txid }));
const mockCreatePendingTransaction = jest
  .fn<PendingVaultTransaction, [PendingTransactionParams<FakeConfig>]>()
  .mockImplementation((p) => ({
    txid: p.result.vaultTxid,
    vaultTxid: p.result.vaultTxid,
    action: 'deposit',
    btcAmt: 0.01,
    unitAmt: 0,
    timestamp: Date.now(),
    vaultPubkey: p.taprootPubkey,
  }));
const mockCalculateLiquidationPrice = jest
  .fn<number, [LiquidationPriceParams]>()
  .mockReturnValue(30000);

// Store adapter
const mockStoreState = {
  amount: 1_000_000, // 0.01 BTC in sats
  selectedFeeRate: 2,
  currentUnitBorrowed: 1000,
  currentBtcLocked: 0.5,
  loading: false,
  error: null,
  issueTxid: null,
  vaultTxid: null,
};

const mockStoreActions = {
  setLoading: jest.fn(),
  setError: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
};

const mockUseStore = jest.fn<VaultStore, []>().mockReturnValue({
  state: mockStoreState,
  actions: mockStoreActions,
});

function buildConfig(): VaultOperationConfig<FakeConfig, FakeRequest, FakeResult> {
  return {
    operationType: 'deposit',
    operationName: 'useDepositVault',
    needsReservation: false,
    hasIssueTxid: false,
    useStore: mockUseStore,
    validate: mockValidate,
    createConfig: mockCreateConfig,
    createRequest: mockCreateRequest,
    sendRequest: mockSendRequest,
    extractResult: mockExtractResult,
    createPendingTransaction: mockCreatePendingTransaction,
    calculateLiquidationPrice: mockCalculateLiquidationPrice,
  };
}

// ── Shared setup ──────────────────────────────────────────────────────────────

function setupHappyPath(): void {
  // Vault data + profile
  mockFetchVaultData.mockResolvedValue({
    vaultId: 'v1',
    vaultInfo: { vaultId: 'v1', collateral: 50_000_000, debt: 1000 },
  });
  mockFetchVaultHistory.mockResolvedValue([{ txid: 'hist-tx-1', rawTx: '0200...' }]);
  mockFetchLatestVaultHistoryTransaction.mockResolvedValue({ txid: 'hist-tx-1', rawTx: '0200...' });
  mockComputeVaultPrevoutFromTx.mockReturnValue({ txid: 'hist-tx-1', vout: 0, value: 50_000_000 });
  mockBuildVaultProfile.mockReturnValue({
    acct_id: 'acct-1',
    master_id: 'master-1',
    rdata: 'rdata',
    utxo: { txid: 'hist-tx-1', vout: 0 },
  });
  mockCreateVaultWallet.mockResolvedValue({ sign: jest.fn() });

  // Guardian
  mockGetGuardianClient.mockResolvedValue({ send: jest.fn() });

  // Oracle
  mockFetchPriceQuote.mockResolvedValue({ price: 50000, signature: 'sig' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useVaultOperation integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupHappyPath();

    // Reset config-level mocks to happy-path defaults (clearAllMocks doesn't reset implementations)
    mockValidate.mockReturnValue(null);
    mockCreateConfig.mockImplementation(
      (amount: number, feeRate: number) => ({ deposit_amount: amount, fee_rate: feeRate })
    );
    mockCreateRequest.mockResolvedValue({ psbt: 'signed-psbt-hex', vault_txid: 'vault-tx-abc' });
    mockSendRequest.mockResolvedValue({ vault_txid: 'vault-tx-abc' });
    mockExtractResult.mockImplementation((r: FakeResult) => ({ vaultTxid: r.vault_txid }));
    mockCreatePendingTransaction.mockImplementation(
      (p: PendingTransactionParams<FakeConfig>) => ({
        txid: p.result.vaultTxid,
        vaultTxid: p.result.vaultTxid,
        action: 'deposit' as const,
        btcAmt: 0.01,
        unitAmt: 0,
        timestamp: Date.now(),
        vaultPubkey: p.taprootPubkey,
      })
    );
    mockCalculateLiquidationPrice.mockReturnValue(30000);
    mockSetPendingTransaction.mockResolvedValue(undefined);
    mockSetPendingTransactionForAccount.mockResolvedValue(undefined);

    // Reset store state defaults
    mockStoreState.amount = 1_000_000;
    mockStoreState.selectedFeeRate = 2;
    mockStoreState.currentUnitBorrowed = 1000;
    mockStoreState.currentBtcLocked = 0.5;
    mockStoreState.loading = false;
    mockStoreState.error = null;
    mockStoreState.vaultTxid = null;
  });

  // ── Happy path ──────────────────────────────────────────────────────

  it('should execute full deposit flow successfully', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));
    expect(result.current).not.toBeNull();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toEqual({ vaultTxid: 'vault-tx-abc' });
  });

  it('should call processing steps in order 1 -> 2 -> 3 -> 4', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    const calls = mockStoreActions.setProcessingStep.mock.calls.map(
      (c: [number]) => c[0]
    );
    expect(calls).toEqual([1, 2, 3, 4]);
  });

  it('should set current step to processing then success', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockStoreActions.setCurrentStep).toHaveBeenCalledWith('processing');
    expect(mockStoreActions.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('should set vault txid on success', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockStoreActions.setVaultTxid).toHaveBeenCalledWith('vault-tx-abc');
  });

  it('should create pending transaction on success', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockSetPendingTransactionForAccount).toHaveBeenCalledTimes(1);
    const pendingTx = mockSetPendingTransactionForAccount.mock.calls[0][0];
    expect(pendingTx.vaultTxid).toBe('vault-tx-abc');
    expect(pendingTx.action).toBe('deposit');
    expect(pendingTx.vaultPubkey).toBe('pubkey_taproot');
    expect(mockSetPendingTransactionForAccount.mock.calls[0][1]).toBe(0);
  });

  it('should show snackbar notification on success', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' })
    );
  });

  it('should disconnect guardian in finally block', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    expect(mockDisconnectGuardian).toHaveBeenCalledTimes(1);
  });

  // ── Validation failure ──────────────────────────────────────────────

  it('should return null and set error when validation fails', async () => {
    mockValidate.mockReturnValue('Wallet not connected');

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('Wallet not connected');
    // Should NOT enter processing at all
    expect(mockStoreActions.setCurrentStep).not.toHaveBeenCalledWith('processing');
  });

  // ── Failure at vault profile build ──────────────────────────────────

  it('should fail when vault history is empty', async () => {
    mockFetchVaultHistory.mockResolvedValue([]);
    mockFetchLatestVaultHistoryTransaction.mockResolvedValue(null);

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith(
      'Failed to build vault profile. Please try again.'
    );
    // Should revert to confirm step
    expect(mockStoreActions.setCurrentStep).toHaveBeenCalledWith('confirm');
  });

  // ── Oracle failure ──────────────────────────────────────────────────

  it('should fail when oracle quote fails', async () => {
    mockFetchPriceQuote.mockRejectedValue(new Error('Oracle timeout'));

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('Oracle timeout');
    expect(mockStoreActions.setCurrentStep).toHaveBeenCalledWith('confirm');
  });

  // ── Guardian connection failure ─────────────────────────────────────

  it('should fail when guardian connection fails', async () => {
    mockGetGuardianClient.mockRejectedValue(new Error('WebSocket connection refused'));

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('WebSocket connection refused');
  });

  // ── Signing failure (createRequest) ─────────────────────────────────

  it('should fail when request signing fails', async () => {
    mockCreateRequest.mockRejectedValue(new Error('PSBT signing failed'));

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('PSBT signing failed');
  });

  // ── Submit failure ──────────────────────────────────────────────────

  it('should fail when guardian submit fails', async () => {
    mockSendRequest.mockRejectedValue(new Error('Guardian rejected transaction'));

    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current!.execute();
    });

    expect(outcome).toBeNull();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('Guardian rejected transaction');
    expect(mockDisconnectGuardian).toHaveBeenCalled();
  });

  // ── Loading state management ────────────────────────────────────────

  it('should toggle loading state during execution', async () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    await act(async () => {
      await result.current!.execute();
    });

    // setLoading(true) at start, setLoading(false) in finally
    const loadingCalls = mockStoreActions.setLoading.mock.calls.map(
      (c: [boolean]) => c[0]
    );
    expect(loadingCalls).toContain(true);
    expect(loadingCalls[loadingCalls.length - 1]).toBe(false);
  });

  // ── Cancel ──────────────────────────────────────────────────────────

  it('should reset store and disconnect guardian on cancel', () => {
    const { result } = renderHook(() => useVaultOperation(buildConfig()));

    act(() => {
      result.current!.cancel();
    });

    expect(mockStoreActions.reset).toHaveBeenCalledTimes(1);
    expect(mockDisconnectGuardian).toHaveBeenCalledTimes(1);
  });
});
