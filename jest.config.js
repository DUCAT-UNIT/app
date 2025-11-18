module.exports = {
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'contexts/**/*.js',
    'hooks/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',

    // ============================================================================
    // EXCLUDED FROM COVERAGE: Files that are literally untestable in Jest
    // ============================================================================

    // --- Configuration/Build Files (no executable logic) ---
    '!**/jest.config.js',
    '!**/jest.setup.js',
    '!**/babel.config.js',
    '!**/.eslintrc.js',

    // --- Constants (static data only, no logic) ---
    '!utils/constants.js',          // API endpoints and static config
    '!utils/colors.js',              // Color constants
    '!utils/messages.js',            // Static error/success message strings

    // --- Platform-Specific Services (require native modules unavailable in Jest) ---
    '!services/biometricService.js',        // Requires expo-local-authentication hardware
    '!services/backgroundTaskService.js',   // Requires native background task scheduler
    '!services/icloudStorage.js',           // Requires iOS iCloud native integration
    '!services/pinService.js',              // Requires SecureStore native crypto
    '!services/secureStorageService.js',    // Requires Expo SecureStore native module
    '!services/passkeyService.js',          // Requires WebAuthn/native credential manager
    '!services/passkey/**/*.js',            // All passkey files require WebAuthn API

    // --- Native-Dependent Hooks (require React Native/Expo APIs) ---
    '!hooks/useAppLifecycle.js',           // Requires React Native AppState API
    '!hooks/useBackgroundSplash.js',       // Requires expo-splash-screen native module
    '!hooks/useKeyboard.js',               // Requires React Native Keyboard API
    '!hooks/useNotifications.js',          // Requires Expo push notifications
    '!hooks/usePasskeyCreation.js',        // Requires WebAuthn credential creation
    '!hooks/usePasskeyRestore.js',         // Requires WebAuthn authentication
    '!hooks/useVaultWebView.js',           // Requires react-native-webview

    // --- Animation/Visual Hooks (require native animation libraries) ---
    '!hooks/useReceiveScreenAnimations.js', // Requires react-native-reanimated
    '!hooks/useBottomSheetAnimation.js',    // Requires react-native-reanimated
    '!hooks/usePriceChart.js',              // Requires gesture/animation libraries

    // --- Visual/Animation Utils (require native rendering) ---
    '!utils/airdropCelebration.js',      // Requires react-native-confetti-cannon
    '!utils/vaultWebViewScripts.js',     // JavaScript for WebView context, not RN

    // --- Complex Integration Contexts (better tested with E2E) ---
    '!contexts/NavigationHandlersContext.js', // Navigation-dependent, requires full nav stack
    '!contexts/SeedPhraseContext.js',         // Requires React Native Animated mocking
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  testEnvironment: 'node',
  resetMocks: false,
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
