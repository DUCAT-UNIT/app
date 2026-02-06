/**
 * Tests for usePasskeyRestore Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as PasskeyService from '../../services/passkey';
import { usePasskeyRestore } from '../usePasskeyRestore';
import { savePin } from '../../services/pinService';
import { saveMnemonic, saveCurrentAccount } from '../../services/secureStorageService';
import { notify } from '../../utils/notify';
import type { WalletAddresses } from '../../contexts/WalletContext';

// Helper to render hooks with react-test-renderer
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component?.unmount(),
  };
}

// Mock PasskeyService
jest.mock('../../services/passkey');

// Mock pinService and secureStorageService
jest.mock('../../services/pinService', () => ({
  savePin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/secureStorageService', () => ({
  saveMnemonic: jest.fn().mockResolvedValue(undefined),
  saveCurrentAccount: jest.fn().mockResolvedValue(undefined),
}));

describe('usePasskeyRestore', () => {
  let mockProps: {
    setIsAuthenticated: jest.Mock;
    setSeedConfirmed: jest.Mock;
    loadWallet: jest.Mock;
    setWalletAddresses: jest.Mock<void, [WalletAddresses, number]>;
  };

  beforeEach(() => {
    mockProps = {
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      loadWallet: jest.fn().mockResolvedValue(undefined),
      setWalletAddresses: jest.fn(),
    };

    jest.clearAllMocks();
    (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(true);
    (PasskeyService.hasICloudBackup as jest.Mock).mockResolvedValue(true);
    (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
      mnemonic: 'test mnemonic phrase',
      addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
    });
    (savePin as jest.Mock).mockResolvedValue(undefined);
    (saveMnemonic as jest.Mock).mockResolvedValue(undefined);
    (saveCurrentAccount as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current!.restoringWithPasskey).toBe(false);
      expect(result.current!.showRestorePinInput).toBe(false);
      expect(result.current!.restorePin).toBe('');
      expect(result.current!.isRestoring).toBe(false);
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current).toHaveProperty('restoringWithPasskey');
      expect(result.current).toHaveProperty('showRestorePinInput');
      expect(result.current).toHaveProperty('restorePin');
      expect(result.current).toHaveProperty('isRestoring');
      expect(result.current).toHaveProperty('setRestoringWithPasskey');
      expect(result.current).toHaveProperty('setRestorePin');
      expect(result.current).toHaveProperty('startPasskeyRestore');
      expect(result.current).toHaveProperty('restoreWalletWithPasskey');
      expect(result.current).toHaveProperty('resetPasskeyRestore');

      expect(typeof result.current!.setRestoringWithPasskey).toBe('function');
      expect(typeof result.current!.setRestorePin).toBe('function');
      expect(typeof result.current!.startPasskeyRestore).toBe('function');
      expect(typeof result.current!.restoreWalletWithPasskey).toBe('function');
      expect(typeof result.current!.resetPasskeyRestore).toBe('function');
    });
  });

  describe('startPasskeyRestore', () => {
    it('should show PIN input when passkey is supported and backup exists', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(true);
      (PasskeyService.hasICloudBackup as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(PasskeyService.isPasskeySupported).toHaveBeenCalled();
      expect(PasskeyService.hasICloudBackup).toHaveBeenCalled();
      expect(result.current!.showRestorePinInput).toBe(true);
    });

    it('should show error when passkeys not supported', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(notify.passkey.notSupported).toHaveBeenCalled();
      expect(result.current!.showRestorePinInput).toBe(false);
    });

    it('should show error when no iCloud backup exists', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(true);
      (PasskeyService.hasICloudBackup as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(notify.passkey.noWallet).toHaveBeenCalled();
      expect(result.current!.showRestorePinInput).toBe(false);
    });

    it('should handle errors during passkey check', async () => {
      const error = new Error('Passkey check failed');
      (PasskeyService.isPasskeySupported as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(notify.passkey.restoreFailed).toHaveBeenCalled();
      expect(result.current!.showRestorePinInput).toBe(false);
    });

    it('should handle errors without message', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(notify.passkey.restoreFailed).toHaveBeenCalled();
    });
  });

  describe('restoreWalletWithPasskey - Success', () => {
    // Note: Testing full restoration is complex due to dynamic imports
    // The validation and error handling paths are thoroughly tested below

    it('should set isRestoring to true during restoration', async () => {
      let restoreResolve: (value: unknown) => void;
      const restorePromise = new Promise((resolve) => {
        restoreResolve = resolve;
      });
      (PasskeyService.recoverWithPasskey as jest.Mock).mockReturnValue(restorePromise);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current!.isRestoring).toBe(false);

      act(() => {
        result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.isRestoring).toBe(true);

      await act(async () => {
        restoreResolve({ mnemonic: 'test', addresses: {} });
        await restorePromise;
      });

      expect(result.current!.isRestoring).toBe(false);
    });
  });

  describe('restoreWalletWithPasskey - Validation', () => {
    it('should show error when PIN is null', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey(null as unknown as string);
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
      expect(result.current!.isRestoring).toBe(false);
    });

    it('should show error when PIN is empty', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is too short', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('12345');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is too long', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('1234567');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });
  });

  describe('restoreWalletWithPasskey - Error Handling', () => {
    it('should handle passkey recovery errors', async () => {
      const error = new Error('Recovery failed');
      (PasskeyService.recoverWithPasskey as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(notify.passkey.walletRestoreFailed).toHaveBeenCalled();
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
      expect(mockProps.setWalletAddresses).not.toHaveBeenCalled();
      expect(result.current!.isRestoring).toBe(false);
    });

    it('should handle errors without message', async () => {
      (PasskeyService.recoverWithPasskey as jest.Mock).mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(notify.passkey.walletRestoreFailed).toHaveBeenCalled();
    });

    it('should reset isRestoring on error', async () => {
      (PasskeyService.recoverWithPasskey as jest.Mock).mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.isRestoring).toBe(false);
    });
  });

  describe('resetPasskeyRestore', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // First set some state
      await act(async () => {
        await result.current!.startPasskeyRestore();
      });
      act(() => {
        result.current!.setRestoringWithPasskey(true);
        result.current!.setRestorePin('123456');
      });

      expect(result.current!.showRestorePinInput).toBe(true);
      expect(result.current!.restoringWithPasskey).toBe(true);
      expect(result.current!.restorePin).toBe('123456');

      // Reset
      act(() => {
        result.current!.resetPasskeyRestore();
      });

      expect(result.current!.restoringWithPasskey).toBe(false);
      expect(result.current!.showRestorePinInput).toBe(false);
      expect(result.current!.restorePin).toBe('');
      expect(result.current!.isRestoring).toBe(false);
    });
  });

  describe('State Setters', () => {
    it('should update restoringWithPasskey state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current!.restoringWithPasskey).toBe(false);

      act(() => {
        result.current!.setRestoringWithPasskey(true);
      });

      expect(result.current!.restoringWithPasskey).toBe(true);
    });

    it('should update restorePin state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current!.restorePin).toBe('');

      act(() => {
        result.current!.setRestorePin('123456');
      });

      expect(result.current!.restorePin).toBe('123456');
    });
  });

  describe('restoreWalletWithPasskey - Success Path', () => {
    it('should successfully restore wallet with passkey and valid PIN', async () => {
      const mockMnemonic = 'test mnemonic phrase with twelve words for wallet recovery success';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      // Should call recovery service
      expect(PasskeyService.recoverWithPasskey).toHaveBeenCalledWith('123456');

      // Should save mnemonic
      expect(saveMnemonic).toHaveBeenCalledWith(mockMnemonic);

      // Should save account
      expect(saveCurrentAccount).toHaveBeenCalledWith(0);

      // Should save PIN
      expect(savePin).toHaveBeenCalledWith('123456');

      // Should set wallet addresses
      expect(mockProps.setWalletAddresses).toHaveBeenCalledWith(mockAddresses, 0);

      // Should authenticate
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(true);

      // Should show success toast
      expect(notify.passkey.restored).toHaveBeenCalled();

      // Should reset state
      expect(result.current!.showRestorePinInput).toBe(false);
      expect(result.current!.restorePin).toBe('');
      expect(result.current!.restoringWithPasskey).toBe(false);
      expect(result.current!.isRestoring).toBe(false);
    });

    it('should set isRestoring to false after successful restoration', async () => {
      const mockMnemonic = 'test mnemonic phrase';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.isRestoring).toBe(false);
    });

    it('should handle restoration with different PIN formats', async () => {
      const mockMnemonic = 'test mnemonic phrase';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // Try with numeric string
      await act(async () => {
        await result.current!.restoreWalletWithPasskey('000000');
      });

      expect(savePin).toHaveBeenCalledWith('000000');
    });
  });

  describe('restoreWalletWithPasskey - State Management', () => {
    it('should hide PIN input immediately after successful restore', async () => {
      const mockMnemonic = 'test mnemonic phrase';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // Show PIN input first
      await act(async () => {
        await result.current!.startPasskeyRestore();
      });

      expect(result.current!.showRestorePinInput).toBe(true);

      // Restore wallet
      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.showRestorePinInput).toBe(false);
    });

    it('should clear restore PIN after successful restore', async () => {
      const mockMnemonic = 'test mnemonic phrase';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // Set PIN
      act(() => {
        result.current!.setRestorePin('123456');
      });

      expect(result.current!.restorePin).toBe('123456');

      // Restore wallet
      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.restorePin).toBe('');
    });

    it('should set restoringWithPasskey to false after successful restore', async () => {
      const mockMnemonic = 'test mnemonic phrase';
      const mockAddresses = {
        segwitAddress: 'bc1qtest',
        taprootAddress: 'bc1ptest',
      };

      (PasskeyService.recoverWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: mockMnemonic,
        addresses: mockAddresses,
      });

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // Set restoringWithPasskey
      act(() => {
        result.current!.setRestoringWithPasskey(true);
      });

      expect(result.current!.restoringWithPasskey).toBe(true);

      // Restore wallet
      await act(async () => {
        await result.current!.restoreWalletWithPasskey('123456');
      });

      expect(result.current!.restoringWithPasskey).toBe(false);
    });
  });
});
