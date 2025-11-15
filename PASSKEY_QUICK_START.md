# Passkey Quick Start Guide

## 🎯 What's Been Implemented

### Core Infrastructure (Phase 1) ✅ COMPLETE

1. **passkeyService.js** - Complete passkey wallet derivation system
2. **useAuth.js** - Passkey authentication hooks
3. **Constants** - Passkey configuration
4. **Documentation** - Architecture and implementation guides

## 🚀 What You Need to Do to Start Testing

### Step 1: Install Required Libraries

```bash
# Navigate to app directory
cd /Users/lucasrodriguez/Desktop/Ducat/app/app

# Install passkey support (CRITICAL)
npm install react-native-passkey

# Install better crypto (optional but recommended)
npm install react-native-quick-crypto

# Link native iOS dependencies
npx pod-install
```

### Step 2: Update Placeholder Code

The service currently uses **placeholder code** for WebAuthn. You need to replace it with real implementations:

**File:** `services/passkeyService.js`

**Find and replace these functions:**

#### A. `createWalletWithPasskey()`

**Current (line ~189):**
```javascript
// TODO: Implement actual WebAuthn credential creation
// This is a placeholder that will be replaced with real WebAuthn implementation

// For now, simulate passkey creation with random bytes
const credentialId = await Crypto.getRandomBytesAsync(32);
const userHandle = await Crypto.getRandomBytesAsync(16);
```

**Replace with:**
```javascript
import Passkey from 'react-native-passkey';

// Real WebAuthn credential creation
const credential = await Passkey.register({
  challenge: Buffer.from(await Crypto.getRandomBytesAsync(32)).toString('base64'),
  rp: {
    name: PASSKEY_CONFIG.RP_NAME,
    id: PASSKEY_CONFIG.RP_ID
  },
  user: {
    id: Buffer.from(await Crypto.getRandomBytesAsync(16)).toString('base64'),
    name: userName,
    displayName: userDisplayName
  },
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
  authenticatorSelection: {
    authenticatorAttachment: 'platform',
    userVerification: 'required',
    residentKey: 'required'
  },
  timeout: PASSKEY_CONFIG.TIMEOUT
});

const credentialId = new Uint8Array(credential.rawId);
const userHandle = new Uint8Array(credential.response.userHandle || new Uint8Array(16));
```

#### B. `unlockWithPasskey()`

**Current (line ~274):**
```javascript
// TODO: Implement actual WebAuthn authentication
// This is a placeholder
```

**Replace with:**
```javascript
import Passkey from 'react-native-passkey';

// Authenticate with existing passkey
const assertion = await Passkey.authenticate({
  challenge: Buffer.from(await Crypto.getRandomBytesAsync(32)).toString('base64'),
  rpId: PASSKEY_CONFIG.RP_ID,
  userVerification: 'required',
  allowCredentials: [{
    id: credentialIdBase64,
    type: 'public-key'
  }],
  timeout: PASSKEY_CONFIG.TIMEOUT
});

// Verify authentication succeeded
if (!assertion || !assertion.response) {
  throw new Error('Passkey authentication failed');
}
```

#### C. `recoverWithPasskey()`

**Current (line ~317):**
```javascript
// TODO: Implement actual WebAuthn authentication (discover mode)
// This will use the passkey synced via iCloud/Google

// Simulate passkey authentication
const credentialId = await Crypto.getRandomBytesAsync(32);
const userHandle = await Crypto.getRandomBytesAsync(16);
```

**Replace with:**
```javascript
import Passkey from 'react-native-passkey';

// Discover mode - let platform show available passkeys
const assertion = await Passkey.authenticate({
  challenge: Buffer.from(await Crypto.getRandomBytesAsync(32)).toString('base64'),
  rpId: PASSKEY_CONFIG.RP_ID,
  userVerification: 'required',
  // No allowCredentials - discovery mode
  timeout: PASSKEY_CONFIG.TIMEOUT
});

if (!assertion || !assertion.response) {
  throw new Error('No passkey found or authentication failed');
}

const credentialId = new Uint8Array(assertion.rawId);
const userHandle = new Uint8Array(assertion.response.userHandle || new Uint8Array(16));
```

#### D. `addPasskeyToExistingWallet()`

**Current (line ~362):**
```javascript
// TODO: Implement actual WebAuthn credential creation
const credentialId = await Crypto.getRandomBytesAsync(32);
const userHandle = await Crypto.getRandomBytesAsync(16);
```

**Replace with:** (same as createWalletWithPasskey)

### Step 3: Update `isPasskeySupported()`

**File:** `services/passkeyService.js` (line ~58)

**Current:**
```javascript
export const isPasskeySupported = async () => {
  // TODO: Implement actual WebAuthn support check
  return false;
};
```

**Replace with:**
```javascript
import Passkey from 'react-native-passkey';

export const isPasskeySupported = async () => {
  try {
    // Check if device supports passkeys
    const isSupported = await Passkey.isSupported();
    return isSupported;
  } catch (error) {
    logger.debug('Passkey support check failed', { error: error.message });
    return false;
  }
};
```

### Step 4: (Optional) Upgrade Encryption

**Current:** Uses simple XOR (placeholder)
**Recommended:** AES-256-GCM

If you installed `react-native-quick-crypto`:

```javascript
import { subtle } from 'react-native-quick-crypto';

const encryptMnemonic = async (mnemonic, encryptionKey) => {
  const iv = await Crypto.getRandomBytesAsync(12);
  const mnemonicBytes = new TextEncoder().encode(mnemonic);

  const cryptoKey = await subtle.importKey(
    'raw',
    encryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    mnemonicBytes
  );

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
};

const decryptMnemonic = async (encryptedBase64, ivBase64, encryptionKey) => {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');

  const cryptoKey = await subtle.importKey(
    'raw',
    encryptionKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );

  const mnemonic = new TextDecoder().decode(decrypted);

  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Decrypted mnemonic is invalid');
  }

  return mnemonic;
};
```

### Step 5: Test on Real Device

**You MUST test on a real device** - passkeys don't work in simulators!

1. **Build for iOS:**
   ```bash
   npx expo run:ios --device
   ```

2. **Test basic flow:**
   - Open app
   - Trigger passkey creation (you'll need to add UI for this)
   - Face ID should prompt
   - Verify credential is created

---

## 🎨 Minimal UI to Test (Quick & Dirty)

Add a test button to an existing screen to trigger passkey creation:

**File:** `screens/settings/SettingsScreen.jsx` (or any screen)

```javascript
import * as PasskeyService from '../../services/passkeyService';

// Add this button temporarily
<TouchableOpacity
  style={styles.settingsButton}
  onPress={async () => {
    try {
      console.log('Creating wallet with passkey...');
      const result = await PasskeyService.createWalletWithPasskey({
        userName: 'test@ducat.app',
        userDisplayName: 'Test User'
      });
      console.log('Passkey wallet created!', result);
      alert('Passkey created successfully!\n\nMnemonic: ' + result.mnemonic);
    } catch (error) {
      console.error('Passkey creation failed:', error);
      alert('Failed: ' + error.message);
    }
  }}
>
  <Text style={styles.settingsButtonText}>🔐 TEST: Create Passkey Wallet</Text>
</TouchableOpacity>
```

---

## 🧪 Testing Checklist

### ✅ Phase 1: Installation
- [ ] Installed `react-native-passkey`
- [ ] Ran `npx pod-install`
- [ ] Installed `react-native-quick-crypto` (optional)
- [ ] Updated `passkeyService.js` with real WebAuthn code

### ✅ Phase 2: Basic Functionality
- [ ] `isPasskeySupported()` returns `true` on real device
- [ ] Can create passkey credential (Face ID prompts)
- [ ] Credential ID and user handle are extracted
- [ ] Mnemonic is derived deterministically
- [ ] Mnemonic is valid BIP39
- [ ] Wallet addresses are generated

### ✅ Phase 3: Unlock Flow
- [ ] Can unlock wallet with passkey (same device)
- [ ] Mnemonic is decrypted correctly
- [ ] Wallet state is restored

### ✅ Phase 4: Recovery Flow
- [ ] Can recover on new device with synced passkey
- [ ] Same mnemonic is derived
- [ ] Same wallet addresses are generated
- [ ] Balance is correct

### ✅ Phase 5: Migration Flow
- [ ] Can add passkey to existing PIN wallet
- [ ] Can unlock with EITHER passkey or PIN
- [ ] Removing passkey doesn't break PIN auth

---

## 📱 Platform-Specific Notes

### iOS
- **Minimum version:** iOS 16+
- **Sync:** iCloud Keychain (automatic)
- **Test devices:** iPhone with Face ID or Touch ID
- **Simulator:** ❌ Won't work - passkeys need real secure enclave

### Android
- **Minimum version:** Android 14+ (for passkey support)
- **Sync:** Google Password Manager (automatic)
- **Test devices:** Pixel or Samsung with biometric auth
- **Emulator:** ❌ Won't work - passkeys need real hardware

---

## 🚨 Common Issues

### 1. "Passkey not supported"
**Cause:** Device doesn't support passkeys or wrong OS version
**Fix:** Test on iPhone (iOS 16+) or Android (14+)

### 2. "Face ID doesn't prompt"
**Cause:** WebAuthn not properly configured
**Fix:** Check `authenticatorSelection` in credential creation

### 3. "Passkey doesn't sync to new device"
**Cause:** iCloud Keychain disabled or slow sync
**Fix:**
- Enable iCloud Keychain in Settings
- Wait a few minutes for sync
- Try manual sync: Settings → [Your Name] → iCloud → Sync this iPhone

### 4. "Mnemonic is different on new device"
**Cause:** Credential ID or user handle changed
**Fix:** Ensure you're using stable `rawId` and `userHandle` from WebAuthn response

---

## 💡 Quick Tips

1. **Always test on real devices** - Simulators don't have secure enclaves
2. **Use testnet** - You're on mutinynet, perfect for testing
3. **Keep backup words** - During testing, always show the mnemonic for recovery
4. **Check logs** - Use `logger.debug()` calls in passkeyService for debugging
5. **Test sync timing** - iCloud/Google sync can take 1-5 minutes

---

## 📞 Need Help?

**Check these files:**
- `PASSKEY_ARCHITECTURE.md` - Full technical spec
- `PASSKEY_IMPLEMENTATION_STATUS.md` - What's done, what's not
- `services/passkeyService.js` - Core implementation

**Common debugging:**
```javascript
// Add to passkeyService.js
logger.debug('Passkey credential created', {
  credentialIdLength: credentialId.length,
  userHandleLength: userHandle.length,
  rawId: Buffer.from(credentialId).toString('base64')
});
```

---

## 🎉 You're Ready!

After completing steps 1-4 above, you can start testing passkey wallet creation and recovery!

**Next:** Build the app on a real device and try creating a wallet with passkey.
