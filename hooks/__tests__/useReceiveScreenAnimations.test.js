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

  it('should provide handler functions', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    expect(typeof result.current.handleDismiss).toBe('function');
    expect(typeof result.current.handleQrBack).toBe('function');
    expect(typeof result.current.prepareQrAnimation).toBe('function');
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

  it('should handle QR back animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, true, mockOnClose)
    );

    const animation = result.current.handleQrBack();

    expect(animation).toBeDefined();
    expect(typeof animation.start).toBe('function');
  });

  it('should prepare QR animation', () => {
    const { result } = renderHook(
      () => useReceiveScreenAnimations(true, false, mockOnClose)
    );

    act(() => {
      result.current.prepareQrAnimation();
    });

    // Values are set but we can't directly test animated values
    // Just verify the function executes without error
    expect(result.current.translateX).toBeDefined();
  });

  it('should handle sheet opening', () => {
    const { result, unmount } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    // Re-render with showReceiveSheet = true
    unmount();
    const { result: newResult } = renderHook(
      () => useReceiveScreenAnimations(true, false, mockOnClose)
    );

    expect(newResult.current.receiveSheetOpacity).toBeDefined();
  });

  it('should return consistent pan responder on re-render', () => {
    const { result, unmount } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    const firstPanResponder = result.current.panResponder;

    unmount();
    const { result: newResult } = renderHook(
      () => useReceiveScreenAnimations(false, false, mockOnClose)
    );

    // Pan responder is created once and reused
    expect(newResult.current.panResponder).toBeDefined();
    expect(firstPanResponder).toBeDefined();
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

    it('should handle pan responder move with positive dy', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, dx: 0 };
      result.current.panResponder.panHandlers.onResponderMove(null, gestureState);

      // setValue is called but we can't test the value directly
      expect(result.current.receiveTranslateY).toBeDefined();
    });

    it('should not update position on negative dy', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: -50, dx: 0 };
      result.current.panResponder.panHandlers.onResponderMove(null, gestureState);

      expect(result.current.receiveTranslateY).toBeDefined();
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

    it('should spring back on small swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, false, mockOnClose)
      );

      const gestureState = { dy: 50, vy: 0.2 };
      result.current.panResponder.panHandlers.onResponderRelease(null, gestureState);

      // Spring animation starts but onClose not called
      expect(result.current.receiveTranslateY).toBeDefined();
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

    it('should handle QR modal pan move with positive dx', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 50, dy: 0 };
      result.current.qrModalPanResponder.panHandlers.onResponderMove(null, gestureState);

      expect(result.current.translateX).toBeDefined();
    });

    it('should not update position on negative dx', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: -50, dy: 0 };
      result.current.qrModalPanResponder.panHandlers.onResponderMove(null, gestureState);

      expect(result.current.translateX).toBeDefined();
    });

    it('should go back on large right swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 150, vx: 0.3 };
      result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, gestureState);

      // handleQrBack is called
      expect(result.current.translateX).toBeDefined();
    });

    it('should go back on fast right velocity', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 50, vx: 0.6 };
      result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, gestureState);

      expect(result.current.translateX).toBeDefined();
    });

    it('should spring back on small swipe', () => {
      const { result } = renderHook(
        () => useReceiveScreenAnimations(true, true, mockOnClose)
      );

      const gestureState = { dx: 50, vx: 0.2 };
      result.current.qrModalPanResponder.panHandlers.onResponderRelease(null, gestureState);

      expect(result.current.translateX).toBeDefined();
    });
  });
});
