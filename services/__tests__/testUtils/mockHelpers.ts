/**
 * Type-safe mock helpers for testing
 * Provides utilities to work with Jest mocks without using `as any`
 */

/**
 * Type for a Jest mock function
 */
export type MockFunction<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> =
  jest.Mock<ReturnType<T>, Parameters<T>>;

/**
 * Type for a mocked module function
 */
export type MockedFunction<T extends (...args: unknown[]) => unknown> = jest.MockedFunction<T>;

/**
 * Cast a function to its mocked type
 * Use this instead of `as jest.Mock` for better type inference
 */
export function asMock<T extends (...args: unknown[]) => unknown>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>;
}

/**
 * Cast a hook to its mocked type
 * Specifically for React hooks that return objects
 */
export function asMockedHook<T extends (...args: unknown[]) => unknown>(
  hook: T
): jest.MockedFunction<T> {
  return hook as jest.MockedFunction<T>;
}

/**
 * Create a typed mock function
 */
export function createMock<T extends (...args: unknown[]) => unknown>(): jest.MockedFunction<T> {
  return jest.fn() as unknown as jest.MockedFunction<T>;
}

/**
 * Type-safe way to set mock return value
 */
export function setMockReturnValue<T extends (...args: unknown[]) => unknown>(
  fn: T,
  value: ReturnType<T>
): void {
  (fn as jest.MockedFunction<T>).mockReturnValue(value);
}

/**
 * Type-safe way to set mock resolved value for async functions
 */
export function setMockResolvedValue<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  value: Awaited<ReturnType<T>>
): void {
  (fn as jest.MockedFunction<T>).mockResolvedValue(value as never);
}

/**
 * Type-safe way to set mock rejected value
 */
export function setMockRejectedValue<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  error: unknown
): void {
  (fn as jest.MockedFunction<T>).mockRejectedValue(error as never);
}

/**
 * Get mock call arguments
 */
export function getMockCalls<T extends (...args: unknown[]) => unknown>(
  fn: T
): Parameters<T>[] {
  return (fn as jest.MockedFunction<T>).mock.calls;
}

/**
 * Get the last mock call arguments
 */
export function getLastMockCall<T extends (...args: unknown[]) => unknown>(
  fn: T
): Parameters<T> | undefined {
  const calls = getMockCalls(fn);
  return calls[calls.length - 1];
}

/**
 * Assert a mock was called with specific arguments
 */
export function expectMockCalledWith<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ...args: Parameters<T>
): void {
  expect(fn).toHaveBeenCalledWith(...args);
}

/**
 * Clear all mock data
 */
export function clearMock<T extends (...args: unknown[]) => unknown>(fn: T): void {
  (fn as jest.MockedFunction<T>).mockClear();
}

/**
 * Reset a mock to its initial state
 */
export function resetMock<T extends (...args: unknown[]) => unknown>(fn: T): void {
  (fn as jest.MockedFunction<T>).mockReset();
}
