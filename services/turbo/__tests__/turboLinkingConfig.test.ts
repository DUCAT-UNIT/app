/**
 * Tests for turboLinkingConfig service
 */

// Mock dependencies BEFORE imports
jest.mock('react-native', () => ({
  Linking: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
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

jest.mock('../turboTokenStorage', () => ({
  hashToken: jest.fn().mockResolvedValue('mockedHash'),
  initializeTokenStorage: jest.fn().mockResolvedValue(),
}));

// Mock atob for base64 decoding
(global as any).atob = jest.fn((str) => Buffer.from(str, 'base64').toString('utf8'));

import { Linking, AppState } from 'react-native';
import { createLinkingConfig } from '../turboLinkingConfig';
import { hashToken, initializeTokenStorage } from '../turboTokenStorage';

describe('turboLinkingConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).atob.mockImplementation((str) => Buffer.from(str, 'base64').toString('utf8'));
    delete (global as any).processedCashuTokens;
    delete (global as any).processedCashuTokensLoading;
    delete (global as any).pendingCashuToken;
    delete (global as any).pendingTurboSnackbars;
    delete (global as any).turboJustResumed;
  });

  describe('createLinkingConfig', () => {
    it('should return linking configuration object', () => {
      const config = createLinkingConfig();

      expect(config.prefixes).toBeDefined();
      expect(config.prefixes).toContain('ducat://');
      expect(config.config).toBeDefined();
      expect(config.config.screens).toBeDefined();
      expect(typeof config.subscribe).toBe('function');
      expect(typeof config.getStateFromPath).toBe('function');
    });

    it('should include correct prefixes', () => {
      const config = createLinkingConfig();

      expect(config.prefixes).toContain('ducat://');
      expect(config.prefixes).toContain('https://ducatprotocol.com');
      expect(config.prefixes).toContain('https://www.ducatprotocol.com');
    });

    it('should include screen configuration', () => {
      const config = createLinkingConfig();

      expect(config.config.screens.Main).toBeDefined();
      expect(config.config.screens.Main.screens.Wallet).toBeDefined();
      expect(config.config.screens.NotFound).toBe('*');
    });
  });

  describe('subscribe', () => {
    it('should initialize token storage on subscribe', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe(mockListener);

      expect(initializeTokenStorage).toHaveBeenCalled();
    });

    it('should add URL event listener', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe(mockListener);

      expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    });

    it('should add AppState listener', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      config.subscribe(mockListener);

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should return unsubscribe function', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();

      const unsubscribe = config.subscribe(mockListener);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getStateFromPath', () => {
    it('should return null for turbo URL to prevent navigation', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      const result = await config.getStateFromPath('ducat://turbo/cashuAtoken123', {});

      expect(result).toBe(null);
    });

    it('should return undefined for non-turbo URLs', async () => {
      const config = createLinkingConfig();

      const result = await config.getStateFromPath('ducat://wallet', {});

      expect(result).toBe(undefined);
    });

    it('should return null for unit URL with token param', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      const result = await config.getStateFromPath('https://example.com/unit?t=base64token', {});

      expect(result).toBe(null);
    });

    it('should store token in global for processing', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      await config.getStateFromPath('ducat://turbo/cashuAtoken123', {});

      expect((global as any).pendingCashuToken).toBe('cashuAtoken123');
    });

    it('should not store duplicate tokens', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set(['mockedHash']);

      await config.getStateFromPath('ducat://turbo/cashuAtoken123', {});

      expect((global as any).pendingCashuToken).toBeUndefined();
      expect((global as any).pendingTurboSnackbars).toEqual([{
        type: 'error',
        action: 'claim',
        description: 'Token already claimed',
      }]);
    });

    it('should bypass duplicate check when app just resumed', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set(['mockedHash']);
      (global as any).turboJustResumed = true;

      await config.getStateFromPath('ducat://turbo/cashuAtoken123', {});

      expect((global as any).pendingCashuToken).toBe('cashuAtoken123');
    });

    it('should handle null path', async () => {
      const config = createLinkingConfig();

      const result = await config.getStateFromPath(null, {});

      expect(result).toBe(undefined);
    });

    it('should decode base64 token from t parameter', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      // Create base64 encoded "cashuAtesttoken"
      const base64Token = Buffer.from('cashuAtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      await config.getStateFromPath(`https://example.com/unit?t=${base64Token}`, {});

      expect((global as any).pendingCashuToken).toBe('cashuAtesttoken');
    });

    it('should handle base64 decode error', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();
      (global as any).atob.mockImplementation(() => {
        throw new Error('Invalid base64');
      });

      await config.getStateFromPath('https://example.com/unit?t=invalid!!!', {});

      expect((global as any).pendingCashuToken).toBeUndefined();
    });

    it('should handle URL without token param', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      // URL without t= param
      await config.getStateFromPath('https://example.com/unit?other=param', {});

      expect((global as any).pendingCashuToken).toBeUndefined();
    });

    it('should wait for processed tokens to load', async () => {
      jest.useFakeTimers();
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();
      (global as any).processedCashuTokensLoading = true;

      // Start the getStateFromPath call
      const promise = config.getStateFromPath('ducat://turbo/cashuAtoken123', {});

      // Advance timers to simulate waiting
      await jest.advanceTimersByTimeAsync(500);

      // Set loading to false to allow the function to proceed
      (global as any).processedCashuTokensLoading = false;

      await jest.advanceTimersByTimeAsync(100);

      await promise;

      expect((global as any).pendingCashuToken).toBe('cashuAtoken123');
      jest.useRealTimers();
    });
  });

  describe('subscribe unsubscribe', () => {
    it('should call unsubscribe function', () => {
      const config = createLinkingConfig();
      const mockListener = jest.fn();
      const mockRemove = jest.fn();

      (AppState.addEventListener as jest.Mock).mockReturnValue({ remove: mockRemove });

      const unsubscribe = config.subscribe(mockListener);
      unsubscribe();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('URL event handling', () => {
    it('should process turbo URL in URL event', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      // Get the URL handler registered via addEventListener
      config.subscribe(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      // Call with a turbo URL
      await urlHandler({ url: 'ducat://turbo/cashuAtoken123' });

      expect((global as any).pendingCashuToken).toBe('cashuAtoken123');
    });

    it('should process unit URL in URL event', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      config.subscribe(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      const base64Token = Buffer.from('cashuAtesttoken').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      await urlHandler({ url: `https://example.com/unit?t=${base64Token}` });

      expect((global as any).pendingCashuToken).toBe('cashuAtesttoken');
    });

    it('should ignore non-turbo URLs', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      config.subscribe(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url: 'https://example.com/other' });

      expect((global as any).pendingCashuToken).toBeUndefined();
    });

    it('should handle undefined URL in event', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      config.subscribe(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler({ url: undefined });

      expect((global as any).pendingCashuToken).toBeUndefined();
    });

    it('should handle null event', async () => {
      const config = createLinkingConfig();
      (global as any).processedCashuTokens = new Set();

      config.subscribe(jest.fn());
      const urlHandler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      await urlHandler(null);

      expect((global as any).pendingCashuToken).toBeUndefined();
    });
  });

  describe('AppState handling', () => {
    it('should set turboJustResumed flag when app becomes active', () => {
      jest.useFakeTimers();
      const config = createLinkingConfig();

      // Mock AppState to start in background
      const originalCurrentState = AppState.currentState;
      AppState.currentState = 'background';

      config.subscribe(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app becoming active
      appStateHandler('active');

      expect((global as any).turboJustResumed).toBe(true);

      // Advance timers to clear the flag
      jest.advanceTimersByTime(2000);

      expect((global as any).turboJustResumed).toBe(false);

      AppState.currentState = originalCurrentState;
      jest.useRealTimers();
    });

    it('should not set flag when going to background', () => {
      const config = createLinkingConfig();
      AppState.currentState = 'active';

      config.subscribe(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app going to background
      appStateHandler('background');

      expect((global as any).turboJustResumed).toBeUndefined();
    });

    it('should handle inactive state transition', () => {
      jest.useFakeTimers();
      const config = createLinkingConfig();
      AppState.currentState = 'inactive';

      config.subscribe(jest.fn());
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate app becoming active from inactive
      appStateHandler('active');

      expect((global as any).turboJustResumed).toBe(true);

      jest.useRealTimers();
    });
  });
});
