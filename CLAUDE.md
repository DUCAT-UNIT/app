# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ducat Wallet — a non-custodial Bitcoin/Runes mobile wallet built with React Native (Expo SDK 54). Supports BTC (SegWit + Taproot), UNIT (Runes token), Cashu e-cash (Turbo UNIT), vault operations (deposit/borrow/repay/withdraw), liquidation (claim + auto-swap), push notifications, and WebAuthn passkey backup.

**Network:** Mutinynet testnet (not mainnet).

## Common Commands

```bash
# Development
npx expo start                # Start dev server
npx expo run:ios              # Run on iOS simulator

# Testing
jest                          # Run all unit tests
jest --watch                  # Watch mode
jest --coverage               # With coverage report
jest path/to/file.test.tsx    # Run single test file
jest --testPathPattern="useWalletImport"      # Run by pattern

# E2E (Maestro - requires iOS simulator with app installed)
maestro test e2e/maestro/flows/auth/       # Auth suite
maestro test e2e/maestro/flows/wallet/     # Wallet suite
maestro test e2e/maestro/flows/send/       # Send suite
maestro test e2e/maestro/flows/settings/   # Settings suite
maestro test e2e/maestro/flows/vault/      # Vault suite
maestro test e2e/maestro/flows/ecash/      # Ecash suite
maestro studio                              # Interactive E2E authoring

# Code quality
tsc --noEmit                  # Typecheck
eslint . --ext .js,.jsx,.ts,.tsx            # Lint
eslint . --ext .js,.jsx,.ts,.tsx --fix      # Lint with autofix

# Production
eas build --platform ios --profile production --auto-submit  # Build + TestFlight
```

## Architecture

### Layer Separation

```
screens/        → Full-screen views (navigation targets)
components/     → Reusable UI components
hooks/          → Presentation logic, state composition
services/       → Business logic, API calls, crypto operations
stores/         → Zustand global state (persistent)
contexts/       → React Context providers (session state)
navigation/     → React Navigation 7 stack/tab navigators
utils/          → Pure utility functions
constants/      → Analytics events, bitcoin config, security
```

### State Management

**React Context** (12 providers) for session-scoped state: `AuthContext`, `WalletContext`, `WalletDataContext` (coordinator wrapping `BalanceContext`, `VaultContext`, `TransactionHistoryContext`, `EcashTokensContext`), `CashuContext`, `TransactionBuildContext`, `TransactionExecutionContext`, `ResponsiveContext`, `NavigationHandlersContext`, `SeedPhraseContext`, `AirdropContext`.

**Zustand** stores for persistent/global state: price data, send flow, vault creation, borrow/deposit/repay/withdraw operations, notifications, display preferences, pending transactions, turbo processing, liquidation flow, and ecash threshold sheet.

Provider hierarchy is in `App.tsx` — ErrorBoundary → AuthProvider → ResponsiveProvider → WalletProvider → (PendingTransactions, Cashu, WalletData) → AppNavigator.

**Anti-flicker pattern:** All data-fetching contexts (`useTransactionHistoryFetch`, `useBalanceData`, `useVaultDataFetch`, `EcashTokensContext`) memoize return values with `useMemo` and only set loading state on first fetch via `hasLoadedOnceRef`. Background polls skip `setState` when data hasn't changed. This prevents cascading re-renders on the 10s poll cycle.

### Navigation

`RootNavigator.tsx` is the top-level navigator switching between auth and main flows. Feature flows (send, vault, borrow, deposit, repay, withdraw, liquidation) each have their own stack navigator. `MainTabs.tsx` provides bottom tab navigation.

### Key Service Domains

- **Wallet:** `walletService.ts` — HD wallet (BIP32/39/84/86), key derivation, address generation
- **Transactions:** `services/transaction/` — BTC and Runes PSBT building, UTXO selection, signing, broadcasting
- **Cashu:** `services/cashu/` — E-cash mint client, proof management, P2PK operations, token send/receive
- **Vault:** `services/vault/` + `services/vaultWallet/` — Vault state, deposit/borrow/repay/withdraw via Guardian WebSocket
- **Liquidation:** `services/liquidation/` — Vault liquidation execution, calculations, BTC→UNIT swap service
- **Security:** PIN (PBKDF2 hashing, lockout), biometrics, SecureStore, passkey backup
- **Turbo:** `services/turbo/` — TurboUNIT P2PK token processing and linking
- **Analytics:** `services/analyticsService.ts` — PostHog wrapper (55+ events, privacy guards)
- **Push:** `services/pushNotificationService.ts` — Expo push token registration, local notifications

### Amount Units Convention

UNIT amounts flow through the codebase in different units depending on layer:

| Layer | Unit | Example | Notes |
|-------|------|---------|-------|
| Runes on-chain (edicts) | cents (smallest units) | `50000n` = 500 UNIT | BigInt from `parseRuneTransfer` |
| Cashu proofs | cents | `500` = 5 UNIT | Proof amounts from mint |
| `getRunesAmount()` | display units | `500.00` = 500 UNIT | From ord indexer (divisibility=2) |
| `cashuBalance` (state) | cents | `50000` = 500 UNIT | From cashu proof sum |
| `formatUnitAmount(cents)` | display string | `"500.00"` | Divides by 100 |
| `ecashThreshold` (settings) | cents | `50000` = 500 UNIT | Stored in AsyncStorage |
| `requestMint(amount)` | cents | `50000` | Mint API expects integer cents |
| Send flow `sendAmount` | display units (string) | `"500"` | What user types |

## Coding Conventions

- **Formatting:** Prettier — single quotes, trailing commas (es5), 100 char print width, 2-space indent
- **Linting:** ESLint with `@react-native` config. `no-console` is an error (use `logger` from `utils/logger`). Bitwise operators allowed (crypto ops). Prefix unused args with `_`
- **TypeScript:** Strict mode. Explicit return types on exported functions. `interface` for extendable objects, `type` for unions/intersections
- **Async:** Prefer async/await over `.then()` chains. Use `void someAsync()` for fire-and-forget
- **Logging:** Use `logger.error/warn/info/debug` with `[ServiceName]` prefix
- **Components:** Props interfaces named `ComponentNameProps`. Use `React.memo` for list items and expensive renders
- **Hooks:** Internal structure: state → callbacks → effects → return
- **Tests:** Co-located in `__tests__/` directories. Coverage target: 70% statements/functions/lines, 60% branches
- **E2E:** Maestro YAML flows in `e2e/maestro/flows/`. Use `testID` props for element targeting
- **Analytics:** Import `analytics` from `services/analyticsService`, event constants from `constants/analyticsEvents`. Track at screen boundaries, not in services.

## Testing Notes

- Jest runs in Node environment (not jsdom)
- `jest.setup.js` mocks Expo and React Native modules extensively
- Native modules (biometrics, SecureStore, passkey) are excluded from coverage — tested via E2E
- `resetMocks: false` in Jest config — mocks persist across tests in a file
- E2E tests assume app is installed on iOS simulator (`com.ducatprotocol.DucatProtocolWallet`)
- 59 E2E tests across 6 suites (auth, settings, wallet, send, ecash, vault)

## Bitcoin/Crypto Notes

- BIP32 initialized with `@bitcoinerlab/secp256k1` ECC library in `App.tsx`
- `bitcoinjs-lib` v7 requires explicit ECC initialization before use
- Crypto polyfill imported at top of `App.tsx` — must remain first import
- Buffer polyfill set as global in `App.tsx`
- UNIT rune has divisibility=2 (1 UNIT = 100 raw Runes cents)
- MAX BTC send: fee is deducted from send amount when draining entire balance (no change output)
- Vault PSBT signing requires `setPendingVaultSigningOperation()` security context
- Swap PSBTs signed separately with `signPsbtRaw` and a bounded external-spend policy

## Infrastructure

Push server on EC2 at `notifications.ducatprotocol.com` (Express.js, port 3020, PM2 managed):
- Token registration, TX watching, vault health + liquidation watchers
- SSH: `ssh -i ~/.ssh/ducat.pem admin@ec2-34-203-197-0.compute-1.amazonaws.com`
- Code: `/home/admin/push-server/`
- Restart: `source ~/.nvm/nvm.sh && pm2 restart push-server`
