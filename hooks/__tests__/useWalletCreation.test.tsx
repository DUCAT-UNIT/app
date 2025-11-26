// @ts-nocheck
/**
 * Tests for useWalletCreation Hook
 * Validates new wallet creation flow including mnemonic generation and secure storage
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletCreation } from '../useWalletCreation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WalletService from '../../services/walletService';

// Mock wallet service
jest.mock('../../services/walletService');

// Mock wallet context
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    setWalletAddresses: jest.fn(),
    resetWallet: jest.fn(),
  }),
}));

// Mock error parser
jest.mock('../../utils/errorParser', () => ({
  parseErrorMessage: jest.fn((error) => error.message || 'Unknown error'),
}));

// Use fake timers for setTimeout
jest.useFakeTimers();

// Helper to render hooks with props
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useWalletCreation', () => {
  let mockProps;
  const mockMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
  const mockAddresses = {
    address: 'tb1qtest',
    segwitAddress: 'tb1qsegwit',
    taprootAddress: 'tb1ptaproot',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    AsyncStorage.removeItem.mockResolvedValue();
    WalletService.generateWallet.mockResolvedValue({
      mnemonic: mockMnemonic,
      addresses: mockAddresses,
    });
    WalletService.saveWalletToStorage.mockResolvedValue();

    mockProps = {
      currentAccount: 0,
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      showToast: jest.fn(),
      loadWallet: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should start with empty mnemonic words', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual([]);
    });

    it('should start with intro and seeds hidden', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.showingIntro).toBe(false);
      expect(result.current.showingSeeds).toBe(false);
    });

    it('should load persisted state on mount', async () => {
      const savedState = {
        tempMnemonicWords: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'],
        tempMnemonic: mockMnemonic,
        showingIntro: true,
        showingSeeds: false,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual(savedState.tempMnemonicWords);
      expect(result.current.showingIntro).toBe(true);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual([]);
    });

    it('should load partial persisted state', async () => {
      // Only tempMnemonicWords is present, other fields missing
      const savedState = {
        tempMnemonicWords: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'],
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual(savedState.tempMnemonicWords);
      expect(result.current.showingIntro).toBe(false);
      expect(result.current.showingSeeds).toBe(false);
    });

    it('should handle persisted state with undefined values', async () => {
      // State with undefined values
      const savedState = {
        tempMnemonicWords: null,
        tempMnemonic: null,
        showingIntro: undefined,
        showingSeeds: undefined,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Should not set values when they are null/undefined
      expect(result.current.tempMnemonicWords).toEqual([]);
      expect(result.current.showingIntro).toBe(false);
      expect(result.current.showingSeeds).toBe(false);
    });

    it('should handle persisted state with false values', async () => {
      // State with explicit false values (should be loaded)
      const savedState = {
        tempMnemonicWords: ['test', 'words'],
        tempMnemonic: 'test mnemonic',
        showingIntro: false,
        showingSeeds: false,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual(savedState.tempMnemonicWords);
      expect(result.current.showingIntro).toBe(false);
      expect(result.current.showingSeeds).toBe(false);
    });
  });

  describe('Create Wallet', () => {
    it('should generate wallet with mnemonic and addresses', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(WalletService.generateWallet).toHaveBeenCalledWith(mockProps.currentAccount);
      expect(result.current.tempMnemonicWords).toEqual(mockMnemonic.split(' '));
    });

    it('should show intro screen after creation', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.showingIntro).toBe(true);
      expect(result.current.showingSeeds).toBe(false);
    });

    it('should authenticate user after wallet creation', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
    });

    it('should mark seed as not confirmed initially', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(false);
    });

    it('should set walletExistsRef to false initially', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.walletExistsRef.current).toBe(false);
    });

    it('should handle wallet generation errors', async () => {
      WalletService.generateWallet.mockRejectedValue(new Error('Generation failed'));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Generation failed', 'error');
    });

    it('should not save wallet to storage immediately', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(WalletService.saveWalletToStorage).not.toHaveBeenCalled();
    });
  });

  describe('Save Wallet After PIN Setup', () => {
    it('should save wallet to storage', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        const success = await result.current.saveWalletAfterPinSetup();
        expect(success).toBe(true);
      });

      expect(WalletService.saveWalletToStorage).toHaveBeenCalledWith(
        mockMnemonic,
        mockProps.currentAccount
      );
    });

    it('should load wallet into context', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        await result.current.saveWalletAfterPinSetup();
      });

      expect(mockProps.loadWallet).toHaveBeenCalled();
    });

    it('should mark wallet as truly existing', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.walletExistsRef.current).toBe(false);

      await act(async () => {
        await result.current.saveWalletAfterPinSetup();
      });

      expect(result.current.walletExistsRef.current).toBe(true);
    });

    it('should securely clear temporary mnemonic', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.tempMnemonicWords.length).toBe(12);

      await act(async () => {
        await result.current.saveWalletAfterPinSetup();
      });

      // Should be asterisks initially
      expect(result.current.tempMnemonicWords.every(w => w.includes('*'))).toBe(true);

      // After timeout, should be empty
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual([]);
    });

    it('should clear persisted state', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        await result.current.saveWalletAfterPinSetup();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_creation_state');
    });

    it('should return false if no temp mnemonic', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        const success = await result.current.saveWalletAfterPinSetup();
        expect(success).toBe(false);
      });

      expect(WalletService.saveWalletToStorage).not.toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      WalletService.saveWalletToStorage.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        const success = await result.current.saveWalletAfterPinSetup();
        expect(success).toBe(false);
      });
    });

    it('should work without loadWallet callback', async () => {
      mockProps.loadWallet = null;

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        const success = await result.current.saveWalletAfterPinSetup();
        expect(success).toBe(true);
      });
    });
  });

  describe('Reset Creation State', () => {
    it('should reset all creation state', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.showingIntro).toBe(true);

      await act(async () => {
        await result.current.resetCreationState();
      });

      expect(result.current.showingIntro).toBe(false);
      expect(result.current.showingSeeds).toBe(false);
      expect(result.current.walletExistsRef.current).toBe(false);
    });

    it('should securely clear mnemonic', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        await result.current.resetCreationState();
      });

      // Should be asterisks initially
      expect(result.current.tempMnemonicWords.every(w => w.includes('*'))).toBe(true);

      // After timeout, should be empty
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.tempMnemonicWords).toEqual([]);
    });

    it('should clear persisted state', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.resetCreationState();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_creation_state');
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes to AsyncStorage', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'wallet_creation_state',
        expect.any(String)
      );
    });

  });

  describe('Setters', () => {
    it('should allow setting showingIntro', () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowingIntro(true);
      });

      expect(result.current.showingIntro).toBe(true);
    });

    it('should allow setting showingSeeds', () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowingSeeds(true);
      });

      expect(result.current.showingSeeds).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle wallet generation returning null', async () => {
      WalletService.generateWallet.mockResolvedValue(null);

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      // Should handle gracefully
      expect(result.current).toBeDefined();
    });

    it('should handle missing addresses', async () => {
      WalletService.generateWallet.mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: null,
      });

      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.tempMnemonicWords).toEqual(mockMnemonic.split(' '));
    });

    it('should handle multiple create wallet calls', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      const firstMnemonic = result.current.tempMnemonicWords;

      await act(async () => {
        await result.current.createWallet();
      });

      expect(result.current.tempMnemonicWords).toEqual(firstMnemonic);
    });
  });

  describe('Wallet Exists Ref', () => {
    it('should provide walletExistsRef', () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current.walletExistsRef).toBeDefined();
      expect(result.current.walletExistsRef.current).toBe(false);
    });

    it('should update walletExistsRef after saving', async () => {
      const { result } = renderHook(() => useWalletCreation(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.createWallet();
      });

      await act(async () => {
        await result.current.saveWalletAfterPinSetup();
      });

      expect(result.current.walletExistsRef.current).toBe(true);
    });
  });
});
