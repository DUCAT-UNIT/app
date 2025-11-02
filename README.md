# DUCAT Wallet

A secure, non-custodial Bitcoin wallet for Mutinynet with native support for DUCAT•UNIT•RUNE tokens. Built with React Native and Expo.

## Overview

DUCAT Wallet is a mobile Bitcoin wallet that provides a seamless experience for managing both Bitcoin (BTC) and Runes protocol tokens (UNIT). The wallet implements the Bitcoin Runes protocol specification to enable fungible token transfers on Bitcoin's testnet.

### Key Features

- **Dual Asset Support**: Send and receive both BTC and UNIT (Runes) tokens
- **Secure Key Management**: BIP39 mnemonic-based HD wallet with secure device storage
- **Hierarchical Deterministic Wallets**: BIP32/BIP44/BIP84/BIP86 compliance
- **Multiple Address Types**: SegWit (P2WPKH) and Taproot (P2TR) support
- **Runes Protocol**: Native implementation of Bitcoin Runes with proper runestone encoding
- **Biometric Authentication**: Face ID / Touch ID support
- **Privacy Mode**: Screenshot protection and inactivity auto-lock
- **Jailbreak Detection**: Enhanced security for rooted/jailbroken devices
- **Real-time Price Feeds**: BTC/USD price tracking
- **Transaction Intents**: Review-before-sign transaction flow

## Technical Stack

### Core Technologies
- **React Native**: Cross-platform mobile framework
- **Expo**: Development and build tooling
- **bitcoinjs-lib v7**: Bitcoin transaction construction and signing
- **@bitcoinerlab/secp256k1**: Elliptic curve cryptography (Schnorr signatures)
- **bip32/bip39**: HD wallet key derivation

### Key Libraries
- `expo-secure-store`: Secure mnemonic storage
- `expo-local-authentication`: Biometric authentication
- `expo-screen-capture`: Privacy mode (screenshot blocking)
- `expo-crypto`: Cryptographic utilities
- `react-native-get-random-values`: Secure random number generation

## Installation

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Physical iOS device for production testing

### Setup

```bash
# Clone the repository
git clone https://github.com/DUCAT-UNIT/app.git
cd app/app

# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on physical iOS device
npx expo run:ios --device "Device Name"
```

## Architecture

### Wallet Structure

The wallet implements a hierarchical deterministic (HD) wallet structure following Bitcoin standards:

- **Segwit (P2WPKH)**: `m/84'/1'/0'/0/{account}` - Used for BTC transactions and fee payments
- **Taproot (P2TR)**: `m/86'/1'/0'/0/{account}` - Used for holding and transferring Runes

### Transaction Flow

1. **Intent Creation**: User selects asset type, enters amount and recipient
2. **UTXO Selection**: Wallet automatically selects optimal UTXOs
3. **Transaction Construction**: PSBT created with proper inputs/outputs
4. **Review**: User reviews transaction details
5. **Signing**: Transaction signed with derived keys (memory securely cleared)
6. **Broadcasting**: Signed transaction broadcast to Mutinynet
7. **Confirmation**: Transaction ID displayed to user

### Runes Implementation

The wallet implements a custom runestone encoder (`runestone-encoder.js`) that follows the Bitcoin Runes specification:

- **LEB128 Varint Encoding**: Compact integer encoding for all fields
- **Delta Encoding**: Efficient rune ID encoding (block/tx pairs)
- **Edict Serialization**: Proper tag/value pair construction
- **OP_RETURN Format**: `OP_RETURN OP_13 OP_PUSHBYTES_N <payload>`

#### Runestone Structure

```javascript
{
  edicts: [
    {
      id: { block: BigInt, tx: BigInt },
      amount: BigInt,
      output: number
    }
  ]
}
```

#### Transaction Output Order (Critical)

For ordinal-aware transactions, output order is strictly enforced:

1. **Output 0**: Rune return address (receives unallocated runes)
2. **Output 1**: Recipient (receives runes specified in edict)
3. **Output 2**: Change (if any)
4. **Output 3**: OP_RETURN with runestone (always last)

## Security Features

### Key Management
- **BIP39 Mnemonic**: 12-word seed phrase stored in device keychain
- **Secure Memory Handling**: Sensitive data overwritten with random bytes after use
- **No Key Export**: Private keys never leave secure storage

### Authentication
- **Biometric Lock**: Face ID / Touch ID required for sensitive operations
- **PIN Protection**: 6-digit PIN as fallback authentication
- **Inactivity Timeout**: Auto-lock after 2 minutes of inactivity

### Privacy
- **Screenshot Protection**: Prevents screenshots when privacy mode enabled
- **Jailbreak Detection**: Warns users of compromised device security
- **No Analytics**: No tracking or data collection

### Transaction Security
- **Review-Before-Sign**: All transactions reviewed before signing
- **UTXO Verification**: Checks UTXO spend status before broadcasting
- **Ordinal Awareness**: Prevents accidental transfer of inscriptions/runes

## Network

The wallet currently operates on **Mutinynet**, a Bitcoin signet test network.

- **Block Explorer**: https://mutinynet.com
- **Ord Indexer**: https://ord-mutinynet.ducatprotocol.com
- **Faucet**: https://faucet.mutinynet.com

## Development

### Project Structure

```
app/
├── App.js                    # Main application component
├── crypto-polyfill.js        # React Native crypto polyfills
├── runestone-encoder.js      # Custom Runes protocol encoder
├── package.json              # Dependencies and scripts
├── app.json                  # Expo configuration
└── assets/                   # Images and icons
    ├── ducat-logo.png
    └── unit-logo.png
```

### Key Components

- **Wallet Creation**: BIP39 mnemonic generation and HD wallet setup
- **Balance Display**: Real-time BTC and UNIT balance fetching
- **Transaction Intent**: Multi-step transaction creation flow
- **Taproot Signing**: Manual key tweaking for Taproot inputs
- **Runestone Encoding**: Custom LEB128 encoding for Runes protocol

### Building for Production

```bash
# iOS build
npx expo run:ios --configuration Release

# Create IPA
eas build --platform ios --profile production

# Android build
eas build --platform android --profile production
```

## Runes Protocol Implementation

### Specification Compliance

The wallet implements the Runes protocol as defined by the `ord` reference implementation. Key points:

- **Tag 0 (Body)**: Marks edict data
- **Delta Encoding**: Block/TX IDs encoded as deltas from previous values
- **Absolute TX**: When block delta > 0, TX index is absolute (not delta)
- **Output Indexing**: Edicts reference outputs by index (0-based)

### Example Runestone

Sending 100 UNIT to output 1:

```
Payload: 00 b89c5d 01 64 01
  00        = Tag 0 (edicts)
  b89c5d    = Block 1527352 (LEB128)
  01        = TX 1 (absolute)
  64        = Amount 100 (LEB128)
  01        = Output 1

Full Script: 6a 5d 07 00b89c5d016401
  6a        = OP_RETURN
  5d        = OP_13
  07        = OP_PUSHBYTES_7
  payload   = Edict data
```

## Troubleshooting

### Common Issues

**Build failures on iOS:**
- Ensure Xcode Command Line Tools are installed: `xcode-select --install`
- Clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Reinstall dependencies: `rm -rf node_modules && npm install`

**Crypto errors in React Native:**
- The app includes necessary polyfills (`crypto-polyfill.js`)
- Ensure `react-native-get-random-values` is imported first
- Rebuild app after dependency changes

**Empty runestone edicts:**
- Verify `@magiceden-oss/runestone-lib` is NOT being used (broken in RN)
- Ensure custom encoder (`runestone-encoder.js`) is imported
- Check that edict values are BigInt type

## Contributing

Contributions are welcome! Please ensure:

1. Code follows existing patterns and style
2. Sensitive data handling follows security best practices
3. All Bitcoin operations use proper network parameters
4. Runes protocol changes match `ord` specification

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Bitcoin Core developers
- Ordinals/Runes protocol by Casey Rodarmor
- bitcoinjs-lib contributors
- Expo team

## Support

For issues and questions:
- GitHub Issues: https://github.com/DUCAT-UNIT/app/issues
- Documentation: https://docs.ducatprotocol.com

---

**⚠️ Testnet Only**: This wallet operates on Mutinynet (Bitcoin signet). Do not use real Bitcoin.

**🔐 Security Notice**: Always verify recipient addresses. Transactions are irreversible.
