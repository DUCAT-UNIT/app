/**
 * Tests for turboLinkingConfig service
 */

import type { PathConfigMap } from '@react-navigation/core';

/**
 * Extended global interface for testing turbo linking config
 */
interface TurboLinkingGlobal {
  atob: jest.Mock;
  processedCashuTokens?: Set<string>;
  processedCashuTokensLoading?: boolean;
  pendingCashuToken?: string;
  pendingTurboSnackbars?: Array<{ type: string; token: string }>;
  turboJustResumed?: boolean;
}

/**
 * Type for the linking config returned by createLinkingConfig
 */
interface LinkingConfig {
  prefixes: string[];
  config: {
    screens: PathConfigMap<object>;
  };
  subscribe: (listener: (url: string) => void) => void | (() => void);
  getStateFromPath: (path: string, options: { screens: PathConfigMap<object> }) => undefined;
}

/**
 * Default options for getStateFromPath calls in tests
 */
const defaultOptions = { screens: {} };
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Type-safe global accessor for tests
const testGlobal = global as typeof global & TurboLinkingGlobal;
const mockFetchWithTimeout = jest.fn();

// Mock dependencies BEFORE imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((values) => values.ios ?? values.default),
  },
  Linking: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
    security: jest.fn(),
    screen: jest.fn(),
    action: jest.fn(),
    wallet: jest.fn(),
    cashu: jest.fn(),
    api: jest.fn(),
    auth: jest.fn(),
    perf: jest.fn(),
    turbo: jest.fn(),
    vault: jest.fn(),
    onboarding: jest.fn(),
    startTransaction: jest.fn().mockReturnValue({ finish: jest.fn() }),
    setContext: jest.fn(),
    setTag: jest.fn(),
  },
}));

jest.mock('../../../utils/api', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('../turboTokenStorage', () => ({
  hashToken: jest.fn().mockResolvedValue('mockedHash'),
  initializeTokenStorage: jest.fn().mockResolvedValue(undefined),
  turboGlobal: global as typeof globalThis & {
    processedCashuTokens?: Set<string>;
    processedCashuTokensLoading?: boolean;
    pendingCashuToken?: string;
    pendingTurboSnackbars?: unknown[];
    turboJustResumed?: boolean;
  },
}));

jest.mock('../../e2eSettingsResetService', () => ({
  E2E_ENABLE_USDC_URL_PREFIX: 'ducat://e2e/enable-usdc',
  E2E_RESET_SETTINGS_URL_PREFIX: 'ducat://e2e/reset-settings',
  enableUsdcFeaturesForE2E: jest.fn().mockResolvedValue(undefined),
  resetNonSecretE2ESettings: jest.fn().mockResolvedValue(undefined),
}));

// Mock atob for base64 decoding
testGlobal.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('utf8'));

import { Linking, AppState } from 'react-native';
import { createLinkingConfig } from '../turboLinkingConfig';
import { hashToken, initializeTokenStorage } from '../turboTokenStorage';
import {
  enableUsdcFeaturesForE2E,
  resetNonSecretE2ESettings,
} from '../../e2eSettingsResetService';

// Type assertion for the linking config
const getTypedConfig = (): LinkingConfig => createLinkingConfig() as unknown as LinkingConfig;

describe('turboLinkingConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    mockFetchWithTimeout.mockReset();
    testGlobal.atob.mockImplementation((str: string) => Buffer.from(str, 'base64').toString('utf8'));
    delete testGlobal.processedCashuTokens;
    delete testGlobal.processedCashuTokensLoading;
    delete testGlobal.pendingCashuToken;
    delete testGlobal.pendingTurboSnackbars;
    delete testGlobal.turboJustResumed;
  });

  describe('createLinkingConfig', () => {
    it('should return linking configuration object', () => {
      const config = createLinkingConfig();

      expect(config.prefixes).toBeDefined();
      expect(config.prefixes).toContain('ducat://');
      expect(config.config).toBeDefined();
      expect(config.config!.screens).toBeDefined();
      expect(typeof config.subscribe).toBe('function');
      expect(typeof config.getStateFromPath).toBe('function');
    });

    it('should include correct prefixes', () => {
      const config = createLinkingConfig();

      expect(config.prefixes).toContain('ducat://');
      expect(config.prefixes).toContain('https://ducatprotocol.com');
      expect(config.prefixes).toContain('https://www.ducatprotocol.com');
      expect(config.prefixes).toContain('https://redeem.ducatprotocol.com');
      expect(config.prefixes).toContain('https://short.ducatprotocol.com');
    });

    it('should include screen configuration', () => {
      const config = getTypedConfig();
      const screens = config.config.screens as Record<string, unknown>;

      expect(screens.Main).toBeDefined();
      const mainScreens = (screens.Main as { screens: Record<string, unknown> }).screens;
      const walletTab = mainScreens.WalletTab as { screens: Record<string, unknown> };
      expect(walletTab).toBeDefined();
      expect(walletTab.screens.WalletHome).toBe('wallet');
    });
  });

  describe('subscribe', () => {
    it('should initialize token storage on subscribe', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe!(mockListener);

      expect(initializeTokenStorage).toHaveBeenCalled();
    });

    it('should add URL event listener', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe!(mockListener);

      expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    });

    it('should add AppState listener', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe!(mockListener);

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should return unsubscribe function', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      const unsubscribe = config.subscribe!(mockListener);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getStateFromPath', () => {
    it('should return undefined for turbo URL to prevent navigation', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // getStateFromPath is now synchronous and fires async processing in background
      const result = config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);

      expect(result).toBe(undefined);
    });

    it('should return undefined for non-turbo URLs', async () => {
      const config = getTypedConfig();

      const result = config.getStateFromPath('ducat://wallet', defaultOptions);

      expect(result).toBe(undefined);
    });

    it('should return undefined for unit URL with token param', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // getStateFromPath is now synchronous and fires async processing in background
      const result = config.getStateFromPath('https://example.com/unit?t=base64token', defaultOptions);

      expect(result).toBe(undefined);
    });

    it('should store token in global for processing', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      await config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtoken123');
    });

    it('should not store duplicate tokens', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set(['mockedHash']);

      await config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBeUndefined();
      expect(testGlobal.pendingTurboSnackbars).toEqual([{
        type: 'error',
        message: 'Token already claimed',
      }]);
    });

    it('should bypass duplicate check when app just resumed', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set(['mockedHash']);
      testGlobal.turboJustResumed = true;

      await config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtoken123');
    });

    it('should handle null path', async () => {
      const config = getTypedConfig();

      const result = await config.getStateFromPath(null as unknown as string, defaultOptions);

      expect(result).toBe(undefined);
    });

    it('should consume E2E control paths without token processing', async () => {
      const config = getTypedConfig();

      const result = config.getStateFromPath(
        'ducat://e2e/enable-usdc?password=fx-570ES%20PLUS',
        defaultOptions,
      );
      await new Promise(resolve => setImmediate(resolve));

      expect(result).toBe(undefined);
      expect(enableUsdcFeaturesForE2E).toHaveBeenCalledWith('ducat://e2e/enable-usdc?password=fx-570ES%20PLUS');
      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should decode base64 token from t parameter', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // Create base64 encoded "cashuBtesttoken"
      const base64Token = Buffer.from('cashuBtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      await config.getStateFromPath(`https://example.com/unit?t=${base64Token}`, defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtesttoken');
    });

    it('should extract raw token from redeem URL token parameter', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      await config.getStateFromPath('https://redeem.ducatprotocol.com?token=cashuBtokenparam', defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtokenparam');
    });

    it('should extract raw token from unit URL hash token parameter', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      await config.getStateFromPath('https://ducatprotocol.com/unit#token=cashuBhashtoken', defaultOptions);
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBhashtoken');
    });

    it('should resolve short URLs through the shortener info API', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { cashuToken: 'cashuBshorttoken' },
        }),
      });

      await config.getStateFromPath('https://short.ducatprotocol.com/abc12345', defaultOptions);
      await flushPromises();

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://short.ducatprotocol.com/api/info/abc12345',
        { method: 'GET' },
        5000,
      );
      expect(testGlobal.pendingCashuToken).toBe('cashuBshorttoken');
    });

    it('should handle base64 decode error', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();
      testGlobal.atob.mockImplementation(() => {
        throw new Error('Invalid base64');
      });

      await config.getStateFromPath('https://example.com/unit?t=invalid!!!', defaultOptions);

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should handle URL without token param', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // URL without t= param
      await config.getStateFromPath('https://example.com/unit?other=param', defaultOptions);

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should handle URL with empty token param (t= with no value)', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // URL with t= but empty value - tests the !tokenMatch[1] branch at line 33
      await config.getStateFromPath('https://example.com/unit?t=&other=param', defaultOptions);

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should wait for processed tokens to load', async () => {
      jest.useFakeTimers();
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();
      testGlobal.processedCashuTokensLoading = true;

      // Start the getStateFromPath call
      const promise = config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);

      // Advance timers to simulate waiting
      await jest.advanceTimersByTimeAsync(500);

      // Set loading to false to allow the function to proceed
      testGlobal.processedCashuTokensLoading = false;

      await jest.advanceTimersByTimeAsync(100);

      await promise;

      expect(testGlobal.pendingCashuToken).toBe('cashuBtoken123');
      jest.useRealTimers();
    });

    it('should handle processUrlAndStoreToken error in getStateFromPath gracefully', async () => {
      const config = getTypedConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // Make hashToken throw an error to trigger the catch block at line 240
      (hashToken as jest.Mock).mockRejectedValueOnce(new Error('Hash failed'));

      // This should not throw - the error is caught and logged
      const result = config.getStateFromPath('ducat://turbo/cashuBtoken123', defaultOptions);

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      expect(result).toBe(undefined);
      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });
  });

  describe('subscribe unsubscribe', () => {
    it('should call unsubscribe function', () => {
      const config = getTypedConfig();
      const mockListener = jest.fn();
      const mockRemove = jest.fn();

      (AppState.addEventListener as jest.Mock).mockReturnValue({ remove: mockRemove });

      const unsubscribe = config.subscribe!(mockListener);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('initial URL handling', () => {
    it('should process initial URL if it contains turbo URL', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('ducat://turbo/cashuBinitialToken');

      config.subscribe!(jest.fn());

      // Wait for initial URL processing
      await new Promise(resolve => setImmediate(resolve));

      expect(testGlobal.pendingCashuToken).toBe('cashuBinitialToken');
    });

    it('should process initial URL with unit? format', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      const base64Token = Buffer.from('cashuBtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      (Linking.getInitialURL as jest.Mock).mockResolvedValue(`https://example.com/unit?t=${base64Token}`);

      config.subscribe!(jest.fn());

      // Wait for initial URL processing
      await new Promise(resolve => setImmediate(resolve));

      expect(testGlobal.pendingCashuToken).toBe('cashuBtesttoken');
    });

    it('should handle processUrlAndStoreToken error gracefully for initial URL', async () => {
      const config = createLinkingConfig();
      // Don't set processedCashuTokens - this causes hashToken to potentially fail

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('ducat://turbo/cashuBtoken');
      (hashToken as jest.Mock).mockRejectedValueOnce(new Error('Hash failed'));

      // Should not throw
      config.subscribe!(jest.fn());

      // Wait for error handling
      await new Promise(resolve => setImmediate(resolve));

      // No crash, error was caught
      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should handle getInitialURL rejection gracefully', async () => {
      const config = createLinkingConfig();

      (Linking.getInitialURL as jest.Mock).mockRejectedValue(new Error('Failed to get URL'));

      // Should not throw
      config.subscribe!(jest.fn());

      // Wait for error handling
      await new Promise(resolve => setImmediate(resolve));

      // No crash, error was caught
      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should not process initial URL if it does not contain turbo pattern', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('ducat://wallet');

      config.subscribe!(jest.fn());

      // Wait for initial URL processing
      await new Promise(resolve => setImmediate(resolve));

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });
  });

  describe('URL event handling', () => {
    it('should process turbo URL in URL event', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      // Get the URL handler registered via addEventListener
      config.subscribe!(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      // Call with a turbo URL
      await urlHandler({ url: 'ducat://turbo/cashuBtoken123' });
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtoken123');
    });

    it('should process unit URL in URL event', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      config.subscribe!(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      const base64Token = Buffer.from('cashuBtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      await urlHandler({ url: `https://example.com/unit?t=${base64Token}` });
      await flushPromises();

      expect(testGlobal.pendingCashuToken).toBe('cashuBtesttoken');
    });

    it('should ignore non-turbo URLs', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      config.subscribe!(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url: 'https://example.com/other' });

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should handle undefined URL in event', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      config.subscribe!(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url: undefined });

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });

    it('should process E2E reset URL events without forwarding to navigation', async () => {
      const config = createLinkingConfig();
      const listener = jest.fn();

      config.subscribe!(listener);
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url: 'ducat://e2e/reset-settings' });

      expect(resetNonSecretE2ESettings).toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it('should process E2E Enable USDC URL events without forwarding to navigation', async () => {
      const config = createLinkingConfig();
      const listener = jest.fn();
      const url = 'ducat://e2e/enable-usdc?password=fx-570ES%20PLUS';

      config.subscribe!(listener);
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url });

      expect(enableUsdcFeaturesForE2E).toHaveBeenCalledWith(url);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle null event', async () => {
      const config = createLinkingConfig();
      testGlobal.processedCashuTokens = new Set<string>();

      config.subscribe!(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler(null);

      expect(testGlobal.pendingCashuToken).toBeUndefined();
    });
  });

  describe('AppState handling', () => {
    it('should set turboJustResumed flag when app becomes active', () => {
      jest.useFakeTimers();
      const config = createLinkingConfig();

      // Mock AppState to start in background
      const originalCurrentState = AppState.currentState;
      AppState.currentState = 'background';

      config.subscribe!(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app becoming active
      appStateHandler('active');

      expect(testGlobal.turboJustResumed).toBe(true);

      // Advance timers to clear the flag
      jest.advanceTimersByTime(2000);

      expect(testGlobal.turboJustResumed).toBe(false);

      AppState.currentState = originalCurrentState;
      jest.useRealTimers();
    });

    it('should not set flag when going to background', () => {
      const config = createLinkingConfig();
      AppState.currentState = 'active';

      config.subscribe!(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app going to background
      appStateHandler('background');

      expect(testGlobal.turboJustResumed).toBeUndefined();
    });

    it('should handle inactive state transition', () => {
      jest.useFakeTimers();
      const config = createLinkingConfig();
      AppState.currentState = 'inactive';

      config.subscribe!(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app becoming active from inactive
      appStateHandler('active');

      expect(testGlobal.turboJustResumed).toBe(true);

      jest.useRealTimers();
    });
  });
});
