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
  mapVaultActionToJournalKind: jest.fn(() => 'vault_open'),
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
    timestamp: Date.UTC(2026, 0, 1),
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
