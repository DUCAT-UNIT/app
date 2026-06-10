import type { VaultData, VaultHistoryTransaction } from '../../services/vaultService';
import type { PendingVaultTransaction } from '../../stores/pendingVaultTransactionStore';
import {
  findSettledHistoryForStalePendingVaultTransaction,
  findPendingVaultHistoryTransaction,
  isPendingVaultTransactionApplied,
  shouldBlockVaultOperationForPendingTx,
} from '../vaultPendingGuard';

const pendingDeposit: PendingVaultTransaction = {
  txid: 'deposit-txid',
  vaultTxid: 'deposit-vault-txid',
  action: 'deposit',
  btcAmt: 1_000,
  unitAmt: 0,
  timestamp: 1_700_000_000_000,
  vaultPubkey: 'vault-pubkey',
};

function makeHistory(overrides: Partial<VaultHistoryTransaction> = {}): VaultHistoryTransaction {
  return {
    transaction_id: 'deposit-vault-txid',
    amount_borrowed: 0,
    vault_amount: 6_000,
    btc_amt: 1_000,
    unit_amt: 0,
    oracle_price: 50_000,
    timestamp: 1_700_000_000,
    action: 'deposit',
    ...overrides,
  };
}

function makeVaultData(overrides: Partial<VaultData> = {}): VaultData {
  return {
    vaultId: 'vault-id',
    vaultTag: 'vault-tag',
    totalDebt: 0,
    totalCollateral: 0.00006,
    currentPrice: 50_000,
    ...overrides,
  };
}

describe('vaultPendingGuard', () => {
  it('blocks vault operations while a pending vault transaction exists', () => {
    expect(shouldBlockVaultOperationForPendingTx('deposit', pendingDeposit)).toBe(true);
    expect(shouldBlockVaultOperationForPendingTx('withdraw', pendingDeposit)).toBe(true);
    expect(shouldBlockVaultOperationForPendingTx('borrow', null)).toBe(false);
  });

  it('finds a matching vault history transaction by vault txid or issue txid', () => {
    expect(
      findPendingVaultHistoryTransaction(pendingDeposit, [
        makeHistory({ transaction_id: 'other-txid' }),
        makeHistory({ transaction_id: 'deposit-vault-txid' }),
      ])
    )?.toMatchObject({ transaction_id: 'deposit-vault-txid' });

    expect(
      findPendingVaultHistoryTransaction({ ...pendingDeposit, vaultTxid: undefined }, [
        makeHistory({ transaction_id: 'deposit-txid' }),
      ])
    )?.toMatchObject({ transaction_id: 'deposit-txid' });
  });

  it('keeps the pending guard when history is present but vault data is stale', () => {
    const staleVaultData = makeVaultData({ totalCollateral: 0.00005 });

    expect(isPendingVaultTransactionApplied(pendingDeposit, staleVaultData, [makeHistory()])).toBe(
      false
    );
  });

  it('releases the pending guard once vault data reflects the history state', () => {
    expect(isPendingVaultTransactionApplied(pendingDeposit, makeVaultData(), [makeHistory()])).toBe(
      true
    );
  });

  it('matches debt whether vault data is reported in UNIT or cents', () => {
    const borrowHistory = makeHistory({
      transaction_id: 'borrow-txid',
      action: 'borrow',
      amount_borrowed: 100_000,
      unit_amt: 100_000,
      vault_amount: 50_000,
    });
    const pendingBorrow: PendingVaultTransaction = {
      ...pendingDeposit,
      txid: 'borrow-txid',
      vaultTxid: 'borrow-txid',
      action: 'borrow',
      btcAmt: 0,
      unitAmt: 100_000,
    };

    expect(
      isPendingVaultTransactionApplied(
        pendingBorrow,
        makeVaultData({ totalDebt: 1_000, totalCollateral: 0.0005 }),
        [borrowHistory]
      )
    ).toBe(true);

    expect(
      isPendingVaultTransactionApplied(
        pendingBorrow,
        makeVaultData({ totalDebt: 100_000, totalCollateral: 50_000 }),
        [borrowHistory]
      )
    ).toBe(true);
  });

  it('finds settled history for an old pending transaction whose txid never matched history', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);
    const stalePending = {
      ...pendingDeposit,
      txid: 'stale-local-txid',
      vaultTxid: 'stale-local-vault-txid',
      timestamp: now - 4 * 60 * 1000,
    };

    expect(
      findSettledHistoryForStalePendingVaultTransaction(
        stalePending,
        makeVaultData(),
        [makeHistory({ transaction_id: 'confirmed-history-txid' })],
        now
      )
    )?.toMatchObject({ transaction_id: 'confirmed-history-txid' });
  });

  it('keeps fresh pending transactions even when current history is settled', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);
    const freshPending = {
      ...pendingDeposit,
      txid: 'fresh-local-txid',
      vaultTxid: 'fresh-local-vault-txid',
      timestamp: now - 2 * 60 * 1000,
    };

    expect(
      findSettledHistoryForStalePendingVaultTransaction(
        freshPending,
        makeVaultData(),
        [makeHistory({ transaction_id: 'confirmed-history-txid' })],
        now
      )
    ).toBeNull();
  });

  it('keeps old pending transactions when vault balances do not match settled history', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);
    const stalePending = {
      ...pendingDeposit,
      txid: 'stale-local-txid',
      vaultTxid: 'stale-local-vault-txid',
      timestamp: now - 4 * 60 * 1000,
    };

    expect(
      findSettledHistoryForStalePendingVaultTransaction(
        stalePending,
        makeVaultData({ totalCollateral: 0.00005 }),
        [makeHistory({ transaction_id: 'confirmed-history-txid' })],
        now
      )
    ).toBeNull();
  });
});
