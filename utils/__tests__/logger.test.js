/**
 * Tests for Logger Utility
 */

// Unmock logger for this test file
jest.unmock('../logger');

import * as Sentry from '@sentry/react-native';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
}));

// Mock sentryService
jest.mock('../../services/sentryService', () => ({
  __esModule: true,
  default: {
    trackTransactionFlow: jest.fn(),
    trackAuth: jest.fn(),
    trackScreen: jest.fn(),
    trackAction: jest.fn(),
    trackWalletOperation: jest.fn(),
    trackCashuOperation: jest.fn(),
    trackApiCall: jest.fn(),
    trackPerformance: jest.fn(),
    setSessionContext: jest.fn(),
    setTag: jest.fn(),
  },
}));

describe('logger', () => {
  let logger;
  let sentryService;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Import after mocks are set up
    logger = require('../logger').logger;
    sentryService = require('../../services/sentryService').default;

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('debug', () => {
    it('should log debug messages in dev mode', () => {
      logger.debug('Test debug message', { foo: 'bar' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test debug message',
        level: 'debug',
        data: { foo: 'bar' },
      });
    });

    it('should handle debug without context', () => {
      logger.debug('Simple debug');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Simple debug',
        level: 'debug',
        data: {},
      });
    });

    it('should stream debug to Sentry when enabled', () => {
      logger.debug('Stream test', { data: 'value' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[DEBUG] Stream test',
        expect.objectContaining({
          level: 'debug',
          tags: {
            log_category: 'DEBUG',
            stream: 'realtime',
          },
        })
      );
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info', { user: 'test' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test info',
        level: 'info',
        data: { user: 'test' },
      });
    });

    it('should stream info to Sentry', () => {
      logger.info('Info stream', { key: 'value' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[INFO] Info stream',
        expect.objectContaining({
          level: 'info',
        })
      );
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Warning message', { code: 'WARN01' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Warning message',
        level: 'warning',
        data: { code: 'WARN01' },
      });

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
    });
  });

  describe('error', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      logger.error(error, { context: 'test' });

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        contexts: { extra: { context: 'test' } },
      });
    });

    it('should handle string errors', () => {
      logger.error('String error', { code: 'ERR01' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith('String error', {
        level: 'error',
        contexts: { extra: { code: 'ERR01' } },
      });
    });
  });

  describe('transaction', () => {
    it('should track transaction flow', () => {
      logger.transaction('intent_created', { amount: 1000 });

      expect(sentryService.trackTransactionFlow).toHaveBeenCalledWith(
        'intent_created',
        { amount: 1000 }
      );
    });
  });

  describe('security', () => {
    it('should track security events', () => {
      logger.security('pin_failed', { attempts: 3 });

      expect(sentryService.trackAuth).toHaveBeenCalledWith(
        'pin_failed',
        { attempts: 3 }
      );
    });
  });

  describe('screen', () => {
    it('should track screen navigation', () => {
      logger.screen('HomeScreen', { from: 'onboarding' });

      expect(sentryService.trackScreen).toHaveBeenCalledWith(
        'HomeScreen',
        { from: 'onboarding' }
      );
    });
  });

  describe('action', () => {
    it('should track user actions', () => {
      logger.action('button_click', 'ui', { button: 'send' });

      expect(sentryService.trackAction).toHaveBeenCalledWith(
        'button_click',
        'ui',
        { button: 'send' }
      );
    });

    it('should use default category', () => {
      logger.action('tap');

      expect(sentryService.trackAction).toHaveBeenCalledWith(
        'tap',
        'user_action',
        {}
      );
    });
  });

  describe('wallet', () => {
    it('should track wallet operations', () => {
      logger.wallet('balance_fetch', { balance: 1000 });

      expect(sentryService.trackWalletOperation).toHaveBeenCalledWith(
        'balance_fetch',
        { balance: 1000 }
      );
    });
  });

  describe('cashu', () => {
    it('should track Cashu operations', () => {
      logger.cashu('mint', { amount: 500 });

      expect(sentryService.trackCashuOperation).toHaveBeenCalledWith(
        'mint',
        { amount: 500 }
      );
    });

    it('should stream cashu operations to Sentry', () => {
      logger.cashu('receive', { proofs: 3 });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[CASHU] receive',
        expect.objectContaining({
          level: 'info',
          tags: {
            log_category: 'CASHU',
            stream: 'realtime',
          },
        })
      );
    });
  });

  describe('api', () => {
    it('should track API calls', () => {
      logger.api('/balance', 'GET', 200, 150);

      expect(sentryService.trackApiCall).toHaveBeenCalledWith(
        '/balance',
        'GET',
        200,
        150
      );
    });
  });

  describe('auth', () => {
    it('should track auth events', () => {
      logger.auth('login', { method: 'pin' });

      expect(sentryService.trackAuth).toHaveBeenCalledWith(
        'login',
        { method: 'pin' }
      );
    });

    it('should stream auth to Sentry', () => {
      logger.auth('logout');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[AUTH] logout',
        expect.objectContaining({
          level: 'info',
        })
      );
    });
  });

  describe('perf', () => {
    it('should track performance metrics', () => {
      logger.perf('api_call', 250, 'ms');

      expect(sentryService.trackPerformance).toHaveBeenCalledWith(
        'api_call',
        250,
        'ms'
      );
    });
  });

  describe('turbo', () => {
    it('should track turbo operations with breadcrumb', () => {
      logger.turbo('convert', { amount: 100 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'turbo',
        message: 'Turbo: convert',
        level: 'info',
        data: expect.objectContaining({
          operation: 'convert',
          amount: 100,
        }),
      });
    });
  });

  describe('vault', () => {
    it('should track vault operations with breadcrumb', () => {
      logger.vault('fetch', { items: 5 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'vault',
        message: 'Vault: fetch',
        level: 'info',
        data: expect.objectContaining({
          operation: 'fetch',
          items: 5,
        }),
      });
    });
  });

  describe('onboarding', () => {
    it('should track onboarding steps with breadcrumb', () => {
      logger.onboarding('step_1', { completed: true });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'onboarding',
        message: 'Onboarding: step_1',
        level: 'info',
        data: expect.objectContaining({
          step: 'step_1',
          completed: true,
        }),
      });
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

      // Wait a bit
      jest.advanceTimersByTime(100);

      transaction.finish('ok');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance',
          message: 'test_op completed',
          level: 'info',
        })
      );
    });
  });

  describe('setContext', () => {
    it('should set session context', () => {
      logger.setContext('user', { id: '123' });

      expect(sentryService.setSessionContext).toHaveBeenCalledWith(
        'user',
        { id: '123' }
      );
    });
  });

  describe('setTag', () => {
    it('should set tag', () => {
      logger.setTag('environment', 'test');

      expect(sentryService.setTag).toHaveBeenCalledWith(
        'environment',
        'test'
      );
    });
  });
});
