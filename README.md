# DUCAT Wallet

> The Bitcoin wallet where on-chain meets off-chain. Hold BTC and UNIT in one place. Send UNIT instantly for free.

[![iOS](https://img.shields.io/badge/iOS-14.0+-000000?style=flat&logo=apple)](https://apps.apple.com) [![Android](https://img.shields.io/badge/Android-Compatible-3DDC84?style=flat&logo=android)](https://play.google.com) [![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=flat&logo=react)](https://reactnative.dev) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![TestFlight](https://img.shields.io/badge/TestFlight-Available-blue)](https://testflight.apple.com)

## What is UNIT?

**UNIT** is a Bitcoin Runes token (specifically `DUCAT•UNIT•RUNE`) that exists in two forms:

| Form | Where it lives | Speed | Fees |
|------|----------------|-------|------|
| **On-chain UNIT** | Bitcoin blockchain (Taproot address) | ~10 min confirmation | Network fees |
| **E-cash UNIT** | Cashu mint (off-chain) | Instant | Free |

Both forms represent the same asset. You can convert between them freely inside the wallet.

## Why does this exist?

Bitcoin is secure but slow and expensive for small payments. E-cash is instant and free but requires trust in the mint. UNIT bridges these worlds:

- **Store value on-chain** with Bitcoin's security guarantees
- **Spend instantly off-chain** when you need speed
- **Convert back anytime** — your keys, your choice

Think of it like moving money between a savings account (on-chain) and a checking account (e-cash). Same money, different trade-offs.

## Core Features

### Turbo — Convert On-chain UNIT to E-cash

When you want instant, fee-less transfers:

1. Tap **Turbo** on your UNIT balance
2. Send your on-chain UNIT to the Cashu mint
3. Receive e-cash proofs (cryptographic IOUs from the mint)
4. Your e-cash UNIT appears in your balance instantly

### Fuse — Convert E-cash back to On-chain

When you want Bitcoin's security:

1. Tap **Fuse** on your UNIT balance
2. Send your e-cash proofs to the mint
3. Receive on-chain UNIT to your Taproot address
4. Confirmed on the Bitcoin blockchain

### TurboUNIT Transfers — Send to any Taproot address

The magic: you can send e-cash UNIT to anyone's **Taproot Bitcoin address** — no app install needed for the recipient.

How it works:
- Taproot addresses contain a public key (the `tb1p...` part)
- E-cash tokens are locked to that public key using Cashu's P2PK (Pay-to-Public-Key)
- Only the owner of that Bitcoin address can claim the e-cash

Send flow:
1. Enter recipient's Taproot address
2. E-cash is minted and locked to their public key
3. Share the claim link (QR code or URL)
4. Recipient claims with their Taproot private key

### Vault — Borrow UNIT against BTC collateral

Lock your BTC, mint fresh UNIT:

1. Deposit BTC as collateral
2. Borrow UNIT at a collateralization ratio
3. Use UNIT for payments
4. Repay UNIT + interest to unlock BTC

This creates new UNIT supply, backed by real Bitcoin.

## The Full Picture

```
┌─────────────────────────────────────────────────────────────┐
│                     DUCAT WALLET                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │     BTC      │              │     UNIT     │            │
│  │  (SegWit)    │              │  (Taproot)   │            │
│  │              │              │              │            │
│  │  Send/Receive│              │ On-chain     │            │
│  │  Standard BTC│     ┌────────│ Runes Token  │            │
│  └──────────────┘     │        └──────────────┘            │
│                       │               │                     │
│                       ▼               │ Turbo               │
│               ┌──────────────┐        │                     │
│               │    VAULT     │        ▼                     │
│               │              │  ┌──────────────┐            │
│               │ BTC → UNIT   │  │  E-cash UNIT │            │
│               │ (Collateral) │  │              │            │
│               │              │  │  Instant     │            │
│               │ UNIT → BTC   │  │  Free        │            │
│               │ (Repay)      │  │  Off-chain   │◄── Fuse    │
│               └──────────────┘  └──────────────┘            │
│                                        │                     │
│                                        ▼                     │
│                              ┌──────────────────┐           │
│                              │  TurboUNIT Send  │           │
│                              │                  │           │
│                              │  Send to Taproot │           │
│                              │  address via     │           │
│                              │  P2PK e-cash     │           │
│                              └──────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Security

- **Non-custodial**: You hold your keys (12-word seed phrase)
- **Passkey backup**: Encrypted cloud backup via WebAuthn/iCloud
- **Biometric auth**: Face ID / Touch ID for transactions
- **PIN protection**: PBKDF2-hashed 6-digit PIN
- **Screenshot blocking**: Sensitive screens protected

## Architecture

### 📁 Project Structure

```
app/
├── components/          # Reusable UI components (organized by feature)
│   ├── amountInput/    # Currency input with validation
│   ├── assetDetail/    # Asset detail views with pagination
│   ├── charts/         # Price charts and visualizations
│   ├── review/         # Transaction review components
│   └── transaction/    # Transaction list and formatting
├── constants/          # App-wide constants and configuration
│   └── security.js     # Security settings (PIN, crypto, passkey)
├── contexts/           # React Context providers (94 tests)
│   ├── AuthContext.js      # Authentication state
│   ├── VaultContext.js     # Vault WebView integration
│   └── WalletContext.js    # Wallet state management
├── hooks/              # Custom React hooks with full test coverage
│   ├── useAuth.js          # Authentication logic
│   ├── usePasskey*.js      # Passkey creation/restore
│   └── useWallet*.js       # Wallet operations
├── navigation/         # React Navigation setup
├── pages/              # Full-screen page components
├── screens/            # Feature-specific screens
│   ├── auth/           # Onboarding, PIN, biometric
│   ├── send/           # Send flow (amount, asset, review)
│   ├── settings/       # App settings and preferences
│   └── wallet/         # Main wallet and asset detail
├── services/           # Business logic layer
│   ├── passkey/        # WebAuthn implementation (modular)
│   ├── transaction/    # Bitcoin & Runes transactions
│   ├── pinService.js   # PIN hashing and validation
│   ├── secureStorageService.js  # Encrypted storage
│   └── walletService.js         # HD wallet operations
├── styles/             # Centralized StyleSheet definitions
├── utils/              # Utility functions
│   ├── bitcoin/        # Bitcoin-specific utilities
│   └── formatters/     # Display formatting helpers
└── app.json            # Expo configuration

316 source files | 94 test suites | All under 300 lines
```

### 🏛️ Technical Stack

**Core Framework**
- React Native 0.76 with New Architecture enabled
- Expo SDK 54 for development tooling
- React Navigation 7 for routing

**Bitcoin Implementation**
- `bitcoinjs-lib` v7 - Transaction construction
- `@bitcoinerlab/secp256k1` - Schnorr signatures (Taproot)
- `bip32`/`bip39` - HD wallet key derivation
- Custom Runes protocol encoder (LEB128 varint)

**Security**
- `expo-secure-store` - iOS Keychain integration
- `expo-local-authentication` - Biometric auth
- `react-native-passkey` - WebAuthn/FIDO2
- `react-native-quick-crypto` - Cryptographic primitives
- `expo-screen-capture` - Screenshot prevention

**State Management**
- React Context API for global state
- Custom hooks for business logic
- Async storage for preferences

**Testing & Quality**
- Jest with 94 test suites
- React Native Testing Library
- ESLint + Prettier
- All files under 300 lines (maintainability standard)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Xcode 15+ (iOS development)
- EAS CLI for builds

### Installation

```bash
# Clone repository
git clone https://github.com/DUCAT-UNIT/app.git
cd app/app

# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS
npx expo run:ios

# Run tests
npm test
```

### Environment Setup

The app operates on **Mutinynet** (Bitcoin signet testnet):

```javascript
// Network configuration
NETWORK: networks.testnet  // bitcoinjs-lib
ORD_API: "https://ord-mutinynet.ducatprotocol.com"
EXPLORER: "https://mutinynet.com"
```

## 📱 Platform Support

### iOS & Android Compatibility

DUCAT Wallet is built with React Native and supports both iOS and Android platforms with the following feature matrix:

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| **Core Wallet** |
| Bitcoin Transactions | ✅ | ✅ | Full BTC send/receive |
| Runes Protocol | ✅ | ✅ | Native Runes support |
| HD Wallet (BIP32/39/84/86) | ✅ | ✅ | Hierarchical deterministic |
| SegWit & Taproot | ✅ | ✅ | P2WPKH and P2TR |
| UTXO Management | ✅ | ✅ | Optimized selection |
| **Security** |
| Secure Storage | ✅ | ✅ | iOS Keychain / Android Keystore |
| PIN Authentication | ✅ | ✅ | PBKDF2 hashing (10k iterations) |
| Biometric Auth | ✅ | ✅ | Face ID/Touch ID / Fingerprint |
| Screenshot Prevention | ✅ | ✅ | Privacy mode |
| Auto-lock | ✅ | ✅ | Inactivity timeout |
| **Passkey Features** |
| Passkey Creation | ✅ | ✅ | WebAuthn/FIDO2 |
| Passkey Authentication | ✅ | ✅ | Biometric unlock |
| Cloud Backup | ✅ iCloud | ⚠️ Limited | iOS: iCloud sync<br>Android: Local only* |
| Cross-device Recovery | ✅ | ⚠️ | iOS: Full support<br>Android: Same device only* |

**\*Note:** Android cloud backup requires Google Drive integration (planned feature). Current Android builds support all wallet functionality but passkey recovery is limited to the same device.

### Building for Android

```bash
# Build Android APK
eas build --platform android --profile production

# Run on Android emulator
npx expo run:android

# Run on physical device
npx expo run:android --device
```

### Platform-Specific Features

**iOS:**
- iCloud encrypted backup for passkey recovery
- Cross-device wallet restoration via iCloud Keychain
- Associated domains for passkey support
- TestFlight distribution

**Android:**
- Android Keystore for secure storage
- Google Password Manager for passkey sync
- Manual seed phrase backup (recommended)
- APK/AAB distribution

## 🔐 Security Features

### Key Management

**BIP39 Mnemonic**
- 12-word seed phrase
- Stored in iOS Keychain (hardware-encrypted)
- Never leaves secure storage
- Securely wiped from memory after use

**Hierarchical Deterministic Wallets**
```
Master Seed (BIP39)
  ├── SegWit:  m/84'/1'/0'/0/{index}  (BTC, fees)
  └── Taproot: m/86'/1'/0'/0/{index}  (Runes)
```

### Passkey Integration

**WebAuthn/FIDO2 Implementation**
- Encrypted mnemonic backup to iCloud
- PIN + biometric authentication
- Cross-device wallet restoration
- No server-side storage required

**Encryption Flow**
```
Mnemonic → Passkey-Derived Key → AES-256-GCM → iCloud
```

### Authentication Layers

1. **Device Unlock** - iOS passcode/biometric
2. **App PIN** - 6-digit with PBKDF2 hashing
3. **Biometric** - Face ID/Touch ID for transactions
4. **Passkey** - WebAuthn for recovery operations

### Privacy & Protection

- Screenshot blocking on sensitive screens
- Auto-lock after inactivity (configurable)
- Jailbreak detection
- Rate limiting (10 failed attempts = 30min lockout)
- No analytics or tracking

## 💸 Bitcoin & Runes Implementation

### Transaction Construction

**SegWit (P2WPKH) - BTC Transactions**
```javascript
// UTXO selection with fee optimization
const psbt = new bitcoin.Psbt({ network });
psbt.addInput({
  hash: utxo.txid,
  index: utxo.vout,
  witnessUtxo: {
    script: p2wpkh.output,
    value: utxo.value
  }
});
```

**Taproot (P2TR) - Runes Transactions**
```javascript
// Manual key tweaking for Taproot
const tweakedPrivKey = taprootKeyPair.tweak(
  crypto.taggedHash('TapTweak', internalPubkey)
);
psbt.signInput(0, tweakedPrivKey);
```

### Runes Protocol

**Custom LEB128 Encoder**
- Compliant with Bitcoin Runes specification
- Delta encoding for block/tx IDs
- Varint encoding for amounts
- Proper runestone serialization

**Transaction Structure**
```
Outputs:
  0: Rune return address (unallocated runes)
  1: Recipient address (receives edicts)
  2: Change output (optional)
  3: OP_RETURN (runestone)

Runestone Format:
  OP_RETURN OP_13 <payload>
  Payload: [tag][value]...[tag][value]
```

**Example Edict**
```javascript
{
  id: { block: 1527352n, tx: 1n },
  amount: 100n,
  output: 1
}
// Encoded: 00 b89c5d 01 64 01
```

### UTXO Management

- Automatic UTXO selection for optimal fees
- Ordinal-aware UTXO filtering
- Prevents accidental loss of inscriptions
- Consolidation for dust management

## Technical Deep Dive: TurboUNIT

> See [TurboUNIT Transfers](#turbunit-transfers--send-to-any-taproot-address) above for the user-facing explanation.

### Why Taproot + Cashu P2PK Works

**The Key Insight**: Taproot addresses directly encode an x-only public key (32 bytes) — the exact format used by Cashu's NUT-11 P2PK specification. This creates a natural cryptographic bridge.

```
Taproot Address: tb1p7wqu4fh5g3w3rmxq6vyc5aqc05ru3ywrdyx0...
                        └─────────────────────────────────┘
                              32-byte x-only public key
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   Cashu P2PK Locked Token     │
                        │   (NUT-11 Specification)      │
                        │   Locked to same pubkey       │
                        └───────────────────────────────┘
```

**Why Taproot (not SegWit)?**
- SegWit encodes a *hash* of the pubkey — you'd need a key exchange
- Taproot encodes the *actual* pubkey — ready to use directly
- Taproot is already standard for Runes/Ordinals — users have these addresses

**Implementation**:

```javascript
// Extract pubkey from Taproot address
const extractPubkeyFromTaprootAddress = (address) => {
  const decoded = bitcoin.address.fromBech32(address);
  return Buffer.from(decoded.data).toString('hex');
};

// Lock e-cash to that pubkey
const result = await sendP2PKToken(amount, recipientPubkey);
```

### Security Properties

- **Address-Bound**: Only the owner of the Taproot private key can spend the e-cash
- **Non-Custodial**: The mint cannot spend P2PK locked tokens—they require recipient's signature
- **Recoverable**: If unclaimed, sender can reclaim using locktime conditions (NUT-11)
- **Instant**: No on-chain confirmation needed—recipient can spend immediately
- **Private**: E-cash transfers don't appear on the blockchain

### Implementation

```javascript
// In useTurboMintCompletion.js
const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
const result = await sendP2PKToken(mintAmount, recipientPubkey, {});
// Token is now cryptographically bound to recipient's Bitcoin address
```

This elegant design leverages Taproot's architecture to create seamless interoperability between Bitcoin's on-chain security model and Cashu's off-chain privacy and speed—without requiring users to manage separate key pairs or understand the underlying cryptography

## 📱 User Flows

### Wallet Creation
1. Generate BIP39 mnemonic (12 words)
2. Display seed phrase with verification
3. Create 6-digit PIN
4. Enable biometric authentication (optional)
5. Create passkey backup (optional)

### Sending Bitcoin
1. Select asset (BTC or UNIT)
2. Enter amount and recipient address
3. Review transaction details (fee, total)
4. Authenticate with biometric/PIN
5. Sign and broadcast transaction

### Passkey Recovery
1. Select "Restore with Passkey"
2. Enter PIN from original setup
3. Authenticate with Face ID/Touch ID
4. Decrypt mnemonic from iCloud
5. Restore wallet with full balance

## 🧪 Testing

**Comprehensive Test Coverage**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test Organization**
- **94 test suites** covering critical paths
- Unit tests for services and utilities
- Integration tests for contexts and hooks
- Component tests with Testing Library

**Key Test Areas**
- Wallet creation and restoration
- Transaction construction and signing
- Passkey encryption/decryption
- PIN validation and lockout
- UTXO selection algorithms

## 📦 Building & Deployment

### Development Builds

**iOS:**
```bash
# iOS simulator
npx expo run:ios

# Physical device
npx expo run:ios --device "iPhone Name"
```

**Android:**
```bash
# Android emulator
npx expo run:android

# Physical device (USB debugging enabled)
npx expo run:android --device
```

### Production Builds

**iOS - TestFlight:**
```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Monitor build status
eas build:list --platform ios
```

**Android - Google Play:**
```bash
# Build APK/AAB
eas build --platform android --profile production

# Submit to Google Play (internal testing)
eas submit --platform android --latest

# Or download APK for manual distribution
# APK available in EAS build artifacts
```

### Multi-Platform Build

```bash
# Build both platforms simultaneously
eas build --platform all --profile production
```

### EAS Configuration

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "credentialsSource": "remote",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-email@example.com",
        "ascAppId": "your-app-id",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account.json",
        "track": "internal"
      }
    }
  }
}
```

## 🔧 Configuration

### Security Constants

```javascript
// constants/security.js
export const PIN = {
  MIN_LENGTH: 6,
  MAX_ATTEMPTS: 10,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000
};

export const PASSKEY = {
  RP_NAME: 'Ducat Wallet',
  RP_ID: 'ducatprotocol.com',
  TIMEOUT_MS: 60000
};
```

### Network Configuration

```javascript
// Mutinynet (Bitcoin signet testnet)
const network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: { public: 0x043587cf, private: 0x04358394 },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef
};
```

## 🛠️ Development

### Code Standards

- **File Size**: All files under 300 lines
- **Formatting**: Prettier + ESLint
- **Testing**: Jest with >80% coverage target
- **Documentation**: JSDoc for public APIs

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/description

# Make changes and test
npm test

# Commit with descriptive message
git commit -m "Add feature: description"

# Push and create PR
git push origin feature/description
```

### Refactoring Principles

1. Extract components over 300 lines
2. Modularize services into focused files
3. Remove dead code and duplicates
4. Maintain backward compatibility

## 🐛 Troubleshooting

### Common Issues

**Metro bundler crashes**
```bash
rm -rf node_modules && npm install
npx expo start --clear
```

**Crypto errors in React Native**
```bash
# Ensure polyfills are loaded first
import 'react-native-get-random-values';
import { crypto } from 'react-native-quick-crypto';
```

**Build number conflicts**
```bash
# Auto-increment is enabled in eas.json
# Manually bump if needed in app.json
```

**Passkey not working**
```bash
# Verify associated domains in app.json
"associatedDomains": [
  "webcredentials:ducatprotocol.com",
  "applinks:ducatprotocol.com"
]
```

## 📚 Resources

- **Bitcoin Development**: [LearnMeABitcoin.com](https://learnmeabitcoin.com)
- **Runes Protocol**: [Runestone Spec](https://docs.ordinals.com/runes.html)
- **BIP Standards**: [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), [BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), [BIP86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) (Taproot)
- **Cashu Protocol**: [Cashu Specs](https://github.com/cashubtc/nuts) - [NUT-11 P2PK](https://github.com/cashubtc/nuts/blob/main/11.md) (Pay-to-Public-Key locked tokens)
- **WebAuthn**: [W3C Specification](https://www.w3.org/TR/webauthn/)
- **Expo Docs**: [Expo.dev](https://docs.expo.dev)

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Follow code standards (ESLint + Prettier)
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Bitcoin Core developers
- Casey Rodarmor (Ordinals/Runes protocol)
- bitcoinjs-lib contributors
- Expo and React Native teams
- DUCAT Protocol community

---

**⚠️ Testnet Only**: This wallet operates on Mutinynet (Bitcoin signet). Do not use with real Bitcoin on mainnet.

**🔐 Security Notice**: Always verify recipient addresses. Bitcoin transactions are irreversible.

**💡 Support**: For issues and questions, please visit [GitHub Issues](https://github.com/DUCAT-UNIT/app/issues) or [Documentation](https://ducatprotocol.com).
