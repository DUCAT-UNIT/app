// @ts-nocheck
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

// Store original __DEV__ value
const originalDev = global.__DEV__;

describe('logger', () => {
  let logger;
  let sentryService;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to dev mode by default
    global.__DEV__ = true;

    // Import logger (module reuse - __DEV__ is checked at runtime for most methods)
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
    global.__DEV__ = originalDev;
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

    // Note: STREAM_TO_SENTRY is disabled by default to conserve Sentry quota
    // This test verifies the non-streaming behavior is correct
    it('should not stream debug to Sentry when streaming is disabled', () => {
      logger.debug('Stream test', { data: 'value' });

      // captureMessage should NOT be called for debug when streaming is disabled
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
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

    // Note: STREAM_TO_SENTRY is disabled by default to conserve Sentry quota
    // This test verifies the non-streaming behavior is correct
    it('should not stream info to Sentry when streaming is disabled', () => {
      logger.info('Info stream', { key: 'value' });

      // captureMessage should NOT be called for info when streaming is disabled
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
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

    // Note: STREAM_TO_SENTRY is disabled by default to conserve Sentry quota
    // This test verifies the non-streaming behavior is correct
    it('should not stream cashu operations to Sentry when streaming is disabled', () => {
      logger.cashu('receive', { proofs: 3 });

      // captureMessage should NOT be called when streaming is disabled
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
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

    // Note: STREAM_TO_SENTRY is disabled by default to conserve Sentry quota
    // This test verifies the non-streaming behavior is correct
    it('should not stream auth to Sentry when streaming is disabled', () => {
      logger.auth('logout');

      // captureMessage should NOT be called when streaming is disabled
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
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

  describe('edge cases', () => {
    it('should handle debug with non-object args', () => {
      logger.debug('Test', 'string', 123, true);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { args: ['string', 123, true] },
        })
      );
    });

    it('should handle transaction finish with error status', () => {
      const transaction = logger.startTransaction('test_op');
      transaction.finish('error');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
        })
      );
    });

    it('should handle api call without duration', () => {
      logger.api('/test', 'GET', 200);

      expect(sentryService.trackApiCall).toHaveBeenCalledWith(
        '/test',
        'GET',
        200,
        null
      );
    });
  });
});
