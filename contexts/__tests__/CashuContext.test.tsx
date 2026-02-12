/**
 * Tests for CashuContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

// Mock dependencies BEFORE imports
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  clearWallet: jest.fn(),
  setCurrentAccount: jest.fn(),
}));

const mockCheckAndRecoverSwaps = jest.fn();
const mockRecoverUnclaimedMintQuotes = jest.fn();
const mockRecoverPendingTurboSend = jest.fn();

jest.mock('../../services/cashu/cashuSwapRecovery', () => ({
  checkAndRecoverSwaps: () => mockCheckAndRecoverSwaps(),
}));

jest.mock('../../services/cashu/cashuMintQuoteRecovery', () => ({
  recoverUnclaimedMintQuotes: () => mockRecoverUnclaimedMintQuotes(),
}));

jest.mock('../../services/cashu/cashuTurboRecovery', () => ({
  recoverPendingTurboSend: (...args: unknown[]) => mockRecoverPendingTurboSend(...args),
}));

jest.mock('../../services/cashu/operations/cashuSendP2PK', () => ({
  sendP2PKToken: jest.fn(),
}));

jest.mock('../../utils/bitcoin', () => ({
  extractPubkeyFromTaprootAddress: jest.fn(),
}));

jest.mock('../../services/urlShortener', () => ({
  shortenCashuToken: jest.fn(),
}));

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  saveSentLockedToken: jest.fn(),
}));

jest.mock('../../utils/notify', () => ({
  notify: {
    transaction: {
      success: jest.fn(),
    },
  },
}));

jest.mock('../WalletContext', () => ({
  useWallet: () => ({ wallet: { address: 'tb1ptest' } }),
}));

// Create mock functions that can be accessed in tests
const mockSetBalance = jest.fn();
const mockSetError = jest.fn();
const mockFetchBalance = jest.fn();
const mockSetPendingMints = jest.fn();

// Configurable pending mints for testing
let mockPendingMints: Array<{ quoteId: string; amount: number }> = [];

// Mock hooks with proper state
jest.mock('../../hooks/useCashuBalance', () => ({
  useCashuBalance: () => ({
    balance: 100,
    setBalance: mockSetBalance,
    error: null,
    setError: mockSetError,
    fetchBalance: mockFetchBalance,
  }),
}));

jest.mock('../../hooks/useCashuMint', () => ({
  useCashuMint: () => ({
    pendingMints: mockPendingMints,
    startMint: jest.fn(),
    checkAndCompleteMint: jest.fn(),
    removePendingMint: jest.fn(),
    autoMint: jest.fn(),
    setPendingMints: mockSetPendingMints,
  }),
}));

jest.mock('../../hooks/useCashuMelt', () => ({
  useCashuMelt: () => ({
    startMelt: jest.fn(),
    finishMelt: jest.fn(),
  }),
}));

jest.mock('../../hooks/useCashuSendReceive', () => ({
  useCashuSendReceive: () => ({
    receive: jest.fn(),
    send: jest.fn(),
  }),
}));

// Import after mocks are set up
import { CashuProvider, useCashu, useCashuBalanceState, useCashuOperations } from '../CashuContext';
import type { CashuContextValue, CashuBalanceValue, CashuOperationsValue } from '../CashuContext';
import { clearWallet } from '../../services/cashu/cashuWalletService';

const mockClearWallet = clearWallet as jest.Mock;

describe('CashuContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useCashu', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      function TestComponent() {
        useCashu();
        return null;
      }

      expect(() => {
        act(() => {
          create(<TestComponent />);
        });
      }).toThrow('useCashuBalanceState must be used within a CashuProvider');

      consoleError.mockRestore();
    });
  });

  describe('CashuProvider', () => {
    it('should render children without error', () => {
      let renderer: ReturnType<typeof create> | undefined;

      act(() => {
        renderer = create(
          <CashuProvider>
            <div>Test Child</div>
          </CashuProvider>
        );
      });

      expect(renderer!.toJSON()).toBeDefined();
    });

    it('should provide context to children', () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(contextValue).toBeDefined();
      expect(contextValue!.balance).toBe(100);
      expect(contextValue!.isLoading).toBe(false);
      expect(contextValue!.error).toBeNull();
      expect(contextValue!.pendingMints).toEqual([]);
    });

    it('should expose mint operations', () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(typeof contextValue!.startMint).toBe('function');
      expect(typeof contextValue!.checkAndCompleteMint).toBe('function');
      expect(typeof contextValue!.removePendingMint).toBe('function');
      expect(typeof contextValue!.autoMint).toBe('function');
    });

    it('should expose send/receive operations', () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(typeof contextValue!.receive).toBe('function');
      expect(typeof contextValue!.send).toBe('function');
    });

    it('should expose melt operations', () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(typeof contextValue!.startMelt).toBe('function');
      expect(typeof contextValue!.finishMelt).toBe('function');
    });

    it('should expose wallet management functions', () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(typeof contextValue!.refresh).toBe('function');
      expect(typeof contextValue!.reset).toBe('function');
    });
  });

  describe('useCashuBalanceState', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      function TestComponent() {
        useCashuBalanceState();
        return null;
      }

      expect(() => {
        act(() => {
          create(<TestComponent />);
        });
      }).toThrow('useCashuBalanceState must be used within a CashuProvider');

      consoleError.mockRestore();
    });

    it('should return balance state when used within provider', () => {
      let balanceState: CashuBalanceValue | null = null;

      function Consumer() {
        balanceState = useCashuBalanceState();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(balanceState).toBeDefined();
      expect(balanceState!.balance).toBe(100);
      expect(balanceState!.isLoading).toBe(false);
      expect(balanceState!.error).toBeNull();
      expect(balanceState!.pendingMints).toEqual([]);
    });
  });

  describe('useCashuOperations', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      function TestComponent() {
        useCashuOperations();
        return null;
      }

      expect(() => {
        act(() => {
          create(<TestComponent />);
        });
      }).toThrow('useCashuOperations must be used within a CashuProvider');

      consoleError.mockRestore();
    });

    it('should return operations when used within provider', () => {
      let operations: CashuOperationsValue | null = null;

      function Consumer() {
        operations = useCashuOperations();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      expect(operations).toBeDefined();
      expect(typeof operations!.startMint).toBe('function');
      expect(typeof operations!.receive).toBe('function');
      expect(typeof operations!.send).toBe('function');
      expect(typeof operations!.reset).toBe('function');
      expect(typeof operations!.refresh).toBe('function');
    });
  });

  describe('reset function', () => {
    it('should clear wallet and reset state', async () => {
      mockClearWallet.mockResolvedValue(undefined);
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await act(async () => {
        await contextValue!.reset();
      });

      expect(clearWallet).toHaveBeenCalled();
      expect(mockSetBalance).toHaveBeenCalledWith(0);
      expect(mockSetPendingMints).toHaveBeenCalledWith([]);
      expect(mockSetError).toHaveBeenCalledWith(null);
    });

    it('should throw error when clearWallet fails with Error', async () => {
      const testError = new Error('Clear failed');
      mockClearWallet.mockRejectedValue(testError);
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await expect(async () => {
        await act(async () => {
          await contextValue!.reset();
        });
      }).rejects.toThrow('Clear failed');
    });

    it('should throw non-Error when clearWallet fails with non-Error', async () => {
      mockClearWallet.mockRejectedValue('string error');
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await expect(async () => {
        await act(async () => {
          await contextValue!.reset();
        });
      }).rejects.toBe('string error');
    });
  });

  describe('refresh function', () => {
    it('should call fetchBalance', async () => {
      mockFetchBalance.mockResolvedValue(undefined);
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await act(async () => {
        await contextValue!.refresh();
      });

      expect(mockFetchBalance).toHaveBeenCalled();
    });
  });

  describe('resetAndRefresh function', () => {
    it('should reset state and fetch balance', async () => {
      mockFetchBalance.mockResolvedValue(undefined);
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await act(async () => {
        await contextValue!.resetAndRefresh();
      });

      expect(mockSetBalance).toHaveBeenCalledWith(0);
      expect(mockSetPendingMints).toHaveBeenCalledWith([]);
      expect(mockSetError).toHaveBeenCalledWith(null);
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should reset state and fetch balance with taproot address', async () => {
      mockFetchBalance.mockResolvedValue(undefined);
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      const testAddress = 'bc1ptest123';

      await act(async () => {
        await contextValue!.resetAndRefresh(testAddress);
      });

      expect(mockSetBalance).toHaveBeenCalledWith(0);
      expect(mockSetPendingMints).toHaveBeenCalledWith([]);
      expect(mockSetError).toHaveBeenCalledWith(null);
      expect(mockFetchBalance).toHaveBeenCalled();
    });
  });

  describe('addPendingMint function', () => {
    beforeEach(() => {
      mockPendingMints = [];
    });

    it('should add a new pending mint', async () => {
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      act(() => {
        contextValue!.addPendingMint('quote123', 1000);
      });

      // Verify setPendingMints was called with a function
      expect(mockSetPendingMints).toHaveBeenCalled();
      const updaterFn = mockSetPendingMints.mock.calls[0][0];
      const result = updaterFn([]);
      expect(result).toHaveLength(1);
      expect(result[0].quoteId).toBe('quote123');
      expect(result[0].amount).toBe(1000);
    });

    it('should not add duplicate pending mint', async () => {
      mockPendingMints = [{ quoteId: 'quote123', amount: 1000 }];
      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      act(() => {
        contextValue!.addPendingMint('quote123', 1000);
      });

      // Verify setPendingMints was called with a function that returns prev (no change)
      expect(mockSetPendingMints).toHaveBeenCalled();
      const updaterFn = mockSetPendingMints.mock.calls[0][0];
      const existingMints = [{ quoteId: 'quote123', amount: 1000 }];
      const result = updaterFn(existingMints);
      // Should return the same array (not add duplicate)
      expect(result).toBe(existingMints);
    });
  });

  describe('recovery flows', () => {
    beforeEach(() => {
      mockCheckAndRecoverSwaps.mockResolvedValue(undefined);
      mockRecoverUnclaimedMintQuotes.mockResolvedValue({ recovered: 0, totalAmountRecovered: 0 });
      mockRecoverPendingTurboSend.mockResolvedValue({ recovered: false });
      mockFetchBalance.mockResolvedValue(undefined);
    });

    it('should run recovery on startup when wallet has taprootAddress', async () => {
      // Create a fresh provider with taprootAddress
      jest.unmock('../WalletContext');
      jest.doMock('../WalletContext', () => ({
        useWallet: () => ({ wallet: { taprootAddress: 'tb1ptest123' } }),
      }));

      // Re-import to get updated mock
      jest.resetModules();

      // The recovery runs on mount, just verify it doesn't throw
      act(() => {
        create(
          <CashuProvider>
            <div>Test</div>
          </CashuProvider>
        );
      });

      // Wait for async recovery
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });

    it('should handle mint recovery with recovered quotes', async () => {
      mockRecoverUnclaimedMintQuotes.mockResolvedValue({
        recovered: 2,
        totalAmountRecovered: 5000,
      });

      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      await act(async () => {
        await contextValue!.refresh();
      });

      expect(mockRecoverUnclaimedMintQuotes).toHaveBeenCalled();
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should handle mint recovery error gracefully', async () => {
      mockRecoverUnclaimedMintQuotes.mockRejectedValue(new Error('Recovery failed'));

      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      // Should not throw
      await act(async () => {
        await contextValue!.refresh();
      });

      // Should still call fetchBalance even after recovery error
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should handle mint recovery error with non-Error gracefully', async () => {
      mockRecoverUnclaimedMintQuotes.mockRejectedValue('string error');

      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      // Should not throw
      await act(async () => {
        await contextValue!.refresh();
      });

      // Should still call fetchBalance even after recovery error
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should handle swap recovery error gracefully', async () => {
      mockCheckAndRecoverSwaps.mockRejectedValue(new Error('Swap recovery failed'));

      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      // Should not throw
      await act(async () => {
        await contextValue!.refresh();
      });

      // Should still call fetchBalance even after recovery error
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should handle swap recovery error with non-Error gracefully', async () => {
      mockCheckAndRecoverSwaps.mockRejectedValue('string swap error');

      let contextValue: CashuContextValue | null = null;

      function Consumer() {
        contextValue = useCashu();
        return null;
      }

      act(() => {
        create(
          <CashuProvider>
            <Consumer />
          </CashuProvider>
        );
      });

      // Should not throw
      await act(async () => {
        await contextValue!.refresh();
      });

      // Should still call fetchBalance even after recovery error
      expect(mockFetchBalance).toHaveBeenCalled();
    });
  });
});
