import { create } from 'zustand';

export const MAX_SWAP_DIAGNOSTIC_POLLS = 100;
export const MAX_UNIT_USDC_POOL_SNAPSHOTS = 24;

export type SwapDiagnosticKind =
  | 'bridge_settlement'
  | 'redemption_release'
  | 'liquidation_vaults'
  | 'liquidation_mempool'
  | 'liquidation_swap_broadcast'
  | 'transaction_confirmation'
  | 'turbo_token_processor'
  | 'unit_usdc_pool_dashboard';

export type SwapDiagnosticStatus =
  | 'idle'
  | 'active'
  | 'success'
  | 'error'
  | 'timeout'
  | 'stopped';

export type SwapDiagnosticMetadataValue = string | number | boolean | null;
export type SwapDiagnosticMetadata = Record<string, SwapDiagnosticMetadataValue>;
type SwapDiagnosticMetadataInput = Record<string, SwapDiagnosticMetadataValue | undefined>;

export interface SwapDiagnosticPoll {
  id: string;
  kind: SwapDiagnosticKind;
  label: string;
  status: SwapDiagnosticStatus;
  subject: string | null;
  attempts: number;
  intervalMs: number | null;
  timeoutMs: number | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  lastStatus: string | null;
  lastMessage: string | null;
  lastError: string | null;
  metadata: SwapDiagnosticMetadata;
}

export interface UnitUsdcPoolSnapshot {
  id: string;
  checkedAt: number;
  recordedAt: number;
  status: 'ready' | 'degraded' | 'unconfigured' | 'error';
  readiness: {
    sepoliaRpc: boolean;
    bridgeApi: boolean;
    usdc: boolean;
    wunit: boolean;
    stablePool: boolean;
    bridgeRouter: boolean;
    poolContracts: boolean;
    bridgeContracts: boolean;
  };
  reserves: {
    usdc: string;
    wunit: string;
  } | null;
  impliedUnitPriceUsdc: string | null;
  imbalanceBps: number | null;
  maxInputAmount: string | null;
  quoteSamples: Array<{
    amountIn: string;
    unitToUsdcOut: string;
    unitToUsdcImpactBps: number;
    usdcToUnitOut: string;
    usdcToUnitImpactBps: number;
  }>;
  error: string | null;
}

interface StartPollInput {
  id?: string;
  kind: SwapDiagnosticKind;
  label: string;
  subject?: string | null;
  intervalMs?: number | null;
  timeoutMs?: number | null;
  metadata?: SwapDiagnosticMetadataInput;
}

interface PollUpdateInput {
  lastStatus?: string | null;
  lastMessage?: string | null;
  lastError?: string | null;
  metadata?: SwapDiagnosticMetadataInput;
}

interface CompletePollInput extends PollUpdateInput {
  status: Exclude<SwapDiagnosticStatus, 'idle' | 'active'>;
}

interface SwapDiagnosticsState {
  polls: SwapDiagnosticPoll[];
  unitUsdcPoolSnapshots: UnitUsdcPoolSnapshot[];
}

interface SwapDiagnosticsActions {
  startPoll: (input: StartPollInput) => string;
  recordAttempt: (id: string, input?: PollUpdateInput) => void;
  completePoll: (id: string, input: CompletePollInput) => void;
  stopPoll: (id: string, message?: string) => void;
  recordUnitUsdcPoolSnapshot: (input: Omit<UnitUsdcPoolSnapshot, 'id' | 'recordedAt'>) => void;
  clearUnitUsdcPoolSnapshots: () => void;
  clearCompleted: () => void;
  reset: () => void;
}

type SwapDiagnosticsStore = SwapDiagnosticsState & SwapDiagnosticsActions;

const initialState: SwapDiagnosticsState = {
  polls: [],
  unitUsdcPoolSnapshots: [],
};

function generatePollId(input: StartPollInput, now: number): string {
  const subject = input.subject ? `:${input.subject}` : '';
  return `${input.kind}${subject}:${now}`;
}

function sanitizeMetadata(metadata?: SwapDiagnosticMetadataInput): SwapDiagnosticMetadata {
  if (!metadata) return {};

  return Object.entries(metadata).reduce<SwapDiagnosticMetadata>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function mergeMetadata(
  current: SwapDiagnosticMetadata,
  next?: SwapDiagnosticMetadataInput,
): SwapDiagnosticMetadata {
  if (!next) return current;
  return {
    ...current,
    ...sanitizeMetadata(next),
  };
}

function trimPolls(polls: SwapDiagnosticPoll[]): SwapDiagnosticPoll[] {
  return [...polls]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SWAP_DIAGNOSTIC_POLLS);
}

function trimUnitUsdcPoolSnapshots(snapshots: UnitUsdcPoolSnapshot[]): UnitUsdcPoolSnapshot[] {
  return [...snapshots]
    .sort((a, b) => b.checkedAt - a.checkedAt || b.recordedAt - a.recordedAt)
    .slice(0, MAX_UNIT_USDC_POOL_SNAPSHOTS);
}

function isTerminalStatus(status: SwapDiagnosticStatus): boolean {
  return status === 'success' || status === 'error' || status === 'timeout' || status === 'stopped';
}

export const useSwapDiagnosticsStore = create<SwapDiagnosticsStore>((set) => ({
  ...initialState,

  startPoll: (input) => {
    const now = Date.now();
    const id = input.id ?? generatePollId(input, now);
    const poll: SwapDiagnosticPoll = {
      id,
      kind: input.kind,
      label: input.label,
      status: 'active',
      subject: input.subject ?? null,
      attempts: 0,
      intervalMs: input.intervalMs ?? null,
      timeoutMs: input.timeoutMs ?? null,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      lastStatus: null,
      lastMessage: null,
      lastError: null,
      metadata: sanitizeMetadata(input.metadata),
    };

    set((state) => ({
      polls: trimPolls([
        poll,
        ...state.polls.filter((existing) => existing.id !== id),
      ]),
    }));

    return id;
  },

  recordAttempt: (id, input = {}) => {
    const now = Date.now();
    set((state) => ({
      polls: state.polls.map((poll) => {
        if (poll.id !== id) return poll;
        if (isTerminalStatus(poll.status)) return poll;

        return {
          ...poll,
          status: 'active',
          attempts: poll.attempts + 1,
          updatedAt: now,
          lastStatus: input.lastStatus ?? poll.lastStatus,
          lastMessage: input.lastMessage ?? poll.lastMessage,
          lastError: input.lastError ?? poll.lastError,
          metadata: mergeMetadata(poll.metadata, input.metadata),
        };
      }),
    }));
  },

  completePoll: (id, input) => {
    const now = Date.now();
    set((state) => ({
      polls: state.polls.map((poll) => {
        if (poll.id !== id) return poll;

        return {
          ...poll,
          status: input.status,
          updatedAt: now,
          completedAt: now,
          lastStatus: input.lastStatus ?? poll.lastStatus,
          lastMessage: input.lastMessage ?? poll.lastMessage,
          lastError: input.lastError ?? poll.lastError,
          metadata: mergeMetadata(poll.metadata, input.metadata),
        };
      }),
    }));
  },

  stopPoll: (id, message = 'Polling stopped') => {
    const now = Date.now();
    set((state) => ({
      polls: state.polls.map((poll) => {
        if (poll.id !== id || isTerminalStatus(poll.status)) return poll;

        return {
          ...poll,
          status: 'stopped',
          updatedAt: now,
          completedAt: now,
          lastMessage: message,
        };
      }),
    }));
  },

  recordUnitUsdcPoolSnapshot: (input) => {
    const recordedAt = Date.now();
    const snapshot: UnitUsdcPoolSnapshot = {
      ...input,
      id: `unit-usdc-pool:${input.checkedAt}:${recordedAt}`,
      recordedAt,
    };

    set((state) => ({
      unitUsdcPoolSnapshots: trimUnitUsdcPoolSnapshots([
        snapshot,
        ...state.unitUsdcPoolSnapshots,
      ]),
    }));
  },

  clearUnitUsdcPoolSnapshots: () =>
    set({
      unitUsdcPoolSnapshots: [],
    }),

  clearCompleted: () =>
    set((state) => ({
      polls: state.polls.filter((poll) => !isTerminalStatus(poll.status)),
    })),

  reset: () => set(initialState),
}));

export const resetSwapDiagnosticsStore = (): void => {
  useSwapDiagnosticsStore.getState().reset();
};
