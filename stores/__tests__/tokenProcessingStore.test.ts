import { act } from '@testing-library/react-native';
import { useTokenProcessingStore } from '../tokenProcessingStore';

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

    await expect(useTokenProcessingStore.getState().isTokenProcessed('cashuAtoken')).resolves.toBe(true);
    await expect(useTokenProcessingStore.getState().isTokenProcessed('cashuAother')).resolves.toBe(false);
  });

  it('persists pending tokens and keeps them durable while consumed', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBpending');
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'pending_turbo_cashu_token_v1',
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
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('cashuBstored');

    await act(async () => {
      await useTokenProcessingStore.getState().hydratePendingToken();
    });

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('pending_turbo_cashu_token_v1');
    expect(useTokenProcessingStore.getState().pendingToken).toBe('cashuBstored');
  });

  it('deletes the persisted token only when explicitly cleared', async () => {
    await act(async () => {
      await useTokenProcessingStore.getState().setPendingToken('cashuBpending');
      useTokenProcessingStore.getState().clearPendingToken();
    });

    expect(useTokenProcessingStore.getState().pendingToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pending_turbo_cashu_token_v1');
  });
});
