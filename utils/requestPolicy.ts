import {
  CircuitBreakerOpenError,
  classifyError,
  type AppError,
} from './errorTaxonomy';

interface RequestPolicyOptions {
  dedupeKey?: string;
  cacheKey?: string;
  cacheTtlMs?: number;
  staleOnError?: boolean;
  circuitKey?: string;
  failureThreshold?: number;
  cooldownMs?: number;
}

export interface RequestCacheMeta {
  updatedAt: number;
  isStale: boolean;
}

interface CacheEntry<T> {
  value: T;
  updatedAt: number;
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

const inFlightRequests = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry<unknown>>();
const circuits = new Map<string, CircuitState>();

function getCircuitState(key: string): CircuitState {
  const existing = circuits.get(key);
  if (existing) return existing;
  const next = { failures: 0, openedAt: null };
  circuits.set(key, next);
  return next;
}

function isCircuitOpen(key: string, cooldownMs: number): boolean {
  const state = getCircuitState(key);
  if (!state.openedAt) return false;

  if (Date.now() - state.openedAt >= cooldownMs) {
    state.openedAt = null;
    state.failures = 0;
    return false;
  }

  return true;
}

function recordCircuitSuccess(key?: string): void {
  if (!key) return;
  circuits.set(key, { failures: 0, openedAt: null });
}

function recordCircuitFailure(key: string | undefined, threshold: number): void {
  if (!key) return;
  const state = getCircuitState(key);
  state.failures += 1;
  if (state.failures >= threshold) {
    state.openedAt = Date.now();
  }
}

function getFreshCachedValue<T>(key: string, ttlMs: number): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  return Date.now() - entry.updatedAt <= ttlMs ? entry.value : undefined;
}

function getAnyCachedValue<T>(key: string): T | undefined {
  return (cache.get(key) as CacheEntry<T> | undefined)?.value;
}

function cacheValue<T>(key: string | undefined, value: T): void {
  if (!key) return;
  cache.set(key, { value, updatedAt: Date.now() });
}

export async function runRequestWithPolicy<T>(
  loader: () => Promise<T>,
  options: RequestPolicyOptions = {},
): Promise<T> {
  const {
    dedupeKey,
    cacheKey,
    cacheTtlMs = 0,
    staleOnError = false,
    circuitKey,
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  } = options;

  if (cacheKey && cacheTtlMs > 0) {
    const cached = getFreshCachedValue<T>(cacheKey, cacheTtlMs);
    if (cached !== undefined) {
      return cached;
    }
  }

  if (circuitKey && isCircuitOpen(circuitKey, cooldownMs)) {
    const stale = cacheKey ? getAnyCachedValue<T>(cacheKey) : undefined;
    if (staleOnError && stale !== undefined) {
      return stale;
    }
    throw new CircuitBreakerOpenError(circuitKey, 'REQUEST', cooldownMs);
  }

  const key = dedupeKey ?? cacheKey;
  if (key) {
    const existing = inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const request = (async (): Promise<T> => {
    try {
      const value = await loader();
      cacheValue(cacheKey, value);
      recordCircuitSuccess(circuitKey);
      return value;
    } catch (error) {
      const appError: AppError = classifyError(error);
      if (appError.retryable) {
        recordCircuitFailure(circuitKey, failureThreshold);
      }

      const stale = cacheKey ? getAnyCachedValue<T>(cacheKey) : undefined;
      if (staleOnError && stale !== undefined) {
        return stale;
      }

      throw appError;
    } finally {
      if (key) {
        inFlightRequests.delete(key);
      }
    }
  })();

  if (key) {
    inFlightRequests.set(key, request);
  }

  return request;
}

export function getRequestCacheMeta(cacheKey: string, staleAfterMs: number): RequestCacheMeta | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;

  return {
    updatedAt: entry.updatedAt,
    isStale: Date.now() - entry.updatedAt > staleAfterMs,
  };
}

export function resetRequestPolicyForTests(): void {
  inFlightRequests.clear();
  cache.clear();
  circuits.clear();
}
