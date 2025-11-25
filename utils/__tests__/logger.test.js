/**
 * Tests for Logger utility
 * These tests verify the logger interface and mock are properly configured
 */

const { logger } = require('../logger');

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger interface', () => {
    it('should have all required methods', () => {
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('transaction');
      expect(logger).toHaveProperty('security');
      expect(logger).toHaveProperty('screen');
      expect(logger).toHaveProperty('action');
      expect(logger).toHaveProperty('wallet');
      expect(logger).toHaveProperty('cashu');
      expect(logger).toHaveProperty('api');
      expect(logger).toHaveProperty('auth');
      expect(logger).toHaveProperty('perf');
      expect(logger).toHaveProperty('turbo');
      expect(logger).toHaveProperty('vault');
      expect(logger).toHaveProperty('onboarding');
      expect(logger).toHaveProperty('startTransaction');
      expect(logger).toHaveProperty('setContext');
      expect(logger).toHaveProperty('setTag');
    });

    it('debug method should be callable', () => {
      expect(() => logger.debug('test', {})).not.toThrow();
    });

    it('info method should be callable', () => {
      expect(() => logger.info('test', {})).not.toThrow();
    });

    it('warn method should be callable', () => {
      expect(() => logger.warn('test', {})).not.toThrow();
    });

    it('error method should be callable', () => {
      expect(() => logger.error('test', {})).not.toThrow();
      expect(() => logger.error(new Error('test'), {})).not.toThrow();
    });

    it('transaction method should be callable', () => {
      expect(() => logger.transaction('intent_created', {})).not.toThrow();
    });

    it('security method should be callable', () => {
      expect(() => logger.security('pin_failed', {})).not.toThrow();
    });

    it('screen method should be callable', () => {
      expect(() => logger.screen('HomeScreen', {})).not.toThrow();
    });

    it('api method should be callable', () => {
      expect(() => logger.api('/api/test', 'GET', 200, 150)).not.toThrow();
    });

    it('cashu method should be callable', () => {
      expect(() => logger.cashu('mint_started', {})).not.toThrow();
    });

    it('wallet method should be callable', () => {
      expect(() => logger.wallet('balance_updated', {})).not.toThrow();
    });

    it('startTransaction should return object with finish method', () => {
      const txn = logger.startTransaction('test_operation');
      expect(txn).toHaveProperty('finish');
      expect(typeof txn.finish).toBe('function');
      expect(() => txn.finish()).not.toThrow();
    });

    it('setContext method should be callable', () => {
      expect(() => logger.setContext('wallet', {})).not.toThrow();
    });

    it('setTag method should be callable', () => {
      expect(() => logger.setTag('version', '1.0.0')).not.toThrow();
    });
  });
});
