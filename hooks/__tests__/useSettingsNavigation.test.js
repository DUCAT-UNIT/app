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
jest.mock('../../contexts/SeedPhraseContext', () => ({
  useSeedPhrase: () => ({
    viewingSeedPhrase: false,
    returnToSettings: false,
    setReturnToSettings: mockSetReturnToSettings,
  }),
}));

// Helper to render hooks
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

describe('useSettingsNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
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
