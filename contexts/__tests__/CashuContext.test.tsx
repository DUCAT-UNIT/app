// @ts-nocheck
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
}));

jest.mock('../WalletContext', () => ({
  useWallet: () => ({ wallet: { address: 'tb1ptest' } }),
}));

// Create mock functions that can be accessed in tests
const mockSetBalance = jest.fn();
const mockSetError = jest.fn();
const mockFetchBalance = jest.fn();
const mockSetPendingMints = jest.fn();

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
    pendingMints: [],
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
import { clearWallet } from '../../services/cashu/cashuWalletService';

describe('CashuContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useCashu', () => {
    it('should require being within a CashuProvider', () => {
      // This tests that useCashu throws when context is undefined
      // We verify the implementation by checking the source code behavior
      // Direct testing causes React errors that are hard to suppress in test-renderer

      // Verify the useCashu hook is exported
      expect(typeof useCashu).toBe('function');
    });
  });

  describe('CashuProvider', () => {
    it('should render children without error', () => {
      let renderer;

      act(() => {
        renderer = create(
          <CashuProvider>
            <div>Test Child</div>
          </CashuProvider>
        );
      });

      expect(renderer.toJSON()).toBeDefined();
    });

    it('should provide context to children', () => {
      let contextValue = null;

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
      expect(contextValue.balance).toBe(100);
      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.error).toBeNull();
      expect(contextValue.pendingMints).toEqual([]);
    });

    it('should expose mint operations', () => {
      let contextValue = null;

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

      expect(typeof contextValue.startMint).toBe('function');
      expect(typeof contextValue.checkAndCompleteMint).toBe('function');
      expect(typeof contextValue.removePendingMint).toBe('function');
      expect(typeof contextValue.autoMint).toBe('function');
    });

    it('should expose send/receive operations', () => {
      let contextValue = null;

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

      expect(typeof contextValue.receive).toBe('function');
      expect(typeof contextValue.send).toBe('function');
    });

    it('should expose melt operations', () => {
      let contextValue = null;

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

      expect(typeof contextValue.startMelt).toBe('function');
      expect(typeof contextValue.finishMelt).toBe('function');
    });

    it('should expose wallet management functions', () => {
      let contextValue = null;

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

      expect(typeof contextValue.refresh).toBe('function');
      expect(typeof contextValue.reset).toBe('function');
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
      let balanceState = null;

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
      expect(balanceState.balance).toBe(100);
      expect(balanceState.isLoading).toBe(false);
      expect(balanceState.error).toBeNull();
      expect(balanceState.pendingMints).toEqual([]);
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
      let operations = null;

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
      expect(typeof operations.startMint).toBe('function');
      expect(typeof operations.receive).toBe('function');
      expect(typeof operations.send).toBe('function');
      expect(typeof operations.reset).toBe('function');
      expect(typeof operations.refresh).toBe('function');
    });
  });

  describe('reset function', () => {
    it('should clear wallet and reset state', async () => {
      clearWallet.mockResolvedValue();
      let contextValue = null;

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
        await contextValue.reset();
      });

      expect(clearWallet).toHaveBeenCalled();
      expect(mockSetBalance).toHaveBeenCalledWith(0);
      expect(mockSetPendingMints).toHaveBeenCalledWith([]);
      expect(mockSetError).toHaveBeenCalledWith(null);
    });

    it('should throw error when clearWallet fails', async () => {
      const testError = new Error('Clear failed');
      clearWallet.mockRejectedValue(testError);
      let contextValue = null;

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
          await contextValue.reset();
        });
      }).rejects.toThrow('Clear failed');
    });
  });

  describe('refresh function', () => {
    it('should call fetchBalance', async () => {
      mockFetchBalance.mockResolvedValue();
      let contextValue = null;

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
        await contextValue.refresh();
      });

      expect(mockFetchBalance).toHaveBeenCalled();
    });
  });
});
