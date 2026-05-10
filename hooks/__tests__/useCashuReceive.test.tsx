/**
 * Tests for useCashuReceive hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useCashuReceive } from '../useCashuReceive';

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

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    navigate: jest.fn((params) => params),
  },
}));

// Helper to render hooks with props
function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: ReturnType<typeof useCashuReceive> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: Record<string, unknown> }) {
    result.current = useCashuReceive(hookProps as unknown as Parameters<typeof useCashuReceive>[0]);
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
    rerender: (newProps?: Record<string, unknown>) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useCashuReceive', () => {
  let mockProps: {
    startMint: jest.Mock;
    checkAndCompleteMint: jest.Mock;
    receive: jest.Mock;
    navigation: typeof mockNavigation;
    [key: string]: unknown;
  };
  const mockNavigation = {
    goBack: jest.fn(),
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockProps = {
      startMint: jest.fn().mockResolvedValue({ quoteId: 'quote123', depositAddress: 'bc1qtest' }),
      checkAndCompleteMint: jest.fn().mockResolvedValue({ completed: false }),
      receive: jest.fn().mockResolvedValue({ amount: 100 }),
      navigation: mockNavigation,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current!.mode).toBe('choose');
    expect(result.current!.amount).toBe('');
    expect(result.current!.mintQuote).toBeNull();
    expect(result.current!.isLoading).toBe(false);
    expect(result.current!.pasteValue).toBe('');
    expect(result.current!.justCopied).toBe(false);
  });

  it('should expose all expected functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.setMode).toBe('function');
    expect(typeof result.current!.setAmount).toBe('function');
    expect(typeof result.current!.setPasteValue).toBe('function');
    expect(typeof result.current!.handleStartMint).toBe('function');
    expect(typeof result.current!.handleReceiveToken).toBe('function');
    expect(typeof result.current!.handleAutoMint).toBe('function');
    expect(typeof result.current!.handleCopyAddress).toBe('function');
    expect(typeof result.current!.resetMintQuote).toBe('function');
  });

  describe('handleStartMint', () => {
    it('should show alert for invalid amount', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
      expect(mockProps.startMint).not.toHaveBeenCalled();
    });

    it('should show alert for zero amount', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('0');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
    });

    it('should call startMint with valid amount', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(mockProps.startMint).toHaveBeenCalledWith(100);
    });

    it('should show alert when mint amount exceeds on-chain UNIT balance', async () => {
      const { result } = renderHookWithProps({ ...mockProps, availableRunesCents: 50 });

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Insufficient On-chain UNIT',
        'You only have 0.50 on-chain UNIT available to mint.'
      );
      expect(mockProps.startMint).not.toHaveBeenCalled();
    });

    it('should handle startMint error', async () => {
      mockProps.startMint.mockRejectedValue(new Error('Mint failed'));
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Mint failed');
    });

    it('should handle startMint non-Error rejection', async () => {
      mockProps.startMint.mockRejectedValue('String error');
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'String error');
    });
  });

  describe('handleReceiveToken', () => {
    it('should show alert for empty paste value', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleReceiveToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Token', 'Please paste a Cashu token');
    });

    it('should receive cashu token directly', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setPasteValue('cashuAtoken123');
      });

      await act(async () => {
        await result.current!.handleReceiveToken();
      });

      expect(mockProps.receive).toHaveBeenCalledWith('cashuAtoken123');
    });

    it('should handle receive error', async () => {
      mockProps.receive.mockRejectedValue(new Error('Receive failed'));
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setPasteValue('cashuAtoken123');
      });

      await act(async () => {
        await result.current!.handleReceiveToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Receive failed');
    });

    it('should handle receive non-Error rejection', async () => {
      mockProps.receive.mockRejectedValue('String error');
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setPasteValue('cashuAtoken123');
      });

      await act(async () => {
        await result.current!.handleReceiveToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'String error');
    });
  });

  describe('handleAutoMint', () => {
    it('should show alert for invalid amount', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleAutoMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
    });

    it('should navigate to Processing screen on success', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleAutoMint();
      });

      expect(mockProps.startMint).toHaveBeenCalledWith(100);
      expect(mockNavigation.dispatch).toHaveBeenCalled();
    });

    it('should not create a mint intent when on-chain UNIT is unavailable', async () => {
      const { result } = renderHookWithProps({ ...mockProps, availableRunesCents: 0 });

      act(() => {
        result.current!.setAmount('1');
      });

      await act(async () => {
        await result.current!.handleAutoMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Insufficient On-chain UNIT',
        'You only have 0.00 on-chain UNIT available to mint.'
      );
      expect(mockProps.startMint).not.toHaveBeenCalled();
      expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('handleCopyAddress', () => {
    it('should copy address and set justCopied flag', async () => {
      const mockSetStringAsync = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleCopyAddress('bc1qtest', mockSetStringAsync);
      });

      expect(mockSetStringAsync).toHaveBeenCalledWith('bc1qtest');
      expect(result.current!.justCopied).toBe(true);

      // Wait for timeout to clear flag
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current!.justCopied).toBe(false);
    });

    it('should not copy if address is empty', async () => {
      const mockSetStringAsync = jest.fn();
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleCopyAddress('', mockSetStringAsync);
      });

      expect(mockSetStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('resetMintQuote', () => {
    it('should reset mint quote and mode', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setMode('mint');
      });

      act(() => {
        result.current!.resetMintQuote();
      });

      expect(result.current!.mintQuote).toBeNull();
      expect(result.current!.mode).toBe('choose');
    });
  });

  describe('handleAutoMint error handling', () => {
    it('should show alert on startMint error', async () => {
      mockProps.startMint.mockRejectedValue(new Error('Mint quote failed'));
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleAutoMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Mint quote failed');
    });

    it('should show alert on startMint non-Error rejection', async () => {
      mockProps.startMint.mockRejectedValue('String error');
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleAutoMint();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'String error');
    });
  });

  describe('useEffect polling', () => {
    it('should start polling when mintQuote and mode are set', async () => {
      mockProps.checkAndCompleteMint.mockResolvedValue({ completed: false });

      const { result } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      // Set mode to mint
      act(() => {
        result.current!.setMode('mint');
      });

      // Advance timer to trigger interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // checkAndCompleteMint should have been called by the interval
      expect(mockProps.checkAndCompleteMint).toHaveBeenCalled();
    });

    it('should show success alert when mint is completed', async () => {
      mockProps.checkAndCompleteMint.mockResolvedValue({ completed: true, amount: 100 });

      const { result } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      // Set mode to mint
      act(() => {
        result.current!.setMode('mint');
      });

      // Advance timer to trigger interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Should show success alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success!',
        'Minted 100 sats worth of Cashu tokens',
        expect.any(Array)
      );
    });

    it('should call navigation.goBack when mint success alert OK is pressed', async () => {
      mockProps.checkAndCompleteMint.mockResolvedValue({ completed: true, amount: 100 });

      const { result } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      // Set mode to mint
      act(() => {
        result.current!.setMode('mint');
      });

      // Advance timer to trigger interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Find the success alert call and invoke the onPress callback
      const alertCall = (Alert.alert as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'Success!' && (call[1] as string).includes('Minted')
      );
      expect(alertCall).toBeDefined();

      // Get the button config and call onPress
      const buttons = alertCall[2];
      const okButton = buttons[0];

      act(() => {
        okButton.onPress();
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should handle polling error gracefully', async () => {
      const { logger } = require('../../utils/logger');
      mockProps.checkAndCompleteMint.mockRejectedValue(new Error('Check failed'));

      const { result } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      // Set mode to mint
      act(() => {
        result.current!.setMode('mint');
      });

      // Advance timer to trigger interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Should log error but not crash
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle polling non-Error rejection gracefully', async () => {
      const { logger } = require('../../utils/logger');
      mockProps.checkAndCompleteMint.mockRejectedValue('String error');

      const { result } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      // Set mode to mint
      act(() => {
        result.current!.setMode('mint');
      });

      // Advance timer to trigger interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Should log error with string conversion
      expect(logger.error).toHaveBeenCalledWith('Error checking mint:', { error: 'String error' });
    });

    it('should cleanup interval on unmount', async () => {
      const { result, unmount } = renderHookWithProps(mockProps);

      // Set mode to mint and create a quote
      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      act(() => {
        result.current!.setMode('mint');
      });

      // Unmount should cleanup interval
      act(() => {
        unmount();
      });

      // Advancing timers should not cause issues
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      // No additional calls after unmount
    });

    it('should not overlap mint status checks while a previous check is still running', async () => {
      let resolveCheck: (value: { completed: boolean }) => void = () => undefined;
      mockProps.checkAndCompleteMint.mockImplementation(() => new Promise((resolve) => {
        resolveCheck = resolve;
      }));

      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setAmount('100');
      });

      await act(async () => {
        await result.current!.handleStartMint();
      });

      act(() => {
        result.current!.setMode('mint');
      });

      await act(async () => {
        jest.advanceTimersByTime(3000);
        jest.advanceTimersByTime(3000);
      });

      expect(mockProps.checkAndCompleteMint).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveCheck({ completed: false });
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      expect(mockProps.checkAndCompleteMint).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleReceiveToken success callback', () => {
    it('should call navigation.goBack on success alert button press', async () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.setPasteValue('cashuAtoken123');
      });

      await act(async () => {
        await result.current!.handleReceiveToken();
      });

      // Extract the onPress callback from Alert.alert call
      const alertCall = (Alert.alert as jest.Mock).mock.calls.find((call: unknown[]) => call[0] === 'Success!');
      expect(alertCall).toBeDefined();

      // Get the button config
      const buttons = alertCall[2];
      const okButton = buttons[0];

      // Call the onPress
      act(() => {
        okButton.onPress();
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});
