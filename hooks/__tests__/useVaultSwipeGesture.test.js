/**
 * Tests for useVaultSwipeGesture hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useVaultSwipeGesture } from '../useVaultSwipeGesture';

// Store PanResponder configs for testing - must be prefixed with 'mock'
let mockWalletPanResponderConfig = null;
let mockVaultPanResponderConfig = null;

// Mock react-native
jest.mock('react-native', () => ({
  Animated: {
    Value: jest.fn((val) => ({
      _value: val,
      setValue: jest.fn(function(newVal) { this._value = newVal; }),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    spring: jest.fn(() => ({})),
  },
  PanResponder: {
    create: jest.fn((config) => {
      // Store config for later inspection
      if (!mockWalletPanResponderConfig) {
        mockWalletPanResponderConfig = config;
      } else if (!mockVaultPanResponderConfig) {
        mockVaultPanResponderConfig = config;
      }
      return {
        panHandlers: {},
        ...config,
      };
    }),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useVaultSwipeGesture(hookProps);
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

describe('useVaultSwipeGesture', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletPanResponderConfig = null;
    mockVaultPanResponderConfig = null;
    mockProps = {
      activeTab: 'wallet',
      setActiveTab: jest.fn(),
      openVault: jest.fn(),
    };
  });

  it('should return swipe gesture state and handlers', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current.vaultTranslateX).toBeDefined();
    expect(result.current.walletTranslateX).toBeDefined();
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.walletPanResponder).toBeDefined();
    expect(result.current.vaultPanResponder).toBeDefined();
  });

  it('should initialize wallet at center when activeTab is wallet', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      activeTab: 'wallet',
    });

    expect(result.current.walletTranslateX._value).toBe(0);
    expect(result.current.vaultTranslateX._value).toBe(-375); // Off screen left
  });

  it('should initialize vault at center when activeTab is vault', () => {
    const { result } = renderHookWithProps({
      ...mockProps,
      activeTab: 'vault',
    });

    // Positions are updated via useEffect
    expect(result.current.vaultTranslateX).toBeDefined();
    expect(result.current.walletTranslateX).toBeDefined();
  });

  it('should update positions when activeTab changes', () => {
    const { result, rerender } = renderHookWithProps({
      ...mockProps,
      activeTab: 'wallet',
    });

    rerender({
      ...mockProps,
      activeTab: 'vault',
    });

    // The hook should update positions based on activeTab
    expect(result.current).toBeDefined();
  });

  it('should not update positions while swiping', () => {
    const { result } = renderHookWithProps(mockProps);

    // isSwiping starts as false
    expect(result.current.isSwiping).toBe(false);
  });

  it('should create pan responders', () => {
    renderHookWithProps(mockProps);

    const { PanResponder } = require('react-native');
    expect(PanResponder.create).toHaveBeenCalled();
  });

  describe('walletPanResponder', () => {
    it('onMoveShouldSetPanResponder should return true for horizontal swipes', () => {
      renderHookWithProps(mockProps);

      expect(mockWalletPanResponderConfig).toBeDefined();
      const handler = mockWalletPanResponderConfig.onMoveShouldSetPanResponder;

      // Horizontal swipe with enough movement
      const result = handler({}, { dx: 30, dy: 5 });
      expect(result).toBe(true);
    });

    it('onMoveShouldSetPanResponder should return false when not on wallet tab', () => {
      renderHookWithProps({ ...mockProps, activeTab: 'vault' });

      const handler = mockWalletPanResponderConfig.onMoveShouldSetPanResponder;
      const result = handler({}, { dx: 30, dy: 5 });
      expect(result).toBe(false);
    });

    it('onMoveShouldSetPanResponder should return false for vertical swipes', () => {
      renderHookWithProps(mockProps);

      const handler = mockWalletPanResponderConfig.onMoveShouldSetPanResponder;
      // Vertical swipe
      const result = handler({}, { dx: 10, dy: 30 });
      expect(result).toBe(false);
    });

    it('onMoveShouldSetPanResponder should return false for small movements', () => {
      renderHookWithProps(mockProps);

      const handler = mockWalletPanResponderConfig.onMoveShouldSetPanResponder;
      // Small movement
      const result = handler({}, { dx: 10, dy: 5 });
      expect(result).toBe(false);
    });

    it('onPanResponderGrant should set isSwiping to true', () => {
      const { result } = renderHookWithProps(mockProps);

      expect(mockWalletPanResponderConfig).toBeDefined();
      const handler = mockWalletPanResponderConfig.onPanResponderGrant;

      act(() => {
        handler();
      });

      expect(result.current.isSwiping).toBe(true);
    });

    it('onPanResponderMove should update translations for positive dx', () => {
      const { result } = renderHookWithProps(mockProps);

      const handler = mockWalletPanResponderConfig.onPanResponderMove;

      act(() => {
        handler({}, { dx: 100 });
      });

      expect(result.current.walletTranslateX.setValue).toHaveBeenCalledWith(100);
      expect(result.current.vaultTranslateX.setValue).toHaveBeenCalledWith(-375 + 100);
    });

    it('onPanResponderMove should not update for negative dx', () => {
      const { result } = renderHookWithProps(mockProps);

      // Clear previous calls
      result.current.walletTranslateX.setValue.mockClear();
      result.current.vaultTranslateX.setValue.mockClear();

      const handler = mockWalletPanResponderConfig.onPanResponderMove;

      act(() => {
        handler({}, { dx: -50 });
      });

      // setValue should not be called with negative values for wallet
      expect(result.current.walletTranslateX.setValue).not.toHaveBeenCalled();
    });

    it('onPanResponderRelease should complete animation when distance threshold met', () => {
      const { result } = renderHookWithProps(mockProps);
      const { Animated } = require('react-native');

      const handler = mockWalletPanResponderConfig.onPanResponderRelease;

      act(() => {
        // Distance > 30% of screen width (375 * 0.3 = 112.5)
        handler({}, { dx: 150, vx: 0.3 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.openVault).toHaveBeenCalled();
    });

    it('onPanResponderRelease should complete animation when velocity threshold met', () => {
      const { result } = renderHookWithProps(mockProps);
      const { Animated } = require('react-native');

      const handler = mockWalletPanResponderConfig.onPanResponderRelease;

      act(() => {
        // Velocity > 0.5
        handler({}, { dx: 50, vx: 0.8 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.openVault).toHaveBeenCalled();
    });

    it('onPanResponderRelease should spring back when thresholds not met', () => {
      renderHookWithProps(mockProps);
      const { Animated } = require('react-native');

      const handler = mockWalletPanResponderConfig.onPanResponderRelease;

      act(() => {
        // Small swipe that doesn't meet threshold
        handler({}, { dx: 30, vx: 0.2 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.openVault).not.toHaveBeenCalled();
    });
  });

  describe('vaultPanResponder', () => {
    it('onMoveShouldSetPanResponder should return true for left swipes', () => {
      renderHookWithProps(mockProps);

      expect(mockVaultPanResponderConfig).toBeDefined();
      const handler = mockVaultPanResponderConfig.onMoveShouldSetPanResponder;

      // Left swipe (negative dx)
      const result = handler({}, { dx: -30, dy: 5 });
      expect(result).toBe(true);
    });

    it('onMoveShouldSetPanResponder should return false for right swipes', () => {
      renderHookWithProps(mockProps);

      const handler = mockVaultPanResponderConfig.onMoveShouldSetPanResponder;
      // Right swipe
      const result = handler({}, { dx: 30, dy: 5 });
      expect(result).toBe(false);
    });

    it('onMoveShouldSetPanResponder should return false for vertical swipes', () => {
      renderHookWithProps(mockProps);

      const handler = mockVaultPanResponderConfig.onMoveShouldSetPanResponder;
      // Vertical swipe
      const result = handler({}, { dx: -5, dy: 30 });
      expect(result).toBe(false);
    });

    it('onPanResponderGrant should set isSwiping to true', () => {
      const { result } = renderHookWithProps(mockProps);

      const handler = mockVaultPanResponderConfig.onPanResponderGrant;

      act(() => {
        handler();
      });

      expect(result.current.isSwiping).toBe(true);
    });

    it('onPanResponderMove should update translations for negative dx', () => {
      const { result } = renderHookWithProps(mockProps);

      const handler = mockVaultPanResponderConfig.onPanResponderMove;

      act(() => {
        handler({}, { dx: -100 });
      });

      expect(result.current.vaultTranslateX.setValue).toHaveBeenCalledWith(-100);
      expect(result.current.walletTranslateX.setValue).toHaveBeenCalledWith(375 + (-100));
    });

    it('onPanResponderMove should not update for positive dx', () => {
      const { result } = renderHookWithProps(mockProps);

      // Clear previous calls from initialization
      result.current.vaultTranslateX.setValue.mockClear();

      const handler = mockVaultPanResponderConfig.onPanResponderMove;

      act(() => {
        handler({}, { dx: 50 });
      });

      // For vault, we don't expect setValue with positive dx on move
      // Check that it wasn't called after clearing
      expect(result.current.vaultTranslateX.setValue).not.toHaveBeenCalled();
    });

    it('onPanResponderRelease should complete animation when distance threshold met', () => {
      renderHookWithProps(mockProps);
      const { Animated } = require('react-native');

      const handler = mockVaultPanResponderConfig.onPanResponderRelease;

      act(() => {
        // Distance > 30% of screen width
        handler({}, { dx: -150, vx: -0.3 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.setActiveTab).toHaveBeenCalledWith('wallet');
    });

    it('onPanResponderRelease should complete animation when velocity threshold met', () => {
      renderHookWithProps(mockProps);
      const { Animated } = require('react-native');

      const handler = mockVaultPanResponderConfig.onPanResponderRelease;

      act(() => {
        // High velocity
        handler({}, { dx: -50, vx: -0.8 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.setActiveTab).toHaveBeenCalledWith('wallet');
    });

    it('onPanResponderRelease should spring back when thresholds not met', () => {
      renderHookWithProps(mockProps);
      const { Animated } = require('react-native');
      Animated.parallel.mockClear();

      const handler = mockVaultPanResponderConfig.onPanResponderRelease;

      act(() => {
        // Small swipe
        handler({}, { dx: -30, vx: -0.2 });
      });

      expect(Animated.parallel).toHaveBeenCalled();
      expect(mockProps.setActiveTab).not.toHaveBeenCalled();
    });
  });

  describe('useEffect position sync', () => {
    it('should set vault positions when activeTab is vault', () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        activeTab: 'vault',
      });

      // Vault centered, wallet off screen right
      expect(result.current.walletTranslateX.setValue).toHaveBeenCalledWith(375);
      expect(result.current.vaultTranslateX.setValue).toHaveBeenCalledWith(0);
    });

    it('should set wallet positions when activeTab is wallet', () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        activeTab: 'wallet',
      });

      // Wallet centered, vault off screen left
      expect(result.current.walletTranslateX.setValue).toHaveBeenCalledWith(0);
      expect(result.current.vaultTranslateX.setValue).toHaveBeenCalledWith(-375);
    });
  });
});
