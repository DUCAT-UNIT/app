/**
 * API utilities
 */

/**
 * Fetch with timeout
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Fetch response
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};
