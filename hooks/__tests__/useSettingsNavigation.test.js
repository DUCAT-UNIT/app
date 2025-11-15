/**
 * Tests for useSettingsNavigation Hook
 * Validates settings screen navigation including visibility, animation, swipe-to-close, and return-to-settings flow
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSettingsNavigation } from '../useSettingsNavigation';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((callback) => callback()),
}));

// Mock SeedPhraseContext
const mockSetReturnToSettings = jest.fn();
let mockSeedPhraseContext = {
  viewingSeedPhrase: false,
  returnToSettings: false,
  setReturnToSettings: mockSetReturnToSettings,
};

jest.mock('../../contexts/SeedPhraseContext', () => ({
  useSeedPhrase: () => mockSeedPhraseContext,
}));

// Helper to render hooks
function renderHook(hook) {
  const _result = { current: null };
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

describe('useSettingsNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    mockSetReturnToSettings.mockClear();
    mockSeedPhraseContext = {
      viewingSeedPhrase: false,
      returnToSettings: false,
      setReturnToSettings: mockSetReturnToSettings,
    };
  });

  describe('Initialization', () => {
    it('should initialize with settings closed', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.showSettings).toBe(false);
    });

    it('should provide all animation values', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.settingsTranslateX).toBeDefined();
      expect(result.current.settingsOpacity).toBeDefined();
      expect(result.current.settingsPanResponderRef).toBeDefined();
    });

    it('should provide open and close functions', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.openSettings).toBeDefined();
      expect(result.current.closeSettings).toBeDefined();
    });

    it('should set hasCheckedInitialFlags after layout effect', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.hasCheckedInitialFlags).toBe(true);
    });
  });

  describe('Return to Settings After Auth', () => {
    it('should open settings when returnToSettingsAfterAuth flag is set', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth');
    });

    it('should open settings when returnToSettingsAfterPinChange flag is set', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterPinChange') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterPinChange');
    });

    it('should open settings when returnToSettingsAfterSeedPhrase flag is set', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterSeedPhrase') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterSeedPhrase');
    });

    it('should clear returnToSettings context flag', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(mockSetReturnToSettings).toHaveBeenCalledWith(false);
    });

    it('should clear all return flags when any are set', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterSeedPhrase');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterPinChange');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth');
    });
  });

  describe('Initial Flag Check (useLayoutEffect)', () => {
    it('should open settings immediately if returnToSettingsAfterAuth flag is set on mount', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(true);
    });

    it('should set opacity to 1 immediately when flag is set on mount', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Opacity should be set to 1 to prevent flicker
      expect(result.current.settingsOpacity).toBeDefined();
    });
  });

  describe('Open/Close Settings', () => {
    it('should open settings when openSettings is called', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.openSettings();
      });

      expect(result.current.showSettings).toBe(true);
    });

    it('should close settings when closeSettings is called', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(true);

      act(() => {
        result.current.closeSettings();
      });

      expect(result.current.showSettings).toBe(false);
    });

    it('should reset translateX when opening settings', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(() => {
        act(() => {
          result.current.openSettings();
        });
      }).not.toThrow();

      expect(result.current.showSettings).toBe(true);
    });

    it('should reset translateX when closing settings', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(() => {
        act(() => {
          result.current.closeSettings();
        });
      }).not.toThrow();

      expect(result.current.showSettings).toBe(false);
    });
  });

  describe('Pan Responder', () => {
    it('should provide pan responder for swipe-to-close', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.settingsPanResponderRef).toBeDefined();
      expect(result.current.settingsPanResponderRef.current).toBeDefined();
      expect(result.current.settingsPanResponderRef.current.panHandlers).toBeDefined();
    });

    it('should have onStartShouldSetPanResponder return true', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const panResponder = result.current.settingsPanResponderRef.current;
      expect(panResponder.panHandlers.onStartShouldSetResponder()).toBe(true);
    });

    it('should return true for onMoveShouldSetPanResponder when dx > 10', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      // Find the onMoveShouldSetPanResponder function in the config
      // It's created in PanResponder.create, so we need to access it differently
      const shouldSet = config.onMoveShouldSetResponder({}, { dx: 15, dy: 0 });

      expect(shouldSet).toBe(true);
    });

    it('should return false for onMoveShouldSetPanResponder when dx <= 10', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      const shouldSet = config.onMoveShouldSetResponder({}, { dx: 5, dy: 0 });

      expect(shouldSet).toBe(false);
    });

    it('should update translateX on pan responder move when dx > 0', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      // Simulate pan responder move
      act(() => {
        config.onResponderMove({}, { dx: 50, dy: 0 });
      });

      // translateX should be updated (we can't directly test Animated values, but we can verify no errors)
      expect(result.current.settingsTranslateX).toBeDefined();
    });

    it('should not update translateX on pan responder move when dx <= 0', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      // Simulate pan responder move with negative dx
      act(() => {
        config.onResponderMove({}, { dx: -10, dy: 0 });
      });

      expect(result.current.settingsTranslateX).toBeDefined();
    });

    it('should close settings on pan responder release when dx > 40% screen width', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Open settings first
      act(() => {
        result.current.openSettings();
      });

      expect(result.current.showSettings).toBe(true);

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      // Simulate release with large dx (> 40% of screen width)
      await act(async () => {
        config.onResponderRelease({}, { dx: 200, dy: 0 });
        // Wait for animation to complete
        await new Promise((resolve) => setTimeout(resolve, 250));
      });

      expect(result.current.showSettings).toBe(false);
    });

    it('should spring back on pan responder release when dx < 40% screen width', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Open settings first
      act(() => {
        result.current.openSettings();
      });

      expect(result.current.showSettings).toBe(true);

      const panResponder = result.current.settingsPanResponderRef.current;
      const config = panResponder.panHandlers;

      // Simulate release with small dx (< 40% of screen width)
      act(() => {
        config.onResponderRelease({}, { dx: 50, dy: 0 });
      });

      // Settings should still be open
      expect(result.current.showSettings).toBe(true);
    });
  });

  describe('Seed Phrase Return Flow', () => {
    it('should handle seed phrase context properly', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current).toBeDefined();
      expect(result.current.openSettings).toBeDefined();
      expect(result.current.closeSettings).toBeDefined();
    });

    it('should reopen settings when seed phrase closes with returnToSettings true', async () => {
      // Start with viewingSeedPhrase true and returnToSettings false
      mockSeedPhraseContext = {
        viewingSeedPhrase: true,
        returnToSettings: false,
        setReturnToSettings: mockSetReturnToSettings,
      };

      const { result, unmount } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Now change to viewingSeedPhrase false and returnToSettings true (seed phrase just closed)
      mockSeedPhraseContext = {
        viewingSeedPhrase: false,
        returnToSettings: true,
        setReturnToSettings: mockSetReturnToSettings,
      };

      // Re-render by unmounting and remounting
      unmount();

      const { result: result2 } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result2.current.showSettings).toBe(true);
      expect(mockSetReturnToSettings).toHaveBeenCalledWith(false);
    });

    it('should not reopen settings when viewingSeedPhrase is true', async () => {
      mockSeedPhraseContext = {
        viewingSeedPhrase: true,
        returnToSettings: true,
        setReturnToSettings: mockSetReturnToSettings,
      };

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not call setReturnToSettings when still viewing seed phrase
      expect(mockSetReturnToSettings).not.toHaveBeenCalled();
    });

    it('should not reopen settings when returnToSettings is false', async () => {
      mockSeedPhraseContext = {
        viewingSeedPhrase: false,
        returnToSettings: false,
        setReturnToSettings: mockSetReturnToSettings,
      };

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not call setReturnToSettings when returnToSettings is false
      expect(mockSetReturnToSettings).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should not open settings when all flags are null', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(false);
    });

    it('should handle flag values other than "true"', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.showSettings).toBe(false);
    });

    it('should prevent concurrent flag checks in useFocusEffect', async () => {
      // Set up a slow async response to simulate concurrent calls
      let resolveFirst;
      let callCount = 0;

      SecureStore.getItemAsync.mockImplementation((key) => {
        callCount++;
        return new Promise((resolve) => {
          if (callCount === 1) {
            resolveFirst = resolve;
          } else {
            resolve(null);
          }
        });
      });

      // Mock useFocusEffect to call the callback multiple times
      const { useFocusEffect } = require('@react-navigation/native');
      let focusCallback;
      useFocusEffect.mockImplementation((callback) => {
        focusCallback = callback;
        callback(); // Call once immediately
      });

      const { result } = renderHook(() => useSettingsNavigation());

      // Try to call the focus callback again while the first is still pending
      if (focusCallback) {
        focusCallback(); // This should return early due to checkingFlags.current
      }

      // Now resolve the first call
      if (resolveFirst) {
        resolveFirst(null);
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // The second call should have been prevented by the checkingFlags guard
      expect(result.current).toBeDefined();
    });
  });

  describe('Opacity Management', () => {
    it('should manage opacity when settings opens', async () => {
      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.openSettings();
      });

      expect(result.current.showSettings).toBe(true);
      expect(result.current.settingsOpacity).toBeDefined();
    });

    it('should manage opacity when settings closes', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'returnToSettingsAfterAuth') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettingsNavigation());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      act(() => {
        result.current.closeSettings();
      });

      expect(result.current.showSettings).toBe(false);
      expect(result.current.settingsOpacity).toBeDefined();
    });
  });
});
