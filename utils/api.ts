/**
 * API utilities with AbortController support
 */

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * Centralized low-level fetch with timeout and optional external abort signal.
 * Product code should normally call apiClient helpers instead of this directly.
 * @param url - The URL to fetch
 * @param options - Fetch options (can include external signal)
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Fetch response
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> => {
  const controller = new AbortController();
  let rejectAbort: ((error: Error) => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });

  const rejectWithAbort = (message: string): void => {
    controller.abort();
    rejectAbort?.(createAbortError(message));
  };

  const timeoutId = setTimeout(
    () => rejectWithAbort(`Request timed out after ${timeout}ms`),
    timeout
  );
  (timeoutId as { unref?: () => void }).unref?.();

  // If an external signal is provided, link it to our controller
  const externalSignal = options.signal;
  let externalAbortListener: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      rejectWithAbort('Request aborted');
    } else {
      externalAbortListener = () => rejectWithAbort('Request aborted');
      externalSignal.addEventListener('abort', externalAbortListener, { once: true });
    }
  }

  try {
    return await Promise.race([
      fetch(url, {
        ...options,
        signal: controller.signal,
      }),
      abortPromise,
    ]);
  } finally {
    clearTimeout(timeoutId);
    rejectAbort = null;
    if (externalSignal && externalAbortListener) {
      externalSignal.removeEventListener('abort', externalAbortListener);
    }
  }
};

/**
 * Checks if an error is an abort error (request was cancelled)
 * @param error - Error to check
 * @returns True if error is from AbortController
 */
export const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === 'AbortError';
};

/**
 * Creates an AbortController for use in React useEffect cleanup
 * @example
 * useEffect(() => {
 *   const { signal, cleanup } = createAbortSignal();
 *   fetchData({ signal });
 *   return cleanup;
 * }, []);
 */
export const createAbortSignal = (): {
  signal: AbortSignal;
  cleanup: () => void;
} => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cleanup: () => controller.abort(),
  };
};
