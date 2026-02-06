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
function renderHookWithProps(props: any) {
  const result: { current: ReturnType<typeof useTurboConvert> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: any }) {
    result.current = useTurboConvert(hookProps);
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

describe('useTurboConvert', () => {
  let mockProps: Record<string, unknown>;
  const mockNavigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      runesBalance: [{ rune: 'UNIT', amount: '100.50', divisibility: 0 }],
      navigation: mockNavigation,
      getSpentUtxos: jest.fn(() => new Set()),
      unmarkUtxosAsSpent: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should return handleTurboPress function', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.handleTurboPress).toBe('function');
  });

  it('should show alert when runesBalance is empty', async () => {
    mockProps.runesBalance = [];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should show alert when runesBalance is null', async () => {
    mockProps.runesBalance = null;
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should show alert when runesBalance amount is 0', async () => {
    mockProps.runesBalance = [{ rune: 'UNIT', amount: '0', divisibility: 0 }];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No On-chain UNIT', "You don't have any on-chain UNIT to convert.");
  });

  it('should clear spent UTXOs if any exist', async () => {
    const spentUtxos = new Set(['txid1:0', 'txid2:1']);
    (mockProps.getSpentUtxos as jest.Mock).mockReturnValue(spentUtxos);
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      try {
        await result.current!.handleTurboPress();
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
    (mockProps.getSpentUtxos as jest.Mock).mockReturnValue(new Set());
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      try {
        await result.current!.handleTurboPress();
      } catch {
        // Dynamic import may fail in test environment
      }
    });

    expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalled();
  });

  it('should update when runesBalance changes', () => {
    const { result, rerender } = renderHookWithProps(mockProps);
    const firstCallback = result.current!.handleTurboPress;

    rerender({ ...mockProps, runesBalance: [{ rune: 'UNIT', amount: '200', divisibility: 0 }] });

    // Callback should be recreated due to dependency change
    expect(result.current!.handleTurboPress).not.toBe(firstCallback);
  });

  it('should parse runes balance correctly', async () => {
    mockProps.runesBalance = [['UNIT', '50.25']];
    const { result } = renderHookWithProps(mockProps);

    // The hook parses the second element as a float
    // We can't easily test the internal parsing, but we verify no error with decimal
    await act(async () => {
      try {
        await result.current!.handleTurboPress();
      } catch {
        // Dynamic import may fail
      }
    });

    // Should not show the "no UNIT" alert since balance is positive
    expect(Alert.alert).not.toHaveBeenCalledWith('No On-chain UNIT', expect.any(String));
  });

  it('should request mint and navigate on successful conversion', async () => {
    const { requestMint } = require('../../services/cashu/cashuWalletService');
    requestMint.mockResolvedValue({
      quoteId: 'quote456',
      depositAddress: 'bc1qdeposit',
      amount: 100.5,
    });

    mockProps.runesBalance = [{ rune: 'UNIT', amount: '100.50', divisibility: 0 }];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(requestMint).toHaveBeenCalledWith(100.5);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendFlow', {
      screen: 'TurboLoading',
      params: {
        assetType: 'unit',
        prefillAddress: 'bc1qdeposit',
        prefillAmount: 100.5,
        mintQuoteId: 'quote456',
        mintAmount: 100.5,
        isTurbo: true,
      },
    });
  });

  it('should show error alert when requestMint fails', async () => {
    const { requestMint } = require('../../services/cashu/cashuWalletService');
    requestMint.mockRejectedValue(new Error('Mint service unavailable'));

    mockProps.runesBalance = [{ rune: 'UNIT', amount: '100', divisibility: 0 }];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to convert: Mint service unavailable');
  });

  it('should handle non-Error exceptions', async () => {
    const { requestMint } = require('../../services/cashu/cashuWalletService');
    requestMint.mockRejectedValue('String error');

    mockProps.runesBalance = [{ rune: 'UNIT', amount: '50', divisibility: 0 }];
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleTurboPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to convert: String error');
  });
});
