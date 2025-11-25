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

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTurboSnackbarQueue(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component.unmount,
    component,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useTurboSnackbarQueue', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete global.pendingTurboSnackbars;
    delete global.showTurboSnackbar;
    delete global.dismissTurboSnackbar;
    mockProps = {
      isAuthenticated: true,
      shouldShowPinOverlay: false,
      showSnackbar: jest.fn(),
      dismissSnackbar: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.pendingTurboSnackbars;
    delete global.showTurboSnackbar;
    delete global.dismissTurboSnackbar;
  });

  it('should return showSnackbarWithDedup function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.showSnackbarWithDedup).toBe('function');
  });

  it('should expose global showTurboSnackbar when authenticated', () => {
    renderHookWithProps(mockProps);

    expect(global.showTurboSnackbar).toBeDefined();
    expect(typeof global.showTurboSnackbar).toBe('function');
  });

  it('should expose global dismissTurboSnackbar when authenticated', () => {
    renderHookWithProps(mockProps);

    expect(global.dismissTurboSnackbar).toBeDefined();
    expect(typeof global.dismissTurboSnackbar).toBe('function');
  });

  it('should not expose globals when not authenticated', () => {
    renderHookWithProps({
      ...mockProps,
      isAuthenticated: false,
    });

    expect(global.showTurboSnackbar).toBeUndefined();
  });

  it('should not expose globals when pin overlay is shown', () => {
    renderHookWithProps({
      ...mockProps,
      shouldShowPinOverlay: true,
    });

    expect(global.showTurboSnackbar).toBeUndefined();
  });

  it('should show snackbar without deduplication for first call', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.showSnackbarWithDedup({
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
      type: 'success',
      action: 'claim',
      description: 'Success!',
    };

    act(() => {
      result.current.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);

    // Try to show same snackbar again within 3 seconds
    act(() => {
      jest.advanceTimersByTime(1000);
      result.current.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('should allow same snackbar after 3 seconds', () => {
    const { result } = renderHookWithProps(mockProps);

    const snackbarParams = {
      type: 'success',
      action: 'claim',
      description: 'Success!',
    };

    act(() => {
      result.current.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);

    // Advance past 3 second window
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    act(() => {
      result.current.showSnackbarWithDedup(snackbarParams);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(2);
  });

  it('should allow different snackbars', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.showSnackbarWithDedup({
        type: 'success',
        action: 'claim',
        description: 'Success!',
      });
    });

    act(() => {
      result.current.showSnackbarWithDedup({
        type: 'error',
        action: 'claim',
        description: 'Error!',
      });
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(2);
  });

  it('should process queued snackbars', () => {
    global.pendingTurboSnackbars = [
      { type: 'success', action: 'claim', description: 'Queued!' },
    ];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'success',
      action: 'claim',
      description: 'Queued!',
    });
    expect(global.pendingTurboSnackbars).toEqual([]);
  });

  it('should poll for queued snackbars', () => {
    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();

    // Add queued snackbar
    global.pendingTurboSnackbars = [
      { type: 'info', action: 'swap', description: 'Later!' },
    ];

    // Advance poll interval
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'info',
      action: 'swap',
      description: 'Later!',
    });
  });

  it('should clear queue on dismissTurboSnackbar', () => {
    global.pendingTurboSnackbars = [
      { type: 'success', action: 'claim', description: 'Will be cleared' },
    ];

    renderHookWithProps(mockProps);

    act(() => {
      global.dismissTurboSnackbar();
    });

    expect(global.pendingTurboSnackbars).toEqual([]);
    expect(mockProps.dismissSnackbar).toHaveBeenCalled();
  });

  it('should cleanup globals on unmount', () => {
    const { unmount } = renderHookWithProps(mockProps);

    expect(global.showTurboSnackbar).toBeDefined();

    act(() => {
      unmount();
    });

    expect(global.showTurboSnackbar).toBeUndefined();
    expect(global.dismissTurboSnackbar).toBeUndefined();
  });

  it('should show only the last queued snackbar', () => {
    global.pendingTurboSnackbars = [
      { type: 'success', action: 'claim', description: 'First' },
      { type: 'error', action: 'claim', description: 'Second' },
      { type: 'info', action: 'claim', description: 'Third' },
    ];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).toHaveBeenCalledWith({
      type: 'info',
      action: 'claim',
      description: 'Third',
    });
    expect(mockProps.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('should handle empty pendingTurboSnackbars', () => {
    global.pendingTurboSnackbars = [];

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });

  it('should handle undefined pendingTurboSnackbars', () => {
    delete global.pendingTurboSnackbars;

    renderHookWithProps(mockProps);

    expect(mockProps.showSnackbar).not.toHaveBeenCalled();
  });
});
