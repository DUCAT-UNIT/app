import { getRedemptionStatus, trackRedemption } from './bridgeApiService';
import { deriveSepoliaAccount, getSepoliaProvider } from './evmWalletService';
import { useEvmTransactionCheckpointStore, type EvmTransactionCheckpoint } from '../stores/evmTransactionCheckpointStore';
import type { RedemptionRequest, TrackRedemptionRequest } from '../shared/bridgeTypes';
import { logger } from '../utils/logger';

export interface EvmTransactionCheckpointReconciliationResult {
  checked: number;
  pending: number;
  confirmed: number;
  failed: number;
  errors: number;
}

export interface EvmRedemptionTrackingRecoveryResult {
  checked: number;
  alreadyTracked: number;
  tracked: number;
  failed: number;
  lastRedemption: RedemptionRequest | null;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /404|not found/i.test(error.message);
}

export async function reconcileSubmittedEvmTransactionCheckpoints(): Promise<EvmTransactionCheckpointReconciliationResult> {
  const recoverable = useEvmTransactionCheckpointStore
    .getState()
    .checkpoints
    .filter((checkpoint) => checkpoint.status === 'submitted' || checkpoint.status === 'failed');

  const result: EvmTransactionCheckpointReconciliationResult = {
    checked: 0,
    pending: 0,
    confirmed: 0,
    failed: 0,
    errors: 0,
  };

  if (recoverable.length === 0) {
    return result;
  }

  const provider = getSepoliaProvider();

  for (const checkpoint of recoverable) {
    result.checked += 1;
    try {
      const receipt = await provider.getTransactionReceipt(checkpoint.txHash);
      if (!receipt) {
        if (checkpoint.status === 'failed') {
          useEvmTransactionCheckpointStore.getState().markSubmitted(checkpoint.txHash);
        }
        result.pending += 1;
        continue;
      }

      const receiptHash = receipt.hash || checkpoint.txHash;
      if (receipt.status === 0) {
        useEvmTransactionCheckpointStore.getState().markFailed(
          checkpoint.txHash,
          'Sepolia transaction reverted on-chain.',
        );
        result.failed += 1;
      } else {
        useEvmTransactionCheckpointStore.getState().markConfirmed(checkpoint.txHash, receiptHash);
        result.confirmed += 1;
      }
    } catch (error) {
      result.errors += 1;
      logger.warn('[SepoliaBridge] Failed to reconcile recoverable transaction checkpoint', {
        txHash: checkpoint.txHash,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

function canRecoverRedemptionTracking(
  checkpoint: EvmTransactionCheckpoint,
  releaseId?: string,
): boolean {
  return (
    checkpoint.kind === 'redemption'
    && checkpoint.status === 'confirmed'
    && !!checkpoint.releaseId
    && !!checkpoint.amount
    && !!checkpoint.destinationTaprootAddress
    && (!releaseId || checkpoint.releaseId === releaseId)
  );
}

function buildRedemptionTrackingPayload(
  checkpoint: EvmTransactionCheckpoint,
  requester: string,
): TrackRedemptionRequest {
  if (!checkpoint.releaseId || !checkpoint.amount || !checkpoint.destinationTaprootAddress) {
    throw new Error('Redemption checkpoint is missing release tracking fields.');
  }

  return {
    id: checkpoint.releaseId,
    requester,
    destinationTaprootAddress: checkpoint.destinationTaprootAddress,
    amount: checkpoint.amount,
    sourceAsset: 'wUNIT',
    burnTxHash: checkpoint.receiptTxHash || checkpoint.txHash,
  };
}

export async function recoverConfirmedRedemptionTracking(
  releaseId?: string,
): Promise<EvmRedemptionTrackingRecoveryResult> {
  const checkpoints = useEvmTransactionCheckpointStore
    .getState()
    .checkpoints
    .filter((checkpoint) => canRecoverRedemptionTracking(checkpoint, releaseId));

  const result: EvmRedemptionTrackingRecoveryResult = {
    checked: 0,
    alreadyTracked: 0,
    tracked: 0,
    failed: 0,
    lastRedemption: null,
  };

  for (const checkpoint of checkpoints) {
    result.checked += 1;

    try {
      if (!checkpoint.releaseId) {
        throw new Error('Redemption checkpoint is missing release id.');
      }

      try {
        const existing = await getRedemptionStatus(checkpoint.releaseId);
        result.alreadyTracked += 1;
        result.lastRedemption = existing;
        continue;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      const account = await deriveSepoliaAccount(checkpoint.accountIndex);
      const redemption = await trackRedemption(buildRedemptionTrackingPayload(checkpoint, account.address));
      result.tracked += 1;
      result.lastRedemption = redemption;
    } catch (error) {
      result.failed += 1;
      logger.warn('[SepoliaBridge] Failed to recover redemption release tracking', {
        releaseId: checkpoint.releaseId,
        txHash: checkpoint.txHash,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
