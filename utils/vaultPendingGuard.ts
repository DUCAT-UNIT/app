import type { VaultHistoryTransaction, VaultData } from '../services/vaultService';
import type { PendingVaultTransaction } from '../stores/pendingVaultTransactionStore';

type VaultOperationType = 'borrow' | 'deposit' | 'repay' | 'withdraw';

const SATS_PER_BTC = 100_000_000;
const CENTS_PER_UNIT = 100;
export const PENDING_VAULT_SETTLED_HISTORY_GRACE_MS = 3 * 60 * 1000;

export const PENDING_VAULT_OPERATION_MESSAGE =
  'A vault transaction is still updating. Wait for the vault balance to update before starting another vault operation.';

export function shouldBlockVaultOperationForPendingTx(
  _operationType: VaultOperationType,
  pendingTransaction: PendingVaultTransaction | null
): boolean {
  return pendingTransaction !== null;
}

export function getPendingVaultOperationMessage(
  pendingTransaction: PendingVaultTransaction | null
): string {
  if (!pendingTransaction) {
    return PENDING_VAULT_OPERATION_MESSAGE;
  }

  return PENDING_VAULT_OPERATION_MESSAGE;
}

export function findPendingVaultHistoryTransaction(
  pendingTransaction: PendingVaultTransaction,
  vaultTransactions: VaultHistoryTransaction[]
): VaultHistoryTransaction | null {
  return (
    vaultTransactions.find(
      (tx) =>
        tx.transaction_id === pendingTransaction.txid ||
        tx.transaction_id === pendingTransaction.vaultTxid
    ) ?? null
  );
}

function approximatelyEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance;
}

function getVaultCollateralValue(vaultData: VaultData): number | null {
  const collateral = vaultData.totalCollateral ?? vaultData.vaultInfo?.btc_locked;
  if (typeof collateral !== 'number' || !Number.isFinite(collateral)) {
    return null;
  }

  return collateral;
}

function getVaultDebtValue(vaultData: VaultData): number | null {
  const debt = vaultData.totalDebt ?? vaultData.vaultInfo?.unit_borrowed;
  if (typeof debt !== 'number' || !Number.isFinite(debt)) {
    return null;
  }

  return debt;
}

function collateralMatches(vaultData: VaultData, transaction: VaultHistoryTransaction): boolean {
  if (typeof transaction.vault_amount !== 'number' || !Number.isFinite(transaction.vault_amount)) {
    return true;
  }

  const vaultCollateral = getVaultCollateralValue(vaultData);
  if (vaultCollateral === null) {
    return false;
  }

  return (
    approximatelyEqual(Math.round(vaultCollateral * SATS_PER_BTC), transaction.vault_amount, 1) ||
    approximatelyEqual(vaultCollateral, transaction.vault_amount, 1)
  );
}

function debtMatches(vaultData: VaultData, transaction: VaultHistoryTransaction): boolean {
  if (
    typeof transaction.amount_borrowed !== 'number' ||
    !Number.isFinite(transaction.amount_borrowed)
  ) {
    return true;
  }

  const vaultDebt = getVaultDebtValue(vaultData);
  if (vaultDebt === null) {
    return false;
  }

  return (
    approximatelyEqual(Math.round(vaultDebt * CENTS_PER_UNIT), transaction.amount_borrowed, 1) ||
    approximatelyEqual(vaultDebt, transaction.amount_borrowed, 1)
  );
}

function isPendingHistoryTransaction(transaction: VaultHistoryTransaction): boolean {
  return (transaction as VaultHistoryTransaction & { isPending?: boolean }).isPending === true;
}

function isPendingLiquidationAction(action: PendingVaultTransaction['action']): boolean {
  return action === 'repo' || action === 'trim';
}

function getLatestSettledHistoryTransaction(
  vaultTransactions: VaultHistoryTransaction[]
): VaultHistoryTransaction | null {
  return vaultTransactions.reduce<VaultHistoryTransaction | null>((latest, transaction) => {
    if (isPendingHistoryTransaction(transaction)) {
      return latest;
    }

    if (!latest || transaction.timestamp > latest.timestamp) {
      return transaction;
    }

    return latest;
  }, null);
}

export function findSettledHistoryForStalePendingVaultTransaction(
  pendingTransaction: PendingVaultTransaction,
  vaultData: VaultData | null,
  vaultTransactions: VaultHistoryTransaction[],
  now = Date.now()
): VaultHistoryTransaction | null {
  if (!vaultData || !Number.isFinite(pendingTransaction.timestamp)) {
    return null;
  }

  if (now - pendingTransaction.timestamp < PENDING_VAULT_SETTLED_HISTORY_GRACE_MS) {
    return null;
  }

  const latestHistory = getLatestSettledHistoryTransaction(vaultTransactions);
  if (!latestHistory) {
    return null;
  }

  return collateralMatches(vaultData, latestHistory) && debtMatches(vaultData, latestHistory)
    ? latestHistory
    : null;
}

export function isPendingVaultTransactionApplied(
  pendingTransaction: PendingVaultTransaction,
  vaultData: VaultData | null,
  vaultTransactions: VaultHistoryTransaction[]
): boolean {
  const matchingTransaction = findPendingVaultHistoryTransaction(
    pendingTransaction,
    vaultTransactions
  );

  if (!matchingTransaction) {
    return false;
  }

  if (!vaultData) {
    return isPendingLiquidationAction(pendingTransaction.action);
  }

  return (
    collateralMatches(vaultData, matchingTransaction) && debtMatches(vaultData, matchingTransaction)
  );
}
