# Passkey Integration Analysis - Ducat Bitcoin Wallet

## Executive Summary

This document provides a comprehensive analysis of the current authentication, key derivation, and wallet creation systems in the Ducat React Native Bitcoin wallet app. It identifies the architecture and integration points for implementing passkey (WebAuthn/FIDO2) authentication.

---

## 1. CURRENT AUTHENTICATION FLOW

### 1.1 Authentication Entry Point

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/contexts/AuthContext.js`

The `AuthContext` is the root authentication provider that wraps the entire app. It:
- Provides authentication state (isAuthenticated, biometricEnabled, PIN states)
- Consolidates auth and onboarding flow state
- Exports `useAuth()` hook for accessing auth state globally
- Manages wallet reset and onboarding state cleanup

**Key exports**:
```javascript
- useAuth()           // Primary hook for auth state
- useOnboardingFlow() // Backwards compatibility for onboarding state
- AuthProvider        // Provider component
```

### 1.2 Authentication Methods (Current)

#### A. PIN Authentication

**Primary file**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/services/pinService.js`

PIN implementation includes:
- **PIN Storage**: Hashed with PBKDF2-like approach using SHA512
- **Salt Management**: Random 32-byte salt per user
- **Iteration Count**: 10,000 iterations for security
- **Rate Limiting**: 10 failed attempts → 30-minute lockout

Key functions:
```javascript
savePin(pin)                    // Hash and store PIN
verifyPin(enteredPin)          // Verify with rate limiting
checkPinLockout()              // Check if locked out
resetPinAttempts()             // Reset after successful auth
getRemainingPinAttempts()      // Get remaining attempts
```

**Security Configuration** (`/app/constants/security.js`):
```javascript
PIN = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 6,
  MAX_ATTEMPTS: 10,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
}

CRYPTO = {
  PIN_HASH_ITERATIONS: 10000,
  SALT_LENGTH_BYTES: 32,
}
```

#### B. Biometric Authentication

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/services/biometricService.js`

Biometric implementation:
- Uses `expo-local-authentication` library
- Supports Face ID, Touch ID, and other platform biometrics
- Optional - users can enable/disable it
- Falls back to PIN if biometric fails

Key functions:
```javascript
checkBiometricSupport()              // Check if device supports biometrics
authenticateWithBiometrics()         // Trigger biometric prompt
isBiometricEnabled()                 // Check user preference
setBiometricEnabled(enabled)         // Save user preference
```

#### C. Hook: useAuth

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/hooks/useAuth.js`

State management for authentication:
- `isAuthenticated`: Boolean - whether user is authenticated
- `biometricEnabled`: Boolean - whether biometric is enabled
- `settingUpPin`: Boolean - PIN setup flow active
- `showBiometricPrompt`: Boolean - show biometric auth prompt
- PIN entry states: `pin`, `confirmPin`, `pinError`, `pinStep`

Key functions:
```javascript
authenticateUser()               // Trigger biometric or PIN auth
handlePinSetupComplete()         // Complete PIN setup
handlePinChangeComplete()        // Complete PIN change
handleLockScreenAuthenticated()  // Unlock from PIN entry
lock()                           // Lock the wallet
resetAuth()                      // Reset all auth state
loadBiometricPreference()        // Load biometric setting
startPinChange()                 // Initiate PIN change flow
```

---

## 2. SECURE STORAGE SYSTEM

### 2.1 Storage Infrastructure

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/services/secureStorageService.js`

Uses `expo-secure-store` which leverages:
- **iOS**: Keychain
- **Android**: Android Keystore

**Stored Keys** (`/app/utils/constants.js`):
```javascript
SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  PIN: 'wallet_pin_v1',
  PIN_SALT: 'wallet_pin_salt_v1',
  PIN_VERSION: 'wallet_pin_version_v1',
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
}
```

### 2.2 What's Stored

| Data | Key | Protection | Notes |
|------|-----|-----------|-------|
| BIP39 Mnemonic | MNEMONIC | Keychain/Keystore | 12-word seed phrase |
| Account Index | CURRENT_ACCOUNT | Keychain/Keystore | Current HD wallet account |
| PIN Hash | PIN | Keychain/Keystore | PBKDF2-SHA512 hashed |
| PIN Salt | PIN_SALT | Keychain/Keystore | 32-byte random salt |
| PIN Version | PIN_VERSION | Keychain/Keystore | Algorithm version (for migration) |
| Biometric Flag | BIOMETRIC_ENABLED | Keychain/Keystore | Boolean string ('true'/'false') |

### 2.3 Key Security Functions

**Memory Protection**:
```javascript
securelyWipeString(str)  // Attempt to overwrite sensitive strings
```

**Safe Mnemonic Access**:
```javascript
withMnemonic(callback)   // Get mnemonic, auto-cleanup after callback
```

This pattern ensures the mnemonic is retrieved from secure storage, passed to callback, then cleared from memory.

---

## 3. KEY DERIVATION SYSTEM

### 3.1 BIP39 & BIP32 Implementation

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/utils/bitcoin.js`

**Mnemonic Generation**:
- Uses `expo-crypto.getRandomBytesAsync(16)` for 128-bit entropy
- Generates 12-word BIP39 mnemonic via `bip39.entropyToMnemonic()`
- Validates with `bip39.validateMnemonic()`

**Seed Derivation**:
```javascript
const seed = bip39.mnemonicToSeedSync(mnemonic)  // BIP39 PBKDF2-HMAC-SHA512
const root = bip32.fromSeed(seed, MUTINYNET_NETWORK)
```

### 3.2 Address Derivation

**Network**: Mutinynet (Bitcoin Signet for testing)

Two address types are derived:

#### SegWit (BIP84)
```
Derivation Path: m/84'/1'/0'/0/{accountIndex}
Address Type: P2WPKH (Pay-to-Witness-Public-Key-Hash)
Prefix: tb1q... (testnet bech32)
```

#### Taproot (BIP86)
```
Derivation Path: m/86'/1'/0'/0/{accountIndex}
Address Type: P2TR (Pay-to-Taproot)
Prefix: tb1p... (testnet bech32m)
Public Key: x-only (32-byte)
```

**Key Function**:
```javascript
deriveAddressesFromMnemonic(mnemonic, accountIndex = 0)
// Returns: {
//   segwitAddress: string,
//   taprootAddress: string,
//   segwitPubkey: hex string,
//   taprootPubkey: x-only hex string (32 bytes)
// }
```

### 3.3 Account Switching

Wallet supports HD wallet account switching:
- Each account is derived at different `accountIndex` in the path
- Current account stored in secure storage
- Can have unlimited accounts (practical limit is UX)

**Function**:
```javascript
switchToAccount(accountIndex)  // Switch to different account
getCurrentAccount()            // Get current account index
```

---

## 4. WALLET CREATION FLOW

### 4.1 New Wallet Creation

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/hooks/useWalletCreation.js`

**Flow**:
1. Generate random 16 bytes → 12-word mnemonic
2. Derive initial addresses (SegWit + Taproot)
3. Show intro screen
4. Show seed phrase for user to write down
5. User completes PIN setup
6. After PIN verification → Save mnemonic to secure storage
7. Load wallet into context

**State Management**:
- Persists to `AsyncStorage` (not encrypted) during creation
- Cleared after wallet is saved to secure storage
- Recovers from backgrounding

**Key Functions**:
```javascript
createWallet()                   // Generate new wallet
saveWalletAfterPinSetup()       // Save after PIN setup
resetCreationState()             // Cancel creation
```

### 4.2 Wallet Import

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/hooks/useWalletImport.js`

**Flow**:
1. User enters 12-word seed phrase (or 24-word)
2. Validates with BIP39
3. Derives addresses
4. Saves to secure storage
5. Loads into wallet context
6. Proceeds to PIN setup

**Key Functions**:
```javascript
importWallet()                   // Import from seed phrase
resetImportState()               // Cancel import
```

### 4.3 Wallet Service

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/services/walletService.js`

Core wallet operations:
```javascript
generateWallet(accountIndex)     // Create new wallet
importWallet(mnemonic, accountIndex)  // Import existing
saveWalletToStorage(mnemonic, accountIndex)  // Save to secure storage
loadWalletFromStorage()          // Load from secure storage
switchToAccount(accountIndex)    // Switch accounts
```

---

## 5. WALLET CONTEXT

**File**: `/Users/lucasrodriguez/Desktop/Ducat/app/app/contexts/WalletContext.js`

**State**:
```javascript
wallet = {
  segwitAddress: string,
  taprootAddress: string,
  taprootPubkey: hex string,
}
currentAccount: number  // Account index (0, 1, 2, ...)
```

**Functions**:
```javascript
loadWallet()             // Load from secure storage
setWalletAddresses()     // Set in-memory wallet state
switchAccount()          // Switch to different account
resetWallet()            // Clear wallet (for logout)
```

---

## 6. AUTHENTICATION STATE HIERARCHY

```
App.js
├── AuthProvider (Authentication + Onboarding)
│   ├── useAuth() hook (PIN + Biometric state)
│   └── useOnboardingFlow() (backwards compat)
│
├── WalletProvider (Wallet state)
│   ├── wallet (addresses)
│   └── currentAccount
│
├── UIProvider (Toast + UI state)
└── AppNavigator
    └── Auth/Onboarding screens or Main app
```

---

## 7. CURRENT AUTHENTICATION SEQUENCE

### New User (Create Wallet)
```
1. App Launch
   ↓
2. Check if wallet exists (loadWallet)
   ↓ No wallet found
3. Show Onboarding
   ↓
4. User taps "Create Wallet"
   ↓
5. Generate mnemonic + addresses
   ↓
6. Show Seed Phrase screen
   ↓
7. User writes down seed
   ↓
8. Show PIN Setup screen
   ↓
9. User enters PIN
   ↓
10. PIN hashed and stored (secureStorageService.savePin)
    ↓
11. Mnemonic saved to secure storage
    ↓
12. App authenticated (isAuthenticated = true)
    ↓
13. Load main wallet screen
```

### Existing User (App Launch)
```
1. App Launch
   ↓
2. Check if wallet exists (loadWallet)
   ↓ Wallet found, but isAuthenticated = false
3. Show Lock Screen
   ↓
4. User action (Biometric or PIN entry)
   ↓ Biometric enabled?
5a. Trigger Face ID/Touch ID
    ↓ Success
5b. authenticate with PIN
    ↓ Verify against stored hash
    ↓
6. isAuthenticated = true
   ↓
7. Load main app
```

### PIN Change
```
1. User in Settings
   ↓
2. Tap "Change PIN"
   ↓
3. If biometric enabled: trigger biometric
   If not: wallet auto-locked
   ↓
4. User authenticates
   ↓
5. Show PIN setup screen
   ↓
6. User enters new PIN
   ↓
7. New PIN hashed and stored
   ↓
8. Return to settings
```

---

## 8. CRITICAL FINDINGS FOR PASSKEY INTEGRATION

### 8.1 Separation of Concerns

The current system cleanly separates:
- **Authentication**: PIN/Biometric (unlocks wallet)
- **Key Material**: BIP39 Mnemonic (generates addresses)
- **Wallet Data**: Addresses and account index

This is GOOD architecture for passkey integration because:
1. Passkeys don't need to change key derivation
2. Passkeys replace/supplement PIN authentication
3. Mnemonic remains in secure storage independent of auth method

### 8.2 Current Assumption

The system assumes:
- **One PIN** per wallet (6 digits, hashed, rate-limited)
- **Optional Biometric** on top of PIN
- **Mnemonic never changes** (only account index changes)
- **Account switching** is independent of auth

### 8.3 Integration Points for Passkeys

#### Primary Integration Points:
1. **pinService.js** - Replace PIN verification with passkey verification
2. **biometricService.js** - Add passkey service alongside biometric
3. **useAuth.js** - Add passkey state to hook
4. **AuthContext.js** - Manage passkey registration/authentication state
5. **secureStorageService.js** - Store passkey metadata/handles

#### Secondary Integration Points:
1. **constants.js** - Add PASSKEY secure storage keys
2. **useWalletCreation.js** - Add passkey option during onboarding
3. **useWalletImport.js** - Add passkey option during import
4. **Navigation** - Add passkey setup screens

### 8.4 What DOESN'T Change

- **Mnemonic generation/derivation**: Stays the same
- **Address derivation**: Stays the same
- **BIP32/BIP39 logic**: Stays the same
- **Wallet context**: Stays the same
- **Secure storage for mnemonic**: Stays the same

---

## 9. PASSKEY INTEGRATION ARCHITECTURE

### 9.1 Proposed Passkey Service

**New file**: `app/services/passkeyService.js`

Should handle:
```javascript
checkPasskeySupport()           // Check if WebAuthn available
registerPasskey()               // Create new credential
authenticateWithPasskey()       // Verify credential
listPasskeys()                  // Get registered credentials
removePasskey(credentialId)     // Delete credential
```

### 9.2 Secure Storage for Passkey Data

**New constants in SECURE_KEYS**:
```javascript
PASSKEY_REGISTERED: 'wallet_passkey_registered_v1',
PASSKEY_CREDENTIAL_IDS: 'wallet_passkey_credential_ids_v1',
PASSKEY_USER_HANDLE: 'wallet_passkey_user_handle_v1',
PASSKEY_RP_ID: 'wallet_passkey_rp_id_v1',
```

### 9.3 Authentication Flow with Passkeys

**Registration**:
```
1. User in setup flow
2. Tap "Set up Passkey"
3. System shows webauthn prompt
4. User authenticates with biometric/PIN
5. Credential created and stored
6. Metadata saved to secure storage
```

**Authentication**:
```
1. App launch, wallet locked
2. Tap "Use Passkey"
3. System shows webauthn prompt
4. User authenticates with biometric
5. Credential verified
6. Wallet unlocked (isAuthenticated = true)
```

### 9.4 Conditional UI Flow

The app should support:
- **Create wallet**: PIN only → Passkey (optional) → Biometric (optional)
- **Import wallet**: PIN only → Passkey (optional) → Biometric (optional)
- **Lock screen**: Passkey → PIN → Biometric (in order of enabled)
- **Settings**: Enable/disable passkey, manage credentials

---

## 10. DEPENDENCIES & LIBRARIES

### Current Auth-Related Dependencies

```json
{
  "expo-local-authentication": "~17.0.7",      // Biometric
  "expo-secure-store": "~15.0.7",              // Secure storage
  "expo-crypto": "~15.0.7",                    // Crypto operations
  "bip39": "^3.1.0",                           // Mnemonic
  "bip32": "^5.0.0",                           // HD wallet
  "@bitcoinerlab/secp256k1": "^1.2.0",         // Crypto
}
```

### Recommended for Passkey Support

```json
{
  "@react-native-webauthn/webauthn": "latest", // WebAuthn for React Native
  // OR
  "react-native-webauthn": "latest",
  // OR
  "expo-web-browser": "^15.0.9"  // Already included, can use for fallback
}
```

---

## 11. FILE STRUCTURE SUMMARY

```
app/
├── contexts/
│   ├── AuthContext.js              [PRIMARY: Auth state management]
│   ├── WalletContext.js            [Wallet state]
│   └── SeedPhraseContext.js        [Seed phrase viewing]
│
├── services/
│   ├── authService.js              [Re-exports other auth services]
│   ├── pinService.js               [PIN hashing & verification]
│   ├── biometricService.js         [Biometric authentication]
│   ├── secureStorageService.js     [Secure storage operations]
│   ├── walletService.js            [Wallet creation/import]
│   └── passkeyService.js           [NEW: Passkey operations]
│
├── hooks/
│   ├── useAuth.js                  [Auth state management]
│   ├── useWalletCreation.js        [New wallet flow]
│   └── useWalletImport.js          [Import existing wallet]
│
├── constants/
│   ├── security.js                 [PIN & crypto constants]
│   └── index.js
│
├── utils/
│   ├── constants.js                [Secure storage keys]
│   └── bitcoin.js                  [Key derivation]
│
└── screens/
    ├── onboarding/                 [Onboarding screens]
    ├── auth/                        [Auth screens]
    └── settings/                    [Settings & security]
```

---

## 12. IMPLEMENTATION ROADMAP

### Phase 1: Foundation
1. Create `passkeyService.js` with basic operations
2. Add passkey constants to `SECURE_KEYS`
3. Update `useAuth` hook to include passkey state
4. Update `AuthContext` to manage passkey registration

### Phase 2: Integration
1. Create passkey registration screen
2. Create passkey authentication screen
3. Add passkey option to PIN setup flow
4. Add passkey management to settings

### Phase 3: UX Polish
1. Add passkey recovery options
2. Implement multiple passkey management
3. Add fallback authentication chains
4. Test edge cases (device change, etc.)

### Phase 4: Testing
1. Unit tests for `passkeyService`
2. Integration tests with secure storage
3. E2E tests for registration and auth
4. Device testing (multiple devices)

---

## 13. KEY SECURITY CONSIDERATIONS

### 13.1 PIN Remains as Backup
- Passkey should NOT replace PIN entirely
- Users should set PIN as backup
- Create passkey AFTER PIN setup

### 13.2 Credential Binding
- Credential IDs should be stored in secure storage
- User handle should be persistent
- Device binding should be enforced

### 13.3 Rate Limiting
- Apply rate limiting to passkey auth attempts
- Same lockout mechanism as PIN
- Clear attempt counter on success

### 13.4 Recovery Flow
- If passkey fails, fall back to PIN
- If both fail, allow seed phrase recovery
- Clear audit trail of attempts

---

## 14. CONCLUSION

The Ducat wallet has a well-architected authentication system that cleanly separates authentication from key derivation. Passkey integration is straightforward because:

1. **Authentication is modular**: PIN/Biometric services are independent
2. **Key storage is separate**: Mnemonic stored independently in secure storage
3. **Clear interfaces**: Services have well-defined APIs
4. **HD wallet support**: Already handles multiple accounts

The main work is:
1. Creating a passkey service (similar to biometricService)
2. Updating auth context and hooks
3. Adding UI screens for passkey setup and authentication
4. Managing passkey credentials in secure storage

No changes needed to key derivation, address generation, or wallet logic.

