# Passkey Implementation Status

## ✅ Completed (Phase 1 - Core Infrastructure)

### 1. Core Service Layer
**File:** `services/passkeyService.js` ✅ COMPLETE
- [x] Deterministic mnemonic derivation from passkey
- [x] HKDF-SHA256 entropy generation
- [x] Mnemonic encryption/decryption
- [x] Create wallet with passkey
- [x] Unlock wallet with passkey
- [x] Recover wallet on new device
- [x] Add passkey to existing wallet (migration)
- [x] Remove passkey
- [x] Clear passkey data

**Functions Implemented:**
```javascript
✅ isPasskeySupported()
✅ createWalletWithPasskey({ userName, userDisplayName })
✅ unlockWithPasskey()
✅ recoverWithPasskey()
✅ addPasskeyToExistingWallet(mnemonic)
✅ isPasskeyEnabled()
✅ getWalletCreationMethod()
✅ removePasskey()
✅ clearPasskeyData()
```

### 2. Constants & Configuration
**Files:**
- `utils/constants.js` ✅ UPDATED
- `constants/security.js` ✅ UPDATED

**Added:**
```javascript
✅ SECURE_KEYS.PASSKEY_ENABLED
✅ SECURE_KEYS.PASSKEY_CREDENTIAL_ID
✅ SECURE_KEYS.PASSKEY_USER_HANDLE
✅ SECURE_KEYS.WALLET_CREATION_METHOD

✅ PASSKEY.RP_NAME
✅ PASSKEY.RP_ID
✅ PASSKEY.TIMEOUT_MS
✅ PASSKEY.DERIVATION_SALT
✅ PASSKEY.DERIVATION_INFO
✅ PASSKEY.ENTROPY_BITS
✅ PASSKEY.ENCRYPTION_KEY_BITS
```

### 3. Authentication Layer
**File:** `hooks/useAuth.js` ✅ UPDATED

**Added:**
```javascript
✅ isPasskeySupported state
✅ passkeyEnabled state
✅ showPasskeyPrompt state
✅ loadPasskeyPreference()
✅ authenticateWithPasskey()
✅ Passkey support check on mount
```

### 4. Documentation
**Files:**
- `PASSKEY_ARCHITECTURE.md` ✅ COMPLETE
- `PASSKEY_IMPLEMENTATION_STATUS.md` ✅ THIS FILE

---

## 🚧 Phase 2 - WebAuthn Integration (TODO)

### Critical Missing Component: Native WebAuthn Support

**Problem:** React Native doesn't have built-in WebAuthn/Passkey support yet.

**Solutions:**

#### Option A: Use `react-native-passkey` (Recommended)
```bash
npm install react-native-passkey
```

**Pros:**
- Native iOS/Android passkey support
- Works with iCloud Keychain / Google Password Manager
- Actively maintained

**Implementation:**
```javascript
import Passkey from 'react-native-passkey';

// Replace in passkeyService.js:
export const createWalletWithPasskey = async ({ userName, userDisplayName }) => {
  // Real WebAuthn credential creation
  const credential = await Passkey.register({
    challenge: await Crypto.getRandomBytesAsync(32),
    rp: {
      name: PASSKEY_CONFIG.RP_NAME,
      id: PASSKEY_CONFIG.RP_ID
    },
    user: {
      id: await Crypto.getRandomBytesAsync(16),
      name: userName,
      displayName: userDisplayName
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required'
    }
  });

  // Extract real credential data
  const credentialId = new Uint8Array(credential.rawId);
  const userHandle = new Uint8Array(credential.response.userHandle);

  // Rest of the implementation stays the same...
};
```

#### Option B: WebView-based Implementation
Use WebView with actual browser WebAuthn API.

**Pros:**
- Works without native module
- Uses standard WebAuthn API

**Cons:**
- More complex
- Less native feel
- Requires web server for relying party

---

## 📝 Phase 3 - UI Integration (TODO)

### Files to Create/Modify:

#### 1. Onboarding Flow
**File:** `screens/onboarding/PasskeySetupScreen.jsx` (NEW)

**Purpose:**
- Show during wallet creation
- Offer passkey as alternative to PIN
- Explain benefits (Face ID unlock, cross-device recovery)

**Flow:**
```
Welcome Screen
    ↓
"Create with Passkey" or "Create with PIN"
    ↓
[If Passkey selected]
    ↓
PasskeySetupScreen
    ↓
Face ID prompt
    ↓
Wallet created → Show seed phrase backup
```

#### 2. Recovery Flow
**File:** `screens/recovery/PasskeyRecoveryScreen.jsx` (NEW)

**Purpose:**
- Allow wallet recovery on new device
- Fallback to manual seed entry

**Flow:**
```
"Recover Wallet" screen
    ↓
"Recover with Passkey" or "Enter Seed Phrase"
    ↓
[If Passkey selected]
    ↓
Face ID prompt
    ↓
Wallet recovered
```

#### 3. Settings Integration
**File:** `screens/settings/SecuritySettingsScreen.jsx` (MODIFY)

**Add:**
- "Add Passkey" button (for existing PIN users)
- "Remove Passkey" option
- Show current auth methods (PIN + Passkey, or just one)

#### 4. Lock Screen
**File:** Update lock screen to show passkey option

**Add:**
- "Unlock with Passkey" button
- Fallback to PIN entry

---

## 🔧 Phase 4 - Testing (TODO)

### Test Cases

#### Unit Tests
**File:** `services/__tests__/passkeyService.test.js` (NEW)

```javascript
describe('passkeyService', () => {
  test('derives same mnemonic from same credential', async () => {
    // Test deterministic derivation
  });

  test('encrypts and decrypts mnemonic correctly', async () => {
    // Test encryption
  });

  test('validates mnemonic after decryption', async () => {
    // Test mnemonic validation
  });
});
```

#### Integration Tests
**File:** `hooks/__tests__/useAuth.passkey.test.js` (NEW)

```javascript
describe('useAuth with passkey', () => {
  test('loads passkey preference on mount', async () => {
    // Test loadPasskeyPreference
  });

  test('authenticates with passkey successfully', async () => {
    // Test authenticateWithPasskey
  });
});
```

#### E2E Tests (Manual)

**Test 1: Create Wallet with Passkey**
- [ ] Open app for first time
- [ ] Select "Create with Passkey"
- [ ] Face ID prompt appears
- [ ] Authenticate with Face ID
- [ ] Seed phrase backup screen appears
- [ ] Confirm seed words
- [ ] Wallet created successfully
- [ ] Can see balance screen

**Test 2: Unlock with Passkey (Same Device)**
- [ ] Lock wallet
- [ ] Tap "Unlock with Passkey"
- [ ] Face ID prompt appears
- [ ] Authenticate
- [ ] Wallet unlocks instantly
- [ ] Balance visible

**Test 3: Recover on New Device (Passkey Synced)**
- [ ] Install app on second iOS device (same Apple ID)
- [ ] Select "Recover Wallet"
- [ ] Choose "Recover with Passkey"
- [ ] Wait for iCloud sync (may take a minute)
- [ ] Face ID prompt appears
- [ ] Authenticate
- [ ] Wallet recovered with same addresses
- [ ] Balance matches original device

**Test 4: Disaster Recovery (Manual Seed)**
- [ ] Delete passkey from device
- [ ] Open app
- [ ] Select "Recover with Seed Phrase"
- [ ] Enter 12 words manually
- [ ] Wallet recovered
- [ ] Optionally add new passkey

**Test 5: Migration (Add Passkey to PIN Wallet)**
- [ ] Create wallet with PIN
- [ ] Go to Settings → Security
- [ ] Tap "Add Passkey"
- [ ] Authenticate with PIN
- [ ] Face ID prompt for passkey creation
- [ ] Passkey added
- [ ] Can now unlock with EITHER PIN or Passkey
- [ ] Lock wallet, try both methods

---

## 🚨 Known Limitations & TODOs

### 1. WebAuthn Implementation
**Status:** ⚠️ PLACEHOLDER
**Current:** Using random bytes to simulate credentials
**Needed:** Real WebAuthn integration via `react-native-passkey` or WebView

**Files to update when adding real WebAuthn:**
- `services/passkeyService.js` - Replace credential creation/authentication
- `hooks/useAuth.js` - Update `isPasskeySupported()` check

### 2. Encryption
**Status:** ⚠️ TEMPORARY
**Current:** Simple XOR encryption (placeholder)
**Needed:** Proper AES-256-GCM encryption

**Options:**
- `react-native-quick-crypto` (recommended)
- `expo-crypto` with polyfills
- Native modules for crypto operations

**Files to update:**
- `services/passkeyService.js` - `encryptMnemonic()` and `decryptMnemonic()`

### 3. Platform Support
**iOS:** ✅ iCloud Keychain supports passkey sync
**Android:** ✅ Google Password Manager supports passkey sync
**Web:** ❌ Not applicable (mobile-only app)

### 4. Production Checklist
- [ ] Update `PASSKEY.RP_ID` to actual domain
- [ ] Add proper error handling for passkey failures
- [ ] Add analytics for passkey adoption
- [ ] Add user education (tooltips, help screens)
- [ ] Test on multiple iOS versions (16+)
- [ ] Test on multiple Android versions (14+)
- [ ] Test passkey sync timing (can take minutes)
- [ ] Add rate limiting for passkey attempts
- [ ] Add fallback messaging if sync fails

---

## 📦 Dependencies to Add

```bash
# WebAuthn support (choose one)
npm install react-native-passkey

# Crypto (if using quick-crypto)
npm install react-native-quick-crypto

# Link native modules
npx pod-install  # iOS
```

---

## 🎯 Next Steps for Development

### Immediate (Before Testing):
1. **Install `react-native-passkey`**
   ```bash
   npm install react-native-passkey
   npx pod-install
   ```

2. **Replace placeholders in `passkeyService.js`**
   - Update `createWalletWithPasskey()` with real WebAuthn
   - Update `unlockWithPasskey()` with real authentication
   - Update `recoverWithPasskey()` with discovery mode

3. **Update encryption**
   - Install `react-native-quick-crypto`
   - Replace XOR with AES-256-GCM

### Short-term (UI):
4. **Create onboarding screens**
   - PasskeySetupScreen.jsx
   - PasskeyRecoveryScreen.jsx

5. **Update existing screens**
   - Add passkey option to lock screen
   - Add passkey settings to SecuritySettings

### Testing:
6. **Manual testing on real devices**
   - Test on iPhone (iOS 16+)
   - Test on Android (Android 14+)
   - Test passkey sync between devices

7. **Write automated tests**
   - Unit tests for passkeyService
   - Integration tests for useAuth

---

## 📚 Architecture Summary

### Data Flow

**Wallet Creation:**
```
User → Face ID → Passkey Credential
    ↓
Credential ID + User Handle
    ↓
HKDF-SHA256 (deterministic)
    ↓
128-bit Entropy
    ↓
BIP39 Mnemonic (12 words)
    ↓
BIP32 HD Wallet
    ↓
BIP84 (SegWit) + BIP86 (Taproot) Addresses
```

**Same Device Unlock:**
```
User → Face ID → Authenticate Passkey
    ↓
Retrieve Encrypted Mnemonic from SecureStore
    ↓
Derive Decryption Key from Passkey
    ↓
Decrypt Mnemonic
    ↓
Unlock Wallet
```

**New Device Recovery:**
```
User → Face ID → Passkey (synced via iCloud/Google)
    ↓
Extract Credential ID + User Handle
    ↓
Re-derive Entropy (same HKDF)
    ↓
Re-derive Mnemonic (deterministic)
    ↓
Same Wallet Addresses ✅
```

### Security Properties

1. **Deterministic:** Same passkey = same wallet
2. **Phishing-resistant:** Passkey bound to domain
3. **Replay-resistant:** Challenge-response protocol
4. **Biometric-protected:** Requires Face ID/Touch ID
5. **Sync-enabled:** Works across devices (iCloud/Google)
6. **Backup-compatible:** Still have 12-word seed phrase

---

## 🎉 Summary

**Completed:**
- ✅ Core cryptographic functions
- ✅ Deterministic key derivation
- ✅ Storage layer
- ✅ Auth hook integration
- ✅ Constants & configuration
- ✅ Comprehensive documentation

**Remaining:**
- 🚧 WebAuthn native integration
- 🚧 AES-256-GCM encryption
- 🚧 UI screens
- 🚧 Testing

**Estimated Time to Complete:**
- WebAuthn integration: 2-3 hours
- Encryption upgrade: 1 hour
- UI screens: 3-4 hours
- Testing: 2-3 hours
- **Total: 8-11 hours**

---

## 🧪 Ready for Testing?

**Not yet!** Need to complete:
1. Install `react-native-passkey`
2. Replace WebAuthn placeholders
3. Add basic UI (at minimum, add passkey option to onboarding)
4. Test on real iOS/Android device

**After those steps:** You can start testing wallet creation and recovery with real passkeys!
