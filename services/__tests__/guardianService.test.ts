/**
 * Tests for Guardian Service
 */

// Mock constants
jest.mock('../../utils/constants', () => ({
  API: {
    GUARDIAN_WS: 'wss://test.guardian.url',
  },
  NETWORK_CONFIG: {
    vaultSdkNetwork: 'mutiny',
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

// Simplified mock SDK
const mockOnce = jest.fn();
const mockSocket = {
  once: mockOnce,
  isConnected: false,
  isError: false,
};

jest.mock('@ducat-unit/client-sdk', () => ({
  GuardianSocket: jest.fn().mockImplementation(() => mockSocket),
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
    mockOnce.mockReset();
    mockSocket.isConnected = false;
    mockSocket.isError = false;
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

    it('should be a function', () => {
      expect(typeof createGuardianClient).toBe('function');
    });

    it('should register event handlers on socket', async () => {
      // Mock ready event firing immediately
      mockOnce.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
      });

      const clientPromise = createGuardianClient({ pubkey: 'test-pubkey' });

      jest.advanceTimersByTime(100);

      const client = await clientPromise;
      expect(client).toBeDefined();
      expect(mockOnce).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOnce).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockOnce).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should timeout if no ready event', async () => {
      mockOnce.mockImplementation(() => {});

      const clientPromise = createGuardianClient({ pubkey: 'test-pubkey' });

      jest.advanceTimersByTime(31000);

      await expect(clientPromise).rejects.toThrow('Guardian connection timeout');
    });

    it('should reject non-Mutinynet guardian networks', async () => {
      await expect(
        createGuardianClient({ pubkey: 'test-pubkey', network: 'main' as never })
      ).rejects.toThrow('Mutinynet-only');
      expect(mockOnce).not.toHaveBeenCalled();
    });
  });

  describe('getGuardianClient', () => {
    it('should be defined', () => {
      expect(getGuardianClient).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof getGuardianClient).toBe('function');
    });

    it('should return a promise', () => {
      // Verify getGuardianClient returns a promise
      const result = getGuardianClient('test-pubkey');
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {}); // Catch the inevitable timeout
    });

  });

  describe('error handling', () => {
    it('should handle socket error event', async () => {
      let errorCallback: ((err: unknown) => void) | undefined;
      mockOnce.mockImplementation((event: string, callback: (err: unknown) => void) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const clientPromise = createGuardianClient({ pubkey: 'test-pubkey' });

      // Trigger error event
      if (errorCallback) {
        errorCallback(new Error('Socket error'));
      }

      jest.advanceTimersByTime(100);

      await expect(clientPromise).rejects.toThrow('Socket error');
    });

    it('should handle socket error as string', async () => {
      let errorCallback: ((err: unknown) => void) | undefined;
      mockOnce.mockImplementation((event: string, callback: (err: unknown) => void) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const clientPromise = createGuardianClient({ pubkey: 'test-pubkey' });

      // Trigger error event with string
      if (errorCallback) {
        errorCallback('connection refused');
      }

      jest.advanceTimersByTime(100);

      await expect(clientPromise).rejects.toThrow('guardian: connection refused');
    });

    it('should handle socket close event', async () => {
      let closeCallback: (() => void) | undefined;
      let readyCallback: (() => void) | undefined;
      mockOnce.mockImplementation((event: string, callback: () => void) => {
        if (event === 'close') {
          closeCallback = callback;
        }
        if (event === 'ready') {
          readyCallback = callback;
        }
      });

      const clientPromise = createGuardianClient({ pubkey: 'test-pubkey' });

      // First trigger ready to establish connection
      if (readyCallback) {
        readyCallback();
      }

      jest.advanceTimersByTime(100);

      const client = await clientPromise;
      expect(client).toBeDefined();

      // Now trigger close
      if (closeCallback) {
        closeCallback();
      }

      // Connection should be cleaned up
      expect(isGuardianConnected()).toBe(false);
    });
  });

  describe('exports', () => {
    it('should export all required functions', () => {
      expect(typeof createGuardianClient).toBe('function');
      expect(typeof getGuardianClient).toBe('function');
      expect(typeof disconnectGuardian).toBe('function');
      expect(typeof isGuardianConnected).toBe('function');
      expect(typeof withGuardianTimeout).toBe('function');
    });
  });
});
