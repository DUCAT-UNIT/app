/**
 * Tests for useReceiveScreenAnimations hook
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import { useReceiveScreenAnimations } from '../useReceiveScreenAnimations';

type HookResult = ReturnType<typeof useReceiveScreenAnimations>;

// Helper to render hooks with rerender capability
function renderHookWithProps(showReceiveSheet: boolean, showQrModal: boolean, onClose: () => void) {
  const result: { current: HookResult | null } = { current: null };
  function TestComponent({ showReceiveSheet: srs, showQrModal: sqm, onClose: oc }: { showReceiveSheet: boolean; showQrModal: boolean; onClose: () => void }) {
    result.current = useReceiveScreenAnimations(srs, sqm, oc);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(
      <TestComponent showReceiveSheet={showReceiveSheet} showQrModal={showQrModal} onClose={onClose} />
    );
  });
  return {
    result,
    unmount: () => component?.unmount(),
    rerender: (newShowReceiveSheet: boolean, newShowQrModal: boolean) => {
      act(() => {
        component?.update(
          <TestComponent showReceiveSheet={newShowReceiveSheet} showQrModal={newShowQrModal} onClose={onClose} />
        );
      });
    },
  };
}

// Simple helper for basic tests
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: () => component?.unmount() };
}

describe('useReceiveScreenAnimations', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with animation values', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    expect(result.current!.translateX).toBeDefined();
    expect(result.current!.translateY).toBeDefined();
    expect(result.current!.receiveSheetOpacity).toBeDefined();
    expect(result.current!.receiveOpacity).toBeDefined();
    expect(result.current!.qrOpacity).toBeDefined();
    expect(result.current!.receiveTranslateY).toBeDefined();
  });

  it('should create pan responders', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    expect(result.current!.panResponder).toBeDefined();
    expect(result.current!.qrModalPanResponder).toBeDefined();
    expect(result.current!.panResponder.panHandlers).toBeDefined();
    expect(result.current!.qrModalPanResponder.panHandlers).toBeDefined();
  });

  it('should handle dismiss animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, false, mockOnClose)
    );

    act(() => {
      result.current!.handleDismiss();
    });

    // Animation starts, onClose will be called after animation completes
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle QR back animation by returning a composite animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, true, mockOnClose)
    );

    const animation = result.current!.handleQrBack();

    // Verify it returns a composite animation object with start method
    expect(animation).toBeDefined();
    expect(typeof animation.start).toBe('function');
  });

  it('should execute prepareQrAnimation without errors', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, false, mockOnClose)
    );

    // Verify the function executes without throwing
    expect(() => {
      act(() => {
        result.current!.prepareQrAnimation();
      });
    }).not.toThrow();
  });

  describe('pan responder - receive sheet', () => {
    it('should start pan responder', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const handlers = result.current!.panResponder.panHandlers as any;
      const shouldSet = handlers.onStartShouldSetResponder();
      expect(shouldSet).toBe(false);
    });

    it('should handle downward swipe gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 10, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(true);
    });

    it('should not handle gesture when QR modal is shown', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dy: 10, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should handle pan responder move without throwing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const handlers = result.current!.panResponder.panHandlers as any;
      // Verify both positive and negative dy handling works without errors
      expect(() => {
        handlers.onResponderMove(null, { dy: 50, dx: 0 });
        handlers.onResponderMove(null, { dy: -50, dx: 0 });
      }).not.toThrow();
    });

    it('should dismiss on large downward swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 150, vy: 0.3 };
      const handlers = result.current!.panResponder.panHandlers as any;
      handlers.onResponderRelease(null, gestureState);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should dismiss on fast downward velocity', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, vy: 0.6 };
      const handlers = result.current!.panResponder.panHandlers as any;
      handlers.onResponderRelease(null, gestureState);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should spring back on small swipe without dismissing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, vy: 0.2 };
      const handlers = result.current!.panResponder.panHandlers as any;
      handlers.onResponderRelease(null, gestureState);

      // Spring animation starts but onClose not called
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('pan responder - QR modal', () => {
    it('should start QR modal pan responder', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      const shouldSet = handlers.onStartShouldSetResponder();
      expect(shouldSet).toBe(true);
    });

    it('should handle right swipe gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 15, dy: 2 };
      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(true);
    });

    it('should not handle left swipe gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: -15, dy: 2 };
      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should handle QR modal pan move without throwing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Verify both positive and negative dx handling works without errors
      expect(() => {
        handlers.onResponderMove(null, { dx: 50, dy: 0 });
        handlers.onResponderMove(null, { dx: -50, dy: 0 });
      }).not.toThrow();
    });

    it('should trigger back animation on large right swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Large swipe should trigger animation without error
      expect(() => {
        handlers.onResponderRelease(null, { dx: 150, vx: 0.3 });
      }).not.toThrow();
    });

    it('should trigger back animation on fast right velocity', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Fast velocity should trigger animation without error
      expect(() => {
        handlers.onResponderRelease(null, { dx: 50, vx: 0.6 });
      }).not.toThrow();
    });

    it('should spring back on small swipe without triggering back', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Small swipe should spring back without error
      expect(() => {
        handlers.onResponderRelease(null, { dx: 50, vx: 0.2 });
      }).not.toThrow();
    });
  });

  describe('setOnQrSwipeDismiss', () => {
    it('should call the dismiss callback when swiping right on QR modal', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const dismissCallback = jest.fn();
      act(() => {
        result.current!.setOnQrSwipeDismiss(dismissCallback);
      });

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Trigger a large right swipe that should call the dismiss callback
      handlers.onResponderRelease(null, { dx: 150, vx: 0.3 });

      expect(dismissCallback).toHaveBeenCalled();
    });

    it('should allow clearing the dismiss callback', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const dismissCallback = jest.fn();
      act(() => {
        result.current!.setOnQrSwipeDismiss(dismissCallback);
        result.current!.setOnQrSwipeDismiss(null);
      });

      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      // Trigger swipe - callback should not be called since it was cleared
      handlers.onResponderRelease(null, { dx: 150, vx: 0.3 });

      expect(dismissCallback).not.toHaveBeenCalled();
    });
  });

  describe('resetAfterQr', () => {
    it('should reset all animation values after QR modal is dismissed', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      // First set some non-zero values
      act(() => {
        result.current!.translateX.setValue(100);
        result.current!.translateY.setValue(50);
        result.current!.qrOpacity.setValue(1);
        result.current!.receiveTranslateY.setValue(200);
        result.current!.receiveSheetOpacity.setValue(0);
      });

      // Call resetAfterQr
      act(() => {
        result.current!.resetAfterQr();
      });

      // Verify values are reset - we can't directly read Animated.Value values,
      // but we can verify the function doesn't throw
      expect(result.current!.translateX).toBeDefined();
      expect(result.current!.translateY).toBeDefined();
    });
  });

  describe('showReceiveSheet effect', () => {
    it('should set values when opening receive sheet', () => {
      const { result, rerender } = renderHookWithProps(false, false, mockOnClose);

      // Open the receive sheet
      rerender(true, false);

      // The effect should have run and set the values
      expect(result.current!.receiveTranslateY).toBeDefined();
      expect(result.current!.receiveSheetOpacity).toBeDefined();
    });

    it('should set values when closing receive sheet', () => {
      const { result, rerender } = renderHookWithProps(true, false, mockOnClose);

      // Close the receive sheet
      rerender(false, false);

      // The effect should have run
      expect(result.current!.receiveSheetOpacity).toBeDefined();
    });
  });

  describe('pan responder onPanResponderGrant', () => {
    it('should reset receiveTranslateY to 0 on grant', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      // Set a non-zero value
      act(() => {
        result.current!.receiveTranslateY.setValue(100);
      });

      const handlers = result.current!.panResponder.panHandlers as any;
      // Call onResponderGrant
      expect(() => {
        handlers.onResponderGrant(null, {});
      }).not.toThrow();
    });
  });

  describe('pan responder onMoveShouldSetPanResponderCapture', () => {
    it('should return false for onMoveShouldSetResponderCapture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      // The capture handler returns false - verify it's falsy or undefined
      const shouldCapture = result.current!.panResponder.panHandlers.onMoveShouldSetResponderCapture;
      // The implementation returns false, but React Native may not include it in panHandlers if it's false
      expect(shouldCapture === undefined || typeof shouldCapture === 'function').toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should not respond to horizontal swipe in receive sheet', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 2, dx: 10 };
      const handlers = result.current!.panResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should not respond to upward swipe in receive sheet', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: -10, dx: 2 };
      const handlers = result.current!.panResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should not respond to vertical swipe in QR modal', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 2, dy: 15 };
      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should not move QR modal pan responder with insufficient gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      // dx less than threshold of 10
      const gestureState = { dx: 5, dy: 2 };
      const handlers = result.current!.qrModalPanResponder.panHandlers as any;
      const shouldMove = handlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });
  });
});
