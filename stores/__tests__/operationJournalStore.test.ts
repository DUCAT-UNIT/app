import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import {
  MAX_OPERATION_JOURNAL_ENTRIES,
  OPERATION_JOURNAL_STORAGE_KEY,
  OPERATION_JOURNAL_TERMINAL_TTL_MS,
  normalizeOperationJournalState,
  operationJournalId,
  resetOperationJournalStore,
  useOperationJournalStore,
} from '../operationJournalStore';
import {
  resetEvmTransactionCheckpointStore,
  useEvmTransactionCheckpointStore,
} from '../evmTransactionCheckpointStore';
import {
  resetPendingTransactionsStore,
  usePendingTransactionsStore,
} from '../pendingTransactionsStore';
import {
  resetPendingVaultTransactionStore,
  usePendingVaultTransactionStore,
} from '../pendingVaultTransactionStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../notificationStore', () => ({
  useNotificationStore: {
    getState: () => ({ showSnackbar: jest.fn() }),
  },
}));

describe('operationJournalStore', () => {
  const now = Date.UTC(2026, 4, 1, 9, 0, 0);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    resetOperationJournalStore();
    resetEvmTransactionCheckpointStore();
    resetPendingTransactionsStore();
    resetPendingVaultTransactionStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records, updates, confirms, and persists a normalized operation', () => {
    act(() => {
      useOperationJournalStore.getState().recordOperation({
        id: 'op-1',
        accountIndex: 2,
        kind: 'evm_transfer',
        stage: 'pending',
        label: 'Sepolia transfer submitted',
        idempotencyKey: 'transfer:2:0xabc',
        txids: ['0xabc'],
        asset: 'USDC',
        amount: '5',
        recipient: '0xrecipient',
      });
      useOperationJournalStore.getState().attachTxid('op-1', '0xreceipt');
      useOperationJournalStore.getState().markConfirmed('op-1', '0xreceipt');
    });

    expect(useOperationJournalStore.getState().entries[0]).toMatchObject({
      id: 'op-1',
      accountIndex: 2,
      kind: 'evm_transfer',
      stage: 'confirmed',
      retrySafety: 'not_retryable',
      txids: ['0xabc', '0xreceipt'],
      confirmedAt: now,
    });

    const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
      ([key]) => key === OPERATION_JOURNAL_STORAGE_KEY,
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.parse(calls[calls.length - 1][1]).state.entries[0]).toMatchObject({
      id: 'op-1',
      stage: 'confirmed',
    });
  });

  it('normalizes persisted state and drops malformed or expired terminal operations', () => {
    const state = normalizeOperationJournalState(
      {
        entries: [
          {
            id: 'expired',
            accountIndex: 0,
            kind: 'btc_send',
            stage: 'confirmed',
            label: 'Confirmed',
            idempotencyKey: 'expired',
            updatedAt: now - OPERATION_JOURNAL_TERMINAL_TTL_MS - 1,
          },
          {
            id: '',
            kind: 'btc_send',
            stage: 'pending',
            label: 'Broken',
            idempotencyKey: 'broken',
            updatedAt: now,
          },
          {
            id: 'pending',
            accountIndex: 1,
            kind: 'unit_send',
            stage: 'pending',
            label: 'UNIT send submitted',
            idempotencyKey: 'unit:1:tx',
            txids: ['tx'],
            updatedAt: now,
          },
        ],
      },
      now,
    );

    expect(state.entries).toEqual([
      expect.objectContaining({
        id: 'pending',
        stage: 'pending',
        retrySafety: 'unsafe_until_checked',
      }),
    ]);
  });

  it('caps the operation journal to the newest entries', () => {
    act(() => {
      for (let i = 0; i < MAX_OPERATION_JOURNAL_ENTRIES + 3; i++) {
        jest.setSystemTime(now + i);
        useOperationJournalStore.getState().recordOperation({
          id: `op-${i}`,
          accountIndex: 0,
          kind: 'btc_send',
          stage: 'pending',
          label: 'BTC send submitted',
          idempotencyKey: `btc:0:${i}`,
        });
      }
    });

    const entries = useOperationJournalStore.getState().entries;
    expect(entries).toHaveLength(MAX_OPERATION_JOURNAL_ENTRIES);
    expect(entries[0].id).toBe(`op-${MAX_OPERATION_JOURNAL_ENTRIES + 2}`);
    expect(entries.some((entry) => entry.id === 'op-0')).toBe(false);
  });

  it('mirrors EVM checkpoints into the operation journal', () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 4,
        kind: 'transfer',
        txHash: '0xsend',
        asset: 'USDC',
        amount: '2',
        spender: null,
        recipient: '0xrecipient',
        tokenIn: null,
        tokenOut: null,
        releaseId: null,
        destinationTaprootAddress: null,
      });
      useEvmTransactionCheckpointStore.getState().markFailed('0xsend', 'receipt timeout');
    });

    expect(useOperationJournalStore.getState().entries[0]).toMatchObject({
      id: operationJournalId('evm', 4, '0xsend'),
      kind: 'evm_transfer',
      stage: 'recoverable',
      asset: 'USDC',
      amount: '2',
      recipient: '0xrecipient',
      errorCategory: 'api_timeout',
      retrySafety: 'safe_to_retry',
    });
  });

  it('mirrors BTC and UNIT pending sends into the operation journal', async () => {
    await act(async () => {
      await usePendingTransactionsStore.getState().addPendingTransaction(
        'btc-txid',
        [{ address: 'tb1qrecipient', value: 1000, vout: 0 }],
        'BTC',
        null,
        1000,
      );
      await usePendingTransactionsStore.getState().confirmTransaction('btc-txid');
      await usePendingTransactionsStore.getState().addPendingTransaction(
        'unit-txid',
        [{ address: 'tb1qrecipient', value: 1000, runeAmount: 25, vout: 0 }],
        'UNIT',
        null,
        25,
      );
    });

    expect(useOperationJournalStore.getState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: operationJournalId('btc-send', 0, 'btc-txid'),
          kind: 'btc_send',
          stage: 'confirmed',
          retrySafety: 'not_retryable',
        }),
        expect.objectContaining({
          id: operationJournalId('unit-send', 0, 'unit-txid'),
          kind: 'unit_send',
          stage: 'pending',
          retrySafety: 'unsafe_until_checked',
        }),
      ]),
    );
  });

  it('mirrors pending vault operations into the operation journal', async () => {
    await act(async () => {
      await usePendingVaultTransactionStore.getState().setPendingTransaction({
        txid: 'funding-txid',
        vaultTxid: 'vault-txid',
        action: 'borrow',
        btcAmt: 0,
        unitAmt: 100,
        timestamp: now,
        vaultPubkey: 'vault-pubkey',
      });
      await usePendingVaultTransactionStore.getState().clearPendingTransaction();
    });

    expect(useOperationJournalStore.getState().entries[0]).toMatchObject({
      id: operationJournalId('vault', 0, 'vault-txid'),
      kind: 'vault_borrow',
      stage: 'confirmed',
      txids: ['funding-txid', 'vault-txid'],
      asset: 'UNIT',
      amount: '100',
    });
  });
});
