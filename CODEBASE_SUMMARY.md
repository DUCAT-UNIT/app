# DUCAT Bitcoin Wallet - Quick Reference Guide

## Project Overview
- **Name:** DUCAT
- **Type:** React Native/Expo Bitcoin Wallet
- **Network:** Testnet (Mutinynet/Signet)
- **Platforms:** iOS, Android
- **Latest Versions:** React 19.1.0, React Native 0.81.5, Expo 54.0.20

## Key Statistics
- **Total Source Files:** ~260 JavaScript/JSX files
- **Components:** 45+ reusable UI components
- **Screens:** 15 main screens
- **Contexts:** 13 global state providers
- **Hooks:** 39 custom React hooks
- **Services:** 20+ business logic services
- **Test Files:** 30+ test files
- **Estimated LOC:** 50,000+ lines

## Directory Structure

```
app/
├── screens/          # 15 screens (auth, wallet, send, settings)
├── components/       # 45+ components (modals, cards, icons)
├── contexts/         # 13 global state providers
├── hooks/            # 39 custom hooks
├── services/         # 20+ services (crypto, transactions, storage)
├── utils/            # Bitcoin utilities, helpers, formatters
├── constants/        # Bitcoin, security, and UI constants
├── navigation/       # React Navigation setup (6 files)
├── theme/            # Styling and theming
├── assets/           # Images, fonts, logos
└── App.js            # Main entry point
```

## Technology Stack

### Bitcoin & Crypto
- bitcoinjs-lib 7.0.0 (transaction creation/signing)
- bip32 5.0.0 (HD wallet derivation)
- bip39 3.1.0 (mnemonic generation)
- @magiceden-oss/runestone-lib (Runes/UNIT support)
- react-native-quick-crypto (native crypto ops)

### Security & Storage
- expo-secure-store (encrypted storage)
- expo-local-authentication (biometrics)
- react-native-passkey (WebAuthn)
- react-native-icloudstore (iCloud backup)

### UI & Navigation
- @react-navigation/* (stack, tabs, native)
- react-native-svg (SVG rendering)
- react-native-qrcode-svg (QR codes)
- expo-linear-gradient (gradients)

### Error Tracking
- @sentry/react-native (error monitoring)

## Architecture

### Provider Hierarchy
```
App
├── AuthProvider
├── WalletProvider
└── UIProvider
    └── AppProviders
        ├── PendingTransactionsProvider
        ├── WalletDataProvider
        └── PriceProvider
            └── AppNavigator
```

### Navigation Stack
- **AuthStack:** WelcomeScreen → PinSetupScreen → LockScreen
- **MainTabs:** Wallet, Send (modal), Settings, Vault
- **Wallet Stack:** WalletScreen → AssetDetail → Receive → History
- **Send Flow:** Asset → Address → Amount → Review → Confirmation

## Security Architecture

### Key Storage
- **Mnemonic:** BIP39 12-word, stored in SecureStore (OS-encrypted)
- **Accounts:** BIP84 (SegWit) + BIP86 (Taproot) multi-account
- **Private Keys:** Never stored, derived on-demand from mnemonic
- **Memory Safety:** `withMnemonic()` pattern clears memory after 100ms

### Authentication
1. **PIN:** 6-digit PBKDF2 (10k iterations), 30-min lockout after 10 failures
2. **Biometric:** Face ID/Touch ID with PIN fallback
3. **Passkey:** WebAuthn with AES-256-GCM encrypted backup to iCloud

### Input Validation
- Bitcoin addresses: testnet-only (tb1q, tb1p prefixes)
- Amounts: dust limit (546 sats), minimum (1,000 sats)
- Fee rates: 1-1,000 sats/vB range

## Bitcoin Integration

### Network Configuration
- **Network:** Mutinynet (testnet/signet)
- **APIs:** mutinynet.com, ducatprotocol.com, coingecko.com
- **Address Types:**
  - SegWit: `m/84'/1'/0'/0/{i}` → `tb1q...`
  - Taproot: `m/86'/1'/0'/0/{i}` → `tb1p...`

### Transaction Support
- **BTC Transactions:** P2WPKH (SegWit) and P2TR (Taproot)
- **Runes (UNIT):** Two-input pattern with runestone encoding
- **Fee Model:** sats-per-vByte (default 1 sats/vB testnet)

### UTXO Selection
1. Merge confirmed + unconfirmed UTXOs
2. Filter dust (< 546 sats)
3. Select optimal inputs for amount
4. Calculate fees and change

## Key Files (Quick Lookup)

### Entry Point
- `App.js` - Provider setup, Bitcoin initialization, Sentry config

### Authentication
- `services/authService.js` - Mnemonic storage interface
- `services/pinService.js` - PIN hashing, verification (PBKDF2)
- `services/passkeyService.js` - WebAuthn, iCloud backup (1,106 lines)
- `services/biometricService.js` - Face ID/Touch ID

### Bitcoin Operations
- `utils/bitcoin.js` - Address derivation, validation (BIP84/BIP86)
- `services/walletService.js` - Wallet creation, import, switching
- `services/transaction/btcTransaction.js` - Build BTC transactions
- `services/transaction/runesTransaction.js` - Build Runes transactions
- `services/transactionSigningService.js` - Sign PSBTs (Taproot quirks)
- `services/transactionBroadcastService.js` - Broadcast to network

### State Management
- `contexts/AuthContext.js` - Auth + onboarding state
- `contexts/WalletContext.js` - Wallet addresses, account switching
- `contexts/TransactionBuildContext.js` - PSBT construction
- `contexts/TransactionExecutionContext.js` - Signing + broadcast

### Screens
- Wallet: `WalletScreen.jsx`, `AssetDetailScreen.jsx`, `ReceiveScreen.jsx`
- Send: `AssetSelectorScreen.jsx`, `AddressInputScreen.jsx`, `AmountInputScreen.jsx`, `ReviewScreen.jsx`
- Auth: `WelcomeScreen.jsx`, `PinSetupScreen.jsx`, `LockScreen.jsx`
- Settings: `SettingsScreen.jsx`

### Constants
- `utils/constants.js` - API endpoints, secure storage keys
- `constants/bitcoin.js` - Fee rates, dust limits, derivation paths
- `constants/security.js` - PIN, passkey, session, biometric config

## Common Tasks

### Adding a New Screen
1. Create file in `screens/{category}/ScreenName.jsx`
2. Add to navigation stack (`navigation/StackNavigator.js`)
3. Add screen route in navigator config

### Adding a Bitcoin Feature
1. Create service in `services/transaction/feature.js`
2. Export from `services/transaction/index.js`
3. Add hook in `hooks/useTransaction*.js`
4. Update UI in relevant screen
5. Test with testnet UTXOs

### Modifying Security
1. Update constants in `constants/security.js`
2. Update service implementation
3. Add migration path for existing users
4. Test lockout/recovery scenarios

### Adding a New API Endpoint
1. Add URL to `utils/constants.js` (API object)
2. Create service method in relevant `services/*.js`
3. Add error handling with user-friendly messages
4. Implement retry logic with exponential backoff

## Critical Security Patterns

### Pattern: withMnemonic() - ALWAYS use this
```javascript
// GOOD
const result = await withMnemonic(async (mnemonic) => {
  const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);
  return addresses;
});
// Mnemonic auto-wiped after function returns

// BAD - Don't do this
const mnemonic = await getMnemonic();
const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);
// Mnemonic stays in memory!
```

### Pattern: Input Validation - Always validate user input
```javascript
// GOOD
const validation = validateBitcoinAddress(userInput);
if (!validation.valid) {
  throw new Error(validation.error);
}

// BAD - Trusting user input
const txid = await broadcastTransaction(psbt, userAddress);
```

### Pattern: Rate Limiting - Protect sensitive operations
```javascript
// PIN attempts are rate-limited
const remainingAttempts = await getRemainingPinAttempts();
if (remainingAttempts <= 0) {
  // User locked out for 30 minutes
}
```

## Deployment Checklist

- [ ] Set EXPO_PUBLIC_COINGECKO_API_KEY environment variable
- [ ] Verify Sentry DSN in App.js is correct
- [ ] Test on iOS and Android devices
- [ ] Verify PIN lockout works (10 failures = 30 min lockout)
- [ ] Test Passkey creation, backup, recovery
- [ ] Confirm iCloud backup encryption
- [ ] Test address validation rejects mainnet
- [ ] Monitor Sentry for errors in production
- [ ] Check transaction success rate > 99%
- [ ] Verify balance updates sync correctly

## Performance Targets

- Cold start: < 2 seconds
- Balance fetch: < 3 seconds
- Transaction build: < 200ms
- Transaction sign: < 100ms
- Memory: < 100MB baseline

## Common Issues & Solutions

### Issue: Mainnet Address Entered
**Solution:** Address validation in `utils/bitcoin.js` explicitly prevents mainnet addresses (`bc1`, `1`, `3` prefixes)

### Issue: Transaction Fee Too High
**Solution:** Fee rate capped at 1,000 sats/vB in `constants/bitcoin.js`

### Issue: Dust UTXO Error
**Solution:** UTXO selection filters dust < 546 sats

### Issue: PIN Lockout
**Solution:** 10 failed attempts trigger 30-minute lockout (configurable in `constants/security.js`)

### Issue: Passkey Recovery Failed
**Solution:** Uses iCloud backup with encrypted mnemonic + PIN-derived key (check iCloud availability in `services/icloudStorage.js`)

## Testing

Run tests with:
```bash
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Key test areas:
- Bitcoin address validation
- UTXO selection algorithm
- PIN rate limiting
- Transaction signing (especially Taproot)
- Balance updates

## Useful Resources

- Bitcoin testnet: https://testnet.bitcoinexplorer.org
- Mutinynet API: https://mutinynet.com/api
- bitcoinjs-lib docs: https://github.com/bitcoinjs/bitcoinjs-lib
- BIP39/84/86 specs: https://github.com/bitcoin/bips
- Runes protocol: https://docs.ordinals.com/runes

## Contact & Support

For security issues: Check `ARCHITECTURE_STANDARDS.md` and security constants  
For Bitcoin questions: See `utils/bitcoin.js` and `constants/bitcoin.js`  
For state management: See context files and custom hooks

---

**Last Updated:** 2025-11-17  
**Maintainer:** Lucas Rodriguez  
**Status:** Production Testnet
