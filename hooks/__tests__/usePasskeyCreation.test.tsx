/**
 * Tests for usePasskeyCreation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as PasskeyService from '../../services/passkey';
import { usePasskeyCreation } from '../usePasskeyCreation';
import { notify } from '../../utils/notify';

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

// Mock dependencies
jest.mock('expo-device', () => ({
  deviceName: 'iPhone 15',
}));
jest.mock('../../services/passkey');

interface MockProps {
  setIsAuthenticated: jest.Mock;
  setSeedConfirmed: jest.Mock;
  setWalletAddresses: jest.Mock;
  showBiometricSetupPrompt: jest.Mock;
  loadWallet: jest.Mock;
}

describe('usePasskeyCreation', () => {
  let mockProps: MockProps;

  beforeEach(() => {
    mockProps = {
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      loadWallet: jest.fn().mockResolvedValue(undefined),
      setWalletAddresses: jest.fn(),
      showBiometricSetupPrompt: jest.fn(),
    };

    jest.clearAllMocks();
    (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(true);
    (PasskeyService.createWalletWithPasskey as jest.Mock).mockResolvedValue({
      mnemonic: 'test mnemonic phrase',
      addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
      icloudBackupSucceeded: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current!.creatingWithPasskey).toBe(false);
      expect(result.current!.passkeyMnemonic).toBe(null);
      expect(result.current!.passkeyAddresses).toBe(null);
      expect(result.current!.isCreating).toBe(false);
      expect(result.current!.showPinInput).toBe(false);
      expect(result.current!.passkeyPin).toBe('');
      expect(result.current!.confirmingPin).toBe(false);
      expect(result.current!.passkeyPinConfirm).toBe('');
      expect(result.current!.walletExistsRef.current).toBe(false);
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

      expect(typeof result.current!.setPasskeyPin).toBe('function');
      expect(typeof result.current!.setPasskeyPinConfirm).toBe('function');
      expect(typeof result.current!.setShowPinInput).toBe('function');
      expect(typeof result.current!.startPasskeyCreation).toBe('function');
      expect(typeof result.current!.handlePinEntry).toBe('function');
      expect(typeof result.current!.resetPasskeyCreation).toBe('function');
    });
  });

  describe('startPasskeyCreation', () => {
    it('should show PIN input when passkeys are supported', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.startPasskeyCreation();
      });

      expect(PasskeyService.isPasskeySupported).toHaveBeenCalled();
      expect(result.current!.showPinInput).toBe(true);
      expect(result.current!.creatingWithPasskey).toBe(true);
    });

    it('should show error when passkeys are not supported', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.startPasskeyCreation();
      });

      expect(notify.passkey.notSupported).toHaveBeenCalled();
      expect(result.current!.showPinInput).toBe(false);
      expect(result.current!.creatingWithPasskey).toBe(false);
    });

    it('should handle errors during passkey check', async () => {
      const error = new Error('Passkey check failed');
      (PasskeyService.isPasskeySupported as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.startPasskeyCreation();
      });

      expect(notify.passkey.creationFailed).toHaveBeenCalled();
      expect(result.current!.showPinInput).toBe(false);
    });

    it('should handle errors without message', async () => {
      (PasskeyService.isPasskeySupported as jest.Mock).mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.startPasskeyCreation();
      });

      expect(notify.passkey.creationFailed).toHaveBeenCalled();
    });
  });

  describe('handlePinEntry - Initial PIN', () => {
    it('should move to confirmation when valid PIN is entered', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(result.current!.confirmingPin).toBe(true);
      expect(PasskeyService.createWalletWithPasskey).not.toHaveBeenCalled();
    });

    it('should show error when PIN is null', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry(null as unknown as string);
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(result.current!.confirmingPin).toBe(false);
    });

    it('should show error when PIN is empty', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(result.current!.confirmingPin).toBe(false);
    });

    it('should show error when PIN is too short', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('12345');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(result.current!.confirmingPin).toBe(false);
    });

    it('should show error when PIN is too long', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('1234567');
      });

      expect(notify.pin.invalid).toHaveBeenCalled();
      expect(result.current!.confirmingPin).toBe(false);
    });
  });

  describe('handlePinEntry - PIN Confirmation', () => {
    it('should create wallet when PINs match', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // Enter initial PIN
      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      expect(result.current!.confirmingPin).toBe(true);

      // Set PIN state to match what user entered
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      // Enter confirmation PIN
      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(PasskeyService.createWalletWithPasskey).toHaveBeenCalledWith({
        userName: 'iPhone 15-DUCAT_APP',
        userDisplayName: 'iPhone 15 - Ducat',
        pin: '123456',
      });
      expect(mockProps.setWalletAddresses).toHaveBeenCalledWith(
        { segwit: 'bc1q...', taproot: 'bc1p...' },
        0
      );
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(true);
      expect(notify.passkey.created).toHaveBeenCalled();
      expect(result.current!.showPinInput).toBe(false);
      expect(result.current!.creatingWithPasskey).toBe(false);
      expect(result.current!.walletExistsRef.current).toBe(true);
    });

    it('should show error and reset when PINs do not match', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // Enter initial PIN and move to confirm
      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      expect(result.current!.confirmingPin).toBe(true);

      // Enter different confirmation PIN
      await act(async () => {
        await result.current!.handlePinEntry('654321');
      });

      expect(notify.pin.mismatch).toHaveBeenCalled();
      expect(result.current!.confirmingPin).toBe(false);
      expect(result.current!.passkeyPin).toBe('');
      expect(result.current!.passkeyPinConfirm).toBe('');
      expect(PasskeyService.createWalletWithPasskey).not.toHaveBeenCalled();
    });
  });

  describe('createWalletWithPasskey - Success', () => {
    it('should show success message when iCloud backup succeeds', async () => {
      (PasskeyService.createWalletWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: 'test',
        addresses: {},
        icloudBackupSucceeded: true,
      });

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(notify.passkey.created).toHaveBeenCalled();
    });

    it('should show warning when iCloud backup fails', async () => {
      // Create a promise that resolves with backup failure
      const backupPromise = Promise.resolve({ success: false, error: 'Backup failed' });

      (PasskeyService.createWalletWithPasskey as jest.Mock).mockResolvedValue({
        mnemonic: 'test',
        addresses: {},
        icloudBackupPromise: backupPromise,
      });

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      // First should show success toast
      expect(notify.passkey.created).toHaveBeenCalled();

      // Wait for background backup promise to resolve
      await act(async () => {
        await backupPromise;
      });

      // Then should show a blocking native alert about backup failure
      const { Alert } = require('react-native');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cloud Backup Failed',
        expect.stringContaining('could not be backed up to iCloud'),
        expect.arrayContaining([expect.objectContaining({ text: 'I Understand' })]),
        { cancelable: false }
      );
    });

    it('should set isCreating to true during creation', async () => {
      let createResolve: (value: unknown) => void;
      const createPromise = new Promise((resolve) => {
        createResolve = resolve;
      });
      (PasskeyService.createWalletWithPasskey as jest.Mock).mockReturnValue(createPromise);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      expect(result.current!.isCreating).toBe(false);

      act(() => {
        result.current!.handlePinEntry('123456');
      });

      expect(result.current!.isCreating).toBe(true);

      await act(async () => {
        createResolve({ mnemonic: 'test', addresses: {}, icloudBackupSucceeded: true });
        await createPromise;
      });

      expect(result.current!.isCreating).toBe(false);
    });
  });

  describe('createWalletWithPasskey - Error Handling', () => {
    it('should handle wallet creation errors', async () => {
      const error = new Error('Creation failed');
      (PasskeyService.createWalletWithPasskey as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(notify.passkey.walletCreationFailed).toHaveBeenCalled();
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
      expect(result.current!.creatingWithPasskey).toBe(false);
      expect(result.current!.isCreating).toBe(false);
      expect(result.current!.confirmingPin).toBe(false);
      expect(result.current!.passkeyPin).toBe('');
      expect(result.current!.passkeyPinConfirm).toBe('');
    });

    it('should handle errors without message', async () => {
      (PasskeyService.createWalletWithPasskey as jest.Mock).mockRejectedValue(new Error());

      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(notify.passkey.walletCreationFailed).toHaveBeenCalled();
    });
  });

  describe('resetPasskeyCreation', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      // First set some state
      await act(async () => {
        await result.current!.startPasskeyCreation();
      });
      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(result.current!.creatingWithPasskey).toBe(true);
      expect(result.current!.confirmingPin).toBe(true);

      // Reset
      act(() => {
        result.current!.resetPasskeyCreation();
      });

      expect(result.current!.creatingWithPasskey).toBe(false);
      expect(result.current!.passkeyMnemonic).toBe(null);
      expect(result.current!.passkeyAddresses).toBe(null);
      expect(result.current!.isCreating).toBe(false);
      expect(result.current!.showPinInput).toBe(false);
      expect(result.current!.passkeyPin).toBe('');
      expect(result.current!.confirmingPin).toBe(false);
      expect(result.current!.passkeyPinConfirm).toBe('');
    });
  });

  describe('State Setters', () => {
    it('should update passkeyPin state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current!.passkeyPin).toBe('');

      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      expect(result.current!.passkeyPin).toBe('123456');
    });

    it('should update passkeyPinConfirm state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current!.passkeyPinConfirm).toBe('');

      act(() => {
        result.current!.setPasskeyPinConfirm('123456');
      });

      expect(result.current!.passkeyPinConfirm).toBe('123456');
    });

    it('should update showPinInput state', () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      expect(result.current!.showPinInput).toBe(false);

      act(() => {
        result.current!.setShowPinInput(true);
      });

      expect(result.current!.showPinInput).toBe(true);
    });
  });
});
