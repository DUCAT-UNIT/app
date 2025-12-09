# Passkey-Derived Wallet Architecture

## Overview
This document describes the architecture for passkey-based wallet creation and recovery in the Ducat Bitcoin wallet app.

## Design Principles

1. **100% Local** - No server storage, all data stored on device
2. **Deterministic** - Same passkey always derives same wallet
3. **BIP39 Compatible** - Standard 12-word mnemonic works in any wallet
4. **Backup Required** - Users must confirm seed phrase (current flow maintained)
5. **Migration Support** - Existing PIN/biometric users can add passkey

---

## Wallet Creation Modes

### Mode A: Create New Wallet with Passkey

**Flow:**
```
1. User clicks "Create Wallet with Passkey"
2. WebAuthn prompts for passkey creation (Face ID/Touch ID)
3. Extract deterministic entropy from passkey credential
4. Generate BIP39 mnemonic (12 words) from entropy
5. Show seed backup flow (REQUIRED - same as current)
6. User confirms they've written down the words
7. Derive wallet (BIP84 SegWit + BIP86 Taproot)
8. Store encrypted mnemonic + passkey credential ID
9. Wallet created ✓
```

**Key Derivation:**
```javascript
// Step 1: Create passkey
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.randomBytes(32),
    rp: { name: "Ducat Wallet", id: "ducat.app" },
    user: {
      id: crypto.randomBytes(16),
      name: userEmail || `user-${Date.now()}`,
      displayName: "Ducat User"
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "required"
    }
  }
});

// Step 2: Extract deterministic entropy (128 bits = 12 words)
const credentialId = new Uint8Array(credential.rawId);
const userHandle = new Uint8Array(credential.response.userHandle);

// Use HKDF for proper key derivation
const entropy = await crypto.subtle.deriveBits(
  {
    name: "HKDF",
    hash: "SHA-256",
    salt: new TextEncoder().encode("ducat-wallet-v1"),
    info: new TextEncoder().encode("bip39-mnemonic-seed")
  },
  await crypto.subtle.importKey(
    "raw",
    concatenate(credentialId, userHandle),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  ),
  128 // 128 bits = 12 words
);

// Step 3: Generate mnemonic
const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy));

// Step 4: Derive wallet seed (BIP39 standard)
const seed = await bip39.mnemonicToSeed(mnemonic);

// Step 5: Derive addresses (BIP84 + BIP86)
const root = bip32.fromSeed(seed);
const segwitPath = "m/84'/0'/0'/0/0"; // BIP84 Native SegWit
const taprootPath = "m/86'/0'/0'/0/0"; // BIP86 Taproot
```

**Storage:**
```javascript
// Store in SecureStore
await SecureStore.setItemAsync('walletCreationMethod', 'passkey');
await SecureStore.setItemAsync('passkeyCredentialId', credentialId);
await SecureStore.setItemAsync('passkeyUserHandle', userHandle);

// Encrypt mnemonic with passkey-derived key (for local unlock)
const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);
const encryptedMnemonic = await encryptMnemonic(mnemonic, encryptionKey);
await SecureStore.setItemAsync('encryptedMnemonic', encryptedMnemonic);
```

---

### Mode B: Add Passkey to Existing Wallet (Migration)

**Flow:**
```
1. User has existing wallet (created with PIN/biometric)
2. User goes to Settings → "Add Passkey Login"
3. WebAuthn prompts for passkey creation
4. Retrieve existing mnemonic from SecureStore
5. Encrypt mnemonic with passkey-derived key
6. Store passkey credential + encrypted mnemonic
7. User can now use passkey OR PIN/biometric
```

**Implementation:**
```javascript
// Step 1: User authenticates with current method (PIN/biometric)
const currentMnemonic = await getCurrentMnemonic();

// Step 2: Create passkey
const credential = await navigator.credentials.create({
  // ... same config as Mode A
});

// Step 3: Derive encryption key from passkey
const credentialId = new Uint8Array(credential.rawId);
const userHandle = new Uint8Array(credential.response.userHandle);
const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

// Step 4: Encrypt existing mnemonic
const encryptedMnemonic = await encryptMnemonic(currentMnemonic, encryptionKey);

// Step 5: Store passkey info
await SecureStore.setItemAsync('passkeyEnabled', 'true');
await SecureStore.setItemAsync('passkeyCredentialId', credentialId);
await SecureStore.setItemAsync('passkeyUserHandle', userHandle);
await SecureStore.setItemAsync('encryptedMnemonicWithPasskey', encryptedMnemonic);

// Note: Original mnemonic encryption (with PIN) remains intact
// User can authenticate with EITHER passkey OR PIN
```

---

## Recovery Scenarios

### Scenario 1: Same Device Recovery (Passkey Available)

**Flow:**
```
1. App launches, user is locked out
2. User clicks "Unlock with Passkey"
3. WebAuthn prompts for authentication (Face ID/Touch ID)
4. Retrieve stored credential ID and user handle
5. Derive encryption key from passkey
6. Decrypt mnemonic
7. Wallet unlocked ✓
```

**Implementation:**
```javascript
// Authenticate with existing passkey
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: crypto.randomBytes(32),
    rpId: "ducat.app",
    userVerification: "required",
    allowCredentials: [{
      id: storedCredentialId,
      type: "public-key"
    }]
  }
});

// Derive same encryption key
const encryptionKey = await deriveEncryptionKey(
  storedCredentialId,
  storedUserHandle
);

// Decrypt mnemonic
const mnemonic = await decryptMnemonic(encryptedMnemonic, encryptionKey);

// Unlock wallet
await unlockWallet(mnemonic);
```

---

### Scenario 2: New Device Recovery (Passkey Synced via iCloud/Google)

**Flow:**
```
1. User installs app on new device
2. User clicks "Recover Wallet with Passkey"
3. WebAuthn finds synced passkey (iCloud Keychain / Google Password Manager)
4. User authenticates (Face ID/Touch ID)
5. Extract credential ID and user handle
6. Re-derive mnemonic deterministically (same entropy)
7. Wallet recovered ✓
```

**Implementation:**
```javascript
// Discover available passkeys
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: crypto.randomBytes(32),
    rpId: "ducat.app",
    userVerification: "required"
    // No allowCredentials - let platform show all available passkeys
  }
});

// Extract credential info
const credentialId = new Uint8Array(assertion.rawId);
const userHandle = new Uint8Array(assertion.response.userHandle);

// RE-DERIVE mnemonic (same process as creation)
const entropy = await crypto.subtle.deriveBits(
  {
    name: "HKDF",
    hash: "SHA-256",
    salt: new TextEncoder().encode("ducat-wallet-v1"),
    info: new TextEncoder().encode("bip39-mnemonic-seed")
  },
  await crypto.subtle.importKey(
    "raw",
    concatenate(credentialId, userHandle),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  ),
  128
);

const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy));

// Derive wallet (same addresses as original)
const seed = await bip39.mnemonicToSeed(mnemonic);
const wallet = deriveWallet(seed);

// Store locally on new device
await storeWalletLocally(wallet, credentialId, userHandle);
```

---

### Scenario 3: Disaster Recovery (Passkey Lost, Manual Seed Entry)

**Flow:**
```
1. User lost passkey / new device without passkey sync
2. User clicks "Recover with Seed Phrase"
3. User enters 12 words manually
4. Validate mnemonic (BIP39 checksum)
5. Ask: "Create new passkey for this device?" (optional)
6. Derive wallet from mnemonic
7. Wallet recovered ✓
```

**Implementation:**
```javascript
// Validate user-entered mnemonic
const isValid = bip39.validateMnemonic(userEnteredMnemonic);
if (!isValid) {
  throw new Error('Invalid seed phrase');
}

// Derive wallet (standard BIP39)
const seed = await bip39.mnemonicToSeed(userEnteredMnemonic);
const wallet = deriveWallet(seed);

// Optional: Create new passkey for this device
if (userWantsPasskey) {
  const credential = await navigator.credentials.create({
    // ... same config as Mode A
  });

  // Encrypt mnemonic with new passkey
  const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);
  const encryptedMnemonic = await encryptMnemonic(userEnteredMnemonic, encryptionKey);

  await SecureStore.setItemAsync('passkeyCredentialId', credentialId);
  await SecureStore.setItemAsync('encryptedMnemonic', encryptedMnemonic);
}

// Store wallet
await storeWallet(wallet);
```

---

## Security Considerations

### 1. Deterministic Derivation Security

**Entropy Source:**
- Use HKDF-SHA256 (NIST approved KDF)
- Input: Credential ID (32+ bytes) + User Handle (16+ bytes)
- Salt: "ducat-wallet-v1" (version-specific, prevents rainbow tables)
- Info: "bip39-mnemonic-seed" (domain separation)
- Output: 128 bits (sufficient for 12-word mnemonic)

**Collision Resistance:**
- Credential ID is cryptographically random (generated by authenticator)
- User Handle is random (16 bytes = 128 bits)
- Combined entropy: ~256+ bits → extremely unlikely collision

### 2. Encryption

**For Local Storage (Same Device):**
```javascript
// Derive encryption key from passkey
const encryptionKey = await crypto.subtle.deriveBits(
  {
    name: "HKDF",
    hash: "SHA-256",
    salt: deviceId, // Device-specific salt
    info: new TextEncoder().encode("mnemonic-encryption-key")
  },
  passkeyMaterial,
  256 // 256-bit AES key
);

// Encrypt mnemonic with AES-256-GCM
const encryptedMnemonic = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv: crypto.randomBytes(12),
    tagLength: 128
  },
  encryptionKey,
  new TextEncoder().encode(mnemonic)
);
```

### 3. Passkey Platform Security

**iOS (iCloud Keychain):**
- Passkeys stored in Secure Enclave
- Synced via iCloud (end-to-end encrypted)
- Requires biometric/device passcode

**Android (Google Password Manager):**
- Passkeys stored in Android Keystore
- Synced via Google account (encrypted)
- Requires biometric/device PIN

**Security Properties:**
- Private keys never leave secure hardware
- Phishing-resistant (domain-bound)
- Replay-resistant (challenge-response)

---

## Migration Path for Existing Users

### Current State (PIN/Biometric)
```
User → PIN/Biometric → Decrypt mnemonic → Unlock wallet
```

### After Adding Passkey
```
User → (Passkey OR PIN/Biometric) → Decrypt mnemonic → Unlock wallet
```

### Implementation
```javascript
// AuthContext.js - Support multiple auth methods

const authMethods = {
  pin: async () => {
    const pin = await promptForPIN();
    return await unlockWithPIN(pin);
  },

  biometric: async () => {
    const success = await promptBiometric();
    if (success) return await unlockWithBiometric();
  },

  passkey: async () => {
    const credential = await authenticateWithPasskey();
    return await unlockWithPasskey(credential);
  }
};

// Check which methods are available
const availableMethods = await getAvailableAuthMethods();
// e.g., ['pin', 'passkey'] or ['biometric', 'passkey']

// Let user choose
const selectedMethod = await promptUserForAuthMethod(availableMethods);
await authMethods[selectedMethod]();
```

---

## Data Storage Schema

### SecureStore Keys

**For Passkey-Created Wallets:**
```javascript
{
  // Wallet creation metadata
  "walletCreationMethod": "passkey", // or "pin"
  "walletCreatedAt": "2025-11-15T10:30:00Z",

  // Passkey credentials
  "passkeyCredentialId": "<base64-encoded-credential-id>",
  "passkeyUserHandle": "<base64-encoded-user-handle>",

  // Encrypted mnemonic (for same-device unlock)
  "encryptedMnemonic": "<aes-gcm-encrypted-mnemonic>",
  "mnemonicEncryptionIV": "<12-byte-iv>",

  // Authentication state
  "authMethod": "passkey", // current preferred method
  "passkeyEnabled": "true",
  "pinEnabled": "false", // optional fallback
  "biometricEnabled": "false"
}
```

**For Migrated Wallets (PIN → Passkey):**
```javascript
{
  // Wallet creation metadata
  "walletCreationMethod": "pin", // original method
  "walletCreatedAt": "2025-01-15T10:30:00Z",
  "passkeyAddedAt": "2025-11-15T10:30:00Z",

  // Passkey credentials
  "passkeyCredentialId": "<base64>",
  "passkeyUserHandle": "<base64>",

  // Encrypted mnemonic (BOTH methods available)
  "encryptedMnemonicWithPIN": "<pin-encrypted>",
  "encryptedMnemonicWithPasskey": "<passkey-encrypted>",

  // Authentication state
  "authMethod": "passkey", // preferred
  "passkeyEnabled": "true",
  "pinEnabled": "true", // fallback available
  "biometricEnabled": "false"
}
```

---

## User Experience Flows

### New User Onboarding (with Passkey)

```
[Welcome Screen]
    ↓
"Create New Wallet" → "Sign in with Passkey"
    ↓
[Face ID / Touch ID prompt]
    ↓
"Wallet Created! Now secure your backup..."
    ↓
[Show 12 words - REQUIRED to confirm]
    ↓
"Tap each word in order to confirm"
    ↓
[Confirmation screen]
    ↓
"✓ Wallet secured with passkey"
[Continue to app]
```

### Existing User Migration

```
[Settings Screen]
    ↓
"Security" → "Add Passkey Login"
    ↓
"Login faster with Face ID"
[Enable Passkey button]
    ↓
[Authenticate with current PIN/biometric]
    ↓
[Face ID / Touch ID prompt for passkey creation]
    ↓
"✓ Passkey enabled! You can now login with Face ID"
[Optional: "Remove PIN" or "Keep both"]
```

### Recovery on New Device

```
[Welcome Screen]
    ↓
"Recover Existing Wallet"
    ↓
[Two options:]
  1. "Recover with Passkey" ← Recommended
  2. "Recover with Seed Phrase"
    ↓
[If Passkey selected:]
[Face ID / Touch ID prompt]
    ↓
"Checking for synced wallet..."
    ↓
"✓ Wallet recovered!"
[Continue to app]
```

---

## Error Handling

### Passkey Not Synced to New Device

```javascript
try {
  const assertion = await navigator.credentials.get({...});
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // No passkey found
    showError({
      title: "Passkey Not Found",
      message: "Your passkey hasn't synced to this device yet. You can:",
      options: [
        "Wait for iCloud sync (may take a few minutes)",
        "Recover with your 12-word seed phrase"
      ]
    });
  }
}
```

### Passkey Authentication Failed

```javascript
try {
  const assertion = await navigator.credentials.get({...});
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // User cancelled
    showError("Authentication cancelled");
  } else if (error.name === 'InvalidStateError') {
    // Biometric failed
    showError({
      title: "Authentication Failed",
      message: "Face ID didn't recognize you. Try again or use your seed phrase."
    });
  }
}
```

### Mnemonic Decryption Failed

```javascript
try {
  const mnemonic = await decryptMnemonic(encrypted, key);
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Decrypted mnemonic is invalid');
  }
} catch (error) {
  showError({
    title: "Decryption Failed",
    message: "Could not unlock wallet with this passkey. Please use your seed phrase to recover.",
    action: "Recover with Seed Phrase"
  });
}
```

---

## Testing Checklist

### New Wallet Creation
- [ ] Create wallet with passkey (iOS)
- [ ] Create wallet with passkey (Android)
- [ ] Verify 12-word backup flow is shown
- [ ] Verify mnemonic is stored encrypted
- [ ] Verify wallet addresses are correct (BIP84/BIP86)

### Same Device Unlock
- [ ] Lock app, unlock with passkey
- [ ] Verify mnemonic is decrypted correctly
- [ ] Verify wallet state is restored

### New Device Recovery (Passkey Synced)
- [ ] Install app on second iOS device (same iCloud)
- [ ] Select "Recover with Passkey"
- [ ] Verify same wallet addresses are derived
- [ ] Verify balance is correct

### Disaster Recovery (Manual Seed)
- [ ] Delete passkey from device
- [ ] Recover with 12-word seed phrase
- [ ] Verify wallet is recovered correctly
- [ ] Optionally add new passkey

### Migration (Existing PIN User)
- [ ] Create wallet with PIN (existing flow)
- [ ] Add passkey from settings
- [ ] Verify can unlock with EITHER PIN or passkey
- [ ] Remove PIN, verify passkey still works

### Edge Cases
- [ ] Passkey creation fails (user cancels)
- [ ] Passkey authentication fails (Face ID fails)
- [ ] Invalid mnemonic entered manually
- [ ] Network offline during recovery
- [ ] Multiple accounts (switch between them)

---

## Next Steps

1. **Review this architecture document**
2. **Implement passkeyService.js** (core crypto functions)
3. **Update AuthContext.js** (add passkey auth method)
4. **Update WalletContext.js** (support passkey-derived wallets)
5. **Add UI flows** (onboarding, settings, recovery)
6. **Test on real devices** (iOS + Android)

---

## References

- **WebAuthn Spec**: https://www.w3.org/TR/webauthn-2/
- **BIP39 (Mnemonic)**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **BIP32 (HD Wallets)**: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **BIP84 (SegWit)**: https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
- **BIP86 (Taproot)**: https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki
- **HKDF (RFC 5869)**: https://tools.ietf.org/html/rfc5869
