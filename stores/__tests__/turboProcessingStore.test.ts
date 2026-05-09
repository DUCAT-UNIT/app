import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import {
  normalizeTurboProcessingState,
  TURBO_PROCESSING_EXPIRY_MS,
  TURBO_PROCESSING_STORAGE_KEY,
  useTurboProcessingStore,
} from '../turboProcessingStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('turboProcessingStore', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  let storage: Map<string, string>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);
    storage = new Map();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(storage.get(key) ?? null));
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve(undefined);
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve(undefined);
    });
    await useTurboProcessingStore.getState().clearState();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await useTurboProcessingStore.getState().clearState();
    jest.useRealTimers();
  });

  it('persists only serializable turbo processing fields', async () => {
    await act(async () => {
      await useTurboProcessingStore.getState().startProcessing({
        sendAmount: '25',
        sendRecipient: 'tb1precipient',
        mintQuoteId: 'quote-1',
        mintAmount: 2500,
        turboRecipient: 'tb1pturbo',
        senderTaprootAddress: 'tb1psender',
      });
      await useTurboProcessingStore.getState().updateProgress(2, 'Mint confirmed');
    });

    const persisted = JSON.parse(storage.get(TURBO_PROCESSING_STORAGE_KEY)!);
    expect(persisted).toEqual({
      isProcessing: true,
      sendAmount: '25',
      sendRecipient: 'tb1precipient',
      currentStep: 2,
      currentMessage: 'Mint confirmed',
      startedAt: now,
      mintQuoteId: 'quote-1',
      mintAmount: 2500,
      turboRecipient: 'tb1pturbo',
      senderTaprootAddress: 'tb1psender',
    });
    expect(persisted.startProcessing).toBeUndefined();
    expect(persisted.updateProgress).toBeUndefined();
  });

  it('loads valid persisted state and clears stale persisted state', async () => {
    storage.set(TURBO_PROCESSING_STORAGE_KEY, JSON.stringify({
      isProcessing: true,
      sendAmount: '10',
      sendRecipient: 'tb1pfresh',
      currentStep: 1,
      currentMessage: 'Waiting',
      startedAt: now - 1000,
      senderTaprootAddress: 'tb1psender',
    }));

    await expect(useTurboProcessingStore.getState().loadPersistedState()).resolves.toMatchObject({
      isProcessing: true,
      sendAmount: '10',
      sendRecipient: 'tb1pfresh',
      currentStep: 1,
      senderTaprootAddress: 'tb1psender',
    });

    storage.set(TURBO_PROCESSING_STORAGE_KEY, JSON.stringify({
      isProcessing: true,
      sendAmount: '10',
      sendRecipient: 'tb1pstale',
      currentStep: 1,
      currentMessage: 'Waiting',
      startedAt: now - TURBO_PROCESSING_EXPIRY_MS - 1,
    }));

    await expect(useTurboProcessingStore.getState().loadPersistedState()).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TURBO_PROCESSING_STORAGE_KEY);
  });

  it('clears malformed persisted state instead of hydrating it', async () => {
    storage.set(TURBO_PROCESSING_STORAGE_KEY, JSON.stringify({
      isProcessing: 'yes',
      sendAmount: '',
      sendRecipient: null,
      startedAt: now,
    }));

    await expect(useTurboProcessingStore.getState().loadPersistedState()).resolves.toBeNull();
    expect(useTurboProcessingStore.getState()).toMatchObject({
      isProcessing: false,
      sendRecipient: '',
    });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TURBO_PROCESSING_STORAGE_KEY);
  });

  it('normalizes persisted state defensively', () => {
    expect(normalizeTurboProcessingState(null, now)).toBeNull();
    expect(normalizeTurboProcessingState({ isProcessing: false }, now)).toBeNull();
    expect(normalizeTurboProcessingState({
      isProcessing: true,
      sendAmount: ' 5 ',
      sendRecipient: ' tb1precipient ',
      currentStep: 3.8,
      currentMessage: '',
      startedAt: now,
      mintAmount: -1,
      turboRecipient: ' tb1pturbo ',
      senderTaprootAddress: ' tb1psender ',
    }, now)).toEqual({
      isProcessing: true,
      sendAmount: '5',
      sendRecipient: 'tb1precipient',
      currentStep: 3,
      currentMessage: 'Restoring Turbo send...',
      startedAt: now,
      mintQuoteId: undefined,
      mintAmount: undefined,
      turboRecipient: 'tb1pturbo',
      senderTaprootAddress: 'tb1psender',
    });
  });

  it('fails closed when persisted state has an unsupported Cashu unit', () => {
    expect(normalizeTurboProcessingState({
      isProcessing: true,
      sendAmount: '5',
      sendRecipient: 'tb1precipient',
      currentStep: 1,
      currentMessage: 'Restoring',
      startedAt: now,
      cashuUnit: 'msat',
    }, now)).toBeNull();
  });
});
