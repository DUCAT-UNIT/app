/**
 * Jest Setup File
 * Mocks for Expo and React Native modules
 */

// Define __DEV__ for React Native environment
global.__DEV__ = process.env.NODE_ENV !== 'production';

// Configure React act() environment for testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress noisy test output that doesn't indicate real problems
// Helper to check if message should be suppressed
const shouldSuppressMessage = (message) => {
  if (typeof message !== 'string') return false;

  // React test warnings (deprecation and act)
  if (message.includes('react-test-renderer is deprecated')) return true;
  if (message.includes('not wrapped in act(...)')) return true;
  if (message.includes('inside a test was not wrapped in act')) return true;
  if (message.includes('current testing environment is not configured to support act')) return true;
  if (message.includes('act(async () => ...) without await')) return true;

  return false;
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (!shouldSuppressMessage(args[0])) {
    originalConsoleError.apply(console, args);
  }
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (!shouldSuppressMessage(args[0])) {
    originalConsoleWarn.apply(console, args);
  }
};

// eslint-disable-next-line no-console
const originalConsoleLog = console.log;
// eslint-disable-next-line no-console
console.log = (...args) => {
  if (!shouldSuppressMessage(args[0])) {
    originalConsoleLog.apply(console, args);
  }
};

// Setup process.env for Expo environment variables
process.env.EXPO_PUBLIC_COINGECKO_API_KEY = 'test-api-key';

// Polyfill for Buffer
global.Buffer = require('buffer').Buffer;

// Polyfill for crypto.getRandomValues (needed by expo-crypto)
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

// Suppress expo winter import warnings and runtime
global.__ExpoImportMetaRegistry = {};
global.__expo_import_meta_env__ = {};

// Mock expo module to bypass winter - use a more complete mock
jest.mock('expo', () => ({
  // Add any expo exports needed here
}));

// Mock react-native-passkey
jest.mock('react-native-passkey', () => ({
  Passkey: {
    isSupported: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({
      id: 'mock-passkey-id',
      rawId: 'mock-raw-id',
    }),
    get: jest.fn().mockResolvedValue({
      id: 'mock-passkey-id',
      rawId: 'mock-raw-id',
    }),
  },
}));

// Mock react-native-icloudstore
jest.mock('react-native-icloudstore', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-secure-store (getItemAsync returns null by default, matching real SecureStore behavior)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 8,
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  brand: 'Apple',
  modelName: 'iPhone 15',
  deviceType: 1, // Phone
  isDevice: true,
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  applicationId: 'com.ducat.wallet',
  applicationName: 'Ducat',
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: { eas: { projectId: 'mock-project-id' } },
    },
    easConfig: { projectId: 'mock-project-id' },
  },
}));

// Mock expo-crypto with real crypto implementation for testing
jest.mock('expo-crypto', () => {
  const { webcrypto: nodeWebcrypto, createHash, randomBytes } = require('node:crypto');
  return {
    // Synchronous version - used by secureStorageService and crypto-heavy hooks
    getRandomBytes: (size) => {
      return new Uint8Array(randomBytes(size));
    },
    // Async version
    getRandomBytesAsync: async (size) => {
      const buffer = new Uint8Array(size);
      nodeWebcrypto.getRandomValues(buffer);
      return buffer;
    },
    // Synchronous digest
    digest: (algorithm, data) => {
      const algoMap = {
        'SHA-256': 'sha256',
        SHA256: 'sha256',
        'SHA-384': 'sha384',
        'SHA-512': 'sha512',
      };
      const hashAlgo = algoMap[algorithm] || 'sha256';
      const hash = createHash(hashAlgo).update(Buffer.from(data));
      return new Uint8Array(hash.digest());
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
  getItem: jest.fn((key) => {
    const SecureStore = require('expo-secure-store');
    if (SecureStore?.getItemAsync?.mock) {
      return SecureStore.getItemAsync(key);
    }
    return Promise.resolve(null);
  }),
  setItem: jest.fn((key, value) => {
    const SecureStore = require('expo-secure-store');
    if (SecureStore?.setItemAsync?.mock) {
      return SecureStore.setItemAsync(key, value);
    }
    return Promise.resolve(undefined);
  }),
  removeItem: jest.fn((key) => {
    const SecureStore = require('expo-secure-store');
    if (SecureStore?.deleteItemAsync?.mock) {
      return SecureStore.deleteItemAsync(key);
    }
    return Promise.resolve(undefined);
  }),
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

// Mock expo-av (for Audio)
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        },
        status: { isLoaded: true },
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token]' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: {
    MAX: 'max',
    HIGH: 'high',
    DEFAULT: 'default',
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
  },
}));

// Mock logger - use factory function with shared object for both exports
jest.mock('./utils/logger', () => {
  const loggerMock = {
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
  };
  return {
    __esModule: true,
    logger: loggerMock,
    default: loggerMock,
  };
});

// Mock notify - provides notification helper functions
jest.mock('./utils/notify', () => ({
  notify: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    snackbar: jest.fn(),
    dismiss: jest.fn(),
    operationFailed: jest.fn(),
    auth: {
      required: jest.fn(),
      requiredForNotifications: jest.fn(),
      requiredForDeleteWallet: jest.fn(),
      requiredForFaceId: jest.fn(),
    },
    settings: {
      enabled: jest.fn(),
      disabled: jest.fn(),
      failed: jest.fn(),
      faceIdEnabled: jest.fn(),
      faceIdDisabled: jest.fn(),
      faceIdFailed: jest.fn(),
      notificationsEnabled: jest.fn(),
      notificationsDisabled: jest.fn(),
      notificationsFailed: jest.fn(),
    },
    wallet: {
      saveFailed: jest.fn(),
      deleted: jest.fn(),
      deleteFailed: jest.fn(),
    },
    passkey: {
      notSupported: jest.fn(),
      created: jest.fn(),
      restored: jest.fn(),
      noWallet: jest.fn(),
      restoreFailed: jest.fn(),
      walletCreationFailed: jest.fn(),
      walletRestoreFailed: jest.fn(),
      icloudFailed: jest.fn(),
      creationFailed: jest.fn(),
      pinProcessFailed: jest.fn(),
    },
    pin: {
      invalid: jest.fn(),
      mismatch: jest.fn(),
      changed: jest.fn(),
    },
    seed: {
      incomplete: jest.fn(),
      incorrect: jest.fn(),
    },
    token: {
      checking: jest.fn(),
      claiming: jest.fn(),
      claimingUnspent: jest.fn(),
      extractFailed: jest.fn(),
      extractError: jest.fn(),
      unknownFormat: jest.fn(),
    },
    cashu: {
      cacheCleared: jest.fn(),
      cacheClearFailed: jest.fn(),
      navigationFailed: jest.fn(),
      conversionStartFailed: jest.fn(),
      conversionComplete: jest.fn(),
      conversionFailed: jest.fn(),
      paymentSentAwaiting: jest.fn(),
      topupStartFailed: jest.fn(),
      lockedTokensCleared: jest.fn(),
      lockedTokensClearFailed: jest.fn(),
      recoveringChange: jest.fn(),
    },
    clipboard: {
      linkCopied: jest.fn(),
    },
    link: {
      shareFailed: jest.fn(),
      copyFailed: jest.fn(),
      openFailed: jest.fn(),
    },
    transaction: {
      pending: jest.fn(),
      success: jest.fn(),
    },
    build: {
      error: jest.fn(),
      missingRecipientAmount: jest.fn(),
      assetRequired: jest.fn(),
    },
  },
}));

// Mock React Native core modules
jest.mock('react-native', () => {
  const _React = require('react');

  return {
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
      flatten: jest.fn((styles) => styles),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
    AppState: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      currentState: 'active',
    },
    InteractionManager: {
      runAfterInteractions: jest.fn((callback) => {
        const handle = {
          cancel: jest.fn(),
        };
        if (typeof callback === 'function') {
          callback();
        }
        return handle;
      }),
    },
    Animated: {
      Value: jest.fn((initialValue) => {
        const animatedValue = {
          _value: initialValue || 0,
          setValue: jest.fn(function (value) {
            this._value = value;
          }),
          interpolate: jest.fn(),
        };
        return animatedValue;
      }),
      timing: jest.fn((animatedValue, config) => ({
        start: jest.fn((callback) => {
          // Update the value immediately in tests
          if (animatedValue && config && config.toValue !== undefined) {
            animatedValue._value = config.toValue;
          }
          callback && callback();
        }),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
      })),
      parallel: jest.fn((_animations) => ({
        start: jest.fn((callback) => callback && callback()),
      })),
      View: 'Animated.View',
    },
    PanResponder: {
      create: jest.fn((config) => ({
        panHandlers: {
          onStartShouldSetResponder: config.onStartShouldSetPanResponder || (() => false),
          onMoveShouldSetResponder: config.onMoveShouldSetPanResponder || (() => false),
          onStartShouldSetPanResponder: config.onStartShouldSetPanResponder || (() => false),
          onMoveShouldSetPanResponder: config.onMoveShouldSetPanResponder || (() => false),
          onResponderGrant: config.onPanResponderGrant || (() => {}),
          onResponderMove: config.onPanResponderMove || (() => {}),
          onResponderRelease: config.onPanResponderRelease || (() => {}),
          onPanResponderGrant: config.onPanResponderGrant || (() => {}),
          onPanResponderMove: config.onPanResponderMove || (() => {}),
          onPanResponderRelease: config.onPanResponderRelease || (() => {}),
        },
      })),
    },
    // Mock basic React Native components - must return JSX-like structure
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    ScrollView: 'ScrollView',
    Image: 'Image',
    Modal: 'Modal',
    ActivityIndicator: 'ActivityIndicator',
    Share: {
      share: jest.fn(),
    },
    Linking: {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockResolvedValue(undefined),
      openSettings: jest.fn().mockResolvedValue(undefined),
    },
    Vibration: {
      vibrate: jest.fn(),
      cancel: jest.fn(),
    },
    LayoutAnimation: {
      configureNext: jest.fn(),
      create: jest.fn((_duration, _type, _property) => ({})),
      Types: {
        linear: 'linear',
        easeInEaseOut: 'easeInEaseOut',
        easeIn: 'easeIn',
        easeOut: 'easeOut',
        spring: 'spring',
      },
      Properties: {
        opacity: 'opacity',
        scaleX: 'scaleX',
        scaleY: 'scaleY',
        scaleXY: 'scaleXY',
      },
    },
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
  Polygon: 'Polygon',
  Ellipse: 'Ellipse',
  Text: 'SvgText',
  TSpan: 'TSpan',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

// Mock react-native-quick-crypto with full crypto implementation
jest.mock('react-native-quick-crypto', () => {
  const {
    pbkdf2Sync: nodePbkdf2Sync,
    createHmac: nodeCreateHmac,
    webcrypto: nodeWebcrypto,
  } = require('node:crypto');
  return {
    pbkdf2Sync: nodePbkdf2Sync,
    createHmac: nodeCreateHmac,
    getRandomValues: (arr) => nodeWebcrypto.getRandomValues(arr),
    subtle: nodeWebcrypto.subtle,
  };
});
