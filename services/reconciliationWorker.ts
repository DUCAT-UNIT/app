import {
  recoverConfirmedRedemptionTracking,
  reconcileSubmittedEvmTransactionCheckpoints,
  type EvmTransactionCheckpointReconciliationResult,
} from './evmTransactionCheckpointService';
import {
  refreshPersistedVaultSettlementStatus,
  type VaultSettlementRefreshResult,
} from './vaultSettlementService';
import { classifyError, type AppErrorCategory } from '../utils/errorTaxonomy';
import { logger } from '../utils/logger';

export interface WalletReconciliationCycleInput {
  enabled: boolean;
  fetchBalance: () => Promise<void>;
  fetchVault: () => Promise<void>;
  fetchVaultTransactions: () => Promise<void>;
  fetchTransactionHistory: () => Promise<void>;
  fetchEcashTokens: () => Promise<void>;
  refreshEvmBalances: () => Promise<void>;
  refreshUsdcHistory: () => Promise<void>;
  refreshEthHistory: () => Promise<void>;
}

export interface WalletReconciliationCycleResult {
  skipped: boolean;
  evmCheckpoints: EvmTransactionCheckpointReconciliationResult | null;
  vaultSettlement: VaultSettlementRefreshResult | null;
  refreshed: string[];
  errors: Array<{
    task: string;
    category: AppErrorCategory;
    message: string;
  }>;
}

let cycleInFlight: Promise<WalletReconciliationCycleResult> | null = null;

async function settleTask(
  task: string,
  run: () => Promise<void>,
  refreshed: string[],
  errors: WalletReconciliationCycleResult['errors'],
): Promise<void> {
  try {
    await run();
    refreshed.push(task);
  } catch (error) {
    const appError = classifyError(error);
    errors.push({
      task,
      category: appError.category,
      message: appError.message,
    });
  }
}

async function runCycle(input: WalletReconciliationCycleInput): Promise<WalletReconciliationCycleResult> {
  const refreshed: string[] = [];
  const errors: WalletReconciliationCycleResult['errors'] = [];
  let evmCheckpoints: EvmTransactionCheckpointReconciliationResult | null = null;
  let vaultSettlement: VaultSettlementRefreshResult | null = null;

  try {
    evmCheckpoints = await reconcileSubmittedEvmTransactionCheckpoints();
    await recoverConfirmedRedemptionTracking();
  } catch (error) {
    const appError = classifyError(error);
    errors.push({
      task: 'evm-checkpoints',
      category: appError.category,
      message: appError.message,
    });
  }

  try {
    vaultSettlement = await refreshPersistedVaultSettlementStatus();
  } catch (error) {
    const appError = classifyError(error);
    errors.push({
      task: 'vault-settlement',
      category: appError.category,
      message: appError.message,
    });
  }

  const evmStateChanged = Boolean(
    evmCheckpoints && (evmCheckpoints.confirmed > 0 || evmCheckpoints.failed > 0),
  );
  const settlementStateChanged = Boolean(
    vaultSettlement && (
      vaultSettlement.status === 'settled'
      || vaultSettlement.status === 'ready_to_repay'
      || vaultSettlement.status === 'needs_retry'
    ),
  );

  const tasks: Array<[string, () => Promise<void>]> = [
    ['balance', input.fetchBalance],
    ['vault', input.fetchVault],
    ['vault-history', input.fetchVaultTransactions],
    ['transaction-history', input.fetchTransactionHistory],
    ['ecash', input.fetchEcashTokens],
  ];

  if (evmStateChanged || settlementStateChanged) {
    tasks.push(
      ['evm-balances', input.refreshEvmBalances],
      ['usdc-history', input.refreshUsdcHistory],
      ['eth-history', input.refreshEthHistory],
    );
  }

  await Promise.all(tasks.map(([task, run]) => settleTask(task, run, refreshed, errors)));

  if (errors.length > 0) {
    logger.debug('[ReconciliationWorker] Cycle completed with recoverable errors', { errors });
  }

  return {
    skipped: false,
    evmCheckpoints,
    vaultSettlement,
    refreshed,
    errors,
  };
}

export async function runWalletReconciliationCycle(
  input: WalletReconciliationCycleInput,
): Promise<WalletReconciliationCycleResult> {
  if (!input.enabled) {
    return {
      skipped: true,
      evmCheckpoints: null,
      vaultSettlement: null,
      refreshed: [],
      errors: [],
    };
  }

  if (cycleInFlight) {
    return cycleInFlight;
  }

  cycleInFlight = runCycle(input).finally(() => {
    cycleInFlight = null;
  });

  return cycleInFlight;
}

export function resetReconciliationWorkerForTests(): void {
  cycleInFlight = null;
}
