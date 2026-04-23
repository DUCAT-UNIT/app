import { getBridgeStatus, getRedemptionStatus } from './bridgeApiService';
import {
  estimateUsdcToUnitSwapExecution,
  quoteUnitUsdcSwap,
  quoteUsdcForExactWunit,
} from './evmBridgeService';
import { logger } from '../utils/logger';
import type { BridgeIntent, RedemptionRequest } from '../shared/bridgeTypes';
import type { VaultSettlementKind, VaultSettlementPhase } from '../stores/vaultSettlementStore';

const BRIDGE_POLL_INTERVAL_MS = 4_000;
// Live Mutinynet -> Sepolia settlement needs at least one Mutinynet confirmation,
// backend detection, Sepolia execution, and one Sepolia confirmation. In practice
// that routinely exceeds 2 minutes on testnet, so keep the user on the processing
// screen longer to reach the final USDC result instead of timing out prematurely.
const BRIDGE_SETTLEMENT_TIMEOUT_MS = 720_000;
const REDEMPTION_POLL_INTERVAL_MS = 8_000;
const REDEMPTION_RELEASE_TIMEOUT_MS = 360_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatVaultSettlementAmountInput(amountUsd: number): string {
  return amountUsd.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
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
  destinationTaprootAddress: string,
): Promise<{
  requiredUsdcIn: string;
  estimatedSepoliaFeeEth: string;
}> {
  const amountOut = formatVaultSettlementAmountInput(amountUsd);
  const requiredUsdcIn = await quoteUsdcForExactWunit(amountOut);
  const gasEstimate = await estimateUsdcToUnitSwapExecution(
    accountIndex,
    requiredUsdcIn,
    destinationTaprootAddress,
  );

  return {
    requiredUsdcIn,
    estimatedSepoliaFeeEth: gasEstimate.totalFeeEth,
  };
}

export async function waitForBridgeSettlement(
  intentId: string,
  timeoutMs = BRIDGE_SETTLEMENT_TIMEOUT_MS,
): Promise<BridgeIntent> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const intent = await getBridgeStatus(intentId);
    if (
      intent.status === 'fulfilled' ||
      intent.status === 'minted_no_swap' ||
      intent.status === 'failed'
    ) {
      return intent;
    }

    await delay(BRIDGE_POLL_INTERVAL_MS);
  }

  logger.warn('[VaultSettlement] Bridge settlement timed out', {
    intentId,
    timeoutMs,
  });
  throw new Error('Bridge settlement is still processing.');
}

export async function waitForRedemptionRelease(
  redemptionId: string,
  timeoutMs = REDEMPTION_RELEASE_TIMEOUT_MS,
): Promise<RedemptionRequest> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const redemption = await getRedemptionStatus(redemptionId);
    if (redemption.status === 'released' || redemption.status === 'failed') {
      return redemption;
    }

    await delay(REDEMPTION_POLL_INTERVAL_MS);
  }

  logger.warn('[VaultSettlement] Redemption release timed out', {
    redemptionId,
    timeoutMs,
  });
  throw new Error('Released UNIT is still processing.');
}

export function getVaultSettlementStatusMessage(
  kind: VaultSettlementKind | null,
  phase: VaultSettlementPhase,
  fallbackStep: number,
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
      return 'Preparing Sepolia settlement...';
    case 'building_bridge_send':
      return 'Preparing UNIT bridge send...';
    case 'signing_bridge_send':
      return 'Signing the bridge settlement...';
    case 'broadcasting_bridge_send':
      return 'Broadcasting the bridge send...';
    case 'waiting_bridge_fulfillment':
      return 'Waiting for USDC settlement on Sepolia...';
    case 'swapping_repay':
      return 'Swapping USDC into UNIT on Sepolia...';
    case 'waiting_redemption_release':
      return 'Waiting for released UNIT on Mutinynet...';
    case 'repaying_vault':
      return 'Repaying the vault with released UNIT...';
    case 'settled':
      return 'Settlement complete.';
    case 'pending_settlement':
      return 'Settlement is still processing in the background.';
    case 'needs_retry':
      return 'Settlement needs operator retry.';
    default:
      return 'Processing...';
  }
}
