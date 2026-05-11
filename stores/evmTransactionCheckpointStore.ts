import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEVICE_ONLY } from '../services/storagePolicy';
import {
  mapEvmCheckpointKindToJournalKind,
  operationJournalId,
  useOperationJournalStore,
} from './operationJournalStore';

export type EvmTransactionCheckpointKind = 'approval' | 'swap' | 'redemption' | 'transfer';
export type EvmTransactionCheckpointStatus = 'submitted' | 'confirmed' | 'failed';

export interface EvmTransactionCheckpoint {
  id: string;
  chain: 'sepolia';
  accountIndex: number;
  kind: EvmTransactionCheckpointKind;
  status: EvmTransactionCheckpointStatus;
  txHash: string;
  receiptTxHash: string | null;
  asset: string | null;
  amount: string | null;
  spender: string | null;
  recipient: string | null;
  tokenIn: string | null;
  tokenOut: string | null;
  releaseId: string | null;
  destinationTaprootAddress: string | null;
  submittedAt: number;
  confirmedAt: number | null;
  updatedAt: number;
  error: string | null;
}

export type EvmTransactionCheckpointInput = Omit<
  EvmTransactionCheckpoint,
  'id' | 'chain' | 'status' | 'receiptTxHash' | 'submittedAt' | 'confirmedAt' | 'updatedAt' | 'error'
>;

interface EvmTransactionCheckpointState {
  checkpoints: EvmTransactionCheckpoint[];
}

interface EvmTransactionCheckpointActions {
  recordSubmitted: (input: EvmTransactionCheckpointInput) => void;
  markSubmitted: (txHash: string) => void;
  markConfirmed: (txHash: string, receiptTxHash?: string | null) => void;
  markFailed: (txHash: string, error: string) => void;
  clearTerminal: () => void;
  reset: () => void;
}

type EvmTransactionCheckpointStore = EvmTransactionCheckpointState & EvmTransactionCheckpointActions;

export const EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY = 'evm-transaction-checkpoints';
export const EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY = 'evm-transaction-checkpoints-fallback-v1';
export const MAX_EVM_TRANSACTION_CHECKPOINTS = 50;
export const EVM_TRANSACTION_CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const initialState: EvmTransactionCheckpointState = {
  checkpoints: [],
};

function isCheckpointExpired(
  checkpoint: Pick<EvmTransactionCheckpoint, 'status' | 'updatedAt'>,
  now = Date.now(),
): boolean {
  return checkpoint.status !== 'submitted' && now - checkpoint.updatedAt > EVM_TRANSACTION_CHECKPOINT_TTL_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function isKind(value: unknown): value is EvmTransactionCheckpointKind {
  return value === 'approval' || value === 'swap' || value === 'redemption' || value === 'transfer';
}

function isStatus(value: unknown): value is EvmTransactionCheckpointStatus {
  return value === 'submitted' || value === 'confirmed' || value === 'failed';
}

function trimCheckpoints(
  checkpoints: EvmTransactionCheckpoint[],
  now = Date.now(),
): EvmTransactionCheckpoint[] {
  return [...checkpoints]
    .filter((checkpoint) => !isCheckpointExpired(checkpoint, now))
    .sort((a, b) => {
      const submittedPriority = Number(b.status === 'submitted') - Number(a.status === 'submitted');
      return submittedPriority || b.updatedAt - a.updatedAt;
    })
    .slice(0, MAX_EVM_TRANSACTION_CHECKPOINTS);
}

function mergeCheckpoints(
  current: EvmTransactionCheckpoint[],
  incoming: EvmTransactionCheckpoint[],
  now = Date.now(),
): EvmTransactionCheckpoint[] {
  const byTxHash = new Map<string, EvmTransactionCheckpoint>();
  for (const checkpoint of [...current, ...incoming]) {
    const existing = byTxHash.get(checkpoint.txHash);
    if (!existing || checkpoint.updatedAt >= existing.updatedAt) {
      byTxHash.set(checkpoint.txHash, checkpoint);
    }
  }
  return trimCheckpoints([...byTxHash.values()], now);
}

function evmJournalId(accountIndex: number, txHash: string): string {
  return operationJournalId('evm', accountIndex, txHash);
}

function evmCheckpointLabel(kind: EvmTransactionCheckpointKind): string {
  switch (kind) {
    case 'approval':
      return 'Sepolia approval submitted';
    case 'swap':
      return 'Sepolia swap submitted';
    case 'redemption':
      return 'Sepolia redemption submitted';
    default:
      return 'Sepolia transfer submitted';
  }
}

function evmCheckpointAsset(input: EvmTransactionCheckpointInput | EvmTransactionCheckpoint): string | null {
  return input.asset || input.tokenIn || input.tokenOut || null;
}

function recordEvmCheckpointJournal(input: EvmTransactionCheckpointInput, now = Date.now()): void {
  useOperationJournalStore.getState().recordOperation({
    id: evmJournalId(input.accountIndex, input.txHash),
    accountIndex: input.accountIndex,
    kind: mapEvmCheckpointKindToJournalKind(input.kind),
    stage: 'pending',
    label: evmCheckpointLabel(input.kind),
    idempotencyKey: `evm:${input.accountIndex}:${input.kind}:${input.txHash}`,
    retrySafety: 'unsafe_until_checked',
    txids: [input.txHash],
    asset: evmCheckpointAsset(input),
    amount: input.amount,
    recipient: input.recipient || input.destinationTaprootAddress,
    recoveryAction: 'Check pending Sepolia transaction before retrying.',
    createdAt: now,
    updatedAt: now,
  });
}

export function normalizeEvmTransactionCheckpointState(
  value: unknown,
  now = Date.now(),
): EvmTransactionCheckpointState {
  if (!isRecord(value) || !Array.isArray(value.checkpoints)) {
    return { ...initialState };
  }

  const checkpoints = value.checkpoints.reduce<EvmTransactionCheckpoint[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const txHash = stringOrNull(item.txHash);
    const kind = isKind(item.kind) ? item.kind : null;
    const status = isStatus(item.status) ? item.status : null;
    const updatedAt = numberOrZero(item.updatedAt);
    const submittedAt = numberOrZero(item.submittedAt);

    if (!txHash || !kind || !status || !updatedAt) {
      return acc;
    }

    if (isCheckpointExpired({ status, updatedAt }, now)) {
      return acc;
    }

    acc.push({
      id: stringOrNull(item.id) || txHash,
      chain: 'sepolia',
      accountIndex: numberOrZero(item.accountIndex),
      kind,
      status,
      txHash,
      receiptTxHash: stringOrNull(item.receiptTxHash),
      asset: stringOrNull(item.asset),
      amount: stringOrNull(item.amount),
      spender: stringOrNull(item.spender),
      recipient: stringOrNull(item.recipient),
      tokenIn: stringOrNull(item.tokenIn),
      tokenOut: stringOrNull(item.tokenOut),
      releaseId: stringOrNull(item.releaseId),
      destinationTaprootAddress: stringOrNull(item.destinationTaprootAddress),
      submittedAt: submittedAt || updatedAt,
      confirmedAt: numberOrZero(item.confirmedAt) || null,
      updatedAt,
      error: stringOrNull(item.error),
    });
    return acc;
  }, []);

  return {
    checkpoints: trimCheckpoints(checkpoints, now),
  };
}

export const useEvmTransactionCheckpointStore = create<EvmTransactionCheckpointStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordSubmitted: (input) => {
        const now = Date.now();
        const checkpoint: EvmTransactionCheckpoint = {
          ...input,
          id: input.txHash,
          chain: 'sepolia',
          status: 'submitted',
          receiptTxHash: null,
          submittedAt: now,
          confirmedAt: null,
          updatedAt: now,
          error: null,
        };

        set((state) => ({
          checkpoints: trimCheckpoints([
            checkpoint,
            ...state.checkpoints.filter((existing) => existing.txHash !== input.txHash),
          ], now),
        }));
        recordEvmCheckpointJournal(input, now);
      },

      markSubmitted: (txHash) => {
        const now = Date.now();
        const checkpoint = get().checkpoints.find((item) => item.txHash === txHash);
        set((state) => ({
          checkpoints: trimCheckpoints(state.checkpoints.map((checkpoint) => {
            if (checkpoint.txHash !== txHash) return checkpoint;
            return {
              ...checkpoint,
              status: 'submitted',
              receiptTxHash: null,
              confirmedAt: null,
              updatedAt: now,
              error: null,
            };
          }), now),
        }));
        if (checkpoint) {
          useOperationJournalStore.getState().markSubmitted(evmJournalId(checkpoint.accountIndex, txHash), txHash);
        }
      },

      markConfirmed: (txHash, receiptTxHash = null) => {
        const now = Date.now();
        const checkpoint = get().checkpoints.find((item) => item.txHash === txHash);
        set((state) => ({
          checkpoints: trimCheckpoints(state.checkpoints.map((checkpoint) => {
            if (checkpoint.txHash !== txHash) return checkpoint;
            return {
              ...checkpoint,
              status: 'confirmed',
              receiptTxHash: receiptTxHash || txHash,
              confirmedAt: now,
              updatedAt: now,
              error: null,
            };
          }), now),
        }));
        if (checkpoint) {
          useOperationJournalStore.getState().markConfirmed(
            evmJournalId(checkpoint.accountIndex, txHash),
            receiptTxHash || txHash,
          );
        }
      },

      markFailed: (txHash, error) => {
        const now = Date.now();
        const checkpoint = get().checkpoints.find((item) => item.txHash === txHash);
        set((state) => ({
          checkpoints: trimCheckpoints(state.checkpoints.map((checkpoint) => {
            if (checkpoint.txHash !== txHash) return checkpoint;
            return {
              ...checkpoint,
              status: 'failed',
              updatedAt: now,
              error,
            };
          }), now),
        }));
        if (checkpoint) {
          useOperationJournalStore.getState().markFailed(evmJournalId(checkpoint.accountIndex, txHash), error);
        }
      },

      clearTerminal: () =>
        set((state) => ({
          checkpoints: state.checkpoints.filter((checkpoint) => checkpoint.status === 'submitted'),
        })),

      reset: () => set(initialState),
    }),
    {
      name: EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ checkpoints: state.checkpoints }),
      migrate: (persistedState) => normalizeEvmTransactionCheckpointState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeEvmTransactionCheckpointState(persistedState),
      }),
    },
  ),
);

export const resetEvmTransactionCheckpointStore = (): void => {
  void SecureStore.deleteItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY).catch(() => undefined);
  useEvmTransactionCheckpointStore.setState(initialState);
};

export const persistEvmTransactionCheckpointsNow = async (): Promise<void> => {
  await AsyncStorage.setItem(
    EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
    JSON.stringify({
      state: {
        checkpoints: useEvmTransactionCheckpointStore.getState().checkpoints,
      },
      version: 1,
    }),
  );
};

export const persistEvmTransactionCheckpointFallback = async (
  checkpoint: EvmTransactionCheckpoint,
): Promise<void> => {
  let existing: EvmTransactionCheckpoint[] = [];
  try {
    const stored = await SecureStore.getItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
    if (stored) {
      existing = normalizeEvmTransactionCheckpointState(JSON.parse(stored)).checkpoints;
    }
  } catch {
    existing = [];
  }

  const checkpoints = mergeCheckpoints(existing, [checkpoint]);
  await SecureStore.setItemAsync(
    EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY,
    JSON.stringify({ checkpoints }),
    DEVICE_ONLY,
  );
};

export const hydrateEvmTransactionCheckpointFallbacks = async (): Promise<number> => {
  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
  } catch {
    return 0;
  }

  if (!stored) {
    return 0;
  }

  let fallbackState: EvmTransactionCheckpointState;
  try {
    fallbackState = normalizeEvmTransactionCheckpointState(JSON.parse(stored));
  } catch {
    await SecureStore.deleteItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
    return 0;
  }

  if (fallbackState.checkpoints.length === 0) {
    await SecureStore.deleteItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
    return 0;
  }

  useEvmTransactionCheckpointStore.setState((state) => ({
    checkpoints: mergeCheckpoints(state.checkpoints, fallbackState.checkpoints),
  }));

  try {
    await persistEvmTransactionCheckpointsNow();
    await SecureStore.deleteItemAsync(EVM_TRANSACTION_CHECKPOINT_FALLBACK_KEY);
  } catch {
    // Keep the SecureStore fallback until the primary checkpoint store can persist again.
  }

  return fallbackState.checkpoints.length;
};
