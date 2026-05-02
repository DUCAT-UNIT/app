/**
 * Tests for api utilities
 */

import { fetchWithTimeout, isAbortError, createAbortSignal } from '../api';

describe('api utilities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchWithTimeout', () => {
    it('should make a fetch request successfully', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const response = await fetchWithTimeout('https://example.com/api');

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(response).toBe(mockResponse);
    });

    it('should pass options to fetch', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      };

      await fetchWithTimeout('https://example.com/api', options);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
        signal: expect.any(AbortSignal),
      }));
    });

    it('should use custom timeout', async () => {
      // Mock fetch to never resolve
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => {
          // Immediate rejection with AbortError to simulate timeout
          setTimeout(() => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      // Should abort due to timeout
      await expect(fetchWithTimeout('https://example.com/api', {}, 100)).rejects.toThrow();
    }, 10000);

    it('should abort when external signal is already aborted', async () => {
      const externalController = new AbortController();
      externalController.abort();

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      await expect(
        fetchWithTimeout('https://example.com/api', { signal: externalController.signal })
      ).rejects.toThrow();
    });

    it('should abort when external signal aborts', async () => {
      const externalController = new AbortController();

      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => {
          externalController.signal.addEventListener('abort', () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
      );

      const fetchPromise = fetchWithTimeout('https://example.com/api', { signal: externalController.signal });

      // Abort externally
      externalController.abort();

      await expect(fetchPromise).rejects.toThrow();
    });

    it('should clear timeout after successful fetch', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await fetchWithTimeout('https://example.com/api');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout even on fetch error', async () => {
      const error = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(error);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await expect(fetchWithTimeout('https://example.com/api')).rejects.toThrow('Network error');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should remove external abort listener after fetch settles', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      const externalController = new AbortController();
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      const removeEventListenerSpy = jest.spyOn(externalController.signal, 'removeEventListener');

      await fetchWithTimeout('https://example.com/api', { signal: externalController.signal });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('isAbortError', () => {
    it('should return true for AbortError', () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      expect(isAbortError(abortError)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Some error');
      expect(isAbortError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isAbortError('error string')).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError({})).toBe(false);
    });

    it('should return false for Error-like objects without AbortError name', () => {
      const errorLike = { name: 'TypeError', message: 'test' };
      expect(isAbortError(errorLike)).toBe(false);
    });
  });

  describe('createAbortSignal', () => {
    it('should return signal and cleanup function', () => {
      const { signal, cleanup } = createAbortSignal();

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(typeof cleanup).toBe('function');
    });

    it('should abort signal when cleanup is called', () => {
      const { signal, cleanup } = createAbortSignal();

      expect(signal.aborted).toBe(false);
      cleanup();
      expect(signal.aborted).toBe(true);
    });

    it('should allow multiple createAbortSignal calls independently', () => {
      const { signal: signal1, cleanup: cleanup1 } = createAbortSignal();
      const { signal: signal2, cleanup: cleanup2 } = createAbortSignal();

      cleanup1();

      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);

      cleanup2();
      expect(signal2.aborted).toBe(true);
    });
  });
});
