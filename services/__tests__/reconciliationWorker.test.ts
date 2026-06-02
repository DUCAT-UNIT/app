import {
  resetReconciliationWorkerForTests,
  runWalletReconciliationCycle,
} from '../reconciliationWorker';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../evmTransactionCheckpointService';
import { refreshPersistedVaultSettlementStatus } from '../vaultSettlementService';
import { getWithRetry } from '../../utils/apiClient';

const mockConfirmPendingTransaction = jest.fn();
let mockPendingTransactions: Record<string, { status: string }> = {};

jest.mock('../evmTransactionCheckpointService', () => ({
  recoverConfirmedRedemptionTracking: jest.fn(),
  reconcileSubmittedEvmTransactionCheckpoints: jest.fn(),
}));

jest.mock('../vaultSettlementService', () => ({
  refreshPersistedVaultSettlementStatus: jest.fn(),
}));

jest.mock('../../stores/pendingTransactionsStore', () => ({
  usePendingTransactionsStore: {
    getState: jest.fn(() => ({
      pendingTransactions: mockPendingTransactions,
      confirmTransaction: mockConfirmPendingTransaction,
    })),
  },
}));

jest.mock('../../utils/apiClient', () => ({
  getWithRetry: jest.fn(),
}));

jest.mock('../../utils/constants', () => ({
  getTxApiUrl: jest.fn((txid: string) => `https://tx.example/${txid}`),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

const mockGetWithRetry = getWithRetry as jest.MockedFunction<typeof getWithRetry>;

function input(overrides = {}) {
  return {
    enabled: true,
    fetchBalance: jest.fn().mockResolvedValue(undefined),
    fetchVault: jest.fn().mockResolvedValue(undefined),
    fetchVaultTransactions: jest.fn().mockResolvedValue(undefined),
    fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
    fetchEcashTokens: jest.fn().mockResolvedValue(undefined),
    refreshEvmBalances: jest.fn().mockResolvedValue(undefined),
    refreshUsdcHistory: jest.fn().mockResolvedValue(undefined),
    refreshEthHistory: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('reconciliationWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetReconciliationWorkerForTests();
    mockPendingTransactions = {};
    mockConfirmPendingTransaction.mockResolvedValue(undefined);
    mockGetWithRetry.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as never);
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockResolvedValue({
      checked: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
      errors: 0,
    });
    (recoverConfirmedRedemptionTracking as jest.Mock).mockResolvedValue({
      checked: 0,
      alreadyTracked: 0,
      tracked: 0,
      failed: 0,
      lastRedemption: null,
    });
    (refreshPersistedVaultSettlementStatus as jest.Mock).mockResolvedValue({
      status: 'idle',
      message: 'No pending settlement',
    });
  });

  it('skips when disabled', async () => {
    await expect(runWalletReconciliationCycle(input({ enabled: false }))).resolves.toMatchObject({
      skipped: true,
      refreshed: [],
    });
    expect(reconcileSubmittedEvmTransactionCheckpoints).not.toHaveBeenCalled();
  });

  it('refreshes only lightweight core wallet data every enabled cycle', async () => {
    const cycleInput = input();

    const result = await runWalletReconciliationCycle(cycleInput);

    expect(result.refreshed).toEqual(expect.arrayContaining([
      'balance',
      'vault',
    ]));
    expect(cycleInput.fetchBalance).toHaveBeenCalled();
    expect(cycleInput.fetchVault).toHaveBeenCalled();
    expect(cycleInput.fetchVaultTransactions).not.toHaveBeenCalled();
    expect(cycleInput.fetchTransactionHistory).not.toHaveBeenCalled();
    expect(cycleInput.fetchEcashTokens).not.toHaveBeenCalled();
    expect(recoverConfirmedRedemptionTracking).toHaveBeenCalledTimes(1);
  });

  it('confirms persisted pending sends directly from explorer status', async () => {
    mockPendingTransactions = {
      'pending-send-txid': { status: 'pending' },
    };
    mockGetWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: { confirmed: true } }),
    } as never);
    const cycleInput = input();

    const result = await runWalletReconciliationCycle(cycleInput);

    expect(mockGetWithRetry).toHaveBeenCalledWith(
      'https://tx.example/pending-send-txid',
      expect.objectContaining({
        dedupeKey: 'pending-reconcile:pending-send-txid',
      })
    );
    expect(mockConfirmPendingTransaction).toHaveBeenCalledWith('pending-send-txid');
    expect(result.pendingTransactions).toEqual({
      checked: 1,
      confirmed: 1,
      pending: 0,
      errors: 0,
    });
    expect(cycleInput.fetchTransactionHistory).toHaveBeenCalled();
  });

  it('keeps persisted pending sends when explorer status is still unconfirmed', async () => {
    mockPendingTransactions = {
      'pending-send-txid': { status: 'pending' },
    };
    mockGetWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: { confirmed: false } }),
    } as never);
    const cycleInput = input();

    const result = await runWalletReconciliationCycle(cycleInput);

    expect(mockConfirmPendingTransaction).not.toHaveBeenCalled();
    expect(result.pendingTransactions).toEqual({
      checked: 1,
      confirmed: 0,
      pending: 1,
      errors: 0,
    });
    expect(cycleInput.fetchTransactionHistory).not.toHaveBeenCalled();
  });

  it('refreshes EVM views when checkpoint reconciliation changes state', async () => {
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockResolvedValue({
      checked: 1,
      pending: 0,
      confirmed: 1,
      failed: 0,
      errors: 0,
    });
    const cycleInput = input();

    const result = await runWalletReconciliationCycle(cycleInput);

    expect(result.refreshed).toEqual(expect.arrayContaining([
      'vault-history',
      'transaction-history',
      'ecash',
      'evm-balances',
      'usdc-history',
      'eth-history',
    ]));
    expect(cycleInput.fetchVaultTransactions).toHaveBeenCalled();
    expect(cycleInput.fetchTransactionHistory).toHaveBeenCalled();
    expect(cycleInput.fetchEcashTokens).toHaveBeenCalled();
    expect(cycleInput.refreshEvmBalances).toHaveBeenCalled();
    expect(cycleInput.refreshUsdcHistory).toHaveBeenCalled();
    expect(cycleInput.refreshEthHistory).toHaveBeenCalled();
  });

  it('dedupes concurrent cycles', async () => {
    let resolveCheckpoint: (value: unknown) => void;
    (reconcileSubmittedEvmTransactionCheckpoints as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveCheckpoint = resolve;
      }),
    );
    const cycleInput = input();

    const first = runWalletReconciliationCycle(cycleInput);
    const second = runWalletReconciliationCycle(cycleInput);

    resolveCheckpoint!({
      checked: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
      errors: 0,
    });

    await Promise.all([first, second]);
    expect(reconcileSubmittedEvmTransactionCheckpoints).toHaveBeenCalledTimes(1);
  });
});
