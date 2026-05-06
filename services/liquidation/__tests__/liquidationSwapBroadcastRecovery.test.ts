import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingLiquidationSwapBroadcast,
  LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY,
  loadPendingLiquidationSwapBroadcasts,
  recoverPendingLiquidationSwapBroadcasts,
  savePendingLiquidationSwapBroadcast,
} from '../liquidationSwapBroadcastRecovery';
import { broadcastSwapTx, waitForMempool } from '../swapService';
import { registerSwapTxid } from '../../transactionHistoryService';

jest.mock('../swapService', () => ({
  broadcastSwapTx: jest.fn(),
  waitForMempool: jest.fn(),
}));

jest.mock('../../transactionHistoryService', () => ({
  registerSwapTxid: jest.fn(),
}));

describe('liquidationSwapBroadcastRecovery', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    storage.clear();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage.get(key) ?? null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });
  });

  it('persists pending liquidation swap broadcasts by repo txid', async () => {
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-1',
      swapTxHex: 'swap-hex-1',
      unitAmount: 25,
      createdAt: 1000,
    });
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-1',
      swapTxHex: 'swap-hex-updated',
      unitAmount: 30,
      createdAt: 2000,
    });

    await expect(loadPendingLiquidationSwapBroadcasts()).resolves.toEqual([
      {
        repoTxid: 'repo-1',
        swapTxHex: 'swap-hex-updated',
        unitAmount: 30,
        createdAt: 2000,
      },
    ]);
  });

  it('keeps the recovery record when the repo tx is not in mempool yet', async () => {
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-pending',
      swapTxHex: 'swap-hex',
      unitAmount: 12,
      createdAt: 1000,
    });
    (waitForMempool as jest.Mock).mockResolvedValue(false);

    await expect(recoverPendingLiquidationSwapBroadcasts(1, 1)).resolves.toEqual({
      checked: 1,
      recovered: 0,
      stillPending: 1,
      failed: 0,
    });

    expect(broadcastSwapTx).not.toHaveBeenCalled();
    await expect(loadPendingLiquidationSwapBroadcasts()).resolves.toHaveLength(1);
  });

  it('broadcasts and clears the pending swap once the repo tx is visible', async () => {
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-ready',
      swapTxHex: 'swap-hex',
      unitAmount: 42,
      createdAt: 1000,
    });
    (waitForMempool as jest.Mock).mockResolvedValue(true);
    (broadcastSwapTx as jest.Mock).mockResolvedValue('swap-txid');

    await expect(recoverPendingLiquidationSwapBroadcasts(1, 1)).resolves.toEqual({
      checked: 1,
      recovered: 1,
      stillPending: 0,
      failed: 0,
    });

    expect(broadcastSwapTx).toHaveBeenCalledWith('swap-hex');
    expect(registerSwapTxid).toHaveBeenCalledWith('swap-txid', 42);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY);
  });

  it('clears one repo txid without deleting other pending broadcasts', async () => {
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-1',
      swapTxHex: 'swap-hex-1',
      unitAmount: 1,
      createdAt: 1000,
    });
    await savePendingLiquidationSwapBroadcast({
      repoTxid: 'repo-2',
      swapTxHex: 'swap-hex-2',
      unitAmount: 2,
      createdAt: 2000,
    });

    await clearPendingLiquidationSwapBroadcast('repo-1');

    await expect(loadPendingLiquidationSwapBroadcasts()).resolves.toEqual([
      {
        repoTxid: 'repo-2',
        swapTxHex: 'swap-hex-2',
        unitAmount: 2,
        createdAt: 2000,
      },
    ]);
  });
});
