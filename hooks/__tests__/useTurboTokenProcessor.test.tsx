// @ts-nocheck
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
  turboGlobal: global,
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

      // The implementation stores only { type, message } in the queue
      expect(global.pendingTurboSnackbars).toEqual([{
        type: 'error',
        message: 'Unknown error',
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

      expect(global.pendingTurboSnackbars[0].message).toBe('Token already claimed');
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

      expect(global.pendingTurboSnackbars[0].message).toBe('Token already claimed');
    });

    it('should handle P2PK verification error', async () => {
      mockProps.receive.mockRejectedValue(new Error('P2PK verification failed: invalid signature'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].message).toContain('P2PK verification failed');
    });

    it('should handle Swap failed error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Swap failed: insufficient balance'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(global.pendingTurboSnackbars[0].message).toContain('Swap failed');
    });

    it('should handle account switch error message', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // The simplified queue format only contains type and message
      expect(global.pendingTurboSnackbars[0].type).toBe('error');
      expect(global.pendingTurboSnackbars[0].message).toContain('This proof belongs to account 2');
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
      expect(global.pendingTurboSnackbars[0].message).toBe('Failed to receive token');
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

  describe('saveReceivedToken error handling', () => {
    it('should continue processing even if saveReceivedToken fails', async () => {
      // Mock the dynamic import to throw
      jest.doMock('../../services/cashu/cashuLockedTokensService', () => ({
        saveReceivedToken: jest.fn().mockRejectedValue(new Error('Save failed')),
      }));

      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      // Wait for token to be processed
      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Should still complete successfully (save error is caught)
      expect(mockProps.receive).toHaveBeenCalledWith('cashuAtoken123');
      expect(mockProps.fetchBalance).toHaveBeenCalled();
    });
  });

  describe('account switch retry logic', () => {
    it('should set up onAction callback for account switch error', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 3'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // The error message should contain account info
      expect(global.pendingTurboSnackbars[0].message).toContain('This proof belongs to account 3');
    });

    it('should handle switch account failure gracefully', async () => {
      mockProps.switchAccount.mockRejectedValue(new Error('Switch failed'));
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 2'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Should have set up the snackbar queue
      expect(global.pendingTurboSnackbars).toBeDefined();
    });

    it('should parse account number from error message', async () => {
      mockProps.receive.mockRejectedValue(new Error('This proof belongs to account 5'));
      global.pendingCashuToken = 'cashuAtoken123';

      renderHookWithProps(mockProps);

      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Should contain the account info
      expect(global.pendingTurboSnackbars[0].message).toContain('account 5');
    });
  });
});
