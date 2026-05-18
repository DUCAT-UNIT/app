import {
  getBridgeIntentByClientRequestId,
  getBridgeStatus,
  getRedemptionStatus,
} from './bridgeApiService';
import { checkMeltQuote, checkMintQuote, deriveMintQuoteState } from './cashu/cashuMintClient';
import type { MeltQuote } from './cashu/cashuMintClient';
import {
  estimateUsdcToUnitSwapExecution,
  quoteUnitUsdcSwap,
  quoteUsdcForExactWunit,
} from './evmBridgeService';
import { logger } from '../utils/logger';
import type { BridgeIntent, RedemptionRequest } from '../shared/bridgeTypes';
import { useSwapDiagnosticsStore } from '../stores/swapDiagnosticsStore';
import {
  useVaultSettlementStore,
  type VaultSettlementKind,
  type VaultSettlementPhase,
  type VaultSettlementPayoutAsset,
} from '../stores/vaultSettlementStore';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';

const BRIDGE_POLL_INTERVAL_MS = 4_000;
// Live Mutinynet -> Sepolia settlement needs at least one Mutinynet confirmation,
// backend detection, Sepolia execution, and one Sepolia confirmation. In practice
// that routinely exceeds 2 minutes on testnet, so keep the user on the processing
// screen longer to reach the final USDC result instead of timing out prematurely.
const BRIDGE_SETTLEMENT_TIMEOUT_MS = 720_000;
const REDEMPTION_POLL_INTERVAL_MS = 8_000;
const REDEMPTION_RELEASE_TIMEOUT_MS = 360_000;
const ACCEPTED_TURBO_MELT_STATES = new Set(['PAID', 'PENDING']);
const FAILED_TURBO_MELT_STATES = new Set(['FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED']);

type RecoverableMeltQuote = MeltQuote & {
  txid?: string | null;
  outpoint?: string | null;
  payment_preimage?: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatVaultSettlementAmountInput(amountUsd: number): string {
  return amountUsd
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

export async function quoteVaultBorrowSettlement(amountUsd: number): Promise<{
  estimatedUsdcOut: string;
  minimumUsdcOut: string;
}> {
  const amountIn = formatVaultSettlementAmountInput(amountUsd);
  const quote = await quoteUnitUsdcSwap('UNIT', amountIn);

  return {
    estimatedUsdcOut: quote.amountOut,
    minimumUsdcOut: quote.minimumAmountOut,
  };
}

export async function quoteVaultRepaySettlement(
  accountIndex: number,
  amountUsd: number,
  destinationTaprootAddress: string
): Promise<{
  requiredUsdcIn: string;
  estimatedSepoliaFeeEth: string;
}> {
  const amountOut = formatVaultSettlementAmountInput(amountUsd);
  const requiredUsdcIn = await quoteUsdcForExactWunit(amountOut);
  const gasEstimate = await estimateUsdcToUnitSwapExecution(
    accountIndex,
    requiredUsdcIn,
    destinationTaprootAddress
  );

  return {
    requiredUsdcIn,
    estimatedSepoliaFeeEth: gasEstimate.totalFeeEth,
  };
}

export async function waitForBridgeSettlement(
  intentId: string,
  timeoutMs = BRIDGE_SETTLEMENT_TIMEOUT_MS
): Promise<BridgeIntent> {
  const deadline = Date.now() + timeoutMs;
  const pollId = useSwapDiagnosticsStore.getState().startPoll({
    id: `bridge:${intentId}`,
    kind: 'bridge_settlement',
    label: 'Bridge settlement',
    subject: intentId,
    intervalMs: BRIDGE_POLL_INTERVAL_MS,
    timeoutMs,
  });

  while (Date.now() < deadline) {
    let intent: BridgeIntent;
    try {
      intent = await getBridgeStatus(intentId);
    } catch (error: unknown) {
      useSwapDiagnosticsStore.getState().completePoll(pollId, {
        status: 'error',
        lastError: getErrorMessage(error),
      });
      throw error;
    }

    useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
      lastStatus: intent.status,
      metadata: {
        autoSwap: intent.autoSwap,
        confirmations: intent.confirmations ?? null,
        depositTxid: intent.depositTxid ?? null,
        payoutAsset: intent.payoutAsset ?? null,
        payoutAmount: intent.payoutAmount ?? null,
        sepoliaTxHash: intent.sepoliaTxHash ?? null,
        requiresManualRecovery: intent.requiresManualRecovery ?? null,
      },
    });

    if (
      intent.status === 'fulfilled' ||
      intent.status === 'minted_no_swap' ||
      intent.status === 'failed'
    ) {
      useSwapDiagnosticsStore.getState().completePoll(pollId, {
        status: intent.status === 'failed' ? 'error' : 'success',
        lastStatus: intent.status,
        lastMessage:
          intent.status === 'failed' ? 'Bridge settlement failed' : 'Bridge settlement completed',
        lastError: intent.error ?? null,
      });
      return intent;
    }

    await delay(BRIDGE_POLL_INTERVAL_MS);
  }

  useSwapDiagnosticsStore.getState().completePoll(pollId, {
    status: 'timeout',
    lastMessage: 'Bridge settlement is still processing',
  });
  logger.warn('[VaultSettlement] Bridge settlement timed out', {
    intentId,
    timeoutMs,
  });
  throw new Error('Bridge settlement is still processing.');
}

export async function waitForRedemptionRelease(
  redemptionId: string,
  timeoutMs = REDEMPTION_RELEASE_TIMEOUT_MS
): Promise<RedemptionRequest> {
  const deadline = Date.now() + timeoutMs;
  const pollId = useSwapDiagnosticsStore.getState().startPoll({
    id: `redemption:${redemptionId}`,
    kind: 'redemption_release',
    label: 'Redemption release',
    subject: redemptionId,
    intervalMs: REDEMPTION_POLL_INTERVAL_MS,
    timeoutMs,
  });

  while (Date.now() < deadline) {
    let redemption: RedemptionRequest;
    try {
      redemption = await getRedemptionStatus(redemptionId);
    } catch (error: unknown) {
      useSwapDiagnosticsStore.getState().completePoll(pollId, {
        status: 'error',
        lastError: getErrorMessage(error),
      });
      throw error;
    }

    useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
      lastStatus: redemption.status,
      metadata: {
        sourceAsset: redemption.sourceAsset,
        amount: redemption.amount,
        burnTxHash: redemption.burnTxHash ?? null,
        releaseTxid: redemption.releaseTxid ?? null,
      },
    });

    if (redemption.status === 'released' || redemption.status === 'failed') {
      useSwapDiagnosticsStore.getState().completePoll(pollId, {
        status: redemption.status === 'failed' ? 'error' : 'success',
        lastStatus: redemption.status,
        lastMessage:
          redemption.status === 'failed'
            ? 'Redemption release failed'
            : 'Redemption release completed',
        lastError: redemption.error ?? null,
      });
      return redemption;
    }

    await delay(REDEMPTION_POLL_INTERVAL_MS);
  }

  useSwapDiagnosticsStore.getState().completePoll(pollId, {
    status: 'timeout',
    lastMessage: 'Released UNIT is still processing',
  });
  logger.warn('[VaultSettlement] Redemption release timed out', {
    redemptionId,
    timeoutMs,
  });
  throw new Error('Released UNIT is still processing.');
}

export type VaultSettlementRefreshStatus =
  | 'idle'
  | 'pending'
  | 'settled'
  | 'ready_to_repay'
  | 'needs_retry'
  | 'error';

export interface VaultSettlementRefreshResult {
  status: VaultSettlementRefreshStatus;
  message: string;
  lastStatus?: string;
}

function recordOneShotSettlementPoll(input: {
  kind: 'bridge_settlement' | 'redemption_release';
  label: string;
  subject: string;
  lastStatus?: string | null;
  lastMessage?: string | null;
  lastError?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  terminalStatus: 'success' | 'error' | 'stopped';
}): void {
  const pollId = useSwapDiagnosticsStore.getState().startPoll({
    id: `${input.kind}:refresh:${input.subject}:${Date.now()}`,
    kind: input.kind,
    label: input.label,
    subject: input.subject,
    intervalMs: null,
    timeoutMs: null,
  });
  useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
    lastStatus: input.lastStatus,
    lastMessage: input.lastMessage,
    lastError: input.lastError,
    metadata: input.metadata,
  });
  useSwapDiagnosticsStore.getState().completePoll(pollId, {
    status: input.terminalStatus,
    lastStatus: input.lastStatus,
    lastMessage: input.lastMessage,
    lastError: input.lastError,
    metadata: input.metadata,
  });
}

function bridgePayoutAsset(intent: BridgeIntent): VaultSettlementPayoutAsset {
  return intent.payoutAsset || (intent.status === 'fulfilled' ? 'USDC' : 'wUNIT');
}

function getMeltQuoteState(quote: Pick<MeltQuote, 'paid' | 'state'>): string {
  if (typeof quote.state === 'string' && quote.state.trim()) {
    return quote.state.toUpperCase();
  }
  return quote.paid === true ? 'PAID' : 'UNKNOWN';
}

function isAcceptedTurboMeltQuote(quote: Pick<MeltQuote, 'paid' | 'state'>): boolean {
  return quote.paid === true || ACCEPTED_TURBO_MELT_STATES.has(getMeltQuoteState(quote));
}

function getRecoverableMeltTxid(quote: RecoverableMeltQuote, fallbackQuoteId: string): string {
  if (quote.txid) return quote.txid;
  if (quote.outpoint) return quote.outpoint.split(':')[0] || quote.outpoint;
  return quote.payment_preimage || quote.quote || fallbackQuoteId;
}

async function refreshPersistedBridgeIntent(
  intentId: string
): Promise<VaultSettlementRefreshResult> {
  let intent: BridgeIntent;
  try {
    intent = await getBridgeStatus(intentId);
  } catch (error) {
    const message = getErrorMessage(error);
    recordOneShotSettlementPoll({
      kind: 'bridge_settlement',
      label: 'Bridge settlement refresh',
      subject: intentId,
      lastError: message,
      terminalStatus: 'error',
    });
    return {
      status: 'error',
      message,
    };
  }

  const metadata = {
    autoSwap: intent.autoSwap,
    confirmations: intent.confirmations ?? null,
    depositTxid: intent.depositTxid ?? null,
    payoutAsset: intent.payoutAsset ?? null,
    payoutAmount: intent.payoutAmount ?? null,
    sepoliaTxHash: intent.sepoliaTxHash ?? null,
    requiresManualRecovery: intent.requiresManualRecovery ?? null,
  };

  if (intent.status === 'failed') {
    const message = intent.error || 'Bridge settlement failed';
    useVaultSettlementStore.getState().markNeedsRetry(message);
    recordOneShotSettlementPoll({
      kind: 'bridge_settlement',
      label: 'Bridge settlement refresh',
      subject: intentId,
      lastStatus: intent.status,
      lastError: message,
      metadata,
      terminalStatus: 'error',
    });
    return {
      status: 'needs_retry',
      message,
      lastStatus: intent.status,
    };
  }

  if (intent.status === 'fulfilled' || intent.status === 'minted_no_swap') {
    const payoutAsset = bridgePayoutAsset(intent);
    const payoutAmount = intent.payoutAmount || intent.fulfilledAmount || null;
    useVaultSettlementStore
      .getState()
      .completeSettlement(payoutAsset, payoutAmount, intent.sepoliaTxHash || null);
    recordOneShotSettlementPoll({
      kind: 'bridge_settlement',
      label: 'Bridge settlement refresh',
      subject: intentId,
      lastStatus: intent.status,
      lastMessage: 'Bridge settlement completed',
      metadata,
      terminalStatus: 'success',
    });
    return {
      status: 'settled',
      message: 'Bridge settlement completed.',
      lastStatus: intent.status,
    };
  }

  useVaultSettlementStore.getState().setPhase('waiting_bridge_fulfillment');
  recordOneShotSettlementPoll({
    kind: 'bridge_settlement',
    label: 'Bridge settlement refresh',
    subject: intentId,
    lastStatus: intent.status,
    lastMessage: 'Bridge settlement is still processing',
    metadata,
    terminalStatus: 'stopped',
  });
  return {
    status: 'pending',
    message: 'Bridge settlement is still processing.',
    lastStatus: intent.status,
  };
}

async function refreshPersistedBridgeClientRequest(
  clientRequestId: string
): Promise<VaultSettlementRefreshResult> {
  let intent: BridgeIntent | null;
  try {
    intent = await getBridgeIntentByClientRequestId(clientRequestId);
  } catch (error) {
    const message = getErrorMessage(error);
    recordOneShotSettlementPoll({
      kind: 'bridge_settlement',
      label: 'Bridge intent lookup refresh',
      subject: clientRequestId,
      lastError: message,
      metadata: { clientRequestId },
      terminalStatus: 'error',
    });
    return {
      status: 'error',
      message,
    };
  }

  if (!intent) {
    recordOneShotSettlementPoll({
      kind: 'bridge_settlement',
      label: 'Bridge intent lookup refresh',
      subject: clientRequestId,
      lastMessage: 'Bridge intent is not indexed by client request id yet',
      metadata: { clientRequestId },
      terminalStatus: 'stopped',
    });
    return {
      status: 'pending',
      message: 'Bridge intent is not indexed by client request id yet.',
    };
  }

  useVaultSettlementStore.getState().setBridgeIntent(intent.id, intent.depositAddress);
  return refreshPersistedBridgeIntent(intent.id);
}

async function refreshPersistedRedemption(
  redemptionId: string
): Promise<VaultSettlementRefreshResult> {
  let redemption: RedemptionRequest;
  try {
    redemption = await getRedemptionStatus(redemptionId);
  } catch (error) {
    const message = getErrorMessage(error);
    recordOneShotSettlementPoll({
      kind: 'redemption_release',
      label: 'Redemption release refresh',
      subject: redemptionId,
      lastError: message,
      terminalStatus: 'error',
    });
    return {
      status: 'error',
      message,
    };
  }

  const metadata = {
    sourceAsset: redemption.sourceAsset,
    amount: redemption.amount,
    burnTxHash: redemption.burnTxHash ?? null,
    releaseTxid: redemption.releaseTxid ?? null,
  };

  if (redemption.status === 'failed') {
    const message = redemption.error || 'UNIT release failed';
    useVaultSettlementStore.getState().markNeedsRetry(message);
    recordOneShotSettlementPoll({
      kind: 'redemption_release',
      label: 'Redemption release refresh',
      subject: redemptionId,
      lastStatus: redemption.status,
      lastError: message,
      metadata,
      terminalStatus: 'error',
    });
    return {
      status: 'needs_retry',
      message,
      lastStatus: redemption.status,
    };
  }

  if (redemption.status === 'released') {
    useVaultSettlementStore.getState().setPhase('repaying_vault');
    recordOneShotSettlementPoll({
      kind: 'redemption_release',
      label: 'Redemption release refresh',
      subject: redemptionId,
      lastStatus: redemption.status,
      lastMessage: 'Released UNIT is ready for vault repay',
      metadata,
      terminalStatus: 'success',
    });
    return {
      status: 'ready_to_repay',
      message: 'Released UNIT is ready. Return to the repay flow to finish vault repayment.',
      lastStatus: redemption.status,
    };
  }

  useVaultSettlementStore.getState().setPhase('waiting_redemption_release');
  recordOneShotSettlementPoll({
    kind: 'redemption_release',
    label: 'Redemption release refresh',
    subject: redemptionId,
    lastStatus: redemption.status,
    lastMessage: 'Redemption release is still processing',
    metadata,
    terminalStatus: 'stopped',
  });
  return {
    status: 'pending',
    message: 'Redemption release is still processing.',
    lastStatus: redemption.status,
  };
}

export async function refreshPersistedTurboMintSettlementStatus(): Promise<VaultSettlementRefreshResult> {
  const settlement = useVaultSettlementStore.getState();
  const { cashuMintQuoteId, cashuMintSendTxid, requestedPayoutAsset } = settlement;

  if (requestedPayoutAsset !== 'TURBOUNIT' || !cashuMintQuoteId) {
    return {
      status: 'idle',
      message: 'No persisted TurboUNIT mint settlement is available to refresh.',
    };
  }

  let mintQuote: Awaited<ReturnType<typeof checkMintQuote>>;
  try {
    mintQuote = await checkMintQuote(cashuMintQuoteId);
  } catch (error) {
    return {
      status: 'error',
      message: getErrorMessage(error),
    };
  }

  const mintState = deriveMintQuoteState(mintQuote);
  const amountPaid = mintQuote.amount_paid ?? 0;
  const amountIssued = mintQuote.amount_issued ?? 0;
  const isFullyIssued = mintState === 'ISSUED' || (amountPaid > 0 && amountIssued >= amountPaid);

  if (!cashuMintSendTxid && amountPaid <= 0 && amountIssued <= 0 && mintState !== 'PAID') {
    const message = 'TurboUNIT mint quote is ready to fund. Retry settlement to finish it.';
    useVaultSettlementStore.getState().markNeedsRetry(message);

    return {
      status: 'needs_retry',
      message,
      lastStatus: mintState,
    };
  }

  if (isFullyIssued) {
    if (cashuMintSendTxid) {
      await usePendingTransactionsStore
        .getState()
        .confirmTransaction(cashuMintSendTxid)
        .catch(() => undefined);
    }

    const issuedSmallestUnits =
      amountIssued || amountPaid || mintQuote.amount || Math.round(settlement.faceValueUsd * 100);
    const payoutAmount = formatVaultSettlementAmountInput(issuedSmallestUnits / 100);
    useVaultSettlementStore.getState().completeSettlement('TURBOUNIT', payoutAmount);

    return {
      status: 'settled',
      message: 'TurboUNIT mint completed.',
      lastStatus: mintState,
    };
  }

  useVaultSettlementStore.getState().setPhase('waiting_turbo_mint');

  return {
    status: 'pending',
    message:
      mintState === 'PAID'
        ? 'TurboUNIT mint is paid and ready to claim.'
        : 'TurboUNIT mint is still processing.',
    lastStatus: mintState,
  };
}

export async function refreshPersistedTurboMeltSettlementStatus(): Promise<VaultSettlementRefreshResult> {
  const settlement = useVaultSettlementStore.getState();
  const { cashuMeltQuoteId, cashuMeltTxid, kind, requestedPayoutAsset } = settlement;

  if (
    kind !== 'repay' ||
    requestedPayoutAsset !== 'TURBOUNIT' ||
    (!cashuMeltQuoteId && !cashuMeltTxid)
  ) {
    return {
      status: 'idle',
      message: 'No persisted TurboUNIT repay settlement is available to refresh.',
    };
  }

  if (cashuMeltTxid) {
    useVaultSettlementStore.getState().setPhase('waiting_turbo_release');
    return {
      status: 'ready_to_repay',
      message: 'TurboUNIT melt was submitted. Return to the repay flow to finish vault repayment.',
      lastStatus: 'SUBMITTED',
    };
  }

  if (!cashuMeltQuoteId) {
    return {
      status: 'idle',
      message: 'No persisted TurboUNIT repay settlement is available to refresh.',
    };
  }

  let meltQuote: RecoverableMeltQuote;
  try {
    meltQuote = (await checkMeltQuote(cashuMeltQuoteId)) as RecoverableMeltQuote;
  } catch (error) {
    return {
      status: 'error',
      message: getErrorMessage(error),
    };
  }

  const meltState = getMeltQuoteState(meltQuote);

  if (isAcceptedTurboMeltQuote(meltQuote)) {
    const meltTxid = getRecoverableMeltTxid(meltQuote, cashuMeltQuoteId);
    useVaultSettlementStore.getState().setCashuMeltTxid(meltTxid);
    useVaultSettlementStore.getState().setPhase('waiting_turbo_release');
    return {
      status: 'ready_to_repay',
      message: 'TurboUNIT melt was accepted. Return to the repay flow to finish vault repayment.',
      lastStatus: meltState,
    };
  }

  if (FAILED_TURBO_MELT_STATES.has(meltState)) {
    const message = 'TurboUNIT melt failed. Try the repay again when the mint is reachable.';
    useVaultSettlementStore.getState().markNeedsRetry(message);
    return {
      status: 'needs_retry',
      message,
      lastStatus: meltState,
    };
  }

  useVaultSettlementStore.getState().setPhase('melting_turbo_repay');
  return {
    status: 'pending',
    message: 'TurboUNIT melt is still processing.',
    lastStatus: meltState,
  };
}

export async function refreshPersistedVaultSettlementStatus(): Promise<VaultSettlementRefreshResult> {
  const {
    bridgeClientRequestId,
    bridgeIntentId,
    cashuMeltQuoteId,
    cashuMeltTxid,
    cashuMintQuoteId,
    redemptionId,
    requestedPayoutAsset,
  } = useVaultSettlementStore.getState();

  if (redemptionId) {
    return refreshPersistedRedemption(redemptionId);
  }

  if (requestedPayoutAsset === 'TURBOUNIT' && (cashuMeltQuoteId || cashuMeltTxid)) {
    return refreshPersistedTurboMeltSettlementStatus();
  }

  if (requestedPayoutAsset === 'TURBOUNIT' && cashuMintQuoteId) {
    return refreshPersistedTurboMintSettlementStatus();
  }

  if (bridgeIntentId) {
    return refreshPersistedBridgeIntent(bridgeIntentId);
  }

  if (bridgeClientRequestId) {
    return refreshPersistedBridgeClientRequest(bridgeClientRequestId);
  }

  return {
    status: 'idle',
    message: 'No persisted bridge, redemption, or TurboUNIT settlement is available to refresh.',
  };
}

export function getVaultSettlementStatusMessage(
  kind: VaultSettlementKind | null,
  phase: VaultSettlementPhase,
  fallbackStep: number,
  includeSepoliaCopy = true
): string {
  if (phase === 'idle' || phase === 'quoting' || phase === 'issuing_vault') {
    switch (fallbackStep) {
      case 1:
        return 'Preparing transaction...';
      case 2:
        return 'Connecting to network...';
      case 3:
        return 'Validating details...';
      case 4:
        if (kind === 'open') {
          return 'Finalizing vault creation...';
        }
        if (kind === 'repay') {
          return 'Finalizing vault repay...';
        }
        return 'Finalizing borrow...';
      default:
        return 'Processing...';
    }
  }

  switch (phase) {
    case 'creating_bridge':
      return includeSepoliaCopy
        ? 'Preparing Sepolia settlement...'
        : 'Preparing USDC settlement...';
    case 'building_bridge_send':
      return 'Preparing UNIT bridge send...';
    case 'signing_bridge_send':
      return 'Signing the bridge settlement...';
    case 'broadcasting_bridge_send':
      return 'Broadcasting the bridge send...';
    case 'waiting_bridge_fulfillment':
      return includeSepoliaCopy
        ? 'Waiting for Sepolia USDC settlement...'
        : 'Waiting for USDC settlement...';
    case 'creating_turbo_mint':
      return 'Preparing TurboUNIT mint quote...';
    case 'building_turbo_send':
      return 'Preparing UNIT send to the Cashu mint...';
    case 'signing_turbo_send':
      return 'Signing the TurboUNIT mint send...';
    case 'broadcasting_turbo_send':
      return 'Broadcasting the TurboUNIT mint send...';
    case 'waiting_turbo_mint':
      return 'Waiting for TurboUNIT proofs from the mint...';
    case 'melting_turbo_repay':
      return 'Melting TurboUNIT into on-chain UNIT...';
    case 'waiting_turbo_release':
      return 'Waiting for melted UNIT on Mutinynet...';
    case 'swapping_repay':
      return includeSepoliaCopy
        ? 'Swapping Sepolia USDC into UNIT on Sepolia...'
        : 'Swapping USDC into UNIT...';
    case 'waiting_redemption_release':
      return 'Waiting for released UNIT on Mutinynet...';
    case 'repaying_vault':
      return 'Repaying the vault with released UNIT...';
    case 'settled':
      return 'Settlement complete.';
    case 'pending_settlement':
      return 'Settlement is still processing in the background.';
    case 'needs_retry':
      return 'Settlement needs retry.';
    default:
      return 'Processing...';
  }
}
