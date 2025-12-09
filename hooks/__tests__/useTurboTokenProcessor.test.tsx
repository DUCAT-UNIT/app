// @ts-nocheck
/**
 * Tests for useTurboTokenProcessor hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock dependencies BEFORE imports
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/turbo/turboTokenStorage', () => ({
  markTokenAsProcessed: jest.fn().mockResolvedValue(undefined),
  turboGlobal: { pendingTurboSnackbars: [] },
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mockhash123'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// Create a mock store state
let mockStoreState = {
  pendingToken: null,
  consumePendingToken: jest.fn(() => null),
  setPendingToken: jest.fn(),
  clearPendingToken: jest.fn(),
  registerTokenCheckCallback: jest.fn(),
  unregisterTokenCheckCallback: jest.fn(),
  triggerWalletReload: jest.fn(),
};

jest.mock('../../stores/tokenProcessingStore', () => ({
  useTokenProcessingStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  }),
  selectPendingToken: (state) => state.pendingToken,
}));

import { useTurboTokenProcessor } from '../useTurboTokenProcessor';
import { turboGlobal } from '../../services/turbo/turboTokenStorage';

describe('useTurboTokenProcessor', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mock store state
    mockStoreState = {
      pendingToken: null,
      consumePendingToken: jest.fn(() => null),
      setPendingToken: jest.fn(),
      clearPendingToken: jest.fn(),
      registerTokenCheckCallback: jest.fn(),
      unregisterTokenCheckCallback: jest.fn(),
      triggerWalletReload: jest.fn(),
    };

    // Reset turboGlobal
    turboGlobal.pendingTurboSnackbars = [];

    mockProps = {
      isAuthenticated: true,
      shouldShowPinOverlay: false,
      receive: jest.fn().mockResolvedValue({ amount: 100 }),
      fetchBalance: jest.fn().mockResolvedValue(undefined),
      refreshCashu: jest.fn().mockResolvedValue(undefined),
      wallet: { taprootAddress: 'tb1p...' },
      showSnackbar: jest.fn(),
      dismissSnackbar: jest.fn(),
      switchAccount: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return isVerifyingToken state', () => {
    const { result } = renderHook(() => useTurboTokenProcessor(mockProps));
    expect(result.current.isVerifyingToken).toBe(false);
  });

  it('should register token check callback when authenticated', () => {
    renderHook(() => useTurboTokenProcessor(mockProps));
    expect(mockStoreState.registerTokenCheckCallback).toHaveBeenCalled();
  });

  it('should not register callback when not authenticated', () => {
    renderHook(() => useTurboTokenProcessor({
      ...mockProps,
      isAuthenticated: false,
    }));
    expect(mockStoreState.registerTokenCheckCallback).not.toHaveBeenCalled();
  });

  it('should not register callback when pin overlay is shown', () => {
    renderHook(() => useTurboTokenProcessor({
      ...mockProps,
      shouldShowPinOverlay: true,
    }));
    expect(mockStoreState.registerTokenCheckCallback).not.toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useTurboTokenProcessor(mockProps));

    act(() => {
      unmount();
    });

    expect(mockStoreState.unregisterTokenCheckCallback).toHaveBeenCalled();
  });

  it('should consume pending token and call receive', async () => {
    // Setup: consumePendingToken returns a token on first call
    let tokenConsumed = false;
    mockStoreState.consumePendingToken = jest.fn(() => {
      if (!tokenConsumed) {
        tokenConsumed = true;
        return 'cashuAtoken123';
      }
      return null;
    });

    renderHook(() => useTurboTokenProcessor(mockProps));

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(mockProps.receive).toHaveBeenCalledWith('cashuAtoken123');
  });

  describe('processToken success', () => {
    it('should call fetchBalance and refreshCashu after success', async () => {
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockProps.fetchBalance).toHaveBeenCalled();
        expect(mockProps.refreshCashu).toHaveBeenCalled();
      });
    });

    it('should show success snackbar after processing', async () => {
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockProps.showSnackbar).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            action: 'claim',
          })
        );
      });
    });
  });

  describe('processToken error handling', () => {
    it('should handle generic error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Unknown error'));
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(turboGlobal.pendingTurboSnackbars).toEqual([
          expect.objectContaining({
            type: 'error',
            message: 'Unknown error',
          }),
        ]);
      });
    });

    it('should handle "already spent" error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Token has already spent proofs'));
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(turboGlobal.pendingTurboSnackbars[0].message).toBe('Token already claimed');
      });
    });

    it('should handle P2PK verification error', async () => {
      mockProps.receive.mockRejectedValue(new Error('P2PK verification failed: invalid'));
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(turboGlobal.pendingTurboSnackbars[0].message).toContain('P2PK verification failed');
      });
    });

    it('should handle account switch error message', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(turboGlobal.pendingTurboSnackbars[0].message).toContain('account 2');
      });
    });

    it('should handle error without message', async () => {
      mockProps.receive.mockRejectedValue(new Error());
      let tokenConsumed = false;
      mockStoreState.consumePendingToken = jest.fn(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return 'cashuAtoken123';
        }
        return null;
      });

      renderHook(() => useTurboTokenProcessor(mockProps));

      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(turboGlobal.pendingTurboSnackbars[0].message).toBe('Failed to receive token');
      });
    });
  });
});
