/**
 * Tests for Logger utility
 * These tests verify the logger integrates correctly with Sentry and sentryService
 */

describe('logger', () => {
  let logger, Sentry, sentryService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock Sentry
    jest.doMock('@sentry/react-native', () => ({
      addBreadcrumb: jest.fn(),
      captureMessage: jest.fn(),
      captureException: jest.fn(),
    }));

    // Mock sentryService
    jest.doMock('../../services/sentryService', () => ({
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

    // Set production mode
    global.__DEV__ = false;

    // Import after mocks are set up
    logger = require('../logger').logger;
    Sentry = require('@sentry/react-native');
    sentryService = require('../../services/sentryService').default;
  });

  describe('basic logging methods', () => {
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
  });

  describe('enhanced tracking methods', () => {
    it('transaction should call sentryService.trackTransactionFlow', () => {
      logger.transaction('intent_created', { txid: '123' });

      expect(sentryService.trackTransactionFlow).toHaveBeenCalledWith(
        'intent_created',
        { txid: '123' }
      );
    });

    it('security should call sentryService.trackAuth', () => {
      logger.security('pin_failed', { attempts: 3 });

      expect(sentryService.trackAuth).toHaveBeenCalledWith(
        'pin_failed',
        { attempts: 3 }
      );
    });

    it('screen should call sentryService.trackScreen', () => {
      logger.screen('HomeScreen', { tab: 'wallet' });

      expect(sentryService.trackScreen).toHaveBeenCalledWith('HomeScreen', { tab: 'wallet' });
    });

    it('api should call sentryService.trackApiCall', () => {
      logger.api('/api/test', 'GET', 200, 150);

      expect(sentryService.trackApiCall).toHaveBeenCalledWith('/api/test', 'GET', 200, 150);
    });

    it('cashu should call sentryService.trackCashuOperation', () => {
      logger.cashu('mint_started', { amount: 1000 });

      expect(sentryService.trackCashuOperation).toHaveBeenCalledWith('mint_started', { amount: 1000 });
    });

    it('wallet should call sentryService.trackWalletOperation', () => {
      logger.wallet('balance_updated', { balance: 50000 });

      expect(sentryService.trackWalletOperation).toHaveBeenCalledWith('balance_updated', { balance: 50000 });
    });
  });

  describe('startTransaction', () => {
    it('should return object with finish method', () => {
      const txn = logger.startTransaction('test_operation');

      expect(txn).toHaveProperty('finish');
      expect(typeof txn.finish).toBe('function');
    });

    it('should call sentryService.trackPerformance on finish', () => {
      const txn = logger.startTransaction('test_operation');
      txn.finish('ok');

      expect(sentryService.trackPerformance).toHaveBeenCalledWith(
        'test_operation',
        expect.any(Number),
        'ms'
      );
    });

    it('should add breadcrumb on finish', () => {
      const txn = logger.startTransaction('test_operation');
      txn.finish('ok');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance',
          message: 'test_operation completed',
          level: 'info',
        })
      );
    });
  });

  describe('context and tags', () => {
    it('setContext should call sentryService.setSessionContext', () => {
      logger.setContext('wallet', { balance: 1000 });

      expect(sentryService.setSessionContext).toHaveBeenCalledWith('wallet', { balance: 1000 });
    });

    it('setTag should call sentryService.setTag', () => {
      logger.setTag('version', '1.0.0');

      expect(sentryService.setTag).toHaveBeenCalledWith('version', '1.0.0');
    });
  });
});
