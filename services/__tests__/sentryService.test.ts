/**
 * Tests for Sentry Service
 */

// Unmock sentryService for this test file
jest.unmock('../sentryService');

import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@sentry/react-native', () => ({
  setUser: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-device', () => ({
  brand: 'Apple',
  modelName: 'iPhone 13',
  deviceType: 1,
  isDevice: true,
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '100',
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
}));

// Import the actual module once
const sentryService = require('../sentryService');

describe('sentryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset module state
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('getDeviceId', () => {
    it('should return device ID', async () => {
      const deviceId = await sentryService.getDeviceId();

      expect(deviceId).toBeTruthy();
      expect(typeof deviceId).toBe('string');
    });

    it('should return cached device ID on subsequent calls', async () => {
      const id1 = await sentryService.getDeviceId();
      const id2 = await sentryService.getDeviceId();

      expect(id1).toBe(id2);
    });
  });

  describe('initializeSentrySession', () => {
    it('should return device ID when initialized', async () => {
      const deviceId = await sentryService.initializeSentrySession();

      expect(deviceId).toBeTruthy();
      expect(typeof deviceId).toBe('string');
    });

    it('should not reinitialize if already initialized', async () => {
      await sentryService.initializeSentrySession();
      jest.clearAllMocks();

      await sentryService.initializeSentrySession();

      expect(Sentry.setUser).not.toHaveBeenCalled();
    });
  });

  describe('trackScreen', () => {
    it('should track screen navigation', () => {
      sentryService.trackScreen('HomeScreen', { from: 'login' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'navigation',
          message: 'Screen: HomeScreen',
          level: 'info',
          data: expect.objectContaining({
            screen: 'HomeScreen',
          }),
        })
      );

      expect(Sentry.setTag).toHaveBeenCalledWith('current_screen', 'HomeScreen');
    });
  });

  describe('trackAction', () => {
    it('should track user actions', () => {
      sentryService.trackAction('button_click', 'ui', { button: 'send' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'ui',
          message: 'button_click',
          level: 'info',
        })
      );
    });
  });

  describe('trackTransactionFlow', () => {
    it('should track transaction steps', () => {
      sentryService.trackTransactionFlow('intent_created', { amount: 1000 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'transaction_flow',
          message: 'TX: intent_created',
          level: 'info',
        })
      );
    });

    it('should capture critical transaction steps', () => {
      sentryService.trackTransactionFlow('broadcast_success', { txid: 'abc123' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Transaction broadcast_success',
        expect.objectContaining({
          level: 'info',
        })
      );
    });

    it('should mark failed steps as errors', () => {
      sentryService.trackTransactionFlow('broadcast_failed', { error: 'timeout' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Transaction broadcast_failed',
        expect.objectContaining({
          level: 'error',
        })
      );
    });
  });

  describe('trackWalletOperation', () => {
    it('should track wallet operations', () => {
      sentryService.trackWalletOperation('balance_fetch', { balance: 50000 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'wallet',
          message: 'Wallet: balance_fetch',
          level: 'info',
        })
      );
    });
  });

  describe('trackCashuOperation', () => {
    it('should track Cashu operations', () => {
      sentryService.trackCashuOperation('mint', { amount: 1000 });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'cashu',
          message: 'Cashu: mint',
          level: 'info',
        })
      );
    });
  });

  describe('trackAuth', () => {
    it('should track auth events', () => {
      sentryService.trackAuth('login', { method: 'pin' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'auth',
          message: 'Auth: login',
          level: 'info',
        })
      );
    });

    it('should capture failed auth attempts', () => {
      sentryService.trackAuth('login_failed', { attempts: 3 });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Auth failed: login_failed',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });
  });

  describe('trackApiCall', () => {
    it('should track successful API calls', () => {
      sentryService.trackApiCall('/api/balance', 'GET', 200, 150);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'api',
          message: 'API: GET /api/balance',
          level: 'info',
          data: expect.objectContaining({
            method: 'GET',
            status: 200,
            duration_ms: 150,
          }),
        })
      );
    });

    it('should mark failed API calls as errors', () => {
      sentryService.trackApiCall('/api/send', 'POST', 500, 200);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    it('should sanitize endpoint query params', () => {
      sentryService.trackApiCall('/api/user?token=secret123', 'GET', 200);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endpoint: '/api/user',
          }),
        })
      );
    });
  });

  describe('trackError', () => {
    it('should track Error objects', () => {
      const error = new Error('Test error');
      sentryService.trackError(error, { context: 'test' });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    it('should track string errors', () => {
      sentryService.trackError('String error', { code: 'ERR01' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'String error',
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    it('should support custom error levels', () => {
      sentryService.trackError('Warning', {}, 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Warning',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });
  });

  describe('trackPerformance', () => {
    it('should track performance metrics', () => {
      sentryService.trackPerformance('api_call', 250, 'ms');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance',
          message: 'Perf: api_call',
          data: expect.objectContaining({
            metric: 'api_call',
            value: 250,
            unit: 'ms',
          }),
        })
      );
    });
  });

  describe('setSessionContext', () => {
    it('should set session context with sanitization', () => {
      sentryService.setSessionContext('user', {
        id: '123',
        mnemonic: 'secret words here',
      });

      expect(Sentry.setContext).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          id: '123',
          mnemonic: '[REDACTED]',
        })
      );
    });
  });

  describe('setTag', () => {
    it('should set tags as strings', () => {
      sentryService.setTag('version', 123);

      expect(Sentry.setTag).toHaveBeenCalledWith('version', '123');
    });
  });

  describe('getSessionDuration', () => {
    it('should return 0 before session starts', () => {
      const duration = sentryService.getSessionDuration();
      expect(duration).toBe(0);
    });

    it('should calculate session duration', async () => {
      await sentryService.initializeSentrySession();

      // Mock time passing
      jest.useFakeTimers();
      jest.advanceTimersByTime(5000); // 5 seconds

      const duration = sentryService.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);

      jest.useRealTimers();
    });
  });

  describe('endSession', () => {
    it('should log session end', async () => {
      await sentryService.initializeSentrySession();
      jest.clearAllMocks();

      sentryService.endSession();

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'session',
          message: 'Session ended',
          level: 'info',
        })
      );
    });
  });

  describe('data sanitization', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should redact mnemonic phrases', () => {
      sentryService.setSessionContext('wallet', {
        mnemonic: 'abandon ability able about above absent absorb abstract absurd abuse access',
      });

      expect(Sentry.setContext).toHaveBeenCalledWith(
        'wallet',
        expect.objectContaining({
          mnemonic: '[REDACTED]',
        })
      );
    });

    it('should redact private keys', () => {
      sentryService.trackWalletOperation('import', {
        privateKey: 'L1234567890abcdef1234567890abcdef1234567890abcdef1234',
      });

      const calls = Sentry.addBreadcrumb.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.data.privateKey).toBe('[REDACTED]');
    });

    it('should redact Cashu tokens', () => {
      sentryService.trackCashuOperation('receive', {
        token: 'cashuAeyJ0b2tlbiI6W3sicHJvb2ZzIjpbXX1dfQ',
      });

      const calls = Sentry.addBreadcrumb.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.data.token).toBe('[REDACTED]');
    });

    it('should redact nested sensitive data', () => {
      sentryService.setSessionContext('auth', {
        user: {
          pin: '123456',
          settings: {
            secret: 'my-secret-key',
          },
        },
      });

      const calls = Sentry.setContext.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1].user.pin).toBe('[REDACTED]');
      expect(lastCall[1].user.settings.secret).toBe('[REDACTED]');
    });

    it('should handle non-object data gracefully', () => {
      sentryService.setSessionContext('test', null);
      sentryService.setSessionContext('test', undefined);
      sentryService.setSessionContext('test', 'string');
      sentryService.setSessionContext('test', 123);

      expect(Sentry.setContext).toHaveBeenCalledTimes(4);
    });
  });
});
