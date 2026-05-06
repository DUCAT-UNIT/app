import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act } from '@testing-library/react-native';
import {
  EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY,
  EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
  EVM_TRANSACTION_CHECKPOINT_TTL_MS,
  MAX_EVM_TRANSACTION_CHECKPOINTS,
  hydrateEvmTransactionCheckpointFallbacks,
  normalizeEvmTransactionCheckpointState,
  persistEvmTransactionCheckpointFallback,
  persistEvmTransactionCheckpointsNow,
  resetEvmTransactionCheckpointStore,
  useEvmTransactionCheckpointStore,
} from '../evmTransactionCheckpointStore';

const getPersistedCheckpointState = () => {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([key]) => key === EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
  );
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][1]);
};

describe('evmTransactionCheckpointStore', () => {
  const now = Date.UTC(2026, 0, 2, 12, 0, 0);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    resetEvmTransactionCheckpointStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists submitted and confirmed Sepolia transaction checkpoints', () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 3,
        kind: 'swap',
        txHash: '0xswap',
        asset: null,
        amount: '10',
        spender: '0xpool',
        recipient: '0xwallet',
        tokenIn: 'USDC',
        tokenOut: 'wUNIT',
        releaseId: null,
        destinationTaprootAddress: null,
      });
      useEvmTransactionCheckpointStore.getState().markConfirmed('0xswap', '0xreceipt');
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      chain: 'sepolia',
      accountIndex: 3,
      kind: 'swap',
      status: 'confirmed',
      txHash: '0xswap',
      receiptTxHash: '0xreceipt',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      submittedAt: now,
      confirmedAt: now,
      updatedAt: now,
      error: null,
    });

    const persisted = getPersistedCheckpointState();
    expect(persisted.version).toBe(1);
    expect(persisted.state.checkpoints[0]).toMatchObject({
      txHash: '0xswap',
      status: 'confirmed',
    });
  });

  it('marks submitted checkpoints failed when confirmation wait fails', () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 0,
        kind: 'redemption',
        txHash: '0xburn',
        asset: 'wUNIT',
        amount: '5',
        spender: '0xrouter',
        recipient: null,
        tokenIn: 'wUNIT',
        tokenOut: 'UNIT',
        releaseId: 'release-1',
        destinationTaprootAddress: 'tb1pdestination',
      });
      useEvmTransactionCheckpointStore.getState().markFailed('0xburn', 'receipt timeout');
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      status: 'failed',
      error: 'receipt timeout',
      releaseId: 'release-1',
      destinationTaprootAddress: 'tb1pdestination',
    });
  });

  it('can force a durable checkpoint write after an irreversible broadcast', async () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 2,
        kind: 'redemption',
        txHash: '0xdurable',
        asset: 'wUNIT',
        amount: '7',
        spender: '0xrouter',
        recipient: null,
        tokenIn: 'wUNIT',
        tokenOut: 'UNIT',
        releaseId: 'release-durable',
        destinationTaprootAddress: 'tb1pdurable',
      });
    });

    (AsyncStorage.setItem as jest.Mock).mockClear();

    await persistEvmTransactionCheckpointsNow();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
      expect.stringContaining('0xdurable'),
    );
    const persisted = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(persisted).toMatchObject({
      version: 1,
      state: {
        checkpoints: [
          expect.objectContaining({
            txHash: '0xdurable',
            status: 'submitted',
            releaseId: 'release-durable',
          }),
        ],
      },
    });
  });

  it('hydrates submitted checkpoints from the SecureStore fallback', async () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 1,
        kind: 'redemption',
        txHash: '0xfallback',
        asset: 'wUNIT',
        amount: '4',
        spender: '0xrouter',
        recipient: null,
        tokenIn: 'wUNIT',
        tokenOut: 'UNIT',
        releaseId: 'release-fallback',
        destinationTaprootAddress: 'tb1pfallback',
      });
    });
    const checkpoint = useEvmTransactionCheckpointStore.getState().checkpoints[0];
    await persistEvmTransactionCheckpointFallback(checkpoint);

    const fallbackPayload = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
      ([key]) => key === EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY,
    )?.[1] as string;
    expect(fallbackPayload).toContain('0xfallback');

    resetEvmTransactionCheckpointStore();
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(fallbackPayload);

    await expect(hydrateEvmTransactionCheckpointFallbacks()).resolves.toBe(1);

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      txHash: '0xfallback',
      status: 'submitted',
      releaseId: 'release-fallback',
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
      expect.stringContaining('0xfallback'),
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
  });

  it('can restore ambiguous failed checkpoints back to submitted', () => {
    act(() => {
      useEvmTransactionCheckpointStore.getState().recordSubmitted({
        accountIndex: 0,
        kind: 'transfer',
        txHash: '0xsend',
        asset: 'USDC',
        amount: '5',
        spender: null,
        recipient: '0xrecipient',
        tokenIn: 'USDC',
        tokenOut: null,
        releaseId: null,
        destinationTaprootAddress: null,
      });
      useEvmTransactionCheckpointStore.getState().markFailed('0xsend', 'rpc timeout');
      useEvmTransactionCheckpointStore.getState().markSubmitted('0xsend');
    });

    expect(useEvmTransactionCheckpointStore.getState().checkpoints[0]).toMatchObject({
      txHash: '0xsend',
      status: 'submitted',
      receiptTxHash: null,
      confirmedAt: null,
      error: null,
    });
  });

  it('normalizes persisted checkpoints and drops stale or malformed entries', () => {
    const state = normalizeEvmTransactionCheckpointState(
      {
        checkpoints: [
          {
            id: 'old-terminal',
            kind: 'approval',
            status: 'confirmed',
            txHash: '0xoldterminal',
            updatedAt: now - EVM_TRANSACTION_CHECKPOINT_TTL_MS - 1,
          },
          {
            id: 'old-submitted',
            kind: 'approval',
            status: 'submitted',
            txHash: '0xoldsubmitted',
            updatedAt: now - EVM_TRANSACTION_CHECKPOINT_TTL_MS - 1,
          },
          {
            kind: 'swap',
            status: 'submitted',
            txHash: '',
            updatedAt: now,
          },
          {
            id: 'fresh',
            accountIndex: 1,
            kind: 'transfer',
            status: 'confirmed',
            txHash: '0xfresh',
            receiptTxHash: '0xreceipt',
            asset: 'USDC',
            amount: '2',
            recipient: '0xrecipient',
            submittedAt: now - 1000,
            confirmedAt: now,
            updatedAt: now,
          },
        ],
      },
      now,
    );

    expect(state.checkpoints).toEqual([
      expect.objectContaining({
        id: 'old-submitted',
        chain: 'sepolia',
        kind: 'approval',
        status: 'submitted',
        txHash: '0xoldsubmitted',
      }),
      expect.objectContaining({
        id: 'fresh',
        chain: 'sepolia',
        accountIndex: 1,
        kind: 'transfer',
        status: 'confirmed',
        txHash: '0xfresh',
        receiptTxHash: '0xreceipt',
      }),
    ]);
  });

  it('keeps only the newest checkpoints', () => {
    act(() => {
      for (let i = 0; i < MAX_EVM_TRANSACTION_CHECKPOINTS + 2; i++) {
        jest.setSystemTime(now + i);
        useEvmTransactionCheckpointStore.getState().recordSubmitted({
          accountIndex: 0,
          kind: 'approval',
          txHash: `0xapproval${i}`,
          asset: 'USDC',
          amount: '1',
          spender: '0xspender',
          recipient: null,
          tokenIn: null,
          tokenOut: null,
          releaseId: null,
          destinationTaprootAddress: null,
        });
      }
    });

    const checkpoints = useEvmTransactionCheckpointStore.getState().checkpoints;
    expect(checkpoints).toHaveLength(MAX_EVM_TRANSACTION_CHECKPOINTS);
    expect(checkpoints[0].txHash).toBe(`0xapproval${MAX_EVM_TRANSACTION_CHECKPOINTS + 1}`);
    expect(checkpoints.some((checkpoint) => checkpoint.txHash === '0xapproval0')).toBe(false);
  });
});
