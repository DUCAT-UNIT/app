# DUCAT Bitcoin Wallet - Critical File Paths

## Core Application Files
- `/App.js` - Main entry point, provider setup, Bitcoin/ECC initialization
- `/app.json` - Expo configuration (iOS/Android, bundle ID, capabilities)
- `/package.json` - Dependencies and npm scripts
- `/.env.example` - Environment variable template
- `/babel.config.js` - JavaScript transpilation
- `/jest.config.js` - Test configuration

## Security-Critical Files (Review Before Production)
- `/services/secureStorageService.js` - Mnemonic storage with memory cleanup
- `/services/pinService.js` - PIN hashing, verification, rate limiting
- `/services/passkeyService.js` - WebAuthn, passkey encryption, iCloud backup (1,106 lines)
- `/services/icloudStorage.js` - iCloud encryption/decryption
- `/services/biometricService.js` - Face ID/Touch ID integration
- `/utils/wallet.js` - PSBT signing and message signing
- `/constants/security.js` - Security timeouts, PIN, passkey, biometric config

## Bitcoin Core Files
- `/utils/bitcoin.js` - Address derivation (BIP84/BIP86), validation
- `/constants/bitcoin.js` - Fee rates, dust limits, derivation paths
- `/services/walletService.js` - Wallet generation, import, account switching
- `/services/transaction/btcTransaction.js` - BTC transaction intent creation
- `/services/transaction/runesTransaction.js` - Runes/UNIT transaction creation
- `/services/transaction/utxoSelection.js` - UTXO selection algorithm
- `/services/transactionSigningService.js` - PSBT signing (Taproot special handling)
- `/services/transactionBroadcastService.js` - Transaction broadcast to network
- `/runestone-encoder.js` - Runes protocol encoding

## Context Files (State Management)
- `/contexts/AuthContext.js` - Authentication and onboarding state
- `/contexts/WalletContext.js` - HD wallet addresses, account switching
- `/contexts/WalletDataContext.js` - Balance and asset data
- `/contexts/PendingTransactionsContext.js` - Transaction queue and monitoring
- `/contexts/TransactionBuildContext.js` - PSBT construction
- `/contexts/TransactionExecutionContext.js` - Signing and broadcast
- `/contexts/VaultContext.js` - Vault credentials and management
- `/contexts/UIContext.js` - Toast notifications and UI state
- `/contexts/SendFlowContext.js` - Send transaction workflow
- `/contexts/PriceContext.js` - Bitcoin price feeds
- `/contexts/AirdropContext.js` - Airdrop tracking
- `/contexts/AppNavigationContext.js` - Navigation state
- `/contexts/NavigationHandlersContext.js` - Settings navigation handlers

## Screen Files (Main User Interface)

### Authentication Screens
- `/screens/auth/WelcomeScreen.jsx` - Onboarding entry
- `/screens/auth/PinSetupScreen.jsx` - PIN creation/verification
- `/screens/auth/LockScreen.jsx` - Locked state screen

### Wallet Screens
- `/screens/wallet/WalletScreen.jsx` - Main dashboard (balance, assets, history)
- `/screens/wallet/AssetDetailScreen.jsx` - Detailed asset view with charts
- `/screens/wallet/ReceiveScreen.jsx` - Receive address display
- `/screens/wallet/ReceiveQRScreen.jsx` - Full-screen QR code
- `/screens/wallet/VaultScreen.jsx` - Vault WebView integration
- `/screens/wallet/TransactionHistoryScreen.jsx` - Full transaction history

### Send Flow Screens
- `/screens/send/AssetSelectorScreen.jsx` - Choose BTC or UNIT
- `/screens/send/AddressInputScreen.jsx` - Enter recipient address
- `/screens/send/AmountInputScreen.jsx` - Enter amount and fees
- `/screens/send/ReviewScreen.jsx` - Review transaction details
- `/screens/send/ConfirmationScreen.jsx` - Final confirmation
- `/screens/send/ProcessingScreen.jsx` - Broadcasting status

### Settings Screens
- `/screens/settings/SettingsScreen.jsx` - Preferences and security
- `/screens/settings/PasskeyTestScreen.jsx` - Development/testing

### Splash Screen
- `/screens/SplashScreen.jsx` - Loading indicator

## Component Files

### Modal Components
- `/components/AppModals.jsx` - Logout/delete/biometric modals
- `/components/AccountSwitcherModal.jsx` - Account selection
- `/components/BiometricPromptModal.jsx` - Face ID/Touch ID prompt
- `/components/ConfirmationModal.jsx` - Generic confirmation
- `/components/AirdropSuccessModal.jsx` - Airdrop notification
- `/components/PasskeyMigrationModal.jsx` - Passkey setup

### Wallet Components
- `/components/wallet/WalletHeader.jsx` - Header with account switcher
- `/components/wallet/TotalBalanceSection.jsx` - Balance display (sats + USD)
- `/components/wallet/AssetCard.jsx` - Asset card (BTC/UNIT)
- `/components/wallet/VaultCard.jsx` - Vault collateral display
- `/components/wallet/ErrorBanner.jsx` - Error messages

### Transaction Components
- `/components/transaction/TransactionItem.jsx` - History list item
- `/components/TransactionToast.jsx` - Transaction completion notification

### Receive Flow Components
- `/components/receive/AddressRow.jsx` - Address display with copy
- `/components/receive/QRModal.jsx` - QR code modal

### Review Screen Components
- `/components/review/TransactionSummary.jsx` - TX details
- `/components/review/FeeBreakdown.jsx` - Fee display
- `/components/review/InputOutputList.jsx` - UTXO details
- `/components/review/UnconfirmedWarning.jsx` - Unconfirmed warning

### Icon Components
- `/components/icons/BrandIcons.jsx` - Logo/brand icons
- `/components/icons/NavigationIcons.jsx` - Tab/nav icons
- `/components/icons/UIIcons.jsx` - Common UI icons
- `/components/icons/SecurityIcons.jsx` - Security icons
- `/components/icons/WalletIcons.jsx` - Wallet operation icons

### UI Components
- `/components/BottomNavigationBar.jsx` - Tab navigation bar
- `/components/ErrorBoundary.jsx` - Error boundary wrapper
- `/components/Snackbar.jsx` - Snackbar notifications
- `/components/Toast.jsx` - Toast notifications
- `/components/ToastContainer.jsx` - Toast container
- `/components/SeedPhraseOverlay.jsx` - Seed phrase view
- `/components/MutinynetBanner.jsx` - Testnet disclaimer
- `/components/charts/PriceChart.jsx` - Price visualization

## Hook Files (Custom Hooks)

### Authentication & Security
- `/hooks/useAuth.js` - Authentication state and methods
- `/hooks/useAuthSettings.js` - Auth preferences
- `/hooks/usePasskeyCreation.js` - Passkey registration
- `/hooks/usePasskeyRestore.js` - Passkey recovery

### Wallet & Data
- `/hooks/useWalletInitialization.js` - Initialize on app start
- `/hooks/useWalletCreation.js` - Create new wallet
- `/hooks/useWalletImport.js` - Import existing wallet
- `/hooks/useAccountSwitcher.js` - Switch accounts
- `/hooks/useBalanceData.js` - Fetch and cache balance
- `/hooks/useWalletCalculations.js` - Balance calculations
- `/hooks/useFormattedBalances.js` - Format for display

### Transaction Hooks
- `/hooks/useTransactionHistoryFetch.js` - Fetch history from API
- `/hooks/useTransactionHistoryData.js` - Parse and manage history
- `/hooks/useTransactionPolling.js` - Poll for updates
- `/hooks/usePendingTransactionsStorage.js` - Persist pending TXs

### Navigation & UI Hooks
- `/hooks/useSheetNavigation.js` - Bottom sheet control
- `/hooks/useSettingsNavigation.js` - Settings navigation
- `/hooks/useNavigationState.js` - Navigation stack state
- `/hooks/useBottomSheetAnimation.js` - Sheet animations
- `/hooks/useReceiveScreenAnimations.js` - Address animations
- `/hooks/useKeyboard.js` - Keyboard state
- `/hooks/useToast.js` - Toast display

### Vault Hooks
- `/hooks/useVaultDataFetch.js` - Fetch vault data
- `/hooks/useVaultLoading.js` - Loading states
- `/hooks/useVaultWebView.js` - WebView communication
- `/hooks/useVaultMessages.js` - Message handling

### Utility Hooks
- `/hooks/usePolling.js` - Generic polling
- `/hooks/useAppLifecycle.js` - Foreground/background
- `/hooks/useBackgroundSplash.js` - Background splash
- `/hooks/useNotifications.js` - Notifications
- `/hooks/usePostAuthHandler.js` - Post-auth logic
- `/hooks/useSeedVerification.js` - Seed verification
- `/hooks/useSettings.js` - Settings management
- `/hooks/useReviewScreenData.js` - Review data
- `/hooks/useWalletActions.js` - Common actions
- `/hooks/useAppSettings.js` - App preferences

## Service Files (Business Logic)

### Core Services
- `/services/authService.js` - Mnemonic and account storage interface
- `/services/walletService.js` - Wallet generation and import
- `/services/secureStorageService.js` - Encrypted storage wrapper

### Transaction Services
- `/services/transactionService.js` - Barrel export
- `/services/transactionSigningService.js` - Sign PSBTs
- `/services/transactionBroadcastService.js` - Broadcast TXs
- `/services/transactionCalculationService.js` - Fee calculations
- `/services/transactionHistoryService.js` - Fetch history
- `/services/transaction/btcTransaction.js` - Build BTC TXs
- `/services/transaction/runesTransaction.js` - Build Runes TXs
- `/services/transaction/utxoSelection.js` - UTXO selection

### Security Services
- `/services/pinService.js` - PIN hashing and rate limiting
- `/services/biometricService.js` - Biometric auth
- `/services/passkeyService.js` - WebAuthn and iCloud backup
- `/services/icloudStorage.js` - iCloud operations

### Data Services
- `/services/balanceService.js` - Fetch balances
- `/services/vaultService.js` - Vault API
- `/services/airdropService.js` - Airdrop tracking
- `/services/backgroundTaskService.js` - Background tasks
- `/services/psbtService.js` - PSBT utilities

## Utility Files

### Bitcoin Utilities
- `/utils/bitcoin.js` - Address derivation and validation
- `/utils/constants.js` - API endpoints and secure keys
- `/utils/wallet.js` - PSBT and message signing

### Helper Utilities
- `/utils/sendHelpers.js` - Send flow helpers
- `/utils/onboardingHelpers.js` - Onboarding state
- `/utils/formatters.js` - Number/currency formatting
- `/utils/transactionFormatters.js` - TX formatting
- `/utils/errorParser.js` - Error message parsing
- `/utils/messages.js` - Error messages and constants

### Core Utilities
- `/utils/api.js` - HTTP request wrapper
- `/utils/logger.js` - Logging with prefix
- `/utils/retry.js` - Retry logic
- `/utils/colors.js` - Color utilities
- `/utils/vaultWebViewScripts.js` - WebView communication

## Constants Files

- `/constants/bitcoin.js` - Bitcoin-specific constants
- `/constants/security.js` - Security configuration
- `/constants/ui.js` - UI constants
- `/constants/index.js` - Main constants export

## Navigation Files

- `/navigation/AppNavigator.js` - Main orchestrator (275 lines)
- `/navigation/RootNavigator.js` - Auth vs Main routing
- `/navigation/AuthStack.js` - Authentication stack
- `/navigation/MainTabs.js` - Bottom tab navigation
- `/navigation/SendNavigator.js` - Send flow modal
- `/navigation/WalletStackNavigator.js` - Wallet details stack
- `/navigation/types.js` - Navigation types

## Testing Files

### Test Directories
- `/components/wallet/__tests__/` - Component tests
- `/contexts/__tests__/` - Context tests
- `/hooks/__tests__/` - Hook tests
- `/services/__tests__/` - Service tests
- `/utils/__tests__/` - Utility tests

### Test Configuration
- `/jest.config.js` - Jest configuration
- `/jest.setup.js` - Jest setup

## Theme & Styling

- `/theme/index.js` - Theme export
- `/theme/colors.js` - Color palette
- `/theme/typography.js` - Font styles
- `/theme/spacing.js` - Spacing units
- `/styles.js` - Global styles

## Asset Files

- `/assets/logos/` - App logos and icons
- `/assets/fonts/` - Custom fonts (CabinetGrotesk)
- `/assets/` - Other images and assets

## Configuration Files

- `/app.json` - Expo configuration
- `/.env.example` - Environment template
- `/.env` - Local environment (not in git)
- `/eas.json` - Expo App Services config
- `/.eslintrc.js` - ESLint configuration
- `/.prettierrc` - Prettier configuration
- `/babel.config.js` - Babel configuration

## Documentation Files

- `/CODEBASE_ANALYSIS.md` - Comprehensive analysis (this file's parent)
- `/CODEBASE_SUMMARY.md` - Quick reference
- `/CRITICAL_PATHS.md` - This file
- `/ARCHITECTURE_STANDARDS.md` - Architecture guidelines

## Special Purpose Files

- `/crypto-polyfill.js` - Buffer and crypto polyfills for React Native
- `/runestone-encoder.js` - Runes protocol encoding implementation
- `/cloudflare-worker-apple-app-site-association.js` - Passkey domain association
- `/index.js` - Legacy entry point

## File Path by Feature

### Bitcoin Address Operations
- `/utils/bitcoin.js` - `deriveAddressesFromMnemonic()`
- `/constants/bitcoin.js` - Derivation paths

### Transaction Signing
- `/services/transactionSigningService.js` - Main signing logic
- `/utils/wallet.js` - PSBT signing utilities
- `/services/transaction/btcTransaction.js` - BTC intent
- `/services/transaction/runesTransaction.js` - Runes intent

### Security & Authentication
- `/services/pinService.js` - PIN verification
- `/services/biometricService.js` - Biometric auth
- `/services/passkeyService.js` - Passkey/WebAuthn
- `/constants/security.js` - Security constants

### User Interface
- All files in `/screens/`
- All files in `/components/`
- `/theme/` for styling

### State Management
- All files in `/contexts/`
- All files in `/hooks/`

### API Integration
- `/utils/api.js` - HTTP wrapper
- `/utils/constants.js` - API endpoints
- `/services/*Service.js` - Domain-specific APIs

---

**Total Files:** ~260 source files  
**Critical Security Files:** 8  
**Bitcoin Core Files:** 9  
**Context/Hook Files:** 52  
**Test Files:** 30+  

