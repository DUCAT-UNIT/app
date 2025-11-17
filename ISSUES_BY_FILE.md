# Issues by File - Quick Reference

## CRITICAL FILES (Fix First)

### /App.js
- **CRITICAL**: Sentry DSN hardcoded (lines 38-40)
  - Fix: Move to environment variable
  - Revoke DSN in Sentry dashboard immediately

- **HIGH**: Sentry error sanitization incomplete (lines 43-50)
  - Fix: Add regex-based sanitization for mnemonics and keys

### /services/transactionSigningService.js
- **CRITICAL**: Unsafe Taproot key tweaking arithmetic (lines 106-125)
  - Issue: No validation of private key before subtraction
  - Fix: Use bitcoinjs-lib's built-in tweak() method

- **CRITICAL**: Inconsistent UNIT/Rune vs BTC signing (lines 60-171)
  - Issue: Two completely different Taproot implementations
  - Fix: Unify to single code path using bitcoinjs-lib

- **HIGH**: Transaction finalization error swallowing (lines 156-170)
  - Fix: Add logging, catch only specific errors

- **HIGH**: Unsanitized error messages (line 198)
  - Fix: Add sanitization layer for errors

- **HIGH**: No transaction malleability check
  - Fix: Verify TXID after signing

### /services/passkeyService.js
- **CRITICAL**: PIN salt not verified after save (lines 335-339, 507-511, 637-643)
  - Fix: Add read-back verification in savePin()

- **CRITICAL**: Insecure HKDF implementation (lines 108-124)
  - Issue: Not RFC 5869 compliant, uses string concat not HMAC
  - Fix: Use react-native-quick-crypto for proper HMAC

- **HIGH**: Race condition in atomicPinChange (lines 862-931)
  - Fix: Add semaphore flag to prevent concurrent operations

- **HIGH**: Passkey challenge missing timestamp validation (lines 468-479, 594-607)
  - Fix: Add timestamp to challenge, validate freshness

- **HIGH**: Missing PSBT input verification
  - Fix: Verify amounts and scripts match expected before signing

### /utils/bitcoin.js
- **CRITICAL**: Missing network validation at startup
  - Fix: Add explicit testnet checks in address derivation

- **MEDIUM**: Incomplete Taproot pubkey validation (lines 47-54)
  - Fix: Validate x-only pubkey length

### /services/pinService.js
- **CRITICAL**: PIN salt persistence not verified (lines 149-164)
  - Fix: Add read-back check after setItemAsync()

---

## HIGH PRIORITY FILES (Fix Before Testnet)

### /services/transaction/utxoSelection.js
- **MEDIUM**: Fee calculation loop convergence issue (lines 58-99)
  - Fix: Add MAX_ITERATIONS guard against infinite loops

- **MEDIUM**: UTXO selection not deterministic (lines 64-95)
  - Fix: Sort UTXOs deterministically before selection

### /services/transaction/btcTransaction.js
- **MEDIUM**: Incomplete amount validation (lines 43-49)
  - Fix: Add maximum Bitcoin (21M) check, minimum check

### /services/biometricService.js (implied)
- **HIGH**: No biometric rate limiting
  - Fix: Add attempt tracking with lockout threshold

### /services/icloudStorage.js
- **MEDIUM**: Limited error handling for iCloud operations
  - Fix: Add retry logic, detailed error reporting

---

## MEDIUM PRIORITY FILES (Fix For Production)

### /contexts/AuthContext.js
- **MEDIUM**: No session state validation
  - Fix: Add explicit auth checks before operations

### /services/transactionBroadcastService.js
- **MEDIUM**: No explicit timeout handling
  - Fix: Add timeout parameter to broadcast operations

### /utils/constants.js
- **LOW**: Good, no hardcoded secrets (except Sentry)

---

## CODE QUALITY FILES (Design)

### Overall Context Architecture
- **MEDIUM**: 13 nested providers, 2,526 lines of context code
  - Consider: State management library for complex flows
  - Merge: Related contexts (TransactionBuild + TransactionExecution)
  - Profile: For re-render performance issues

### Test Coverage
- **MEDIUM**: 107 test files but missing critical paths
  - Add: transactionSigningService tests
  - Add: passkeyService integration tests
  - Add: utxoSelection convergence tests

---

## STATUS BY SEVERITY

### CRITICAL (5 issues) - 2-3 hours to fix
1. Sentry DSN exposed
2. Taproot unsafe arithmetic
3. Rune/BTC signing inconsistent
4. PIN salt not verified
5. Network validation missing

### HIGH (8 issues) - 8-12 hours to fix
1. HKDF insecure implementation
2. PIN change race condition
3. Transaction finalization error handling
4. Unsanitized errors
5. Passkey replay vulnerability
6. Biometric rate limiting
7. Sentry sanitization
8. Malleability check

### MEDIUM (12 issues) - 12-16 hours to fix
1. No PSBT input verification
2. UTXO sorting not deterministic
3. Amount validation incomplete
4. Fee loop convergence
5. No transaction timeout
6. Insufficient security logging
7. Context nesting complexity
8. Test coverage gaps
9. No session validation
10. No fee UI warnings
11. Taproot pubkey validation
12. Runes dust handling

**Total Estimated Fix Time: 24-32 hours (3-4 days with testing)**

