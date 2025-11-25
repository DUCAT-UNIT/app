/**
 * Tests for useTurboTokenProcessor hook
 *
 * Note: This hook uses dynamic imports which are difficult to mock in Jest.
 * These tests focus on the basic state management and authentication flow.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTurboTokenProcessor } from '../useTurboTokenProcessor';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/turbo/turboTokenStorage', () => ({
  markTokenAsProcessed: jest.fn().mockResolvedValue(),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTurboTokenProcessor(hookProps);
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

describe('useTurboTokenProcessor', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete global.pendingCashuToken;
    delete global.triggerPendingTokenCheck;
    delete global.reloadWallet;
    delete global.pendingTurboSnackbars;
    mockProps = {
      isAuthenticated: true,
      shouldShowPinOverlay: false,
      receive: jest.fn().mockResolvedValue({ amount: 100 }),
      fetchBalance: jest.fn().mockResolvedValue(),
      refreshCashu: jest.fn().mockResolvedValue(),
      wallet: { taprootAddress: 'tb1p...' },
      showSnackbar: jest.fn(),
      dismissSnackbar: jest.fn(),
      switchAccount: jest.fn().mockResolvedValue(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.pendingCashuToken;
    delete global.triggerPendingTokenCheck;
    delete global.reloadWallet;
    delete global.pendingTurboSnackbars;
  });

  it('should return isVerifyingToken state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current.isVerifyingToken).toBe(false);
  });

  it('should expose triggerPendingTokenCheck globally when authenticated', () => {
    renderHookWithProps(mockProps);

    expect(global.triggerPendingTokenCheck).toBeDefined();
    expect(typeof global.triggerPendingTokenCheck).toBe('function');
  });

  it('should not expose globals when not authenticated', () => {
    renderHookWithProps({
      ...mockProps,
      isAuthenticated: false,
    });

    expect(global.triggerPendingTokenCheck).toBeUndefined();
  });

  it('should not expose globals when pin overlay is shown', () => {
    renderHookWithProps({
      ...mockProps,
      shouldShowPinOverlay: true,
    });

    expect(global.triggerPendingTokenCheck).toBeUndefined();
  });

  it('should not process when not authenticated', () => {
    global.pendingCashuToken = 'cashuA...';

    renderHookWithProps({
      ...mockProps,
      isAuthenticated: false,
    });

    expect(mockProps.receive).not.toHaveBeenCalled();
    expect(global.pendingCashuToken).toBe('cashuA...'); // Token should still be there
  });

  it('should not process when pin overlay is shown', () => {
    global.pendingCashuToken = 'cashuA...';

    renderHookWithProps({
      ...mockProps,
      shouldShowPinOverlay: true,
    });

    expect(mockProps.receive).not.toHaveBeenCalled();
    expect(global.pendingCashuToken).toBe('cashuA...'); // Token should still be there
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHookWithProps(mockProps);

    expect(global.triggerPendingTokenCheck).toBeDefined();

    act(() => {
      unmount();
    });

    expect(global.triggerPendingTokenCheck).toBeUndefined();
  });

  it('should clear pending token after calling receive', async () => {
    global.pendingCashuToken = 'cashuA...';

    renderHookWithProps(mockProps);

    // Check immediately after render that token was grabbed
    await act(async () => {
      await Promise.resolve();
    });

    expect(global.pendingCashuToken).toBeUndefined();
    expect(mockProps.receive).toHaveBeenCalledWith('cashuA...');
  });

  describe('processToken success', () => {
    it('should show success snackbar after processing', async () => {
      global.pendingCashuToken = 'cashuAtoken123';

      const { result } = renderHookWithProps(mockProps);

      // Wait for token to be processed
      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // After isVerifyingToken becomes false, snackbar should show
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'success',
        action: 'claim',
        description: expect.stringContaining('100.00'),
      });
    });

    it('should call fetchBalance and refreshCashu after success', async () => {
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(mockProps.fetchBalance).toHaveBeenCalled();
      expect(mockProps.refreshCashu).toHaveBeenCalled();
    });

    it('should call global.reloadWallet if defined', async () => {
      global.pendingCashuToken = 'cashuAtoken123';
      global.reloadWallet = jest.fn();

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Advance past the setTimeout
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(global.reloadWallet).toHaveBeenCalled();
    });
  });

  describe('processToken error handling', () => {
    it('should handle generic error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Unknown error'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars).toEqual([{
        type: 'error',
        action: 'claim',
        description: 'Unknown error',
      }]);
    });

    it('should handle "already spent" error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Token has already spent proofs'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].description).toBe('Token already claimed');
    });

    it('should handle "already been spent" error variant', async () => {
      mockProps.receive.mockRejectedValue(new Error('Proof has already been spent'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].description).toBe('Token already claimed');
    });

    it('should handle P2PK verification error with extended duration', async () => {
      mockProps.receive.mockRejectedValue(new Error('P2PK verification failed: invalid signature'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].description).toContain('P2PK verification failed');
      expect(global.pendingTurboSnackbars[0].duration).toBe(8000);
    });

    it('should handle Swap failed error with extended duration', async () => {
      mockProps.receive.mockRejectedValue(new Error('Swap failed: insufficient balance'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].description).toContain('Swap failed');
      expect(global.pendingTurboSnackbars[0].duration).toBe(8000);
    });

    it('should handle account switch error with action button', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].persistent).toBe(true);
      expect(global.pendingTurboSnackbars[0].actionLabel).toBe('Switch & Claim');
      expect(typeof global.pendingTurboSnackbars[0].onAction).toBe('function');
    });

    it('should switch account when action button pressed', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      global.pendingCashuToken = 'cashuAtoken123';
      global.reloadWallet = jest.fn();

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Start the action but don't await - it has internal setTimeout
      global.pendingTurboSnackbars[0].onAction();

      // Let promises flush
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Advance timers to allow the setTimeout inside onAction to complete
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      // Let final promises flush
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockProps.dismissSnackbar).toHaveBeenCalled();
      expect(mockProps.switchAccount).toHaveBeenCalledWith(1); // Account 2 = index 1
      expect(global.reloadWallet).toHaveBeenCalled();
      expect(global.pendingCashuToken).toBe('cashuAtoken123'); // Token should be re-queued
    });

    it('should handle switch account error', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      mockProps.switchAccount.mockRejectedValue(new Error('Switch failed'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Trigger the action - don't await directly due to internal setTimeout
      let actionPromise;
      act(() => {
        actionPromise = global.pendingTurboSnackbars[0].onAction();
      });

      // Advance timers to allow the setTimeout inside onAction to complete
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      await actionPromise;

      expect(mockProps.showSnackbar).toHaveBeenCalledWith({
        type: 'error',
        action: 'switch',
        description: 'Failed to switch account',
      });
    });

    it('should handle error without message', async () => {
      mockProps.receive.mockRejectedValue(new Error());
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars).toBeDefined();
      expect(global.pendingTurboSnackbars[0].description).toBe('Failed to receive token');
    });
  });

  describe('polling behavior', () => {
    it('should poll for pending tokens', async () => {
      renderHookWithProps(mockProps);

      // Ensure initial check has run
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Set token after initial check passes
      global.pendingCashuToken = 'cashuAdelayed';

      // Advance to next poll interval (500ms)
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      // Wait for async processing
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockProps.receive).toHaveBeenCalledWith('cashuAdelayed');
    });
  });

  describe('triggerPendingTokenCheck', () => {
    it('should be exposed globally when authenticated', async () => {
      renderHookWithProps(mockProps);

      // Wait for effects to run
      await act(async () => {
        await Promise.resolve();
      });

      // Should be defined after render
      expect(global.triggerPendingTokenCheck).toBeDefined();
    });
  });
});
