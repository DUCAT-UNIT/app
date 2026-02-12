/**
 * Tests for Settings Helpers
 */

import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import {
  getBiometricEnabled,
  setBiometricEnabled,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getShowZeroAssets,
  setShowZeroAssets,
  getAutoLockTimeout,
  setAutoLockTimeout,
  getCurrentAccount,
  setCurrentAccount,
} from '../settingsService';

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;

describe('Biometric Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get biometric enabled setting', async () => {
    mockGetItemAsync.mockResolvedValue('true');

    const result = await getBiometricEnabled();

    expect(mockGetItemAsync).toHaveBeenCalledWith('biometricEnabled');
    expect(result).toBe(true);
  });

  it('should return false when not set', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const result = await getBiometricEnabled();

    expect(result).toBe(false);
  });

  it('should set biometric enabled setting', async () => {
    mockSetItemAsync.mockResolvedValue();

    const result = await setBiometricEnabled(true);

    expect(mockSetItemAsync).toHaveBeenCalledWith('biometricEnabled', 'true');
    expect(result).toBe(true);
  });
});

describe('Notification Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get notifications enabled setting', async () => {
    mockGetItemAsync.mockResolvedValue('false');

    const result = await getNotificationsEnabled();

    expect(mockGetItemAsync).toHaveBeenCalledWith('notificationsEnabled');
    expect(result).toBe(false);
  });

  it('should set notifications enabled setting', async () => {
    mockSetItemAsync.mockResolvedValue();

    const result = await setNotificationsEnabled(false);

    expect(mockSetItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'false');
    expect(result).toBe(true);
  });
});

describe('Display Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get show zero assets setting', async () => {
    mockGetItemAsync.mockResolvedValue('true');

    const result = await getShowZeroAssets();

    expect(mockGetItemAsync).toHaveBeenCalledWith('showZeroAssets');
    expect(result).toBe(true);
  });

  it('should set show zero assets setting', async () => {
    mockSetItemAsync.mockResolvedValue();

    const result = await setShowZeroAssets(true);

    expect(mockSetItemAsync).toHaveBeenCalledWith('showZeroAssets', 'true');
    expect(result).toBe(true);
  });
});

describe('Auto-lock Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get auto-lock timeout with default 5 minutes', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const result = await getAutoLockTimeout();

    expect(mockGetItemAsync).toHaveBeenCalledWith('autoLockTimeout');
    expect(result).toBe(300000);
  });

  it('should get custom timeout value', async () => {
    mockGetItemAsync.mockResolvedValue('600000');

    const result = await getAutoLockTimeout();

    expect(result).toBe(600000);
  });

  it('should set auto-lock timeout', async () => {
    mockSetItemAsync.mockResolvedValue();

    const result = await setAutoLockTimeout(600000);

    expect(mockSetItemAsync).toHaveBeenCalledWith('autoLockTimeout', '600000');
    expect(result).toBe(true);
  });
});

describe('Account Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get current account with default "0"', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const result = await getCurrentAccount();

    expect(mockGetItemAsync).toHaveBeenCalledWith('currentAccount');
    expect(result).toBe('0');
  });

  it('should get custom account value', async () => {
    mockGetItemAsync.mockResolvedValue('5');

    const result = await getCurrentAccount();

    expect(result).toBe('5');
  });

  it('should set current account', async () => {
    mockSetItemAsync.mockResolvedValue();

    const result = await setCurrentAccount('3');

    expect(mockSetItemAsync).toHaveBeenCalledWith('currentAccount', '3');
    expect(result).toBe(true);
  });
});
