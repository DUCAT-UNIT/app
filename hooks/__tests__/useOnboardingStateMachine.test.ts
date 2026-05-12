/**
 * Tests for deriveOnboardingScreen pure function
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthFlowHandlers } from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import {
  authenticateWithBiometrics,
  setBiometricEnabled as persistBiometricEnabled,
} from '../../services/biometricService';
import * as PasskeyService from '../../services/passkey';
import { hasAccessibleMnemonic } from '../../services/secureStorageService';
import { logger } from '../../utils/logger';
import { useOnboardingHandlers } from '../useOnboardingHandlers';
import { usePasskeyCreation } from '../usePasskeyCreation';
import { usePasskeyRestore } from '../usePasskeyRestore';
import { useWalletImport } from '../useWalletImport';
import {
  deriveOnboardingScreen,
  type OnboardingState,
  useOnboardingStateMachine,
} from '../useOnboardingStateMachine';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/NavigationHandlersContext', () => ({
  useAuthFlowHandlers: jest.fn(),
}));

jest.mock('../../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../useOnboardingHandlers', () => ({
  useOnboardingHandlers: jest.fn(),
}));

jest.mock('../usePasskeyCreation', () => ({
  usePasskeyCreation: jest.fn(),
}));

jest.mock('../usePasskeyRestore', () => ({
  usePasskeyRestore: jest.fn(),
}));

jest.mock('../useWalletImport', () => ({
  useWalletImport: jest.fn(),
}));

jest.mock('../../services/biometricService', () => ({
  authenticateWithBiometrics: jest.fn(),
  setBiometricEnabled: jest.fn(),
}));

jest.mock('../../services/passkey', () => ({
  isPasskeyEnabled: jest.fn(),
}));

jest.mock('../../services/secureStorageService', () => ({
  hasAccessibleMnemonic: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    showPinInput: false,
    showRestorePinInput: false,
    settingUpPin: false,
    showPinEntry: false,
    isAuthenticated: false,
    wallet: null,
    seedConfirmed: false,
    importingWallet: false,
    restoringWithPasskey: false,
    ...overrides,
  };
}

describe('deriveOnboardingScreen', () => {
  it('returns passkey_pin_create when showPinInput is true', () => {
    expect(deriveOnboardingScreen(makeState({ showPinInput: true }))).toBe('passkey_pin_create');
  });

  it('returns passkey_pin_restore when showRestorePinInput is true', () => {
    expect(deriveOnboardingScreen(makeState({ showRestorePinInput: true }))).toBe(
      'passkey_pin_restore',
    );
  });

  it('returns pin_setup when settingUpPin is true', () => {
    expect(deriveOnboardingScreen(makeState({ settingUpPin: true }))).toBe('pin_setup');
  });

  it('returns locked when showPinEntry is true', () => {
    expect(deriveOnboardingScreen(makeState({ showPinEntry: true }))).toBe('locked');
  });

  it('returns locked when !authenticated + wallet + seedConfirmed', () => {
    expect(
      deriveOnboardingScreen(
        makeState({ isAuthenticated: false, wallet: { id: 1 }, seedConfirmed: true }),
      ),
    ).toBe('locked');
  });

  it('returns welcome when no wallet exists', () => {
    expect(deriveOnboardingScreen(makeState())).toBe('welcome');
  });

  it('returns welcome when wallet + authenticated + seedConfirmed (fallback)', () => {
    expect(
      deriveOnboardingScreen(
        makeState({ wallet: { id: 1 }, isAuthenticated: true, seedConfirmed: true }),
      ),
    ).toBe('welcome');
  });

  it('returns welcome when importing wallet', () => {
    expect(deriveOnboardingScreen(makeState({ importingWallet: true }))).toBe('welcome');
  });

  it('returns welcome when restoring with passkey', () => {
    expect(deriveOnboardingScreen(makeState({ restoringWithPasskey: true }))).toBe('welcome');
  });

  // Priority tests: when multiple flags are true, higher priority wins
  describe('priority order', () => {
    it('showPinInput takes priority over showRestorePinInput', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, showRestorePinInput: true })),
      ).toBe('passkey_pin_create');
    });

    it('showPinInput takes priority over settingUpPin', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, settingUpPin: true })),
      ).toBe('passkey_pin_create');
    });

    it('showPinInput takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, showPinEntry: true })),
      ).toBe('passkey_pin_create');
    });

    it('showRestorePinInput takes priority over settingUpPin', () => {
      expect(
        deriveOnboardingScreen(makeState({ showRestorePinInput: true, settingUpPin: true })),
      ).toBe('passkey_pin_restore');
    });

    it('showRestorePinInput takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ showRestorePinInput: true, showPinEntry: true })),
      ).toBe('passkey_pin_restore');
    });

    it('settingUpPin takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ settingUpPin: true, showPinEntry: true })),
      ).toBe('pin_setup');
    });

    it('showPinEntry takes priority over locked state (wallet + seedConfirmed)', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            showPinEntry: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('locked');
    });

    it('settingUpPin blocks the locked-wallet path', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            settingUpPin: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('pin_setup');
    });

    it('showPinInput takes priority over everything', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            showPinInput: true,
            showRestorePinInput: true,
            settingUpPin: true,
            showPinEntry: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('passkey_pin_create');
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('wallet exists but seedConfirmed is false returns welcome', () => {
      expect(
        deriveOnboardingScreen(
          makeState({ wallet: { id: 1 }, isAuthenticated: false, seedConfirmed: false }),
        ),
      ).toBe('welcome');
    });

    it('locked path requires settingUpPin to be false', () => {
      // settingUpPin=true means we go to pin_setup, NOT locked
      expect(
        deriveOnboardingScreen(
          makeState({
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
            settingUpPin: true,
          }),
        ),
      ).toBe('pin_setup');
    });

    it('authenticated user with wallet but no seedConfirmed returns welcome', () => {
      expect(
        deriveOnboardingScreen(
          makeState({ wallet: { id: 1 }, isAuthenticated: true, seedConfirmed: false }),
        ),
      ).toBe('welcome');
    });
  });
});

describe('useOnboardingStateMachine', () => {
  const mockSetIsAuthenticated = jest.fn();
  const mockSetSettingUpPin = jest.fn();
  const mockSetBiometricEnabled = jest.fn();
  const mockSetSeedConfirmed = jest.fn();
  const mockSetWalletAddresses = jest.fn();
  const mockShowBiometricSetupPrompt = jest.fn();
  const mockShowPasskeyMigrationPrompt = jest.fn();
  const mockHandleLockScreenAuthenticatedWrapper = jest.fn();
  const mockFetchBalance = jest.fn();
  const mockFetchTransactionHistory = jest.fn();
  const mockResetWalletAndState = jest.fn();
  const mockHandlePinSetupCompleteWrapper = jest.fn();
  const mockHandlePinChangeCompleteWrapper = jest.fn();
  const mockHandleCancelPinChange = jest.fn();
  const mockLoadWallet = jest.fn();
  const mockImportWallet = jest.fn();
  const mockPersistImportedWallet = jest.fn();
  const mockStartPasskeyCreation = jest.fn();
  const mockHandlePinEntry = jest.fn();
  const mockResetPasskeyCreation = jest.fn();
  const mockStartPasskeyRestore = jest.fn();
  const mockRestoreWalletWithPasskey = jest.fn();
  const mockResetPasskeyRestore = jest.fn();
  const mockHandlePinSetupComplete = jest.fn();
  const mockHandlePinChangeComplete = jest.fn();
  let params: Parameters<typeof useOnboardingStateMachine>[0];
  let alertSpy: jest.SpyInstance;

  function configureAuth(overrides: Record<string, unknown> = {}): void {
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isBiometricSupported: true,
      biometricEnabled: false,
      settingUpPin: false,
      changingPin: false,
      showPinEntry: false,
      setIsAuthenticated: mockSetIsAuthenticated,
      setSettingUpPin: mockSetSettingUpPin,
      setBiometricEnabled: mockSetBiometricEnabled,
      ...overrides,
    });
  }

  function configurePasskeyCreation(overrides: Record<string, unknown> = {}): void {
    (usePasskeyCreation as jest.Mock).mockReturnValue({
      startPasskeyCreation: mockStartPasskeyCreation,
      handlePinEntry: mockHandlePinEntry,
      showPinInput: false,
      passkeyPin: '',
      confirmingPin: false,
      passkeyPinConfirm: '',
      setPasskeyPin: jest.fn(),
      setPasskeyPinConfirm: jest.fn(),
      setShowPinInput: jest.fn(),
      resetPasskeyCreation: mockResetPasskeyCreation,
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    configureAuth();
    configurePasskeyCreation();

    mockFetchBalance.mockResolvedValue(undefined);
    mockFetchTransactionHistory.mockResolvedValue(undefined);
    mockResetWalletAndState.mockResolvedValue(undefined);
    mockHandlePinSetupCompleteWrapper.mockResolvedValue(undefined);
    mockHandlePinChangeCompleteWrapper.mockResolvedValue(undefined);
    mockImportWallet.mockResolvedValue(undefined);
    mockPersistImportedWallet.mockResolvedValue(undefined);
    mockHandlePinSetupComplete.mockResolvedValue(undefined);
    mockHandlePinChangeComplete.mockResolvedValue(undefined);
    (authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
    (persistBiometricEnabled as jest.Mock).mockResolvedValue(true);
    (PasskeyService.isPasskeyEnabled as jest.Mock).mockResolvedValue(false);
    (hasAccessibleMnemonic as jest.Mock).mockResolvedValue(true);
    (useWallet as jest.Mock).mockReturnValue({
      wallet: null,
      currentAccount: 2,
      loadWallet: mockLoadWallet,
      setWalletAddresses: mockSetWalletAddresses,
    });
    (useAuthFlowHandlers as jest.Mock).mockReturnValue({
      showPasskeyMigrationPrompt: mockShowPasskeyMigrationPrompt,
      showBiometricSetupPrompt: mockShowBiometricSetupPrompt,
    });
    (useWalletImport as jest.Mock).mockReturnValue({
      importingWallet: false,
      importSeedPhrase: Array(12).fill(''),
      isImportedWallet: false,
      isImporting: false,
      seedInputRefs: [],
      importedMnemonic: null,
      setImportingWallet: jest.fn(),
      setImportSeedPhrase: jest.fn(),
      setIsImportedWallet: jest.fn(),
      setImportedMnemonic: jest.fn(),
      importWallet: mockImportWallet,
      persistImportedWallet: mockPersistImportedWallet,
    });
    (usePasskeyRestore as jest.Mock).mockReturnValue({
      restoringWithPasskey: false,
      showRestorePinInput: false,
      restorePin: '',
      setRestoringWithPasskey: jest.fn(),
      setRestorePin: jest.fn(),
      startPasskeyRestore: mockStartPasskeyRestore,
      restoreWalletWithPasskey: mockRestoreWalletWithPasskey,
      resetPasskeyRestore: mockResetPasskeyRestore,
    });
    (useOnboardingHandlers as jest.Mock).mockReturnValue({
      handlePinSetupComplete: mockHandlePinSetupComplete,
      handlePinChangeComplete: mockHandlePinChangeComplete,
    });

    params = {
      seedConfirmed: false,
      setSeedConfirmed: mockSetSeedConfirmed,
      fetchBalance: mockFetchBalance,
      fetchTransactionHistory: mockFetchTransactionHistory,
      resetWalletAndState: mockResetWalletAndState,
      handlePinSetupCompleteWrapper: mockHandlePinSetupCompleteWrapper,
      handlePinChangeCompleteWrapper: mockHandlePinChangeCompleteWrapper,
      handleCancelPinChange: mockHandleCancelPinChange,
      handleLockScreenAuthenticatedWrapper: mockHandleLockScreenAuthenticatedWrapper,
      keyboardHeight: 42,
    };
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('composes onboarding child hooks and exposes the derived screen state', () => {
    configurePasskeyCreation({ showPinInput: true, passkeyPin: '12' });

    const { result } = renderHook(() => useOnboardingStateMachine(params));

    expect(result.current.screen).toBe('passkey_pin_create');
    expect(result.current.passkeyPin).toBe('12');
    expect(result.current.importWallet).toBe(mockImportWallet);
    expect(result.current.startPasskeyCreation).toBe(mockStartPasskeyCreation);
    expect(result.current.restoreWalletWithPasskey).toBe(mockRestoreWalletWithPasskey);
    expect(result.current.handlePinSetupComplete).toBe(mockHandlePinSetupComplete);
    expect(result.current.keyboardHeight).toBe(42);
    expect(useWalletImport).toHaveBeenCalledWith({
      currentAccount: 2,
      setSettingUpPin: mockSetSettingUpPin,
    });
    expect(usePasskeyCreation).toHaveBeenCalledWith(expect.objectContaining({
      setIsAuthenticated: mockSetIsAuthenticated,
      setSeedConfirmed: mockSetSeedConfirmed,
      setWalletAddresses: mockSetWalletAddresses,
      showBiometricSetupPrompt: mockShowBiometricSetupPrompt,
      showPasskeyMigrationPrompt: mockShowPasskeyMigrationPrompt,
    }));
  });

  it('prompts to enable biometrics from the lock screen and persists the preference', async () => {
    const { result } = renderHook(() => useOnboardingStateMachine(params));

    await act(async () => {
      await result.current.handleBiometricAuth();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Face ID',
      'Use Face ID for quick and secure access to your wallet.',
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ onPress?: () => void }>;
    await act(async () => {
      buttons[0].onPress?.();
    });

    await waitFor(() => {
      expect(persistBiometricEnabled).toHaveBeenCalledWith(true);
    });
    expect(authenticateWithBiometrics).toHaveBeenCalledWith(
      'Authenticate to enable Face ID',
      'Cancel',
    );
    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
    expect(mockHandleLockScreenAuthenticatedWrapper).toHaveBeenCalled();
  });

  it('forces PIN unlock when a passkey wallet has no accessible standard mnemonic', async () => {
    configureAuth({ biometricEnabled: true });
    (PasskeyService.isPasskeyEnabled as jest.Mock).mockResolvedValue(true);
    (hasAccessibleMnemonic as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useOnboardingStateMachine(params));

    await act(async () => {
      await result.current.handleBiometricAuth();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Use PIN To Unlock',
      expect.stringContaining('re-establish the encrypted passkey session'),
    );
    expect(mockSetIsAuthenticated).not.toHaveBeenCalled();
    expect(mockHandleLockScreenAuthenticatedWrapper).not.toHaveBeenCalled();
  });

  it('unlocks with biometric auth when passkey recovery is enabled but the PIN wallet mnemonic is accessible', async () => {
    configureAuth({ biometricEnabled: true });
    (PasskeyService.isPasskeyEnabled as jest.Mock).mockResolvedValue(true);
    (hasAccessibleMnemonic as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useOnboardingStateMachine(params));

    await act(async () => {
      await result.current.handleBiometricAuth();
    });

    expect(authenticateWithBiometrics).toHaveBeenCalledWith(
      'Authenticate to unlock wallet',
      'Use PIN',
    );
    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
    expect(mockHandleLockScreenAuthenticatedWrapper).toHaveBeenCalled();
  });

  it('logs biometric enablement failures without authenticating the session', async () => {
    (persistBiometricEnabled as jest.Mock).mockResolvedValue(false);
    const { result } = renderHook(() => useOnboardingStateMachine(params));

    await act(async () => {
      await result.current.handleBiometricAuth();
    });
    const buttons = alertSpy.mock.calls[0][2] as Array<{ onPress?: () => void }>;
    await act(async () => {
      buttons[0].onPress?.();
    });

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[OnboardingPage] Failed to enable biometrics from lock screen',
        { error: 'Failed to persist biometric preference' },
      );
    });
    expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
    expect(mockSetIsAuthenticated).not.toHaveBeenCalled();
  });
});
