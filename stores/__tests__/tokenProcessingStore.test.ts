import { act } from '@testing-library/react-native';
import {
  PAUSED_TOKEN_QUEUE_KEY,
  PENDING_TOKEN_KEY,
  PENDING_TOKEN_QUEUE_KEY,
  useTokenProcessingStore,
} from '../tokenProcessingStore';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `hash:${value}`),
}));

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as SecureStore from 'expo-secure-store';

describe('tokenProcessingStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useTokenProcessingStore.getState().reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    useTokenProcessingStore.getState().reset();
    jest.useRealTimers();
  });

  it('delays token check until state has settled', () => {
    const callback = jest.fn();

    act(() => {
      useTokenProcessingStore.getState().registerTokenCheckCallback(callback);
      useTokenProcessingStore.getState().triggerTokenCheck();
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not run a queued token check after unregister', () => {
    const callback = jest.fn();

    act(() => {
      useTokenProcessingStore.getState().registerTokenCheckCallback(callback);
      useTokenProcessingStore.getState().triggerTokenCheck();
      useTokenProcessingStore.getState().unregisterTokenCheckCallback();
      jest.advanceTimersByTime(50);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('deduplicates processed token hashes', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().markTokenProcessed('cashuAtoken');
    });

    await expect(useTokenProcessingStore.getState().isTokenProcessed('cashuAtoken')).resolves.toBe(
      true
    );
    await expect(useTokenProcessingStore.getState().isTokenProcessed('cashuAother')).resolves.toBe(
      false
    );
  });

  it('persists pending tokens and keeps them durable while consumed', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBpending');
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      PENDING_TOKEN_KEY,
      'cashuBpending',
      expect.any(Object)
    );

    expect(useTokenProcessingStore.getState().consumePendingToken()).toBe('cashuBpending');
    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('pending_turbo_cashu_token_v1');
  });

  it('does not queue pending tokens in memory when durable persistence fails', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('SecureStore full'));

    let caught: unknown;
    await act(async () => {
      try {
        await useTokenProcessingStore.getState().setPendingToken('cashuBpending');
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('SecureStore full');
    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();
  });

  it('hydrates a persisted pending token after restart', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('cashuBstored');

    await act(async () => {
      await useTokenProcessingStore.getState().hydratePendingToken();
    });

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PENDING_TOKEN_QUEUE_KEY);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PAUSED_TOKEN_QUEUE_KEY);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PENDING_TOKEN_KEY);
    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBstored');
  });

  it('hydrates paused tokens without retrying them as pending work', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(['cashuBfailed']))
      .mockResolvedValueOnce(null);

    let hydratedToken: string | null = 'not-called';
    await act(async () => {
      hydratedToken = await useTokenProcessingStore.getState().hydratePendingToken();
    });

    expect(hydratedToken).toBeNull();
    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();
    expect(useTokenProcessingStore.getState().pausedTokenQueue).toEqual(['cashuBfailed']);
  });

  it('deletes the persisted token only when explicitly cleared', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBpending');
      useTokenProcessingStore.getState().clearPendingToken();
      await Promise.resolve();
    });

    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PENDING_TOKEN_KEY);
  });

  it('does not clear a newer queued token when an older claim finishes', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBsecond');
    });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('cashuBsecond');

    await act(async () => {
      useTokenProcessingStore.getState().clearPendingToken('cashuBfirst');
      await Promise.resolve();
    });

    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBsecond');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(PENDING_TOKEN_KEY);
  });

  it('queues multiple pending tokens and advances after the active token clears', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBfirst');
      await useTokenProcessingStore.getState().setPendingToken('cashuBsecond');
    });

    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBfirst');
    expect(useTokenProcessingStore.getState().pendingTokenQueue).toEqual(['cashuBsecond']);
    expect(useTokenProcessingStore.getState().consumePendingToken()).toBe('cashuBfirst');
    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();

    await act(async () => {
      useTokenProcessingStore.getState().clearPendingToken('cashuBfirst');
      await Promise.resolve();
    });

    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBsecond');
    expect(useTokenProcessingStore.getState().pendingTokenQueue).toEqual([]);
  });

  it('keeps failed tokens durable without blocking newer queued tokens', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBfailed');
      await useTokenProcessingStore.getState().setPendingToken('cashuBnext');
    });

    expect(useTokenProcessingStore.getState().consumePendingToken()).toBe('cashuBfailed');

    await act(async () => {
      useTokenProcessingStore.getState().pauseProcessingToken('cashuBfailed');
      await Promise.resolve();
    });

    expect(useTokenProcessingStore.getState().processingToken).toBeNull();
    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBnext');
    expect(useTokenProcessingStore.getState().pausedTokenQueue).toEqual(['cashuBfailed']);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      PAUSED_TOKEN_QUEUE_KEY,
      JSON.stringify(['cashuBfailed']),
      expect.any(Object)
    );
    expect(useTokenProcessingStore.getState().consumePendingToken()).toBe('cashuBnext');
  });
});
