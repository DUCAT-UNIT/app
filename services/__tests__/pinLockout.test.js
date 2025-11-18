/**
 * Tests for PIN Lockout Management
 */

import {
  loadLockoutState,
  saveLockoutState,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
  recordFailedAttempt,
  getMaxPinAttempts,
} from '../pinLockout';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('loadLockoutState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load lockout state from secure storage', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_failed_attempts') return Promise.resolve('3');
      if (key === 'pin_lockout_until') return Promise.resolve('1234567890');
      return Promise.resolve(null);
    });

    const state = await loadLockoutState();

    expect(state).toEqual({
      failedAttempts: 3,
      lockoutUntil: 1234567890,
    });
  });

  it('should return defaults when no data in storage', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);

    const state = await loadLockoutState();

    expect(state).toEqual({
      failedAttempts: 0,
      lockoutUntil: null,
    });
  });

  it('should handle storage errors gracefully', async () => {
    SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

    const state = await loadLockoutState();

    expect(state).toEqual({
      failedAttempts: 0,
      lockoutUntil: null,
    });
  });

  it('should parse failed attempts as integer', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_failed_attempts') return Promise.resolve('5');
      return Promise.resolve(null);
    });

    const state = await loadLockoutState();

    expect(state.failedAttempts).toBe(5);
  });

  it('should parse lockout time as integer', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_lockout_until') return Promise.resolve('9876543210');
      return Promise.resolve(null);
    });

    const state = await loadLockoutState();

    expect(state.lockoutUntil).toBe(9876543210);
  });
});

describe('saveLockoutState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save lockout state to secure storage', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    await saveLockoutState(5, 1234567890);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '5');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_lockout_until', '1234567890');
  });

  it('should delete lockout time when null', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    await saveLockoutState(2, null);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '2');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pin_lockout_until');
  });

  it('should throw error when storage fails (security critical)', async () => {
    SecureStore.setItemAsync.mockRejectedValue(new Error('Storage full'));

    await expect(saveLockoutState(3, null)).rejects.toThrow(
      'Unable to enforce rate limiting. Access denied for security.'
    );
  });

  it('should save zero failed attempts', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    await saveLockoutState(0, null);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '0');
  });
});

describe('checkPinLockout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return locked status when lockout is active', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_lockout_until') return Promise.resolve('2000000'); // Future time
      return Promise.resolve(null);
    });

    const result = await checkPinLockout();

    expect(result.isLocked).toBe(true);
    expect(result.remainingTime).toBeGreaterThan(0);
  });

  it('should return not locked when no lockout', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);

    const result = await checkPinLockout();

    expect(result.isLocked).toBe(false);
    expect(result.remainingTime).toBeUndefined();
  });

  it('should clear expired lockout', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_lockout_until') return Promise.resolve('500000'); // Past time
      return Promise.resolve(null);
    });
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    const result = await checkPinLockout();

    expect(result.isLocked).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '0');
  });

  it('should calculate remaining time in minutes', async () => {
    const lockoutUntil = 1000000 + (15 * 60 * 1000); // 15 minutes from now
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_lockout_until') return Promise.resolve(lockoutUntil.toString());
      return Promise.resolve(null);
    });

    const result = await checkPinLockout();

    expect(result.isLocked).toBe(true);
    expect(result.remainingTime).toBe(15);
  });
});

describe('resetPinAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reset attempts to zero and clear lockout', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    await resetPinAttempts();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '0');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pin_lockout_until');
  });
});

describe('getRemainingPinAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return remaining attempts', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_failed_attempts') return Promise.resolve('3');
      return Promise.resolve(null);
    });

    const remaining = await getRemainingPinAttempts();

    // Assuming MAX_PIN_ATTEMPTS is 10
    expect(remaining).toBe(7);
  });

  it('should return full attempts when no failures', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);

    const remaining = await getRemainingPinAttempts();

    // Assuming MAX_PIN_ATTEMPTS is 10
    expect(remaining).toBe(10);
  });

  it('should return 0 when attempts exhausted', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_failed_attempts') return Promise.resolve('10');
      return Promise.resolve(null);
    });

    const remaining = await getRemainingPinAttempts();

    expect(remaining).toBe(0);
  });

  it('should not return negative attempts', async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'pin_failed_attempts') return Promise.resolve('15');
      return Promise.resolve(null);
    });

    const remaining = await getRemainingPinAttempts();

    expect(remaining).toBe(0);
  });
});

describe('recordFailedAttempt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should increment failed attempts', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    const result = await recordFailedAttempt(3);

    expect(result.newFailedAttempts).toBe(4);
    expect(result.shouldLockout).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '4');
  });

  it('should trigger lockout when max attempts reached', async () => {
    SecureStore.setItemAsync.mockResolvedValue();

    const result = await recordFailedAttempt(9); // 10th attempt

    expect(result.newFailedAttempts).toBe(10);
    expect(result.shouldLockout).toBe(true);
    expect(result.lockoutUntil).toBeGreaterThan(1000000);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_failed_attempts', '10');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'pin_lockout_until',
      expect.any(String)
    );
  });

  it('should not lockout before max attempts', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    const result = await recordFailedAttempt(5);

    expect(result.shouldLockout).toBe(false);
    expect(result.lockoutUntil).toBeUndefined();
  });

  it('should set lockout duration correctly', async () => {
    SecureStore.setItemAsync.mockResolvedValue();
    const currentTime = 1000000;
    Date.now.mockReturnValue(currentTime);

    const result = await recordFailedAttempt(9);

    // Lockout duration is 30 minutes = 1800000ms
    expect(result.lockoutUntil).toBe(currentTime + 1800000);
  });
});

describe('getMaxPinAttempts', () => {
  it('should return max PIN attempts constant', () => {
    const max = getMaxPinAttempts();

    expect(typeof max).toBe('number');
    expect(max).toBeGreaterThan(0);
  });
});
