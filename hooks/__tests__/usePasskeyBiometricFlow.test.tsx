import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { setBiometricEnabled as persistBiometricEnabled } from '../../services/biometricService';
import { isPasskeyUpgradeRecommended } from '../../services/passkey';
import { usePasskeyBiometricFlow } from '../usePasskeyBiometricFlow';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('../../services/biometricService', () => ({
  setBiometricEnabled: jest.fn(),
}));

jest.mock('../../services/passkey', () => ({
  isPasskeyUpgradeRecommended: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  __esModule: true,
  authenticateAsync: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockPersistBiometricEnabled = persistBiometricEnabled as jest.MockedFunction<typeof persistBiometricEnabled>;
const mockIsPasskeyUpgradeRecommended = isPasskeyUpgradeRecommended as jest.MockedFunction<
  typeof isPasskeyUpgradeRecommended
>;
const mockAuthenticateAsync = LocalAuthentication.authenticateAsync as jest.MockedFunction<
  typeof LocalAuthentication.authenticateAsync
>;
const mockKeyboardDismiss = jest.fn();
Object.defineProperty(Keyboard, 'dismiss', {
  configurable: true,
  value: mockKeyboardDismiss,
});

function renderPasskeyBiometricFlow(overrides: Partial<Parameters<typeof usePasskeyBiometricFlow>[0]> = {}) {
  const props = {
    passkeyEnabled: true,
    setBiometricEnabled: jest.fn(),
    setIsAuthenticated: jest.fn(),
    ...overrides,
  };

  return {
    props,
    ...renderHook(() => usePasskeyBiometricFlow(props)),
  };
}

describe('usePasskeyBiometricFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPasskeyUpgradeRecommended.mockResolvedValue(false);
    mockPersistBiometricEnabled.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
  });

  it('checks whether a passkey upgrade is recommended when passkeys are enabled', async () => {
    mockIsPasskeyUpgradeRecommended.mockResolvedValueOnce(true);

    const { result } = renderPasskeyBiometricFlow();

    await waitFor(() => {
      expect(result.current.passkeyUpgradeRecommended).toBe(true);
    });
    expect(mockIsPasskeyUpgradeRecommended).toHaveBeenCalledTimes(1);
  });

  it('does not check upgrade state when passkeys are disabled', async () => {
    const { result } = renderPasskeyBiometricFlow({ passkeyEnabled: false });

    expect(result.current.passkeyUpgradeRecommended).toBe(false);
    expect(mockIsPasskeyUpgradeRecommended).not.toHaveBeenCalled();
  });

  it('falls back to no recommendation when the upgrade check fails', async () => {
    mockIsPasskeyUpgradeRecommended.mockRejectedValueOnce(new Error('icloud unavailable'));

    const { result } = renderPasskeyBiometricFlow();

    await waitFor(() => {
      expect(result.current.passkeyUpgradeRecommended).toBe(false);
    });
  });

  it('opens and hides passkey migration prompts with the correct mode data', () => {
    const { result } = renderPasskeyBiometricFlow();

    act(() => {
      result.current.showPasskeyMigrationPrompt('123456');
    });

    expect(result.current.showPasskeyMigrationModal).toBe(true);
    expect(result.current.passkeyMigrationData).toEqual({
      currentPin: '123456',
      mode: 'import',
    });

    act(() => {
      result.current.hidePasskeyMigrationPrompt();
    });

    expect(result.current.showPasskeyMigrationModal).toBe(false);
    expect(result.current.passkeyMigrationData).toBeNull();

    act(() => {
      result.current.showPasskeyUpgradePrompt();
    });

    expect(result.current.passkeyMigrationData).toEqual({ mode: 'upgrade' });

    act(() => {
      result.current.handlePasskeyUpgradeComplete();
    });

    expect(result.current.passkeyUpgradeRecommended).toBe(false);
  });

  it('enables biometric login, authenticates once, and hides the setup modal', async () => {
    const setBiometricEnabled = jest.fn();
    const { result } = renderPasskeyBiometricFlow({ setBiometricEnabled });

    act(() => {
      result.current.showBiometricSetupPrompt();
    });
    expect(result.current.showBiometricSetupModal).toBe(true);

    await act(async () => {
      await result.current.handleBiometricSetupEnable();
    });

    expect(mockPersistBiometricEnabled).toHaveBeenCalledWith(true);
    expect(setBiometricEnabled).toHaveBeenCalledWith(true);
    expect(mockAuthenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Authenticate to enable biometric login',
      fallbackLabel: 'Use PIN instead',
    });
    expect(result.current.showBiometricSetupModal).toBe(false);
  });

  it('hides biometric setup even when persistence or authentication fails', async () => {
    mockPersistBiometricEnabled.mockRejectedValueOnce(new Error('secure store failed'));
    const setBiometricEnabled = jest.fn();
    const { result } = renderPasskeyBiometricFlow({ setBiometricEnabled });

    act(() => {
      result.current.showBiometricSetupPrompt();
    });

    await act(async () => {
      await result.current.handleBiometricSetupEnable();
    });

    expect(setBiometricEnabled).not.toHaveBeenCalled();
    expect(result.current.showBiometricSetupModal).toBe(false);
  });

  it('skips biometric login and persists the disabled preference', async () => {
    const setBiometricEnabled = jest.fn();
    const { result } = renderPasskeyBiometricFlow({ setBiometricEnabled });

    act(() => {
      result.current.showBiometricSetupPrompt();
    });

    await act(async () => {
      await result.current.handleBiometricSetupSkip();
    });

    expect(result.current.showBiometricSetupModal).toBe(false);
    expect(setBiometricEnabled).toHaveBeenCalledWith(false);
    expect(mockPersistBiometricEnabled).toHaveBeenCalledWith(false);
  });

  it('dismisses every modal and the keyboard on lock', () => {
    const { result } = renderPasskeyBiometricFlow();

    act(() => {
      result.current.showPasskeyMigrationPrompt('123456');
      result.current.showBiometricSetupPrompt();
    });

    act(() => {
      result.current.dismissAllModals();
    });

    expect(mockKeyboardDismiss).toHaveBeenCalled();
    expect(result.current.showPasskeyMigrationModal).toBe(false);
    expect(result.current.passkeyMigrationData).toBeNull();
    expect(result.current.showBiometricSetupModal).toBe(false);
  });
});
