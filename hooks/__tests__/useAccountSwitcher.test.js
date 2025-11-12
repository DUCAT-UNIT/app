/**
 * Tests for useAccountSwitcher Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useAccountSwitcher } from '../useAccountSwitcher';
import { ERRORS, DIALOGS } from '../../utils/messages';

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

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useAccountSwitcher', () => {
  let mockSwitchAccountContext;

  beforeEach(() => {
    mockSwitchAccountContext = jest.fn().mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    expect(result.current.showAccountPicker).toBe(false);
    expect(result.current.newAccountIndex).toBe('');
    expect(result.current.switchingAccount).toBe(false);
  });

  it('should switch account successfully', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      await result.current.switchAccount(2); // Switch to Account 2
    });

    // Should call context with correct index (Account 2 = index 1)
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(1);
    expect(result.current.showAccountPicker).toBe(false);
    expect(result.current.newAccountIndex).toBe('');
    expect(result.current.switchingAccount).toBe(false);
  });

  it('should convert account number to index correctly', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      await result.current.switchAccount(1); // Account 1 = index 0
    });
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(0);

    await act(async () => {
      await result.current.switchAccount(5); // Account 5 = index 4
    });
    expect(mockSwitchAccountContext).toHaveBeenCalledWith(4);
  });

  it('should set switchingAccount to true during operation', async () => {
    let resolveSwitch;
    mockSwitchAccountContext = jest.fn(
      () => new Promise((resolve) => (resolveSwitch = resolve))
    );

    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Start switching
    act(() => {
      result.current.switchAccount(2);
    });

    // Should be switching
    expect(result.current.switchingAccount).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolveSwitch();
    });

    // Should no longer be switching
    expect(result.current.switchingAccount).toBe(false);
  });

  it('should show alert on switch error', async () => {
    const mockError = new Error('Switch failed');
    mockSwitchAccountContext = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    await act(async () => {
      await result.current.switchAccount(2);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      DIALOGS.ERROR_TITLE,
      ERRORS.ACCOUNT_SWITCH_FAILED
    );
    expect(result.current.switchingAccount).toBe(false);
  });

  it('should handle setShowAccountPicker', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    act(() => {
      result.current.setShowAccountPicker(true);
    });

    expect(result.current.showAccountPicker).toBe(true);

    act(() => {
      result.current.setShowAccountPicker(false);
    });

    expect(result.current.showAccountPicker).toBe(false);
  });

  it('should handle setNewAccountIndex', () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    act(() => {
      result.current.setNewAccountIndex('3');
    });

    expect(result.current.newAccountIndex).toBe('3');

    act(() => {
      result.current.setNewAccountIndex('');
    });

    expect(result.current.newAccountIndex).toBe('');
  });

  it('should reset modal state after successful switch', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Set up modal state
    act(() => {
      result.current.setShowAccountPicker(true);
      result.current.setNewAccountIndex('5');
    });

    expect(result.current.showAccountPicker).toBe(true);
    expect(result.current.newAccountIndex).toBe('5');

    // Switch account
    await act(async () => {
      await result.current.switchAccount(5);
    });

    // Modal state should be reset
    expect(result.current.showAccountPicker).toBe(false);
    expect(result.current.newAccountIndex).toBe('');
  });

  it('should not reset modal state after failed switch', async () => {
    mockSwitchAccountContext = jest.fn().mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Set up modal state
    act(() => {
      result.current.setShowAccountPicker(true);
      result.current.setNewAccountIndex('5');
    });

    // Switch account (will fail)
    await act(async () => {
      await result.current.switchAccount(5);
    });

    // Modal state remains (user might want to retry)
    expect(result.current.showAccountPicker).toBe(true);
    expect(result.current.newAccountIndex).toBe('5');
  });

  it('should handle rapid account switches', async () => {
    const { result } = renderHook(() =>
      useAccountSwitcher({ switchAccountContext: mockSwitchAccountContext })
    );

    // Switch to multiple accounts rapidly
    await act(async () => {
      await result.current.switchAccount(2);
    });

    await act(async () => {
      await result.current.switchAccount(3);
    });

    await act(async () => {
      await result.current.switchAccount(1);
    });

    // Should have called with correct indices
    expect(mockSwitchAccountContext).toHaveBeenCalledTimes(3);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(1, 1);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(2, 2);
    expect(mockSwitchAccountContext).toHaveBeenNthCalledWith(3, 0);
  });
});
