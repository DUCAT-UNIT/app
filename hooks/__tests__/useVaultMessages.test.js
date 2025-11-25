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

    // Should handle message without throwing
    await act(async () => {
      await result.current.handleMessage(event);
    });

    // Test passes if no error is thrown
    expect(true).toBe(true);
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

    // Should handle invalid JSON without throwing
    await act(async () => {
      await result.current.handleMessage(event);
    });

    // Test passes if no error is thrown
    expect(true).toBe(true);
  });

  it('should handle different console log levels', async () => {
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault
      )
    );

    // Test error level - should handle without throwing
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

    // Test warn level - should handle without throwing
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

    // Test passes if no error is thrown
    expect(true).toBe(true);
  });

  it('should handle CREDENTIALS_RECEIVED message', async () => {
    const mockHandleCredentialConfirmation = jest.fn();
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault,
        null, // loadingTimeoutRef
        mockHandleCredentialConfirmation
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'CREDENTIALS_RECEIVED',
          payload: {
            vaultPubkey: 'vault_pubkey_123',
          },
        }),
      },
    };

    await act(async () => {
      await result.current.handleMessage(event);
    });

    expect(mockHandleCredentialConfirmation).toHaveBeenCalledWith('vault_pubkey_123');
  });

  it('should handle CREDENTIALS_RECEIVED without handleCredentialConfirmation', async () => {
    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault,
        null, // loadingTimeoutRef
        null // no handleCredentialConfirmation
      )
    );

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: 'CREDENTIALS_RECEIVED',
          payload: {
            vaultPubkey: 'vault_pubkey_123',
          },
        }),
      },
    };

    // Should not throw error
    await act(async () => {
      await result.current.handleMessage(event);
    });
  });

  it('should clear loadingTimeout when VAULT_LOADED received', async () => {
    jest.useFakeTimers();
    const mockLoadingTimeoutRef = {
      current: setTimeout(() => {}, 5000), // Active timeout
    };

    const { result } = renderHook(() =>
      useVaultMessages(
        mockWebViewRef,
        mockShowSnackbar,
        mockInjectWalletCredentials,
        mockSetIsLoading,
        mockSetPreparingVault,
        mockLoadingTimeoutRef
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

    expect(mockLoadingTimeoutRef.current).toBeNull();
    expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    expect(mockSetPreparingVault).toHaveBeenCalledWith(false);

    // Should inject credentials after delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockInjectWalletCredentials).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
