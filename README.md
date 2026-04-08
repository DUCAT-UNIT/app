# DUCAT Wallet

> The Bitcoin wallet where on-chain meets off-chain. Hold BTC and UNIT in one place. Send UNIT instantly for free.

[![iOS](https://img.shields.io/badge/iOS-14.0+-000000?style=flat&logo=apple)](https://apps.apple.com) [![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=flat&logo=react)](https://reactnative.dev) [![Expo](https://img.shields.io/badge/Expo_SDK-54-4630EB?style=flat&logo=expo)](https://expo.dev) [![TestFlight](https://img.shields.io/badge/TestFlight-Available-blue)](https://testflight.apple.com)

## What is UNIT?

**UNIT** is a Bitcoin Runes token (`DUCAT*UNIT*RUNE`) that exists in two forms:

| Form | Where it lives | Speed | Fees |
|------|----------------|-------|------|
| **On-chain UNIT** | Bitcoin blockchain (Taproot address) | ~10 min confirmation | Network fees |
| **Turbo UNIT (tUNIT)** | Cashu mint (off-chain e-cash) | Instant | Free |

Both forms represent the same asset. Convert between them freely inside the wallet.

## Core Features

### Turbo -- Convert On-chain UNIT to E-cash

Send on-chain UNIT to the Cashu mint, receive instant e-cash proofs. Configurable threshold (100/500/1000 UNIT) auto-routes small payments through Turbo for instant delivery.

### Fuse -- Convert E-cash back to On-chain

Send e-cash proofs back to the mint, receive on-chain UNIT to your Taproot address with Bitcoin's full security guarantees.

### TurboUNIT Transfers -- P2PK to any Taproot address

Send e-cash UNIT to any Taproot Bitcoin address using Cashu's NUT-11 P2PK (Pay-to-Public-Key). The recipient's Taproot public key locks the token cryptographically -- only they can claim it.

### Vault -- Borrow UNIT against BTC collateral

Lock BTC, mint UNIT. Deposit/borrow/repay/withdraw with real-time health monitoring. Unified vault operation architecture across all four actions.

### Liquidation -- Claim undercollateralized vaults

Browse available liquidation vaults, invest BTC to claim collateral at a discount. Optional BTC-to-UNIT auto-swap via the faucet API for one-click liquidation.

### Push Notifications

Real-time alerts for transaction confirmations, vault health warnings (<200%, <170%), and liquidation opportunities. Backend on EC2 with Expo Push API delivery.

### Remote Config

Server-controlled app settings at `config.ducatprotocol.com`. Supports announcements (banner text, hero image, CTA), network switching, and feature flags.

### Analytics

PostHog event tracking (55+ events) with privacy guards -- addresses SHA-256 hashed, txids truncated, E2E bypass in test mode. Covers onboarding, auth, send flow, vault operations, liquidation, cashu, settings, navigation, and errors.

## Architecture

```
app/
+-- components/          # Reusable UI (organized by feature)
|   +-- assetDetail/     # Asset info, charts, activity list
|   +-- charts/          # Price charts (SVG)
|   +-- common/          # BottomSheet, FeeSelector, etc.
|   +-- ecash/           # Token details, low balance modal
|   +-- liquidation/     # Liquidation screen + sub-components
|   +-- settings/        # Threshold sheet, conversion modal
|   +-- transaction/     # TX items (Regular, Ecash, Vault)
|   +-- vault*/          # Vault action UI, health gauges
|   +-- wallet/          # Balance breakdown, wallet header
+-- constants/           # Analytics events, bitcoin config, security
+-- contexts/            # React Context providers (12 providers)
|   +-- AuthContext       # PIN/biometric auth state
|   +-- WalletContext     # HD wallet, addresses, keys
|   +-- WalletDataContext # Coordinator: Balance + Vault + History + Ecash
|   +-- BalanceContext    # BTC/Runes/unconfirmed balances
|   +-- VaultContext      # Vault data + health alerts
|   +-- TransactionHistoryContext
|   +-- EcashTokensContext
|   +-- CashuContext      # Cashu mint/melt/send/receive
+-- hooks/               # Presentation logic, state composition
|   +-- liquidation/     # useLiquidationVaults, useLiquidationExecution
|   +-- vault/           # useVaultOperation, useBorrow/Deposit/Repay/Withdraw
|   +-- transaction/     # useOutputExtraction
+-- navigation/          # React Navigation 7 stacks + tabs
+-- pages/               # Full-screen page components
+-- screens/             # Feature screens
|   +-- auth/            # LockScreen, PinSetupScreen
|   +-- send/            # SendInput, Review, Processing, Confirmation
|   +-- settings/        # Security, Advanced, Preferences
|   +-- vault/           # Unified VaultInput/Confirm/Processing
|   +-- vaultCreation/   # Vault open flow
|   +-- wallet/          # WalletScreen, AssetDetail, ReceiveQR
+-- services/            # Business logic layer
|   +-- cashu/           # Cashu protocol (mint client, proofs, P2PK, crypto)
|   +-- liquidation/     # Execution, calculations, swap service
|   +-- passkey/         # WebAuthn creation, restore, encryption
|   +-- signing/         # PSBT service, crypto utils
|   +-- transaction/     # BTC + Runes PSBT building, UTXO selection
|   +-- turbo/           # Turbo token storage, linking config
|   +-- vault/           # Vault open/deposit/borrow/repay/withdraw
|   +-- vaultWallet/     # Guardian WebSocket, PSBT binary utils
|   +-- analyticsService # PostHog wrapper with privacy guards
|   +-- pushNotificationService # Expo push token + local notifications
|   +-- remoteConfigService     # Server config fetch + cache
+-- stores/              # Zustand persistent state (15 stores)
+-- styles/              # Centralized StyleSheet + responsive scaling
+-- utils/               # Pure utilities (formatters, bitcoin, crypto)
```

### State Management

**React Context** (12 providers) for session-scoped state. Provider hierarchy in `App.tsx`: ErrorBoundary -> Auth -> UI -> Responsive -> Wallet -> (PendingTransactions, Cashu, WalletData) -> AppNavigator.

**Zustand** (15 stores) for persistent/global state: price, send flow, vault creation, borrow/deposit/repay/withdraw, display preferences, pending transactions, liquidation flow, ecash threshold, remote config.

**Polling**: Unified 10s poll cycle in `WalletDataCoordinator`. All data contexts memoize return values and skip state updates when data hasn't changed to prevent re-render cascades.

### Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.76 (New Architecture), Expo SDK 54 |
| Navigation | React Navigation 7 (stacks + bottom tabs) |
| Bitcoin | `bitcoinjs-lib` v7, `@bitcoinerlab/secp256k1`, BIP32/39/84/86 |
| Runes | Custom LEB128 encoder, runestone serialization |
| E-cash | Cashu NUT-01 through NUT-11, custom P2PK implementation |
| Security | `expo-secure-store`, `expo-local-authentication`, `react-native-passkey` |
| Crypto | `react-native-quick-crypto` (PBKDF2, HKDF, AES-256-GCM) |
| Analytics | PostHog (`posthog-react-native`), 55+ events, EU cloud |
| Push | `expo-notifications`, Expo Push API, EC2 backend |
| State | React Context (12) + Zustand (15 stores) |
| Testing | Jest (94+ suites), Maestro E2E (59 flows) |

## Security

- **Non-custodial**: 12-word BIP39 seed phrase, stored in iOS Keychain
- **Passkey backup**: Encrypted cloud backup via WebAuthn/iCloud (AES-256-GCM)
- **Biometric auth**: Face ID / Touch ID for transactions
- **PIN protection**: PBKDF2-hashed 6-digit PIN (10k iterations)
- **Auto-lock**: Configurable inactivity timeout
- **Rate limiting**: 10 failed attempts = 30min lockout
- **PSBT validation**: Vault signing context prevents unauthorized PSBT templates

### Key Derivation

```
Master Seed (BIP39 12-word)
  +-- SegWit:  m/84'/1'/0'/0/{index}  (BTC send/receive)
  +-- Taproot: m/86'/1'/0'/0/{index}  (Runes / UNIT)
```

### Passkey Encryption

```
Mnemonic -> HKDF(passkey_id + PIN) -> AES-256-GCM -> iCloud Keychain
```

## Infrastructure

### Backend Services (EC2)

| Service | Domain | Purpose |
|---------|--------|---------|
| Cashu Mint | `cashu-mint.ducatprotocol.com` | E-cash mint/melt operations |
| Push Server | `notifications.ducatprotocol.com` | Push token registry + event watchers |
| Remote Config | `config.ducatprotocol.com` | App configuration + announcements |
| Faucet | `faucet.ducatprotocol.com` | Testnet BTC/UNIT faucet + swap API |
| URL Shortener | `go.ducatprotocol.com` | Cashu token deep links |
| Validator | `validator.ducatprotocol.com` | Vault state + liquidation API |
| Oracle | `price.ducatprotocol.com` | BTC price feed |
| Ord Indexer | `ord-mutinynet.ducatprotocol.com` | Runes balance + UTXO data |
| Explorer | `mutinynet.com` | Block explorer (Esplora API) |

### Push Server

Express.js on port 3020 (PM2 managed, nginx proxied via Cloudflare).

**Endpoints:**
- `POST /api/register` -- register Expo push token
- `DELETE /api/unregister` -- remove token
- `POST /api/broadcast` -- send notification to all devices
- `POST /api/watch-tx` -- watch a TX for confirmation
- `GET /api/health` -- server status + token count
- `GET /api/tokens` -- list registered tokens

**Background Watchers (cron):**
- TX Watcher (30s) -- polls Esplora for watched TX confirmations
- Vault Health Watcher (60s) -- alerts when health <200% or <170%
- Liquidation Watcher (120s) -- alerts when vaults available for liquidation

Throttling: max 1 alert per category per hour per device.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Xcode 15+ (iOS)
- EAS CLI (`npm install -g eas-cli`)

### Installation

```bash
git clone https://github.com/DUCAT-UNIT/app.git
cd app/app
npm install
npx expo start
```

### Development

```bash
npx expo start                    # Dev server
npx expo run:ios                  # iOS simulator
jest                              # Unit tests
jest --coverage                   # With coverage
maestro test e2e/maestro/flows/   # E2E tests (requires simulator)
tsc --noEmit                      # Type check
```

### Production Build

```bash
eas build --platform ios --profile production        # Build
eas submit --platform ios --latest                   # Submit to TestFlight
eas build --platform ios --profile production --auto-submit  # Build + submit
```

### Environment

The app operates on **Mutinynet** (Bitcoin signet testnet). Network configuration is in `utils/networkConfig.ts`.

```
ESPLORA_URL:  https://mutinynet.com/api
ORD_API:      https://ord-mutinynet.ducatprotocol.com
VALIDATOR:    https://validator.ducatprotocol.com
CASHU_MINT:   https://cashu-mint.ducatprotocol.com
```

## Testing

**Unit Tests**: 94+ Jest suites covering services, hooks, contexts, and utilities. Co-located in `__tests__/` directories. Coverage target: 70% statements/functions/lines, 60% branches.

**E2E Tests**: 59 Maestro YAML flows across 6 suites:
- Auth (6): PIN setup, biometric, lock/unlock
- Settings (16): preferences, security, advanced, wallet deletion
- Wallet (14): balances, asset detail, transaction history
- Send (9): BTC/UNIT send, turbo, address input, review
- Ecash (5): cashu mint, send/receive, token details
- Vault (9): create, deposit, borrow, repay, withdraw

```bash
maestro test e2e/maestro/flows/auth/       # Auth suite
maestro test e2e/maestro/flows/settings/   # Settings suite
maestro test e2e/maestro/flows/wallet/     # Wallet suite
bash e2e/maestro/run-all-sequential.sh     # All suites
```

## Troubleshooting

**Metro bundler crashes**: `rm -rf node_modules && npm install && npx expo start --clear`

**Crypto errors**: Ensure `crypto-polyfill.js` is imported first in `App.tsx`

**Passkey not working**: Verify `associatedDomains` in `app.json` includes `webcredentials:ducatprotocol.com`

**Push notifications not registering**: Force-close and reopen app after enabling notifications. Check `curl https://notifications.ducatprotocol.com/api/health` for token count.

**MAX BTC send fails**: Fixed in build 45+ -- fee is now deducted from send amount when draining entire balance.

## Resources

- [Runes Protocol](https://docs.ordinals.com/runes.html)
- [Cashu Protocol (NUTs)](https://github.com/cashubtc/nuts) -- [NUT-11 P2PK](https://github.com/cashubtc/nuts/blob/main/11.md)
- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) / [BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) / [BIP86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn/)
- [Expo Docs](https://docs.expo.dev)

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Warning: Testnet Only** -- This wallet operates on Mutinynet (Bitcoin signet). Do not use with real Bitcoin on mainnet.
