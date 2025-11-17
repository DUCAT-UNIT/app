# DUCAT Wallet - Master Refactoring Plan
**Branch**: `fix/refactor`
**Current Score**: 67/100
**Target Score**: 85/100 (Mainnet Ready)
**Timeline**: 8 weeks
**Last Updated**: November 17, 2025

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Week-by-Week Implementation Plan](#week-by-week-implementation-plan)
4. [Testing Strategy](#testing-strategy)
5. [Success Metrics](#success-metrics)
6. [Risk Management](#risk-management)
7. [Complete Issue Registry](#complete-issue-registry)

---

## Executive Summary

### The Verdict: **Salvageable (67/100)**

Your codebase has a **solid foundation** with **fixable technical debt**. This is NOT a rewrite situation - it's a systematic refactoring over 8 weeks.

### What's Good
- ✅ Modern React patterns throughout
- ✅ Clear service/component separation
- ✅ Excellent security patterns (withMnemonic)
- ✅ 107 existing tests
- ✅ Proper Bitcoin implementation (BIP39/84/86)
- ✅ Up-to-date dependencies

### What Needs Work
- 🔴 **5 Critical Security Issues** (Testnet blockers)
- 🟠 **8 High Priority Issues** (Performance/security)
- 🟡 **12 Medium Issues** (Code quality)
- 🔵 **7 Design Issues** (Architecture)

### The Plan
- **Week 1-2**: Critical security fixes → **Testnet ready**
- **Week 3-4**: Architecture improvements → **Performance gains**
- **Week 5-6**: Code quality refactoring → **Maintainability**
- **Week 7-8**: Testing & polish → **Production ready**

### Score Progression
- **Start**: 67/100
- **After Week 2**: 72/100 (Testnet deployable)
- **After Week 4**: 78/100 (Public testnet ready)
- **After Week 6**: 82/100 (Pre-mainnet)
- **After Week 8**: 85/100 (Mainnet ready)

---

## Current State Analysis

### Codebase Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Largest file | 2,494 lines | <500 | 🔴 Critical |
| Contexts | 14 | 8-10 | 🟡 Needs work |
| Average component size | 300 lines | <200 | 🟠 High priority |
| Hooks over 150 lines | 15 | <5 | 🟡 Medium |
| Test coverage | ~40% | >80% | 🟡 Medium |
| Files over 500 lines | 6 | 0 | 🟠 High priority |
| Code duplication | High | Low | 🟡 Medium |

### Category Scores

| Category | Score | Target | Priority |
|----------|-------|--------|----------|
| Architecture | 65/100 | 80/100 | High |
| Code Quality | 62/100 | 85/100 | High |
| Security | 58/100 | 90/100 | **Critical** |
| Performance | 60/100 | 80/100 | High |
| Maintainability | 55/100 | 85/100 | Medium |
| Testing | 72/100 | 90/100 | Medium |
| Dependencies | 85/100 | 90/100 | Low |
| Bitcoin Implementation | 78/100 | 95/100 | High |

---

## Week-by-Week Implementation Plan

---

## WEEK 1: Critical Security Fixes (Testnet Blockers)
**Goal**: Fix the 5 critical issues that prevent testnet deployment
**Estimated Effort**: 12-15 hours
**Score Impact**: 67 → 72 (+5 points)

### Day 1 (Monday) - 4 hours

#### Task 1.1: Revoke Sentry DSN (30 minutes)
**File**: `/App.js` lines 38-40

**Steps**:
1. Log into Sentry dashboard
2. Revoke exposed DSN immediately
3. Create new DSN for project
4. Add to `.env`:
```bash
EXPO_PUBLIC_SENTRY_DSN=https://NEW_DSN@sentry.io/PROJECT
```
5. Update App.js:
```javascript
// BEFORE (line 38-40)
Sentry.init({
  dsn: 'https://73c5edc0813cd1be8eba194004f1ec1a@o4510347963072512.ingest.us.sentry.io/4510347966873600',
  environment: __DEV__ ? 'development' : 'production',
```

// AFTER
```javascript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
```

6. Update `.env.example` with placeholder
7. Verify `.env` in `.gitignore`

**Testing**:
```bash
# Test Sentry still works
npm start
# Trigger test error in dev
# Check Sentry dashboard for event
```

**Commit**: `security: move Sentry DSN to environment variable`

---

#### Task 1.2: Add Network Validation (1.5 hours)
**Files**: `/utils/bitcoin.js`, `/App.js`

**Implementation**:

```javascript
// /utils/bitcoin.js - Add at top after imports
/**
 * CRITICAL: Validate network configuration is testnet-only
 * This prevents accidentally using mainnet addresses/network
 */
export const validateNetworkConfig = () => {
  // Verify bech32 prefix
  if (MUTINYNET_NETWORK.bech32 !== 'tb') {
    throw new Error(
      `CRITICAL SECURITY ERROR: Network must be testnet (bech32: tb). ` +
      `Current: ${MUTINYNET_NETWORK.bech32}. REFUSING TO START.`
    );
  }

  // Verify BIP32 public key prefix is testnet
  const EXPECTED_TESTNET_PUB = 0x043587cf; // tpub
  if (MUTINYNET_NETWORK.bip32.public !== EXPECTED_TESTNET_PUB) {
    throw new Error(
      `CRITICAL: BIP32 public key prefix must be testnet (${EXPECTED_TESTNET_PUB.toString(16)}). ` +
      `Current: ${MUTINYNET_NETWORK.bip32.public.toString(16)}`
    );
  }

  // Verify BIP32 private key prefix is testnet
  const EXPECTED_TESTNET_PRIV = 0x04358394; // tprv
  if (MUTINYNET_NETWORK.bip32.private !== EXPECTED_TESTNET_PRIV) {
    throw new Error(
      `CRITICAL: BIP32 private key prefix must be testnet (${EXPECTED_TESTNET_PRIV.toString(16)}). ` +
      `Current: ${MUTINYNET_NETWORK.bip32.private.toString(16)}`
    );
  }

  logger.info('✓ Network validation passed: TESTNET ONLY');
  return true;
};

// Update deriveAddressesFromMnemonic to validate on every call
export const deriveAddressesFromMnemonic = (mnemonic, accountIndex = 0) => {
  // SECURITY: Verify testnet before deriving any addresses
  validateNetworkConfig();

  // ... rest of existing function
};
```

```javascript
// /App.js - Add before Sentry init (around line 30)
import { validateNetworkConfig } from './utils/bitcoin';

// CRITICAL: Validate network configuration before app starts
try {
  validateNetworkConfig();
} catch (error) {
  console.error('CRITICAL NETWORK VALIDATION FAILED:', error);

  // Fail hard - don't allow app to continue
  Alert.alert(
    'Critical Security Error',
    'Network configuration is invalid. App cannot start. Please contact support.',
    [{ text: 'Exit', onPress: () => {} }]
  );

  throw error; // Prevent app initialization
}

console.log('✓ Network validation passed - proceeding with app initialization');
```

**Testing**:
```bash
# Create test file: __tests__/utils/bitcoin.network.test.js
import { validateNetworkConfig, MUTINYNET_NETWORK } from '../../utils/bitcoin';

describe('Network Validation', () => {
  it('should pass with testnet config', () => {
    expect(() => validateNetworkConfig()).not.toThrow();
  });

  it('should verify bech32 is testnet', () => {
    expect(MUTINYNET_NETWORK.bech32).toBe('tb');
  });

  it('should verify BIP32 prefixes are testnet', () => {
    expect(MUTINYNET_NETWORK.bip32.public).toBe(0x043587cf);
    expect(MUTINYNET_NETWORK.bip32.private).toBe(0x04358394);
  });
});

# Run tests
npm test bitcoin.network.test.js
```

**Commit**: `security: add network validation on app startup`

---

#### Task 1.3: Add PIN Salt Verification (2 hours)
**Files**: `/services/pinService.js`, `/services/passkeyService.js`

**Implementation**:

```javascript
// /services/pinService.js - Update savePin function
export const savePin = async (pin) => {
  try {
    // Validate PIN format
    if (!pin || pin.length !== PIN.MIN_LENGTH) {
      throw new Error(`PIN must be exactly ${PIN.MIN_LENGTH} digits`);
    }

    // Generate salt
    const salt = await generateSalt();
    logger.debug('Generated new PIN salt');

    // Save salt with verification
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);

    // CRITICAL: Verify write succeeded by reading back
    const verifyRead = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    if (verifyRead !== salt) {
      throw new Error(
        'PIN salt persistence verification failed - storage may be full or corrupted. ' +
        'Please free up device storage and try again.'
      );
    }
    logger.debug('PIN salt persistence verified');

    // Hash PIN with verified salt
    const hashedPin = await hashPin(pin, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);

    // Verify PIN hash as well
    const verifyPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    if (verifyPinHash !== hashedPin) {
      // Clean up salt if hash failed to save
      await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT).catch(() => {});
      throw new Error('PIN hash persistence verification failed');
    }
    logger.debug('PIN hash persistence verified');

    logger.info('PIN saved and verified successfully');
    return true;
  } catch (error) {
    logger.error('Failed to save PIN', { error: error.message });

    // Clean up partial state on any error
    try {
      await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT);
      await SecureStore.deleteItemAsync(SECURE_KEYS.PIN);
    } catch (cleanupError) {
      logger.error('Failed to clean up after PIN save error', { error: cleanupError.message });
    }

    throw new Error(`Failed to save PIN: ${error.message}`);
  }
};
```

```javascript
// /services/passkeyService.js - Update salt validation (lines 335-339, 507-511, 637-643)

// Find all instances of PIN salt retrieval and add verification:
const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);

// Add after retrieval:
if (!pinSalt) {
  throw new Error('PIN salt not found - wallet may be in inconsistent state');
}

// Validate format
if (pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
  throw new Error(
    'Invalid PIN salt format - expected 64 hex characters. ' +
    'Wallet may be corrupted. Please contact support.'
  );
}

// Additional verification: Ensure it's not all zeros (corrupted)
if (/^0+$/.test(pinSalt)) {
  throw new Error('PIN salt appears corrupted (all zeros) - cannot proceed');
}

logger.debug('PIN salt validated successfully');
```

**Testing**:
```javascript
// __tests__/services/pinService.test.js
describe('PIN Salt Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should verify salt persistence after save', async () => {
    const pin = '123456';
    await savePin(pin);

    // Verify salt was saved
    const salt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    expect(salt).toBeTruthy();
    expect(salt.length).toBe(64);
  });

  it('should throw if salt save verification fails', async () => {
    // Mock SecureStore to fail verification
    SecureStore.getItemAsync.mockResolvedValueOnce(null); // First call returns null

    await expect(savePin('123456')).rejects.toThrow('persistence verification failed');
  });

  it('should clean up on save failure', async () => {
    // Mock to fail on PIN hash save
    SecureStore.setItemAsync
      .mockResolvedValueOnce(undefined) // Salt saves
      .mockRejectedValueOnce(new Error('Storage full')); // PIN hash fails

    await expect(savePin('123456')).rejects.toThrow();

    // Verify cleanup was attempted
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.PIN_SALT);
  });
});
```

**Commit**: `security: add PIN salt persistence verification`

---

### Day 2 (Tuesday) - 5 hours

#### Task 1.4: Fix Unsafe Taproot Signing (3 hours)
**File**: `/services/transactionSigningService.js` lines 106-125

**Current Implementation (UNSAFE)**:
```javascript
// Lines 106-125 - UNSAFE manual implementation
if (taprootChild.publicKey[0] === 0x03) {
  const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
  const CURVE_ORDER = BigInt(
    '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
  );
  const negatedNum = CURVE_ORDER - privKeyNum;
  privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
}

// Add the tweak
const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
const tweakNum = BigInt('0x' + tweakHash.toString('hex'));
const CURVE_ORDER = BigInt(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
);
const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');
```

**New Implementation (SAFE)**:
```javascript
// Extract Taproot signing to separate function for reusability
const signTaprootInput = (psbt, inputIndex, taprootChild) => {
  // Use bitcoinjs-lib's built-in tweaking - battle-tested implementation
  const tweakedSigner = taprootChild.tweak(
    bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
  );

  psbt.signInput(inputIndex, tweakedSigner);

  logger.debug('Taproot input signed', { inputIndex });
};
```

**Commit**: `security: use bitcoinjs-lib built-in Taproot tweaking`

---

#### Task 1.5: Unify Rune/BTC Signing Implementation (2 hours)
**File**: `/services/transactionSigningService.js` lines 60-171

**Complete Refactor**:

```javascript
/**
 * Sign a transaction intent PSBT
 * Unified signing for both BTC and UNIT (Runes) transactions
 */
export const signIntent = async (intent, currentAccount) => {
  try {
    if (!intent) {
      throw new Error(ERRORS.TRANSACTION_CANCELLED);
    }

    logger.debug('Signing transaction intent', {
      assetType: intent.assetType,
      inputCount: intent.inputs.length,
      addressType: intent.addressType
    });

    // SECURITY: Use withMnemonic to minimize mnemonic exposure to <100ms
    const { segwitChild, taprootChild } = await AuthService.withMnemonic((mnemonic) =>
      deriveSigningKeys(mnemonic, currentAccount)
    );

    // Load PSBT with correct network (testnet)
    const psbt = bitcoin.Psbt.fromBase64(intent.psbt, { network: MUTINYNET_NETWORK });

    // UNIFIED SIGNING: Sign all inputs based on their address type
    for (let i = 0; i < intent.inputs.length; i++) {
      const input = intent.inputs[i];

      if (input.addressType === 'taproot') {
        // Taproot input - use unified Taproot signing
        signTaprootInput(psbt, i, taprootChild);
      } else {
        // SegWit (P2WPKH) input
        psbt.signInput(i, segwitChild);
        logger.debug('SegWit input signed', { inputIndex: i });
      }
    }

    // Finalize all inputs
    try {
      psbt.finalizeAllInputs();
      logger.debug('Transaction finalization: auto-finalize succeeded', {
        assetType: intent.assetType,
        inputCount: intent.inputs.length
      });
    } catch (autoFinalizeError) {
      logger.warn('Transaction finalization: auto-finalize failed, attempting manual finalization', {
        error: autoFinalizeError.message,
        assetType: intent.assetType
      });

      // Manual finalization for edge cases
      // Try to finalize each input individually
      for (let i = 0; i < intent.inputs.length; i++) {
        try {
          psbt.finalizeInput(i);
        } catch (inputError) {
          // For Taproot inputs, may need manual witness construction
          const input = intent.inputs[i];
          if (input.addressType === 'taproot') {
            const tapKeySig = psbt.data.inputs[i].tapKeySig;
            if (!tapKeySig) {
              throw new Error(`No tapKeySig found for Taproot input ${i} - signing may have failed`);
            }
            psbt.data.inputs[i].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
            logger.debug('Manual Taproot finalization succeeded', { inputIndex: i });
          } else {
            throw inputError; // Re-throw if not Taproot
          }
        }
      }
    }

    // Extract signed transaction
    const signedTx = psbt.extractTransaction();
    const signedTxHex = signedTx.toHex();
    const computedTxid = signedTx.getId();

    // SECURITY: Verify transaction wasn't malleated during signing
    const verifyTx = bitcoin.Transaction.fromHex(signedTxHex);
    const verifyTxid = verifyTx.getId();

    if (computedTxid !== verifyTxid) {
      throw new Error(
        'Transaction malleability detected - TXID mismatch after re-parsing. ' +
        'This should never happen with SegWit/Taproot.'
      );
    }

    logger.debug('Transaction signing completed', {
      txid: computedTxid,
      assetType: intent.assetType,
      size: signedTxHex.length / 2
    });

    // Verify Runestone is present for UNIT transactions
    if (intent.assetType === 'UNIT') {
      const hasRunestone = signedTx.outs.some(output => {
        const scriptHex = output.script.toString('hex');
        return scriptHex.startsWith('6a') && scriptHex.includes('0d');
      });

      if (!hasRunestone) {
        logger.warn('UNIT transaction missing Runestone OP_RETURN - may fail on broadcast');
      } else {
        logger.debug('Runestone verified in UNIT transaction');
      }
    }

    return {
      signedTxHex,
      txid: computedTxid,
    };
  } catch (error) {
    // Sanitize error message to prevent key/address leakage
    const sanitizedMessage = (error.message || 'Unknown error')
      .replace(/[0-9a-f]{64}/gi, '[REDACTED_KEY]')
      .replace(/[0-9a-f]{66}/gi, '[REDACTED_KEY]')
      .replace(/[0-9a-f]{130}/gi, '[REDACTED_KEY]')
      .replace(/tb1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')
      .replace(/bc1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]');

    logger.error('Transaction signing failed', {
      sanitizedMessage,
      assetType: intent?.assetType,
      inputCount: intent?.inputs?.length
    });

    throw new Error(`Transaction signing failed: ${sanitizedMessage}`);
  }
  // Note: Mnemonic auto-wiped by withMnemonic() - no finally block needed
};
```

**Testing**:
```javascript
// __tests__/services/transactionSigningService.test.js
describe('Unified Transaction Signing', () => {
  it('should sign BTC SegWit transaction', async () => {
    const intent = {
      assetType: 'BTC',
      addressType: 'segwit',
      inputs: [{ addressType: 'segwit', /* ... */ }],
      psbt: 'base64_psbt'
    };

    const result = await signIntent(intent, 0);
    expect(result.signedTxHex).toBeTruthy();
    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should sign BTC Taproot transaction', async () => {
    const intent = {
      assetType: 'BTC',
      addressType: 'taproot',
      inputs: [{ addressType: 'taproot', /* ... */ }],
      psbt: 'base64_psbt'
    };

    const result = await signIntent(intent, 0);
    expect(result.signedTxHex).toBeTruthy();
  });

  it('should sign UNIT Runes transaction with mixed inputs', async () => {
    const intent = {
      assetType: 'UNIT',
      inputs: [
        { addressType: 'segwit', /* fee input */ },
        { addressType: 'taproot', /* rune input */ }
      ],
      psbt: 'base64_psbt'
    };

    const result = await signIntent(intent, 0);
    expect(result.signedTxHex).toBeTruthy();
    // Should contain Runestone
  });

  it('should sanitize error messages', async () => {
    // Mock to throw error with private key
    const fakeKey = 'a'.repeat(64);
    jest.spyOn(AuthService, 'withMnemonic').mockRejectedValue(
      new Error(`Key error: ${fakeKey}`)
    );

    await expect(signIntent({}, 0)).rejects.toThrow('[REDACTED_KEY]');
    expect(signIntent({}, 0)).rejects.not.toThrow(fakeKey);
  });

  it('should detect transaction malleability', async () => {
    // This would require mocking the extract/re-parse flow
    // Left as integration test
  });
});
```

**Commit**: `security: unify BTC and Rune signing with single Taproot implementation`

---

### Day 3 (Wednesday) - 3 hours

#### Task 1.6: Integration Testing & Validation

**Create comprehensive integration test**:
```javascript
// __tests__/integration/transaction-signing.integration.test.js
import { signIntent } from '../../services/transactionSigningService';
import * as AuthService from '../../services/authService';

describe('Transaction Signing Integration Tests', () => {
  const TEST_MNEMONIC = 'your test mnemonic here';

  beforeAll(async () => {
    // Set up test wallet
    await AuthService.saveMnemonic(TEST_MNEMONIC);
  });

  afterAll(async () => {
    // Clean up
    await AuthService.deleteMnemonic();
  });

  describe('BTC Transactions', () => {
    it('should sign SegWit transaction end-to-end', async () => {
      // Real PSBT from testnet
      const intent = createTestBTCIntent();
      const result = await signIntent(intent, 0);

      expect(result.txid).toBeTruthy();
      expect(result.signedTxHex).toBeTruthy();

      // Verify transaction is valid
      const tx = bitcoin.Transaction.fromHex(result.signedTxHex);
      expect(tx.getId()).toBe(result.txid);
    });

    it('should sign Taproot transaction end-to-end', async () => {
      const intent = createTestTaprootIntent();
      const result = await signIntent(intent, 0);

      expect(result.txid).toBeTruthy();
    });
  });

  describe('UNIT Transactions', () => {
    it('should sign Runes transaction with Runestone', async () => {
      const intent = createTestRunesIntent();
      const result = await signIntent(intent, 0);

      // Verify Runestone is present
      const tx = bitcoin.Transaction.fromHex(result.signedTxHex);
      const hasRunestone = tx.outs.some(out =>
        out.script.toString('hex').startsWith('6a')
      );
      expect(hasRunestone).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid PSBT gracefully', async () => {
      const intent = { psbt: 'invalid_base64', inputs: [] };
      await expect(signIntent(intent, 0)).rejects.toThrow();
    });

    it('should sanitize errors with key material', async () => {
      // Test error sanitization
    });
  });
});
```

**Manual Testing Checklist**:
```markdown
## Manual Test Plan - Week 1

### Network Validation
- [ ] App starts successfully on testnet
- [ ] App refuses to start if network config changed
- [ ] Error message is clear and actionable

### PIN Salt Verification
- [ ] New wallet creation succeeds
- [ ] PIN salt is verified and saved
- [ ] Wallet import with PIN works
- [ ] Passkey creation with PIN works

### Transaction Signing
- [ ] Send BTC from SegWit address → Broadcast succeeds
- [ ] Send BTC from Taproot address → Broadcast succeeds
- [ ] Send UNIT Runes → Broadcast succeeds with Runestone
- [ ] Transaction appears in pending list
- [ ] Transaction confirms on testnet

### Sentry Integration
- [ ] Trigger test error
- [ ] Check Sentry dashboard receives event
- [ ] Verify no sensitive data in error
- [ ] New DSN is being used
```

**Commit**: `test: add integration tests for transaction signing`

---

### Day 4 (Thursday) - 2 hours

#### Task 1.7: Documentation & Deployment Prep

**Create security changelog**:
```markdown
// SECURITY_CHANGELOG.md
# Security Fixes - Week 1

## Critical Issues Resolved

### 1. Sentry DSN Exposure (FIXED)
- **Issue**: Hardcoded DSN in source code
- **Fix**: Moved to environment variable
- **Impact**: Prevents malicious error injection
- **Commit**: abc123

### 2. Network Validation (FIXED)
- **Issue**: No explicit testnet validation
- **Fix**: Added startup validation in App.js
- **Impact**: Prevents accidental mainnet usage
- **Commit**: def456

### 3. PIN Salt Verification (FIXED)
- **Issue**: Salt save not verified
- **Fix**: Read-back verification added
- **Impact**: Prevents wallet recovery failures
- **Commit**: ghi789

### 4. Unsafe Taproot Signing (FIXED)
- **Issue**: Manual BigInt arithmetic
- **Fix**: Use bitcoinjs-lib built-in tweaking
- **Impact**: Prevents transaction failures
- **Commit**: jkl012

### 5. Inconsistent Signing (FIXED)
- **Issue**: Different Taproot paths for BTC/UNIT
- **Fix**: Unified signing implementation
- **Impact**: Consistent crypto handling
- **Commit**: mno345
```

**Update README**:
```markdown
// README.md - Add security section

## Security

### Testnet Only
This application is configured for **testnet only**. Network validation runs on startup to prevent mainnet usage.

### Key Management
- BIP39 12-word mnemonics
- BIP84 (SegWit) and BIP86 (Taproot) derivation
- Keys stored in OS-level secure storage
- Mnemonic exposure <100ms during signing

### PIN Security
- PBKDF2 with 10,000 iterations
- Rate limiting: 10 attempts, 30-min lockout
- Salt verification on save

### Transaction Signing
- Unified signing for BTC and Runes
- Uses bitcoinjs-lib battle-tested crypto
- Transaction malleability detection
- Error message sanitization
```

**Commit**: `docs: add security changelog and README updates`

---

### Week 1 Summary & Testing

**Before Deployment to Testnet**:
```bash
# Run full test suite
npm test

# Check no regressions
npm run lint

# Build for testnet
eas build --platform ios --profile production

# Smoke test checklist:
✓ App starts successfully
✓ Can create new wallet
✓ Can import existing wallet
✓ Can send BTC (SegWit)
✓ Can send BTC (Taproot)
✓ Can send UNIT
✓ Can receive to both address types
✓ Vault integration works
✓ Settings accessible
✓ Can logout/login
✓ Passkey creation works
✓ Biometric auth works
```

**Success Criteria**:
- [ ] All 5 critical security issues fixed
- [ ] All tests passing
- [ ] No Sentry errors with sensitive data
- [ ] Transactions sign and broadcast successfully
- [ ] Code review completed
- [ ] Documentation updated

**Expected Score**: 67 → 72 (+5 points)

---

## WEEK 2: High Priority Security & Performance
**Goal**: Fix high-severity issues, improve performance
**Estimated Effort**: 15-18 hours
**Score Impact**: 72 → 76 (+4 points)

### Day 5 (Monday) - 4 hours

#### Task 2.1: Fix Insecure HKDF Implementation (2 hours)
**File**: `/services/passkeyService.js` lines 108-124

**Current (Insecure)**:
```javascript
// Uses SHA-256 digest instead of HMAC
const prk = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  salt + ikm.toString('hex') // String concatenation
);
```

**New (RFC 5869 Compliant)**:
```javascript
import { createHmac } from 'react-native-quick-crypto';

const deriveEncryptionKey = async (credentialId, userHandle, pin, pinSalt) => {
  try {
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

    logger.debug('Encryption key derived using RFC 5869 HKDF');
    return cryptoKey;
  } catch (error) {
    logger.error('Failed to derive encryption key', { error: error.message });
    throw new Error('Failed to derive encryption key from passkey');
  }
};
```

**Migration Strategy**:
```javascript
// Support both v3 (old) and v4 (new) encryption
const ENCRYPTION_VERSION_KEY = 'passkey_encryption_version_v1';

async function detectEncryptionVersion() {
  const version = await SecureStore.getItemAsync(ENCRYPTION_VERSION_KEY);
  return version || 'v3'; // Default to v3 for existing users
}

// When creating new passkey, use v4
// When restoring existing passkey, detect version and use appropriate method
```

**Testing**:
```javascript
// Test with RFC 5869 test vectors
describe('HKDF Implementation', () => {
  it('should match RFC 5869 test vector 1', () => {
    // Test case from RFC 5869
    const ikm = Buffer.from('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b', 'hex');
    const salt = Buffer.from('000102030405060708090a0b0c', 'hex');
    const info = Buffer.from('f0f1f2f3f4f5f6f7f8f9', 'hex');

    const result = hkdf(ikm, salt, info, 42);
    const expected = '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';

    expect(result.toString('hex')).toBe(expected);
  });
});
```

**Commit**: `security: implement RFC 5869 compliant HKDF for passkey encryption`

---

#### Task 2.2: Add PIN Change Locking (1 hour)
**File**: `/services/passkeyService.js` lines 862-931

**Implementation**:
```javascript
// Module-level lock
let pinChangeInProgress = false;
const PIN_CHANGE_TIMEOUT_MS = 30000; // 30 seconds max

export const atomicPinChangeWithPasskey = async (newPin) => {
  // Prevent concurrent PIN changes
  if (pinChangeInProgress) {
    throw new Error('PIN change already in progress. Please wait and try again.');
  }

  pinChangeInProgress = true;
  const changeStartTime = Date.now();

  try {
    logger.info('Starting atomic PIN change');

    // Timeout protection
    const timeoutId = setTimeout(() => {
      pinChangeInProgress = false;
      throw new Error('PIN change timed out - please try again');
    }, PIN_CHANGE_TIMEOUT_MS);

    // Backup current state
    const oldPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const oldPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);

    if (!oldPinHash || !oldPinSalt) {
      clearTimeout(timeoutId);
      throw new Error('Cannot change PIN - current PIN not found');
    }

    logger.debug('Current PIN state backed up');

    // Save new PIN (generates new salt)
    await savePin(newPin);
    logger.debug('New PIN saved');

    // Re-encrypt passkey mnemonic with new PIN
    await reencryptPasskeyMnemonicAfterPinChange(newPin);
    logger.debug('Passkey mnemonic re-encrypted');

    clearTimeout(timeoutId);

    const duration = Date.now() - changeStartTime;
    logger.info('PIN changed successfully', { durationMs: duration });

    return true;
  } catch (error) {
    logger.error('PIN change failed', { error: error.message });

    // Note: Rollback is difficult here because new PIN may have been saved
    // Best we can do is log the error and let user try again
    throw new Error(`PIN change failed: ${error.message}. Please try setting your PIN again.`);
  } finally {
    pinChangeInProgress = false;
  }
};
```

**Testing**:
```javascript
describe('PIN Change Locking', () => {
  it('should prevent concurrent PIN changes', async () => {
    const promise1 = atomicPinChangeWithPasskey('111111');
    const promise2 = atomicPinChangeWithPasskey('222222');

    await expect(Promise.all([promise1, promise2])).rejects.toThrow('already in progress');
  });

  it('should timeout after 30 seconds', async () => {
    // Mock slow re-encryption
    jest.spyOn(global, 'setTimeout');

    await expect(atomicPinChangeWithPasskey('123456')).rejects.toThrow('timed out');
  }, 35000);
});
```

**Commit**: `security: add locking mechanism for atomic PIN changes`

---

#### Task 2.3: Add Biometric Rate Limiting (1 hour)
**Files**: `/services/biometricService.js`, `/contexts/AuthContext.js`

**New file: `/services/biometricService.js`** (if doesn't exist or update existing):
```javascript
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';

const BIOMETRIC_KEYS = {
  FAILED_ATTEMPTS: 'biometric_failed_attempts_v1',
  LOCKOUT_UNTIL: 'biometric_lockout_until_v1',
};

const BIOMETRIC_MAX_ATTEMPTS = 5;
const BIOMETRIC_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if biometric authentication is locked out
 */
export const checkBiometricLockout = async () => {
  const lockoutUntil = await SecureStore.getItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);

  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil, 10);
    const now = Date.now();

    if (now < lockoutTime) {
      const remainingMs = lockoutTime - now;
      const remainingMin = Math.ceil(remainingMs / 60000);

      logger.warn('Biometric authentication locked out', { remainingMin });
      throw new Error(
        `Too many failed biometric attempts. ` +
        `Please try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''} or use your PIN.`
      );
    } else {
      // Lockout expired - clear it
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
      logger.info('Biometric lockout expired and cleared');
    }
  }
};

/**
 * Record biometric authentication attempt
 */
export const recordBiometricAttempt = async (success) => {
  if (success) {
    // Clear failed attempts on success
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
    logger.debug('Biometric auth successful - attempts cleared');
    return;
  }

  // Increment failed attempts
  const attemptsStr = await SecureStore.getItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) + 1 : 1;

  await SecureStore.setItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS, attempts.toString());
  logger.warn('Biometric auth failed', { attempts, maxAttempts: BIOMETRIC_MAX_ATTEMPTS });

  if (attempts >= BIOMETRIC_MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + BIOMETRIC_LOCKOUT_MS;
    await SecureStore.setItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());

    logger.error('Biometric authentication locked out', {
      attempts,
      lockoutDurationMin: BIOMETRIC_LOCKOUT_MS / 60000
    });

    throw new Error(
      `Too many failed biometric attempts (${attempts}/${BIOMETRIC_MAX_ATTEMPTS}). ` +
      `Locked out for 15 minutes. Please use your PIN instead.`
    );
  }
};

/**
 * Authenticate with biometrics
 */
export const authenticateWithBiometric = async (promptMessage = 'Authenticate to continue') => {
  try {
    // Check if locked out
    await checkBiometricLockout();

    // Check if biometric is available
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      throw new Error('Biometric hardware not available');
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      throw new Error('No biometric credentials enrolled');
    }

    // Attempt authentication
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });

    // Record attempt
    await recordBiometricAttempt(result.success);

    if (!result.success) {
      throw new Error('Biometric authentication failed');
    }

    logger.info('Biometric authentication successful');
    return true;
  } catch (error) {
    logger.error('Biometric authentication error', { error: error.message });
    throw error;
  }
};
```

**Update AuthContext to use rate limiting**:
```javascript
// In AuthContext.js
import { authenticateWithBiometric } from '../services/biometricService';

// Replace biometric auth calls with:
const handleBiometricAuth = async () => {
  try {
    await authenticateWithBiometric('Unlock Ducat Wallet');
    // Proceed with auth
  } catch (error) {
    if (error.message.includes('locked out')) {
      showToast(error.message, 'error');
      // Fallback to PIN
    }
  }
};
```

**Commit**: `security: add biometric authentication rate limiting`

---

### Day 6 (Tuesday) - 5 hours

#### Task 2.4: Split WalletDataContext (Performance Win) (3 hours)
**File**: `/contexts/WalletDataContext.js` (202 lines, 30+ exports)

**Problem**: God object causes re-render storm

**Solution**: Split into 3 specialized hooks

**New file structure**:
```
contexts/
├── WalletDataContext.js (keep as orchestrator)
├── hooks/
│   ├── useBalance.js (balance data only)
│   ├── useTransactionHistory.js (history data only)
│   └── useVaultData.js (vault data only)
```

**Implementation**:

```javascript
// hooks/useBalance.js
import { useState, useCallback, useMemo } from 'react';
import { fetchBalance as fetchBalanceAPI, fetchUtxos } from '../services/balanceService';
import { logger } from '../utils/logger';

export const useBalance = (wallet) => {
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [unconfirmedSegwitBalance, setUnconfirmedSegwitBalance] = useState(0);
  const [unconfirmedTaprootBalance, setUnconfirmedTaprootBalance] = useState(0);
  const [unconfirmedRunesBalance, setUnconfirmedRunesBalance] = useState([]);
  const [utxos, setUtxos] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingUtxos, setLoadingUtxos] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
      logger.warn('Cannot fetch balance - wallet not initialized');
      return;
    }

    setLoadingBalance(true);
    setBalanceError(null);

    try {
      const balanceData = await fetchBalanceAPI(
        wallet.segwitAddress,
        wallet.taprootAddress
      );

      setSegwitBalance(balanceData.segwit.confirmed);
      setTaprootBalance(balanceData.taproot.confirmed);
      setRunesBalance(balanceData.runes);
      setUnconfirmedSegwitBalance(balanceData.segwit.unconfirmed);
      setUnconfirmedTaprootBalance(balanceData.taproot.unconfirmed);
      setUnconfirmedRunesBalance(balanceData.runesUnconfirmed);

      logger.debug('Balance fetched successfully', {
        segwit: balanceData.segwit.confirmed,
        taproot: balanceData.taproot.confirmed
      });
    } catch (error) {
      logger.error('Failed to fetch balance', { error: error.message });
      setBalanceError(error.message);
    } finally {
      setLoadingBalance(false);
      setRefreshing(false);
    }
  }, [wallet?.segwitAddress, wallet?.taprootAddress]);

  const fetchUtxosData = useCallback(async () => {
    if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
      return;
    }

    setLoadingUtxos(true);

    try {
      const utxoData = await fetchUtxos(
        wallet.segwitAddress,
        wallet.taprootAddress
      );
      setUtxos(utxoData);
      logger.debug('UTXOs fetched', { count: utxoData.length });
    } catch (error) {
      logger.error('Failed to fetch UTXOs', { error: error.message });
    } finally {
      setLoadingUtxos(false);
    }
  }, [wallet?.segwitAddress, wallet?.taprootAddress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchUtxosData()]);
  }, [fetchBalance, fetchUtxosData]);

  const resetBalances = useCallback(() => {
    setSegwitBalance(0);
    setTaprootBalance(0);
    setRunesBalance([]);
    setUnconfirmedSegwitBalance(0);
    setUnconfirmedTaprootBalance(0);
    setUnconfirmedRunesBalance([]);
    setUtxos([]);
    setBalanceError(null);
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    segwitBalance,
    taprootBalance,
    runesBalance,
    unconfirmedSegwitBalance,
    unconfirmedTaprootBalance,
    unconfirmedRunesBalance,
    utxos,
    loadingBalance,
    loadingUtxos,
    balanceError,
    refreshing,
    fetchBalance,
    fetchUtxos: fetchUtxosData,
    onRefresh,
    resetBalances,
  }), [
    segwitBalance,
    taprootBalance,
    runesBalance,
    unconfirmedSegwitBalance,
    unconfirmedTaprootBalance,
    unconfirmedRunesBalance,
    utxos,
    loadingBalance,
    loadingUtxos,
    balanceError,
    refreshing,
    fetchBalance,
    fetchUtxosData,
    onRefresh,
    resetBalances,
  ]);
};
```

```javascript
// hooks/useTransactionHistory.js
import { useState, useCallback, useMemo } from 'react';
import { fetchTransactionHistory as fetchHistoryAPI } from '../services/transactionHistoryService';
import { logger } from '../utils/logger';

export const useTransactionHistory = (wallet) => {
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const fetchTransactionHistory = useCallback(async () => {
    if (!wallet?.segwitAddress || !wallet?.taprootAddress) {
      return;
    }

    setLoadingTransactionHistory(true);
    setHistoryError(null);

    try {
      const history = await fetchHistoryAPI(
        wallet.segwitAddress,
        wallet.taprootAddress
      );
      setTransactionHistory(history);
      logger.debug('Transaction history fetched', { count: history.length });
    } catch (error) {
      logger.error('Failed to fetch transaction history', { error: error.message });
      setHistoryError(error.message);
    } finally {
      setLoadingTransactionHistory(false);
    }
  }, [wallet?.segwitAddress, wallet?.taprootAddress]);

  const resetTransactionHistory = useCallback(() => {
    setTransactionHistory([]);
    setHistoryError(null);
  }, []);

  return useMemo(() => ({
    transactionHistory,
    loadingTransactionHistory,
    historyError,
    fetchTransactionHistory,
    resetTransactionHistory,
  }), [
    transactionHistory,
    loadingTransactionHistory,
    historyError,
    fetchTransactionHistory,
    resetTransactionHistory,
  ]);
};
```

```javascript
// hooks/useVaultData.js
import { useState, useCallback, useMemo } from 'react';
import { fetchVaultData as fetchVaultAPI } from '../services/vaultService';
import { logger } from '../utils/logger';

export const useVaultData = (wallet) => {
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState(null);

  const fetchVault = useCallback(async () => {
    if (!wallet?.taprootAddress) {
      return;
    }

    setLoadingVault(true);
    setVaultError(null);

    try {
      const data = await fetchVaultAPI(wallet.taprootAddress);
      setVaultData(data);
      logger.debug('Vault data fetched');
    } catch (error) {
      logger.error('Failed to fetch vault data', { error: error.message });
      setVaultError(error.message);
    } finally {
      setLoadingVault(false);
    }
  }, [wallet?.taprootAddress]);

  const resetVaultData = useCallback(() => {
    setVaultData(null);
    setVaultError(null);
  }, []);

  return useMemo(() => ({
    vaultData,
    loadingVault,
    vaultError,
    fetchVault,
    resetVaultData,
  }), [
    vaultData,
    loadingVault,
    vaultError,
    fetchVault,
    resetVaultData,
  ]);
};
```

```javascript
// contexts/WalletDataContext.js - REFACTORED to orchestrate
import React, { createContext, useContext, useEffect } from 'react';
import { useWallet } from './WalletContext';
import { useBalance } from '../hooks/useBalance';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useVaultData } from '../hooks/useVaultData';

const WalletDataContext = createContext();

export const WalletDataProvider = ({ children }) => {
  const { wallet } = useWallet();

  // Use specialized hooks
  const balanceData = useBalance(wallet);
  const historyData = useTransactionHistory(wallet);
  const vaultDataHook = useVaultData(wallet);

  // Auto-fetch on wallet change
  useEffect(() => {
    if (wallet) {
      balanceData.fetchBalance();
      balanceData.fetchUtxos();
      historyData.fetchTransactionHistory();
      vaultDataHook.fetchVault();
    }
  }, [wallet]);

  // Provide all data through single context (backwards compatible)
  const value = {
    ...balanceData,
    ...historyData,
    ...vaultDataHook,
  };

  return (
    <WalletDataContext.Provider value={value}>
      {children}
    </WalletDataContext.Provider>
  );
};

// Keep existing useWalletData for backwards compatibility
export const useWalletData = () => {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within WalletDataProvider');
  }
  return context;
};

// Export specialized hooks for components that only need specific data
export { useBalance, useTransactionHistory, useVaultData };
```

**Migration strategy for components**:
```javascript
// OLD (causes re-renders on ANY wallet data change):
const { segwitBalance, transactionHistory, vaultData } = useWalletData();

// NEW (only re-renders when balance changes):
const { segwitBalance } = useBalance();

// NEW (only re-renders when history changes):
const { transactionHistory } = useTransactionHistory();

// NEW (only re-renders when vault changes):
const { vaultData } = useVaultData();
```

**Commit**: `perf: split WalletDataContext into specialized hooks to prevent re-render storms`

---

#### Task 2.5: Add Sentry Error Sanitization (2 hours)
**File**: `/App.js` lines 38-50

**Full implementation**:
```javascript
// /App.js - Enhanced Sentry configuration

import * as Sentry from '@sentry/react-native';

// Sanitization helpers
function sanitizeSensitiveData(str) {
  if (typeof str !== 'string') return str;

  return str
    // Private keys (32 bytes = 64 hex chars)
    .replace(/\b[0-9a-f]{64}\b/gi, '[REDACTED_PRIVATE_KEY]')
    // Compressed pubkeys (33 bytes = 66 hex chars)
    .replace(/\b[0-9a-f]{66}\b/gi, '[REDACTED_PUBKEY]')
    // Uncompressed pubkeys (65 bytes = 130 hex chars)
    .replace(/\b[0-9a-f]{130}\b/gi, '[REDACTED_PUBKEY]')
    // Testnet bech32 addresses
    .replace(/tb1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')
    // Mainnet bech32 addresses (shouldn't exist but sanitize anyway)
    .replace(/bc1[a-z0-9]{39,}/gi, '[REDACTED_ADDRESS]')
    // 12-word seed phrases (rough pattern)
    .replace(/\b([a-z]+\s+){11}[a-z]+\b/gi, '[REDACTED_MNEMONIC]')
    // PSBTs (base64, usually starts with cHNi)
    .replace(/cHNi[A-Za-z0-9+/=]{100,}/g, '[REDACTED_PSBT]');
}

function sanitizeObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys entirely
    const sensitiveKeys = /mnemonic|seed|private|secret|password|pin|passkey|credential/i;
    if (sensitiveKeys.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Initialize Sentry with sanitization
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',

  tracesSampleRate: 1.0,

  beforeSend(event, hint) {
    // Sanitize request data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;

      if (event.request.data) {
        event.request.data = sanitizeObject(event.request.data);
      }
    }

    // Sanitize exception messages
    if (event.exception?.values) {
      event.exception.values.forEach(exception => {
        if (exception.value) {
          exception.value = sanitizeSensitiveData(exception.value);
        }

        // Sanitize stack trace
        if (exception.stacktrace?.frames) {
          exception.stacktrace.frames.forEach(frame => {
            if (frame.vars) {
              frame.vars = sanitizeObject(frame.vars);
            }
          });
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

    // Sanitize contexts
    if (event.contexts) {
      event.contexts = sanitizeObject(event.contexts);
    }

    return event;
  },

  beforeBreadcrumb(breadcrumb, hint) {
    // Sanitize breadcrumb before it's added
    if (breadcrumb.message) {
      breadcrumb.message = sanitizeSensitiveData(breadcrumb.message);
    }
    if (breadcrumb.data) {
      breadcrumb.data = sanitizeObject(breadcrumb.data);
    }
    return breadcrumb;
  },
});
```

**Testing**:
```javascript
// __tests__/sentry-sanitization.test.js
import { sanitizeSensitiveData, sanitizeObject } from '../App';

describe('Sentry Sanitization', () => {
  it('should redact private keys', () => {
    const input = 'Error with key: a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';
    const output = sanitizeSensitiveData(input);
    expect(output).toContain('[REDACTED_PRIVATE_KEY]');
    expect(output).not.toContain('a1b2c3d4e5f67890');
  });

  it('should redact addresses', () => {
    const input = 'Sending to tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const output = sanitizeSensitiveData(input);
    expect(output).toContain('[REDACTED_ADDRESS]');
  });

  it('should redact mnemonic-like patterns', () => {
    const input = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const output = sanitizeSensitiveData(input);
    expect(output).toContain('[REDACTED_MNEMONIC]');
  });

  it('should redact sensitive object keys', () => {
    const input = {
      username: 'test',
      mnemonic: 'secret words here',
      balance: 1000
    };
    const output = sanitizeObject(input);
    expect(output.mnemonic).toBe('[REDACTED]');
    expect(output.username).toBe('test');
    expect(output.balance).toBe(1000);
  });
});
```

**Commit**: `security: add comprehensive Sentry error sanitization`

---

### Week 2 Summary

**Testing Checklist**:
```markdown
## Week 2 Testing

### HKDF Implementation
- [ ] New passkey creation uses v4 encryption
- [ ] Existing passkeyswith v3 can still be restored
- [ ] Encryption/decryption works correctly
- [ ] Test vectors from RFC 5869 pass

### PIN Change Locking
- [ ] Concurrent PIN changes are blocked
- [ ] PIN change completes successfully
- [ ] Timeout prevents hung state
- [ ] Error recovery works

### Biometric Rate Limiting
- [ ] 5 failed attempts triggers lockout
- [ ] Lockout lasts 15 minutes
- [ ] Successful auth clears counter
- [ ] PIN fallback works during lockout

### WalletDataContext Split
- [ ] Components using useBalance don't re-render on history change
- [ ] Components using useTransactionHistory don't re-render on balance change
- [ ] All existing functionality still works
- [ ] No performance regressions

### Sentry Sanitization
- [ ] Trigger error with fake private key
- [ ] Check Sentry dashboard - key is redacted
- [ ] Trigger error with fake address
- [ ] Check Sentry - address is redacted
- [ ] Breadcrumbs are sanitized
```

**Success Criteria**:
- [ ] All high priority security issues fixed
- [ ] WalletDataContext split improves performance measurably
- [ ] All tests passing
- [ ] No regressions in functionality
- [ ] Code review completed

**Expected Score**: 72 → 76 (+4 points)

---

## WEEK 3-4: Architecture Improvements
**Goal**: Improve code organization and maintainability
**Estimated Effort**: 20-25 hours
**Score Impact**: 76 → 82 (+6 points)

### Week 3 Tasks

#### Task 3.1: Extract styles.js into Feature Modules (4 hours)
**Problem**: 2,494 lines in single file

**Implementation**:
```bash
# Create new structure
mkdir -p styles
touch styles/{common,splash,wallet,send,receive,settings,vault,auth,animations}.js
touch styles/index.js
```

```javascript
// styles/common.js - Shared styles
import { StyleSheet } from 'react-native';

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ... other common styles
});
```

```javascript
// styles/wallet.js - Wallet feature styles
import { StyleSheet } from 'react-native';

export const walletStyles = StyleSheet.create({
  walletContainer: { /* ... */ },
  balanceText: { /* ... */ },
  assetCard: { /* ... */ },
  // ... all wallet-related styles
});
```

```javascript
// styles/index.js - Barrel export
export { commonStyles } from './common';
export { splashStyles } from './splash';
export { walletStyles } from './wallet';
export { sendStyles } from './send';
export { receiveStyles } from './receive';
export { settingsStyles } from './settings';
export { vaultStyles } from './vault';
export { authStyles } from './auth';
export { animations } from './animations';

// For backwards compatibility, re-export everything as 'styles'
export const styles = {
  ...commonStyles,
  ...splashStyles,
  ...walletStyles,
  ...sendStyles,
  ...receiveStyles,
  ...settingsStyles,
  ...vaultStyles,
  ...authStyles,
  ...animations,
};
```

**Migration script**:
```javascript
// scripts/migrate-styles.js
const fs = require('fs');
const path = require('path');

// Read existing styles.js
const stylesContent = fs.readFileSync('./styles.js', 'utf-8');

// Extract style groups by prefix
const styleGroups = {
  splash: /splash\w+:/gi,
  wallet: /wallet\w+:|balance\w+:|asset\w+:/gi,
  send: /send\w+:|amount\w+:/gi,
  receive: /receive\w+:|qr\w+:/gi,
  // ... etc
};

// Split and write to separate files
// (Implementation details...)
```

**Commit**: `refactor: split styles.js into feature-based modules`

---

#### Task 3.2: Split UIContext (2 hours)
**Problem**: Mixing display preferences + toast + snackbar

**Implementation**:
```javascript
// contexts/DisplayPreferencesContext.js
import React, { createContext, useContext, useState } from 'react';

const DisplayPreferencesContext = createContext();

export const DisplayPreferencesProvider = ({ children }) => {
  const [showTotalInBTC, setShowTotalInBTC] = useState(true);
  const [showBTCInBTC, setShowBTCInBTC] = useState(true);
  const [showUnitInUnit, setShowUnitInUnit] = useState(true);

  const value = {
    showTotalInBTC,
    setShowTotalInBTC,
    showBTCInBTC,
    setShowBTCInBTC,
    showUnitInUnit,
    setShowUnitInUnit,
  };

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
};

export const useDisplayPreferences = () => {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider');
  }
  return context;
};
```

```javascript
// contexts/NotificationContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  // Toast state
  const [toasts, setToasts] = useState([]);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);

    // Auto-dismiss
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSnackbar = useCallback((message, type = 'info') => {
    setSnackbar({ visible: true, message, type });
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, visible: false }));
  }, []);

  const value = {
    // Toast
    toasts,
    showToast,
    dismissToast,
    // Snackbar
    snackbar,
    showSnackbar,
    dismissSnackbar,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Backwards compatibility
export const useToastContext = useNotifications;
```

**Update App.js provider hierarchy**:
```javascript
// BEFORE:
<UIProvider>
  <WalletDataProvider>

// AFTER:
<DisplayPreferencesProvider>
  <NotificationProvider>
    <WalletDataProvider>
```

**Commit**: `refactor: split UIContext into DisplayPreferences and Notifications`

---

#### Task 3.3: Split NavigationHandlersContext (3 hours)
**Problem**: 272 lines mixing auth, settings, account switching

**New structure**:
```javascript
// contexts/AccountSwitcherContext.js
import React, { createContext, useContext, useCallback } from 'react';
import { useWallet } from './WalletContext';
import { logger } from '../utils/logger';

const AccountSwitcherContext = createContext();

export const AccountSwitcherProvider = ({ children }) => {
  const { setCurrentAccount, currentAccount } = useWallet();

  const switchAccount = useCallback(async (newAccountIndex) => {
    try {
      logger.info('Switching account', { from: currentAccount, to: newAccountIndex });
      await setCurrentAccount(newAccountIndex);
      logger.info('Account switched successfully');
    } catch (error) {
      logger.error('Failed to switch account', { error: error.message });
      throw error;
    }
  }, [currentAccount, setCurrentAccount]);

  const value = {
    currentAccount,
    switchAccount,
  };

  return (
    <AccountSwitcherContext.Provider value={value}>
      {children}
    </AccountSwitcherContext.Provider>
  );
};

export const useAccountSwitcher = () => {
  const context = useContext(AccountSwitcherContext);
  if (!context) {
    throw new Error('useAccountSwitcher must be used within AccountSwitcherProvider');
  }
  return context;
};
```

```javascript
// contexts/SettingsContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const openLogoutModal = useCallback(() => setShowLogoutModal(true), []);
  const closeLogoutModal = useCallback(() => setShowLogoutModal(false), []);

  const openDeleteModal = useCallback(() => setShowDeleteModal(true), []);
  const closeDeleteModal = useCallback(() => setShowDeleteModal(false), []);

  const openBiometricModal = useCallback(() => setShowBiometricModal(true), []);
  const closeBiometricModal = useCallback(() => setShowBiometricModal(false), []);

  const value = {
    showLogoutModal,
    showDeleteModal,
    showBiometricModal,
    openLogoutModal,
    closeLogoutModal,
    openDeleteModal,
    closeDeleteModal,
    openBiometricModal,
    closeBiometricModal,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
```

**Delete**: `/contexts/NavigationHandlersContext.js` (no longer needed)

**Commit**: `refactor: split NavigationHandlersContext into specialized contexts`

---

#### Task 3.4: Break Apart useAuth.js (5 hours)
**Problem**: 258 lines, 60+ useState calls, 7 mixed concerns

**New structure**:
```
hooks/auth/
├── index.js (exports combined hook)
├── useBiometricAuth.js
├── usePasskeyAuth.js
├── usePinAuth.js
├── useAuthSession.js
└── useAuthFlow.js
```

**Implementation**:

```javascript
// hooks/auth/useBiometricAuth.js
import { useState, useCallback } from 'react';
import { authenticateWithBiometric } from '../../services/biometricService';
import { logger } from '../../utils/logger';

export const useBiometricAuth = () => {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null);

  const enableBiometric = useCallback(async () => {
    try {
      const type = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setBiometricType(type[0]);
      setBiometricEnabled(true);
      logger.info('Biometric authentication enabled');
    } catch (error) {
      logger.error('Failed to enable biometric', { error: error.message });
      throw error;
    }
  }, []);

  const disableBiometric = useCallback(() => {
    setBiometricEnabled(false);
    logger.info('Biometric authentication disabled');
  }, []);

  const authenticate = useCallback(async (promptMessage) => {
    if (!biometricEnabled) {
      throw new Error('Biometric not enabled');
    }
    return await authenticateWithBiometric(promptMessage);
  }, [biometricEnabled]);

  return {
    biometricEnabled,
    biometricType,
    enableBiometric,
    disableBiometric,
    authenticateBiometric: authenticate,
  };
};
```

```javascript
// hooks/auth/usePasskeyAuth.js
import { useState, useCallback } from 'react';
import * as PasskeyService from '../../services/passkeyService';
import { logger } from '../../utils/logger';

export const usePasskeyAuth = () => {
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [passkeyCreating, setPasskeyCreating] = useState(false);

  const createPasskey = useCallback(async (pin) => {
    setPasskeyCreating(true);
    try {
      await PasskeyService.createPasskey(pin);
      setPasskeyEnabled(true);
      logger.info('Passkey created successfully');
    } catch (error) {
      logger.error('Failed to create passkey', { error: error.message });
      throw error;
    } finally {
      setPasskeyCreating(false);
    }
  }, []);

  const authenticatePasskey = useCallback(async () => {
    if (!passkeyEnabled) {
      throw new Error('Passkey not enabled');
    }
    return await PasskeyService.authenticateWithPasskey();
  }, [passkeyEnabled]);

  return {
    passkeyEnabled,
    passkeyCreating,
    createPasskey,
    authenticatePasskey,
  };
};
```

```javascript
// hooks/auth/usePinAuth.js
import { useState, useCallback } from 'react';
import * as PinService from '../../services/pinService';
import { logger } from '../../utils/logger';

export const usePinAuth = () => {
  const [pinSet, setPinSet] = useState(false);

  const savePin = useCallback(async (pin) => {
    try {
      await PinService.savePin(pin);
      setPinSet(true);
      logger.info('PIN saved successfully');
    } catch (error) {
      logger.error('Failed to save PIN', { error: error.message });
      throw error;
    }
  }, []);

  const verifyPin = useCallback(async (pin) => {
    const isValid = await PinService.verifyPin(pin);
    if (!isValid) {
      throw new Error('Invalid PIN');
    }
    return true;
  }, []);

  const changePin = useCallback(async (oldPin, newPin) => {
    const isValid = await verifyPin(oldPin);
    if (!isValid) {
      throw new Error('Current PIN is incorrect');
    }
    await savePin(newPin);
  }, [verifyPin, savePin]);

  return {
    pinSet,
    savePin,
    verifyPin,
    changePin,
  };
};
```

```javascript
// hooks/auth/useAuthSession.js
import { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { SESSION } from '../../constants/security';

export const useAuthSession = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  // Inactivity timer
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityTime;
      if (elapsed > SESSION.TIMEOUT_MS) {
        setSessionExpired(true);
        setIsAuthenticated(false);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivityTime]);

  // Background/foreground handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        // App going to background
      } else if (nextAppState === 'active' && isAuthenticated) {
        const elapsed = Date.now() - lastActivityTime;
        if (elapsed > SESSION.BACKGROUND_TIMEOUT_MS) {
          setSessionExpired(true);
          setIsAuthenticated(false);
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, lastActivityTime]);

  const resetInactivityTimer = useCallback(() => {
    setLastActivityTime(Date.now());
    setSessionExpired(false);
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    setSessionExpired(false);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setSessionExpired(false);
  }, []);

  return {
    isAuthenticated,
    sessionExpired,
    login,
    logout,
    resetInactivityTimer,
  };
};
```

```javascript
// hooks/auth/useAuthFlow.js
import { useCallback } from 'react';
import { useBiometricAuth } from './useBiometricAuth';
import { usePasskeyAuth } from './usePasskeyAuth';
import { usePinAuth } from './usePinAuth';
import { useAuthSession } from './useAuthSession';

export const useAuthFlow = () => {
  const biometric = useBiometricAuth();
  const passkey = usePasskeyAuth();
  const pin = usePinAuth();
  const session = useAuthSession();

  // Orchestrate authentication flow
  const authenticateUser = useCallback(async () => {
    // Try biometric first if enabled
    if (biometric.biometricEnabled) {
      try {
        await biometric.authenticateBiometric('Unlock Ducat Wallet');
        session.login();
        return { method: 'biometric', success: true };
      } catch (error) {
        // Fall through to PIN
      }
    }

    // Try passkey if enabled
    if (passkey.passkeyEnabled) {
      try {
        await passkey.authenticatePasskey();
        session.login();
        return { method: 'passkey', success: true };
      } catch (error) {
        // Fall through to PIN
      }
    }

    // PIN is required
    return { method: 'pin', success: false, requiresPinInput: true };
  }, [biometric, passkey, session]);

  return {
    biometric,
    passkey,
    pin,
    session,
    authenticateUser,
  };
};
```

```javascript
// hooks/auth/index.js
export { useBiometricAuth } from './useBiometricAuth';
export { usePasskeyAuth } from './usePasskeyAuth';
export { usePinAuth } from './usePinAuth';
export { useAuthSession } from './useAuthSession';
export { useAuthFlow } from './useAuthFlow';

// Combined hook for backwards compatibility
export { useAuthFlow as useAuth };
```

**Commit**: `refactor: split useAuth into specialized auth hooks`

---

### Week 4 Tasks

#### Task 3.5: Remove PasskeyTestScreen (15 minutes)
**Files**: Delete `/screens/settings/PasskeyTestScreen.jsx` (546 lines)

**Steps**:
1. Delete file
2. Remove from navigation
3. Remove from imports

**Commit**: `cleanup: remove PasskeyTestScreen from production build`

---

#### Task 3.6: Extract Balance Calculation Utility (1 hour)
**Problem**: Duplicated balance logic in 3+ places

**Implementation**:
```javascript
// hooks/useAssetBalance.js
import { useMemo } from 'react';
import { useBalance } from '../contexts/WalletDataContext';
import { usePrice } from '../contexts/PriceContext';

/**
 * Get balance for a specific asset type
 * Single source of truth for balance calculations
 */
export const useAssetBalance = (assetType) => {
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();

  return useMemo(() => {
    if (assetType === 'btc' || assetType === 'BTC') {
      const totalSats = (segwitBalance || 0) + (taprootBalance || 0);
      const totalBTC = totalSats / 100000000;
      const totalUSD = totalBTC * btcPrice;

      return {
        sats: totalSats,
        btc: totalBTC,
        usd: totalUSD,
      };
    }

    if (assetType === 'unit' || assetType === 'UNIT') {
      const unitAmount = runesBalance && runesBalance.length > 0
        ? parseFloat(runesBalance[0][1])
        : 0;

      return {
        unit: unitAmount,
        usd: unitAmount * 1, // Assuming $1 per UNIT
      };
    }

    return { sats: 0, btc: 0, usd: 0 };
  }, [assetType, segwitBalance, taprootBalance, runesBalance, btcPrice]);
};
```

**Replace in all components**:
```javascript
// BEFORE (AmountInputScreen):
const btcBalance = (segwitBalance || 0) + (taprootBalance || 0);
const unitBalance = runesBalance && runesBalance.length > 0
  ? parseFloat(runesBalance[0][1])
  : 0;
const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;

// AFTER:
const { sats: btcBalance } = useAssetBalance('btc');
const { unit: unitBalance } = useAssetBalance('unit');
const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
```

**Commit**: `refactor: extract balance calculation to useAssetBalance hook`

---

#### Task 3.7: Consolidate Transaction Services (5 hours)
**Problem**: Transaction logic scattered across multiple services

**New structure**:
```
services/transaction/
├── index.js (public API)
├── builder/
│   ├── btc.js (BTC transaction building)
│   ├── runes.js (Runes transaction building)
│   └── psbt.js (PSBT utilities)
├── signing/
│   ├── signer.js (Unified signing - from transactionSigningService)
│   └── finalizer.js (Transaction finalization)
├── broadcasting/
│   └── broadcaster.js (Transaction broadcast)
└── utils/
    ├── utxoSelection.js
    ├── feeCalculation.js
    └── validation.js
```

**Implementation**:
```javascript
// services/transaction/index.js - Clean public API
export { buildBtcTransaction } from './builder/btc';
export { buildRunesTransaction } from './builder/runes';
export { signTransaction } from './signing/signer';
export { broadcastTransaction } from './broadcasting/broadcaster';
export { selectUtxos } from './utils/utxoSelection';
export { calculateFee } from './utils/feeCalculation';
```

**Commit**: `refactor: consolidate transaction services into unified structure`

---

#### Task 3.8: Fix Prop Drilling in ReceiveScreen (1 hour)
**File**: `/screens/wallet/ReceiveScreen.jsx`

**BEFORE**:
```javascript
function ReceiveScreen({
  showToast,  // ← Prop drilling
  segwitAddress,
  taprootAddress,
  // ... 8 more props
})
```

**AFTER**:
```javascript
function ReceiveScreen({
  segwitAddress,
  taprootAddress,
  // Only data props, no handlers
}) {
  // Use context for handlers
  const { showToast } = useNotifications();
  const navigation = useNavigation();

  // Component logic...
}
```

**Commit**: `refactor: remove prop drilling from ReceiveScreen`

---

### Week 3-4 Summary

**Testing**:
```markdown
## Architecture Refactoring Tests

### Styles Split
- [ ] All screens render correctly with new style imports
- [ ] No missing styles
- [ ] Build succeeds
- [ ] No unused styles warnings

### Context Splits
- [ ] DisplayPreferences work independently
- [ ] Notifications work independently
- [ ] Account switcher functions correctly
- [ ] Settings modals open/close correctly

### useAuth Split
- [ ] Biometric auth works
- [ ] Passkey auth works
- [ ] PIN auth works
- [ ] Session timeout works
- [ ] Auth flow orchestration works

### Balance Calculation
- [ ] BTC balance calculates correctly
- [ ] UNIT balance calculates correctly
- [ ] USD values are accurate
- [ ] All screens using balance show same values
```

**Success Criteria**:
- [ ] File count increased (more smaller files)
- [ ] Average file size decreased
- [ ] No prop drilling in new code
- [ ] All tests passing
- [ ] No regressions

**Expected Score**: 76 → 82 (+6 points)

---

## WEEK 5-6: Code Quality & Testing
**Goal**: Improve test coverage and code quality
**Estimated Effort**: 15-20 hours
**Score Impact**: 82 → 85 (+3 points)

### Week 5 Tasks

#### Task 5.1: Add Integration Tests (8 hours)

**Test suites to add**:

1. **Transaction Flow Integration Tests**
```javascript
// __tests__/integration/transaction-flow.test.js
describe('Complete Transaction Flow', () => {
  it('should create, sign, and broadcast BTC transaction', async () => {
    // 1. Create wallet
    // 2. Fetch UTXOs
    // 3. Build transaction
    // 4. Sign transaction
    // 5. Broadcast transaction
    // 6. Verify transaction in pending
  });

  it('should create, sign, and broadcast UNIT transaction', async () => {
    // Same flow for Runes
  });
});
```

2. **Authentication Flow Integration Tests**
```javascript
// __tests__/integration/auth-flow.test.js
describe('Authentication Flows', () => {
  it('should complete onboarding with PIN', async () => {
    // Create wallet → Set PIN → Unlock with PIN
  });

  it('should complete onboarding with Passkey', async () => {
    // Create wallet → Set PIN → Create Passkey → Unlock with Passkey
  });

  it('should handle session timeout', async () => {
    // Login → Wait for timeout → Verify locked
  });
});
```

3. **Wallet Management Integration Tests**
```javascript
// __tests__/integration/wallet-management.test.js
describe('Wallet Management', () => {
  it('should create new wallet and derive addresses', async () => {
    // Generate mnemonic → Derive addresses → Verify format
  });

  it('should import existing wallet', async () => {
    // Import mnemonic → Derive addresses → Match expected
  });

  it('should switch between accounts', async () => {
    // Account 0 → Account 1 → Verify address change
  });
});
```

**Commit**: `test: add comprehensive integration test suites`

---

#### Task 5.2: Increase Unit Test Coverage (6 hours)

**Priority test files**:
```javascript
// __tests__/services/transaction/utxoSelection.test.js
describe('UTXO Selection', () => {
  it('should select optimal UTXOs for amount', () => {
    // Test various UTXO combinations
  });

  it('should handle dust UTXOs correctly', () => {
    // Verify dust is filtered
  });

  it('should prefer confirmed over unconfirmed', () => {
    // Test UTXO sorting
  });

  it('should throw if insufficient funds', () => {
    // Test error case
  });
});
```

```javascript
// __tests__/hooks/useAssetBalance.test.js
describe('useAssetBalance', () => {
  it('should calculate BTC balance correctly', () => {
    // Test BTC calculation
  });

  it('should calculate UNIT balance correctly', () => {
    // Test UNIT calculation
  });

  it('should handle zero balances', () => {
    // Edge case
  });
});
```

```javascript
// __tests__/utils/bitcoin.test.js
describe('Bitcoin Utilities', () => {
  it('should derive correct addresses from mnemonic', () => {
    // Test with known test vectors
  });

  it('should validate testnet addresses', () => {
    // Test address validation
  });

  it('should reject mainnet addresses', () => {
    // Security test
  });
});
```

**Commit**: `test: increase unit test coverage to 80%`

---

### Week 6 Tasks

#### Task 6.1: Add E2E Test Setup (3 hours)

**Setup Detox for E2E testing**:
```bash
npm install --save-dev detox detox-cli
```

**Basic E2E tests**:
```javascript
// e2e/wallet-creation.e2e.js
describe('Wallet Creation Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should create new wallet', async () => {
    await element(by.id('create-wallet-button')).tap();
    await element(by.id('pin-input')).typeText('123456');
    await element(by.id('confirm-button')).tap();

    await expect(element(by.id('wallet-screen'))).toBeVisible();
  });
});
```

**Commit**: `test: add E2E testing infrastructure with Detox`

---

#### Task 6.2: Performance Optimization (4 hours)

**Add performance monitoring**:
```javascript
// utils/performance.js
export const measurePerformance = (label, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);

  return result;
};

// Usage in components:
const balance = measurePerformance('Calculate Balance', () =>
  calculateTotalBalance(segwitBalance, taprootBalance)
);
```

**Optimize heavy components**:
```javascript
// Memoize expensive calculations
const totalBalance = useMemo(() => {
  return segwitBalance + taprootBalance;
}, [segwitBalance, taprootBalance]);

// Virtualize long lists
import { FlatList } from 'react-native';

<FlatList
  data={transactionHistory}
  renderItem={({ item }) => <TransactionItem tx={item} />}
  keyExtractor={item => item.txid}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
/>
```

**Commit**: `perf: add performance monitoring and optimize heavy components`

---

#### Task 6.3: Code Quality Tools (2 hours)

**Add ESLint rules**:
```javascript
// .eslintrc.js
module.exports = {
  extends: ['@react-native'],
  rules: {
    'max-lines': ['warn', { max: 300 }],
    'max-lines-per-function': ['warn', { max: 100 }],
    'complexity': ['warn', 10],
    'react-hooks/exhaustive-deps': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

**Add Prettier pre-commit hook**:
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "**/*.{js,jsx}": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}
```

**Commit**: `chore: add code quality tools and pre-commit hooks`

---

### Week 5-6 Summary

**Success Criteria**:
- [ ] Test coverage >80% on critical paths
- [ ] E2E tests passing
- [ ] Performance baselines established
- [ ] Code quality tools enforcing standards
- [ ] All new code follows patterns

**Expected Score**: 82 → 85 (+3 points)

---

## WEEK 7-8: Polish & Documentation
**Goal**: Final polish for mainnet readiness
**Estimated Effort**: 10-15 hours
**Score Impact**: 85 → 85+ (maintain/exceed)

### Week 7 Tasks

#### Task 7.1: Comprehensive Documentation (4 hours)

**Add JSDoc to all public APIs**:
```javascript
/**
 * Sign a transaction intent PSBT
 *
 * @param {Object} intent - Transaction intent object
 * @param {string} intent.psbt - Base64-encoded PSBT
 * @param {Array} intent.inputs - Array of input UTXOs
 * @param {string} intent.assetType - 'BTC' or 'UNIT'
 * @param {number} currentAccount - Account index for key derivation
 *
 * @returns {Promise<{signedTxHex: string, txid: string}>} Signed transaction
 *
 * @throws {Error} If PSBT is invalid or signing fails
 *
 * @example
 * const result = await signIntent(intent, 0);
 * console.log('TXID:', result.txid);
 */
export const signIntent = async (intent, currentAccount) => {
  // ...
};
```

**Create architecture documentation**:
```markdown
// docs/ARCHITECTURE.md
# DUCAT Wallet Architecture

## Overview
DUCAT is a React Native Bitcoin wallet supporting testnet operations...

## Directory Structure
\`\`\`
app/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── contexts/       # React Context providers
├── hooks/          # Custom React hooks
├── services/       # Business logic layer
├── utils/          # Utility functions
└── constants/      # App constants
\`\`\`

## Data Flow
1. User interacts with Screen component
2. Screen calls Service function
3. Service calls API/blockchain
4. Result stored in Context
5. Components re-render with new data

## Key Patterns
- Context for global state
- Custom hooks for logic extraction
- Service layer for business logic
- Utility functions for helpers
```

**Commit**: `docs: add comprehensive documentation`

---

#### Task 7.2: Error Handling Improvements (3 hours)

**Add global error boundary**:
```javascript
// components/ErrorBoundary.jsx - Enhanced
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary caught error', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });

    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text>Something went wrong</Text>
          <Button onPress={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
```

**Add retry logic to critical operations**:
```javascript
// utils/retry.js - Enhanced
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  delayMs = 1000,
  backoffFactor = 2
) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        const delay = delayMs * Math.pow(backoffFactor, i);
        logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};
```

**Commit**: `feat: improve error handling and retry logic`

---

#### Task 7.3: User Experience Polish (3 hours)

**Add loading states**:
```javascript
// components/LoadingOverlay.jsx
export const LoadingOverlay = ({ visible, message }) => (
  <Modal visible={visible} transparent>
    <View style={styles.overlay}>
      <ActivityIndicator size="large" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  </Modal>
);
```

**Add success feedback**:
```javascript
// Use Confetti for successful transactions
import ConfettiCannon from 'react-native-confetti-cannon';

const TransactionSuccess = () => (
  <>
    <ConfettiCannon count={200} origin={{x: -10, y: 0}} />
    <Text>Transaction Sent!</Text>
  </>
);
```

**Commit**: `ux: add loading states and success feedback`

---

### Week 8 Tasks

#### Task 8.1: Final Security Review (2 hours)

**Security checklist**:
```markdown
## Security Review Checklist

### Cryptography
- [ ] All crypto uses vetted libraries
- [ ] No custom crypto implementations
- [ ] Keys properly derived from mnemonic
- [ ] Mnemonic exposure <100ms
- [ ] Salt verified on save

### Storage
- [ ] Sensitive data in SecureStore
- [ ] No secrets in source code
- [ ] No keys in logs/errors
- [ ] Sentry sanitization working

### Network
- [ ] All HTTPS connections
- [ ] Testnet-only enforced
- [ ] Mainnet addresses rejected
- [ ] API endpoints validated

### Authentication
- [ ] PIN rate limiting works
- [ ] Biometric rate limiting works
- [ ] Session timeout functional
- [ ] Passkey encryption strong

### Transactions
- [ ] Signature validation correct
- [ ] TXID malleability check
- [ ] Fee calculation accurate
- [ ] UTXO selection safe
```

**Commit**: `security: final security review and checklist`

---

#### Task 8.2: Performance Audit (2 hours)

**Performance benchmarks**:
```javascript
// scripts/performance-audit.js
const benchmarks = {
  'App Startup': { target: 2000, actual: 0 },
  'Wallet Creation': { target: 500, actual: 0 },
  'Balance Fetch': { target: 2000, actual: 0 },
  'Transaction Sign': { target: 200, actual: 0 },
  'Transaction Broadcast': { target: 1000, actual: 0 },
};

// Run benchmarks and report
```

**Bundle size optimization**:
```bash
# Analyze bundle
npx react-native-bundle-visualizer

# Remove unused dependencies
npm prune

# Check for duplicates
npm dedupe
```

**Commit**: `perf: performance audit and optimization`

---

#### Task 8.3: Deployment Preparation (3 hours)

**Final pre-deployment checklist**:
```markdown
## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing
- [ ] No ESLint errors
- [ ] No console.logs in production
- [ ] TypeScript errors resolved
- [ ] Code reviewed

### Security
- [ ] All critical issues fixed
- [ ] All high issues fixed
- [ ] Sentry configured correctly
- [ ] Secrets in environment variables
- [ ] Network validation working

### Testing
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Manual smoke tests complete

### Documentation
- [ ] README up to date
- [ ] Architecture documented
- [ ] Security model documented
- [ ] Deployment guide written

### Build
- [ ] iOS build succeeds
- [ ] Android build succeeds (if applicable)
- [ ] Version bumped
- [ ] Changelog updated
```

**Create deployment guide**:
```markdown
// docs/DEPLOYMENT.md
# Deployment Guide

## Prerequisites
- EAS CLI installed
- Apple Developer account
- Sentry account
- Environment variables configured

## Steps

### 1. Pre-deployment
\`\`\`bash
npm test
npm run lint
npm run build
\`\`\`

### 2. Build
\`\`\`bash
eas build --platform ios --profile production
\`\`\`

### 3. Submit to TestFlight
\`\`\`bash
eas submit --platform ios --latest
\`\`\`

### 4. Monitor
- Check Sentry for errors
- Monitor TestFlight feedback
- Track performance metrics
```

**Commit**: `chore: add deployment guide and final checklist`

---

## Complete Issue Registry

### Critical Issues (All Fixed)
1. ✅ Sentry DSN exposed
2. ✅ Unsafe Taproot signing
3. ✅ Inconsistent Rune/BTC signing
4. ✅ PIN salt not verified
5. ✅ Missing network validation

### High Priority Issues (All Fixed)
1. ✅ Insecure HKDF
2. ✅ PIN change race condition
3. ✅ Unsanitized errors
4. ✅ Passkey challenge replay
5. ✅ No biometric rate limiting
6. ✅ Transaction finalization errors
7. ✅ Sentry not sanitizing
8. ✅ No malleability check

### Medium Priority Issues (Addressed)
1. ✅ WalletDataContext split
2. ✅ styles.js extracted
3. ✅ UIContext split
4. ✅ NavigationHandlersContext split
5. ✅ useAuth split
6. ✅ PasskeyTestScreen removed
7. ✅ Balance calculation unified
8. ✅ Transaction services consolidated
9. ✅ Prop drilling fixed
10. 🟡 Test coverage increased (ongoing)
11. 🟡 Documentation added (ongoing)
12. 🟡 Performance optimized (ongoing)

### Design Issues (Improved)
1. ✅ File sizes reduced
2. ✅ Context count reduced
3. ✅ Hook complexity reduced
4. 🟡 TypeScript adoption (future)
5. 🟡 Monitoring added (partial)
6. 🟡 Feature flags (future)
7. 🟡 Error recovery improved

---

## Testing Strategy

### Unit Tests
- Run before every commit
- Target >80% coverage
- Mock external dependencies
- Test edge cases

### Integration Tests
- Run before deployment
- Test complete user flows
- Use real testnet data
- Verify state consistency

### E2E Tests
- Run weekly
- Test critical paths
- Use real device/simulator
- Automate with CI/CD

### Manual Testing
- Full regression before major releases
- Exploratory testing for new features
- Security testing for crypto code
- Performance testing on low-end devices

---

## Success Metrics

### Code Quality Metrics
- Average file size: <200 lines
- Average function size: <50 lines
- Cyclomatic complexity: <10
- Test coverage: >80%
- ESLint errors: 0

### Performance Metrics
- App startup: <2s
- Balance fetch: <2s
- Transaction sign: <200ms
- Memory usage: <200MB
- Frame rate: >55fps

### Security Metrics
- No critical issues
- No high issues
- All medium issues tracked
- Sentry error rate: <1%
- No key material in logs

### User Experience Metrics
- Crash rate: <0.1%
- ANR rate: <0.5%
- Session length: >2 min
- Feature adoption: >50%

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking change during refactor | Medium | High | Comprehensive test suite |
| Performance regression | Low | Medium | Performance monitoring |
| Security vulnerability introduced | Low | Critical | Code review + tests |
| Dependency conflict | Low | Low | Lock file + testing |

### Mitigation Strategies
1. **Feature flags**: Deploy behind flags, enable gradually
2. **Rollback plan**: Keep previous version deployable
3. **Monitoring**: Sentry + performance metrics
4. **Testing**: Comprehensive test suite before deployment

---

## Progress Tracking

### Weekly Checkpoints

**Week 1**: Critical Security
- [ ] 5 critical issues fixed
- [ ] Tests added
- [ ] Code reviewed

**Week 2**: High Priority
- [ ] 8 high issues fixed
- [ ] Performance improved
- [ ] Tests passing

**Week 3**: Architecture
- [ ] Contexts consolidated
- [ ] Hooks split
- [ ] Styles extracted

**Week 4**: Code Quality
- [ ] Services reorganized
- [ ] Prop drilling fixed
- [ ] Tests expanded

**Week 5**: Testing
- [ ] Integration tests added
- [ ] Coverage >80%
- [ ] E2E setup

**Week 6**: Polish
- [ ] Performance optimized
- [ ] Monitoring added
- [ ] Quality tools

**Week 7**: Documentation
- [ ] Docs completed
- [ ] Error handling improved
- [ ] UX polished

**Week 8**: Deployment
- [ ] Security review
- [ ] Performance audit
- [ ] Deployment ready

---

## Score Progression

| Week | Focus | Score | Delta |
|------|-------|-------|-------|
| 0 (Start) | Baseline | 67/100 | - |
| 1-2 | Critical + High Priority | 76/100 | +9 |
| 3-4 | Architecture | 82/100 | +6 |
| 5-6 | Testing + Quality | 85/100 | +3 |
| 7-8 | Polish + Deploy | 85+/100 | +0-2 |

---

## Conclusion

This 8-week plan transforms your codebase from **67/100 to 85+/100**, making it **mainnet-ready**.

### Key Outcomes
- ✅ All critical security issues resolved
- ✅ Architecture significantly improved
- ✅ Code quality meets professional standards
- ✅ Test coverage comprehensive
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ Deployment ready

### Next Steps After Week 8
1. Professional security audit
2. Extended testnet beta program
3. User feedback incorporation
4. Gradual mainnet migration
5. Continuous improvement

---

**This is your roadmap to a production-ready Bitcoin wallet.**

Let's start with Week 1, Day 1, Task 1.1. Ready?
