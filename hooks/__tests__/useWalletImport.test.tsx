/**
 * Tests for useWalletImport Hook
 * Validates wallet import from existing seed phrase
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useWalletImport } from '../useWalletImport';
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
function renderHook<T>(hook: (props?: unknown) => T, { initialProps }: { initialProps?: unknown } = {}) {
  const result: { current: T | null } = { current: null };
  function TestComponent({ hookProps }: { hookProps?: unknown }) {
    result.current = hook(hookProps);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps?: unknown) => {
      act(() => {
        component?.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component?.unmount(),
  };
}

describe('useWalletImport', () => {
  let mockProps: { currentAccount: number; setSettingUpPin: jest.Mock; loadWallet?: null | jest.Mock; [key: string]: unknown };
  const mockAddresses = {
    address: 'tb1qtest',
    segwitAddress: 'tb1qsegwit',
    taprootAddress: 'tb1ptaproot',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (WalletService.importWallet as jest.Mock).mockResolvedValue({ addresses: mockAddresses });
    (WalletService.saveWalletToStorage as jest.Mock).mockResolvedValue(undefined);

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

      expect(result.current!.importingWallet).toBe(false);
    });

    it('should initialize with empty seed phrase array', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.importSeedPhrase).toEqual(Array(12).fill(''));
    });

    it('should not restore import state from AsyncStorage on mount', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.importingWallet).toBe(false);
      expect(result.current!.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current!.isImportedWallet).toBe(false);
    });

    it('should start from clean defaults without persisted state hydration', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current!.importingWallet).toBe(false);
      expect(result.current!.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current!.isImportedWallet).toBe(false);
    });

    it('should expose importedMnemonic only after successful import', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current!.importedMnemonic).toBeNull();

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(result.current!.importedMnemonic).toBe(seedPhrase.join(' '));
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
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      // Import should succeed
      expect(notify.error).not.toHaveBeenCalled();
      expect(WalletService.importWallet).toHaveBeenCalledWith(
        seedPhrase.join(' '),
        mockProps.currentAccount
      );
      expect(WalletService.saveWalletToStorage).not.toHaveBeenCalled();
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
        result.current!.setImportSeedPhrase(seedPhraseWithSpaces);
      });

      await act(async () => {
        await result.current!.importWallet();
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
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(result.current!.isImportedWallet).toBe(true);
    });

    it('should clear import form on success', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current!.setImportingWallet(true);
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(result.current!.importingWallet).toBe(false);
      expect(result.current!.importSeedPhrase).toEqual(Array(12).fill(''));
    });

    it('should keep imported mnemonic in memory until PIN setup completes', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(result.current!.importedMnemonic).toBe(seedPhrase.join(' '));
    });

    it('should handle import errors', async () => {
      (WalletService.importWallet as jest.Mock).mockRejectedValue(new Error('Invalid mnemonic'));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('invalid');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(notify.error).toHaveBeenCalled();
      expect(mockProps.setSettingUpPin).not.toHaveBeenCalled();
    });

    it('should not clear form on import error', async () => {
      (WalletService.importWallet as jest.Mock).mockRejectedValue(new Error('Invalid mnemonic'));

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('invalid');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(result.current!.importSeedPhrase).toEqual(seedPhrase);
    });

    it('should prevent double-click by returning early when isImporting is true', async () => {
      // Make importWallet take a long time
      (WalletService.importWallet as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ addresses: mockAddresses }), 100))
      );

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      // Start first import (don't await)
      let firstPromise: Promise<void> | undefined;
      act(() => {
        firstPromise = result.current!.importWallet();
      });

      // Give React a chance to update state
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Verify isImporting is true
      expect(result.current!.isImporting).toBe(true);

      // Try second import while first is still running
      await act(async () => {
        await result.current!.importWallet();
      });

      // Should only call importWallet once (the second call returns early)
      expect(WalletService.importWallet).toHaveBeenCalledTimes(1);

      // Wait for first promise to finish
      await act(async () => {
        await firstPromise;
      });
    });

    it('should handle non-Error thrown during import', async () => {
      (WalletService.importWallet as jest.Mock).mockRejectedValue('string error');

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('test');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      expect(notify.error).toHaveBeenCalled();
      expect(result.current!.isImporting).toBe(false);
    });

    it('should work without loadWallet callback', async () => {
      mockProps.loadWallet = null;

      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const seedPhrase = Array(12).fill('abandon');

      act(() => {
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
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
        result.current!.setImportingWallet(true);
        result.current!.setImportSeedPhrase(Array(12).fill('test'));
        result.current!.setIsImportedWallet(true);
      });

      await act(async () => {
        await result.current!.resetImportState();
      });

      expect(result.current!.importingWallet).toBe(false);
      expect(result.current!.importSeedPhrase).toEqual(Array(12).fill(''));
      expect(result.current!.isImportedWallet).toBe(false);
    });

    it('should clear imported mnemonic', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current!.setImportedMnemonic('abandon '.repeat(11) + 'about');
      });

      await act(async () => {
        await result.current!.resetImportState();
      });

      expect(result.current!.importedMnemonic).toBeNull();
    });
  });

  describe('Persist Imported Wallet', () => {
    it('should save the imported wallet only after PIN setup completes', async () => {
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
        result.current!.setImportSeedPhrase(seedPhrase);
      });

      await act(async () => {
        await result.current!.importWallet();
      });

      await act(async () => {
        await result.current!.persistImportedWallet();
      });

      expect(WalletService.saveWalletToStorage).toHaveBeenCalledWith(
        seedPhrase.join(' '),
        mockProps.currentAccount
      );
    });

    it('should throw if persistImportedWallet is called before import completes', async () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      await expect(result.current!.persistImportedWallet()).rejects.toThrow(
        'Imported mnemonic not available'
      );
    });
  });

  describe('Seed Input Refs', () => {
    it('should provide seed input refs array', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current!.seedInputRefs).toBeDefined();
      expect(result.current!.seedInputRefs.current).toEqual([]);
    });
  });

  describe('Setters', () => {
    it('should allow setting importingWallet', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current!.setImportingWallet(true);
      });

      expect(result.current!.importingWallet).toBe(true);
    });

    it('should allow setting importSeedPhrase', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      const newPhrase = ['abandon', 'ability', 'able', '', '', '', '', '', '', '', '', ''];

      act(() => {
        result.current!.setImportSeedPhrase(newPhrase);
      });

      expect(result.current!.importSeedPhrase).toEqual(newPhrase);
    });

    it('should allow setting isImportedWallet', () => {
      const { result } = renderHook(() => useWalletImport(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current!.setIsImportedWallet(true);
      });

      expect(result.current!.isImportedWallet).toBe(true);
    });
  });
});
