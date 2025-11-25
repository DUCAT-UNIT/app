/**
 * Tests for useFuseEcash hook
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

// Mock cashu wallet service
const mockRequestMelt = jest.fn();
const mockCompleteMeltWithoutCleanup = jest.fn();
const mockCleanupMeltProofs = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMelt: (...args) => mockRequestMelt(...args),
  completeMeltWithoutCleanup: (...args) => mockCompleteMeltWithoutCleanup(...args),
  cleanupMeltProofs: (...args) => mockCleanupMeltProofs(...args),
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

  // Note: Fuse button onPress callback tests that involve dynamic imports
  // are tested through integration/e2e tests since Jest doesn't support
  // dynamic imports without experimental VM modules. The basic hook structure
  // and Alert callback behavior is covered by the tests above.
});
