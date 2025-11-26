// @ts-nocheck
/**
 * Tests for Settings Helpers
 */

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
} from '../settingsHelpers';
import * as settingsService from '../settingsService';

// Mock settingsService
jest.mock('../settingsService');

// Typed mock references
const mockGetBoolean = settingsService.getBoolean as jest.MockedFunction<typeof settingsService.getBoolean>;
const mockSetBoolean = settingsService.setBoolean as jest.MockedFunction<typeof settingsService.setBoolean>;
const mockGetNumber = settingsService.getNumber as jest.MockedFunction<typeof settingsService.getNumber>;
const mockSetNumber = settingsService.setNumber as jest.MockedFunction<typeof settingsService.setNumber>;
const mockGetString = settingsService.getString as jest.MockedFunction<typeof settingsService.getString>;
const mockSetString = settingsService.setString as jest.MockedFunction<typeof settingsService.setString>;

describe('Biometric Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get biometric enabled setting', async () => {
    mockGetBoolean.mockResolvedValue(true);

    const result = await getBiometricEnabled();

    expect(mockGetBoolean).toHaveBeenCalledWith('biometricEnabled', false);
    expect(result).toBe(true);
  });

  it('should set biometric enabled setting', async () => {
    mockSetBoolean.mockResolvedValue(true);

    const result = await setBiometricEnabled(true);

    expect(mockSetBoolean).toHaveBeenCalledWith('biometricEnabled', true);
    expect(result).toBe(true);
  });
});

describe('Notification Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get notifications enabled setting', async () => {
    mockGetBoolean.mockResolvedValue(false);

    const result = await getNotificationsEnabled();

    expect(mockGetBoolean).toHaveBeenCalledWith('notificationsEnabled', false);
    expect(result).toBe(false);
  });

  it('should set notifications enabled setting', async () => {
    mockSetBoolean.mockResolvedValue(true);

    const result = await setNotificationsEnabled(false);

    expect(mockSetBoolean).toHaveBeenCalledWith('notificationsEnabled', false);
    expect(result).toBe(true);
  });
});

describe('Display Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get show zero assets setting', async () => {
    mockGetBoolean.mockResolvedValue(true);

    const result = await getShowZeroAssets();

    expect(mockGetBoolean).toHaveBeenCalledWith('showZeroAssets', false);
    expect(result).toBe(true);
  });

  it('should set show zero assets setting', async () => {
    mockSetBoolean.mockResolvedValue(true);

    const result = await setShowZeroAssets(true);

    expect(mockSetBoolean).toHaveBeenCalledWith('showZeroAssets', true);
    expect(result).toBe(true);
  });
});

describe('Auto-lock Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get auto-lock timeout with default 5 minutes', async () => {
    mockGetNumber.mockResolvedValue(300000);

    const result = await getAutoLockTimeout();

    expect(mockGetNumber).toHaveBeenCalledWith('autoLockTimeout', 300000);
    expect(result).toBe(300000);
  });

  it('should set auto-lock timeout', async () => {
    mockSetNumber.mockResolvedValue(true);

    const result = await setAutoLockTimeout(600000);

    expect(mockSetNumber).toHaveBeenCalledWith('autoLockTimeout', 600000);
    expect(result).toBe(true);
  });
});

describe('Account Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get current account with default "0"', async () => {
    mockGetString.mockResolvedValue('0');

    const result = await getCurrentAccount();

    expect(mockGetString).toHaveBeenCalledWith('currentAccount', '0');
    expect(result).toBe('0');
  });

  it('should get custom account value', async () => {
    mockGetString.mockResolvedValue('5');

    const result = await getCurrentAccount();

    expect(result).toBe('5');
  });

  it('should set current account', async () => {
    mockSetString.mockResolvedValue(true);

    const result = await setCurrentAccount('3');

    expect(mockSetString).toHaveBeenCalledWith('currentAccount', '3');
    expect(result).toBe(true);
  });
});
