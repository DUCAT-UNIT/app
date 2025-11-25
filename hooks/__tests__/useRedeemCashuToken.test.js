/**
 * Tests for useRedeemCashuToken hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useRedeemCashuToken } from '../useRedeemCashuToken';

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
    prompt: jest.fn(),
  },
}));

// Mock cashu services - using jest.fn() that will be configured in beforeEach
const mockDecodeToken = jest.fn();
const mockIsP2PKSecret = jest.fn();
const mockGetP2PKRecipient = jest.fn();
const mockFindAccountForP2PKToken = jest.fn();
const mockGetCurrentAccount = jest.fn();
const mockReceiveP2PKToken = jest.fn();
const mockReceiveToken = jest.fn();

jest.mock('../../services/cashu/crypto', () => ({
  decodeToken: (...args) => mockDecodeToken(...args),
}));

jest.mock('../../services/cashu/p2pk', () => ({
  isP2PKSecret: (...args) => mockIsP2PKSecret(...args),
  getP2PKRecipient: (...args) => mockGetP2PKRecipient(...args),
  findAccountForP2PKToken: (...args) => mockFindAccountForP2PKToken(...args),
}));

jest.mock('../../services/secureStorageService', () => ({
  getCurrentAccount: (...args) => mockGetCurrentAccount(...args),
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  receiveP2PKToken: (...args) => mockReceiveP2PKToken(...args),
  receiveToken: (...args) => mockReceiveToken(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useRedeemCashuToken(hookProps);
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

describe('useRedeemCashuToken', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      fetchTransactionHistory: jest.fn().mockResolvedValue(),
    };
    mockDecodeToken.mockReturnValue({
      proofs: [{ secret: 'test-secret' }],
    });
    mockIsP2PKSecret.mockReturnValue(false);
    mockReceiveToken.mockResolvedValue();
  });

  it('should return handleRedeemToken function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleRedeemToken).toBe('function');
  });

  it('should show prompt when handleRedeemToken is called', () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.handleRedeemToken();
    });

    expect(Alert.prompt).toHaveBeenCalledWith(
      'Redeem Cashu Token',
      'Paste your Cashu token to redeem:',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Redeem' }),
      ]),
      'plain-text'
    );
  });

  it('should handle empty token in prompt callback', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.handleRedeemToken();
    });

    // Get the onPress handler from the Redeem button
    const redeemButton = Alert.prompt.mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress('');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should handle whitespace-only token', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.handleRedeemToken();
    });

    const redeemButton = Alert.prompt.mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress('   ');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should handle null token', async () => {
    const { result } = renderHookWithProps(mockProps);

    act(() => {
      result.current.handleRedeemToken();
    });

    const redeemButton = Alert.prompt.mock.calls[0][2][1];

    await act(async () => {
      await redeemButton.onPress(null);
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid token');
  });

  it('should memoize handleRedeemToken based on fetchTransactionHistory', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current.handleRedeemToken;

    // Same props - callback should be same
    rerender(mockProps);
    expect(result.current.handleRedeemToken).toBe(firstCallback);

    // Different fetchTransactionHistory - callback should change
    rerender({ fetchTransactionHistory: jest.fn() });
    expect(result.current.handleRedeemToken).not.toBe(firstCallback);
  });

  // Note: Token redemption flows that involve dynamic imports are tested
  // through integration/e2e tests since Jest doesn't support dynamic imports
  // without experimental VM modules. The basic hook structure and callback
  // behavior is covered by the tests above.
});
