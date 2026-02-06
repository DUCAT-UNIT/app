/**
 * Tests for useOnboardingHandlers hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useOnboardingHandlers } from '../useOnboardingHandlers';
import { notify } from '../../utils/notify';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to render hooks with props
function renderHookWithProps(props: Record<string, unknown>) {
  const result: { current: ReturnType<typeof useOnboardingHandlers> | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps: Record<string, unknown> }) {
    result.current = useOnboardingHandlers(hookProps as unknown as Parameters<typeof useOnboardingHandlers>[0]);
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
        component?.update(<TestComponent hookProps={newProps as Record<string, unknown>} />);
      });
    },
  };
}

describe('useOnboardingHandlers', () => {
  let mockProps: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      setIsImportedWallet: jest.fn(),
      setImportedMnemonic: jest.fn(),
      setShowingIntro: jest.fn(),
      setShowingSeeds: jest.fn(),
      setImportingWallet: jest.fn(),
      setImportSeedPhrase: jest.fn(),
      setVerificationWords: jest.fn(),
      saveWalletAfterPinSetup: jest.fn().mockResolvedValue(true),
      loadWallet: jest.fn().mockResolvedValue({
        exists: true,
        addresses: {
          segwitAddress: 'bc1q...',
          taprootAddress: 'tb1p...',
        },
      }),
      handlePinSetupCompleteWrapper: jest.fn().mockResolvedValue(undefined),
      handlePinChangeCompleteWrapper: jest.fn(),
      resetWalletAndState: jest.fn().mockResolvedValue(undefined),
      fetchBalance: jest.fn().mockResolvedValue(undefined),
      fetchTransactionHistory: jest.fn().mockResolvedValue(undefined),
      showPasskeyMigrationPromptGlobal: jest.fn(),
      isImportedWallet: false,
      importedMnemonic: null,
    };
  });

  it('should return handler functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current!.handlePinSetupComplete).toBe('function');
    expect(typeof result.current!.handlePinChangeComplete).toBe('function');
    expect(typeof result.current!.handleCancelOnboarding).toBe('function');
  });

  describe('handlePinSetupComplete', () => {
    it('should save wallet for new wallet creation', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: false,
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      expect(mockProps.saveWalletAfterPinSetup).toHaveBeenCalled();
      expect(mockProps.handlePinSetupCompleteWrapper).toHaveBeenCalled();
    });

    it('should show toast if save fails', async () => {
      (mockProps.saveWalletAfterPinSetup as jest.Mock).mockResolvedValue(false);

      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: false,
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      expect(notify.wallet.saveFailed).toHaveBeenCalled();
      expect(mockProps.handlePinSetupCompleteWrapper).not.toHaveBeenCalled();
    });

    it('should handle imported wallet flow', async () => {
      jest.useFakeTimers();

      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: true,
        importedMnemonic: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      expect(mockProps.setIsImportedWallet).toHaveBeenCalledWith(false);
      expect(mockProps.loadWallet).toHaveBeenCalled();
      expect(mockProps.handlePinSetupCompleteWrapper).toHaveBeenCalled();
      expect(mockProps.fetchBalance).toHaveBeenCalledWith('bc1q...', 'tb1p...');
      expect(mockProps.fetchTransactionHistory).toHaveBeenCalled();
      expect(mockProps.setImportedMnemonic).toHaveBeenCalledWith(null);

      // Check passkey migration prompt is scheduled
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      expect(mockProps.showPasskeyMigrationPromptGlobal).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not save wallet for imported wallet', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: true,
        importedMnemonic: 'word1 word2...',
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      expect(mockProps.saveWalletAfterPinSetup).not.toHaveBeenCalled();
    });

    it('should handle missing fetchBalance gracefully', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: true,
        importedMnemonic: 'word1 word2...',
        fetchBalance: null,
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      // Should not throw
      expect(mockProps.handlePinSetupCompleteWrapper).toHaveBeenCalled();
    });

    it('should handle missing fetchTransactionHistory gracefully', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: true,
        importedMnemonic: 'word1 word2...',
        fetchTransactionHistory: null,
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      // Should not throw
      expect(mockProps.handlePinSetupCompleteWrapper).toHaveBeenCalled();
    });

    it('should handle wallet not existing after import', async () => {
      (mockProps.loadWallet as jest.Mock).mockResolvedValue({
        exists: false,
        addresses: null,
      });

      const { result } = renderHookWithProps({
        ...mockProps,
        isImportedWallet: true,
        importedMnemonic: 'word1 word2...',
      });

      await act(async () => {
        await result.current!.handlePinSetupComplete('1234');
      });

      expect(mockProps.fetchBalance).not.toHaveBeenCalled();
      expect(mockProps.fetchTransactionHistory).not.toHaveBeenCalled();
    });
  });

  describe('handlePinChangeComplete', () => {
    it('should call wrapper and reset imported state', () => {
      const { result } = renderHookWithProps(mockProps);

      act(() => {
        result.current!.handlePinChangeComplete();
      });

      expect(mockProps.handlePinChangeCompleteWrapper).toHaveBeenCalled();
      expect(mockProps.setIsImportedWallet).toHaveBeenCalledWith(false);
    });
  });

  describe('handleCancelOnboarding', () => {
    it('should reset all onboarding state', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current!.handleCancelOnboarding();
      });

      expect(mockProps.setShowingIntro).toHaveBeenCalledWith(false);
      expect(mockProps.setShowingSeeds).toHaveBeenCalledWith(false);
      expect(mockProps.setImportingWallet).toHaveBeenCalledWith(false);
      expect(mockProps.setImportSeedPhrase).toHaveBeenCalledWith(Array(12).fill(''));
      expect(mockProps.setVerificationWords).toHaveBeenCalledWith({});
      expect(mockProps.setIsImportedWallet).toHaveBeenCalledWith(false);
      expect(mockProps.resetWalletAndState).toHaveBeenCalled();
    });
  });
});
