import {
  resetReconciliationWorkerForTests,
  runWalletReconciliationCycle,
} from '../reconciliationWorker';
import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
} from '../evmTransactionCheckpointService';
import { refreshPersistedVaultSettlementStatus } from '../vaultSettlementService';

jest.mock('../evmTransactionCheckpointService', () => ({
  recoverConfirmedRedemptionTracking: jest.fn(),
  reconcileSubmittedEvmTransactionCheckpoints: jest.fn(),
}));

jest.mock('../vaultSettlementService', () => ({
  refreshPersistedVaultSettlementStatus: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

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

  it('refreshes core wallet data every enabled cycle', async () => {
    const cycleInput = input();

    const result = await runWalletReconciliationCycle(cycleInput);

    expect(result.refreshed).toEqual(expect.arrayContaining([
      'balance',
      'vault',
      'vault-history',
      'transaction-history',
      'ecash',
    ]));
    expect(cycleInput.fetchBalance).toHaveBeenCalled();
    expect(cycleInput.fetchVaultTransactions).toHaveBeenCalled();
    expect(cycleInput.fetchTransactionHistory).toHaveBeenCalled();
    expect(recoverConfirmedRedemptionTracking).toHaveBeenCalledTimes(1);
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
      'evm-balances',
      'usdc-history',
      'eth-history',
    ]));
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
