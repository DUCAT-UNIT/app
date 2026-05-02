import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadVaultSettlementHistory,
  registerVaultSettlementHistory,
} from '../vaultSettlementHistoryService';

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('vaultSettlementHistoryService', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage.get(key) ?? null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
  });

  it('ignores invalid settlement history registrations', async () => {
    await registerVaultSettlementHistory({
      vaultPubkey: ' ',
      action: 'borrow_settled_to_usdc',
      amountUsd: 10,
      txid: 'txid',
    });
    await registerVaultSettlementHistory({
      vaultPubkey: 'vault',
      action: 'borrow_settled_to_usdc',
      amountUsd: 0,
      txid: 'txid',
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('persists unique settlement records and loads them as vault history transactions', async () => {
    await registerVaultSettlementHistory({
      vaultPubkey: ' vault-pubkey ',
      action: 'open_settled_to_usdc',
      amountUsd: 12.34,
      txid: ' tx-open ',
      timestamp: 100,
    });
    await registerVaultSettlementHistory({
      vaultPubkey: 'vault-pubkey',
      action: 'borrow_settled_to_usdc',
      amountUsd: 50,
      txid: 'tx-borrow',
      timestamp: 200,
    });
    await registerVaultSettlementHistory({
      vaultPubkey: 'vault-pubkey',
      action: 'open_settled_to_usdc',
      amountUsd: 12.34,
      txid: 'tx-open',
      timestamp: 300,
    });

    const history = await loadVaultSettlementHistory('vault-pubkey');

    expect(history).toEqual([
      expect.objectContaining({
        action: 'borrow_settled_to_usdc',
        transaction_id: 'tx-borrow',
        timestamp: 200,
        unit_amt: 5000,
        compositeSettlement: true,
      }),
      expect.objectContaining({
        action: 'open_settled_to_usdc',
        transaction_id: 'tx-open',
        timestamp: 100,
        unit_amt: 1234,
        compositeSettlement: true,
      }),
    ]);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it('limits persisted settlement history to the newest 200 records', async () => {
    for (let i = 0; i < 205; i++) {
      await registerVaultSettlementHistory({
        vaultPubkey: 'vault-pubkey',
        action: 'repay_from_usdc',
        amountUsd: i + 1,
        txid: `tx-${i}`,
        timestamp: i,
      });
    }

    const history = await loadVaultSettlementHistory('vault-pubkey');

    expect(history).toHaveLength(200);
    expect(history[0].transaction_id).toBe('tx-204');
    expect(history[199].transaction_id).toBe('tx-5');
  });

  it('returns empty history on missing vault pubkey or corrupted storage', async () => {
    storage.set('@ducat/vault_settlement_history_v1', '{bad json');

    await expect(loadVaultSettlementHistory(null)).resolves.toEqual([]);
    await expect(loadVaultSettlementHistory('vault-pubkey')).resolves.toEqual([]);
  });

  it('does not throw when persistence fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(registerVaultSettlementHistory({
      vaultPubkey: 'vault-pubkey',
      action: 'repay_from_usdc',
      amountUsd: 10,
      txid: 'txid',
    })).resolves.toBeUndefined();
  });
});
