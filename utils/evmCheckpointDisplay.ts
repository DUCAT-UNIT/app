import type { SepoliaAssetHistoryItem } from '../services/evmBridgeService';
import type { EvmTransactionCheckpoint } from '../stores/evmTransactionCheckpointStore';
import type { DisplayAssetType } from '../types/assets';

export type EvmCheckpointDisplayAsset = 'USDC' | 'ETH';

function normalizeAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizeAmount(value: string | null | undefined): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function checkpointTimeSeconds(checkpoint: EvmTransactionCheckpoint): number {
  const timestamp = checkpoint.confirmedAt ?? checkpoint.updatedAt ?? checkpoint.submittedAt;
  return Math.floor(timestamp / 1000);
}

function checkpointAssetType(checkpoint: EvmTransactionCheckpoint): DisplayAssetType | null {
  if (checkpoint.kind === 'transfer') {
    if (checkpoint.asset === 'ETH') return 'ETH';
    if (checkpoint.asset === 'USDC') return 'USDC';
    if (checkpoint.asset === 'wUNIT') return 'UNIT';
    return null;
  }

  if (checkpoint.tokenIn === 'USDC' || checkpoint.tokenOut === 'USDC' || checkpoint.asset === 'USDC') {
    return 'USDC';
  }

  if (
    checkpoint.tokenIn === 'wUNIT'
    || checkpoint.tokenOut === 'wUNIT'
    || checkpoint.tokenOut === 'UNIT'
    || checkpoint.asset === 'wUNIT'
  ) {
    return 'UNIT';
  }

  return null;
}

export function mapEvmCheckpointToHistoryItem(
  checkpoint: EvmTransactionCheckpoint,
  walletAddress?: string | null,
): SepoliaAssetHistoryItem | null {
  const amount = normalizeAmount(checkpoint.amount);
  const assetType = checkpointAssetType(checkpoint);

  if (!assetType || amount <= 0) {
    return null;
  }

  const recipient = normalizeAddress(checkpoint.recipient);
  const wallet = normalizeAddress(walletAddress);
  const isSelfTransfer = checkpoint.kind === 'transfer' && !!recipient && !!wallet && recipient === wallet;

  return {
    txid: checkpoint.receiptTxHash || checkpoint.txHash,
    status: {
      confirmed: checkpoint.status === 'confirmed',
      block_time: checkpointTimeSeconds(checkpoint),
      failed: checkpoint.status === 'failed',
    },
    txData: {
      amount,
      assetType,
      isSent: true,
      isReceived: isSelfTransfer,
    },
  };
}

function mergeEvmHistoryWithCheckpoints(
  indexedHistory: SepoliaAssetHistoryItem[],
  checkpoints: EvmTransactionCheckpoint[],
  asset: EvmCheckpointDisplayAsset,
  accountIndex: number,
  walletAddress?: string | null,
): SepoliaAssetHistoryItem[] {
  const indexedTxids = new Set(indexedHistory.map((tx) => tx.txid.toLowerCase()));
  const checkpointItems = checkpoints
    .filter((checkpoint) => checkpoint.accountIndex === accountIndex)
    .map((checkpoint) => mapEvmCheckpointToHistoryItem(checkpoint, walletAddress))
    .filter((item): item is SepoliaAssetHistoryItem => {
      if (!item || item.txData.assetType !== asset) {
        return false;
      }

      return !indexedTxids.has(item.txid.toLowerCase());
    });

  return [...indexedHistory, ...checkpointItems].sort(
    (left, right) => (right.status.block_time ?? 0) - (left.status.block_time ?? 0),
  );
}

export const backfillEvmHistoryFromCheckpoints = mergeEvmHistoryWithCheckpoints;
