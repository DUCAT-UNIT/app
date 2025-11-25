/**
 * Tests for useTurboConvert hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useTurboConvert } from '../useTurboConvert';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMint: jest.fn().mockResolvedValue({
    quoteId: 'quote123',
    depositAddress: 'bc1qmintaddress',
    amount: 100,
  }),
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTurboConvert(hookProps);
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

describe('useTurboConvert', () => {
  let mockProps;
  const mockNavigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      runesBalance: [['UNIT', '100.50']],
      navigation: mockNavigation,
      getSpentUtxos: jest.fn(() => new Set()),
      unmarkUtxosAsSpent: jest.fn().mockResolvedValue(),
    };
  });

  it('should return handleTurboPress function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleTurboPress).toBe('function');
  });

  it('should show alert when runesBalance is empty', async () => {
    mockProps.runesBalance = [];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should show alert when runesBalance is null', async () => {
    mockProps.runesBalance = null;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should show alert when runesBalance amount is 0', async () => {
    mockProps.runesBalance = [['UNIT', '0']];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should clear spent UTXOs if any exist', async () => {
    const spentUtxos = new Set(['txid1:0', 'txid2:1']);
    mockProps.getSpentUtxos.mockReturnValue(spentUtxos);
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      try {
        await result.current.handleTurboPress();
      } catch {
        // Dynamic import may fail in test environment
      }
    });

    expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'txid1', vout: 0 },
      { txid: 'txid2', vout: 1 },
    ]);
  });

  it('should not call unmarkUtxosAsSpent when no spent UTXOs', async () => {
    mockProps.getSpentUtxos.mockReturnValue(new Set());
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      try {
        await result.current.handleTurboPress();
      } catch {
        // Dynamic import may fail in test environment
      }
    });

    expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalled();
  });

  it('should update when runesBalance changes', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current.handleTurboPress;

    rerender({ ...mockProps, runesBalance: [['UNIT', '200']] });

    // Callback should be recreated due to dependency change
    expect(result.current.handleTurboPress).not.toBe(firstCallback);
  });

  it('should parse runes balance correctly', async () => {
    mockProps.runesBalance = [['UNIT', '50.25']];
    const { result } = renderHookWithProps(mockProps);

    // The hook parses the second element as a float
    // We can't easily test the internal parsing, but we verify no error with decimal
    await act(async () => {
      try {
        await result.current.handleTurboPress();
      } catch {
        // Dynamic import may fail
      }
    });

    // Should not show the "no UNIT" alert since balance is positive
    expect(Alert.alert).not.toHaveBeenCalledWith('No On-chain UNIT', expect.any(String));
  });

  // Note: The following tests would require the dynamic import to work.
  // Since Jest mock hoisting doesn't fully support dynamic imports in this codebase,
  // we test what we can and document this limitation.
  // Lines 38-41 (navigation after successful mint) and 52-53 (error handling)
  // require integration tests or refactoring to static imports for full coverage.
});
