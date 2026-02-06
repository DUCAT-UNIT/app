/**
 * Tests for useTurboSnackbarQueue hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTurboSnackbarQueue } from '../useTurboSnackbarQueue';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock turboGlobal to use actual global object
jest.mock('../../services/turbo/turboTokenStorage', () => ({
  turboGlobal: global,
}));

// Helper to render hooks with props
function renderHookWithProps(props: any) {
  const result: { current: ReturnType<typeof useTurboSnackbarQueue> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: any }) {
    result.current = useTurboSnackbarQueue(hookProps);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useTurboSnackbarQueue', () => {
  let mockProps: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete (global as any).pendingTurboSnackbars;
    mockProps = {
      isAuthenticated: true,
      shouldShowPinOverlay: false,
      showSnackbar: jest.fn(),
      dismissSnackbar: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as any).pendingTurboSnackbars;
  });

  it('should return showSnackbarWithDedup function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.showSnackbarWithDedup).toBe('function');
  });

  it('should show snackbar without deduplication for first call', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.showSnackbarWithDedup({
        type: 'success',
        action: 'claim',
        description: 'Success!',
      });
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'success',
      action: 'claim',
      description: 'Success!',
    });
  });

  it('should deduplicate identical snackbars within 3 seconds', () => {
    const { result } = renderHookWithProps(mockProps);

    const snackbarParams = {
      type: 'success' as const,
      action: 'claim',
      description: 'Success!',
    };

    act(() => {
      result.current!.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);

    // Try to show same snackbar again within 3 seconds
    act(() => {
      jest.advanceTimersByTime(1000);
      result.current!.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('should allow same snackbar after 3 seconds', () => {
    const { result } = renderHookWithProps(mockProps);

    const snackbarParams = {
      type: 'success' as const,
      action: 'claim',
      description: 'Success!',
    };

    act(() => {
      result.current!.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);

    // Advance past 3 second window
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    act(() => {
      result.current!.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(2);
  });

  it('should allow different snackbars', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current!.showSnackbarWithDedup({
        type: 'success',
        action: 'claim',
        description: 'Success!',
      });
    });

    act(() => {
      result.current!.showSnackbarWithDedup({
        type: 'error',
        action: 'claim',
        description: 'Error!',
      });
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(2);
  });

  it('should process queued snackbars on mount', () => {
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'Queued!' },
    ];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'success',
      message: 'Queued!',
    });
    expect((global as any).pendingTurboSnackbars).toEqual([]);
  });

  it('should poll for queued snackbars', () => {
    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();

    // Add queued snackbar
    (global as any).pendingTurboSnackbars = [
      { type: 'info', message: 'Later!' },
    ];

    // Advance poll interval
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'info',
      message: 'Later!',
    });
  });

  it('should clear queue after processing', () => {
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'Will be cleared' },
    ];

    renderHookWithProps(mockProps);

    expect((global as any).pendingTurboSnackbars).toEqual([]);
  });

  it('should show only the last queued snackbar', () => {
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'First' },
      { type: 'error', message: 'Second' },
      { type: 'info', message: 'Third' },
    ];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'info',
      message: 'Third',
    });
    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('should handle empty pendingTurboSnackbars', () => {
    (global as any).pendingTurboSnackbars = [];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should handle undefined pendingTurboSnackbars', () => {
    delete (global as any).pendingTurboSnackbars;

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should not process snackbars when not authenticated', () => {
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'Should not show' },
    ];

    renderHookWithProps({
      ...mockProps,
      isAuthenticated: false,
    });

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should not process snackbars when pin overlay is shown', () => {
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'Should not show' },
    ];

    renderHookWithProps({
      ...mockProps,
      shouldShowPinOverlay: true,
    });

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', () => {
    const { unmount } = renderHookWithProps(mockProps);

    // Unmount the component
    act(() => {
      unmount();
    });

    // Add snackbar after unmount
    (global as any).pendingTurboSnackbars = [
      { type: 'success', message: 'After unmount' },
    ];

    // Advance timer - should not process since unmounted
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should not process snackbars after unmount even with queued items', () => {
    const { unmount } = renderHookWithProps(mockProps);

    // Queue a snackbar but unmount before it's processed
    act(() => {
      unmount();
    });

    // Even if we add snackbars after unmount, they shouldn't be processed
    (global as any).pendingTurboSnackbars = [
      { type: 'error', message: 'Too late' },
    ];

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

});
