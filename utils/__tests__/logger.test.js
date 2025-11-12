/**
 * Tests for Logger utility
 */

describe('logger', () => {
  let logger, Sentry;

  beforeEach(() => {
    // Clear module cache to allow re-importing with different __DEV__ values
    jest.resetModules();
    jest.clearAllMocks();

    // Mock Sentry
    jest.mock('@sentry/react-native', () => ({
      addBreadcrumb: jest.fn(),
      captureMessage: jest.fn(),
      captureException: jest.fn(),
    }));
  });

  describe('production mode (__DEV__ = false)', () => {
    beforeEach(() => {
      global.__DEV__ = false;
      // Re-import logger after setting __DEV__
      logger = require('../logger').logger;
      Sentry = require('@sentry/react-native');
    });

    it('debug should add breadcrumb to Sentry', () => {
      logger.debug('Test debug message', { key: 'value' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test debug message',
        level: 'debug',
        data: { key: 'value' },
      });
    });

    it('info should add breadcrumb to Sentry', () => {
      logger.info('Test info message', { data: 'test' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test info message',
        level: 'info',
        data: { data: 'test' },
      });
    });

    it('warn should add breadcrumb and capture message', () => {
      logger.warn('Test warning', { warning: 'data' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test warning',
        level: 'warning',
        data: { warning: 'data' },
      });
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test warning', 'warning');
    });

    it('error should capture Error objects', () => {
      const error = new Error('Test error');

      logger.error(error, { context: 'data' });

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        contexts: { extra: { context: 'data' } },
      });
    });

    it('error should capture string errors as messages', () => {
      logger.error('String error', { context: 'data' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith('String error', {
        level: 'error',
        contexts: { extra: { context: 'data' } },
      });
    });

    it('transaction should add breadcrumb with category', () => {
      logger.transaction('intent_created', { txid: '123' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'transaction',
        message: 'Transaction: intent_created',
        level: 'info',
        data: expect.objectContaining({
          step: 'intent_created',
          txid: '123',
          timestamp: expect.any(String),
        }),
      });
    });

    it('security should add breadcrumb with warning level', () => {
      logger.security('pin_failed', { attempts: 3 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'security',
        message: 'Security: pin_failed',
        level: 'warning',
        data: expect.objectContaining({
          event: 'pin_failed',
          attempts: 3,
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('development mode (__DEV__ = true)', () => {
    beforeEach(() => {
      global.__DEV__ = true;
      // Re-import logger after setting __DEV__
      logger = require('../logger').logger;
      Sentry = require('@sentry/react-native');
    });

    it('debug should use console.log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.debug('Test debug message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] Test debug message', { key: 'value' });
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('info should use console.log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test info', { data: 'test' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Test info', { data: 'test' });
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('warn should use console.warn', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning', { warning: 'data' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Test warning', { warning: 'data' });
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('error should use console.error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');

      logger.error(error, { context: 'data' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', error, { context: 'data' });
      expect(Sentry.captureException).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('transaction should use console.log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.transaction('signed', { txid: '456' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TRANSACTION] signed',
        expect.objectContaining({
          step: 'signed',
          txid: '456',
          timestamp: expect.any(String),
        })
      );
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('security should use console.warn', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.security('lockout', { duration: '30min' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SECURITY] lockout',
        expect.objectContaining({
          event: 'lockout',
          duration: '30min',
          timestamp: expect.any(String),
        })
      );
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      global.__DEV__ = false;
      logger = require('../logger').logger;
      Sentry = require('@sentry/react-native');
    });

    it('should handle missing context parameter', () => {
      logger.debug('Test message');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test message',
        level: 'debug',
        data: {},
      });
    });

    it('should handle missing data in transaction', () => {
      logger.transaction('completed');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'transaction',
        message: 'Transaction: completed',
        level: 'info',
        data: expect.objectContaining({
          step: 'completed',
          timestamp: expect.any(String),
        }),
      });
    });

    it('should handle missing data in security', () => {
      logger.security('unauthorized_access');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'security',
        message: 'Security: unauthorized_access',
        level: 'warning',
        data: expect.objectContaining({
          event: 'unauthorized_access',
          timestamp: expect.any(String),
        }),
      });
    });

    it('should include ISO timestamp in transaction logs', () => {
      logger.transaction('broadcast', { amount: '1.5 BTC' });

      const call = Sentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include ISO timestamp in security logs', () => {
      logger.security('biometric_failed', { reason: 'timeout' });

      const call = Sentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle error without context', () => {
      const error = new Error('Test error');

      logger.error(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        contexts: { extra: {} },
      });
    });
  });
});
