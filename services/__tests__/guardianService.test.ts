// @ts-nocheck
/**
 * Tests for Guardian Service
 */

// Mock constants
jest.mock('../../utils/constants', () => ({
  API: {
    GUARDIAN_WS: 'wss://test.guardian.url',
  },
  VAULT_CONFIG: {
    TX_TIMEOUT: 30000,
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock SDK
const mockOnce = jest.fn();
const mockGuardianSocket = jest.fn().mockImplementation(() => ({
  once: mockOnce,
}));

jest.mock('@ducat-unit/client-sdk', () => ({
  GuardianSocket: mockGuardianSocket,
}));

import {
  createGuardianClient,
  getGuardianClient,
  disconnectGuardian,
  isGuardianConnected,
  withGuardianTimeout,
} from '../guardianService';

describe('guardianService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    disconnectGuardian();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('disconnectGuardian', () => {
    it('should not throw when no client exists', () => {
      expect(() => disconnectGuardian()).not.toThrow();
    });
  });

  describe('isGuardianConnected', () => {
    it('should return false when no client exists', () => {
      expect(isGuardianConnected()).toBe(false);
    });
  });

  describe('withGuardianTimeout', () => {
    it('should resolve if operation completes in time', async () => {
      const operation = Promise.resolve('success');
      const result = await withGuardianTimeout(operation, 1000);
      expect(result).toBe('success');
    });

    it('should reject if operation times out', async () => {
      const operation = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 2000);
      });

      const resultPromise = withGuardianTimeout(operation, 1000);

      jest.advanceTimersByTime(1500);

      await expect(resultPromise).rejects.toThrow('Guardian operation timeout');
    });

    it('should use default timeout from config', async () => {
      const operation = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 50000);
      });

      const resultPromise = withGuardianTimeout(operation);

      jest.advanceTimersByTime(31000);

      await expect(resultPromise).rejects.toThrow('Guardian operation timeout');
    });
  });

  describe('createGuardianClient', () => {
    it('should be defined', () => {
      expect(createGuardianClient).toBeDefined();
    });

    it('should be a function that creates clients', () => {
      expect(typeof createGuardianClient).toBe('function');
    });
  });

  describe('getGuardianClient', () => {
    it('should be defined', () => {
      expect(getGuardianClient).toBeDefined();
    });
  });
});
