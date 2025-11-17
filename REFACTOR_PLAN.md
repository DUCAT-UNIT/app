# DUCAT Bitcoin Wallet - Comprehensive Refactor Plan
**Date**: November 17, 2025
**Branch**: fix/refactor
**Target**: Production Testnet Deployment
**Status**: READY FOR EXECUTION

---

## Executive Summary

This refactor plan addresses **32 identified issues** (5 critical, 8 high, 12 medium, 7 design) found in the comprehensive security analysis. The plan is organized into a **3-day critical path** followed by ongoing improvements for eventual mainnet readiness.

**Estimated Timeline**:
- **Critical Fixes (Testnet Blocker)**: 2-3 days
- **High Priority Fixes**: 2-3 days
- **Medium Priority Improvements**: 1-2 weeks
- **Mainnet Readiness**: 2-3 months

**Risk Assessment**:
- Current State: **NOT READY** for testnet deployment
- After Critical Fixes: **READY** for controlled testnet deployment
- After High Priority: **READY** for public testnet
- Mainnet: Requires professional audit + all fixes

---

## Phase 1: Critical Security Fixes (Day 1-2) - TESTNET BLOCKERS

### 1.1 Revoke and Secure Sentry DSN (15 minutes)
**Priority**: CRITICAL
**File**: `/App.js` lines 38-40

**Problem**: Hardcoded Sentry DSN exposes project to malicious error injection.

**Action Steps**:
1. Immediately revoke DSN in Sentry dashboard
2. Create new DSN with different project
3. Add to `.env.example`:
   ```bash
   EXPO_PUBLIC_SENTRY_DSN=https://your-new-dsn@sentry.io/project-id
   ```
4. Update `App.js`:
   ```javascript
   Sentry.init({
     dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
     environment: __DEV__ ? 'development' : 'production',
     // ... rest of config
   });
   ```
5. Scrub git history with `bfg` or `git-filter-branch`
6. Add pre-commit hook to prevent secrets

**Files to Modify**:
- `/App.js` (lines 38-40)
- `/.env.example` (add new line)
- `/.gitignore` (verify .env is ignored)

**Testing**:
- [ ] Verify Sentry still receives test errors
- [ ] Confirm old DSN is revoked
- [ ] Check git history is clean

---

### 1.2 Fix Unsafe Taproot Signing Arithmetic (2-3 hours)
**Priority**: CRITICAL
**File**: `/services/transactionSigningService.js` lines 106-125

**Problem**: Manual Taproot key tweaking has unsafe BigInt arithmetic that could cause transaction failures or stuck funds.

**Action Steps**:
1. Replace manual Taproot implementation with `bitcoinjs-lib` built-in tweaking
2. Add curve order validation
3. Remove manual key negation logic
4. Add comprehensive test coverage

**Implementation**:

```javascript
// BEFORE (lines 106-125) - UNSAFE
if (taprootChild.publicKey[0] === 0x03) {
  const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
  const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
  const negatedNum = CURVE_ORDER - privKeyNum;
  privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
}

// AFTER - SAFE (use bitcoinjs-lib built-in)
const tweakedSigner = taprootChild.tweak(
  bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
);
psbt.signInput(inputIndex, tweakedSigner);
```

**Files to Modify**:
- `/services/transactionSigningService.js` (lines 60-136)

**Tests to Add**:
- `services/__tests__/transactionSigningService.test.js`
  - Test Taproot signing with edge case keys
  - Test keys near curve order
  - Test malformed keys
  - Integration test with actual testnet transaction

**Testing**:
- [ ] Unit tests pass with edge cases
- [ ] Integration test signs actual Taproot PSBT
- [ ] Verify signature validates on testnet
- [ ] Test with multiple Taproot inputs

---

### 1.3 Unify Rune/BTC Signing Implementation (3-4 hours)
**Priority**: CRITICAL
**File**: `/services/transactionSigningService.js` lines 60-171

**Problem**: UNIT (Runes) transactions use completely different Taproot signing than BTC transactions, creating inconsistent cryptographic handling.

**Action Steps**:
1. Extract common Taproot signing logic
2. Unify both paths to use same `bitcoinjs-lib` tweaking
3. Remove manual sighash calculation
4. Simplify finalization logic

**Implementation**:

```javascript
// NEW: Unified Taproot signing helper
const signTaprootInput = (psbt, inputIndex, taprootChild) => {
  const tweakedSigner = taprootChild.tweak(
    bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
  );
  psbt.signInput(inputIndex, tweakedSigner);
};

// REFACTORED: signIntent function
export const signIntent = async (intent, currentAccount) => {
  const { segwitChild, taprootChild } = await AuthService.withMnemonic((mnemonic) =>
    deriveSigningKeys(mnemonic, currentAccount)
  );

  const psbt = bitcoin.Psbt.fromBase64(intent.psbt, { network: MUTINYNET_NETWORK });

  // Sign all inputs with unified logic
  for (let i = 0; i < intent.inputs.length; i++) {
    const input = intent.inputs[i];

    if (input.addressType === 'taproot') {
      signTaprootInput(psbt, i, taprootChild);
    } else {
      // SegWit (P2WPKH)
      psbt.signInput(i, segwitChild);
    }
  }

  // Unified finalization
  psbt.finalizeAllInputs();

  const signedTx = psbt.extractTransaction();
  return {
    signedTxHex: signedTx.toHex(),
    txid: signedTx.getId(),
  };
};
```

**Files to Modify**:
- `/services/transactionSigningService.js` (entire file refactor)

**Tests to Add**:
- Test BTC Taproot transaction
- Test UNIT Taproot transaction
- Verify both use same signing path
- Test mixed SegWit + Taproot inputs

**Testing**:
- [ ] BTC Taproot transactions sign correctly
- [ ] UNIT Runes transactions sign correctly
- [ ] Runestone OP_RETURN preserved in UNIT transactions
- [ ] Both transaction types broadcast successfully
- [ ] No regression in existing functionality

---

### 1.4 Add PIN Salt Persistence Verification (1-2 hours)
**Priority**: CRITICAL
**Files**: `/services/pinService.js`, `/services/passkeyService.js`

**Problem**: If `SecureStore.setItemAsync()` fails silently, wallet is left in unrecoverable state with no fallback.

**Action Steps**:
1. Add read-back verification after every salt save
2. Implement salt recovery mechanism
3. Add comprehensive error handling

**Implementation**:

```javascript
// In /services/pinService.js
export const savePin = async (pin) => {
  try {
    // Generate salt
    const salt = await generateSalt();

    // Save salt
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);

    // CRITICAL: Verify write succeeded
    const verifyRead = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    if (verifyRead !== salt) {
      throw new Error('PIN salt persistence verification failed - storage may be full');
    }

    // Hash PIN with verified salt
    const hashedPin = await hashPin(pin, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);

    // Verify PIN hash as well
    const verifyPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    if (verifyPinHash !== hashedPin) {
      throw new Error('PIN hash persistence verification failed');
    }

    logger.info('PIN saved and verified successfully');
  } catch (error) {
    // Clean up partial state
    await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT).catch(() => {});
    await SecureStore.deleteItemAsync(SECURE_KEYS.PIN).catch(() => {});

    throw new Error(`Failed to save PIN: ${error.message}`);
  }
};
```

**Files to Modify**:
- `/services/pinService.js` (savePin function)
- `/services/passkeyService.js` (lines 335-339, 507-511, 637-643)

**Tests to Add**:
- Test salt save verification
- Test storage failure recovery
- Test partial state cleanup

**Testing**:
- [ ] Salt verification succeeds on normal save
- [ ] Error thrown if salt can't be verified
- [ ] Partial state cleaned up on failure
- [ ] Integration test with passkey creation

---

### 1.5 Add Network Validation at App Startup (1 hour)
**Priority**: CRITICAL
**Files**: `/App.js`, `/utils/bitcoin.js`

**Problem**: No explicit validation that network is testnet-only. If config changes, app could accept mainnet addresses.

**Action Steps**:
1. Add network validation on app startup
2. Add validation in address derivation
3. Add unit tests for mainnet rejection

**Implementation**:

```javascript
// In /utils/bitcoin.js - Add at top of file
export const validateNetworkConfig = () => {
  // CRITICAL: Verify we're on testnet
  if (MUTINYNET_NETWORK.bech32 !== 'tb') {
    throw new Error(
      'CRITICAL SECURITY ERROR: Network must be testnet (bech32: tb). ' +
      `Current: ${MUTINYNET_NETWORK.bech32}. REFUSING TO START.`
    );
  }

  // Verify BIP32 public key prefix is testnet
  const expectedTestnetPub = 0x043587cf; // tpub
  if (MUTINYNET_NETWORK.bip32.public !== expectedTestnetPub) {
    throw new Error(
      `CRITICAL: BIP32 public key prefix must be testnet (${expectedTestnetPub.toString(16)}). ` +
      `Current: ${MUTINYNET_NETWORK.bip32.public.toString(16)}`
    );
  }

  logger.info('Network validation passed: TESTNET ONLY');
  return true;
};

// In deriveAddressesFromMnemonic - Add check
export const deriveAddressesFromMnemonic = (mnemonic, accountIndex = 0) => {
  // SECURITY: Verify testnet before deriving any addresses
  validateNetworkConfig();

  // ... rest of function
};
```

```javascript
// In /App.js - Add before Sentry init
import { validateNetworkConfig } from './utils/bitcoin';

// CRITICAL: Validate network configuration before app starts
try {
  validateNetworkConfig();
} catch (error) {
  // Fail hard - don't allow app to continue
  Alert.alert(
    'Critical Security Error',
    'Network configuration is invalid. App cannot start. Please contact support.',
    [{ text: 'Exit', onPress: () => {} }]
  );
  throw error;
}
```

**Files to Modify**:
- `/utils/bitcoin.js` (add validateNetworkConfig function)
- `/App.js` (add validation on startup)

**Tests to Add**:
- Test network validation passes with testnet config
- Test network validation fails with mainnet config
- Test address derivation rejects wrong network

**Testing**:
- [ ] App starts successfully with testnet config
- [ ] App refuses to start if network changed to mainnet
- [ ] Unit tests verify all network checks
- [ ] Integration test with address derivation

---

## Phase 2: High Priority Security Fixes (Day 3-4)

### 2.1 Fix Insecure HKDF Implementation (2 hours)
**Priority**: HIGH
**File**: `/services/passkeyService.js` lines 108-124

**Problem**: Custom HKDF doesn't follow RFC 5869 - uses SHA256 digest instead of HMAC.

**Implementation**:

```javascript
import { createHmac } from 'react-native-quick-crypto';

const deriveEncryptionKey = async (credentialId, userHandle, pin, pinSalt) => {
  const { hashPinForEncryption } = await import('./pinService');
  const derivedPin = await hashPinForEncryption(pin, pinSalt);

  const derivedPinBytes = Buffer.from(derivedPin, 'hex');
  const ikm = Buffer.concat([
    Buffer.from(credentialId),
    Buffer.from(userHandle),
    derivedPinBytes,
  ]);

  // RFC 5869 compliant HKDF-SHA256
  const salt = Buffer.from('ducat-encryption-v4', 'utf8');
  const info = Buffer.from('aes-256-gcm-key', 'utf8');

  // HKDF-Extract: PRK = HMAC-SHA256(salt, IKM)
  const prkHmac = createHmac('sha256', salt);
  const prk = prkHmac.update(ikm).digest();

  // HKDF-Expand: OKM = HMAC-SHA256(PRK, info || 0x01)
  const okmHmac = createHmac('sha256', prk);
  const okm = okmHmac.update(Buffer.concat([info, Buffer.from([0x01])])).digest();

  // Import as CryptoKey for AES-GCM
  const cryptoKey = await subtle.importKey(
    'raw',
    okm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cryptoKey;
};
```

**Files to Modify**:
- `/services/passkeyService.js` (deriveEncryptionKey function)

**Testing**:
- [ ] Test with RFC 5869 test vectors
- [ ] Verify encryption/decryption still works
- [ ] Test passkey creation and restore flows

---

### 2.2 Add Atomic PIN Change Locking (1 hour)
**Priority**: HIGH
**File**: `/services/passkeyService.js` lines 862-931

**Implementation**:

```javascript
// Add at module level
let pinChangeInProgress = false;

export const atomicPinChangeWithPasskey = async (newPin) => {
  // Prevent concurrent PIN changes
  if (pinChangeInProgress) {
    throw new Error('PIN change already in progress. Please wait.');
  }

  pinChangeInProgress = true;

  try {
    // Backup current state
    const oldPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const oldPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);

    if (!oldPinHash || !oldPinSalt) {
      throw new Error('Cannot change PIN - current PIN not found');
    }

    // Save new PIN (generates new salt)
    await savePin(newPin);

    // Re-encrypt passkey mnemonic with new PIN
    await reencryptPasskeyMnemonicAfterPinChange(newPin);

    logger.info('PIN changed successfully');
  } catch (error) {
    logger.error('PIN change failed', { error: error.message });

    // Attempt rollback on failure
    // Note: This is best-effort - if savePin succeeded but re-encrypt failed,
    // we're in an inconsistent state
    throw error;
  } finally {
    pinChangeInProgress = false;
  }
};
```

**Files to Modify**:
- `/services/passkeyService.js` (atomicPinChangeWithPasskey function)

**Testing**:
- [ ] Test concurrent PIN change attempts blocked
- [ ] Test successful PIN change
- [ ] Test rollback on failure

---

### 2.3 Sanitize Error Messages in Signing Service (30 minutes)
**Priority**: HIGH
**File**: `/services/transactionSigningService.js` line 198

**Implementation**:

```javascript
} catch (error) {
  // Sanitize error message to prevent key/address leakage
  const sanitizedMessage = (error.message || 'Unknown error')
    .replace(/[0-9a-f]{64}/gi, '[REDACTED_KEY]')           // Private keys (32 bytes)
    .replace(/[0-9a-f]{66}/gi, '[REDACTED_KEY]')           // Compressed pubkeys
    .replace(/[0-9a-f]{130}/gi, '[REDACTED_KEY]')          // Uncompressed pubkeys
    .replace(/tb1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')   // Testnet bech32
    .replace(/bc1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]');  // Mainnet bech32 (shouldn't exist)

  logger.error('Transaction signing failed', {
    sanitizedMessage,
    assetType: intent?.assetType,
    inputCount: intent?.inputs?.length
  });

  throw new Error(`Transaction signing failed: ${sanitizedMessage}`);
}
```

**Files to Modify**:
- `/services/transactionSigningService.js` (catch block)

**Testing**:
- [ ] Test error sanitization with mock keys
- [ ] Verify Sentry receives sanitized errors

---

### 2.4 Add Passkey Challenge Timestamp Validation (1 hour)
**Priority**: HIGH
**File**: `/services/passkeyService.js` lines 468-479, 594-607

**Implementation**:

```javascript
const createChallengeWithTimestamp = () => {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
  const challengeData = new Uint8Array(36); // 4 bytes timestamp + 32 bytes random

  // Write timestamp (big-endian)
  challengeData[0] = (timestamp >> 24) & 0xff;
  challengeData[1] = (timestamp >> 16) & 0xff;
  challengeData[2] = (timestamp >> 8) & 0xff;
  challengeData[3] = timestamp & 0xff;

  // Fill rest with random bytes
  getRandomValues(challengeData.subarray(4));

  return challengeData;
};

const validateChallengeTimestamp = (challenge) => {
  const MAX_CHALLENGE_AGE_SECONDS = 5 * 60; // 5 minutes

  // Extract timestamp from challenge
  const timestamp =
    (challenge[0] << 24) |
    (challenge[1] << 16) |
    (challenge[2] << 8) |
    challenge[3];

  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age < 0) {
    throw new Error('Challenge timestamp is in the future - possible clock skew');
  }

  if (age > MAX_CHALLENGE_AGE_SECONDS) {
    throw new Error('Challenge has expired - please try again');
  }

  return true;
};
```

**Files to Modify**:
- `/services/passkeyService.js` (challenge creation and validation)

**Testing**:
- [ ] Test challenge validation with fresh timestamp
- [ ] Test rejection of expired challenge
- [ ] Test rejection of future timestamp

---

### 2.5 Add Biometric Rate Limiting (1 hour)
**Priority**: HIGH
**Files**: `/services/biometricService.js`, `/contexts/AuthContext.js`

**Implementation**:

```javascript
// In /services/biometricService.js
const BIOMETRIC_KEYS = {
  FAILED_ATTEMPTS: 'biometric_failed_attempts_v1',
  LOCKOUT_UNTIL: 'biometric_lockout_until_v1',
};

const BIOMETRIC_MAX_ATTEMPTS = 5;
const BIOMETRIC_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export const checkBiometricLockout = async () => {
  const lockoutUntil = await SecureStore.getItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);

  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil, 10);
    const now = Date.now();

    if (now < lockoutTime) {
      const remainingMs = lockoutTime - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new Error(`Biometric locked. Try again in ${remainingMin} minutes.`);
    } else {
      // Lockout expired - clear it
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
    }
  }
};

export const recordBiometricAttempt = async (success) => {
  if (success) {
    // Clear failed attempts on success
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
    return;
  }

  // Increment failed attempts
  const attemptsStr = await SecureStore.getItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) + 1 : 1;

  await SecureStore.setItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS, attempts.toString());

  if (attempts >= BIOMETRIC_MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + BIOMETRIC_LOCKOUT_MS;
    await SecureStore.setItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
    throw new Error(`Too many failed biometric attempts. Locked for 15 minutes.`);
  }
};
```

**Files to Modify**:
- `/services/biometricService.js` (add rate limiting)
- `/contexts/AuthContext.js` (integrate rate limiting)

**Testing**:
- [ ] Test biometric lockout after 5 failures
- [ ] Test lockout clears after 15 minutes
- [ ] Test successful auth clears counter

---

### 2.6 Improve Transaction Finalization Error Handling (30 minutes)
**Priority**: HIGH
**File**: `/services/transactionSigningService.js` lines 156-170

**Implementation**:

```javascript
// Finalize all inputs
try {
  psbt.finalizeAllInputs();
  logger.debug('Transaction finalization: auto-finalize succeeded', {
    assetType: intent.assetType,
    inputCount: intent.inputs.length
  });
} catch (autoFinalizeError) {
  logger.warn('Transaction finalization: auto-finalize failed, using manual path', {
    error: autoFinalizeError.message,
    assetType: intent.assetType
  });

  // Manual finalization (only for specific cases)
  if (intent.assetType === 'UNIT') {
    psbt.finalizeInput(0); // P2WPKH finalizes normally

    const tapKeySig = psbt.data.inputs[1].tapKeySig;
    if (!tapKeySig) {
      throw new Error('No tapKeySig found for Taproot input - signing may have failed');
    }

    psbt.data.inputs[1].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
    logger.debug('Manual finalization succeeded for UNIT transaction');
  } else {
    // For BTC transactions, auto-finalize should always work
    throw new Error(`Unexpected finalization failure for ${intent.assetType} transaction: ${autoFinalizeError.message}`);
  }
}
```

**Files to Modify**:
- `/services/transactionSigningService.js` (finalization logic)

**Testing**:
- [ ] Test auto-finalize path logging
- [ ] Test manual finalize path logging
- [ ] Verify errors properly propagate

---

### 2.7 Add Sentry Error Sanitization (1 hour)
**Priority**: HIGH
**File**: `/App.js` lines 38-50

**Implementation**:

```javascript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  beforeSend(event, hint) {
    // Sanitize sensitive data before sending to Sentry

    // Remove cookies and headers
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }

    // Sanitize exception messages
    if (event.exception?.values) {
      event.exception.values.forEach(exception => {
        if (exception.value) {
          exception.value = sanitizeSensitiveData(exception.value);
        }
      });
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs.forEach(breadcrumb => {
        if (breadcrumb.message) {
          breadcrumb.message = sanitizeSensitiveData(breadcrumb.message);
        }
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(breadcrumb.data);
        }
      });
    }

    // Sanitize extra context
    if (event.extra) {
      event.extra = sanitizeObject(event.extra);
    }

    return event;
  },
  // ... rest of config
});

function sanitizeSensitiveData(str) {
  if (typeof str !== 'string') return str;

  return str
    .replace(/[0-9a-f]{64}/gi, '[REDACTED_KEY]')
    .replace(/[0-9a-f]{66}/gi, '[REDACTED_KEY]')
    .replace(/[0-9a-f]{130}/gi, '[REDACTED_KEY]')
    .replace(/tb1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')
    .replace(/bc1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')
    .replace(/\b[a-z]+(\s+[a-z]+){11}\b/gi, '[REDACTED_MNEMONIC]'); // 12-word phrases
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys entirely
    if (/mnemonic|seed|private|secret|password|pin/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeSensitiveData(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
```

**Files to Modify**:
- `/App.js` (Sentry beforeSend hook)

**Testing**:
- [ ] Test error sanitization with mock sensitive data
- [ ] Verify Sentry receives sanitized events
- [ ] Test breadcrumb sanitization

---

### 2.8 Add Transaction Malleability Check (1 hour)
**Priority**: HIGH
**File**: `/services/transactionSigningService.js`

**Implementation**:

```javascript
export const signIntent = async (intent, currentAccount) => {
  // ... signing logic ...

  const signedTx = psbt.extractTransaction();
  const signedTxHex = signedTx.toHex();
  const computedTxid = signedTx.getId();

  // SECURITY: Verify transaction wasn't malleated during signing
  // Re-parse and verify TXID matches
  const verifyTx = bitcoin.Transaction.fromHex(signedTxHex);
  const verifyTxid = verifyTx.getId();

  if (computedTxid !== verifyTxid) {
    throw new Error(
      'Transaction malleability detected - TXID mismatch after re-parsing. ' +
      'This should never happen with SegWit/Taproot.'
    );
  }

  logger.debug('Transaction malleability check passed', { txid: computedTxid });

  return {
    signedTxHex,
    txid: computedTxid,
  };
};
```

**Files to Modify**:
- `/services/transactionSigningService.js` (add TXID verification)

**Testing**:
- [ ] Test TXID verification with valid transaction
- [ ] Test detection of malleated transaction (mock)

---

## Phase 3: Medium Priority Improvements (Week 2-3)

### 3.1 Add PSBT Input Verification Before Signing (2 hours)
**File**: `/services/transactionSigningService.js`

**Problem**: No verification that PSBT inputs match expected UTXOs.

**Implementation**: Add input verification before signing to detect unauthorized inputs.

---

### 3.2 Make UTXO Selection Deterministic (3 hours)
**File**: `/services/transaction/utxoSelection.js`

**Problem**: Non-deterministic UTXO selection creates privacy fingerprint.

**Implementation**: Sort UTXOs deterministically before selection.

---

### 3.3 Add Transaction Amount Validation (1 hour)
**Files**: Transaction creation services

**Problem**: No maximum amount validation.

**Implementation**: Add max amount checks relative to total balance.

---

### 3.4 Add Fee Calculation Loop Guards (2 hours)
**File**: `/services/transaction/btcTransaction.js`, `/services/transaction/runesTransaction.js`

**Problem**: Fee calculation loops could theoretically oscillate forever.

**Implementation**: Add iteration limit and convergence detection.

---

### 3.5 Add Transaction Timeout Handling (2 hours)
**Files**: Transaction contexts

**Problem**: No timeout for pending transactions.

**Implementation**: Add configurable timeout with user notification.

---

### 3.6 Improve Security Event Logging (3 hours)
**Files**: All security services

**Problem**: Insufficient logging of security events.

**Implementation**: Add structured logging for all auth events.

---

### 3.7 Optimize Context Provider Nesting (4 hours)
**Files**: `/App.js`, `/navigation/AppNavigator.js`

**Problem**: 13 nested contexts (2,526 lines) may cause performance issues.

**Implementation**: Flatten context hierarchy, combine related contexts.

---

### 3.8 Increase Test Coverage (1-2 weeks)
**Files**: `__tests__/` directories

**Problem**: Missing tests for critical paths.

**Tests to Add**:
- Taproot signature generation edge cases
- Rune transaction signing
- PIN salt persistence failures
- UTXO selection convergence
- Passkey challenge validation
- Transaction malleability
- Fee calculation loops
- iCloud sync failures

---

### 3.9 Add Session State Validation (2 hours)
**Files**: Auth contexts

**Problem**: No validation of session state consistency.

**Implementation**: Add session state checks on app resume.

---

### 3.10 Add Fee Review UI Warnings (1 hour)
**Files**: Review screen components

**Problem**: No warnings for unusually high fees.

**Implementation**: Add fee warning if > 10% of transaction amount.

---

### 3.11 Add Taproot Pubkey Validation (1 hour)
**File**: `/utils/bitcoin.js`

**Problem**: No validation that Taproot pubkeys are valid.

**Implementation**: Add x-only pubkey validation.

---

### 3.12 Add Runes Dust Handling (2 hours)
**File**: `/services/transaction/runesTransaction.js`

**Problem**: No explicit handling of dust UTXOs for Runes.

**Implementation**: Add Runes-specific dust limits.

---

## Phase 4: Design & Architecture Improvements (Ongoing)

### 4.1 TypeScript Conversion for Security-Critical Code
**Timeline**: 2-3 weeks
**Files**: All service files

**Rationale**: Type safety prevents entire classes of bugs in crypto code.

---

### 4.2 Extract Business Logic from Contexts
**Timeline**: 1 week
**Files**: All context files

**Rationale**: Contexts should manage state, not business logic.

---

### 4.3 Add Comprehensive Documentation
**Timeline**: 1 week
**Files**: All source files

**Rationale**: Security-critical code needs extensive documentation.

---

### 4.4 Implement Proper Logging Infrastructure
**Timeline**: 3-4 days
**Files**: All files

**Rationale**: Structured logging helps with debugging and security audits.

---

### 4.5 Add Performance Monitoring
**Timeline**: 3-4 days
**Files**: App.js, critical paths

**Rationale**: Monitor app performance in production.

---

### 4.6 Implement Feature Flags
**Timeline**: 2-3 days
**Files**: App configuration

**Rationale**: Allow gradual rollout of fixes and features.

---

### 4.7 Add Comprehensive Error Recovery
**Timeline**: 1 week
**Files**: All error-prone operations

**Rationale**: Graceful error recovery improves user experience.

---

## Testing Strategy

### Unit Tests (Per Feature)
- Test individual functions in isolation
- Mock external dependencies
- Cover edge cases and error paths
- Aim for >80% coverage on security-critical code

### Integration Tests (Per Phase)
- Test complete user flows
- Use actual testnet transactions
- Test error recovery paths
- Verify state consistency

### End-to-End Tests (Pre-Deployment)
- Full wallet lifecycle
- Transaction signing and broadcast
- Passkey creation and recovery
- PIN change flows
- Biometric authentication

### Security Tests (Continuous)
- Fuzz testing for transaction building
- Crypto library test vectors
- Challenge-response validation
- Error message sanitization

---

## Deployment Checklist

### Before Testnet Deployment
- [ ] All 5 critical issues fixed
- [ ] All 8 high priority issues fixed
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Code review completed
- [ ] Sentry sanitization verified
- [ ] Network validation tested
- [ ] Transaction signing tested on testnet
- [ ] PIN and passkey flows tested
- [ ] Error handling verified

### Before Public Testnet
- [ ] All medium priority issues fixed
- [ ] Comprehensive test coverage added
- [ ] Performance monitoring in place
- [ ] User documentation complete
- [ ] Support process defined
- [ ] Incident response plan documented

### Before Mainnet (Future)
- [ ] Professional cryptography audit completed
- [ ] External security review passed
- [ ] TypeScript conversion complete
- [ ] Fuzzing campaign completed
- [ ] 30+ days of successful testnet operation
- [ ] All design issues addressed
- [ ] Comprehensive monitoring in place
- [ ] User education materials ready

---

## Success Metrics

### Phase 1 (Critical Fixes)
- [ ] Zero Sentry errors with exposed keys/addresses
- [ ] Zero transaction signing failures
- [ ] Zero wallet recovery failures
- [ ] 100% network validation success

### Phase 2 (High Priority)
- [ ] <0.1% authentication failures
- [ ] <0.1% transaction finalization errors
- [ ] All security events properly logged
- [ ] Zero challenge replay vulnerabilities

### Phase 3 (Medium Priority)
- [ ] >80% test coverage on security-critical code
- [ ] <100ms context provider overhead
- [ ] <5% transaction timeout rate
- [ ] Deterministic UTXO selection

### Phase 4 (Design)
- [ ] Type-safe security-critical code
- [ ] Comprehensive documentation
- [ ] Performance within targets
- [ ] Feature flag infrastructure

---

## Risk Mitigation

### Technical Risks
- **Risk**: Taproot signing refactor breaks existing functionality
  - **Mitigation**: Comprehensive test suite with actual testnet transactions
  - **Rollback Plan**: Revert to current implementation if issues detected

- **Risk**: HKDF change breaks existing passkey backups
  - **Mitigation**: Version encryption scheme, support old version during migration
  - **Rollback Plan**: Support both v3 and v4 encryption

- **Risk**: Network validation too strict, prevents legitimate use
  - **Mitigation**: Thorough testing with all address types
  - **Rollback Plan**: Make validation warnings instead of errors

### User Impact Risks
- **Risk**: PIN salt verification breaks existing wallets
  - **Mitigation**: Only apply to new PIN saves, grandfather existing
  - **Rollback Plan**: Skip verification if flag not set

- **Risk**: Biometric lockout frustrates users
  - **Mitigation**: Clear UI messaging, PIN fallback always available
  - **Rollback Plan**: Increase attempt limit or reduce lockout time

---

## Communication Plan

### Internal Team
- Daily standup during Phase 1-2 (critical fixes)
- Code review required for all security changes
- Post-deployment retrospective after each phase

### Stakeholders
- Daily progress updates during Phase 1
- Weekly updates during Phase 2-3
- Risk assessment after each phase
- Go/no-go decision before testnet deployment

### Users (Testnet)
- Clear communication about testnet-only status
- Known issues documented
- Support channel established
- Incident response plan published

---

## Appendix A: File Change Matrix

| File | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| `/App.js` | ✓ | ✓ | | ✓ |
| `/services/transactionSigningService.js` | ✓✓✓ | ✓ | ✓ | ✓ |
| `/services/passkeyService.js` | ✓ | ✓✓ | | ✓ |
| `/services/pinService.js` | ✓ | | | ✓ |
| `/services/biometricService.js` | | ✓ | | ✓ |
| `/utils/bitcoin.js` | ✓ | | ✓ | ✓ |
| `/services/transaction/utxoSelection.js` | | | ✓ | ✓ |
| Context files | | | ✓ | ✓✓ |
| Test files | ✓ | ✓ | ✓✓✓ | ✓ |

---

## Appendix B: Priority Decision Matrix

| Issue | Testnet Blocker | User Impact | Fix Complexity | Risk if Not Fixed |
|-------|----------------|-------------|----------------|-------------------|
| Sentry DSN | YES | Low | Low | High |
| Taproot Signing | YES | High | Medium | Critical |
| Rune/BTC Unification | YES | High | High | Critical |
| PIN Salt Verification | YES | Medium | Low | Critical |
| Network Validation | YES | High | Low | Critical |
| HKDF Implementation | NO | Low | Medium | Medium |
| PIN Change Race | NO | Low | Low | Medium |
| Error Sanitization | NO | Low | Low | Medium |
| Biometric Rate Limit | NO | Low | Low | Low |

---

## Conclusion

This refactor plan provides a **systematic approach** to addressing all identified security and code quality issues. The **3-day critical path** (Phase 1-2) will make the application safe for testnet deployment, while subsequent phases prepare for eventual mainnet readiness.

**Key Takeaways**:
1. **5 critical issues** must be fixed before any deployment
2. **2-3 days** to achieve testnet-ready state
3. **2-3 months** additional work for mainnet readiness
4. **Professional audit required** before mainnet
5. **Comprehensive testing** is essential at every phase

The current codebase demonstrates **strong fundamentals** in many areas (PIN security, storage, address validation), but the **critical Taproot signing issues** and **passkey implementation concerns** must be addressed immediately.

With the fixes outlined in Phase 1-2, the application will be **ready for controlled testnet deployment** with appropriate monitoring and user support.

---

**Document Version**: 1.0
**Last Updated**: November 17, 2025
**Author**: Security Analysis Team
**Status**: Ready for Team Review and Execution
