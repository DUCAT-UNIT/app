import { act } from '@testing-library/react-native';
import { useTokenProcessingStore } from '../tokenProcessingStore';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `hash:${value}`),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('tokenProcessingStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useTokenProcessingStore.getState().reset();
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
});
