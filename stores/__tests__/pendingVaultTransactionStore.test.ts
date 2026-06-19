import * as SecureStore from 'expo-secure-store';
import {
  resetPendingVaultTransactionStore,
  usePendingVaultTransactionStore,
  type PendingVaultTransaction,
} from '../pendingVaultTransactionStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../operationJournalStore', () => ({
  operationJournalId: jest.fn((scope: string, account: number, id: string) => `${scope}:${account}:${id}`),
  mapVaultActionToJournalKind: jest.fn((action: string) => {
    switch (action) {
      case 'borrow':
        return 'vault_borrow';
      case 'repay':
        return 'vault_repay';
      case 'deposit':
        return 'vault_deposit';
      case 'withdraw':
        return 'vault_withdraw';
      case 'repo':
      case 'trim':
        return 'vault_repossess';
      default:
        return 'vault_open';
    }
  }),
  useOperationJournalStore: {
    getState: jest.fn(() => ({
      recordOperation: jest.fn(),
      markConfirmed: jest.fn(),
      markFailed: jest.fn(),
    })),
  },
}));

describe('pendingVaultTransactionStore', () => {
  const tx: PendingVaultTransaction = {
    txid: 'txid123',
    vaultTxid: 'vaulttxid123',
    action: 'open',
    btcAmt: 1000,
    unitAmt: 2000,
    timestamp: Date.now(),
    vaultPubkey: 'vault-pubkey',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    resetPendingVaultTransactionStore();
  });

  it('exposes and persists a pending vault transaction', async () => {
    await usePendingVaultTransactionStore.getState().setPendingTransaction(tx);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'pending_vault_tx_0',
      JSON.stringify(tx),
      expect.any(Object),
    );
    expect(usePendingVaultTransactionStore.getState().pendingTransaction).toEqual(tx);
  });

  it('keeps the current session blocked if pending vault persistence fails', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore full'));

    await expect(
      usePendingVaultTransactionStore.getState().setPendingTransaction(tx)
    ).rejects.toThrow('SecureStore full');

    expect(usePendingVaultTransactionStore.getState().pendingTransaction).toEqual(tx);
    expect(usePendingVaultTransactionStore.getState().storageLoadError).toBe('SecureStore full');
    expect(usePendingVaultTransactionStore.getState().hasPendingTransaction()).toBe(true);
  });

  it('blocks vault actions when stored pending vault data is corrupt', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{bad json');

    await usePendingVaultTransactionStore.getState().loadFromStorage(0);

    const state = usePendingVaultTransactionStore.getState();
    expect(state.pendingTransaction).toBeNull();
    expect(state.storageLoadError).toContain('corrupted');
    expect(state.hasPendingTransaction()).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^pending_vault_tx_0_corrupt_/),
      '{bad json',
      expect.any(Object),
    );
  });

  it.each([
    ['open', 'vault_open', 'Vault open submitted', 'BTC', '1000'],
    ['borrow', 'vault_borrow', 'Vault borrow submitted', 'UNIT', '100'],
    ['deposit', 'vault_deposit', 'Vault deposit submitted', 'BTC', '1000'],
    ['withdraw', 'vault_withdraw', 'Vault withdraw submitted', 'BTC', '1000'],
    ['repay', 'vault_repay', 'Vault repay submitted', 'UNIT', '100'],
    ['trim', 'vault_repossess', 'Vault liquidation submitted', 'UNIT', '100'],
  ] as const)(
    'rehydrates a submitted vault %s after relaunch and records an unsafe recovery journal',
    async (action, kind, label, asset, amount) => {
      const journal = {
        recordOperation: jest.fn(),
        markConfirmed: jest.fn(),
        markFailed: jest.fn(),
      };
      const { useOperationJournalStore } = require('../operationJournalStore');
      useOperationJournalStore.getState.mockReturnValue(journal);
      const pendingTx: PendingVaultTransaction = {
        ...tx,
        txid: `${action}-txid`,
        vaultTxid: `${action}-vault-txid`,
        action,
        unitAmt: asset === 'UNIT' ? 100 : 0,
        btcAmt: asset === 'BTC' ? 1000 : 0,
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTx));

      await usePendingVaultTransactionStore.getState().loadFromStorage(0);

      const state = usePendingVaultTransactionStore.getState();
      expect(state.pendingTransaction).toEqual(pendingTx);
      expect(state.hasPendingTransaction()).toBe(true);
      expect(state.getPendingAsHistoryTransaction()).toEqual(
        expect.objectContaining({
          btc_amt: pendingTx.btcAmt,
          unit_amt: pendingTx.unitAmt,
          action,
          transaction_id: pendingTx.txid,
          isPending: true,
        }),
      );
      expect(journal.recordOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `vault:0:${action}-vault-txid`,
          accountIndex: 0,
          kind,
          stage: 'pending',
          label,
          retrySafety: 'unsafe_until_checked',
          txids: [`${action}-txid`, `${action}-vault-txid`],
          asset,
          amount,
          recipient: 'vault-pubkey',
          recoveryAction: 'Wait for vault confirmation before submitting another vault operation.',
        }),
      );
    }
  );

  it('retains stored pending vault transactions older than three minutes', async () => {
    const journal = {
      recordOperation: jest.fn(),
      markConfirmed: jest.fn(),
      markFailed: jest.fn(),
    };
    const { useOperationJournalStore } = require('../operationJournalStore');
    useOperationJournalStore.getState.mockReturnValue(journal);
    const now = Date.UTC(2026, 4, 17, 12, 0, 0);
    const expiredTx = { ...tx, timestamp: now - 181_000 };
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(expiredTx));

    try {
      await usePendingVaultTransactionStore.getState().loadFromStorage(0);
    } finally {
      dateNowSpy.mockRestore();
    }

    const state = usePendingVaultTransactionStore.getState();
    expect(state.pendingTransaction).toEqual(expiredTx);
    expect(state.hydratedAccount).toBe(0);
    expect(state.hasPendingTransaction()).toBe(true);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(journal.markConfirmed).not.toHaveBeenCalled();
    expect(journal.markFailed).not.toHaveBeenCalled();
  });

  it('does not delete an old pending vault transaction during cleanup', async () => {
    const journal = {
      recordOperation: jest.fn(),
      markConfirmed: jest.fn(),
      markFailed: jest.fn(),
    };
    const { useOperationJournalStore } = require('../operationJournalStore');
    useOperationJournalStore.getState.mockReturnValue(journal);
    const now = Date.UTC(2026, 4, 17, 12, 0, 0);
    const expiredTx = { ...tx, timestamp: now - 181_000 };
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    try {
      await usePendingVaultTransactionStore.getState().setPendingTransaction(expiredTx);
      await usePendingVaultTransactionStore.getState().cleanupExpiredTransaction(now);
    } finally {
      dateNowSpy.mockRestore();
    }

    expect(usePendingVaultTransactionStore.getState().pendingTransaction).toEqual(expiredTx);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(journal.markConfirmed).not.toHaveBeenCalled();
    expect(journal.markFailed).not.toHaveBeenCalled();
  });

  it('discards a matching failed pending vault transaction without marking it confirmed', async () => {
    const journal = {
      recordOperation: jest.fn(),
      markConfirmed: jest.fn(),
      markFailed: jest.fn(),
    };
    const { useOperationJournalStore } = require('../operationJournalStore');
    useOperationJournalStore.getState.mockReturnValue(journal);

    await usePendingVaultTransactionStore.getState().setPendingTransaction(tx);
    await usePendingVaultTransactionStore.getState().discardPendingTransactionForAccount(
      0,
      tx.vaultTxid,
      new Error('guardian rejected repo'),
    );

    expect(usePendingVaultTransactionStore.getState().pendingTransaction).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pending_vault_tx_0');
    expect(journal.markConfirmed).not.toHaveBeenCalled();
    expect(journal.markFailed).toHaveBeenCalledWith(
      'vault:0:vaulttxid123',
      expect.any(Error),
      'safe_to_retry',
    );
  });

  it('does not discard a different pending vault transaction', async () => {
    await usePendingVaultTransactionStore.getState().setPendingTransaction(tx);
    await usePendingVaultTransactionStore.getState().discardPendingTransactionForAccount(
      0,
      'different-txid',
      new Error('wrong tx'),
    );

    expect(usePendingVaultTransactionStore.getState().pendingTransaction).toEqual(tx);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
