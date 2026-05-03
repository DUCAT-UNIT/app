/**
 * Tests for useFuseEcash hook
 * Covers fuse flow, polling, and error handling
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useFuseEcash } from '../useFuseEcash';

type UseFuseEcashParams = Parameters<typeof useFuseEcash>[0];

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

// Mock service functions
const mockRequestMaxMelt = jest.fn();
const mockCompleteMeltWithoutCleanup = jest.fn();
const mockCleanupMeltProofs = jest.fn();

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMaxMelt: (...args: unknown[]) => mockRequestMaxMelt(...args),
  completeMeltWithoutCleanup: (...args: unknown[]) => mockCompleteMeltWithoutCleanup(...args),
  cleanupMeltProofs: (...args: unknown[]) => mockCleanupMeltProofs(...args),
}));

// Helper to render hooks with props
function renderHookWithProps(props: UseFuseEcashParams) {
  const result: { current: ReturnType<typeof useFuseEcash> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps: UseFuseEcashParams }) {
    result.current = useFuseEcash(hookProps);
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
    rerender: (newProps: UseFuseEcashParams) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

// Advance timers properly for async code
async function flushPromisesAndTimers() {
  // Flush microtask queue then advance timers
  await Promise.resolve();
  jest.advanceTimersByTime(0);
}

describe('useFuseEcash', () => {
  let mockProps: UseFuseEcashParams;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProps = {
      cashuBalance: 10050,
      taprootAddress: 'tb1ptest12345',
      transactionHistory: [],
      fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
    };

    // Default mocks
    mockRequestMaxMelt.mockResolvedValue({
      quoteId: 'quote123',
      amount: 9050,
      fee: 1000,
      total: 10050,
    });
    mockCompleteMeltWithoutCleanup.mockResolvedValue({
      proofsToRemove: [],
      changeProofs: [],
    });
    mockCleanupMeltProofs.mockResolvedValue(undefined);
  });

  it('should return handleFusePress function', () => {
    const { result } = renderHookWithProps(mockProps);
    expect(typeof result.current!.handleFusePress).toBe('function');
  });

  it('should show alert when cashuBalance is 0', async () => {
    const props = { ...mockProps, cashuBalance: 0 };
    const { result } = renderHookWithProps(props);

    await act(async () => {
      await result.current!.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('No TurboUNIT', "You don't have any TurboUNIT to withdraw.");
  });

  it('should show confirmation alert with balance', async () => {
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Withdraw TurboUNIT?',
      'Convert up to 100.50 TurboUNIT to on-chain UNIT? Network fees are deducted from the withdrawal amount.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Withdraw' }),
      ])
    );
  });

  it('should format balance with two decimal places', async () => {
    const props = { ...mockProps, cashuBalance: 5012 };
    const { result } = renderHookWithProps(props);

    await act(async () => {
      await result.current!.handleFusePress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Withdraw TurboUNIT?',
      'Convert up to 50.12 TurboUNIT to on-chain UNIT? Network fees are deducted from the withdrawal amount.',
      expect.any(Array)
    );
  });

  it('should return object with handleFusePress property', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(result.current).toHaveProperty('handleFusePress');
    expect(Object.keys(result.current!)).toHaveLength(1);
  });

  it('should have cancel and fuse buttons in alert', async () => {
    const { result } = renderHookWithProps(mockProps);

    await act(async () => {
      await result.current!.handleFusePress();
    });

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];

    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Withdraw');
    expect(typeof buttons[1].onPress).toBe('function');
  });

  describe('Fuse flow - error handling', () => {
    it('should handle error during fuse', async () => {
      mockRequestMaxMelt.mockRejectedValue(new Error('Melt failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await fuseButton.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Withdrawal failed',
        'Your TurboUNIT tokens remain valid. Melt failed'
      );
    });

    it('should handle non-Error exception during fuse', async () => {
      mockRequestMaxMelt.mockRejectedValue('String error');

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      await act(async () => {
        await fuseButton.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Withdrawal failed',
        'Your TurboUNIT tokens remain valid. String error'
      );
    });
  });

  describe('Fuse flow - with polling', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should request melt and complete melt on fuse button press', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      // Start the fuse operation
      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      // Advance through all the polling timeouts
      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(mockRequestMaxMelt).toHaveBeenCalledWith('tb1ptest12345', 10050);
      expect(mockCompleteMeltWithoutCleanup).toHaveBeenCalledWith('quote123', 10050);
      expect(mockCleanupMeltProofs).toHaveBeenCalled();
    });

    it('should show processing alert after melt', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Withdrawal submitted',
        'Withdrawing 90.50 UNIT. Waiting for transaction to appear on-chain...'
      );
    });

    it('should poll for transaction and show success when found with recent block_time', async () => {
      const props = {
        ...mockProps,
        transactionHistory: [{
          txid: 'tx123',
          vout: [{ scriptpubkey_address: 'tb1ptest12345' }],
          status: { block_time: Math.floor(Date.now() / 1000) - 60 },
        }],
      };
      const { result } = renderHookWithProps(props);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith('Success', 'TurboUNIT successfully withdrawn to on-chain UNIT.');
    });

    it('should find unconfirmed transaction (no block_time)', async () => {
      const props = {
        ...mockProps,
        transactionHistory: [{
          txid: 'tx123',
          vout: [{ scriptpubkey_address: 'tb1ptest12345' }],
          status: {},
        }],
      };
      const { result } = renderHookWithProps(props);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith('Success', 'TurboUNIT successfully withdrawn to on-chain UNIT.');
    });

    it('should show pending alert when transaction not found after polling', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Pending',
        'Withdrawal submitted successfully. Transaction will appear on-chain shortly.'
      );
    });

    it('should skip old transactions (block_time > 120 seconds ago)', async () => {
      const props = {
        ...mockProps,
        transactionHistory: [{
          txid: 'tx123',
          vout: [{ scriptpubkey_address: 'tb1ptest12345' }],
          status: { block_time: Math.floor(Date.now() / 1000) - 300 },
        }],
      };
      const { result } = renderHookWithProps(props);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Pending',
        'Withdrawal submitted successfully. Transaction will appear on-chain shortly.'
      );
    });

    it('should skip transactions without matching address', async () => {
      const props = {
        ...mockProps,
        transactionHistory: [{
          txid: 'tx123',
          vout: [{ scriptpubkey_address: 'tb1pother456' }],
          status: { block_time: Math.floor(Date.now() / 1000) },
        }],
      };
      const { result } = renderHookWithProps(props);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Pending',
        'Withdrawal submitted successfully. Transaction will appear on-chain shortly.'
      );
    });

    it('should handle transaction without vout', async () => {
      const props = {
        ...mockProps,
        transactionHistory: [{
          txid: 'tx123',
          status: { block_time: Math.floor(Date.now() / 1000) },
        }],
      };
      const { result } = renderHookWithProps(props);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Pending',
        'Withdrawal submitted successfully. Transaction will appear on-chain shortly.'
      );
    });

    it('should call fetchTransactionHistory during polling', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleFusePress();
      });

      const fuseButton = (Alert.alert as jest.Mock).mock.calls[0][2][1];

      let fusePromise: Promise<void> | undefined;
      await act(async () => {
        fusePromise = fuseButton.onPress();
      });

      for (let i = 0; i < 35; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
          await Promise.resolve();
        });
      }

      await act(async () => {
        await fusePromise;
      });

      expect(mockProps.fetchTransactionHistory).toHaveBeenCalled();
    });
  });
});
