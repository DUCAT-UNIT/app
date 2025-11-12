/**
 * Jest Setup File
 * Mocks for Expo and React Native modules
 */

// Define __DEV__ for React Native environment
global.__DEV__ = process.env.NODE_ENV !== 'production';

// Polyfill for Buffer
global.Buffer = require('buffer').Buffer;

// Polyfill for crypto.getRandomValues (needed by expo-crypto)
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

// Suppress expo winter import warnings
global.__ExpoImportMetaRegistry = {};

// Mock expo module to bypass winter
jest.mock('expo', () => ({}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
}));

// Mock expo-crypto with real crypto implementation for testing
jest.mock('expo-crypto', () => {
  const { webcrypto, createHash } = require('node:crypto');
  return {
    getRandomBytesAsync: async (size) => {
      const buffer = new Uint8Array(size);
      webcrypto.getRandomValues(buffer);
      return buffer;
    },
    digestStringAsync: async (algorithm, data) => {
      // Map Expo algorithm names to Node crypto algorithm names
      const algoMap = {
        'SHA-256': 'sha256',
        'SHA-384': 'sha384',
        'SHA-512': 'sha512',
      };
      const hashAlgo = algoMap[algorithm] || 'sha256';
      return createHash(hashAlgo).update(data).digest('hex');
    },
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
      SHA384: 'SHA-384',
      SHA512: 'SHA-512',
    },
  };
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock React Native core modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(),
      _value: 0,
    })),
    timing: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback()),
    })),
    spring: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback()),
    })),
    View: 'Animated.View',
  },
  PanResponder: {
    create: jest.fn((config) => ({
      panHandlers: {
        onStartShouldSetResponder: config.onStartShouldSetPanResponder || (() => false),
        onMoveShouldSetResponder: config.onMoveShouldSetPanResponder || (() => false),
        onResponderGrant: config.onPanResponderGrant || (() => {}),
        onResponderMove: config.onPanResponderMove || (() => {}),
        onResponderRelease: config.onPanResponderRelease || (() => {}),
      },
    })),
  },
}));
