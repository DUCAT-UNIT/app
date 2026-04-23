import { create } from 'zustand';

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
  bridgeDepositAddress: string | null;
  bridgeSendTxid: string | null;
  redemptionId: string | null;
  redemptionBurnTxHash: string | null;
  payoutAsset: VaultSettlementPayoutAsset | null;
  payoutAmount: string | null;
  error: string | null;
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
  setBridgeIntent: (intentId: string, depositAddress: string) => void;
  setBridgeSendTxid: (txid: string) => void;
  setRedemptionResult: (redemptionId: string, burnTxHash: string) => void;
  completeSettlement: (asset: VaultSettlementPayoutAsset, amount: string | null) => void;
  markPendingSettlement: (error?: string | null) => void;
  markNeedsRetry: (error: string) => void;
  reset: () => void;
}

type VaultSettlementStore = VaultSettlementState & VaultSettlementActions;

const initialState: VaultSettlementState = {
  kind: null,
  phase: 'idle',
  faceValueUsd: 0,
  requestedPayoutAsset: 'USDC',
  estimatedUsdcOut: null,
  minimumUsdcOut: null,
  requiredUsdcIn: null,
  estimatedSepoliaFeeEth: null,
  issueTxid: null,
  vaultTxid: null,
  bridgeIntentId: null,
  bridgeDepositAddress: null,
  bridgeSendTxid: null,
  redemptionId: null,
  redemptionBurnTxHash: null,
  payoutAsset: null,
  payoutAmount: null,
  error: null,
};

export const useVaultSettlementStore = create<VaultSettlementStore>((set) => ({
  ...initialState,

  startOperation: (kind, faceValueUsd, requestedPayoutAsset = 'USDC') =>
    set({
      ...initialState,
      kind,
      faceValueUsd,
      requestedPayoutAsset,
      phase: 'quoting',
    }),

  setQuote: (estimatedUsdcOut, minimumUsdcOut) =>
    set({
      estimatedUsdcOut,
      minimumUsdcOut,
    }),

  setRepayQuote: (requiredUsdcIn, estimatedSepoliaFeeEth) =>
    set({
      requiredUsdcIn,
      estimatedSepoliaFeeEth,
    }),

  setPhase: (phase) => set({ phase }),

  setIssueResult: (issueTxid, vaultTxid = null) =>
    set({
      issueTxid,
      vaultTxid,
    }),

  setBridgeIntent: (bridgeIntentId, bridgeDepositAddress) =>
    set({
      bridgeIntentId,
      bridgeDepositAddress,
    }),

  setBridgeSendTxid: (bridgeSendTxid) => set({ bridgeSendTxid }),

  setRedemptionResult: (redemptionId, redemptionBurnTxHash) =>
    set({
      redemptionId,
      redemptionBurnTxHash,
    }),

  completeSettlement: (payoutAsset, payoutAmount) =>
    set({
      phase: 'settled',
      payoutAsset,
      payoutAmount,
      error: null,
    }),

  markPendingSettlement: (error = null) =>
    set({
      phase: 'pending_settlement',
      error,
    }),

  markNeedsRetry: (error) =>
    set({
      phase: 'needs_retry',
      error,
    }),

  reset: () => set(initialState),
}));
