/**
 * Tests for useBottomSheetAnimation hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useBottomSheetAnimation } from '../useBottomSheetAnimation';

// Helper to render hooks
function renderHook<T, P extends Record<string, unknown> = Record<string, unknown>>(
  hookCallback: (props: P) => T,
  options: { initialProps?: P } = {}
) {
  const result: { current: T | null } = { current: null };

  function TestComponent(props: P) {
    result.current = hookCallback(props);
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent {...(options.initialProps || ({} as P))} />);
  });

  return {
    result,
    rerender: (newProps?: P) => {
      act(() => {
        component?.update(<TestComponent {...(newProps || ({} as P))} />);
      });
    },
    unmount: () => component?.unmount(),
  };
}

describe('useBottomSheetAnimation', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct values', () => {
    const { result } = renderHook(
      ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
      { initialProps: { isVisible: false, onClose: mockOnClose } }
    );

    expect(result.current!.opacity).toBeDefined();
    expect(result.current!.translateY).toBeDefined();
    expect(result.current!.panResponder).toBeDefined();
    expect(result.current!.handleDismiss).toBeDefined();
  });

  it('should have pan responder handlers', () => {
    const { result } = renderHook(
      ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
      { initialProps: { isVisible: true, onClose: mockOnClose } }
    );

    const handlers = result.current!.panResponder.panHandlers as Record<string, unknown>;
    expect(result.current!.panResponder.panHandlers).toBeDefined();
    expect(handlers.onStartShouldSetResponder).toBeDefined();
    expect(handlers.onMoveShouldSetResponder).toBeDefined();
  });

  it('should call onClose when handleDismiss is called', () => {
    const { result } = renderHook(
      ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
      { initialProps: { isVisible: true, onClose: mockOnClose } }
    );

    act(() => {
      result.current!.handleDismiss();
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should animate in when isVisible changes to true', () => {
    const { rerender } = renderHook(
      ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
      { initialProps: { isVisible: false, onClose: mockOnClose } }
    );

    rerender({ isVisible: true, onClose: mockOnClose });

    // Animation starts, onClose should not be called
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should handle visibility change to false without errors', () => {
    const { rerender } = renderHook(
      ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
      { initialProps: { isVisible: true, onClose: mockOnClose } }
    );

    // Verify visibility change handles cleanup without throwing
    expect(() => {
      rerender({ isVisible: false, onClose: mockOnClose });
    }).not.toThrow();
  });

  describe('pan responder - gesture handling', () => {
    it('should start pan responder', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      const shouldSet = handlers.onStartShouldSetResponder();
      expect(shouldSet).toBe(true);
    });

    it('should respond to downward swipes', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 10, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(true);
    });

    it('should not respond to upward swipes', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: -10, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should not respond to horizontal swipes', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 2, dx: 10 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should not respond to small gestures', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 3, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should handle move gestures without throwing', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      // Verify both downward and upward moves work without errors
      expect(() => {
        handlers.onResponderMove(null, { dy: 50, dx: 0 });
        handlers.onResponderMove(null, { dy: -50, dx: 0 });
      }).not.toThrow();
    });

    it('should dismiss on large downward swipe', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 150, vy: 0.3 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should dismiss on fast downward velocity', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 50, vy: 0.6 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should spring back on small swipe', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      const gestureState = { dy: 50, vy: 0.2 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should spring back on threshold boundary', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      // Exactly at threshold (100)
      const gestureState = { dy: 100, vy: 0.3 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      // Should spring back (not dismiss) since condition is >100
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should dismiss just above threshold', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      // Just above threshold (101)
      const gestureState = { dy: 101, vy: 0.3 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      // Should dismiss
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should spring back on velocity threshold boundary', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      // Exactly at velocity threshold (0.5)
      const gestureState = { dy: 50, vy: 0.5 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      // Should spring back (not dismiss) since condition is >0.5
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should dismiss just above velocity threshold', () => {
      const { result } = renderHook(
        ({ isVisible, onClose }) => useBottomSheetAnimation(isVisible, onClose),
        { initialProps: { isVisible: true, onClose: mockOnClose } }
      );

      // Just above velocity threshold (0.51)
      const gestureState = { dy: 50, vy: 0.51 };
      const handlers = result.current!.panResponder.panHandlers as Record<string, (...args: unknown[]) => unknown>;
      handlers.onResponderRelease(
        null,
        gestureState
      );

      // Should dismiss
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
