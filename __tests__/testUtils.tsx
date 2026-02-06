/**
 * Shared Test Utilities
 * Provides typed helpers for testing React hooks and components
 */

import React, { type ReactElement } from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Result object from renderHook
 */
export interface RenderHookResult<T> {
  result: { current: T | null };
  rerender: (newProps?: unknown) => void;
  unmount: () => void;
}

/**
 * Options for renderHook
 */
export interface RenderHookOptions<P = unknown> {
  initialProps?: P;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Render a hook for testing with proper typing
 * @param hook - The hook function to test
 * @param options - Options including initial props and wrapper
 * @returns Object with result, rerender, and unmount functions
 */
export function renderHook<T, P = unknown>(
  hook: (props?: P) => T,
  options: RenderHookOptions<P> = {}
): RenderHookResult<T> {
  const { initialProps, wrapper: Wrapper } = options;
  const result: { current: T | null } = { current: null };
  let component: ReactTestRenderer | undefined;

  function TestComponent({ hookProps }: { hookProps?: P }): null {
    result.current = hook(hookProps);
    return null;
  }

  const element = Wrapper ? (
    <Wrapper>
      <TestComponent hookProps={initialProps} />
    </Wrapper>
  ) : (
    <TestComponent hookProps={initialProps} />
  );

  act(() => {
    component = create(element);
  });

  return {
    result,
    rerender: (newProps?: unknown) => {
      const newElement = Wrapper ? (
        <Wrapper>
          <TestComponent hookProps={newProps as P} />
        </Wrapper>
      ) : (
        <TestComponent hookProps={newProps as P} />
      );
      act(() => {
        component?.update(newElement);
      });
    },
    unmount: () => {
      component?.unmount();
    },
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitFor(
  callback: () => void | Promise<void>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  await callback(); // Final attempt, will throw if still failing
}

/**
 * Type guard to assert value is not null
 */
export function assertNotNull<T>(value: T | null, message = 'Value is null'): asserts value is T {
  if (value === null) {
    throw new Error(message);
  }
}

/**
 * Type-safe mock function creator
 */
export function createMockFn<T extends (...args: unknown[]) => unknown>(): jest.Mock<ReturnType<T>, Parameters<T>> {
  return jest.fn() as jest.Mock<ReturnType<T>, Parameters<T>>;
}

/**
 * Cast a module to its mocked version for type-safe mock access
 */
export function asMock<T>(module: T): jest.Mocked<T> {
  return module as jest.Mocked<T>;
}

/**
 * Get mock function with proper typing
 */
export function getMockFn<T extends (...args: unknown[]) => unknown>(
  fn: T
): jest.Mock<ReturnType<T>, Parameters<T>> {
  return fn as unknown as jest.Mock<ReturnType<T>, Parameters<T>>;
}
