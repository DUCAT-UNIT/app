import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { classifyError, type AppErrorCategory } from '../utils/errorTaxonomy';
import type { OperationStage } from '../utils/operationLifecycle';

export type OperationJournalKind =
  | 'btc_send'
  | 'unit_send'
  | 'ecash_send'
  | 'vault_open'
  | 'vault_borrow'
  | 'vault_repay'
  | 'vault_deposit'
  | 'vault_withdraw'
  | 'vault_repossess'
  | 'evm_approval'
  | 'evm_transfer'
  | 'evm_swap'
  | 'evm_redeem'
  | 'vault_settlement';

export type OperationRetrySafety =
  | 'unknown'
  | 'unsafe_until_checked'
  | 'safe_to_retry'
  | 'not_retryable';

export interface OperationJournalEntry {
  id: string;
  accountIndex: number;
  kind: OperationJournalKind;
  stage: OperationStage;
  label: string;
  idempotencyKey: string;
  retrySafety: OperationRetrySafety;
  txids: string[];
  asset: string | null;
  amount: string | null;
  recipient: string | null;
  errorCategory: AppErrorCategory | null;
  errorMessage: string | null;
  recoveryAction: string | null;
  createdAt: number;
  updatedAt: number;
  confirmedAt: number | null;
}

export type OperationJournalInput = Pick<
  OperationJournalEntry,
  'id' | 'accountIndex' | 'kind' | 'stage' | 'label' | 'idempotencyKey'
> &
  Partial<
    Pick<
      OperationJournalEntry,
      | 'retrySafety'
      | 'txids'
      | 'asset'
      | 'amount'
      | 'recipient'
      | 'errorCategory'
      | 'errorMessage'
      | 'recoveryAction'
      | 'createdAt'
      | 'updatedAt'
      | 'confirmedAt'
    >
  >;

export type OperationJournalPatch = Partial<
  Pick<
    OperationJournalEntry,
    | 'stage'
    | 'label'
    | 'retrySafety'
    | 'asset'
    | 'amount'
    | 'recipient'
    | 'errorCategory'
    | 'errorMessage'
    | 'recoveryAction'
    | 'confirmedAt'
  >
> & {
  txid?: string | null;
  txids?: string[];
  updatedAt?: number;
};

interface OperationJournalState {
  entries: OperationJournalEntry[];
}

interface OperationJournalActions {
  recordOperation: (input: OperationJournalInput) => OperationJournalEntry;
  updateOperation: (id: string, patch: OperationJournalPatch) => OperationJournalEntry | null;
  attachTxid: (id: string, txid: string) => OperationJournalEntry | null;
  markSubmitted: (id: string, txid?: string | null) => OperationJournalEntry | null;
  markConfirmed: (id: string, txid?: string | null) => OperationJournalEntry | null;
  markFailed: (
    id: string,
    error: unknown,
    retrySafety?: OperationRetrySafety,
  ) => OperationJournalEntry | null;
  clearTerminalOlderThan: (olderThanMs?: number, now?: number) => void;
  reset: () => void;
}

type OperationJournalStore = OperationJournalState & OperationJournalActions;

export const OPERATION_JOURNAL_STORAGE_KEY = 'operation-journal';
export const MAX_OPERATION_JOURNAL_ENTRIES = 100;
export const OPERATION_JOURNAL_TERMINAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const initialState: OperationJournalState = {
  entries: [],
};

const VALID_STAGES = new Set<OperationStage>([
  'edit',
  'review',
  'auth',
  'submit',
  'pending',
  'confirmed',
  'failed',
  'recoverable',
]);

const VALID_RETRY_SAFETY = new Set<OperationRetrySafety>([
  'unknown',
  'unsafe_until_checked',
  'safe_to_retry',
  'not_retryable',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeTxids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))];
}

function isTerminal(stage: OperationStage): boolean {
  return stage === 'confirmed' || stage === 'failed' || stage === 'recoverable';
}

function defaultRetrySafety(stage: OperationStage): OperationRetrySafety {
  if (stage === 'confirmed') return 'not_retryable';
  if (stage === 'recoverable' || stage === 'failed') return 'safe_to_retry';
  if (stage === 'pending' || stage === 'submit' || stage === 'auth') return 'unsafe_until_checked';
  return 'unknown';
}

function trimEntries(entries: OperationJournalEntry[], now = Date.now()): OperationJournalEntry[] {
  return [...entries]
    .filter((entry) => {
      if (!isTerminal(entry.stage)) return true;
      return now - entry.updatedAt <= OPERATION_JOURNAL_TERMINAL_TTL_MS;
    })
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_OPERATION_JOURNAL_ENTRIES);
}

function upsertEntry(
  entries: OperationJournalEntry[],
  entry: OperationJournalEntry,
  now = Date.now(),
): OperationJournalEntry[] {
  return trimEntries([
    entry,
    ...entries.filter(
      (existing) => existing.id !== entry.id && existing.idempotencyKey !== entry.idempotencyKey,
    ),
  ], now);
}

function normalizeInput(input: OperationJournalInput, now = Date.now()): OperationJournalEntry {
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;

  return {
    id: input.id,
    accountIndex: input.accountIndex,
    kind: input.kind,
    stage: input.stage,
    label: input.label,
    idempotencyKey: input.idempotencyKey,
    retrySafety: input.retrySafety ?? defaultRetrySafety(input.stage),
    txids: normalizeTxids(input.txids),
    asset: input.asset ?? null,
    amount: input.amount ?? null,
    recipient: input.recipient ?? null,
    errorCategory: input.errorCategory ?? null,
    errorMessage: input.errorMessage ?? null,
    recoveryAction: input.recoveryAction ?? null,
    createdAt,
    updatedAt,
    confirmedAt: input.confirmedAt ?? (input.stage === 'confirmed' ? updatedAt : null),
  };
}

function applyPatch(
  entry: OperationJournalEntry,
  patch: OperationJournalPatch,
  now = Date.now(),
): OperationJournalEntry {
  const nextStage = patch.stage ?? entry.stage;
  const patchTxids = patch.txids ?? [];
  const txids = [
    ...entry.txids,
    ...patchTxids,
    ...(patch.txid ? [patch.txid] : []),
  ].filter((txid, index, all) => txid && all.indexOf(txid) === index);
  const updatedAt = patch.updatedAt ?? now;

  return {
    ...entry,
    ...patch,
    stage: nextStage,
    retrySafety: patch.retrySafety ?? entry.retrySafety,
    txids,
    updatedAt,
    confirmedAt: patch.confirmedAt ?? (nextStage === 'confirmed' ? updatedAt : entry.confirmedAt),
  };
}

export function operationJournalId(scope: string, accountIndex: number, txid: string): string {
  return `${scope}:${accountIndex}:${txid}`;
}

export function mapVaultActionToJournalKind(action: string): OperationJournalKind {
  switch (action) {
    case 'open':
      return 'vault_open';
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
      return 'vault_settlement';
  }
}

export function mapEvmCheckpointKindToJournalKind(kind: string): OperationJournalKind {
  switch (kind) {
    case 'approval':
      return 'evm_approval';
    case 'swap':
      return 'evm_swap';
    case 'redemption':
      return 'evm_redeem';
    default:
      return 'evm_transfer';
  }
}

export function normalizeOperationJournalState(value: unknown, now = Date.now()): OperationJournalState {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    return { ...initialState };
  }

  const entries = value.entries.reduce<OperationJournalEntry[]>((acc, item) => {
    if (!isRecord(item)) return acc;

    const id = stringOrNull(item.id);
    const idempotencyKey = stringOrNull(item.idempotencyKey);
    const label = stringOrNull(item.label);
    const kind = stringOrNull(item.kind) as OperationJournalKind | null;
    const stage = VALID_STAGES.has(item.stage as OperationStage)
      ? item.stage as OperationStage
      : null;
    const updatedAt = numberOrNull(item.updatedAt);

    if (!id || !idempotencyKey || !label || !kind || !stage || !updatedAt) {
      return acc;
    }

    acc.push({
      id,
      accountIndex: numberOrNull(item.accountIndex) ?? 0,
      kind,
      stage,
      label,
      idempotencyKey,
      retrySafety: VALID_RETRY_SAFETY.has(item.retrySafety as OperationRetrySafety)
        ? item.retrySafety as OperationRetrySafety
        : defaultRetrySafety(stage),
      txids: normalizeTxids(item.txids),
      asset: stringOrNull(item.asset),
      amount: stringOrNull(item.amount),
      recipient: stringOrNull(item.recipient),
      errorCategory: stringOrNull(item.errorCategory) as AppErrorCategory | null,
      errorMessage: stringOrNull(item.errorMessage),
      recoveryAction: stringOrNull(item.recoveryAction),
      createdAt: numberOrNull(item.createdAt) ?? updatedAt,
      updatedAt,
      confirmedAt: numberOrNull(item.confirmedAt),
    });

    return acc;
  }, []);

  return {
    entries: trimEntries(entries, now),
  };
}

export const useOperationJournalStore = create<OperationJournalStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordOperation: (input) => {
        const now = Date.now();
        const existing = get().entries.find(
          (entry) => entry.id === input.id || entry.idempotencyKey === input.idempotencyKey,
        );
        const next = normalizeInput({
          ...input,
          createdAt: existing?.createdAt ?? input.createdAt,
          txids: [...(existing?.txids ?? []), ...(input.txids ?? [])],
        }, now);

        set((state) => ({
          entries: upsertEntry(state.entries, next, now),
        }));

        return next;
      },

      updateOperation: (id, patch) => {
        const now = Date.now();
        let updated: OperationJournalEntry | null = null;

        set((state) => ({
          entries: trimEntries(state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            updated = applyPatch(entry, patch, now);
            return updated;
          }), now),
        }));

        return updated;
      },

      attachTxid: (id, txid) => get().updateOperation(id, { txid }),

      markSubmitted: (id, txid = null) => get().updateOperation(id, {
        stage: 'pending',
        label: 'Submitted, checking confirmation',
        retrySafety: 'unsafe_until_checked',
        txid,
        errorCategory: null,
        errorMessage: null,
        recoveryAction: 'Check pending transaction before retrying.',
      }),

      markConfirmed: (id, txid = null) => get().updateOperation(id, {
        stage: 'confirmed',
        label: 'Confirmed',
        retrySafety: 'not_retryable',
        txid,
        errorCategory: null,
        errorMessage: null,
        recoveryAction: 'No action needed.',
      }),

      markFailed: (id, error, retrySafety = 'safe_to_retry') => {
        const classified = classifyError(error);
        return get().updateOperation(id, {
          stage: retrySafety === 'safe_to_retry' ? 'recoverable' : 'failed',
          label: retrySafety === 'safe_to_retry' ? 'Failed, safe to retry' : 'Failed',
          retrySafety,
          errorCategory: classified.category,
          errorMessage: classified.userMessage,
          recoveryAction: retrySafety === 'safe_to_retry'
            ? 'Refresh balances, then retry if the transaction is not confirmed.'
            : 'Check transaction status before retrying.',
        });
      },

      clearTerminalOlderThan: (olderThanMs = OPERATION_JOURNAL_TERMINAL_TTL_MS, now = Date.now()) => {
        set((state) => ({
          entries: state.entries.filter((entry) => {
            if (!isTerminal(entry.stage)) return true;
            return now - entry.updatedAt <= olderThanMs;
          }),
        }));
      },

      reset: () => set(initialState),
    }),
    {
      name: OPERATION_JOURNAL_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ entries: state.entries }),
      migrate: (persistedState) => normalizeOperationJournalState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeOperationJournalState(persistedState),
      }),
    },
  ),
);

export const resetOperationJournalStore = (): void => {
  useOperationJournalStore.setState(initialState);
};
