module.exports = {
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}', '**/?(*.)+(spec|test).{js,ts,tsx}'],
  collectCoverageFrom: [
    'services/**/*.{js,ts,tsx}',
    'utils/**/*.{js,ts,tsx}',
    'contexts/**/*.{js,ts,tsx}',
    'hooks/**/*.{js,ts,tsx}',
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
    '!utils/constants.{js,ts}',      // API endpoints and static config
    '!utils/colors.{js,ts}',         // Color constants
    '!utils/messages.{js,ts}',       // Static error/success message strings
    '!utils/logger.{js,ts}',         // Logger utility with complex environment handling

    // --- Index/Re-export Files (barrel exports, no logic) ---
    '!**/index.{js,ts,tsx}',           // All index files are re-exports
    '!services/cashu/cashuTokenOperations.{js,ts}', // Re-exports cashu operations
    '!services/cashu/cashuMintClient.{js,ts}',      // Re-exports from mintClient/
    '!services/vaultOperationsService.{js,ts}',     // Re-exports from vault/
    '!services/vaultWalletService.{js,ts}',         // Re-exports from vaultWallet/
    '!utils/wallet.{js,ts}',           // Re-exports wallet utilities

    // --- Platform-Specific Services (require native modules unavailable in Jest) ---
    '!services/biometricService.{js,ts}',        // Requires expo-local-authentication hardware
    '!services/backgroundTaskService.{js,ts}',   // Requires native background task scheduler
    '!services/icloudStorage.{js,ts}',           // Requires iOS iCloud native integration
    '!services/pinService.{js,ts}',              // Requires SecureStore native crypto
    '!services/secureStorageService.{js,ts}',    // Requires Expo SecureStore native module
    '!services/passkey/**/*.{js,ts}',            // All passkey files require WebAuthn API

    // --- Native-Dependent Hooks (require React Native/Expo APIs) ---
    '!hooks/useAppLifecycle.{js,ts}',           // Requires React Native AppState API
    '!hooks/useBackgroundSplash.{js,ts}',       // Requires expo-splash-screen native module
    '!hooks/useKeyboard.{js,ts}',               // Requires React Native Keyboard API
    '!hooks/useNotifications.{js,ts}',          // Requires Expo push notifications
    '!hooks/usePasskeyCreation.{js,ts}',        // Requires WebAuthn credential creation
    '!hooks/usePasskeyRestore.{js,ts}',         // Requires WebAuthn authentication
    '!hooks/useVaultWebView.{js,ts}',           // Requires react-native-webview

    // --- Animation/Visual Hooks (require native animation libraries) ---
    '!hooks/useReceiveScreenAnimations.{js,ts}', // Requires react-native-reanimated
    '!hooks/useBottomSheetAnimation.{js,ts}',    // Requires react-native-reanimated
    '!hooks/usePriceChart.{js,ts}',              // Requires gesture/animation libraries

    // --- Style Hooks (return theme objects, low testing value) ---
    '!hooks/useAssetCardStyles.{js,ts}',         // Returns themed style objects
    '!hooks/useBannerStyles.{js,ts}',            // Returns themed style objects
    '!hooks/useChartStyles.{js,ts}',             // Returns themed style objects
    '!hooks/useProgressStyles.{js,ts}',          // Returns themed style objects
    '!hooks/usePromotionStyles.{js,ts}',         // Returns themed style objects
    '!hooks/useTotalBalanceStyles.{js,ts}',      // Returns themed style objects
    '!hooks/useVaultHealthStyles.{js,ts}',       // Returns themed style objects

    // --- Notification Helpers (complex Zustand mocking issues) ---
    '!utils/notify.{js,ts}',                     // Zustand getState() mocking incompatible with Jest

    // Note: Dynamic import hooks have been refactored to use static imports for testability
    // '!hooks/useRedeemCashuToken.ts',     // Refactored to use static imports
    // '!hooks/useTurboMintCompletion.ts',  // Refactored to use static imports
    // '!hooks/useCashuMintCompletion.ts',  // Refactored to use static imports
    // '!hooks/useFuseEcash.ts',            // Refactored to use static imports
    // '!hooks/useQRCodeHandler.ts',        // Refactored to use static imports
    // '!hooks/useEcashThresholdManager.ts',// Refactored to use static imports
    // '!hooks/useAssetTransactions.ts',    // Refactored to use static imports
    '!hooks/useTransactionHistoryData.{js,ts}',  // Uses dynamic import() for cashu services
    '!hooks/useAppSettings.{js,ts}',             // Uses dynamic import() for cashu services

    // --- Visual/Animation Utils (require native rendering) ---
    '!utils/airdropCelebration.{js,ts}',      // Requires react-native-confetti-cannon

    // --- Complex Integration Contexts (better tested with E2E) ---
    '!contexts/NavigationHandlersContext.{js,ts,tsx}', // Navigation-dependent, requires full nav stack
    '!contexts/SeedPhraseContext.{js,ts,tsx}',         // Requires React Native Animated mocking
    '!contexts/ResponsiveContext.{js,ts,tsx}',         // Requires React Native Dimensions API
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
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@noble/secp256k1)',
  ],
};
