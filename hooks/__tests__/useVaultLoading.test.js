/**
 * Tests for useVaultLoading hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useVaultLoading } from '../useVaultLoading';

// Helper to render hooks
function renderHook(hookCallback, options = {}) {
  const result = { current: null };

  function TestComponent(props) {
    // Call the hook callback with props
    result.current = hookCallback(props);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent {...(options.initialProps || {})} />);
  });

  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent {...newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useVaultLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with loading states', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.preparingVault).toBe(true);
    expect(result.current.preparingMessage).toBe('Connecting to your vault');
    expect(result.current.shouldShowLoading).toBe(true);
  });

  it('should rotate through preparing messages', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    expect(result.current.preparingMessage).toBe('Connecting to your vault');

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.preparingMessage).toBe('Verifying your wallet credentials');

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.preparingMessage).toBe('Loading your collateral positions');
  });

  it('should cycle back to first message after all messages', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    // Advance through all 8 messages (updated message count)
    act(() => {
      jest.advanceTimersByTime(16000); // 8 messages * 2000ms
    });

    expect(result.current.preparingMessage).toBe('Connecting to your vault');
  });

  it('should stop rotating messages when preparingVault is false', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    act(() => {
      result.current.setPreparingVault(false);
    });

    const initialMessage = result.current.preparingMessage;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.preparingMessage).toBe(initialMessage);
  });

  it('should reset message when preparingVault becomes false', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.preparingMessage).not.toBe('Connecting to your vault');

    act(() => {
      result.current.setPreparingVault(false);
    });

    expect(result.current.preparingMessage).toBe('Connecting to your vault');
  });

  it('should reset state when visibility becomes false', () => {
    const { result, rerender } = renderHook(
      (props) => useVaultLoading(props.visible),
      { initialProps: { visible: true } }
    );

    // Initially should be in preparing state
    expect(result.current.preparingVault).toBe(true);

    // Change visibility to false - should reset state
    rerender({ visible: false });

    // Should reset preparingVault to false
    expect(result.current.preparingVault).toBe(false);
    expect(result.current.preparingMessage).toBe('Connecting to your vault');
  });

  it('should update isLoading state', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setIsLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should calculate shouldShowLoading correctly', () => {
    const { result } = renderHook(() => useVaultLoading(true));

    expect(result.current.shouldShowLoading).toBe(true);

    act(() => {
      result.current.setIsLoading(false);
    });

    expect(result.current.shouldShowLoading).toBe(true); // Still true because preparingVault is true

    act(() => {
      result.current.setPreparingVault(false);
    });

    expect(result.current.shouldShowLoading).toBe(false); // Now false because both are false
  });

  it('should cleanup interval on unmount', () => {
    const { unmount } = renderHook(() => useVaultLoading(true));

    // Unmount should not throw and should cleanup
    expect(() => unmount()).not.toThrow();
  });
});
