/**
 * Tests for CashuContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

let mockWallet: { address?: string; taprootAddress?: string } | null = { address: 'tb1ptest' };
let mockIsAuthenticated = true;
let mockAppStateHandler: ((state: string) => void) | null = null;
const mockRunAfterInteractions = jest.fn((callback: () => void) => {
  callback();
  return { cancel: jest.fn() };
});
const mockAppStateAddEventListener = jest.fn((_event: string, handler: (state: string) => void) => {
  mockAppStateHandler = handler;
  return { remove: jest.fn() };
});

// Mock dependencies BEFORE imports
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (...args: [string, (state: string) => void]) => mockAppStateAddEventListener(...args),
  },
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => mockRunAfterInteractions(callback),
  },
}));

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
  sendP2PKToken: jest.fn(),
  setCurrentAccount: jest.fn(),
}));

const mockCheckAndRecoverSwaps = jest.fn();
const mockRecoverUnclaimedMintQuotes = jest.fn();
const mockRecoverPendingTurboSend = jest.fn();
const mockRefreshPersistedTurboMintSettlementStatus = jest.fn();

jest.mock('../../services/cashu/cashuSwapRecovery', () => ({
  checkAndRecoverSwaps: () => mockCheckAndRecoverSwaps(),
}));

jest.mock('../../services/cashu/cashuMintQuoteRecovery', () => ({
  recoverUnclaimedMintQuotes: () => mockRecoverUnclaimedMintQuotes(),
}));

jest.mock('../../services/cashu/cashuTurboRecovery', () => ({
  recoverPendingTurboSend: (...args: unknown[]) => mockRecoverPendingTurboSend(...args),
}));

jest.mock('../../services/vaultSettlementService', () => ({
  refreshPersistedTurboMintSettlementStatus: () => mockRefreshPersistedTurboMintSettlementStatus(),
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

const mockAnalyticsTrack = jest.fn();
jest.mock('../../services/analyticsService', () => ({
  analytics: {
    track: (...args: unknown[]) => mockAnalyticsTrack(...args),
  },
}));

jest.mock('../WalletContext', () => ({
  useWallet: () => ({ wallet: mockWallet }),
}));

jest.mock('../AuthContext', () => ({
  useAuthSession: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// Create mock functions that can be accessed in tests
const mockSetBalance = jest.fn();
const mockSetError = jest.fn();
const mockFetchBalance = jest.fn();
const mockSetPendingMints = jest.fn();
const mockStartMint = jest.fn();
const mockCheckAndCompleteMint = jest.fn();
const mockRemovePendingMint = jest.fn();
const mockAutoMint = jest.fn();
const mockStartMelt = jest.fn();
const mockFinishMelt = jest.fn();
const mockReceive = jest.fn();
const mockSend = jest.fn();

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
    startMint: mockStartMint,
    checkAndCompleteMint: mockCheckAndCompleteMint,
    removePendingMint: mockRemovePendingMint,
    autoMint: mockAutoMint,
    setPendingMints: mockSetPendingMints,
  }),
}));

jest.mock('../../hooks/useCashuMelt', () => ({
  useCashuMelt: () => ({
    startMelt: mockStartMelt,
    finishMelt: mockFinishMelt,
  }),
}));

jest.mock('../../hooks/useCashuSendReceive', () => ({
  useCashuSendReceive: () => ({
    receive: mockReceive,
    send: mockSend,
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
    mockWallet = { address: 'tb1ptest' };
    mockIsAuthenticated = true;
    mockAppStateHandler = null;
    mockPendingMints = [];
    mockFetchBalance.mockResolvedValue(undefined);
    mockStartMint.mockResolvedValue({ quote: 'mint-quote' });
    mockCheckAndCompleteMint.mockResolvedValue({ completed: false });
    mockAutoMint.mockResolvedValue({ quote: 'auto-mint-quote' });
    mockStartMelt.mockResolvedValue({ quote: 'melt-quote' });
    mockFinishMelt.mockResolvedValue({ paid: true });
    mockReceive.mockResolvedValue({ amount: 100 });
    mockSend.mockResolvedValue({ token: 'cashu-token' });
    mockRefreshPersistedTurboMintSettlementStatus.mockResolvedValue({
      status: 'idle',
      message: 'No persisted TurboUNIT mint settlement is available to refresh.',
    });
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
      mockRefreshPersistedTurboMintSettlementStatus.mockResolvedValue({
        status: 'idle',
        message: 'No persisted TurboUNIT mint settlement is available to refresh.',
      });
      mockFetchBalance.mockResolvedValue(undefined);
    });

    it('should run recovery on startup when wallet has taprootAddress', async () => {
      mockWallet = { address: 'tb1ptest', taprootAddress: 'tb1ptest123' };
      mockRecoverUnclaimedMintQuotes.mockResolvedValue({
        recovered: 1,
        totalAmountRecovered: 250,
      });
      mockRecoverPendingTurboSend.mockResolvedValue({
        recovered: true,
        recipient: 'tb1precoveredrecipient',
        amount: 250,
        token: 'cashu-token',
      });

      act(() => {
        create(
          <CashuProvider>
            <div>Test</div>
          </CashuProvider>
        );
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockRunAfterInteractions).toHaveBeenCalled();
      expect(mockCheckAndRecoverSwaps).toHaveBeenCalled();
      expect(mockRecoverUnclaimedMintQuotes).toHaveBeenCalled();
      expect(mockRefreshPersistedTurboMintSettlementStatus).toHaveBeenCalled();
      expect(mockRecoverPendingTurboSend).toHaveBeenCalled();
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should check TurboUNIT mint recovery when the app returns active after lock', async () => {
      mockWallet = { address: 'tb1ptest', taprootAddress: 'tb1ptest123' };

      act(() => {
        create(
          <CashuProvider>
            <div>Test</div>
          </CashuProvider>
        );
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      mockRecoverUnclaimedMintQuotes.mockClear();
      mockRefreshPersistedTurboMintSettlementStatus.mockClear();
      mockFetchBalance.mockClear();
      mockRefreshPersistedTurboMintSettlementStatus.mockResolvedValueOnce({
        status: 'settled',
        message: 'TurboUNIT mint completed.',
        lastStatus: 'ISSUED',
      });

      await act(async () => {
        mockAppStateHandler?.('background');
        mockAppStateHandler?.('active');
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockRecoverUnclaimedMintQuotes).toHaveBeenCalled();
      expect(mockRefreshPersistedTurboMintSettlementStatus).toHaveBeenCalled();
      expect(mockFetchBalance).toHaveBeenCalled();
    });

    it('should not run startup recovery without an authenticated taproot wallet', async () => {
      mockWallet = null;
      mockIsAuthenticated = false;

      act(() => {
        create(
          <CashuProvider>
            <div>Test</div>
          </CashuProvider>
        );
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockRunAfterInteractions).not.toHaveBeenCalled();
      expect(mockCheckAndRecoverSwaps).not.toHaveBeenCalled();
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
      expect(mockRefreshPersistedTurboMintSettlementStatus).toHaveBeenCalled();
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

  describe('tracked operation wrappers', () => {
    it('tracks mint, receive, send, and melt operations', async () => {
      mockCheckAndCompleteMint.mockResolvedValue({ completed: true, amount: 123 });
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
        await contextValue!.startMint(100);
        await contextValue!.checkAndCompleteMint('quote-1');
        await contextValue!.receive('cashu-token');
        await contextValue!.send(50);
        await contextValue!.startMelt('tb1qdest', 25);
        await contextValue!.finishMelt('melt-quote', 30);
      });

      expect(mockStartMint).toHaveBeenCalledWith(100);
      expect(mockCheckAndCompleteMint).toHaveBeenCalledWith('quote-1');
      expect(mockReceive).toHaveBeenCalledWith('cashu-token');
      expect(mockSend).toHaveBeenCalledWith(50);
      expect(mockStartMelt).toHaveBeenCalledWith('tb1qdest', 25);
      expect(mockFinishMelt).toHaveBeenCalledWith('melt-quote', 30);
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_mint_started', { amount: 100 });
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_mint_completed', { amount: 123 });
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_token_received');
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_token_sent', { amount: 50 });
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_melt_started', { amount: 25 });
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('cashu_melt_completed', { amount: 30 });
    });

    it('does not track mint completion when quote polling remains incomplete', async () => {
      mockCheckAndCompleteMint.mockResolvedValue({ completed: false, amount: 123 });
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
        await contextValue!.checkAndCompleteMint('quote-2');
      });

      expect(mockAnalyticsTrack).not.toHaveBeenCalledWith('cashu_mint_completed', expect.anything());
    });
  });
});
