/**
 * Fetch Mock Utilities for Tests
 *
 * Provides type-safe fetch mocking for service tests.
 * This replaces the unsafe `(global as any).fetch` pattern.
 */

/**
 * Mock fetch function type
 */
type MockFetch = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

/**
 * Extended global type with mock fetch
 */
declare global {
  // eslint-disable-next-line no-var
  var __mockFetch: MockFetch | undefined;
}

/**
 * Setup mock fetch on global
 * Call this in beforeEach to reset the mock
 */
export function setupMockFetch(): MockFetch {
  const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  global.fetch = mockFetch as unknown as typeof fetch;
  global.__mockFetch = mockFetch;
  return mockFetch;
}

/**
 * Get the current mock fetch instance
 */
export function getMockFetch(): MockFetch {
  if (!global.__mockFetch) {
    throw new Error('Mock fetch not set up. Call setupMockFetch() in beforeEach.');
  }
  return global.__mockFetch;
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options;

  return {
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  } as unknown as Response;
}

/**
 * Setup mock fetch to return a successful JSON response
 */
export function mockFetchSuccess(data: unknown): void {
  getMockFetch().mockResolvedValueOnce(createMockResponse(data));
}

/**
 * Setup mock fetch to return multiple successful responses
 */
export function mockFetchSuccessSequence(dataSequence: unknown[]): void {
  const mockFetch = getMockFetch();
  dataSequence.forEach(data => {
    mockFetch.mockResolvedValueOnce(createMockResponse(data));
  });
}

/**
 * Setup mock fetch to return an error response
 */
export function mockFetchError(status: number, statusText: string): void {
  getMockFetch().mockResolvedValueOnce(
    createMockResponse({ error: statusText }, { ok: false, status, statusText })
  );
}

/**
 * Setup mock fetch to reject with an error
 */
export function mockFetchReject(error: Error): void {
  getMockFetch().mockRejectedValueOnce(error);
}

/**
 * Setup mock fetch with custom implementation
 */
export function mockFetchImplementation(
  implementation: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): void {
  getMockFetch().mockImplementation(implementation);
}

/**
 * Clear mock fetch
 */
export function clearMockFetch(): void {
  getMockFetch().mockClear();
}

/**
 * Get the number of times fetch was called
 */
export function getFetchCallCount(): number {
  return getMockFetch().mock.calls.length;
}

/**
 * Get fetch call arguments
 */
export function getFetchCall(index: number): [RequestInfo | URL, RequestInit?] | undefined {
  return getMockFetch().mock.calls[index];
}

/**
 * Assert fetch was called with URL containing substring
 */
export function expectFetchCalledWithUrl(urlSubstring: string, callIndex = 0): void {
  const call = getFetchCall(callIndex);
  expect(call).toBeDefined();
  expect(String(call![0])).toContain(urlSubstring);
}

/**
 * Get the request body from a fetch call (parsed as JSON)
 */
export function getFetchCallBody<T = unknown>(callIndex: number): T | undefined {
  const call = getFetchCall(callIndex);
  if (!call || !call[1]?.body) {
    return undefined;
  }
  return JSON.parse(call[1].body as string) as T;
}

/**
 * Assert fetch was not called
 */
export function expectFetchNotCalled(): void {
  expect(getFetchCallCount()).toBe(0);
}

/**
 * Create a mock Response object for plain text responses
 * Use this when the API returns plain text instead of JSON
 */
export function createMockTextResponse(
  text: string | null,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options;

  return {
    ok,
    status,
    statusText,
    json: jest.fn().mockRejectedValue(new Error('Response is not JSON')),
    text: jest.fn().mockResolvedValue(text),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  } as unknown as Response;
}
