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

describe('Biometric Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get biometric enabled setting', async () => {
    settingsService.getBoolean.mockResolvedValue(true);

    const result = await getBiometricEnabled();

    expect(settingsService.getBoolean).toHaveBeenCalledWith('biometricEnabled', false);
    expect(result).toBe(true);
  });

  it('should set biometric enabled setting', async () => {
    settingsService.setBoolean.mockResolvedValue(true);

    const result = await setBiometricEnabled(true);

    expect(settingsService.setBoolean).toHaveBeenCalledWith('biometricEnabled', true);
    expect(result).toBe(true);
  });
});

describe('Notification Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get notifications enabled setting', async () => {
    settingsService.getBoolean.mockResolvedValue(false);

    const result = await getNotificationsEnabled();

    expect(settingsService.getBoolean).toHaveBeenCalledWith('notificationsEnabled', false);
    expect(result).toBe(false);
  });

  it('should set notifications enabled setting', async () => {
    settingsService.setBoolean.mockResolvedValue(true);

    const result = await setNotificationsEnabled(false);

    expect(settingsService.setBoolean).toHaveBeenCalledWith('notificationsEnabled', false);
    expect(result).toBe(true);
  });
});

describe('Display Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get show zero assets setting', async () => {
    settingsService.getBoolean.mockResolvedValue(true);

    const result = await getShowZeroAssets();

    expect(settingsService.getBoolean).toHaveBeenCalledWith('showZeroAssets', false);
    expect(result).toBe(true);
  });

  it('should set show zero assets setting', async () => {
    settingsService.setBoolean.mockResolvedValue(true);

    const result = await setShowZeroAssets(true);

    expect(settingsService.setBoolean).toHaveBeenCalledWith('showZeroAssets', true);
    expect(result).toBe(true);
  });
});

describe('Auto-lock Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get auto-lock timeout with default 5 minutes', async () => {
    settingsService.getNumber.mockResolvedValue(300000);

    const result = await getAutoLockTimeout();

    expect(settingsService.getNumber).toHaveBeenCalledWith('autoLockTimeout', 300000);
    expect(result).toBe(300000);
  });

  it('should set auto-lock timeout', async () => {
    settingsService.setNumber.mockResolvedValue(true);

    const result = await setAutoLockTimeout(600000);

    expect(settingsService.setNumber).toHaveBeenCalledWith('autoLockTimeout', 600000);
    expect(result).toBe(true);
  });
});

describe('Account Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get current account with default "0"', async () => {
    settingsService.getString.mockResolvedValue('0');

    const result = await getCurrentAccount();

    expect(settingsService.getString).toHaveBeenCalledWith('currentAccount', '0');
    expect(result).toBe('0');
  });

  it('should get custom account value', async () => {
    settingsService.getString.mockResolvedValue('5');

    const result = await getCurrentAccount();

    expect(result).toBe('5');
  });

  it('should set current account', async () => {
    settingsService.setString.mockResolvedValue(true);

    const result = await setCurrentAccount('3');

    expect(settingsService.setString).toHaveBeenCalledWith('currentAccount', '3');
    expect(result).toBe(true);
  });
});
