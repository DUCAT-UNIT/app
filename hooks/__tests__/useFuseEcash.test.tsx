// @ts-nocheck
/**
 * Tests for useFuseEcash hook
 *
 * Note: This hook uses dynamic imports which are difficult to mock in Jest.
 * These tests focus on the basic state management and the initial alert flow.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useFuseEcash } from '../useFuseEcash';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useFuseEcash(hookProps);
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

describe('useFuseEcash', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      cashuBalance: 100.50,
      taprootAddress: 'tb1ptest12345',
      transactionHistory: [],
      fetchTransactionHistory: jest.fn().mockResolvedValue(),
    };
  });

  it('should return handleFusePress function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleFusePress).toBe('function');
  });

  it('should show alert when cashuBalance is 0', async () => {
    mockProps.cashuBalance = 0;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No E-cash', "You don't have any e-cash to fuse.");
  });

  it('should show confirmation alert with balance', async () => {
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Fuse E-cash to UNIT?',
      'Convert all 100.50 eUNIT to on-chain UNIT?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Fuse' }),
      ])
    );
  });

  it('should format balance with two decimal places', async () => {
    mockProps.cashuBalance = 50.123456;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Fuse E-cash to UNIT?',
      'Convert all 50.12 eUNIT to on-chain UNIT?',
      expect.any(Array)
    );
  });

  it('should update when props change', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current.handleFusePress;

    rerender({ ...mockProps, cashuBalance: 200 });

    // Callback should be recreated due to dependency change
    expect(result.current.handleFusePress).not.toBe(firstCallback);
  });

  it('should depend on cashuBalance', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current.handleFusePress;

    // Same props - callback should be same
    rerender(mockProps);
    expect(result.current.handleFusePress).toBe(firstCallback);

    // Different balance - callback should change
    rerender({ ...mockProps, cashuBalance: 999 });
    expect(result.current.handleFusePress).not.toBe(firstCallback);
  });

  it('should show alert with integer balance', async () => {
    mockProps.cashuBalance = 100;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Fuse E-cash to UNIT?',
      'Convert all 100.00 eUNIT to on-chain UNIT?',
      expect.any(Array)
    );
  });

  it('should show alert with small balance', async () => {
    mockProps.cashuBalance = 0.01;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Fuse E-cash to UNIT?',
      'Convert all 0.01 eUNIT to on-chain UNIT?',
      expect.any(Array)
    );
  });

  it('should return object with handleFusePress property', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('handleFusePress');
    expect(Object.keys(result.current)).toHaveLength(1);
  });

  it('should have cancel and fuse buttons in alert', async () => {
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleFusePress();
    });

    const alertCall = Alert.alert.mock.calls[0];
    const buttons = alertCall[2];

    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Fuse');
    expect(typeof buttons[1].onPress).toBe('function');
  });
});
