import type {
  EvmTransactionCheckpoint,
  EvmTransactionCheckpointKind,
} from '../stores/evmTransactionCheckpointStore';

export type OperationStage =
  | 'edit'
  | 'review'
  | 'auth'
  | 'submit'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'recoverable';

export interface OperationLifecycleState {
  stage: OperationStage;
  label: string;
  busy: boolean;
  canNavigateBack: boolean;
  canSubmit: boolean;
  retryable: boolean;
  txid: string | null;
  error: string | null;
  updatedAt: number;
}

export interface OperationLifecycleInput {
  stage: OperationStage;
  label?: string;
  busy?: boolean;
  canNavigateBack?: boolean;
  canSubmit?: boolean;
  retryable?: boolean;
  txid?: string | null;
  error?: string | null;
  updatedAt?: number;
}

export interface OperationFlagsInput {
  isAuthenticating?: boolean;
  isSubmitting?: boolean;
  isPending?: boolean;
  isConfirmed?: boolean;
  isRecoverable?: boolean;
  error?: string | Error | null;
  txid?: string | null;
  formCanSubmit?: boolean;
  updatedAt?: number;
}

export interface EvmCheckpointActionCopy {
  title: string;
  body: string;
  primaryLabel: string;
  statusLabel: string;
  retryable: boolean;
}

const DEFAULT_LABELS: Record<OperationStage, string> = {
  edit: 'Ready',
  review: 'Review',
  auth: 'Authenticating',
  submit: 'Submitting',
  pending: 'Still pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
  recoverable: 'Failed, safe to retry',
};

const BUSY_STAGES = new Set<OperationStage>(['auth', 'submit']);
const BLOCK_NAVIGATION_STAGES = new Set<OperationStage>(['auth', 'submit']);
const SUBMIT_READY_STAGES = new Set<OperationStage>(['edit', 'review', 'failed', 'recoverable']);

const ALLOWED_TRANSITIONS: Record<OperationStage, OperationStage[]> = {
  edit: ['review', 'auth', 'submit', 'failed', 'recoverable'],
  review: ['edit', 'auth', 'submit', 'failed', 'recoverable'],
  auth: ['submit', 'failed', 'recoverable'],
  submit: ['pending', 'confirmed', 'failed', 'recoverable'],
  pending: ['confirmed', 'failed', 'recoverable'],
  confirmed: ['edit'],
  failed: ['edit', 'review', 'auth', 'submit', 'pending'],
  recoverable: ['edit', 'review', 'auth', 'submit', 'pending'],
};

function normalizeError(error: string | Error | null | undefined): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : error;
}

export function createOperationLifecycleState(
  input: OperationLifecycleInput,
): OperationLifecycleState {
  const busy = input.busy ?? BUSY_STAGES.has(input.stage);

  return {
    stage: input.stage,
    label: input.label ?? DEFAULT_LABELS[input.stage],
    busy,
    canNavigateBack: input.canNavigateBack ?? !BLOCK_NAVIGATION_STAGES.has(input.stage),
    canSubmit: input.canSubmit ?? (!busy && SUBMIT_READY_STAGES.has(input.stage)),
    retryable: input.retryable ?? (input.stage === 'failed' || input.stage === 'recoverable'),
    txid: input.txid ?? null,
    error: input.error ?? null,
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

export function canTransitionOperationStage(from: OperationStage, to: OperationStage): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionOperationLifecycle(
  current: OperationLifecycleState,
  next: OperationLifecycleInput,
): OperationLifecycleState {
  if (!canTransitionOperationStage(current.stage, next.stage)) {
    throw new Error(`Invalid operation lifecycle transition from ${current.stage} to ${next.stage}`);
  }

  return createOperationLifecycleState({
    txid: current.txid,
    error: current.error,
    ...next,
  });
}

export function deriveOperationLifecycleFromFlags(
  input: OperationFlagsInput,
): OperationLifecycleState {
  const error = normalizeError(input.error);

  if (input.isAuthenticating) {
    return createOperationLifecycleState({ stage: 'auth', txid: input.txid, updatedAt: input.updatedAt });
  }

  if (input.isSubmitting) {
    return createOperationLifecycleState({ stage: 'submit', txid: input.txid, updatedAt: input.updatedAt });
  }

  if (input.isPending) {
    return createOperationLifecycleState({ stage: 'pending', txid: input.txid, updatedAt: input.updatedAt });
  }

  if (input.isConfirmed) {
    return createOperationLifecycleState({ stage: 'confirmed', txid: input.txid, updatedAt: input.updatedAt });
  }

  if (input.isRecoverable) {
    return createOperationLifecycleState({
      stage: 'recoverable',
      txid: input.txid,
      error,
      updatedAt: input.updatedAt,
    });
  }

  if (error) {
    return createOperationLifecycleState({
      stage: 'failed',
      txid: input.txid,
      error,
      updatedAt: input.updatedAt,
    });
  }

  return createOperationLifecycleState({
    stage: 'edit',
    canSubmit: input.formCanSubmit ?? false,
    txid: input.txid,
    updatedAt: input.updatedAt,
  });
}

export function getEvmCheckpointLifecycle(
  checkpoint: EvmTransactionCheckpoint,
): OperationLifecycleState {
  if (checkpoint.status === 'confirmed') {
    return createOperationLifecycleState({
      stage: 'confirmed',
      txid: checkpoint.receiptTxHash || checkpoint.txHash,
      updatedAt: checkpoint.updatedAt,
    });
  }

  if (checkpoint.status === 'failed') {
    return createOperationLifecycleState({
      stage: 'recoverable',
      txid: checkpoint.txHash,
      error: checkpoint.error,
      updatedAt: checkpoint.updatedAt,
    });
  }

  return createOperationLifecycleState({
    stage: 'pending',
    txid: checkpoint.txHash,
    updatedAt: checkpoint.updatedAt,
  });
}

function checkpointNoun(kind: EvmTransactionCheckpointKind): string {
  if (kind === 'swap') return 'Sepolia swap';
  if (kind === 'redemption') return 'Sepolia redemption';
  if (kind === 'approval') return 'Sepolia approval';
  return 'Sepolia transfer';
}

export function getEvmCheckpointActionCopy(
  checkpoint: EvmTransactionCheckpoint,
): EvmCheckpointActionCopy {
  const noun = checkpointNoun(checkpoint.kind);

  if (checkpoint.status === 'confirmed') {
    return {
      title: `${noun} confirmed`,
      body: 'This transaction is confirmed on Sepolia. If the app still looks stale, refresh balances and history.',
      primaryLabel: 'Check status',
      statusLabel: 'Confirmed',
      retryable: false,
    };
  }

  if (checkpoint.status === 'failed') {
    return {
      title: `${noun} failed`,
      body: 'The transaction failed or reverted. It is safe to retry after checking balances and gas.',
      primaryLabel: 'Check status again',
      statusLabel: 'Failed, safe to retry',
      retryable: true,
    };
  }

  return {
    title: `Pending ${noun.toLowerCase()}`,
    body: 'This transaction was submitted and is still being checked. Do not submit another matching operation until it is confirmed or failed.',
    primaryLabel: checkpoint.kind === 'transfer' ? 'Check pending Sepolia transfer' : 'Check pending Sepolia transaction',
    statusLabel: 'Still pending',
    retryable: false,
  };
}
