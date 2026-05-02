/**
 * Tests for Logger Utility
 */

// Unmock logger for this test file
jest.unmock('../logger');

// Store original __DEV__ value
const originalDev = (global as Record<string, unknown>).__DEV__;

describe('logger', () => {
  let logger: ReturnType<typeof require>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to dev mode by default
    (global as Record<string, unknown>).__DEV__ = true;

    // Import logger (module reuse - __DEV__ is checked at runtime for most methods)
    logger = require('../logger').logger;

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    (global as Record<string, unknown>).__DEV__ = originalDev;
  });

  describe('debug', () => {
    it('should log debug messages in dev mode', () => {
      logger.debug('Test debug message', { foo: 'bar' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[DEBUG] Test debug message',
        { foo: 'bar' }
      );
    });

    it('should handle debug without context', () => {
      logger.debug('Simple debug');

      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] Simple debug');
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info', { user: 'test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] Test info',
        { user: 'test' }
      );
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Warning message', { code: 'WARN01' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Warning message',
        { code: 'WARN01' }
      );
    });
  });

  describe('error', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      logger.error(error, { context: 'test' });

      // In dev mode, logger.error uses console.warn to avoid red error overlay
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ERROR]',
        { name: 'Error', message: 'Test error' },
        { context: 'test' }
      );
    });

    it('should handle string errors', () => {
      logger.error('String error', { code: 'ERR01' });

      // In dev mode, logger.error uses console.warn to avoid red error overlay
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ERROR]',
        'String error',
        { code: 'ERR01' }
      );
    });
  });

  describe('transaction', () => {
    it('should track transaction flow', () => {
      logger.transaction('intent_created', { amount: 1000 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TRANSACTION] intent_created',
        expect.objectContaining({
          step: 'intent_created',
          amount: 1000,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('security', () => {
    it('should track security events', () => {
      logger.security('pin_failed', { attempts: 3 });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SECURITY] pin_failed',
        expect.objectContaining({
          event: 'pin_failed',
          attempts: 3,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('screen', () => {
    it('should track screen navigation', () => {
      logger.screen('HomeScreen', { from: 'onboarding' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[SCREEN] HomeScreen',
        { from: 'onboarding' }
      );
    });
  });

  describe('action', () => {
    it('should track user actions', () => {
      logger.action('button_click', 'ui', { button: 'send' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ACTION] ui: button_click',
        { button: 'send' }
      );
    });

    it('should use default category', () => {
      logger.action('tap');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ACTION] user_action: tap',
        {}
      );
    });
  });

  describe('wallet', () => {
    it('should track wallet operations', () => {
      logger.wallet('balance_fetch', { balance: 1000 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[WALLET] balance_fetch',
        { balance: 1000 }
      );
    });
  });

  describe('cashu', () => {
    it('should track Cashu operations', () => {
      logger.cashu('mint', { amount: 500 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CASHU] mint',
        { amount: 500 }
      );
    });
  });

  describe('api', () => {
    it('should track API calls', () => {
      logger.api('/balance', 'GET', 200, 150);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API] GET /balance -> 200',
        '(150ms)'
      );
    });

    it('should handle api call without duration', () => {
      logger.api('/test', 'GET', 200);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API] GET /test -> 200',
        ''
      );
    });
  });

  describe('auth', () => {
    it('should track auth events', () => {
      logger.auth('login', { method: 'pin' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] login',
        { method: 'pin' }
      );
    });
  });

  describe('perf', () => {
    it('should track performance metrics', () => {
      logger.perf('api_call', 250, 'ms');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PERF] api_call: 250ms'
      );
    });
  });

  describe('turbo', () => {
    it('should track turbo operations', () => {
      logger.turbo('convert', { amount: 100 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TURBO] convert',
        { amount: 100 }
      );
    });
  });

  describe('vault', () => {
    it('should track vault operations', () => {
      logger.vault('fetch', { items: 5 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[VAULT] fetch',
        { items: 5 }
      );
    });
  });

  describe('onboarding', () => {
    it('should track onboarding steps', () => {
      logger.onboarding('step_1', { completed: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ONBOARDING] step_1',
        { completed: true }
      );
    });
  });

  describe('startTransaction', () => {
    it('should create transaction with finish method', () => {
      const transaction = logger.startTransaction('test_op', 'task');

      expect(transaction).toHaveProperty('finish');
      expect(typeof transaction.finish).toBe('function');
    });

    it('should track duration when finished', () => {
      const transaction = logger.startTransaction('test_op');

      transaction.finish('ok');

      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF START] test_op');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PERF END] test_op:'),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle debug with non-object args', () => {
      logger.debug('Test', 'string', 123, true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[DEBUG] Test',
        'string',
        123,
        true
      );
    });

    it('should handle transaction finish with error status', () => {
      const transaction = logger.startTransaction('test_op');
      transaction.finish('error');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PERF END] test_op:'),
      );
    });
  });
});
