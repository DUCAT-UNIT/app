# WONT_DO - Deferred Security & Architecture Items

Items that were identified during audit but decided NOT to implement for testnet launch.

---

## 🔒 HTTPS/Network Security (Deferred)

### Certificate Pinning
**Status**: Won't implement
**Reason**: Transaction ID verification provides adequate protection for testnet. Too complex for current timeline.
**Details**: Would require maintaining certificate hashes and handling cert rotation.

### UTXO Validation Before Signing
**Status**: Won't implement
**Reason**: Not necessary for testnet. Low risk of MITM attacks on test network.
**Details**: Would validate each UTXO exists on blockchain before creating transaction.

### Balance Data Cross-Checking
**Status**: Won't implement
**Reason**: Visual discrepancies would be caught by users. Not critical for testnet.
**Details**: Would query multiple APIs and compare results.

### Multi-API Fallback
**Status**: Won't implement
**Reason**: Single API sufficient for testnet.
**Details**: Would provide redundancy if primary API fails.

---

## 🛡️ Additional Security Hardening (Deferred)

### Passkey PIN Iterations Increase
**Status**: Deferred to mainnet
**Reason**: Current 10k iterations acceptable for testnet. Would increase to 100k for mainnet.
**Impact**: Would strengthen brute-force resistance from ~2 hours to ~20 hours.

### Device-Specific Secret in Passkey Encryption
**Status**: Deferred to mainnet
**Reason**: Not critical for testnet funds.
**Details**: Would add device-specific entropy to prevent iCloud-only brute-force.

### Transaction Validation Before Signing
**Status**: Deferred
**Reason**: Users review transactions on screen. Low risk for testnet.
**Details**: Would validate recipient, amount, fees match expected values before signing.

### Change Address Ownership Validation
**Status**: Deferred
**Reason**: Transaction builder already sets correct change address.
**Details**: Would cryptographically verify change outputs belong to user's wallet.

---

## 📱 User Experience & Edge Cases (Deferred)

### Anti-Phishing/Screen Overlay Protection
**Status**: Won't implement
**Reason**: Android-specific attack. Low priority for iOS-first testnet.

### Longer PIN Support (8-10 digits)
**Status**: Deferred
**Reason**: 6-digit PIN sufficient with biometric as primary auth.

### Transaction Simulation Before Signing
**Status**: Deferred
**Reason**: Not necessary for testnet. Would catch invalid transactions before user signs.

### Maximum Transaction Size Check
**Status**: Deferred
**Reason**: Rare edge case. Would prevent >100KB transactions.

### Network Fee Market Awareness
**Status**: Deferred
**Reason**: Testnet doesn't have fee market pressure. Fixed 1 sat/vB works fine.

### Biometric Attempt Limits
**Status**: Deferred
**Reason**: Low risk. System biometric already has rate limiting.

### Jailbreak/Root Detection
**Status**: Won't implement
**Reason**: Warning only, doesn't prevent usage. Not critical.

### App Version Enforcement
**Status**: Deferred to mainnet
**Reason**: Testnet can run any version.

### Fuzzy Mnemonic Word Matching
**Status**: Won't implement
**Reason**: Exact BIP39 word matching is standard and secure.

---

## 🏗️ Architecture Improvements (Deferred)

### Coin Selection Algorithm Improvements
**Status**: Deferred
**Reason**: Current "largest first" works for testnet. Would implement Branch & Bound for mainnet privacy.

### Address Ownership Proof in Vault Operations
**Status**: Deferred
**Reason**: Vault service already validates.

### iCloud Backup Prominence Warning
**Status**: Deferred
**Reason**: Users already warned during wallet creation.

---

## 📊 Summary

**Total Deferred Items**: 22
**Critical Deferred**: 2 (Passkey iterations, Device secret)
**High Priority Deferred**: 4
**Medium Priority Deferred**: 10
**Low Priority Deferred**: 6

**Re-evaluate for Mainnet**: All critical and high priority items

---

**Last Updated**: 2025-11-17
**Decision**: Focus on testnet launch with current security posture
