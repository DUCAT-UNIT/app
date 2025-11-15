# Passkey Integration Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing passkey (WebAuthn/FIDO2) authentication in the Ducat Bitcoin wallet while maintaining the existing PIN and biometric authentication flows.

**Key Principle**: Passkeys replace/supplement PIN authentication, NOT key derivation.

---

## Phase 1: Setup & Dependencies

### Step 1.1: Add WebAuthn Library

Choose one of these options:

**Option A: react-native-webauthn** (Recommended)
```bash
npm install react-native-webauthn
# or
yarn add react-native-webauthn
```

**Option B: Custom WebAuthn Implementation** 
Use the browser/web APIs available through `react-native-webview` or platform-specific native modules.

### Step 1.2: Update Security Constants

File: `/app/constants/security.js`

Add passkey configuration:
```javascript
/**
 * Passkey (WebAuthn) configuration
 */
export const PASSKEY = {
  TIMEOUT_MS: 60000,  // 60 seconds
  USER_VERIFICATION: 'preferred',  // or 'required' for stronger security
  ATTESTATION: 'none',  // Don't verify authenticator
  CHALLENGE_LENGTH: 32,  // bytes
  RP_ID: 'ducat.app',  // Relying Party ID (match your domain)
  RP_NAME: 'Ducat Bitcoin Wallet',
};
```

### Step 1.3: Update Secure Storage Keys

File: `/app/utils/constants.js`

Add passkey storage keys:
```javascript
SECURE_KEYS = {
  // ... existing keys ...
  PASSKEY_REGISTERED: 'wallet_passkey_registered_v1',
  PASSKEY_CREDENTIAL_IDS: 'wallet_passkey_credential_ids_v1',
  PASSKEY_USER_HANDLE: 'wallet_passkey_user_handle_v1',
  PASSKEY_CHALLENGE: 'wallet_passkey_challenge_v1',
};
```

---

## Phase 2: Create Passkey Service

### Step 2.1: Create passkeyService.js

File: `/app/services/passkeyService.js`

```javascript
/**
 * Passkey Authentication Service
 * Handles WebAuthn registration and authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS } from '../utils/constants';
import { PASSKEY } from '../constants/security';

/**
 * Check if device supports WebAuthn/PassKeys
 * @returns {Promise<boolean>}
 */
export const checkPasskeySupport = async () => {
  try {
    // Check for WebAuthn API availability
    // Implementation depends on your WebAuthn library
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      return true;
    }

    // Platform-specific checks
    return Platform.OS === 'ios' || Platform.OS === 'android';
  } catch (error) {
    return false;
  }
};

/**
 * Generate a random challenge for WebAuthn
 * @returns {Promise<string>} Base64-encoded challenge
 */
const generateChallenge = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(PASSKEY.CHALLENGE_LENGTH);
  return Buffer.from(randomBytes).toString('base64');
};

/**
 * Register a new passkey
 * @param {string} username - User's username/email
 * @param {string} displayName - User's display name
 * @returns {Promise<{success: boolean, credentialId?: string, error?: string}>}
 */
export const registerPasskey = async (username, displayName) => {
  try {
    const challenge = await generateChallenge();

    // Store challenge temporarily for verification
    await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_CHALLENGE, challenge);

    // Generate user handle (persistent identifier)
    const userHandle = Buffer.from(username).toString('base64');
    await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_USER_HANDLE, userHandle);

    // Call WebAuthn API to create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: Buffer.from(challenge, 'base64'),
        rp: {
          name: PASSKEY.RP_NAME,
          id: PASSKEY.RP_ID,
        },
        user: {
          id: Buffer.from(userHandle, 'base64'),
          name: username,
          displayName: displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        timeout: PASSKEY.TIMEOUT_MS,
        userVerification: PASSKEY.USER_VERIFICATION,
        attestation: PASSKEY.ATTESTATION,
      },
    });

    if (!credential) {
      return { success: false, error: 'Passkey registration cancelled' };
    }

    // Store credential ID
    const credentialId = Buffer.from(credential.id).toString('base64');
    const existingIds = await getPasskeyCredentialIds();
    existingIds.push(credentialId);

    await SecureStore.setItemAsync(
      SECURE_KEYS.PASSKEY_CREDENTIAL_IDS,
      JSON.stringify(existingIds)
    );

    // Mark passkey as registered
    await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_REGISTERED, 'true');

    // Clear challenge
    await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CHALLENGE);

    return { success: true, credentialId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Authenticate with registered passkey
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const authenticateWithPasskey = async () => {
  try {
    const challenge = await generateChallenge();
    const credentialIds = await getPasskeyCredentialIds();

    if (credentialIds.length === 0) {
      return { success: false, error: 'No passkeys registered' };
    }

    const credentialIdArrays = credentialIds.map(id =>
      new Uint8Array(Buffer.from(id, 'base64'))
    );

    // Call WebAuthn API to authenticate
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: Buffer.from(challenge, 'base64'),
        timeout: PASSKEY.TIMEOUT_MS,
        userVerification: PASSKEY.USER_VERIFICATION,
        allowCredentials: credentialIdArrays.map(id => ({
          type: 'public-key',
          id: id,
        })),
      },
    });

    if (!assertion) {
      return { success: false, error: 'Authentication cancelled' };
    }

    // Verify assertion
    // Note: Full verification requires backend support
    // For now, successful retrieval = success
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Check if user has registered a passkey
 * @returns {Promise<boolean>}
 */
export const isPasskeyRegistered = async () => {
  try {
    const registered = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_REGISTERED);
    return registered === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Get all registered passkey credential IDs
 * @returns {Promise<string[]>}
 */
export const getPasskeyCredentialIds = async () => {
  try {
    const ids = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_IDS);
    return ids ? JSON.parse(ids) : [];
  } catch (error) {
    return [];
  }
};

/**
 * Remove a passkey credential
 * @param {string} credentialId - Credential ID to remove
 * @returns {Promise<boolean>}
 */
export const removePasskey = async (credentialId) => {
  try {
    const ids = await getPasskeyCredentialIds();
    const filtered = ids.filter(id => id !== credentialId);

    if (filtered.length === 0) {
      // No passkeys left, unregister
      await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_REGISTERED);
      await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_IDS);
    } else {
      await SecureStore.setItemAsync(
        SECURE_KEYS.PASSKEY_CREDENTIAL_IDS,
        JSON.stringify(filtered)
      );
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Clear all passkey data
 * @returns {Promise<boolean>}
 */
export const clearAllPasskeys = async () => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_REGISTERED);
    await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_IDS);
    await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_USER_HANDLE);
    await SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CHALLENGE);
    return true;
  } catch (error) {
    return false;
  }
};
```

### Step 2.2: Export from authService.js

File: `/app/services/authService.js`

Add exports:
```javascript
// Re-export passkey service
export {
  checkPasskeySupport,
  registerPasskey,
  authenticateWithPasskey,
  isPasskeyRegistered,
  getPasskeyCredentialIds,
  removePasskey,
  clearAllPasskeys,
} from './passkeyService';
```

---

## Phase 3: Update Authentication Hook

### Step 3.1: Modify useAuth

File: `/app/hooks/useAuth.js`

Add passkey state:
```javascript
import * as PasskeyService from '../services/passkeyService';

export function useAuth({ onSeedConfirmed }) {
  // ... existing states ...

  // Passkey state
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [settingUpPasskey, setSettingUpPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');

  // Check passkey support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await PasskeyService.checkPasskeySupport();
      setPasskeySupported(supported);

      if (supported) {
        const isRegistered = await PasskeyService.isPasskeyRegistered();
        setPasskeyEnabled(isRegistered);
      }
    };

    checkSupport();
  }, []);

  // Authenticate with passkey
  const authenticateWithPasskey = useCallback(async () => {
    try {
      setPasskeyError('');
      const result = await PasskeyService.authenticateWithPasskey();

      if (result.success) {
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setPasskeyError(result.error || 'Passkey authentication failed');
        return { success: false, error: result.error };
      }
    } catch (error) {
      setPasskeyError(error.message);
      return { success: false, error: error.message };
    }
  }, []);

  // Register passkey
  const registerPasskeyCredential = useCallback(async (username, displayName) => {
    try {
      setPasskeyError('');
      setSettingUpPasskey(true);

      const result = await PasskeyService.registerPasskey(username, displayName);

      if (result.success) {
        setPasskeyEnabled(true);
        setSettingUpPasskey(false);
        return { success: true };
      } else {
        setPasskeyError(result.error || 'Passkey registration failed');
        setSettingUpPasskey(false);
        return { success: false, error: result.error };
      }
    } catch (error) {
      setPasskeyError(error.message);
      setSettingUpPasskey(false);
      return { success: false, error: error.message };
    }
  }, []);

  // Return includes passkey state and functions
  return useMemo(
    () => ({
      // ... existing returns ...
      passkeySupported,
      passkeyEnabled,
      settingUpPasskey,
      passkeyError,
      authenticateWithPasskey,
      registerPasskeyCredential,
      setPasskeyError,
    }),
    [/* deps */]
  );
}
```

---

## Phase 4: Update Authentication Context

### Step 4.1: Modify AuthContext

File: `/app/contexts/AuthContext.js`

Update to expose passkey functions:
```javascript
export const AuthProvider = ({ children, onSeedConfirmed, resetWallet }) => {
  const authState = useAuthHook({ onSeedConfirmed });

  // ... existing code ...

  const value = useMemo(
    () => ({
      // ... existing spreads ...
      ...authState,  // This already includes passkey functions from useAuth
      // Explicit passkey exports for clarity
      passkeySupported: authState.passkeySupported,
      passkeyEnabled: authState.passkeyEnabled,
      authenticateWithPasskey: authState.authenticateWithPasskey,
      registerPasskeyCredential: authState.registerPasskeyCredential,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

---

## Phase 5: Update Wallet Creation/Import

### Step 5.1: Add Passkey Option to Wallet Creation

File: `/app/hooks/useWalletCreation.js`

After PIN setup completes, optionally offer passkey setup:
```javascript
// In PIN setup completion handler
const handlePinSetupCompleted = async () => {
  // ... existing PIN setup code ...

  // Offer passkey setup
  const passkeySupported = await AuthService.checkPasskeySupport();
  if (passkeySupported) {
    // Show passkey setup screen
    setShowPasskeySetup(true);
  } else {
    // Skip passkey setup
    completeOnboarding();
  }
};
```

### Step 5.2: Add Passkey Option to Wallet Import

File: `/app/hooks/useWalletImport.js`

Same pattern as wallet creation:
```javascript
const handleImportCompleted = async () => {
  // ... existing import code ...

  // Offer passkey setup
  const passkeySupported = await AuthService.checkPasskeySupport();
  if (passkeySupported) {
    setShowPasskeySetup(true);
  } else {
    completeImport();
  }
};
```

---

## Phase 6: Create Authentication Screens

### Step 6.1: Passkey Registration Screen

File: `/app/screens/auth/PasskeySetupScreen.jsx`

```javascript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function PasskeySetupScreen({ onComplete, onSkip }) {
  const { registerPasskeyCredential, settingUpPasskey, passkeyError } = useAuth();
  const [error, setError] = useState('');

  const handleSetup = async () => {
    // Assuming we have username/displayName from context
    const result = await registerPasskeyCredential('user@ducat.app', 'Ducat User');

    if (result.success) {
      onComplete();
    } else {
      setError(result.error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Set Up Passkey
      </Text>

      <Text style={{ marginBottom: 24 }}>
        A passkey provides passwordless authentication using your device's biometric.
      </Text>

      {error && <Text style={{ color: 'red', marginBottom: 16 }}>{error}</Text>}

      <TouchableOpacity
        onPress={handleSetup}
        disabled={settingUpPasskey}
        style={{
          backgroundColor: '#007AFF',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          {settingUpPasskey ? 'Setting up...' : 'Set Up Passkey'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSkip}
        disabled={settingUpPasskey}
        style={{
          backgroundColor: '#f0f0f0',
          padding: 16,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#333', textAlign: 'center', fontWeight: 'bold' }}>
          Skip for Now
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Step 6.2: Lock Screen with Passkey Option

File: `/app/screens/auth/LockScreen.jsx`

Update to include passkey button:
```javascript
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function LockScreen() {
  const {
    isAuthenticated,
    passkeyEnabled,
    authenticateWithPasskey,
    authenticateUser,
  } = useAuth();

  const handlePasskeyAuth = async () => {
    const result = await authenticateWithPasskey();
    if (!result.success) {
      // Fall back to PIN
      authenticateUser();
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      {passkeyEnabled && (
        <TouchableOpacity
          onPress={handlePasskeyAuth}
          style={{
            backgroundColor: '#007AFF',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Use Passkey
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={authenticateUser}
        style={{
          backgroundColor: '#666',
          padding: 16,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          Use PIN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Phase 7: Settings & Management

### Step 7.1: Add Passkey Management to Settings

File: Add to settings screens:

```javascript
export function PasskeySettings() {
  const { passkeyEnabled, passkeySupported } = useAuth();

  if (!passkeySupported) {
    return (
      <Text>Passkeys are not supported on this device</Text>
    );
  }

  return (
    <View>
      <Text>Passkey Status: {passkeyEnabled ? 'Enabled' : 'Disabled'}</Text>

      {!passkeyEnabled && (
        <TouchableOpacity onPress={() => navigateToPasskeySetup()}>
          <Text>Set Up Passkey</Text>
        </TouchableOpacity>
      )}

      {passkeyEnabled && (
        <TouchableOpacity onPress={() => removePasskey()}>
          <Text style={{ color: 'red' }}>Remove Passkey</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

## Phase 8: Testing & Validation

### Checklist

```
REGISTRATION
[ ] Passkey support is detected correctly
[ ] Registration flow completes successfully
[ ] Credential ID is stored in secure storage
[ ] Success message shown to user
[ ] Error handling for cancelled registration
[ ] Error handling for unsupported device

AUTHENTICATION
[ ] Passkey auth prompts for biometric
[ ] Successful auth unlocks wallet
[ ] Failed auth falls back to PIN
[ ] Error messages displayed clearly
[ ] Rate limiting applies (uses PIN lockout)

INTEGRATION
[ ] Passkey doesn't affect mnemonic storage
[ ] Account switching works after passkey auth
[ ] Lock/unlock cycle works
[ ] PIN still works as backup
[ ] Biometric still works independently

SECURITY
[ ] Credential IDs encrypted in secure storage
[ ] Passkey preferences persisted correctly
[ ] Challenge generation is secure
[ ] Multiple passkeys can coexist (if supported)
[ ] Removal clears secure storage completely

EDGE CASES
[ ] App backgrounding/resuming
[ ] Device rotation
[ ] Network loss during registration
[ ] Multiple device scenarios
[ ] Credential migration between devices
```

---

## Important Considerations

### 1. Rate Limiting
Apply the same rate limiting as PIN:
```javascript
// Use existing PIN lockout mechanism
if (passkeyAttemptFailed) {
  // Increment PIN attempt counter
  // Apply same 30-minute lockout
}
```

### 2. Fallback Chain
When lock screen shows options:
1. Passkey (if enabled)
2. PIN (always available)
3. Biometric (if enabled and passkey not available)

### 3. Recovery Flow
Users should always be able to:
1. Use PIN to unlock
2. View seed phrase (requires authentication)
3. Recover wallet using seed phrase

### 4. Device Binding
Passkeys are device-specific. For multi-device scenarios:
- Register separate passkey on each device
- OR use PIN as universal fallback

### 5. Backend Considerations
If you have a backend:
- Server must verify passkey assertions
- Maintain challenge/response for verification
- Store public keys for validation
- Implement server-side rate limiting

---

## Deployment Checklist

Before shipping passkey support:

- [ ] All tests passing
- [ ] No security warnings from libraries
- [ ] Backwards compatibility maintained (PIN still works)
- [ ] Documentation updated
- [ ] User guide prepared
- [ ] Recovery procedures tested
- [ ] Error messages user-friendly
- [ ] Performance acceptable (passkey creation takes <5s)
- [ ] Analytics tracking implemented
- [ ] A/B testing planned (optional)

---

## Common Issues & Solutions

### Issue: WebAuthn not available on platform

**Solution**: Use `checkPasskeySupport()` to gracefully degrade:
```javascript
if (!passkeySupported) {
  // Hide passkey UI, only show PIN/Biometric
}
```

### Issue: Passkey works on one device but not another

**Solution**: This is expected. Each device needs its own passkey:
```javascript
// When setting up on new device
const result = await registerPasskey(username, displayName);
// Creates new credential tied to this device
```

### Issue: User forgets PIN and can't unlock

**Solution**: Implement seed phrase recovery:
```javascript
// In lock screen, provide "Recover wallet" option
// Allow user to import using seed phrase
```

### Issue: Passkey registration takes too long

**Solution**: Show loading state and timeout handling:
```javascript
const handleSetup = async () => {
  setLoading(true);
  try {
    const result = await Promise.race([
      registerPasskey(username, displayName),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      ),
    ]);
  } finally {
    setLoading(false);
  }
};
```

---

## Success Metrics

Track these metrics to measure passkey adoption:

1. **Registration Rate**: % of users who register passkey
2. **Usage Rate**: % of authentications using passkey
3. **Fallback Rate**: % of passkey auth attempts that fallback to PIN
4. **Error Rate**: % of failed passkey operations
5. **Support Tickets**: Support issues related to passkey
6. **Performance**: Time to authenticate with passkey

---

## Resources

- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [FIDO2 Overview](https://fidoalliance.org/fido2/)
- [Apple's Platform Passkeys](https://developer.apple.com/documentation/authenticationservices)
- [Android Biometric + Passkey](https://developer.android.com/privacy-and-security/credential-manager)

