// @ts-nocheck
/**
 * Tests for useWalletImport Hook
 * Validates wallet import from existing seed phrase
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletImport } from '../useWalletImport';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WalletService from '../../services/walletService';
import { notify } from '../../utils/notify';

// Mock wallet service
jest.mock('../../services/walletService');

// Mock expo-secure-store (needs both default export and named exports for dynamic import)
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  default: {
    setItemAsync: jest.fn().mockResolvedValue(undefined),
  },
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock wallet context (no longer needed but kept for consistency)

// Mock constants
jest.mock('../../utils/constants', () => ({
  SECURE_KEYS: {
    CURRENT_ACCOUNT: 'wallet_current_account_v1',
  },
}));

// Mock messages
jest.mock('../../utils/messages', () => ({
  ERRORS: {
    WALLET_IMPORT_FAILED: 'Failed to import wallet',
  },
}));

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

describe('useWalletImport', () => {
  let mockProps;
  const mockAddresses = {
    address: 'tb1qtest',
    segwitAddress: 'tb1qsegwit',
    taprootAddress: 'tb1ptaproot',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    AsyncStorage.removeItem.mockResolvedValue();
    WalletService.importWallet.mockResolvedValue({ addresses: mockAddresses });
    WalletService.saveWalletToStorage.mockResolvedValue();

    mockProps = {
      currentAccount: 0,
      setSettingUpPin: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should start with importing wallet false', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importingWallet).toBe(false);
    });

    it('should initialize with empty seed phrase array', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importSeedPhrase).toEqual(Array(12).fill(''));
    });

    it('should load persisted state on mount', async () => {
      const savedState = {
        importingWallet: true,
        importSeedPhrase: ['abandon', 'ability', 'able', '', '', '', '', '', '', '', '', ''],
        isImportedWallet: false,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importingWallet).toBe(true);
      expect(result.current.importSeedPhrase[0]).toBe('abandon');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importingWallet).toBe(false);
    });

    it('should load partial persisted state', async () => {
      // Only importingWallet is present, other fields missing
      const savedState = {
        importingWallet: true,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importingWallet).toBe(true);
      expect(result.current.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current.isImportedWallet).toBe(false);
    });

    it('should handle persisted state with undefined values', async () => {
      // State with undefined values
      const savedState = {
        importingWallet: undefined,
        importSeedPhrase: null,
        isImportedWallet: undefined,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Should not set values when they are null/undefined
      expect(result.current.importingWallet).toBe(false);
      expect(result.current.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current.isImportedWallet).toBe(false);
    });

    it('should handle persisted state with false values', async () => {
      // State with explicit false values (should be loaded)
      const savedState = {
        importingWallet: false,
        importSeedPhrase: ['test', 'words', '', '', '', '', '', '', '', '', '', ''],
        isImportedWallet: false,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.importingWallet).toBe(false);
      expect(result.current.importSeedPhrase).toEqual(savedState.importSeedPhrase);
      expect(result.current.isImportedWallet).toBe(false);
    });
  });

  describe('Import Wallet', () => {
    it('should import wallet with valid seed phrase', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = [
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'access',
        'accident',
      ];

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      // Import should succeed
      expect(notify.error).not.toHaveBeenCalled();
      expect(WalletService.importWallet).toHaveBeenCalledWith(
        seedPhrase.join(' '),
        mockProps.currentAccount
      );
      expect(WalletService.saveWalletToStorage).toHaveBeenCalledWith(
        seedPhrase.join(' '),
        mockProps.currentAccount
      );
      // loadWallet is intentionally not called during import - it's called after PIN setup
      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
    });

    it('should normalize seed phrase (trim and lowercase)', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhraseWithSpaces = [
        '  ABANDON  ',
        '  ABILITY  ',
        'ABLE',
        'ABOUT',
        'ABOVE',
        'ABSENT',
        'ABSORB',
        'ABSTRACT',
        'ABSURD',
        'ABUSE',
        'ACCESS',
        'ACCIDENT',
      ];

      act(() => {
        result.current.setImportSeedPhrase(seedPhraseWithSpaces);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(WalletService.importWallet).toHaveBeenCalledWith(
        'abandon ability able about above absent absorb abstract absurd abuse access accident',
        mockProps.currentAccount
      );
    });

    it('should set isImportedWallet flag', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(result.current.isImportedWallet).toBe(true);
    });

    it('should clear import form on success', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current.setImportingWallet(true);
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(result.current.importingWallet).toBe(false);
      expect(result.current.importSeedPhrase).toEqual(Array(12).fill(''));
    });

    it('should clear persisted state on success', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_import_state');
    });

    it('should handle import errors', async () => {
      WalletService.importWallet.mockRejectedValue(new Error('Invalid mnemonic'));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('invalid');

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(notify.error).toHaveBeenCalled();
      expect(mockProps.setSettingUpPin).not.toHaveBeenCalled();
    });

    it('should not clear form on import error', async () => {
      WalletService.importWallet.mockRejectedValue(new Error('Invalid mnemonic'));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('invalid');

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(result.current.importSeedPhrase).toEqual(seedPhrase);
    });

    it('should work without loadWallet callback', async () => {
      mockProps.loadWallet = null;

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current.importWallet();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
    });

    // Test removed: Balance fetching is no longer done during import.
    // Wallet addresses are set after PIN setup in OnboardingPage.
  });

  describe('Reset Import State', () => {
    it('should reset all import state', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setImportingWallet(true);
        result.current.setImportSeedPhrase(Array(12).fill('test'));
        result.current.setIsImportedWallet(true);
      });

      await act(async () => {
        await result.current.resetImportState();
      });

      expect(result.current.importingWallet).toBe(false);
      expect(result.current.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current.isImportedWallet).toBe(false);
    });

    it('should clear persisted state', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.resetImportState();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_import_state');
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes to AsyncStorage', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setImportingWallet(true);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('wallet_import_state', expect.any(String));
    });

  });

  describe('Seed Input Refs', () => {
    it('should provide seed input refs array', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current.seedInputRefs).toBeDefined();
      expect(result.current.seedInputRefs.current).toEqual([]);
    });
  });

  describe('Setters', () => {
    it('should allow setting importingWallet', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setImportingWallet(true);
      });

      expect(result.current.importingWallet).toBe(true);
    });

    it('should allow setting importSeedPhrase', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const newPhrase = ['abandon', 'ability', 'able', '', '', '', '', '', '', '', '', ''];

      act(() => {
        result.current.setImportSeedPhrase(newPhrase);
      });

      expect(result.current.importSeedPhrase).toEqual(newPhrase);
    });

    it('should allow setting isImportedWallet', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setIsImportedWallet(true);
      });

      expect(result.current.isImportedWallet).toBe(true);
    });
  });
});
