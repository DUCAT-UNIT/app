# DUCAT Bitcoin Wallet Application - Comprehensive Codebase Analysis

## Executive Summary

DUCAT is a production-grade React Native/Expo Bitcoin wallet application supporting testnet (Mutinynet/Signet) operations. The application features:
- HD wallet management with BIP39/BIP84/BIP86 derivation
- Bitcoin and Runes (UNIT) transaction support
- Passkey-based authentication with iCloud backup
- PIN and biometric security
- Vault integration for collateralized assets
- Real-time transaction monitoring and price feeds
- Multi-account wallet support

**Technology Stack:** React Native 0.81.5, Expo 54.0.20, bitcoinjs-lib 7.0.0, Runes support via @magiceden-oss/runestone-lib

---

## 1. PROJECT STRUCTURE & ARCHITECTURE

### Root Level Organization
```
/Users/lucasrodriguez/Desktop/Ducat/app/app/
├── App.js                          # Main entry point - Provider orchestration
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── babel.config.js                 # Babel configuration
├── jest.config.js / jest.setup.js # Test configuration
├── crypto-polyfill.js              # Polyfills for crypto in React Native
├── runestone-encoder.js            # Runes protocol encoding
├── cloudflare-worker-apple-app-site-association.js
├── eas.json                        # EAS (Expo Application Services) config
│
├── assets/                         # Images, fonts, logos
├── components/                     # Reusable UI components (23 files)
├── screens/                        # Screen components organized by feature
├── contexts/                       # Global state management (13 contexts)
├── hooks/                          # Custom React hooks (39 hooks)
├── services/                       # Business logic layer (20 services)
├── utils/                          # Utility functions and helpers
├── constants/                      # App constants
├── theme/                          # Styling and theming
├── navigation/                     # React Navigation setup
├── pages/                          # Legacy page components
└── styles.js                       # Global styles
```

### Total Source Files: ~260 JavaScript/JSX files (excluding node_modules)

---

## 2. TECHNOLOGY STACK ANALYSIS

### Core Dependencies

#### React Native & Expo
- `react@19.1.0` - Latest React version
- `react-native@0.81.5` - Latest RN release
- `expo@54.0.20` - Expo framework
- `@react-navigation/*` - Navigation stack, tabs, native
  - `@react-navigation/bottom-tabs@7.8.4`
  - `@react-navigation/native@7.1.19`
  - `@react-navigation/stack@7.6.3`

#### Bitcoin & Crypto Libraries
- `bitcoinjs-lib@7.0.0` - Bitcoin transaction creation & signing
- `bip32@5.0.0` - BIP32 HD wallet derivation
- `bip39@3.1.0` - BIP39 mnemonic generation
- `ecpair@3.0.0` - ECDSA key pair management
- `@bitcoinerlab/secp256k1@1.2.0` - secp256k1 ECC implementation
- `@magiceden-oss/runestone-lib@1.0.2` - Runes protocol support
- `react-native-quick-crypto@0.7.17` - Native crypto operations

#### Security & Storage
- `expo-secure-store@15.0.7` - Encrypted key-value storage
- `expo-crypto@15.0.7` - Crypto operations
- `react-native-passkey@3.3.1` - WebAuthn/Passkey support
- `react-native-icloudstore@0.9.0` - iCloud backup storage
- `expo-local-authentication@17.0.7` - Biometric auth (Face ID/Touch ID)

#### UI & Utilities
- `react-native-svg@15.12.1` - SVG rendering
- `react-native-qrcode-svg@6.3.20` - QR code generation
- `expo-linear-gradient@15.0.7` - Gradient support
- `react-native-confetti-cannon@1.5.2` - Celebration animations
- `react-native-gesture-handler@2.29.1` - Gesture handling
- `react-native-webview@13.16.0` - WebView for vault integration
- `expo-clipboard@8.0.7` - Clipboard operations
- `expo-haptics@15.0.7` - Haptic feedback

#### Background & Notifications
- `expo-notifications@0.32.12` - Push notifications
- `expo-background-fetch@14.0.7` - Background task support
- `expo-task-manager@14.0.8` - Task management

#### Error Tracking & Analytics
- `@sentry/react-native@7.6.0` - Error tracking and monitoring

#### Development Tools
- `@babel/core@7.28.5` - JavaScript transpiler
- `eslint@8.57.1` - Code linting
- `prettier@3.6.2` - Code formatting
- `jest@30.2.0` - Testing framework
- `jest-expo@54.0.13` - Jest integration for Expo

---

## 3. ARCHITECTURE PATTERNS & STATE MANAGEMENT

### Provider Hierarchy (from App.js)

```
App
├── AuthProvider (useAuth hook)
├── WalletProvider (HD wallet state)
└── UIProvider (Toast/UI state)
    └── AppProviders (nested provider)
        ├── PendingTransactionsProvider
        ├── WalletDataProvider
        └── PriceProvider
            └── AppNavigator
                └── ProvidersWrapper
                    ├── AirdropProvider
                    ├── SendFlowProvider
                    ├── TransactionBuildProvider
                    ├── TransactionExecutionProvider
                    ├── VaultProvider
                    ├── SeedPhraseProvider
                    └── NavigationHandlersProvider
                        └── RootNavigator
```

### Context Ecosystem (13 Contexts)

1. **AuthContext** - Authentication state, onboarding flow, biometric settings
2. **WalletContext** - Current wallet addresses, account switching
3. **WalletDataContext** - Balance data, asset information
4. **PriceContext** - Bitcoin price feeds from CoinGecko
5. **UIContext** - Toast notifications, UI state
6. **PendingTransactionsContext** - Transaction queue and monitoring
7. **SendFlowContext** - Send transaction workflow state
8. **TransactionBuildContext** - PSBT construction and management
9. **TransactionExecutionContext** - Transaction signing and broadcast
10. **VaultContext** - Vault credentials and management
11. **SeedPhraseContext** - Seed phrase display/hiding
12. **AirdropContext** - Airdrop tracking
13. **AppNavigationContext** - App-level navigation state
14. **NavigationHandlersContext** - Settings navigation handlers

### Custom Hooks (39 Total)

#### Authentication & Security
- `useAuth()` - Authentication state
- `useAuthSettings()` - Auth preference settings
- `usePasskeyCreation()` - Passkey registration flow
- `usePasskeyRestore()` - Passkey recovery flow

#### Wallet & Data
- `useWalletInitialization()` - Wallet initialization on app start
- `useWalletCreation()` - Create new wallet
- `useWalletImport()` - Import wallet from mnemonic
- `useAccountSwitcher()` - Multi-account switching
- `useBalanceData()` - Fetch and cache balance
- `useWalletCalculations()` - Balance calculations
- `useFormattedBalances()` - Format balance display

#### Transactions
- `useTransactionHistoryFetch()` - Fetch transaction history
- `useTransactionHistoryData()` - Parse and manage history
- `useTransactionPolling()` - Poll for transaction updates
- `usePendingTransactionsStorage()` - Persist pending transactions

#### Navigation & UI
- `useSheetNavigation()` - Bottom sheet navigation
- `useSettingsNavigation()` - Settings screen navigation
- `useNavigationState()` - Navigation stack state
- `useBottomSheetAnimation()` - Sheet animation logic
- `useReceiveScreenAnimations()` - Address display animations
- `useKeyboard()` - Keyboard state management
- `useToast()` - Toast notification display

#### Vault-Related
- `useVaultDataFetch()` - Fetch vault data
- `useVaultLoading()` - Vault loading states
- `useVaultWebView()` - WebView communication
- `useVaultMessages()` - Message handling

#### Utilities
- `usePolling()` - Generic polling mechanism
- `useAppLifecycle()` - App foreground/background
- `useBackgroundSplash()` - Background splash screen
- `useNotifications()` - Push notification handling
- `usePostAuthHandler()` - Post-authentication logic
- `useSeedVerification()` - Seed phrase verification
- `useSettings()` - Settings management
- `useReviewScreenData()` - Transaction review data
- `useWalletActions()` - Common wallet actions
- `useAppSettings()` - App-wide preferences

---

## 4. BITCOIN & BLOCKCHAIN INTEGRATION

### Network Configuration

**Mutinynet Configuration** (Testnet/Signet):
```javascript
{
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',  // tb1 prefix for testnet bech32
  bip32: {
    public: 0x043587cf,   // tpub
    private: 0x04358394,  // tprv
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
}
```

**API Endpoints** (from utils/constants.js):
- Mutinynet: `https://mutinynet.com/api`
- Ord/Inscriptions: `https://ord-mutinynet.ducatprotocol.com`
- Bitcoin Faucet: `https://faucet.ducatprotocol.com/btc/faucet`
- Vault: `https://validator.ducatprotocol.com/api`
- Price Data: `https://api.coingecko.com/api/v3`

### Address Derivation

**BIP84 (Native SegWit - P2WPKH):**
```
Path: m/84'/1'/0'/0/{accountIndex}
Prefix: tb1q (testnet)
Type: Pay-to-Witness-PubKey-Hash
```

**BIP86 (Taproot - P2TR):**
```
Path: m/86'/1'/0'/0/{accountIndex}
Prefix: tb1p (testnet)
Type: Taproot (Pay-to-Taproot)
```

File: `/utils/bitcoin.js` - `deriveAddressesFromMnemonic()`

### Key Management & Security

**Mnemonic Storage:**
- BIP39 12-word mnemonics
- Stored in secure storage: `expo-secure-store`
- Cleared from memory immediately after use via `withMnemonic()` pattern

**Private Key Handling:**
- Keys derived on-demand from mnemonic
- Never stored directly - always derived from mnemonic
- Destroyed immediately after signing
- Pattern: `withMnemonic(callback)` ensures memory cleanup

**Security Pattern Example:**
```javascript
export async function signIntent(intent, currentAccount) {
  // SECURITY: Use withMnemonic to minimize mnemonic exposure to <100ms
  const { segwitChild, taprootChild } = await AuthService.withMnemonic((mnemonic) =>
    deriveSigningKeys(mnemonic, currentAccount)
  );
  // Mnemonic auto-wiped by withMnemonic() - no finally block needed
  
  // Sign transaction with derived keys
  psbt.signInput(0, segwitChild);
  // ...
}
```

File: `/services/transactionSigningService.js` (200 lines)

### Transaction Building

#### BTC Transactions
- File: `/services/transaction/btcTransaction.js`
- Supports P2WPKH (SegWit) and P2TR (Taproot) inputs
- UTXO selection with dust limit validation
- Fee calculation: sats per vByte model

**Fee Constants** (constants/bitcoin.js):
- `DUST_LIMIT_SATS = 546`
- `DEFAULT_FEE_RATE = 1` (sats/vB testnet)
- `MIN_FEE_RATE = 1`
- `MAX_FEE_RATE = 1000`

#### Runes (UNIT) Transactions
- File: `/services/transaction/runesTransaction.js`
- Requires Runestone encoding (magic numbers)
- Two-input pattern: BTC fees (P2WPKH) + Runes transfer (P2TR)
- Runestone output with edicts for UNIT transfers

**Runestone Encoding:**
- File: `/runestone-encoder.js`
- Implements Runes protocol specification
- Encodes: runeid, amount, output indices

**Transaction Intent Pattern:**
```javascript
{
  psbt: string,           // Base64-encoded PSBT
  inputs: [...],          // Input UTXOs
  outputs: [...],         // Output addresses
  assetType: 'BTC'|'UNIT',
  addressType: 'taproot'|'segwit',
  fee: number,            // Calculated fee
  estimatedSize: number,  // TX size estimate
}
```

### UTXO Selection

File: `/services/transaction/utxoSelection.js`

**Algorithm:**
1. **Unconfirmed First:** Includes unconfirmed UTXOs (from pending transactions)
2. **Dust Filtering:** Removes dust UTXOs < 546 sats
3. **Coin Selection:** 
   - Preference for confirmed UTXOs
   - Accumulation algorithm for change handling
   - Minimizes fee waste

**Functions:**
- `mergeAndFilterUtxos()` - Combine confirmed + unconfirmed
- `selectUtxosForTransaction()` - Select optimal UTXOs
- `createFeeCalculator()` - Calculate transaction fees

### Transaction Signing

File: `/services/transactionSigningService.js` (200 lines)

**Signing Process:**
1. Retrieve mnemonic (with auto-cleanup)
2. Derive keys for current account
3. Load PSBT from base64
4. Sign inputs based on type:
   - **P2WPKH (SegWit):** Standard ECDSA signing
   - **P2TR (Taproot):** Manual Schnorr signing with key tweaking
5. Finalize inputs (script witnesses)
6. Extract signed transaction hex and TXID

**Taproot Signing Complexity:**
- Manual key tweaking (taprootChild.tweak())
- BigInt arithmetic for curve operations
- Private key negation for odd y-coordinates
- Schnorr signature generation (64 bytes)

### Transaction Broadcasting

File: `/services/transactionBroadcastService.js`

- POST to Mutinynet: `/api/tx`
- Response: Transaction ID confirmation
- Error handling for double-spends, invalid fees

---

## 5. CODE ORGANIZATION

### Screens Directory (6 Subdirectories)

#### Authentication (`/screens/auth/`)
- **WelcomeScreen.jsx** - Onboarding entry point
- **PinSetupScreen.jsx** - PIN creation/verification
- **LockScreen.jsx** - PIN unlock after timeout

#### Wallet (`/screens/wallet/`)
- **WalletScreen.jsx** - Main wallet dashboard (7 KiB)
  - Balance display with BTC/USD toggle
  - Asset list (BTC, UNIT)
  - Transaction history preview
  - Vault collateral status
- **AssetDetailScreen.jsx** (26 KiB) - Detailed asset view
  - Price charts
  - Transaction history
  - Airdrop information
- **ReceiveScreen.jsx** - Receive address display (6 KiB)
  - QR code generation
  - Address copy to clipboard
  - BTC/UNIT toggle
- **ReceiveQRScreen.jsx** - Full-screen QR display (6 KiB)
- **VaultScreen.jsx** - Vault WebView integration (6 KiB)
- **TransactionHistoryScreen.jsx** - Full transaction history (3 KiB)

#### Send Flow (`/screens/send/`)
- **AssetSelectorScreen.jsx** - Select BTC or UNIT (5 KiB)
- **AddressInputScreen.jsx** - Enter recipient address (7 KiB)
- **AmountInputScreen.jsx** - Enter amount (10 KiB)
- **ReviewScreen.jsx** - Review transaction details (5 KiB)
- **ConfirmationScreen.jsx** - Final confirmation (3 KiB)
- **ProcessingScreen.jsx** - Broadcasting status (5 KiB)

#### Settings (`/screens/settings/`)
- **SettingsScreen.jsx** - User preferences
  - Logout/Delete wallet
  - Biometric toggle
  - Notifications toggle
  - Seed phrase backup
  - Passkey management
- **PasskeyTestScreen.jsx** - Passkey development screen

#### Core
- **SplashScreen.jsx** - Loading screen

### Components Directory (23 Components)

#### Modals
- **AppModals.jsx** - Logout/delete/biometric confirmation
- **AccountSwitcherModal.jsx** - Multi-account picker
- **BiometricPromptModal.jsx** - Face ID/Touch ID prompt
- **ConfirmationModal.jsx** - Generic confirmation
- **AirdropSuccessModal.jsx** - Airdrop completion notification
- **PasskeyMigrationModal.jsx** - Passkey setup migration

#### Wallet Components
- **wallet/WalletHeader.jsx** - Header with account switcher
- **wallet/TotalBalanceSection.jsx** - Balance display
- **wallet/AssetCard.jsx** - Individual asset card
- **wallet/VaultCard.jsx** - Vault collateral display
- **wallet/ErrorBanner.jsx** - Error messages

#### Transaction Display
- **transaction/TransactionItem.jsx** - History item
- **TransactionToast.jsx** - Transaction completion toast

#### Receive Flow
- **receive/AddressRow.jsx** - Display with copy action
- **receive/QRModal.jsx** - QR code modal

#### Review Screen
- **review/TransactionSummary.jsx** - TX details summary
- **review/FeeBreakdown.jsx** - Fee calculation display
- **review/InputOutputList.jsx** - UTXO details
- **review/UnconfirmedWarning.jsx** - Unconfirmed UTXO warning

#### Icons (5 Files)
- **icons/BrandIcons.jsx** - Logo components
- **icons/NavigationIcons.jsx** - Tab/nav icons
- **icons/UIIcons.jsx** - Common UI icons
- **icons/SecurityIcons.jsx** - Security-related icons
- **icons/WalletIcons.jsx** - Wallet operation icons

#### UI Components
- **BottomNavigationBar.jsx** - Tab navigation
- **ErrorBoundary.jsx** - Error handling boundary
- **Snackbar.jsx** - Notification snackbar
- **Toast.jsx** - Toast notifications
- **ToastContainer.jsx** - Toast container
- **SeedPhraseOverlay.jsx** - Seed phrase view overlay
- **MutinynetBanner.jsx** - Testnet disclaimer
- **AppModals.jsx** - Modal orchestrator

#### Charts
- **charts/PriceChart.jsx** - Bitcoin price visualization

### Services Directory (20+ Services)

#### Core Services
- **authService.js** (800 B) - Mnemonic storage (re-export)
- **walletService.js** (131 lines) - Wallet generation/import/switching
- **secureStorageService.js** (153 lines) - Secure storage wrapper

#### Transaction Services
- **transactionService.js** (541 B) - Barrel export
- **transactionSigningService.js** (200 lines) - PSBT signing
- **transactionBroadcastService.js** (966 B) - TX broadcast
- **transactionCalculationService.js** - Fee calculations
- **transactionHistoryService.js** (200+ lines) - History fetching
- **transaction/btcTransaction.js** - BTC transaction building
- **transaction/runesTransaction.js** - Runes transaction building
- **transaction/utxoSelection.js** - UTXO selection algorithm

#### Security Services
- **pinService.js** (250+ lines) - PIN hashing and verification
- **biometricService.js** (50+ lines) - Biometric authentication
- **passkeyService.js** (1,106 lines) - Passkey/WebAuthn integration
- **icloudStorage.js** (200+ lines) - iCloud backup

#### Data Services
- **balanceService.js** (100+ lines) - Balance fetching
- **vaultService.js** (200 lines) - Vault API integration
- **airdropService.js** (50 lines) - Airdrop tracking
- **backgroundTaskService.js** - Background task setup
- **psbtService.js** (150 lines) - PSBT utilities

### Utils Directory (20+ Utilities)

#### Bitcoin Utilities
- **bitcoin.js** (150+ lines) - Address derivation, validation
- **constants.js** (59 lines) - API endpoints, secure keys

#### Helpers
- **wallet.js** - PSBT signing, message signing
- **sendHelpers.js** - Send flow utilities
- **onboardingHelpers.js** - Onboarding state reset
- **formatters.js** - Number and currency formatting
- **transactionFormatters.js** - TX display formatting
- **errorParser.js** - Parse error messages
- **messages.js** - Error messages and constants

#### Core Utilities
- **api.js** - HTTP request wrapper
- **logger.js** - Logging utility with prefix
- **retry.js** - Retry logic for failed requests
- **colors.js** - Color utilities
- **vaultWebViewScripts.js** - WebView communication

### Navigation Structure

#### AppNavigator.js (275 lines)
Main orchestrator with provider setup

#### RootNavigator.js
- Routes to AuthStack or MainTabs based on authentication

#### AuthStack.js
- WelcomeScreen
- PinSetupScreen
- LockScreen

#### MainTabs.js (Bottom Tab Navigation)
- Wallet Stack (Home)
- Send Flow (Modal)
- Settings Stack
- Vault Tab

#### SendNavigator.js (Modal Stack)
- AssetSelectorScreen
- AddressInputScreen
- AmountInputScreen
- ReviewScreen
- ConfirmationScreen
- ProcessingScreen

#### WalletStackNavigator.js
- WalletScreen
- AssetDetailScreen
- ReceiveScreen
- ReceiveQRScreen
- TransactionHistoryScreen

---

## 6. SECURITY CONSIDERATIONS

### Private Key Management

**Security Pattern: `withMnemonic()`**
```javascript
// CRITICAL: Use this for ALL mnemonic access
export async function withMnemonic(callback) {
  let mnemonic = null;
  try {
    mnemonic = await getMnemonic();
    if (!mnemonic) throw new Error('Mnemonic not found');
    return await callback(mnemonic);
  } finally {
    // Best effort to clear from memory
    if (mnemonic) {
      mnemonic = securelyWipeString(mnemonic);
      mnemonic = null;
    }
  }
}
```

**Memory Cleanup Strategy:**
- Mnemonic exposure < 100ms (from secure storage to usage)
- String overwriting with random bytes (3 passes)
- Variable nullification after use

### Storage Security

**Secure Storage Keys** (expo-secure-store):
- `wallet_mnemonic_v1` - BIP39 mnemonic (encrypted by OS)
- `wallet_current_account_v1` - Active account index
- `wallet_pin_v1` - PIN hash (PBKDF2, 10k iterations)
- `wallet_pin_salt_v1` - PIN salt (32 bytes random)
- `passkey_enabled_v1` - Passkey creation flag
- `passkey_credential_id_v1` - WebAuthn credential ID
- `passkey_user_handle_v1` - WebAuthn user handle

**File: `/services/secureStorageService.js`**

### PIN Authentication Security

**Constants** (constants/security.js):
```javascript
PIN: {
  MIN_LENGTH: 6,
  MAX_LENGTH: 6,
  MAX_ATTEMPTS: 10,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000,  // 30 minutes
}

CRYPTO: {
  PIN_HASH_ITERATIONS: 10000,  // PBKDF2 iterations
  SALT_LENGTH_BYTES: 32,        // Random salt
}
```

**PIN Hashing:**
- PBKDF2 with 10,000 iterations (slow to bruteforce)
- Random 32-byte salt per user
- Constant-time comparison to prevent timing attacks
- Versioning for upgrade path: `PIN_HASH_VERSION` (SHA256 legacy → PBKDF2)

**Rate Limiting:**
- Failed attempt counter stored in secure storage
- 30-minute lockout after 10 failures
- Fail-closed: Can't save lockout → Deny access (security critical)

**File: `/services/pinService.js` (250+ lines)**

### Passkey/WebAuthn Integration

**Security Architecture:**
- **WebAuthn Credential Storage:** Device-level (iCloud Keychain iOS, Google PM Android)
- **Encrypted Mnemonic:** AES-256-GCM encrypted with passkey-derived + PIN-derived key
- **Apple-Proof:** Even with passkey, Apple can't decrypt without PIN (28-hour bruteforce)
- **iCloud Backup:** Encrypted mnemonic stored in iCloud (Apple can't decrypt)

**Derivation Process:**
```
Passkey Credential ID + User Handle + PIN Salt
↓
HKDF-SHA256 with passkey data + PIN hash
↓
256-bit AES-GCM key
↓
Decrypt mnemonic stored in iCloud
```

**File: `/services/passkeyService.js` (1,106 lines - Largest service)**

### Biometric Authentication

**Implementation:**
- `expo-local-authentication` for Face ID/Touch ID
- Biometric preference stored in secure storage
- PIN fallback when biometric fails
- No biometric data stored (OS-level)

**File: `/services/biometricService.js`**

### Input Validation

#### Bitcoin Address Validation
```javascript
// Function: validateBitcoinAddress(address)
// Checks:
// 1. Type checking: string, non-empty
// 2. Network detection: testnet vs mainnet
// 3. Address format: tb1q (SegWit), tb1p (Taproot), legacy
// 4. Error: Mainnet address detected → explicit error

// Returns: { valid: boolean, type?: string, error?: string }
```

**Testnet Address Prefixes:**
- `tb1q...` - SegWit (BIP84)
- `tb1p...` - Taproot (BIP86)
- `2...`, `m...`, `n...` - Legacy (P2SH/P2PKH)

**Mainnet Detection:**
- `bc1...` - Mainnet bech32
- `1...`, `3...` - Mainnet legacy
- **Error: Explicitly prevents mainnet addresses**

**File: `/utils/bitcoin.js` (lines 69-117)**

#### Amount Validation
- Dust limit: 546 sats
- Minimum send: 1,000 sats
- Maximum fee rate: 1,000 sats/vB

### Error Handling

**Sentry Integration:**
- DSN configured in App.js
- Traces 100% of transactions (tracesSampleRate: 1.0)
- Filters sensitive data (cookies, headers)
- Environment-aware: development vs production

**File: `/App.js` (lines 37-51)**

### Network Security

**API Endpoints:**
- All HTTPS only
- Mutinynet (public testnet API)
- CoinGecko (public price API)
- Custom Vault API with SSL/TLS

**No Credentials:**
- No API keys hardcoded (CoinGecko API key is optional)
- No private key material in API calls
- PSBTs signed locally only

---

## 7. KEY FILES & THEIR PURPOSES

### Configuration Files
| File | Purpose | Lines |
|------|---------|-------|
| `App.js` | Main entry point, provider setup | 100 |
| `app.json` | Expo configuration, iOS/Android settings | 71 |
| `package.json` | Dependencies and scripts | 89 |
| `babel.config.js` | JavaScript transpilation | - |
| `jest.config.js` | Jest testing configuration | - |
| `crypto-polyfill.js` | Buffer and crypto polyfills | - |
| `.env.example` | Environment variable template | 11 |

### Critical Security Files
| File | Purpose | Lines |
|------|---------|-------|
| `/services/secureStorageService.js` | Mnemonic storage with cleanup | 153 |
| `/services/pinService.js` | PIN hashing, verification, rate limiting | 250+ |
| `/services/passkeyService.js` | WebAuthn, iCloud backup, encryption | 1,106 |
| `/services/icloudStorage.js` | iCloud backup API | 200+ |
| `/utils/wallet.js` | PSBT signing, message signing | - |
| `/constants/security.js` | Security constants and timeouts | 88 |

### Bitcoin/Transaction Files
| File | Purpose | Lines |
|------|---------|-------|
| `/utils/bitcoin.js` | Address derivation, validation | 134 |
| `/constants/bitcoin.js` | Fee rates, dust limits, constants | 84 |
| `/services/transactionSigningService.js` | PSBT signing, Taproot signing | 200 |
| `/services/transaction/btcTransaction.js` | BTC transaction intent creation | - |
| `/services/transaction/runesTransaction.js` | Runes transaction intent creation | 80+ |
| `/services/transaction/utxoSelection.js` | UTXO selection algorithm | - |
| `/services/transactionBroadcastService.js` | TX broadcast to network | 966 |
| `/runestone-encoder.js` | Runes protocol encoding | - |

### Context Files (State Management)
| File | Purpose | Lines |
|------|---------|-------|
| `/contexts/AuthContext.js` | Authentication and onboarding state | 106 |
| `/contexts/WalletContext.js` | HD wallet state and switching | 101 |
| `/contexts/WalletDataContext.js` | Balance and asset data | - |
| `/contexts/PendingTransactionsContext.js` | Transaction queue | - |
| `/contexts/TransactionBuildContext.js` | PSBT construction | - |
| `/contexts/TransactionExecutionContext.js` | Transaction signing/broadcast | - |
| `/contexts/VaultContext.js` | Vault credentials | 128 |
| `/contexts/UIContext.js` | Toast/notification state | - |

### Navigation Files
| File | Purpose |
|------|---------|
| `/navigation/AppNavigator.js` | Main orchestrator (275 lines) |
| `/navigation/RootNavigator.js` | Auth vs Main routing |
| `/navigation/AuthStack.js` | Auth screens stack |
| `/navigation/MainTabs.js` | Bottom tab navigation |
| `/navigation/SendNavigator.js` | Send flow modal stack |
| `/navigation/WalletStackNavigator.js` | Wallet detail stack |
| `/navigation/types.js` | TypeScript/PropTypes |

---

## 8. DATA FLOW EXAMPLES

### User Onboarding Flow
```
WelcomeScreen
  ↓ (Tap "Create Wallet" or "Import")
PinSetupScreen
  ↓ (User enters 6-digit PIN)
generateWallet() / importWallet()
  ↓ Creates mnemonic or validates existing
saveMnemonic() → SecureStore
  ↓ (expo-secure-store encryption)
deriveAddressesFromMnemonic()
  ↓ BIP84 (SegWit) + BIP86 (Taproot)
setWalletAddresses() → WalletContext
  ↓
WalletScreen (home)
```

### Send Transaction Flow
```
WalletScreen → SendNavigator (modal)
  ↓
AssetSelectorScreen (BTC or UNIT)
  ↓
AddressInputScreen (validate address)
  ↓
AmountInputScreen (calculate fee)
  ↓
ReviewScreen (show details)
  ↓
ConfirmationScreen (PIN verification)
  ↓
TransactionBuildContext
  ├─ Fetch UTXOs
  ├─ Create intent (PSBT)
  └─ Store in context
  ↓
TransactionExecutionContext
  ├─ Sign intent (withMnemonic)
  ├─ Broadcast to network
  └─ Update UI
  ↓
ProcessingScreen (polling)
  ↓
WalletScreen (updated balance)
```

### Balance Update Flow
```
App start / Navigate to WalletScreen
  ↓
useWalletInitialization()
  ├─ Load wallet from SecureStore
  ├─ Fetch latest balance
  └─ Set IsAuthenticated = true
  ↓
WalletDataContext (useBalance hook)
  ├─ Fetch from Mutinynet API
  ├─ Parse response
  └─ Cache in state
  ↓
PriceContext
  ├─ Fetch BTC price from CoinGecko
  └─ Update price state
  ↓
WalletScreen renders
  ├─ TotalBalanceSection (sats + USD)
  ├─ AssetCards (BTC, UNIT)
  └─ TransactionHistory
  ↓
useTransactionPolling()
  ├─ 30-second intervals
  └─ Update pending transactions
```

---

## 9. TESTING INFRASTRUCTURE

### Test Files
- ~30 test files in `__tests__` directories
- Located alongside source files
- Jest + React Native Testing Library
- Test setup in `jest.setup.js`

### Coverage Areas
- Contexts (AuthContext, WalletContext, etc.)
- Hooks (useAuth, useWallet, useTransactionHistory, etc.)
- Services (walletService, transactionService, etc.)
- Utils (bitcoin, formatters, errorParser, etc.)
- Components (basic component tests)

**File: `/jest.config.js` - Jest configuration**

---

## 10. CONSTANTS & CONFIGURATION

### API Configuration
**File: `/utils/constants.js`**
```javascript
API: {
  MUTINYNET_BASE: 'https://mutinynet.com/api',
  ORD_MUTINYNET_BASE: 'https://ord-mutinynet.ducatprotocol.com',
  FAUCET: 'https://faucet.ducatprotocol.com/btc/faucet',
  VAULT: 'https://validator.ducatprotocol.com/api',
  PHONE: 'https://phone.ducatprotocol.com',
  COINGECKO: 'https://api.coingecko.com/api/v3',
}
```

### Security Constants
**File: `/constants/security.js`**
```javascript
PIN: {
  MIN_LENGTH: 6, MAX_LENGTH: 6,
  MAX_ATTEMPTS: 10,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000,
}

CRYPTO: {
  PIN_HASH_ITERATIONS: 10000,
  SALT_LENGTH_BYTES: 32,
}

SESSION: {
  TIMEOUT_MS: 5 * 60 * 1000,      // Auto-lock timeout
  BACKGROUND_TIMEOUT_MS: 1 * 60 * 1000,
}

PASSKEY: {
  RP_NAME: 'Ducat Wallet',
  RP_ID: 'ducatprotocol.com',
  TIMEOUT_MS: 60000,
  ENTROPY_BITS: 128,  // 12-word mnemonic
}
```

### Bitcoin Constants
**File: `/constants/bitcoin.js`**
```javascript
DUST_LIMIT_SATS = 546
DEFAULT_FEE_RATE_SAT_PER_VBYTE = 1
MIN_SEND_AMOUNT = 1000

TX_SIZE: {
  BASE: 10,
  P2WPKH_INPUT: 68,
  P2WPKH_OUTPUT: 31,
  P2TR_INPUT: 58,
  P2TR_OUTPUT: 43,
}
```

---

## 11. CRITICAL DEPLOYMENT CONSIDERATIONS

### Environment Variables
Required for production:
- `EXPO_PUBLIC_COINGECKO_API_KEY` - CoinGecko API key (optional, for rate limits)
- Sentry DSN - Already hardcoded in App.js

### Network Configuration
- **Testnet Only:** Mutinynet/Signet configured
- **Address Validation:** Prevents mainnet addresses
- **No Mainnet Support:** Hard-coded testnet constants

### Security Checklist
- [ ] Verify `withMnemonic()` is used for all mnemonic access
- [ ] Confirm SecureStore is using device encryption (iOS Keychain, Android Keystore)
- [ ] Test PIN lockout after 10 failures (30 min)
- [ ] Verify Sentry error tracking is working
- [ ] Test Passkey creation and recovery flow
- [ ] Validate iCloud backup encryption
- [ ] Confirm seed phrase backup is secure
- [ ] Test biometric auth fallback
- [ ] Verify address validation rejects mainnet
- [ ] Check UTXO selection doesn't include dust

### Performance Considerations
- **Cold Start:** Wallet initialization (~500ms)
- **Balance Fetch:** ~1-2 seconds from Mutinynet API
- **Transaction Build:** ~100-200ms (PSBT construction)
- **Transaction Sign:** ~50-100ms (ECDSA/Schnorr)
- **Memory:** Mnemonic held <100ms during key derivation

### iOS Specific
- **Associated Domains:** `ducatprotocol.com` (passkey sync)
- **iCloud Entitlements:** Configured in app.json
- **Face ID Description:** "We use Face ID to securely authenticate..."
- **Camera Permission:** "We need camera access to scan QR codes..."
- **Bundle ID:** `com.anonymous.SimpleWallet`

### Android Specific
- **Adaptive Icon:** Configured in app.json
- **Edge-to-Edge:** Enabled in app.json
- **Package:** `com.anonymous.SimpleWallet`

---

## 12. KNOWN PATTERNS & BEST PRACTICES

### Memory Safety
- ✅ `withMnemonic()` pattern for mnemonic access
- ✅ String overwriting with random bytes
- ✅ Immediate variable nullification
- ⚠️ JavaScript limitations: GC may retain copies

### State Management
- ✅ Memoized context values prevent re-renders
- ✅ Separate concerns: auth, wallet, data, UI
- ✅ Custom hooks for isolated logic
- ⚠️ Deep provider nesting (13 contexts) - monitor performance

### Error Handling
- ✅ Sentry integration for production errors
- ✅ User-facing error messages
- ✅ Detailed logging with prefixes
- ⚠️ Some error messages could be more specific

### Testing
- ✅ Unit tests for critical functions
- ✅ Context and hook testing
- ✅ Jest + React Native Testing Library
- ⚠️ Integration tests for transaction flow would be beneficial

---

## 13. ARCHITECTURE DIAGRAMS

### Component Hierarchy
```
App
├── AuthProvider
│   └── WalletProvider
│       └── UIProvider
│           └── PendingTransactionsProvider
│           └── WalletDataProvider
│           └── PriceProvider
│               └── AppNavigator
│                   └── RootNavigator
│                       ├── AuthStack (lock screen)
│                       └── MainTabs
│                           ├── WalletStack
│                           ├── SendFlow (modal)
│                           ├── SettingsStack
│                           └── VaultTab
```

### Data Flow (Send Transaction)
```
UI Input (Address, Amount)
  ↓
ValidationService
  ↓
TransactionBuildContext
  ├─ UTXOs Selection
  ├─ Fee Calculation
  └─ PSBT Creation
  ↓
ReviewScreen (user confirmation)
  ↓
TransactionExecutionContext
  ├─ Sign (withMnemonic pattern)
  ├─ Broadcast
  └─ Track
  ↓
PendingTransactionsContext
  ├─ Queue pending TX
  └─ Poll status
  ↓
Balance Update
```

### Security Layers
```
User Input (Address, Amount)
  ↓
→ Format Validation (regex)
→ Bitcoin Validation (bitcoinjs-lib)
  ↓
Transaction Creation
  ↓
→ UTXO Validation (dust limit)
→ Fee Validation (min/max rates)
  ↓
Transaction Signing
  ↓
→ Biometric/PIN Auth
→ Mnemonic Retrieval (withMnemonic)
→ PSBT Signing
  ↓
Broadcast
  ↓
→ Status Polling
→ Balance Verification
```

---

## 14. SUMMARY TABLE

| Metric | Value |
|--------|-------|
| Total Source Files | ~260 |
| Component Files | 45+ |
| Screen Files | 15 |
| Context Files | 13 |
| Custom Hooks | 39 |
| Service Files | 20+ |
| Utility Files | 20+ |
| Total Dependencies | 50+ |
| Bitcoin Libraries | 5 |
| Lines of Code (estimated) | 50,000+ |
| Test Files | 30+ |
| Security Critical Files | 8 |
| Contexts (nested) | 13 |
| Supported Networks | Testnet (Mutinynet) |
| Target Platforms | iOS, Android |
| React Version | 19.1.0 |
| React Native Version | 0.81.5 |
| Expo Version | 54.0.20 |

---

## 15. FINAL RECOMMENDATIONS

### For Production Testnet Deployment

1. **Security Audit**
   - [ ] Review all `withMnemonic()` implementations
   - [ ] Audit Passkey integration with iCloud
   - [ ] Test PIN lockout mechanism thoroughly
   - [ ] Verify Sentry doesn't leak sensitive data

2. **Testing**
   - [ ] Integration tests for full transaction flow
   - [ ] Load testing for balance fetch
   - [ ] Test all error paths
   - [ ] Biometric auth testing on real devices

3. **Monitoring**
   - [ ] Enable Sentry error tracking
   - [ ] Monitor API latency (Mutinynet)
   - [ ] Track transaction success rates
   - [ ] Monitor auth failures

4. **Documentation**
   - [ ] User guide for passkey setup
   - [ ] Backup/recovery procedures
   - [ ] Security best practices
   - [ ] Troubleshooting guide

5. **Performance**
   - [ ] Profile app startup time
   - [ ] Monitor memory usage with large transaction histories
   - [ ] Test on low-end Android devices
   - [ ] Optimize bundle size

---

**Document Generated:** 2025-11-17  
**Codebase Version:** Latest (main branch)  
**Analysis Depth:** Comprehensive (all major files examined)
