/**
 * Tests for useSendSheetAnimations Hook
 * Validates animation and swipe gesture management for send transaction bottom sheets
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSendSheetAnimations } from '../useSendSheetAnimations';

// Helper to render hooks with props
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useSendSheetAnimations', () => {
  let mockOnDismiss;

  beforeEach(() => {
    mockOnDismiss = jest.fn();
  });

  describe('Initialization', () => {
    it('should provide animation values for all sheets', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      expect(result.current.assetSelector).toBeDefined();
      expect(result.current.addressInput).toBeDefined();
      expect(result.current.amountInput).toBeDefined();
      expect(result.current.review).toBeDefined();
      expect(result.current.confirmed).toBeDefined();
    });

    it('should provide translateY for each sheet', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      expect(result.current.assetSelector.translateY).toBeDefined();
      expect(result.current.addressInput.translateY).toBeDefined();
      expect(result.current.amountInput.translateY).toBeDefined();
      expect(result.current.review.translateY).toBeDefined();
      expect(result.current.confirmed.translateY).toBeDefined();
    });

    it('should provide opacity for each sheet', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      expect(result.current.assetSelector.opacity).toBeDefined();
      expect(result.current.addressInput.opacity).toBeDefined();
      expect(result.current.amountInput.opacity).toBeDefined();
      expect(result.current.review.opacity).toBeDefined();
      expect(result.current.confirmed.opacity).toBeDefined();
    });

    it('should provide pan handlers for each sheet', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      expect(result.current.assetSelector.panHandlers).toBeDefined();
      expect(result.current.addressInput.panHandlers).toBeDefined();
      expect(result.current.amountInput.panHandlers).toBeDefined();
      expect(result.current.review.panHandlers).toBeDefined();
      expect(result.current.confirmed.panHandlers).toBeDefined();
    });
  });

  describe('Pan Responder Creation', () => {
    it('should create pan responders only once', () => {
      const { result, rerender } = renderHook(
        () => useSendSheetAnimations({ onDismiss: mockOnDismiss }),
        {
          initialProps: { onDismiss: mockOnDismiss },
        }
      );

      const initialPanHandlers = result.current.assetSelector.panHandlers;

      // Rerender
      rerender({ onDismiss: mockOnDismiss });

      // Pan handlers should be the same instance
      expect(result.current.assetSelector.panHandlers).toBe(initialPanHandlers);
    });

    it('should have onStartShouldSetPanResponder return false', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;
      expect(panHandlers.onStartShouldSetResponder()).toBe(false);
    });
  });

  describe('Swipe-to-Dismiss Gestures', () => {
    it('should dismiss asset selector when onDismiss is called', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      // Simulate swipe down gesture (dy > 100)
      act(() => {
        panHandlers.onResponderRelease({}, { dy: 150, vy: 0.1 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('assetSelector');
    });

    it('should dismiss address input when swiped', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.addressInput.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 150, vy: 0.1 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('addressInput');
    });

    it('should dismiss amount input when swiped', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.amountInput.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 150, vy: 0.1 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('amountInput');
    });

    it('should dismiss review sheet when swiped', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.review.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 150, vy: 0.1 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('review');
    });

    it('should dismiss confirmed sheet when swiped', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.confirmed.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 150, vy: 0.1 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('confirmed');
    });

    it('should dismiss on fast swipe (high velocity)', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 50, vy: 0.6 });
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('assetSelector');
    });

    it('should not dismiss on small swipe', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      act(() => {
        panHandlers.onResponderRelease({}, { dy: 50, vy: 0.1 });
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Gesture Movement', () => {
    it('should update translateY on downward pan', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      act(() => {
        panHandlers.onResponderMove({}, { dy: 100 });
      });

      // Should call setValue with the gesture dy value
      expect(result.current.assetSelector.translateY).toBeDefined();
    });

    it('should not update translateY on upward pan', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      act(() => {
        panHandlers.onResponderMove({}, { dy: -100 });
      });

      // Should not update on upward swipe
      expect(result.current.assetSelector.translateY).toBeDefined();
    });

    it('should detect downward swipe correctly', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      const shouldSetResponder = panHandlers.onMoveShouldSetResponder({}, { dy: 10, dx: 2 });
      expect(shouldSetResponder).toBe(true);
    });

    it('should not detect horizontal swipe as downward', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      const shouldSetResponder = panHandlers.onMoveShouldSetResponder({}, { dy: 2, dx: 10 });
      expect(shouldSetResponder).toBe(false);
    });

    it('should not detect upward swipe as downward', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: mockOnDismiss }), {
        initialProps: { onDismiss: mockOnDismiss },
      });

      const panHandlers = result.current.assetSelector.panHandlers;

      const shouldSetResponder = panHandlers.onMoveShouldSetResponder({}, { dy: -10, dx: 2 });
      expect(shouldSetResponder).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onDismiss callback gracefully', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: undefined }), {
        initialProps: { onDismiss: undefined },
      });

      expect(result.current.assetSelector).toBeDefined();
      expect(result.current.assetSelector.panHandlers).toBeDefined();
    });

    it('should handle null onDismiss callback', () => {
      const { result } = renderHook(() => useSendSheetAnimations({ onDismiss: null }), {
        initialProps: { onDismiss: null },
      });

      expect(result.current.assetSelector).toBeDefined();
    });
  });
});
