/**
 * Tests for useKeyboard Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';
import { useKeyboard } from '../useKeyboard';

// Helper to render hooks with react-test-renderer
function renderHook(hook) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component.unmount(),
  };
}

// Mock Keyboard
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  addListener: jest.fn(),
}));

describe('useKeyboard', () => {
  let mockListeners = {};

  beforeEach(() => {
    mockListeners = {};
    Keyboard.addListener = jest.fn((event, callback) => {
      mockListeners[event] = callback;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with keyboard hidden', () => {
    const { result } = renderHook(() => useKeyboard());

    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardVisible).toBe(false);
  });

  it('should listen to correct events on iOS', () => {
    Platform.OS = 'ios';

    renderHook(() => useKeyboard());

    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));
  });

  it('should listen to correct events on Android', () => {
    Platform.OS = 'android';

    renderHook(() => useKeyboard());

    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));
  });

  it('should update keyboard height and visibility when keyboard shows', () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useKeyboard());

    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 350 },
      });
    });

    expect(result.current.keyboardHeight).toBe(350);
    expect(result.current.isKeyboardVisible).toBe(true);
  });

  it('should reset keyboard height and visibility when keyboard hides', () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useKeyboard());

    // Show keyboard first
    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 350 },
      });
    });

    expect(result.current.isKeyboardVisible).toBe(true);

    // Hide keyboard
    act(() => {
      mockListeners.keyboardWillHide();
    });

    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardVisible).toBe(false);
  });

  it('should handle keyboard show with different heights', () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useKeyboard());

    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 291 },
      });
    });

    expect(result.current.keyboardHeight).toBe(291);

    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 400 },
      });
    });

    expect(result.current.keyboardHeight).toBe(400);
  });

  it('should clean up listeners on unmount', () => {
    Platform.OS = 'ios';
    const { result, unmount } = renderHook(() => useKeyboard());

    // Hook should be initialized
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardVisible).toBe(false);

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should handle rapid keyboard show/hide events', () => {
    Platform.OS = 'ios';
    const { result } = renderHook(() => useKeyboard());

    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 350 },
      });
    });

    expect(result.current.isKeyboardVisible).toBe(true);

    act(() => {
      mockListeners.keyboardWillHide();
    });

    expect(result.current.isKeyboardVisible).toBe(false);

    act(() => {
      mockListeners.keyboardWillShow({
        endCoordinates: { height: 350 },
      });
    });

    expect(result.current.isKeyboardVisible).toBe(true);
  });
});
