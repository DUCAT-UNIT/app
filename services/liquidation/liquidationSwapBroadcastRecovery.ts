import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerSwapTxid } from '../transactionHistoryService';
import { broadcastSwapTx, waitForMempool } from './swapService';
import { logger } from '../../utils/logger';
import { LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY } from './recoveryKeys';

export { LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY };

export interface PendingLiquidationSwapBroadcast {
  repoTxid: string;
  swapTxHex: string;
  unitAmount: number;
  createdAt: number;
}

export interface LiquidationSwapBroadcastRecoveryResult {
  checked: number;
  recovered: number;
  stillPending: number;
  failed: number;
}

function isPendingLiquidationSwapBroadcast(value: unknown): value is PendingLiquidationSwapBroadcast {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.repoTxid === 'string' &&
    record.repoTxid.length > 0 &&
    typeof record.swapTxHex === 'string' &&
    record.swapTxHex.length > 0 &&
    typeof record.unitAmount === 'number' &&
    Number.isFinite(record.unitAmount) &&
    record.unitAmount >= 0 &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt)
  );
}

export async function loadPendingLiquidationSwapBroadcasts(): Promise<
  PendingLiquidationSwapBroadcast[]
> {
  const stored = await AsyncStorage.getItem(LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY);
  if (!stored) {
    return [];
  }

  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error('Liquidation swap broadcast recovery storage corrupted');
  }

  return parsed.filter(isPendingLiquidationSwapBroadcast);
}

async function saveAllPendingLiquidationSwapBroadcasts(
  records: PendingLiquidationSwapBroadcast[]
): Promise<void> {
  await AsyncStorage.setItem(
    LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY,
    JSON.stringify(records)
  );
}

export async function savePendingLiquidationSwapBroadcast(
  record: PendingLiquidationSwapBroadcast
): Promise<void> {
  const existing = await loadPendingLiquidationSwapBroadcasts();
  const next = [
    record,
    ...existing.filter((item) => item.repoTxid !== record.repoTxid),
  ];
  await saveAllPendingLiquidationSwapBroadcasts(next);
}

export async function clearPendingLiquidationSwapBroadcast(repoTxid: string): Promise<void> {
  const existing = await loadPendingLiquidationSwapBroadcasts();
  const next = existing.filter((item) => item.repoTxid !== repoTxid);

  if (next.length === 0) {
    await AsyncStorage.removeItem(LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY);
    return;
  }

  await saveAllPendingLiquidationSwapBroadcasts(next);
}

export async function recoverPendingLiquidationSwapBroadcasts(
  maxMempoolAttempts = 3,
  mempoolIntervalMs = 5_000
): Promise<LiquidationSwapBroadcastRecoveryResult> {
  const pending = await loadPendingLiquidationSwapBroadcasts();
  const result: LiquidationSwapBroadcastRecoveryResult = {
    checked: pending.length,
    recovered: 0,
    stillPending: 0,
    failed: 0,
  };

  for (const record of pending) {
    try {
      const repoInMempool = await waitForMempool(
        record.repoTxid,
        maxMempoolAttempts,
        mempoolIntervalMs
      );

      if (!repoInMempool) {
        result.stillPending++;
        continue;
      }

      const swapTxid = await broadcastSwapTx(record.swapTxHex);
      if (!swapTxid) {
        result.failed++;
        continue;
      }

      await registerSwapTxid(swapTxid, record.unitAmount);
      await clearPendingLiquidationSwapBroadcast(record.repoTxid);
      result.recovered++;
    } catch (error) {
      result.failed++;
      logger.warn('[LiquidationSwapRecovery] Failed to recover pending swap broadcast', {
        repoTxid: record.repoTxid.substring(0, 8),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
