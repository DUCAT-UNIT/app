/**
 * Tests for useClaimNotifications hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useClaimNotifications } from '../useClaimNotifications';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSetParams = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    setParams: mockSetParams,
    navigate: mockNavigate,
  }),
}));

// Mock tokenProcessingStore
const mockTriggerWalletReload = jest.fn();
jest.mock('../../stores/tokenProcessingStore', () => ({
  useTokenProcessingStore: (selector: (store: Record<string, unknown>) => unknown) => {
    const store = {
      triggerWalletReload: mockTriggerWalletReload,
    };
    return selector ? selector(store) : store;
  },
}));

// Helper to render hooks with props
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderHookWithProps<T>(hook: (props: any) => T, props: unknown) {
  const result: { current: T | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: unknown }) {
    result.current = hook(hookProps);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component!.unmount,
    component,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useClaimNotifications', () => {
  let showSnackbar: jest.Mock;
  let dismissSnackbar: jest.Mock;
  let switchAccount: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    showSnackbar = jest.fn();
    dismissSnackbar = jest.fn();
    switchAccount = jest.fn().mockResolvedValue(undefined);
    mockTriggerWalletReload.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show success snackbar on claimSuccess', () => {
    const route = { params: { claimSuccess: true } };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    expect(showSnackbar).toHaveBeenCalledWith({
      message: 'Token claimed successfully',
      type: 'success',
      action: 'claim',
    });
    expect(mockSetParams).toHaveBeenCalledWith({ claimSuccess: undefined });
  });

  it('should show error snackbar on claimError', () => {
    const route = { params: { claimError: 'Token already spent' } };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'claim',
        message: 'Token already spent',
      })
    );
    expect(mockSetParams).toHaveBeenCalledWith({
      claimError: undefined,
      claimToken: undefined,
    });
  });

  it('should not show snackbar when no claim params', () => {
    const route = { params: {} };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('should not show snackbar when route has no params', () => {
    const route = {};

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('should show error snackbar with switch action for wrong account', () => {
    const route = {
      params: {
        claimError: 'This proof belongs to account 2',
        claimToken: 'cashuA...',
      },
    };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'claim',
        message: 'This proof belongs to account 2',
        persistent: true,
        actionLabel: 'Switch & Claim',
      })
    );
  });

  it('should handle switch & claim action', async () => {
    const route = {
      params: {
        claimError: 'This proof belongs to account 2',
        claimToken: 'cashuA...',
      },
    };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    // Get the onAction callback from the snackbar call
    const snackbarCall = showSnackbar.mock.calls[0][0];
    expect(snackbarCall.onAction).toBeDefined();

    // Call the onAction
    await act(async () => {
      await snackbarCall.onAction();
    });

    expect(dismissSnackbar).toHaveBeenCalled();
    expect(switchAccount).toHaveBeenCalledWith(1); // account 2 -> index 1
    expect(mockTriggerWalletReload).toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalledWith({
      claimError: undefined,
      claimToken: undefined,
    });

    // Advance timer for navigation delay
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(mockNavigate).toHaveBeenCalledWith('TurboClaiming', {
      tokenString: 'cashuA...',
    });
  });

  it('should show success snackbar when switching without token', async () => {
    const route = {
      params: {
        claimError: 'This proof belongs to account 2',
        claimToken: null,
      },
    };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];

    await act(async () => {
      await snackbarCall.onAction();
    });

    expect(switchAccount).toHaveBeenCalledWith(1);
    expect(showSnackbar).toHaveBeenLastCalledWith({
      type: 'success',
      action: 'switch',
      message: 'Switched to Account 2',
    });
  });

  it('should show error when switchAccount is not available', async () => {
    const route = {
      params: {
        claimError: 'This proof belongs to account 2',
        claimToken: 'cashuA...',
      },
    };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount: null,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];

    await act(async () => {
      await snackbarCall.onAction();
    });

    expect(showSnackbar).toHaveBeenLastCalledWith({
      type: 'error',
      action: 'switch',
      message: 'Account switching not available',
    });
  });

  it('should show error when switch fails', async () => {
    switchAccount.mockRejectedValue(new Error('Switch failed'));

    const route = {
      params: {
        claimError: 'This proof belongs to account 2',
        claimToken: 'cashuA...',
      },
    };

    renderHookWithProps(useClaimNotifications, {
      route,
      showSnackbar,
      dismissSnackbar,
      switchAccount,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];

    await act(async () => {
      await snackbarCall.onAction();
    });

    expect(showSnackbar).toHaveBeenLastCalledWith({
      type: 'error',
      action: 'switch',
      message: 'Failed to switch account',
    });
  });
});
