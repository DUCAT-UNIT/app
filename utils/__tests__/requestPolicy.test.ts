import { CircuitBreakerOpenError } from '../errorTaxonomy';
import {
  getRequestCacheMeta,
  resetRequestPolicyForTests,
  runRequestWithPolicy,
} from '../requestPolicy';

describe('requestPolicy', () => {
  beforeEach(() => {
    resetRequestPolicyForTests();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetRequestPolicyForTests();
  });

  it('dedupes matching in-flight requests', async () => {
    let resolve: (value: string) => void;
    const loader = jest.fn(() => new Promise<string>((res) => {
      resolve = res;
    }));

    const first = runRequestWithPolicy(loader, { dedupeKey: 'same' });
    const second = runRequestWithPolicy(loader, { dedupeKey: 'same' });

    resolve!('ok');

    await expect(first).resolves.toBe('ok');
    await expect(second).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns fresh cache without calling the loader', async () => {
    const loader = jest.fn().mockResolvedValue('first');

    await expect(runRequestWithPolicy(loader, {
      cacheKey: 'cached',
      cacheTtlMs: 10_000,
    })).resolves.toBe('first');

    loader.mockResolvedValue('second');

    await expect(runRequestWithPolicy(loader, {
      cacheKey: 'cached',
      cacheTtlMs: 10_000,
    })).resolves.toBe('first');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(getRequestCacheMeta('cached', 5_000)).toEqual({
      updatedAt: 1_700_000_000_000,
      isStale: false,
    });
  });

  it('returns stale cache on retryable errors when enabled', async () => {
    const loader = jest.fn().mockResolvedValueOnce('good');

    await runRequestWithPolicy(loader, { cacheKey: 'stale' });

    loader.mockRejectedValueOnce(new Error('network request failed'));

    await expect(runRequestWithPolicy(loader, {
      cacheKey: 'stale',
      staleOnError: true,
    })).resolves.toBe('good');
  });

  it('opens a circuit after repeated retryable failures', async () => {
    const loader = jest.fn().mockRejectedValue(new Error('network request failed'));

    await expect(runRequestWithPolicy(loader, {
      circuitKey: 'api',
      failureThreshold: 2,
    })).rejects.toMatchObject({ category: 'network_unavailable' });
    await expect(runRequestWithPolicy(loader, {
      circuitKey: 'api',
      failureThreshold: 2,
    })).rejects.toMatchObject({ category: 'network_unavailable' });

    await expect(runRequestWithPolicy(loader, {
      circuitKey: 'api',
      failureThreshold: 2,
    })).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });
});
