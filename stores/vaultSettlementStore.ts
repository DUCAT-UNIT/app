import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VaultSettlementKind = 'borrow' | 'open' | 'repay';
export type VaultSettlementRequestedAsset = 'USDC' | 'UNIT';

export type VaultSettlementPhase =
  | 'idle'
  | 'quoting'
  | 'issuing_vault'
  | 'creating_bridge'
  | 'building_bridge_send'
  | 'signing_bridge_send'
  | 'broadcasting_bridge_send'
  | 'waiting_bridge_fulfillment'
  | 'swapping_repay'
  | 'waiting_redemption_release'
  | 'repaying_vault'
  | 'settled'
  | 'pending_settlement'
  | 'needs_retry';

export type VaultSettlementPayoutAsset = 'USDC' | 'wUNIT' | 'UNIT';

interface VaultSettlementState {
  kind: VaultSettlementKind | null;
  phase: VaultSettlementPhase;
  faceValueUsd: number;
  requestedPayoutAsset: VaultSettlementRequestedAsset;
  estimatedUsdcOut: string | null;
  minimumUsdcOut: string | null;
  requiredUsdcIn: string | null;
  estimatedSepoliaFeeEth: string | null;
  issueTxid: string | null;
  vaultTxid: string | null;
  bridgeIntentId: string | null;
  bridgeClientRequestId: string | null;
  bridgeDepositAddress: string | null;
  bridgeSendTxid: string | null;
  sepoliaTxHash: string | null;
  redemptionId: string | null;
  redemptionBurnTxHash: string | null;
  payoutAsset: VaultSettlementPayoutAsset | null;
  payoutAmount: string | null;
  error: string | null;
  updatedAt: number;
}

interface VaultSettlementActions {
  startOperation: (
    kind: VaultSettlementKind,
    faceValueUsd: number,
    requestedPayoutAsset?: VaultSettlementRequestedAsset,
  ) => void;
  setQuote: (estimatedUsdcOut: string | null, minimumUsdcOut: string | null) => void;
  setRepayQuote: (requiredUsdcIn: string | null, estimatedSepoliaFeeEth: string | null) => void;
  setPhase: (phase: VaultSettlementPhase) => void;
  setIssueResult: (issueTxid: string, vaultTxid?: string | null) => void;
  setBridgeClientRequestId: (clientRequestId: string) => void;
  setBridgeIntent: (intentId: string, depositAddress: string) => void;
  setBridgeSendTxid: (txid: string) => void;
  setRedemptionResult: (redemptionId: string, burnTxHash: string) => void;
  completeSettlement: (
    asset: VaultSettlementPayoutAsset,
    amount: string | null,
    sepoliaTxHash?: string | null,
  ) => void;
  markPendingSettlement: (error?: string | null) => void;
  markNeedsRetry: (error: string) => void;
  reset: () => void;
}

type VaultSettlementStore = VaultSettlementState & VaultSettlementActions;

export const VAULT_SETTLEMENT_STORAGE_KEY = 'vault-settlement';
export const VAULT_SETTLEMENT_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;

const settlementKinds: VaultSettlementKind[] = ['borrow', 'open', 'repay'];
const requestedAssets: VaultSettlementRequestedAsset[] = ['USDC', 'UNIT'];
const phases: VaultSettlementPhase[] = [
  'idle',
  'quoting',
  'issuing_vault',
  'creating_bridge',
  'building_bridge_send',
  'signing_bridge_send',
  'broadcasting_bridge_send',
  'waiting_bridge_fulfillment',
  'swapping_repay',
  'waiting_redemption_release',
  'repaying_vault',
  'settled',
  'pending_settlement',
  'needs_retry',
];
const payoutAssets: VaultSettlementPayoutAsset[] = ['USDC', 'wUNIT', 'UNIT'];

export const initialVaultSettlementState: VaultSettlementState = {
  kind: null,
  phase: 'idle',
  faceValueUsd: 0,
  requestedPayoutAsset: 'UNIT',
  estimatedUsdcOut: null,
  minimumUsdcOut: null,
  requiredUsdcIn: null,
  estimatedSepoliaFeeEth: null,
  issueTxid: null,
  vaultTxid: null,
  bridgeIntentId: null,
  bridgeClientRequestId: null,
  bridgeDepositAddress: null,
  bridgeSendTxid: null,
  sepoliaTxHash: null,
  redemptionId: null,
  redemptionBurnTxHash: null,
  payoutAsset: null,
  payoutAmount: null,
  error: null,
  updatedAt: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeVaultSettlementPersistedState(
  value: unknown,
  now = Date.now(),
): VaultSettlementState {
  if (!isRecord(value)) {
    return { ...initialVaultSettlementState };
  }

  const phase = isOneOf(value.phase, phases) ? value.phase : null;
  const kind = value.kind === null || value.kind === undefined
    ? null
    : isOneOf(value.kind, settlementKinds)
      ? value.kind
      : null;
  const updatedAt = finiteNonNegative(value.updatedAt);
  const boundedUpdatedAt = updatedAt > now + 60_000 ? now : updatedAt;
  const isStale = boundedUpdatedAt > 0 && now - boundedUpdatedAt > VAULT_SETTLEMENT_PERSIST_TTL_MS;

  if (!phase || isStale || (phase !== 'idle' && !kind)) {
    return { ...initialVaultSettlementState };
  }

  return {
    ...initialVaultSettlementState,
    kind,
    phase,
    faceValueUsd: finiteNonNegative(value.faceValueUsd),
    requestedPayoutAsset: isOneOf(value.requestedPayoutAsset, requestedAssets)
      ? value.requestedPayoutAsset
      : 'UNIT',
    estimatedUsdcOut: stringOrNull(value.estimatedUsdcOut),
    minimumUsdcOut: stringOrNull(value.minimumUsdcOut),
    requiredUsdcIn: stringOrNull(value.requiredUsdcIn),
    estimatedSepoliaFeeEth: stringOrNull(value.estimatedSepoliaFeeEth),
    issueTxid: stringOrNull(value.issueTxid),
    vaultTxid: stringOrNull(value.vaultTxid),
    bridgeIntentId: stringOrNull(value.bridgeIntentId),
    bridgeClientRequestId: stringOrNull(value.bridgeClientRequestId),
    bridgeDepositAddress: stringOrNull(value.bridgeDepositAddress),
    bridgeSendTxid: stringOrNull(value.bridgeSendTxid),
    sepoliaTxHash: stringOrNull(value.sepoliaTxHash),
    redemptionId: stringOrNull(value.redemptionId),
    redemptionBurnTxHash: stringOrNull(value.redemptionBurnTxHash),
    payoutAsset: isOneOf(value.payoutAsset, payoutAssets) ? value.payoutAsset : null,
    payoutAmount: stringOrNull(value.payoutAmount),
    error: stringOrNull(value.error),
    updatedAt: boundedUpdatedAt,
  };
}

function persistableState(state: VaultSettlementStore): VaultSettlementState {
  return {
    kind: state.kind,
    phase: state.phase,
    faceValueUsd: state.faceValueUsd,
    requestedPayoutAsset: state.requestedPayoutAsset,
    estimatedUsdcOut: state.estimatedUsdcOut,
    minimumUsdcOut: state.minimumUsdcOut,
    requiredUsdcIn: state.requiredUsdcIn,
    estimatedSepoliaFeeEth: state.estimatedSepoliaFeeEth,
    issueTxid: state.issueTxid,
    vaultTxid: state.vaultTxid,
    bridgeIntentId: state.bridgeIntentId,
    bridgeClientRequestId: state.bridgeClientRequestId,
    bridgeDepositAddress: state.bridgeDepositAddress,
    bridgeSendTxid: state.bridgeSendTxid,
    sepoliaTxHash: state.sepoliaTxHash,
    redemptionId: state.redemptionId,
    redemptionBurnTxHash: state.redemptionBurnTxHash,
    payoutAsset: state.payoutAsset,
    payoutAmount: state.payoutAmount,
    error: state.error,
    updatedAt: state.updatedAt,
  };
}

export const useVaultSettlementStore = create<VaultSettlementStore>()(
  persist(
    (set) => {
      const update = (partial: Partial<VaultSettlementState>) =>
        set({
          ...partial,
          updatedAt: Date.now(),
        });

      return {
        ...initialVaultSettlementState,

        startOperation: (kind, faceValueUsd, requestedPayoutAsset = 'UNIT') =>
          update({
            ...initialVaultSettlementState,
            kind,
            faceValueUsd,
            requestedPayoutAsset,
            phase: 'quoting',
          }),

        setQuote: (estimatedUsdcOut, minimumUsdcOut) =>
          update({
            estimatedUsdcOut,
            minimumUsdcOut,
          }),

        setRepayQuote: (requiredUsdcIn, estimatedSepoliaFeeEth) =>
          update({
            requiredUsdcIn,
            estimatedSepoliaFeeEth,
          }),

        setPhase: (phase) => update({ phase }),

        setIssueResult: (issueTxid, vaultTxid = null) =>
          update({
            issueTxid,
            vaultTxid,
          }),

        setBridgeClientRequestId: (bridgeClientRequestId) =>
          update({
            bridgeClientRequestId,
          }),

        setBridgeIntent: (bridgeIntentId, bridgeDepositAddress) =>
          update({
            bridgeIntentId,
            bridgeDepositAddress,
          }),

        setBridgeSendTxid: (bridgeSendTxid) => update({ bridgeSendTxid }),

        setRedemptionResult: (redemptionId, redemptionBurnTxHash) =>
          update({
            redemptionId,
            redemptionBurnTxHash,
          }),

        completeSettlement: (payoutAsset, payoutAmount, sepoliaTxHash = null) =>
          update({
            phase: 'settled',
            payoutAsset,
            payoutAmount,
            sepoliaTxHash,
            error: null,
          }),

        markPendingSettlement: (error = null) =>
          update({
            phase: 'pending_settlement',
            error,
          }),

        markNeedsRetry: (error) =>
          update({
            phase: 'needs_retry',
            error,
          }),

        reset: () => set(initialVaultSettlementState),
      };
    },
    {
      name: VAULT_SETTLEMENT_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: persistableState,
      migrate: (persistedState) => normalizeVaultSettlementPersistedState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeVaultSettlementPersistedState(persistedState),
      }),
    },
  ),
);

export const resetVaultSettlementStore = () => {
  useVaultSettlementStore.setState(initialVaultSettlementState);
};
