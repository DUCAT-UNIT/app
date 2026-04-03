# Ducat Wallet — Full Codebase Code Review Report

**Date**: 2026-02-16
**Branch**: `e2e/auth-tests`
**Scope**: ~200 files across 16 review areas (512 total source files)
**Method**: 7 parallel specialized agents (5 security-auditor, 2 general-purpose)
**Total Findings**: 109 (12 Critical, 22 High, 38 Medium, 37 Low/Info)

---

## 1. Executive Summary

The Ducat Wallet demonstrates **strong security fundamentals**: PBKDF2 at 310K iterations (OWASP 2023), constant-time PIN comparison, mnemonic exposure minimized via `withMnemonic()` pattern (<100ms), AES-256-GCM passkey encryption with RFC 5869 HKDF, CSPRNG via `expo-crypto`, BigInt arithmetic for PSBT values, input ownership verification before signing, TXID verification on broadcast, and proper SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. The vault system uses BigInt health factor computation, operation serialization via mutex, and multi-layer oracle freshness validation. The Cashu e-cash subsystem has solid recovery mechanisms (swap, mint quote, turbo) with proof durability and integrity hashing.

However, the review uncovered **12 CRITICAL** and **22 HIGH** severity findings across all layers:

1. **Fund loss vectors**: Floating-point precision in BTC-to-sats conversion, UTXO value not verified against TX hex, Cashu swap amount verification missing in 4 of 5 flows, race condition in swap recovery, change below dust aborts instead of user choice
2. **Key management**: Private key cache TTL not enforced, derived keys survive wallet deletion, P2PK private key data risks leaking via template-literal logs
3. **Auth/Passkey**: E2E bypass flags could enable production auth bypass, passkey pepper not included in iCloud backup (cross-device recovery failure), PIN change timeout doesn't guarantee rollback
4. **Transaction**: No sighash type validation before signing, OP_RETURN outputs blindly trusted, Runes intent IDs lack randomness, Runes fee rate missing fallback
5. **Vault**: Oracle price not re-validated in deposit/withdraw, health factor boundary inconsistency (160 vs 161), VaultInfo missing numeric field validation
6. **Architecture**: AuthContext useMemo defeated by spread, God context with 30+ dependencies, duplicate types (3 TransactionInput, 3 getHealthColor), PII leaks via template literals in Sentry

**Risk Assessment**: **NOT READY FOR MAINNET**. Multiple independent fund-loss vectors exist. All Critical and High findings must be resolved before mainnet deployment. Estimated remediation: 3-4 weeks.

---

## 2. Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 12 | Fund loss, key exposure, auth bypass, recovery failure |
| HIGH | 22 | Functionality bugs, data integrity, security hardening |
| MEDIUM | 38 | Architecture, code quality, performance, type safety |
| LOW/INFO | 37 | Style, observations, positive practices |
| **TOTAL** | **109** | |

---

## 3. Critical Findings (12)

### C-01: Floating-Point Precision Loss in BTC-to-Sats Conversion
**File**: `utils/bitcoin/conversions.ts:60`
**Category**: Security — Fund Loss
**Description**: `btcToSats()` uses `Math.round(btcValue * SATS_PER_BTC)` which is susceptible to IEEE 754 floating-point errors. Example: `0.123456789 * 100000000 = 12345678.900000001` rounds to 12345679 (1 extra sat).
**Impact**: User-specified BTC amounts silently rounded. Cumulative precision errors in repeated calculations.
**Recommendation**: Use string-based integer arithmetic — split on decimal, parse whole/fractional separately, combine with BigInt. The Runes amount parser already does this correctly.

### C-02: No UTXO Value Verification Against Returned TX Hex
**File**: `services/transaction/btcTransaction.ts:231-236`
**Category**: Security — UTXO Manipulation
**Description**: `fetchInputTransactions()` validates txid and checks vout existence, but does NOT verify the output value matches the UTXO value from the balance API. A compromised API could return UTXOs with inflated values.
**Impact**: Manipulated fee calculations if validation logic changes. Currently causes TX rejection (DoS).
**Recommendation**: Add value verification: `if (Number(tx.outs[utxo.vout].value) !== utxo.value) throw 'UTXO value mismatch'`.

### C-03: Private Key Cache TTL Not Enforced
**File**: `utils/wallet/keyDerivation.ts:55-82`
**Category**: Security — Key Management
**Description**: Derived private keys cached in SecureStore with `expires` field, but no background timer purges expired entries. Keys remain indefinitely until explicitly accessed and checked.
**Impact**: Private keys persist in SecureStore longer than intended. Attacker with device access can extract keys from cache entries that should have expired.
**Recommendation**: Implement active TTL enforcement via AppState listener that purges expired keys on app foreground.

### C-04: Cached Derived Keys Survive Wallet Deletion
**File**: `services/secureStorageService.ts:443-479`
**Category**: Security — Key Management
**Description**: `deleteWalletData()` clears mnemonic and account index but NOT the derived key cache (`derived_key_v5_*` entries). When user imports a different wallet, old wallet's keys remain.
**Impact**: Attacker with device access can extract private keys from previous wallets. SecureStore persists across iOS app reinstalls.
**Recommendation**: Add `clearAllDerivedKeys()` function to `keyDerivation.ts` and call from `deleteWalletData()`. Maintain an index key listing all cached addresses.

### C-05: E2E Bypass Enables Production Auth Bypass If Env Vars Leak
**File**: `hooks/usePasskeyCreation.ts:17, 66-72`
**Category**: Security — Auth Bypass
**Description**: `const isE2E = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true'` guards passkey creation bypass. If `EXPO_PUBLIC_E2E_BYPASS=true` leaks into production builds (misconfigured CI/CD), wallet creation proceeds without passkey authentication. Found in 15+ files across vault ops, transaction execution, wallet import, and balance services.
**Impact**: Complete bypass of passkey authentication. Fund theft with only a 6-digit PIN.
**Recommendation**: Add compile-time guard in `app.config.ts`: throw if `NODE_ENV === 'production' && EXPO_PUBLIC_E2E_BYPASS === 'true'`.

### C-06: Passkey Pepper Not in iCloud Backup — Cross-Device Recovery Failure
**File**: `services/passkey/encryption.ts:45-52`
**Category**: Security — Wallet Recovery Failure
**Description**: Passkey pepper is stored in SecureStore (device-local) but NOT included in the iCloud backup. On a new device, a new pepper is generated, producing a different encryption key. Decryption of the backed-up mnemonic fails permanently.
**Impact**: Permanent wallet lockout when switching devices. User loses all funds.
**Recommendation**: Either include pepper in iCloud backup payload, or derive it deterministically from passkey credentials (credentialId + userHandle).

### C-07: Cashu P2PK Key Derivation Verification Missing
**File**: `services/cashu/p2pk/p2pkKeyManager.ts:99-213`
**Category**: Security — Cashu Fund Loss
**Description**: `findAccountForP2PKToken()` derives tweaked private keys and verifies public key match, but verification failure is logged and skipped (falls through to next account) rather than aborting. A subtle key derivation bug could cause the function to return the wrong key.
**Impact**: Signing P2PK proofs with wrong key — funds become unspendable.
**Recommendation**: Treat verification failure as a hard error. Log forensic data and throw.

### C-08: Hardcoded Cashu Mint URL — Single Point of Failure
**File**: `services/cashu/mintClient/mintConfig.ts`
**Category**: Security — Availability
**Description**: Mint URL is hardcoded. If the mint goes offline or is compromised, all Cashu operations fail. No fallback or user-configurable mint.
**Impact**: Complete loss of Cashu functionality if mint is unavailable. Compromised mint can return malicious data.
**Recommendation**: Implement mint URL whitelist with fallback. Allow user to configure trusted mints.

### C-09: Cashu Proof Deduplication on Add May Lose Funds
**File**: `services/cashu/cashuProofManager.ts:140-165`
**Category**: Security — Cashu Fund Loss
**Description**: `addProofs()` deduplicates by secret. If two valid proofs share a secret (shouldn't happen but could via mint bug), the second is silently dropped.
**Impact**: Silent fund loss if mint returns duplicate secrets across different denominations.
**Recommendation**: Log warning with full proof details when duplicate detected. Consider deduplicating on `(secret, amount)` tuple.

### C-10: Change Below Dust Aborts Transaction Instead of User Choice
**File**: `services/transaction/utxoSelection.ts:172-182`
**Category**: Security — Transaction UX
**Description**: When change is below dust limit (546 sats), the code throws `ERRORS.FEE_TOO_LOW` — aborting the transaction entirely. No option for user to add dust change to fee.
**Impact**: Users blocked from making legitimate transactions where dust change is acceptable. Error message is misleading (it's a change-dust issue, not fee).
**Recommendation**: Recalculate fee to eliminate change output. Present user with explicit choice: "Add 100 sats change to fee?"

### C-11: Cashu Swap Amount Verification Missing in 4 of 5 Flows
**File**: `services/cashu/operations/cashuSendP2PK.ts:254`, `cashuReceiveToken.ts:240`, `cashuReceiveP2PK.ts:223`, `cashuMeltOperations.ts:116`
**Category**: Security — Cashu Fund Loss
**Description**: `cashuSendToken.ts` correctly verifies swap amounts match (line 133-145), but P2PK send, receive token, receive P2PK, and melt operations do NOT verify the mint returned the correct total.
**Impact**: Malicious mint can return fewer proofs than expected — silent fund loss in 4 of 5 swap flows.
**Recommendation**: Add `sumProofs(allNewProofs) !== selectedAmount` check after unblinding in ALL swap operations.

### C-12: Race Condition in Cashu Swap Recovery
**File**: `services/cashu/cashuSwapRecovery.ts:242-270`
**Category**: Security — Cashu Fund Loss
**Description**: Recovery calls `loadProofs()` and `addProofs()` WITHOUT acquiring the proof lock. If another operation runs concurrently during recovery, both read the same proof set, modify it, and save — last writer wins.
**Impact**: Change proofs from recovery OR newly received proofs could be lost.
**Recommendation**: Wrap recovery in `withProofLock()`. Export the lock from `cashuProofManager.ts`.

---

## 4. High Severity Findings (22)

### H-01: No Sighash Type Validation Before Signing
**File**: `services/signing/cryptoUtils.ts:234, 265`
**Category**: Security — PSBT Signing
**Description**: Taproot signing functions read `input.sighashType` and use it directly without validation. `SIGHASH_NONE` (0x02) allows anyone to change outputs after signing. `SIGHASH_ANYONECANPAY` (0x80) allows adding attacker inputs.
**Impact**: PSBT with wrong sighash could redirect funds after signing.
**Recommendation**: Whitelist only `SIGHASH_DEFAULT (0x00)` for Taproot and `SIGHASH_ALL (0x01)` for SegWit.

### H-02: OP_RETURN Outputs Blindly Trusted in PSBT Validation
**File**: `services/signing/psbtService.ts:580-588`
**Category**: Security — PSBT Signing
**Description**: `allowOpReturn` defaults to `true`. Any OP_RETURN output in the PSBT is skipped during validation. A malicious Guardian could construct a PSBT with OP_RETURN that burns BTC.
**Impact**: BTC burnt via unvalidated OP_RETURN outputs in vault operations.
**Recommendation**: Validate OP_RETURN is a valid Runestone. Enforce max 83-byte size. Default `allowOpReturn` to `false`.

### H-03: PII Leak — Full Bitcoin Addresses in Sentry via Template Literals
**File**: `services/cashu/p2pk/p2pkKeyManager.ts:213`, `hooks/transaction/useOutputExtraction.ts:109`, `services/signing/psbtService.ts:169`
**Category**: Security — PII
**Description**: Template literal interpolation embeds full Bitcoin addresses in `logger.info()` message strings. `sanitizeParams()` only sanitizes the `data` parameter, NOT the message string.
**Impact**: Full Bitcoin addresses sent to Sentry, visible to anyone with dashboard access.
**Recommendation**: Move addresses from message strings to data objects where `sanitizeParams()` can redact them.

### H-04: Biometric Lockout Bypass via Separate Counter
**File**: `services/biometricService.ts:73-82`
**Category**: Security — Auth
**Description**: Biometric lockout is 15 minutes vs PIN's 30 minutes. While biometric failures DO increment the unified counter, the biometric lockout resets independently, giving attackers 15 total attempts (10 PIN + 5 biometric) instead of 10.
**Impact**: 50% more brute-force attempts via method switching.
**Recommendation**: Unify lockout duration to 30 minutes for both methods.

### H-05: PIN Change Timeout Doesn't Guarantee Rollback
**File**: `services/passkey/pinChange.ts:55-59`
**Category**: Security — Auth
**Description**: Timeout handler resets the lock flag but does NOT trigger rollback. If operation hangs after new PIN is saved but before passkey re-encryption, user has new PIN hash but old passkey encryption.
**Impact**: Permanent wallet lockout if timing attack succeeds.
**Recommendation**: Implement emergency rollback in timeout handler that restores all old values.

### H-06: Runes Transaction Fee Rate Missing Fallback
**File**: `services/transaction/runesTransaction.ts:98`
**Category**: Security — Transaction
**Description**: `getRecommendedFeeRate()` called without try-catch. BTC transaction has fallback to `feeRate = 1`, Runes does not.
**Impact**: Users cannot send UNIT tokens during fee API outages.
**Recommendation**: Add `try/catch` with fallback fee rate, matching BTC implementation.

### H-07: Output Count Uses Undefined Variable in Runes Fee Calculation
**File**: `services/transaction/runesTransaction.ts:99`
**Category**: Bug — Fee Calculation
**Description**: `change > dustLimit` references `change` before it's calculated. JavaScript evaluates `undefined > 546` as `false`, always producing `outputCount = 3`.
**Impact**: Fee underestimation when change output IS needed. Transaction may be rejected.
**Recommendation**: Move output count calculation after change is computed, or always use 4 (conservative).

### H-08: Runestone Payload >255 Bytes Not Supported
**File**: `utils/runestoneEncoder.js:114-121`
**Category**: Bug — Runes Encoding
**Description**: Encoder handles OP_PUSHDATA1 (up to 255 bytes) but throws for larger payloads. Bitcoin supports up to 520 bytes via OP_PUSHDATA2.
**Impact**: Multi-edict runestones with large payloads impossible. Limits complex Runes operations on mainnet.
**Recommendation**: Add OP_PUSHDATA2 support (0x4d + 2-byte little-endian length).

### H-09: Runes Intent ID Collision Risk — No Randomness
**File**: `services/transaction/runesTransaction.ts:132`
**Category**: Security — Intent Tracking
**Description**: Runes intent ID uses only `Date.now().toString()`. BTC uses `Date.now() + random bytes`. Two rapid UNIT sends create identical IDs.
**Impact**: Intent tracking may overwrite first transaction with second. Wrong transaction signed/broadcast.
**Recommendation**: Use `${Date.now()}-${Buffer.from(Crypto.getRandomBytes(8)).toString('hex')}` (matching BTC).

### H-10: Oracle Price Not Re-Validated in Deposit/Withdraw
**File**: `services/vault/deposit.ts:56-114`, `services/vault/withdraw.ts:54-99`
**Category**: Security — Vault
**Description**: Borrow and repay re-validate oracle freshness at build time, but deposit and withdraw do NOT. User could confirm with 6-minute-old price after a 10% drop.
**Impact**: Vault under-collateralized relative to current market after stale-price operation.
**Recommendation**: Add `quoteAge > 300` check in deposit and withdraw operations.

### H-11: Health Factor Boundary Inconsistency (160 vs 161)
**File**: `utils/vaultUtils.ts:159, 207`
**Category**: Bug — Vault
**Description**: `getHealthStatus()` treats 160% as danger (< 161 → danger). `validateVaultParams()` allows 160% (< 160 → error). User creates vault at exactly 160% → passes validation → shown in red "danger."
**Impact**: User confusion and panic selling. Inconsistent health factor display.
**Recommendation**: Standardize on 160% as minimum across both functions.

### H-12: VaultInfo API Response Missing Numeric Field Validation
**File**: `services/vaultService.ts:213-231`
**Category**: Security — Vault
**Description**: Validates 5 required string fields but NOT `oracle_price`, `oracle_timestamp`, or `liquidation_price`. Fallback sets `oracle_price: 0` if missing.
**Impact**: Health factor computed with price=0 → infinite health → user over-borrows → immediate liquidation.
**Recommendation**: Add `oracle_price > 0` validation. Throw error for corrupted data instead of returning null.

### H-13: Vault Operation Lock Uses Module-Level Mutable State
**File**: `services/vault/utils.ts:21-34`
**Category**: Architecture — Vault
**Description**: Module-level `_vaultOpLock` persists across account switches. Account 1's pending operation blocks Account 2. Hot reload resets lock mid-operation.
**Impact**: Unnecessary serialization across accounts. Race conditions after hot reload.
**Recommendation**: Store lock per vault pubkey or in context.

### H-14: Repay Operation Fetches UNIT UTXOs Without Duplicate Check
**File**: `services/vault/repay.ts:151-158`
**Category**: Security — UTXO
**Description**: `fetch.rune_utxos()` returns UTXOs that may already be spent in pending transactions. No exclusion filter like BTC send uses.
**Impact**: Double-spend error from Guardian. Repay fails with confusing error.
**Recommendation**: Filter UTXOs against `spentUtxos` from PendingTransactionsContext.

### H-15: Insufficient Schnorr Signature Validation in Cashu P2PK
**File**: `services/cashu/p2pk/p2pkVerification.ts:80-125`
**Category**: Security — Cashu
**Description**: Returns `false` for both invalid signatures AND exceptions. Impossible to distinguish wrong signature from crypto library failure. Swallows all errors silently.
**Impact**: Valid P2PK tokens appear as verification failures with no diagnostic info.
**Recommendation**: Throw on exceptions (let caller handle). Return `false` only for signature mismatch.

### H-16: Three Incompatible `getHealthColor` Functions
**File**: `utils/vaultUtils.ts:166`, `utils/vaultHealthColor.ts:13`, `components/vaultDetail/vaultChart/utils.ts:180`
**Category**: Architecture — Duplication
**Description**: Three functions with different input types (string vs number vs number|null), different colors (green is `#22C55E` vs `colors.semantic.success` vs `#59aa8a`), and different boundary behavior (`>=200` vs `>200`).
**Impact**: Vault health indicators display inconsistent colors. Health=200 shows green in one place, yellow in another.
**Recommendation**: Consolidate to single canonical function with consistent colors and boundaries.

### H-17: Three Incompatible `TransactionInput` Type Definitions
**File**: `types/transaction.d.ts:12`, `services/transactionHistoryService.ts:23`, `utils/pendingTransactionsUtils.ts:8`
**Category**: Architecture — Type Safety
**Description**: Three different interfaces named `TransactionInput` with completely different shapes. Code importing from the wrong path gets wrong type silently.
**Impact**: Runtime errors when properties assumed present are undefined.
**Recommendation**: Rename to distinct types: `EsploraTransactionInput`, `TransactionInputRef`, `PendingTransactionInput`.

### H-18: `transactionHistoryService.ts` Bypasses apiClient HTTPS Enforcement
**File**: `services/transactionHistoryService.ts:108`
**Category**: Security — API
**Description**: Uses raw `fetch()` wrapped in `retrySilently()` instead of `getWithRetry()`. Bypasses `assertHttps()` check, API metrics logging, and timeout handling.
**Impact**: If base URL is tampered to `http://`, this endpoint would not be blocked.
**Recommendation**: Replace with `getWithRetry(url)` from `apiClient`.

### H-19: resetWalletAndState() No Audit Trail or Rate Limiting
**File**: `contexts/AuthContext.tsx:75-86`
**Category**: Security — Auth
**Description**: Wallet deletion checks `isAuthenticated` but has no logging, no rate limiting, no secondary confirmation, and doesn't clear lockout counters.
**Impact**: Wallet wiped with no forensic evidence. Attacker with temporary auth access can immediately destroy wallet.
**Recommendation**: Add audit logging, 1-hour rate limit, and re-authentication prompt.

### H-20: Oracle Future Timestamp Window Too Wide (60 Seconds)
**File**: `services/oracleService.ts:41-43`
**Category**: Security — Oracle
**Description**: Future timestamp check allows 60-second window. Oracle could sign manipulated price that passes validation for 59 seconds.
**Impact**: 60-second window for oracle price manipulation without detection.
**Recommendation**: Reduce to 5-10 seconds (NTP drift only). Add re-check in ALL vault operations.

### H-21: Sentry `sanitizeParams` Does Not Include `address` Key
**File**: `services/sentryService.ts:338`
**Category**: Security — PII
**Description**: `SENSITIVE_KEYS` regex covers mnemonic/seed/key/token/proof but NOT `address`. While `SENSITIVE_VALUES` catches Bitcoin address patterns in values, this is a defense-in-depth gap.
**Impact**: Missing key-based redaction for addresses. Over-redaction of properties containing "key" substring.
**Recommendation**: Add `address` to `SENSITIVE_KEYS`. Use word-boundary matching.

### H-22: AuthContext useMemo with Spread Defeats Memoization
**File**: `contexts/AuthContext.tsx:111-127`
**Category**: Performance — Critical Path
**Description**: Context value spreads `authState` (new object reference each render) into `useMemo` dependency array. Memo never caches — context value changes every render.
**Impact**: Every component consuming `useAuth()` re-renders on every `AuthProvider` render. Cascading through all 12+ consumers across the entire app.
**Recommendation**: Destructure `authState` into individual stable values, or split into sub-contexts.

---

## 5. Security Audit

### 5.1 Crypto & Key Management

**Positive Practices:**
- CSPRNG via `expo-crypto` wrapping iOS `SecRandomCopyBytes` / Android `SecureRandom`
- BIP32/39/84/86 compliance with correct derivation paths (SegWit: `m/84'/1'/0'/0/{account}`, Taproot: `m/86'/1'/0'/0/{account}`)
- Proper Taproot key tweaking with odd Y coordinate handling (BIP-341)
- SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` for mnemonic
- `withMnemonic()` pattern limits exposure to <100ms
- Input ownership verification before PSBT signing (validates witnessUtxo script matches wallet keys)
- TXID verification on broadcast (prevents MITM)
- BigInt for all PSBT input/output values

**Concerns:**
- 12-word mnemonics (128-bit entropy) — industry standard is 24 words for high-value wallets (quantum resistance)
- `securelyWipeString()` provides false security — JavaScript strings are immutable, GC is non-deterministic
- Taproot key negation logic duplicated in 3 files with slight variations (`keyDerivation.ts`, `p2pkKeyManager.ts`, `cryptoUtils.ts`)
- P2PK signing uses `@bitcoinerlab/secp256k1` but verification uses `@noble/secp256k1` — mixed libraries
- P2PK key scanning derives up to 100 accounts (200ms+ mnemonic exposure, violates <100ms policy)

### 5.2 Transaction Security

**Positive Practices:**
- Address validation on all recipient/change addresses
- Dust limit enforcement preventing unspendable outputs
- Fee lower bound preventing zero-fee transactions
- Change address validation (validates against `validateAndNormalizeAddress`)

**Concerns:**
- Change address validation checks equality, not ownership — corrupted `sourceAddress` could send change to attacker
- Transaction signing validates BTC amounts but NOT Runes amounts in PSBT
- UTXO selection is not largest-first — suboptimal (more inputs = higher fees)
- Fee calculator hardcodes P2WPKH input size (68 vB) but Taproot is 57 vB — Runes transactions overpay ~16%
- No rune ID validation in UTXO selection — ord API could return wrong rune

### 5.3 Cashu E-Cash Security

**Positive Practices:**
- Strong mutex locking (`withProofLock`) for proof operations
- Integrity hashing (SHA-256) stored alongside proofs
- Proof verification on write (re-read and validate)
- Retry with exponential backoff for failed proof saves
- Client-side P2PK verification before sending to mint
- Double-spend guard checking proofs aren't already spent
- Deduplication on receive (prevents same token twice)

**Concerns:**
- Integrity hash NOT validated on read (only on write) — silent corruption possible
- Swap amount verification inconsistent (1 of 5 flows has it)
- Race condition in swap recovery (no proof lock)
- Blinding factor generation limited to 10 attempts (should be 100+)
- Token decode doesn't validate mint URL before processing
- No rate limiting on mint quote recovery (hammers mint with 100+ API calls)

### 5.4 Authentication & Passkey

**Positive Practices:**
- PBKDF2-HMAC-SHA512 at 310,000 iterations (OWASP 2023)
- Constant-time comparison (`timingSafeEqual`) prevents timing attacks
- Fail-closed lockout (throws on storage write failure)
- PIN salt read-back verification prevents silent corruption
- AES-256-GCM with random IV for passkey encryption
- HKDF-compliant key derivation (RFC 5869)
- Unified biometric/PIN lockout counter (biometric failures count toward PIN lockout)
- Atomic PIN change with rollback on failure

**Concerns:**
- E2E bypass flags in 15+ files (compile-time guard needed)
- Passkey pepper not in iCloud backup (cross-device recovery fails)
- Passkey challenge not stored/verified — replay attack possible
- Salt HMAC key stored in same SecureStore as salt (tamper detection ineffective)
- PIN lockout state can be bypassed on storage error (in-memory fallback needed)
- No jailbreak/root detection

---

## 6. Architecture Review

### 6.1 Provider Hierarchy

The provider hierarchy is **correctly structured** with no circular dependencies:

```
ErrorBoundary → AuthProvider → ResponsiveProvider → WalletProvider
  → CashuProvider → WalletDataProvider → TransactionBuildProvider
  → TransactionExecutionProvider → SeedPhraseProvider
  → NavigationHandlersProvider → AirdropProvider → AppNavigatorContent
```

Dependencies flow correctly: `WalletProvider` above `CashuProvider` (cashu needs wallet address), `CashuProvider` above `WalletDataProvider` (data needs cashu balance), `TransactionBuildProvider` above `TransactionExecutionProvider`.

**Issues:**
- `AuthContext` spread defeats memoization — root cause of cascading re-renders (H-22)
- `NavigationHandlersContext` is a "God Context" consuming 10+ hooks with 30+ values — any upstream change triggers full re-render
- `UIContext.tsx` is dead code — fully migrated to Zustand but file still exists as misleading barrel
- `PendingTransactionsContext.tsx` provider is never mounted — dead code with `usePendingTransactions()` hook that would crash
- `WalletDataContext` passthrough `useMemo` is no-op (returns same reference received)

### 6.2 State Management

**Zustand (18 stores):** Well-structured with `createCommonVaultSlice` factory pattern for vault operation stores. Proper separation of persistent state.

**Issues:**
- Module-scoped `let` variables in multiple stores (`sendFlowStore`, `priceStore`, `notificationStore`) survive hot reloads and are invisible to devtools
- `useSendFlow()` hook subscribes to entire store and returns new function references each render — defeats Zustand's selective subscription
- Vault operation stores don't reset on navigator unmount (stale data on re-entry)
- `displayPreferencesStore` not persisted (user preferences lost on restart)
- `require()` inside store action creates circular dependency risk (`pendingTransactionsStore.ts:280`)
- `BorrowStore.reset()` spreads `commonSlice` which includes functions — semantically wrong

### 6.3 Navigation

**Positive:**
- Navigation guards properly implemented — financial flows only registered when `isAuthenticated`
- Error boundaries on every screen via `withErrorBoundary` wrapper
- `SendNavigator` properly resets store on unmount via `beforeRemove` listener

**Issues:**
- `MainTabs` uses `createBottomTabNavigator` with single tab and hidden tab bar — unnecessary overhead
- Module-scoped `currentRouteName` in `RootNavigator` — should be `useRef`
- Vault navigators don't reset stores on unmount (unlike `SendNavigator`)

---

## 7. Code Quality Report

### 7.1 Duplications

| Duplication | Locations | Impact |
|-------------|-----------|--------|
| `getHealthColor` | 3 files, different colors + thresholds | Inconsistent UI |
| `TransactionInput` type | 3 files, incompatible shapes | Type confusion |
| `TransactionOutput` type | 3 files, incompatible shapes | Type confusion |
| `PendingTransaction` type | 3 files, incompatible shapes | Type confusion |
| `AddressType` type | 2 files, different unions | Import confusion |
| `SATS_PER_BTC` constant | 3 files + 15 magic number literals | Maintenance burden |
| Taproot key negation | 3 files, slight variations | Audit surface |
| Turbo recovery logic | `RootNavigator` + `AppNavigatorContent` | Race condition |
| `btcToSats` approach | `conversions.ts` (float) vs `runesTransaction.ts` (string-based) | Inconsistent precision |

### 7.2 Dead Code

| Item | File | Status |
|------|------|--------|
| `UIContext.tsx` | `contexts/UIContext.tsx` | Fully migrated to Zustand, renders `<>{children}</>` |
| `PendingTransactionsProvider` | `contexts/PendingTransactionsContext.tsx` | Never mounted in tree |
| `fetchWithRetry` | `utils/retry.ts:92-103` | Never imported anywhere |
| `securelyWipeString` | `services/secureStorageService.ts:11-85` | Ineffective (JS strings immutable) |
| `showToast` import | `contexts/WalletContext.tsx:39` | Extracted but unused |
| 24-hour interval | `contexts/AirdropContext.tsx:305-310` | Effect resets interval on every dep change |

### 7.3 Type Safety

| Metric | Count |
|--------|-------|
| `as any` in test files | 288 (across 28 files) |
| `as any` in production code | 17 |
| `@ts-nocheck` in test files | 0 (good) |
| `[key: string]: unknown` index signatures | 5 hooks |
| `console.log` in source (non-test) | 4 files |

### 7.4 Inconsistencies

- `btcToSats` rejects negatives but `satsToBTC` allows them — asymmetric round-trip
- `getRunesAmount` uses `parseFloat` for financial amounts — precision risk
- Runes fee calculation doesn't account for Taproot input size (68 vB vs 57 vB)
- Fee calculator uses `Math.ceil` + 10% buffer = ~15% overpayment
- `vaultCreationStore` is the only vault store NOT using `createCommonVaultSlice` factory

---

## 8. Testing Assessment

### 8.1 Coverage

- **202 unit tests** across hooks, services, and utils
- **61 E2E tests** (Maestro) across 6 suites: auth (6), settings (16), wallet (14), send (9), ecash (5), vault (9)
- Coverage target: 70% statements/functions/lines, 60% branches
- Native modules excluded from coverage (tested via E2E)

### 8.2 Test Quality

**Positive:**
- No `@ts-nocheck` in any test file
- `jest.setup.js` mocks accurately represent native module behavior
- E2E tests cover critical user journeys (wallet creation, send BTC/UNIT, vault operations)
- E2E bypasses properly scoped with `__DEV__ && EXPO_PUBLIC_E2E_BYPASS`

**Concerns:**
- `resetMocks: false` — mock call counts persist between tests. Requires manual `clearAllMocks()` in `beforeEach`
- 288 `as any` casts in test files — mocks could be better typed
- No unit tests for critical security functions: `computeHealthFactor` overflow edge cases, oracle staleness validation, swap amount verification
- No integration tests for wallet deletion + derived key cleanup
- No fuzz testing for token decoding or runestone encoding

### 8.3 Missing Test Coverage

| Critical Path | Current Coverage | Recommendation |
|---------------|-----------------|----------------|
| `computeHealthFactor` overflow (90+ BTC) | None | Add BigInt overflow boundary tests |
| Oracle staleness in deposit/withdraw | None | Add 6-minute staleness rejection test |
| Swap amount verification (all 5 flows) | 1 of 5 | Add verification tests for P2PK, receive, melt |
| Wallet deletion key cleanup | None | Add test verifying derived keys cleared |
| PIN change timeout rollback | None | Add test with simulated timeout |
| Runes fee calculation with `undefined` change | None | Add regression test for H-07 |
| Cross-device passkey recovery | None | Add test verifying pepper handling |

---

## 9. Recommendations — Prioritized by Risk/Impact

### Priority 1: Block Mainnet Launch (Critical Fund Loss)

1. **Fix BTC-to-sats floating-point** (C-01) — Use string-based integer arithmetic
2. **Add UTXO value verification** (C-02) — Validate against TX hex
3. **Clear derived keys on wallet deletion** (C-04) — Add `clearAllDerivedKeys()`
4. **Add compile-time E2E bypass guard** (C-05) — Throw on production + bypass
5. **Include passkey pepper in iCloud backup** (C-06) — Or derive deterministically
6. **Add swap amount verification to all Cashu flows** (C-11) — 4 missing flows
7. **Fix swap recovery race condition** (C-12) — Use `withProofLock()`
8. **Add sighash type validation** (H-01) — Whitelist SIGHASH_DEFAULT only
9. **Validate OP_RETURN in PSBT** (H-02) — Check Runestone structure, enforce 83-byte limit

### Priority 2: High Priority (Week 1-2)

10. **Enforce derived key cache TTL** (C-03) — Active purge on app foreground
11. **Fix P2PK key derivation verification** (C-07) — Hard error on mismatch
12. **Fix Runes fee rate fallback** (H-06) — Add try-catch with default
13. **Fix Runes fee output count bug** (H-07) — Calculate after change is known
14. **Add Runes intent ID randomness** (H-09) — Match BTC implementation
15. **Fix PIN change timeout rollback** (H-05) — Implement emergency rollback
16. **Move addresses from log messages to data objects** (H-03) — Fix Sentry PII leaks
17. **Add oracle re-validation to deposit/withdraw** (H-10) — 5-minute staleness check
18. **Standardize health factor boundary** (H-11) — Use 160% consistently
19. **Validate VaultInfo numeric fields** (H-12) — Check oracle_price > 0

### Priority 3: Medium Priority (Month 1)

20. **Consolidate `getHealthColor` to one function** (H-16) — Single source of truth
21. **Rename duplicate types** (H-17) — Distinct names for each shape
22. **Route services through apiClient** (H-18) — HTTPS enforcement
23. **Unify biometric/PIN lockout duration** (H-04) — 30 minutes both
24. **Fix AuthContext memoization** (H-22) — Split sub-contexts or destructure
25. **Remove dead code** — UIContext, PendingTransactionsContext, fetchWithRetry, securelyWipeString
26. **Add vault store reset on navigator unmount** — Prevent stale state
27. **Consolidate SATS_PER_BTC** — Single export, replace magic numbers
28. **Add proof integrity check on read** — Validate hash on load, not just write
29. **Add OP_PUSHDATA2 to runestone encoder** (H-08) — Support payloads up to 520 bytes

### Priority 4: Nice to Have

30. **Increase to 24-word mnemonics** — For mainnet quantum resistance
31. **Consolidate Taproot key negation** — Single shared utility
32. **Standardize on single Schnorr library** — Remove `@noble/secp256k1` dependency
33. **Reduce P2PK account scan** — Default to 10 accounts, not 100
34. **Add Cashu mint URL whitelist** — User-configurable trusted mints
35. **Implement native memory wiping** — `sodium_memzero()` via native module
36. **Add jailbreak detection** — Warning (not blocking)
37. **Add Cashu mint quote rate limiting** — Batch with delay between requests
38. **Persist display preferences** — Add Zustand persist middleware
39. **Add passkey challenge verification** — Validate in authentication response
40. **Reduce oracle future timestamp window** — 10 seconds instead of 60

---

## 10. Positive Security Practices

The following implementations are **well-designed** and should be preserved:

| Practice | File | Notes |
|----------|------|-------|
| CSPRNG for all randomness | `crypto-polyfill.js` | iOS SecRandomCopyBytes, Android SecureRandom |
| PBKDF2 310K iterations | `pinHashing.ts` | OWASP 2023 compliant |
| Constant-time comparison | `pinHashing.ts:27-52` | Prevents timing attacks |
| withMnemonic() pattern | `secureStorageService.ts` | <100ms exposure window |
| Intent validation before signing | `psbtService.ts:565-606` | Validates recipient, amount, change |
| Input ownership verification | `transactionSigningService.ts:134-165` | Prevents signing others' UTXOs |
| TXID verification on broadcast | `transactionBroadcastService.ts:23-68` | Prevents MITM |
| BigInt for PSBT values | `btcTransaction.ts:277-286` | No precision loss |
| AES-256-GCM + HKDF | `passkey/encryption.ts` | RFC 5869 compliant |
| Fail-closed lockout | `pinLockout.ts:107-116` | Throws on storage failure |
| Atomic PIN change | `pinChange.ts:61-121` | Rollback on partial failure |
| Oracle freshness validation | `oracleService.ts:37-53` | 5-minute staleness check |
| BigInt health factor | `vaultUtils.ts:136-146` | Prevents overflow |
| Operation serialization | `vault/utils.ts:23-34` | Mutex for vault operations |
| Navigation guards | `RootNavigator.tsx:318-319` | Financial flows require auth |
| Error boundaries | `App.tsx`, all navigators | Per-screen isolation |
| Vault store factory | `vault/createVaultStore.ts` | DRY pattern for 4 stores |
| Proof durability | `cashuProofManager.ts` | Integrity hash + write verification |

---

*Report generated by 7 parallel specialized agents (5 security-auditor, 2 general-purpose) covering ~200 files across 16 review areas.*
