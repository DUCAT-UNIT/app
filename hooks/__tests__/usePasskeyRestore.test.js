/**
 * Tests for usePasskeyRestore Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as PasskeyService from '../../services/passkeyService';
import { usePasskeyRestore } from '../usePasskeyRestore';
import { savePin } from '../../services/pinService';
import { saveMnemonic, saveCurrentAccount } from '../../services/secureStorageService';

// Helper to render hooks with react-test-renderer
function renderHook(hook) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component.unmount(),
  };
}

// Mock PasskeyService
jest.mock('../../services/passkeyService');

// Mock pinService and secureStorageService
jest.mock('../../services/pinService', () => ({
  savePin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/secureStorageService', () => ({
  saveMnemonic: jest.fn().mockResolvedValue(undefined),
  saveCurrentAccount: jest.fn().mockResolvedValue(undefined),
}));

describe('usePasskeyRestore', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      showToast: jest.fn(),
      loadWallet: jest.fn().mockResolvedValue(undefined),
      setWalletAddresses: jest.fn(),
    };

    jest.clearAllMocks();
    PasskeyService.isPasskeySupported.mockResolvedValue(true);
    PasskeyService.hasICloudBackup.mockResolvedValue(true);
    PasskeyService.recoverWithPasskey.mockResolvedValue({
      mnemonic: 'test mnemonic phrase',
      addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
    });
    savePin.mockResolvedValue(undefined);
    saveMnemonic.mockResolvedValue(undefined);
    saveCurrentAccount.mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current.restoringWithPasskey).toBe(false);
      expect(result.current.showRestorePinInput).toBe(false);
      expect(result.current.restorePin).toBe('');
      expect(result.current.isRestoring).toBe(false);
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

      expect(typeof result.current.setRestoringWithPasskey).toBe('function');
      expect(typeof result.current.setRestorePin).toBe('function');
      expect(typeof result.current.startPasskeyRestore).toBe('function');
      expect(typeof result.current.restoreWalletWithPasskey).toBe('function');
      expect(typeof result.current.resetPasskeyRestore).toBe('function');
    });
  });

  describe('startPasskeyRestore', () => {
    it('should show PIN input when passkey is supported and backup exists', async () => {
      PasskeyService.isPasskeySupported.mockResolvedValue(true);
      PasskeyService.hasICloudBackup.mockResolvedValue(true);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.startPasskeyRestore();
      });

      expect(PasskeyService.isPasskeySupported).toHaveBeenCalled();
      expect(PasskeyService.hasICloudBackup).toHaveBeenCalled();
      expect(result.current.showRestorePinInput).toBe(true);
    });

    it('should show error when passkeys not supported', async () => {
      PasskeyService.isPasskeySupported.mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.startPasskeyRestore();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Passkeys are not supported on this device',
        'error'
      );
      expect(result.current.showRestorePinInput).toBe(false);
    });

    it('should show error when no iCloud backup exists', async () => {
      PasskeyService.isPasskeySupported.mockResolvedValue(true);
      PasskeyService.hasICloudBackup.mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.startPasskeyRestore();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'No passkey wallet found in iCloud',
        'error'
      );
      expect(result.current.showRestorePinInput).toBe(false);
    });

    it('should handle errors during passkey check', async () => {
      const error = new Error('Passkey check failed');
      PasskeyService.isPasskeySupported.mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.startPasskeyRestore();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Passkey check failed', 'error');
      expect(result.current.showRestorePinInput).toBe(false);
    });

    it('should handle errors without message', async () => {
      PasskeyService.isPasskeySupported.mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.startPasskeyRestore();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Failed to start passkey restore', 'error');
    });
  });

  describe('restoreWalletWithPasskey - Success', () => {
    // Note: Testing full restoration is complex due to dynamic imports
    // The validation and error handling paths are thoroughly tested below

    it('should set isRestoring to true during restoration', async () => {
      let restoreResolve;
      const restorePromise = new Promise((resolve) => {
        restoreResolve = resolve;
      });
      PasskeyService.recoverWithPasskey.mockReturnValue(restorePromise);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current.isRestoring).toBe(false);

      act(() => {
        result.current.restoreWalletWithPasskey('123456');
      });

      expect(result.current.isRestoring).toBe(true);

      await act(async () => {
        restoreResolve({ mnemonic: 'test', addresses: {} });
        await restorePromise;
      });

      expect(result.current.isRestoring).toBe(false);
    });
  });

  describe('restoreWalletWithPasskey - Validation', () => {
    it('should show error when PIN is null', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey(null);
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
      expect(result.current.isRestoring).toBe(false);
    });

    it('should show error when PIN is empty', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is too short', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('12345');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is too long', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('1234567');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(PasskeyService.recoverWithPasskey).not.toHaveBeenCalled();
    });
  });

  describe('restoreWalletWithPasskey - Error Handling', () => {
    it('should handle passkey recovery errors', async () => {
      const error = new Error('Recovery failed');
      PasskeyService.recoverWithPasskey.mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('123456');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Recovery failed', 'error');
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
      expect(mockProps.setWalletAddresses).not.toHaveBeenCalled();
      expect(result.current.isRestoring).toBe(false);
    });

    it('should handle errors without message', async () => {
      PasskeyService.recoverWithPasskey.mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('123456');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to restore wallet with passkey',
        'error'
      );
    });

    it('should reset isRestoring on error', async () => {
      PasskeyService.recoverWithPasskey.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      await act(async () => {
        await result.current.restoreWalletWithPasskey('123456');
      });

      expect(result.current.isRestoring).toBe(false);
    });
  });

  describe('resetPasskeyRestore', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      // First set some state
      await act(async () => {
        await result.current.startPasskeyRestore();
      });
      act(() => {
        result.current.setRestoringWithPasskey(true);
        result.current.setRestorePin('123456');
      });

      expect(result.current.showRestorePinInput).toBe(true);
      expect(result.current.restoringWithPasskey).toBe(true);
      expect(result.current.restorePin).toBe('123456');

      // Reset
      act(() => {
        result.current.resetPasskeyRestore();
      });

      expect(result.current.restoringWithPasskey).toBe(false);
      expect(result.current.showRestorePinInput).toBe(false);
      expect(result.current.restorePin).toBe('');
      expect(result.current.isRestoring).toBe(false);
    });
  });

  describe('State Setters', () => {
    it('should update restoringWithPasskey state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current.restoringWithPasskey).toBe(false);

      act(() => {
        result.current.setRestoringWithPasskey(true);
      });

      expect(result.current.restoringWithPasskey).toBe(true);
    });

    it('should update restorePin state', () => {
      const { result } = renderHook(() => usePasskeyRestore(mockProps));

      expect(result.current.restorePin).toBe('');

      act(() => {
        result.current.setRestorePin('123456');
      });

      expect(result.current.restorePin).toBe('123456');
    });
  });
});
