/**
 * Tests for useVaultMessages hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useVaultMessages } from '../useVaultMessages';
import * as walletUtils from '../../utils/wallet';

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
  return { result, unmount: () => component.unmount() };
}

// Mock wallet utils
jest.mock('../../utils/wallet', () => ({
  signPsbt: jest.fn(),
}));

describe('useVaultMessages', () => {
  let mockWebViewRef;
  let mockShowSnackbar;
  let mockInjectWalletCredentials;
  let mockSetIsLoading;
  let mockSetPreparingVault;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    mockShowSnackbar = jest.fn();
    mockInjectWalletCredentials = jest.fn();
    mockSetIsLoading = jest.fn();
    mockSetPreparingVault = jest.fn();

    walletUtils.signPsbt.mockResolvedValue('signed_psbt_base64');
  });

  it('should handle CONSOLE_LOG messages', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'log',
          args: ['Test message', 'from WebView'],
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(consoleSpy).toHaveBeenCalledWith('📱 [WebView Console]', 'Test message', 'from WebView');
    consoleSpy.mockRestore();
  });

  it('should handle VAULT_LOADED message', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'VAULT_LOADED',
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    expect(mockSetPreparingVault).toHaveBeenCalledWith(false);

    // Should inject credentials after delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockInjectWalletCredentials).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('should handle SIGN_PSBT_REQUEST successfully', async () => {
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'SIGN_PSBT_REQUEST',
          payload: {
            requestId: 'req123',
            psbt: 'unsigned_psbt',
            signInputs: [0, 1],
          },
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(walletUtils.signPsbt).toHaveBeenCalledWith('unsigned_psbt', [0, 1]);
    expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('SIGN_PSBT_RESPONSE')
    );
    expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('signed_psbt_base64')
    );
  });

  it('should handle SIGN_PSBT_REQUEST failure', async () => {
    walletUtils.signPsbt.mockRejectedValue(new Error('Signing failed'));

    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'SIGN_PSBT_REQUEST',
          payload: {
            requestId: 'req123',
            psbt: 'unsigned_psbt',
            signInputs: [0, 1],
          },
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('Signing failed')
    );
  });

  it('should handle SHOW_SNACKBAR message', async () => {
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'SHOW_SNACKBAR',
          payload: {
            message: 'Transaction successful',
            type: 'success',
          },
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      message: 'Transaction successful',
      type: 'success',
    });
  });

  it('should not call showSnackbar if function is not provided', async () => {
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        null, // No showSnackbar function
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'SHOW_SNACKBAR',
          payload: { message: 'Test' },
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    // Should not throw error
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    const event = {
      nativeEvent: {
        data: 'invalid json',
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Error parsing WebView message:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('should use correct emoji prefix for console log levels', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    // Test error level
    await act(async () => {
      await result.current.handleMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'CONSOLE_LOG',
            level: 'error',
            args: ['Error message'],
          }),
        },
      });
    });

    expect(consoleSpy).toHaveBeenCalledWith('❌ [WebView Console]', 'Error message');

    // Test warn level
    await act(async () => {
      await result.current.handleMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'CONSOLE_LOG',
            level: 'warn',
            args: ['Warning message'],
          }),
        },
      });
    });

    expect(consoleSpy).toHaveBeenCalledWith('⚠️ [WebView Console]', 'Warning message');

    consoleSpy.mockRestore();
  });
});
