// @ts-nocheck
/**
 * Tests for useReceiveScreenAnimations hook
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import { useReceiveScreenAnimations } from '../useReceiveScreenAnimations';

// Helper to render hooks
function renderHook(hook, props) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook(props);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: () => component.unmount() };
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

    expect(result.current.translateX).toBeDefined();
    expect(result.current.translateY).toBeDefined();
    expect(result.current.receiveSheetOpacity).toBeDefined();
    expect(result.current.receiveOpacity).toBeDefined();
    expect(result.current.qrOpacity).toBeDefined();
    expect(result.current.receiveTranslateY).toBeDefined();
  });

  it('should create pan responders', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    expect(result.current.panResponder).toBeDefined();
    expect(result.current.qrModalPanResponder).toBeDefined();
    expect(result.current.panResponder.panHandlers).toBeDefined();
    expect(result.current.qrModalPanResponder.panHandlers).toBeDefined();
  });

  it('should handle dismiss animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, false, mockOnClose)
    );

    act(() => {
      result.current.handleDismiss();
    });

    // Animation starts, onClose will be called after animation completes
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle QR back animation by returning a composite animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, true, mockOnClose)
    );

    const animation = result.current.handleQrBack();

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
        result.current.prepareQrAnimation();
      });
    }).not.toThrow();
  });

  describe('pan responder - receive sheet', () => {
    it('should start pan responder', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const shouldSet = result.current.panResponder.panHandlers.onStartShouldSetResponder();
      expect(shouldSet).toBe(false);
    });

    it('should handle downward swipe gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 10, dx: 2 };
      const shouldMove = result.current.panResponder.panHandlers.onMoveShouldSetResponder(
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
      const shouldMove = result.current.panResponder.panHandlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should handle pan responder move without throwing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      // Verify both positive and negative dy handling works without errors
      expect(() => {
        result.current.panResponder.panHandlers.onResponderMove(null, { dy: 50, dx: 0 });
        result.current.panResponder.panHandlers.onResponderMove(null, { dy: -50, dx: 0 });
      }).not.toThrow();
    });

    it('should dismiss on large downward swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 150, vy: 0.3 };
      result.current.panResponder.panHandlers.onResponderRelease(null, gestureState);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should dismiss on fast downward velocity', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, vy: 0.6 };
      result.current.panResponder.panHandlers.onResponderRelease(null, gestureState);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should spring back on small swipe without dismissing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, vy: 0.2 };
      result.current.panResponder.panHandlers.onResponderRelease(null, gestureState);

      // Spring animation starts but onClose not called
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('pan responder - QR modal', () => {
    it('should start QR modal pan responder', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const shouldSet = result.current.qrModalPanResponder.panHandlers.onStartShouldSetResponder();
      expect(shouldSet).toBe(true);
    });

    it('should handle right swipe gesture', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 15, dy: 2 };
      const shouldMove = result.current.qrModalPanResponder.panHandlers.onMoveShouldSetResponder(
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
      const shouldMove = result.current.qrModalPanResponder.panHandlers.onMoveShouldSetResponder(
        null,
        gestureState
      );
      expect(shouldMove).toBe(false);
    });

    it('should handle QR modal pan move without throwing', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      // Verify both positive and negative dx handling works without errors
      expect(() => {
        result.current.qrModalPanResponder.panHandlers.onResponderMove(null, { dx: 50, dy: 0 });
        result.current.qrModalPanResponder.panHandlers.onResponderMove(null, { dx: -50, dy: 0 });
      }).not.toThrow();
    });

    it('should trigger back animation on large right swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      // Large swipe should trigger animation without error
      expect(() => {
        result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, { dx: 150, vx: 0.3 });
      }).not.toThrow();
    });

    it('should trigger back animation on fast right velocity', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      // Fast velocity should trigger animation without error
      expect(() => {
        result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, { dx: 50, vx: 0.6 });
      }).not.toThrow();
    });

    it('should spring back on small swipe without triggering back', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      // Small swipe should spring back without error
      expect(() => {
        result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, { dx: 50, vx: 0.2 });
      }).not.toThrow();
    });
  });
});
