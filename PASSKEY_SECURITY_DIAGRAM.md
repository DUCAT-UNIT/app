# Ducat Wallet - Passkey Security Architecture

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WALLET CREATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Generate Random Mnemonic
┌──────────────────────┐
│   BIP39 Generator    │
│   (128-bit entropy)  │──────> "word1 word2 word3 ... word12"
└──────────────────────┘        (12-word mnemonic)


Step 2: User Creates Passkey + PIN
┌──────────────────────┐         ┌──────────────────────┐
│  Face ID / Touch ID  │         │   User enters PIN    │
│   (Biometric Auth)   │         │     (6 digits)       │
└──────────────────────┘         └──────────────────────┘
         │                                  │
         v                                  v
┌──────────────────────┐         ┌──────────────────────┐
│ Apple Creates Passkey│         │  Generate PIN Salt   │
│  - credentialId      │         │   (32 random bytes)  │
│  - userHandle        │         └──────────────────────┘
└──────────────────────┘                    │
         │                                  v
         │                        ┌──────────────────────┐
         │                        │ Hash PIN (PBKDF2)    │
         │                        │ - 10,000 iterations  │
         │                        │ - HMAC-SHA512        │
         │                        │ = 64-byte hash       │
         │                        └──────────────────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        v
         ┌──────────────────────────────────┐
         │   Derive Encryption Key (HKDF)   │
         │                                  │
         │  Input Material (IKM):           │
         │    credentialId +                │
         │    userHandle +                  │
         │    derivedPinHash                │
         │                                  │
         │  HKDF-SHA256                     │
         │    ↓                             │
         │  256-bit AES-GCM Key             │
         └──────────────────────────────────┘
                        │
                        v
         ┌──────────────────────────────────┐
         │   Encrypt Mnemonic (AES-256-GCM) │
         │                                  │
         │  Input:  12-word mnemonic        │
         │  Key:    Derived AES key         │
         │  Output: Encrypted blob +        │
         │          IV + Auth Tag           │
         └──────────────────────────────────┘
                        │
                        v
         ┌──────────────────────────────────┐
         │       Store on iCloud Keychain   │
         │                                  │
         │  ✓ Encrypted mnemonic            │
         │  ✓ IV (initialization vector)    │
         │  ✓ Auth tag                      │
         │  ✓ Credential ID                 │
         │  ✓ User handle                   │
         │  ✓ PIN salt                      │
         └──────────────────────────────────┘
                        │
                        v
         ┌──────────────────────────────────┐
         │    Store Locally (SecureStore)   │
         │                                  │
         │  ✓ PIN hash (for daily unlock)   │
         │  ✓ PIN salt                      │
         │  ✓ Encrypted mnemonic (copy)     │
         │  ✓ IV + Auth tag                 │
         └──────────────────────────────────┘
```

---

## Wallet Unlock Flow (Daily Use)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DAILY UNLOCK FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

User enters PIN
       │
       v
┌──────────────────────┐
│  Load PIN hash from  │
│   Local SecureStore  │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│  Hash entered PIN    │
│  (10,000 iterations) │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│  Constant-time       │
│  comparison          │──> ❌ Wrong PIN? Increment failed attempts
│  (timing safe)       │    (Lock after 10 attempts)
└──────────────────────┘
       │
       ✓ Correct
       v
┌──────────────────────┐
│  Reset rate limit    │
│  Unlock wallet       │
└──────────────────────┘
```

---

## Wallet Restore Flow (New Device)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       RESTORE FROM ICLOUD FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

User on new device
       │
       v
┌──────────────────────┐
│  Authenticate with   │
│  Face ID / Touch ID  │──────> Apple verifies biometric
└──────────────────────┘
       │
       v
┌──────────────────────┐
│  Passkey restored    │
│  from iCloud         │
│  - credentialId      │
│  - userHandle        │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Fetch from iCloud:   │
│  - Encrypted mnemonic│
│  - IV + Auth tag     │
│  - PIN salt          │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│  User enters PIN     │
│   (remembered)       │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Derive decryption key│
│   credentialId +     │
│   userHandle +       │
│   hashPin(PIN, salt) │
│      ↓ HKDF          │
│   AES-256 key        │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Decrypt mnemonic     │
│  (AES-256-GCM)       │──> ❌ Wrong PIN? Decryption fails
└──────────────────────┘
       │
       ✓ Success
       v
┌──────────────────────┐
│  Restore wallet      │
│  Derive addresses    │
│  from mnemonic       │
└──────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                │
└─────────────────────────────────────────────────────────────────────────┘

Layer 1: Biometric Authentication
┌────────────────────────────────────┐
│  ✓ Face ID / Touch ID              │
│  ✓ Hardware-backed                 │
│  ✓ Managed by Apple Secure Enclave│
└────────────────────────────────────┘

Layer 2: Passkey (WebAuthn)
┌────────────────────────────────────┐
│  ✓ FIDO2 standard                  │
│  ✓ Stored in iCloud Keychain       │
│  ✓ Synced across devices           │
│  ✓ Cannot be exported by Apple     │
└────────────────────────────────────┘

Layer 3: 6-Digit PIN
┌────────────────────────────────────┐
│  ✓ User-memorized secret           │
│  ✓ Hashed with 10,000 iterations   │
│  ✓ Never stored in plaintext       │
│  ✓ Rate-limited (10 attempts)      │
│  ✓ 30-min lockout after failures   │
└────────────────────────────────────┘

Layer 4: Encryption Key Derivation (HKDF)
┌────────────────────────────────────┐
│  Inputs:                           │
│    • Passkey credentials (Apple)   │
│    • Derived PIN (User secret)     │
│                                    │
│  Process: HKDF-SHA256              │
│  Output: 256-bit AES-GCM key       │
└────────────────────────────────────┘

Layer 5: Mnemonic Encryption
┌────────────────────────────────────┐
│  ✓ AES-256-GCM authenticated enc.  │
│  ✓ Random IV per encryption        │
│  ✓ Auth tag prevents tampering     │
└────────────────────────────────────┘

Layer 6: Storage
┌────────────────────────────────────┐
│  Local:                            │
│    • iOS SecureStore (encrypted)   │
│    • PIN hash for unlock           │
│                                    │
│  iCloud:                           │
│    • Encrypted mnemonic            │
│    • PIN salt                      │
│    • Passkey credentials           │
└────────────────────────────────────┘
```

---

## Attack Resistance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THREAT MODEL & DEFENSES                          │
└─────────────────────────────────────────────────────────────────────────┘

Threat: Apple tries to decrypt mnemonic
┌────────────────────────────────────────┐
│  Apple has:                            │
│    ✓ Passkey (credentialId, userHandle)│
│    ✓ Encrypted mnemonic from iCloud    │
│    ✓ PIN salt                          │
│                                        │
│  Apple doesn't have:                   │
│    ✗ User's 6-digit PIN                │
│                                        │
│  Result:                               │
│    Must brute force 1,000,000 PINs     │
│    @ 10,000 iterations each            │
│    = 10 billion hash operations        │
│    ≈ 28 hours @ 100,000 hashes/sec     │
└────────────────────────────────────────┘

Threat: User forgets PIN
┌────────────────────────────────────────┐
│  Can recover using:                    │
│    ✓ 12-word recovery phrase (backup)  │
│    ✓ Manual backup stored securely     │
│                                        │
│  Cannot decrypt:                       │
│    ✗ Encrypted mnemonic without PIN    │
└────────────────────────────────────────┘

Threat: PIN brute force attack
┌────────────────────────────────────────┐
│  Defenses:                             │
│    ✓ Rate limiting (10 attempts)       │
│    ✓ 30-minute lockout                 │
│    ✓ Fail-closed on errors             │
│    ✓ 10,000 iteration slowdown         │
│    ✓ Constant-time comparison          │
│                                        │
│  Result:                               │
│    Max 480 attempts/day                │
│    Would take ~2,083 days to try all   │
│    1,000,000 possible 6-digit PINs     │
└────────────────────────────────────────┘

Threat: Timing attacks on PIN comparison
┌────────────────────────────────────────┐
│  Defense:                              │
│    ✓ timingSafeEqual() comparison      │
│    ✓ Constant-time regardless of       │
│      where PIN differs                 │
└────────────────────────────────────────┘

Threat: Device loss/theft
┌────────────────────────────────────────┐
│  Local data protected by:              │
│    ✓ iOS SecureStore encryption        │
│    ✓ Hashed PIN (not plaintext)        │
│    ✓ Rate limiting prevents brute force│
│                                        │
│  Recovery on new device:               │
│    ✓ Passkey + PIN required            │
│    ✓ Face ID required for passkey      │
└────────────────────────────────────────┘
```

---

## Key Material Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CRYPTOGRAPHIC KEY DERIVATION                         │
└─────────────────────────────────────────────────────────────────────────┘

Random PIN Salt (32 bytes)
       │
       v
User's PIN (6 digits) ──────┐
                            │
                            v
                   ┌────────────────────┐
                   │ PBKDF2-HMAC-SHA512 │
                   │ 10,000 iterations  │
                   └────────────────────┘
                            │
                            v
                   Derived PIN Hash (64 bytes)
                            │
                            │
Passkey Credentials ────────┤
  • credentialId            │
  • userHandle              │
                            v
              ┌─────────────────────────────┐
              │  Concatenate (IKM)          │
              │  credentialId +             │
              │  userHandle +               │
              │  derivedPinHash             │
              └─────────────────────────────┘
                            │
                            v
              ┌─────────────────────────────┐
              │  HKDF-SHA256                │
              │  salt: "ducat-encryption-v3"│
              │  info: "aes-256-gcm-key"    │
              └─────────────────────────────┘
                            │
                            v
                   AES-256-GCM Key (32 bytes)
                            │
                            v
              ┌─────────────────────────────┐
              │  Encrypt/Decrypt Mnemonic   │
              │  with AES-256-GCM           │
              └─────────────────────────────┘
```

---

## Storage Locations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA STORAGE ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐         ┌──────────────────────────┐
│   Local SecureStore      │         │    iCloud Keychain       │
│   (iOS Device)           │         │    (Synced to Apple)     │
├──────────────────────────┤         ├──────────────────────────┤
│                          │         │                          │
│ ✓ PIN hash               │         │ ✓ Encrypted mnemonic     │
│   (10k iterations)       │         │ ✓ Encryption IV          │
│                          │         │ ✓ Encryption auth tag    │
│ ✓ PIN salt               │         │ ✓ Credential ID          │
│   (32 random bytes)      │         │ ✓ User handle            │
│                          │         │ ✓ PIN salt (copy)        │
│ ✓ Encrypted mnemonic     │         │                          │
│   (local copy)           │         │ Passkey (managed by iOS):│
│                          │         │ ✓ Private key            │
│ ✓ Encryption IV          │         │ ✓ Public key             │
│                          │         │                          │
│ ✓ Encryption auth tag    │         │                          │
│                          │         │                          │
└──────────────────────────┘         └──────────────────────────┘
         │                                      │
         v                                      v
   Used for daily                        Used for device
   unlock with PIN                       restore & sync
```

---

## PIN Change Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ATOMIC PIN CHANGE                               │
└─────────────────────────────────────────────────────────────────────────┘

User requests PIN change
       │
       v
┌──────────────────────┐
│ Backup current state │
│  - Old PIN hash      │
│  - Old PIN salt      │
│  - Old encrypted     │
│    mnemonic          │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Generate new salt    │
│ Hash new PIN         │
│ (10k iterations)     │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Save new PIN hash    │────> ❌ Fails?
│ and salt             │      Rollback to backup
└──────────────────────┘
       │
       ✓ Success
       v
┌──────────────────────┐
│ Re-encrypt mnemonic  │
│ with new PIN-derived │────> ❌ Fails?
│ encryption key       │      Rollback to backup
└──────────────────────┘
       │
       ✓ Success
       v
┌──────────────────────┐
│ Update iCloud with   │
│ new encrypted data   │
└──────────────────────┘
       │
       v
┌──────────────────────┐
│ Discard old backup   │
│ PIN change complete  │
└──────────────────────┘
```

---

## Summary: What Protects Your Bitcoin?

```
Your Bitcoin is protected by:

1. Random 12-word mnemonic (BIP39)
   └─> Encrypted with AES-256-GCM

2. Encryption key derived from:
   ├─> Passkey (Face ID protected, stored in iCloud)
   └─> 6-digit PIN (user-memorized, hashed 10k times)

3. Nobody can access your funds without:
   ├─> Your face/fingerprint (biometric)
   ├─> Your PIN (memorized secret)
   └─> Your device or iCloud access

4. Even Apple cannot decrypt your mnemonic:
   └─> They have the passkey but NOT your PIN
       (Would need 28 hours to brute force)

5. Rate limiting prevents PIN guessing:
   └─> 10 attempts → 30-min lockout
       (2,083 days to try all PINs)
```
