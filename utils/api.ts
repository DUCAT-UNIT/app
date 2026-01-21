/**
 * API utilities with AbortController support
 */

/**
 * Fetch with timeout and optional external abort signal
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
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If an external signal is provided, link it to our controller
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
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
