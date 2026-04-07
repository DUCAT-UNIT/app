/**
 * Tests for usePasskeyCreation Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
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

// Mock WalletService (used by createWalletWithPasskey internally)
const mockGenerateWallet = jest.fn();
const mockSaveWalletToStorage = jest.fn();
jest.mock('../../services/walletService', () => ({
  generateWallet: (...args: unknown[]) => mockGenerateWallet(...args),
  saveWalletToStorage: (...args: unknown[]) => mockSaveWalletToStorage(...args),
}));

// Mock pinService
const mockSavePin = jest.fn();
jest.mock('../../services/pinService', () => ({
  savePin: (...args: unknown[]) => mockSavePin(...args),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
}));

// Mock passkey service (not directly used by the hook anymore, but may be imported)
jest.mock('../../services/passkey');

// Mock analytics
jest.mock('../../services/analyticsService', () => ({
  analytics: {
    track: jest.fn(),
    screen: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('../../constants/analyticsEvents', () => ({
  ONBOARDING_EVENTS: {
    WALLET_CREATION_STARTED: 'wallet_creation_started',
    WALLET_CREATED: 'wallet_created',
    PASSKEY_SETUP_OFFERED: 'passkey_setup_offered',
  },
}));

interface MockProps {
  setIsAuthenticated: jest.Mock;
  setSeedConfirmed: jest.Mock;
  setWalletAddresses: jest.Mock;
  showBiometricSetupPrompt: jest.Mock;
  showPasskeyMigrationPrompt?: jest.Mock;
}

describe('usePasskeyCreation', () => {
  let mockProps: MockProps;

  beforeEach(() => {
    mockProps = {
      setIsAuthenticated: jest.fn(),
      setSeedConfirmed: jest.fn(),
      setWalletAddresses: jest.fn(),
      showBiometricSetupPrompt: jest.fn(),
    };

    jest.clearAllMocks();
    mockGenerateWallet.mockResolvedValue({
      mnemonic: 'test mnemonic phrase',
      addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
    });
    mockSaveWalletToStorage.mockResolvedValue(undefined);
    mockSavePin.mockResolvedValue(undefined);
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
    it('should show PIN input', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.startPasskeyCreation();
      });

      expect(result.current!.showPinInput).toBe(true);
      expect(result.current!.creatingWithPasskey).toBe(true);
    });
  });

  describe('handlePinEntry - Initial PIN', () => {
    it('should move to confirmation when valid PIN is entered', async () => {
      const { result } = renderHook(() => usePasskeyCreation(mockProps));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      expect(result.current!.confirmingPin).toBe(true);
      expect(mockGenerateWallet).not.toHaveBeenCalled();
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

      expect(mockGenerateWallet).toHaveBeenCalledWith(0);
      expect(mockSaveWalletToStorage).toHaveBeenCalled();
      expect(mockSavePin).toHaveBeenCalledWith('123456');
      expect(mockProps.setWalletAddresses).toHaveBeenCalled();
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockProps.setSeedConfirmed).toHaveBeenCalledWith(true);
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
      expect(mockGenerateWallet).not.toHaveBeenCalled();
    });
  });

  describe('createWalletWithPasskey - Success', () => {
    it('should show success message on wallet creation', async () => {
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

      expect(notify.success).toHaveBeenCalledWith('Wallet created successfully');
    });

    it('should offer passkey migration when showPasskeyMigrationPrompt is provided', async () => {
      const showPasskeyPrompt = jest.fn();
      const propsWithPasskey = { ...mockProps, showPasskeyMigrationPrompt: showPasskeyPrompt };

      const { result } = renderHook(() => usePasskeyCreation(propsWithPasskey));

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });
      act(() => {
        result.current!.setPasskeyPin('123456');
      });

      await act(async () => {
        await result.current!.handlePinEntry('123456');
      });

      // In non-E2E mode, passkey migration prompt should be offered
      expect(showPasskeyPrompt).toHaveBeenCalledWith('123456');
    });

    it('should set isCreating to true during creation', async () => {
      let generateResolve: (value: unknown) => void;
      const generatePromise = new Promise((resolve) => {
        generateResolve = resolve;
      });
      mockGenerateWallet.mockReturnValue(generatePromise);

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
        generateResolve!({
          mnemonic: 'test',
          addresses: { segwit: 'bc1q...', taproot: 'bc1p...' },
        });
        await generatePromise;
      });

      expect(result.current!.isCreating).toBe(false);
    });
  });

  describe('createWalletWithPasskey - Error Handling', () => {
    it('should handle wallet creation errors', async () => {
      const error = new Error('Creation failed');
      mockGenerateWallet.mockRejectedValue(error);

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
      mockGenerateWallet.mockRejectedValue(new Error());

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
