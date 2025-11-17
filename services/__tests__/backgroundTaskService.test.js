/**
 * Tests for Background Task Service
 * Tests background transaction monitoring and notification system
 */

import {
  registerBackgroundFetchAsync,
  unregisterBackgroundFetchAsync,
  addPendingTransaction,
  removePendingTransaction,
  getPendingTransactions,
} from '../backgroundTaskService';

// Mock dependencies
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  BackgroundFetchResult: {
    NoData: 1,
    NewData: 2,
    Failed: 3,
  },
}));

let backgroundTaskCallback;
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn((taskName, callback) => {
    backgroundTaskCallback = callback;
  }),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const BackgroundFetch = require('expo-background-fetch');
const SecureStore = require('expo-secure-store');
const Notifications = require('expo-notifications');

jest.mock('../../utils/constants', () => ({
  getTxApiUrl: jest.fn((txid) => `https://mutinynet.com/api/tx/${txid}`),
}));

describe('backgroundTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    // Re-require to ensure TaskManager.defineTask is called
    jest.isolateModules(() => {
      require('../backgroundTaskService');
    });
  });

  describe('registerBackgroundFetchAsync', () => {
    it('should register background fetch task', async () => {
      BackgroundFetch.registerTaskAsync.mockResolvedValueOnce(undefined);

      await registerBackgroundFetchAsync();

      expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
        'background-transaction-check',
        {
          minimumInterval: 300, // 5 minutes in seconds
          stopOnTerminate: false,
          startOnBoot: true,
        }
      );
    });

  });

  describe('unregisterBackgroundFetchAsync', () => {
    it('should unregister background fetch task', async () => {
      BackgroundFetch.unregisterTaskAsync.mockResolvedValueOnce(undefined);

      await unregisterBackgroundFetchAsync();

      expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(
        'background-transaction-check'
      );
    });

  });

  describe('addPendingTransaction', () => {
    it('should add a new pending transaction', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);
      SecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await addPendingTransaction('tx123', 'BTC', 0.5, 'send');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'pending_transactions',
        expect.stringContaining('tx123')
      );

      const savedData = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        txid: 'tx123',
        assetType: 'BTC',
        amount: 0.5,
        type: 'send',
      });
      expect(savedData[0].timestamp).toBeDefined();
    });

    it('should append to existing pending transactions', async () => {
      const existingTxs = [
        {
          txid: 'tx1',
          assetType: 'BTC',
          amount: 1,
          type: 'send',
          timestamp: Date.now() - 1000,
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(existingTxs));
      SecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await addPendingTransaction('tx2', 'UNIT', 100, 'withdraw');

      const savedData = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
      expect(savedData).toHaveLength(2);
      expect(savedData[0].txid).toBe('tx1');
      expect(savedData[1].txid).toBe('tx2');
    });

    it('should use default type if not provided', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);
      SecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await addPendingTransaction('tx123', 'BTC', 0.5);

      const savedData = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
      expect(savedData[0].type).toBe('withdraw');
    });

  });

  describe('removePendingTransaction', () => {
    it('should remove a pending transaction by txid', async () => {
      const existingTxs = [
        {
          txid: 'tx1',
          assetType: 'BTC',
          amount: 1,
          type: 'send',
          timestamp: Date.now(),
        },
        {
          txid: 'tx2',
          assetType: 'UNIT',
          amount: 100,
          type: 'send',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(existingTxs));
      SecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await removePendingTransaction('tx1');

      const savedData = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].txid).toBe('tx2');
    });

    it('should handle empty pending transactions', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      await removePendingTransaction('tx1');

      // Should not call setItemAsync if no pending transactions
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

  });

  describe('getPendingTransactions', () => {
    it('should get all pending transactions', async () => {
      const pendingTxs = [
        {
          txid: 'tx1',
          assetType: 'BTC',
          amount: 1,
          type: 'send',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));

      const result = await getPendingTransactions();

      expect(result).toEqual(pendingTxs);
    });

    it('should return empty array if no pending transactions', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await getPendingTransactions();

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await getPendingTransactions();

      expect(result).toEqual([]);
    });
  });

  describe('Background Task Callback', () => {
    beforeEach(() => {
      // Re-import to capture the callback
      jest.isolateModules(() => {
        require('../backgroundTaskService');
      });
    });

    it('should return NoData when no pending transactions', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await backgroundTaskCallback();

      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    });

    it('should check transaction confirmation and send notification', async () => {
      const pendingTxs = [
        {
          txid: 'tx123',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: { confirmed: true } }),
      });

      const result = await backgroundTaskCallback();

      expect(global.fetch).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Transaction Confirmed',
          body: 'The withdraw transaction for 0.5 BTC has been confirmed on Mutinynet.',
          data: { txid: 'tx123', assetType: 'BTC', amount: 0.5 },
          sound: true,
        },
        trigger: null,
      });
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_transactions', '[]');
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    });

    it('should not send notification if transaction not confirmed', async () => {
      const pendingTxs = [
        {
          txid: 'tx123',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: { confirmed: false } }),
      });

      const result = await backgroundTaskCallback();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    });

    it('should handle multiple pending transactions', async () => {
      const pendingTxs = [
        {
          txid: 'tx1',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
        {
          txid: 'tx2',
          assetType: 'UNIT',
          amount: 100,
          type: 'deposit',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));

      // First transaction confirmed, second not confirmed
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: { confirmed: true } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: { confirmed: false } }),
        });

      const result = await backgroundTaskCallback();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Transaction Confirmed',
          body: 'The withdraw transaction for 0.5 BTC has been confirmed on Mutinynet.',
          data: { txid: 'tx1', assetType: 'BTC', amount: 0.5 },
          sound: true,
        },
        trigger: null,
      });

      // Should only remove tx1, keep tx2
      const savedData = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].txid).toBe('tx2');
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    });

    it('should handle fetch errors gracefully', async () => {
      const pendingTxs = [
        {
          txid: 'tx123',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await backgroundTaskCallback();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    });

    it('should return Failed on error', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await backgroundTaskCallback();

      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.Failed);
    });

    it('should handle response not ok', async () => {
      const pendingTxs = [
        {
          txid: 'tx123',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await backgroundTaskCallback();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    });

    it('should handle transaction without status field', async () => {
      const pendingTxs = [
        {
          txid: 'tx123',
          assetType: 'BTC',
          amount: 0.5,
          type: 'withdraw',
          timestamp: Date.now(),
        },
      ];

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(pendingTxs));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await backgroundTaskCallback();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    });
  });
});
