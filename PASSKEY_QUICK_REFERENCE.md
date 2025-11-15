# Passkey Integration Quick Reference

## Key Files & Locations

### Authentication System
- **AuthContext**: `/app/contexts/AuthContext.js` - Root auth provider
- **useAuth hook**: `/app/hooks/useAuth.js` - Auth state management
- **PIN Service**: `/app/services/pinService.js` - PIN hashing & verification
- **Biometric Service**: `/app/services/biometricService.js` - Biometric auth
- **Secure Storage**: `/app/services/secureStorageService.js` - Credential storage

### Wallet System
- **WalletContext**: `/app/contexts/WalletContext.js` - Wallet state
- **Wallet Service**: `/app/services/walletService.js` - Wallet creation/import
- **Key Derivation**: `/app/utils/bitcoin.js` - BIP39/BIP32 logic
- **Wallet Creation Hook**: `/app/hooks/useWalletCreation.js` - New wallet flow
- **Wallet Import Hook**: `/app/hooks/useWalletImport.js` - Import wallet flow

### Constants
- **Security Constants**: `/app/constants/security.js` - PIN config, crypto settings
- **Storage Keys**: `/app/utils/constants.js` - Secure storage key names

---

## PIN Implementation Reference

### How PIN is Stored
```javascript
// FROM: pinService.js - savePin()

const salt = await generateSalt();  // 32 random bytes
const hashedPin = await hashPin(pin, salt);  // PBKDF2-like (10k iterations)

await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_10K);
```

### How PIN is Verified
```javascript
// FROM: pinService.js - verifyPin()

const lockStatus = await checkPinLockout();
if (lockStatus.isLocked) {
  return {
    success: false,
    error: `Too many failed attempts. Try again in ${lockStatus.remainingTime} minutes.`,
    remainingAttempts: 0,
  };
}

const storedHashedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
const storedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
const enteredHashedPin = await hashPin(enteredPin, storedSalt);

const isValid = storedHashedPin === enteredHashedPin;

if (isValid) {
  await resetPinAttempts();
  return { success: true };
} else {
  // Increment failed attempts, apply lockout if needed
  return {
    success: false,
    error: 'Incorrect PIN',
    remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - newFailedAttempts),
  };
}
```

### Rate Limiting
```javascript
// Constants (from /app/constants/security.js)
MAX_PIN_ATTEMPTS = 10
LOCKOUT_DURATION_MS = 30 * 60 * 1000  // 30 minutes

// After 10 failed attempts:
lockoutUntil = Date.now() + LOCKOUT_DURATION_MS
```

---

## Key Derivation Reference

### Mnemonic Generation
```javascript
// FROM: walletService.js - generateWallet()

const randomBytes = await Crypto.getRandomBytesAsync(16);  // 128-bit entropy
const mnemonic = bip39.entropyToMnemonic(Buffer.from(randomBytes).toString('hex'));
// Result: 12-word BIP39 mnemonic

const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex = 0);
// Result: { segwitAddress, taprootAddress, segwitPubkey, taprootPubkey }
```

### Address Derivation
```javascript
// FROM: bitcoin.js - deriveAddressesFromMnemonic()

const seed = bip39.mnemonicToSeedSync(mnemonic);  // BIP39 PBKDF2-HMAC-SHA512
const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

// SegWit (BIP84)
const segwitPath = `m/84'/1'/0'/0/${accountIndex}`;
const segwitChild = root.derivePath(segwitPath);
const segwitPayment = bitcoin.payments.p2wpkh({
  pubkey: segwitChild.publicKey,
  network: MUTINYNET_NETWORK,
});
// Result: segwitAddress = "tb1q..." (testnet bech32)

// Taproot (BIP86)
const taprootPath = `m/86'/1'/0'/0/${accountIndex}`;
const taprootChild = root.derivePath(taprootPath);
const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
const taprootPayment = bitcoin.payments.p2tr({
  internalPubkey: xOnlyPubkey,
  network: MUTINYNET_NETWORK,
});
// Result: taprootAddress = "tb1p..." (testnet bech32m)
```

### Seed Phrase Secure Access Pattern
```javascript
// FROM: secureStorageService.js - withMnemonic()

export const withMnemonic = async (callback) => {
  let mnemonic = null;
  try {
    mnemonic = await getMnemonic();
    if (!mnemonic) throw new Error('Mnemonic not found');
    return await callback(mnemonic);
  } finally {
    // Securely wipe from memory
    if (mnemonic) {
      mnemonic = securelyWipeString(mnemonic);
      mnemonic = null;
    }
  }
};

// USAGE EXAMPLE:
const addresses = await AuthService.withMnemonic(async (mnemonic) => {
  return deriveAddressesFromMnemonic(mnemonic, accountIndex);
});
// Mnemonic is automatically cleared after callback completes
```

---

## Secure Storage Reference

### What's Stored
```javascript
// FROM: /app/utils/constants.js

SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  PIN: 'wallet_pin_v1',
  PIN_SALT: 'wallet_pin_salt_v1',
  PIN_VERSION: 'wallet_pin_version_v1',
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
};

PIN_HASH_VERSION = {
  SHA256_LEGACY: '1',
  PBKDF2_10K: '2',
};
```

### Storage Infrastructure
```javascript
// Uses: expo-secure-store
// iOS Backend: Keychain
// Android Backend: Android Keystore

import * as SecureStore from 'expo-secure-store';

// Set item (encrypted at rest)
await SecureStore.setItemAsync(key, value);

// Get item
const value = await SecureStore.getItemAsync(key);

// Delete item
await SecureStore.deleteItemAsync(key);
```

---

## Authentication Hook Reference

### State Available from useAuth()
```javascript
const auth = useAuth();

// Authentication state
auth.isAuthenticated              // boolean
auth.isBiometricSupported         // boolean
auth.biometricEnabled             // boolean
auth.showBiometricPrompt          // boolean
auth.showFaceIdButton             // boolean

// PIN setup state
auth.settingUpPin                 // boolean
auth.changingPin                  // boolean
auth.showPinEntry                 // boolean
auth.pin                          // string
auth.confirmPin                   // string
auth.pinError                     // string
auth.pinStep                      // 'enter' | 'confirm'

// Functions
auth.authenticateUser()           // Trigger biometric/PIN auth
auth.handlePinSetupComplete()     // Mark PIN setup done
auth.handlePinChangeComplete()    // Mark PIN change done
auth.handleLockScreenAuthenticated() // Unlock wallet
auth.lock()                       // Lock wallet
auth.resetAuth()                  // Reset all auth state
auth.loadBiometricPreference()    // Load user preference
auth.startPinChange()             // Begin PIN change flow
```

### Example: Check if User is Authenticated
```javascript
function MyComponent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return <WalletScreen />;
}
```

---

## Biometric Implementation Reference

### Check Support
```javascript
import * as LocalAuthentication from 'expo-local-authentication';

const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();

if (hasHardware && isEnrolled) {
  // Biometric available
}
```

### Trigger Authentication
```javascript
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Authenticate to access your wallet',
  fallbackLabel: 'Use PIN',
  disableDeviceFallback: false,
});

if (result.success) {
  // User authenticated
}
```

### Save User Preference
```javascript
await SecureStore.setItemAsync(
  SECURE_KEYS.BIOMETRIC_ENABLED,
  'true'
);
```

---

## Wallet Creation Flow Reference

### New Wallet
```javascript
// FROM: useWalletCreation.js

const createWallet = async () => {
  // 1. Generate wallet
  const { mnemonic, addresses } = await WalletService.generateWallet(currentAccount);

  // 2. DON'T save yet - wait for PIN setup
  // This prevents users from skipping verification

  // 3. Show seed phrase to user
  setShowingIntro(true);
  setTempMnemonic(mnemonic);
  setWalletAddresses(addresses, 0);
};

// After PIN setup completes:
const saveWalletAfterPinSetup = async () => {
  // 4. Save wallet to secure storage
  await WalletService.saveWalletToStorage(tempMnemonic, currentAccount);

  // 5. Load wallet into context
  if (loadWallet) await loadWallet();

  // 6. Clear temp mnemonic from memory
  setTempMnemonic('*'.repeat(tempMnemonic.length));
  setTimeout(() => setTempMnemonic(''), 100);
};
```

### Import Wallet
```javascript
// FROM: useWalletImport.js

const importWallet = async () => {
  try {
    const mnemonic = importSeedPhrase
      .map(word => word.trim().toLowerCase())
      .join(' ')
      .trim();

    // 1. Validate and derive addresses
    const { addresses } = await WalletService.importWallet(mnemonic, currentAccount);

    // 2. Save to secure storage
    await WalletService.saveWalletToStorage(mnemonic, currentAccount);

    // 3. Load into context
    if (loadWallet) await loadWallet();

    // 4. Proceed to PIN setup
    setSettingUpPin(true);
  } catch (error) {
    showToast('Invalid seed phrase', 'error');
  }
};
```

---

## Passkey Integration Points

### Where to Add Passkey Service
```javascript
// NEW FILE: app/services/passkeyService.js

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';

export const checkPasskeySupport = async () => {
  // Check if WebAuthn available on device
  // Platform-specific implementation
};

export const registerPasskey = async (username, displayName) => {
  // Trigger WebAuthn registration
  // Store credential IDs in secure storage
};

export const authenticateWithPasskey = async () => {
  // Trigger WebAuthn authentication
  // Verify challenge
};

export const listPasskeys = async () => {
  // List registered passkeys
};

export const removePasskey = async (credentialId) => {
  // Remove passkey credential
};
```

### Update Secure Keys
```javascript
// ADD TO: /app/utils/constants.js

SECURE_KEYS = {
  // ... existing keys ...
  PASSKEY_REGISTERED: 'wallet_passkey_registered_v1',
  PASSKEY_CREDENTIAL_IDS: 'wallet_passkey_credential_ids_v1',
  PASSKEY_USER_HANDLE: 'wallet_passkey_user_handle_v1',
  PASSKEY_RP_ID: 'wallet_passkey_rp_id_v1',
};
```

### Update useAuth Hook
```javascript
// MODIFY: /app/hooks/useAuth.js

export function useAuth({ onSeedConfirmed }) {
  // ... existing PIN & biometric states ...

  // Add passkey states
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [settingUpPasskey, setSettingUpPasskey] = useState(false);

  // Add passkey functions
  const authenticateWithPasskey = useCallback(async () => {
    const result = await PasskeyService.authenticateWithPasskey();
    if (result.success) {
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  return useMemo(
    () => ({
      // ... existing returns ...
      passkeyEnabled,
      settingUpPasskey,
      authenticateWithPasskey,
      setPasskeyEnabled,
      setSettingUpPasskey,
    }),
    [/* deps */]
  );
}
```

---

## Important Security Patterns

### Pattern 1: Secure Mnemonic Access
```javascript
// ALWAYS use this pattern when accessing mnemonic
const addresses = await AuthService.withMnemonic(async (mnemonic) => {
  // Use mnemonic here
  return deriveAddressesFromMnemonic(mnemonic, accountIndex);
  // Mnemonic is automatically wiped after callback
});

// NEVER DO THIS:
const mnemonic = await AuthService.getMnemonic();
// ... lots of code ...
// Risk: mnemonic stays in memory
```

### Pattern 2: Rate Limiting
```javascript
// PIN automatically applies rate limiting
const result = await AuthService.verifyPin(enteredPin);

if (result.remainingAttempts === 0) {
  // Lock out for 30 minutes
}
```

### Pattern 3: State Persistence
```javascript
// Wallet creation state persists across backgrounding
// This prevents user from losing seed phrase setup progress

useEffect(() => {
  const saveState = async () => {
    await AsyncStorage.setItem(CREATION_STATE_KEY, JSON.stringify(state));
  };
  saveState();
}, [state]);

useEffect(() => {
  const loadState = async () => {
    const savedState = await AsyncStorage.getItem(CREATION_STATE_KEY);
    if (savedState) {
      // Restore state
    }
  };
  loadState();
}, []);
```

---

## Network Configuration

### Mutinynet (Bitcoin Signet for Testing)
```javascript
// FROM: /app/utils/bitcoin.js

MUTINYNET_NETWORK = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',  // testnet
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

// API Base: https://mutinynet.com/api
// ORD API: https://ord-mutinynet.ducatprotocol.com
```

---

## Testing Checklist

When implementing passkey integration, verify:

- [ ] Passkey registration completes successfully
- [ ] Passkey is stored in secure storage
- [ ] Passkey authentication unlocks wallet
- [ ] Fallback to PIN works when passkey fails
- [ ] Rate limiting applies to passkey attempts
- [ ] Multiple passkeys can be registered (if supported)
- [ ] Removing passkey clears secure storage
- [ ] Mnemonic is not affected by passkey changes
- [ ] Account switching works after passkey auth
- [ ] Lock/unlock cycle works with passkey
- [ ] Cross-device scenarios are handled
- [ ] Recovery flows work (seed phrase still accessible)

