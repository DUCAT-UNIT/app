/**
 * Type-safe renderHook utility for testing React hooks
 * Replaces the common untyped pattern used across test files
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

/**
 * Result type returned by renderHook
 */
export interface RenderHookResult<T> {
  result: { current: T | null };
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
}

/**
 * Options for renderHook
 */
export interface RenderHookOptions {
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Render a hook and return its result
 * @param hook - Function that calls the hook
 * @param options - Optional wrapper component
 * @returns Object with result, rerender, and unmount functions
 */
export function renderHook<T>(
  hook: () => T,
  options: RenderHookOptions = {}
): RenderHookResult<T> {
  const { wrapper: Wrapper } = options;
  const result: { current: T | null } = { current: null };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  let component: ReactTestRenderer | undefined;
  act(() => {
    component = Wrapper
      ? create(
          <Wrapper>
            <TestComponent />
          </Wrapper>
        )
      : create(<TestComponent />);
  });

  if (!component) {
    throw new Error('Failed to create test component');
  }

  return {
    result,
    rerender: component.update.bind(component),
    unmount: component.unmount.bind(component),
  };
}

/**
 * Type guard to assert result.current is not null
 * Throws if the value is null
 */
export function assertHookResult<T>(result: { current: T | null }): asserts result is { current: T } {
  if (result.current === null) {
    throw new Error('Hook result is null - component may not have rendered');
  }
}

/**
 * Get hook result with type assertion
 * Convenience function that returns typed result
 */
export function getHookResult<T>(result: { current: T | null }): T {
  assertHookResult(result);
  return result.current;
}
