export type BridgeIntentStatus =
  | 'pending'
  | 'confirmed'
  | 'fulfilled'
  | 'minted_no_swap'
  | 'failed';

export type RedemptionStatus =
  | 'pending_burn'
  | 'pending_release'
  | 'released'
  | 'failed';

export interface BridgeIntent {
  id: string;
  clientRequestId?: string;
  createdAt: string;
  updatedAt: string;
  depositAddress: string;
  depositIndex?: number;
  depositTxid?: string;
  sepoliaRecipient: string;
  amount: string;
  autoSwap: boolean;
  status: BridgeIntentStatus;
  confirmations?: number;
  receivedAmount?: string;
  fulfilledAmount?: string;
  payoutAsset?: 'USDC' | 'wUNIT';
  payoutAmount?: string;
  sepoliaTxHash?: string;
  error?: string;
  requiresManualRecovery?: boolean;
}

export interface BridgeDeposit {
  id: string;
  intentId: string;
  txid: string;
  amount: string;
  confirmations: number;
  observedAt: string;
  custodyAddress: string;
  exactMatch: boolean;
}

export interface RedemptionRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
  requester: string;
  destinationTaprootAddress: string;
  amount: string;
  sourceAsset: 'wUNIT' | 'USDC';
  burnTxHash?: string;
  releaseTxid?: string;
  status: RedemptionStatus;
  error?: string;
}

export interface PoolPosition {
  reserveWunit: string;
  reserveUsdc: string;
  amplification: number;
  swapFeeBps: number;
  totalLpSupply: string;
  virtualPrice?: string;
  paused?: boolean;
}

export interface ReconciliationSnapshot {
  asOf: string;
  lockedUnit: string;
  circulatingWunit: string;
  pendingReleaseUnit: string;
  availableBacking: string;
  isBacked: boolean;
  drift: string;
  alert?: string;
}

export interface CreateBridgeIntentRequest {
  amount: string;
  autoSwap?: boolean;
  clientRequestId?: string;
  sepoliaRecipient: string;
}

export interface CreateBridgeIntentResponse {
  intent: BridgeIntent;
}

export interface QuoteSwapRequest {
  tokenIn: 'USDC' | 'wUNIT';
  amountIn: string;
}

export interface SwapQuote {
  tokenIn: 'USDC' | 'wUNIT';
  tokenOut: 'USDC' | 'wUNIT';
  amountIn: string;
  amountOut: string;
  minimumAmountOut: string;
  feeBps: number;
  route: 'stable_pool';
}

export interface TrackRedemptionRequest {
  id: string;
  requester: string;
  destinationTaprootAddress: string;
  amount: string;
  sourceAsset: 'wUNIT' | 'USDC';
  burnTxHash: string;
}
