import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VaultSettlementKind = 'borrow' | 'open' | 'repay';
export type VaultSettlementRequestedAsset = 'USDC' | 'UNIT' | 'TURBOUNIT';

export type VaultSettlementPhase =
  | 'idle'
  | 'quoting'
  | 'issuing_vault'
  | 'creating_bridge'
  | 'building_bridge_send'
  | 'signing_bridge_send'
  | 'broadcasting_bridge_send'
  | 'waiting_bridge_fulfillment'
  | 'creating_turbo_mint'
  | 'building_turbo_send'
  | 'signing_turbo_send'
  | 'broadcasting_turbo_send'
  | 'waiting_turbo_mint'
  | 'melting_turbo_repay'
  | 'waiting_turbo_release'
  | 'swapping_repay'
  | 'waiting_redemption_release'
  | 'repaying_vault'
  | 'settled'
  | 'pending_settlement'
  | 'needs_retry';

export type VaultSettlementPayoutAsset = 'USDC' | 'wUNIT' | 'UNIT' | 'TURBOUNIT';

interface VaultSettlementState {
  accountIndex: number | null;
  taprootAddress: string | null;
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
  cashuMintQuoteId: string | null;
  cashuMintDepositAddress: string | null;
  cashuMintSendTxid: string | null;
  cashuMeltQuoteId: string | null;
  cashuMeltTxid: string | null;
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
    context?: {
      accountIndex?: number | null;
      taprootAddress?: string | null;
    }
  ) => void;
  setQuote: (estimatedUsdcOut: string | null, minimumUsdcOut: string | null) => void;
  setRepayQuote: (requiredUsdcIn: string | null, estimatedSepoliaFeeEth: string | null) => void;
  setPhase: (phase: VaultSettlementPhase) => void;
  setIssueResult: (issueTxid: string, vaultTxid?: string | null) => void;
  setBridgeClientRequestId: (clientRequestId: string) => void;
  setBridgeIntent: (intentId: string, depositAddress: string) => void;
  setBridgeSendTxid: (txid: string | null) => void;
  setCashuMintQuote: (quoteId: string, depositAddress: string) => void;
  setCashuMintSendTxid: (txid: string | null) => void;
  setCashuMeltQuote: (quoteId: string) => void;
  setCashuMeltTxid: (txid: string) => void;
  setRedemptionResult: (redemptionId: string, burnTxHash: string) => void;
  completeSettlement: (
    asset: VaultSettlementPayoutAsset,
    amount: string | null,
    sepoliaTxHash?: string | null
  ) => void;
  markPendingSettlement: (error?: string | null) => void;
  markNeedsRetry: (error: string) => void;
  reset: () => void;
}

type VaultSettlementStore = VaultSettlementState & VaultSettlementActions;

export const VAULT_SETTLEMENT_STORAGE_KEY = 'vault-settlement';
export const VAULT_SETTLEMENT_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;

const settlementKinds: VaultSettlementKind[] = ['borrow', 'open', 'repay'];
const requestedAssets: VaultSettlementRequestedAsset[] = ['USDC', 'UNIT', 'TURBOUNIT'];
const phases: VaultSettlementPhase[] = [
  'idle',
  'quoting',
  'issuing_vault',
  'creating_bridge',
  'building_bridge_send',
  'signing_bridge_send',
  'broadcasting_bridge_send',
  'waiting_bridge_fulfillment',
  'creating_turbo_mint',
  'building_turbo_send',
  'signing_turbo_send',
  'broadcasting_turbo_send',
  'waiting_turbo_mint',
  'melting_turbo_repay',
  'waiting_turbo_release',
  'swapping_repay',
  'waiting_redemption_release',
  'repaying_vault',
  'settled',
  'pending_settlement',
  'needs_retry',
];
const payoutAssets: VaultSettlementPayoutAsset[] = ['USDC', 'wUNIT', 'UNIT', 'TURBOUNIT'];

export const initialVaultSettlementState: VaultSettlementState = {
  accountIndex: null,
  taprootAddress: null,
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
  cashuMintQuoteId: null,
  cashuMintDepositAddress: null,
  cashuMintSendTxid: null,
  cashuMeltQuoteId: null,
  cashuMeltTxid: null,
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

export function resolveVaultSettlementRequestedAsset(
  asset: VaultSettlementRequestedAsset,
  allowUsdc: boolean
): VaultSettlementRequestedAsset {
  return asset === 'USDC' && !allowUsdc ? 'UNIT' : asset;
}

export function requiresVaultSettlementUnitSend(
  asset: VaultSettlementRequestedAsset | null | undefined
): boolean {
  return asset === 'USDC' || asset === 'TURBOUNIT';
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function isActiveSettlement(state: VaultSettlementState): boolean {
  return state.phase !== 'idle' && state.phase !== 'settled' && state.kind !== null;
}

function isRecoveryCriticalPhase(phase: VaultSettlementPhase): boolean {
  return phase !== 'idle' && phase !== 'settled';
}

export function shouldPreserveVaultSettlementRecovery(phase: VaultSettlementPhase): boolean {
  return isRecoveryCriticalPhase(phase);
}

export function normalizeVaultSettlementPersistedState(
  value: unknown,
  now = Date.now()
): VaultSettlementState {
  if (!isRecord(value)) {
    return { ...initialVaultSettlementState };
  }

  const phase = isOneOf(value.phase, phases) ? value.phase : null;
  const kind =
    value.kind === null || value.kind === undefined
      ? null
      : isOneOf(value.kind, settlementKinds)
        ? value.kind
        : null;
  const updatedAt = finiteNonNegative(value.updatedAt);
  const boundedUpdatedAt = updatedAt > now + 60_000 ? now : updatedAt;
  const isStale = boundedUpdatedAt > 0 && now - boundedUpdatedAt > VAULT_SETTLEMENT_PERSIST_TTL_MS;

  if (!phase || (isStale && !isRecoveryCriticalPhase(phase)) || (phase !== 'idle' && !kind)) {
    return { ...initialVaultSettlementState };
  }

  return {
    ...initialVaultSettlementState,
    accountIndex: integerOrNull(value.accountIndex),
    taprootAddress: stringOrNull(value.taprootAddress),
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
    cashuMintQuoteId: stringOrNull(value.cashuMintQuoteId),
    cashuMintDepositAddress: stringOrNull(value.cashuMintDepositAddress),
    cashuMintSendTxid: stringOrNull(value.cashuMintSendTxid),
    cashuMeltQuoteId: stringOrNull(value.cashuMeltQuoteId),
    cashuMeltTxid: stringOrNull(value.cashuMeltTxid),
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
    accountIndex: state.accountIndex,
    taprootAddress: state.taprootAddress,
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
    cashuMintQuoteId: state.cashuMintQuoteId,
    cashuMintDepositAddress: state.cashuMintDepositAddress,
    cashuMintSendTxid: state.cashuMintSendTxid,
    cashuMeltQuoteId: state.cashuMeltQuoteId,
    cashuMeltTxid: state.cashuMeltTxid,
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

        startOperation: (kind, faceValueUsd, requestedPayoutAsset = 'UNIT', context = {}) => {
          const current = useVaultSettlementStore.getState();
          const nextAccountIndex = context.accountIndex ?? null;
          const nextTaprootAddress = context.taprootAddress ?? null;

          if (isActiveSettlement(current)) {
            const accountMismatch =
              current.accountIndex !== null &&
              nextAccountIndex !== null &&
              current.accountIndex !== nextAccountIndex;
            const addressMismatch =
              current.taprootAddress !== null &&
              nextTaprootAddress !== null &&
              current.taprootAddress !== nextTaprootAddress;

            if (accountMismatch || addressMismatch) {
              throw new Error('A vault settlement is still pending on another wallet account.');
            }

            if (
              current.kind === kind &&
              current.faceValueUsd === faceValueUsd &&
              current.requestedPayoutAsset === requestedPayoutAsset
            ) {
              return;
            }

            throw new Error('A vault settlement is still pending. Resume or reset it before starting another.');
          }

          update({
            ...initialVaultSettlementState,
            accountIndex: nextAccountIndex,
            taprootAddress: nextTaprootAddress,
            kind,
            faceValueUsd,
            requestedPayoutAsset,
            phase: 'quoting',
          });
        },

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

        setCashuMintQuote: (cashuMintQuoteId, cashuMintDepositAddress) =>
          update({
            cashuMintQuoteId,
            cashuMintDepositAddress,
          }),

        setCashuMintSendTxid: (cashuMintSendTxid) => update({ cashuMintSendTxid }),

        setCashuMeltQuote: (cashuMeltQuoteId) => update({ cashuMeltQuoteId }),

        setCashuMeltTxid: (cashuMeltTxid) => update({ cashuMeltTxid }),

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
    }
  )
);

export const resetVaultSettlementStore = () => {
  useVaultSettlementStore.setState(initialVaultSettlementState);
};

export const persistVaultSettlementNow = async (): Promise<void> => {
  await AsyncStorage.setItem(
    VAULT_SETTLEMENT_STORAGE_KEY,
    JSON.stringify({
      state: persistableState(useVaultSettlementStore.getState()),
      version: 1,
    }),
  );
};
