/**
 * Tests for usePasskeyCreation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as PasskeyService from '../../services/passkeyService';
import { usePasskeyCreation } from '../usePasskeyCreation';

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

// Mock dependencies
jest.mock('expo-device', () => ({
  deviceName: 'iPhone 15',
}));
jest.mock('../../services/passkeyService');

describe('usePasskeyCreation', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      showToast: jest.fn(),
      loadWallet: jest.fn().mockResolvedValue(undefined),
    };

    jest.clearAllMocks();
    PasskeyService.isPasskeySupported.mockResolvedValue(true);
    PasskeyService.createWalletWithPasskey.mockResolvedValue({
      mnemonic: 'test mnemonic phrase',
      addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
      icloudBackupSucceeded: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current.creatingWithPasskey).toBe(false);
      expect(result.current.passkeyMnemonic).toBe(null);
      expect(result.current.passkeyAddresses).toBe(null);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.showPinInput).toBe(false);
      expect(result.current.passkeyPin).toBe('');
      expect(result.current.confirmingPin).toBe(false);
      expect(result.current.passkeyPinConfirm).toBe('');
      expect(result.current.walletExistsRef.current).toBe(false);
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current).toHaveProperty('creatingWithPasskey');
      expect(result.current).toHaveProperty('passkeyMnemonic');
      expect(result.current).toHaveProperty('passkeyAddresses');
      expect(result.current).toHaveProperty('isCreating');
      expect(result.current).toHaveProperty('showPinInput');
      expect(result.current).toHaveProperty('passkeyPin');
      expect(result.current).toHaveProperty('confirmingPin');
      expect(result.current).toHaveProperty('passkeyPinConfirm');
      expect(result.current).toHaveProperty('walletExistsRef');
      expect(result.current).toHaveProperty('setPasskeyPin');
      expect(result.current).toHaveProperty('setPasskeyPinConfirm');
      expect(result.current).toHaveProperty('setShowPinInput');
      expect(result.current).toHaveProperty('startPasskeyCreation');
      expect(result.current).toHaveProperty('handlePinEntry');
      expect(result.current).toHaveProperty('resetPasskeyCreation');

      expect(typeof result.current.setPasskeyPin).toBe('function');
      expect(typeof result.current.setPasskeyPinConfirm).toBe('function');
      expect(typeof result.current.setShowPinInput).toBe('function');
      expect(typeof result.current.startPasskeyCreation).toBe('function');
      expect(typeof result.current.handlePinEntry).toBe('function');
      expect(typeof result.current.resetPasskeyCreation).toBe('function');
    });
  });

  describe('startPasskeyCreation', () => {
    it('should show PIN input when passkeys are supported', async () => {
      PasskeyService.isPasskeySupported.mockResolvedValue(true);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.startPasskeyCreation();
      });

      expect(PasskeyService.isPasskeySupported).toHaveBeenCalled();
      expect(result.current.showPinInput).toBe(true);
      expect(result.current.creatingWithPasskey).toBe(true);
    });

    it('should show error when passkeys are not supported', async () => {
      PasskeyService.isPasskeySupported.mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.startPasskeyCreation();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Passkeys are not supported on this device',
        'error'
      );
      expect(result.current.showPinInput).toBe(false);
      expect(result.current.creatingWithPasskey).toBe(false);
    });

    it('should handle errors during passkey check', async () => {
      const error = new Error('Passkey check failed');
      PasskeyService.isPasskeySupported.mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.startPasskeyCreation();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Passkey check failed', 'error');
      expect(result.current.showPinInput).toBe(false);
    });

    it('should handle errors without message', async () => {
      PasskeyService.isPasskeySupported.mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.startPasskeyCreation();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Failed to start passkey creation', 'error');
    });
  });

  describe('handlePinEntry - Initial PIN', () => {
    it('should move to confirmation when valid PIN is entered', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(result.current.confirmingPin).toBe(true);
      expect(PasskeyService.createWalletWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is null', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry(null);
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(result.current.confirmingPin).toBe(false);
    });

    it('should show error when PIN is empty', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(result.current.confirmingPin).toBe(false);
    });

    it('should show error when PIN is too short', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('12345');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(result.current.confirmingPin).toBe(false);
    });

    it('should show error when PIN is too long', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('1234567');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Please enter a 6-digit PIN', 'error');
      expect(result.current.confirmingPin).toBe(false);
    });
  });

  describe('handlePinEntry - PIN Confirmation', () => {
    it('should create wallet when PINs match', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // Enter initial PIN
      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      expect(result.current.confirmingPin).toBe(true);

      // Set PIN state to match what user entered
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      // Enter confirmation PIN
      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(PasskeyService.createWalletWithPasskey).toHaveBeenCalledWith({
        userName: 'iPhone 15-DUCAT_APP',
        userDisplayName: 'iPhone 15 - Ducat',
        pin: '123456',
      });
      expect(mockProps.loadWallet).toHaveBeenCalled();
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(true);
      expect(mockProps.showToast).toHaveBeenCalledWith('Wallet created with passkey!', 'success');
      expect(result.current.showPinInput).toBe(false);
      expect(result.current.creatingWithPasskey).toBe(false);
      expect(result.current.walletExistsRef.current).toBe(true);
    });

    it('should show error and reset when PINs do not match', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // Enter initial PIN and move to confirm
      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      expect(result.current.confirmingPin).toBe(true);

      // Enter different confirmation PIN
      await act(async () => {
        await result.current.handlePinEntry('654321');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'PINs do not match. Please try again.',
        'error'
      );
      expect(result.current.confirmingPin).toBe(false);
      expect(result.current.passkeyPin).toBe('');
      expect(result.current.passkeyPinConfirm).toBe('');
      expect(PasskeyService.createWalletWithPasskey).not.toHaveBeenCalled();
    });
  });

  describe('createWalletWithPasskey - Success', () => {
    it('should show success message when iCloud backup succeeds', async () => {
      PasskeyService.createWalletWithPasskey.mockResolvedValue({
        mnemonic: 'test',
        addresses: {},
        icloudBackupSucceeded: true,
      });

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Wallet created with passkey!', 'success');
    });

    it('should show warning when iCloud backup fails', async () => {
      // Create a promise that resolves with backup failure
      const backupPromise = Promise.resolve({ success: false, error: 'Backup failed' });

      PasskeyService.createWalletWithPasskey.mockResolvedValue({
        mnemonic: 'test',
        addresses: {},
        icloudBackupPromise: backupPromise,
      });

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      // First should show success toast
      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Wallet created with passkey!',
        'success'
      );

      // Wait for background backup promise to resolve
      await act(async () => {
        await backupPromise;
      });

      // Then should show warning about backup failure
      expect(mockProps.showToast).toHaveBeenCalledWith(
        'iCloud backup failed - restoration may not work on new devices',
        'warning'
      );
    });

    it('should set isCreating to true during creation', async () => {
      let createResolve;
      const createPromise = new Promise((resolve) => {
        createResolve = resolve;
      });
      PasskeyService.createWalletWithPasskey.mockReturnValue(createPromise);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      expect(result.current.isCreating).toBe(false);

      act(() => {
        result.current.handlePinEntry('123456');
      });

      expect(result.current.isCreating).toBe(true);

      await act(async () => {
        createResolve({ mnemonic: 'test', addresses: {}, icloudBackupSucceeded: true });
        await createPromise;
      });

      expect(result.current.isCreating).toBe(false);
    });
  });

  describe('createWalletWithPasskey - Error Handling', () => {
    it('should handle wallet creation errors', async () => {
      const error = new Error('Creation failed');
      PasskeyService.createWalletWithPasskey.mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Creation failed', 'error');
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
      expect(result.current.creatingWithPasskey).toBe(false);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.confirmingPin).toBe(false);
      expect(result.current.passkeyPin).toBe('');
      expect(result.current.passkeyPinConfirm).toBe('');
    });

    it('should handle errors without message', async () => {
      PasskeyService.createWalletWithPasskey.mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });
      act(() => {
        result.current.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to create wallet with passkey',
        'error'
      );
    });
  });

  describe('resetPasskeyCreation', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // First set some state
      await act(async () => {
        await result.current.startPasskeyCreation();
      });
      await act(async () => {
        await result.current.handlePinEntry('123456');
      });

      expect(result.current.creatingWithPasskey).toBe(true);
      expect(result.current.confirmingPin).toBe(true);

      // Reset
      act(() => {
        result.current.resetPasskeyCreation();
      });

      expect(result.current.creatingWithPasskey).toBe(false);
      expect(result.current.passkeyMnemonic).toBe(null);
      expect(result.current.passkeyAddresses).toBe(null);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.showPinInput).toBe(false);
      expect(result.current.passkeyPin).toBe('');
      expect(result.current.confirmingPin).toBe(false);
      expect(result.current.passkeyPinConfirm).toBe('');
    });
  });

  describe('State Setters', () => {
    it('should update passkeyPin state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current.passkeyPin).toBe('');

      act(() => {
        result.current.setPasskeyPin('123456');
      });

      expect(result.current.passkeyPin).toBe('123456');
    });

    it('should update passkeyPinConfirm state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current.passkeyPinConfirm).toBe('');

      act(() => {
        result.current.setPasskeyPinConfirm('123456');
      });

      expect(result.current.passkeyPinConfirm).toBe('123456');
    });

    it('should update showPinInput state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current.showPinInput).toBe(false);

      act(() => {
        result.current.setShowPinInput(true);
      });

      expect(result.current.showPinInput).toBe(true);
    });
  });
});
