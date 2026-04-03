# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ducat Wallet — a non-custodial Bitcoin/Runes mobile wallet built with React Native (Expo SDK 54). Supports BTC (SegWit + Taproot), UNIT (Runes token), Cashu e-cash, vault operations (deposit/borrow/repay/withdraw), and WebAuthn passkey backup.

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
maestro studio                              # Interactive E2E authoring

# Code quality
tsc --noEmit                  # Typecheck
eslint . --ext .js,.jsx,.ts,.tsx            # Lint
eslint . --ext .js,.jsx,.ts,.tsx --fix      # Lint with autofix
prettier --check "**/*.{js,jsx,ts,tsx,json,md}"  # Format check
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
```

### State Management

**React Context** (12 providers) for session-scoped state: `AuthContext`, `WalletContext`, `WalletDataContext`, `CashuContext`, `UIContext`, `TransactionBuildContext`, `TransactionExecutionContext`, `PendingTransactionsContext`, `ResponsiveContext`, `NavigationHandlersContext`, `SeedPhraseContext`, `AirdropContext`.

**Zustand** (15 stores) for persistent/global state: price data, send flow, vault creation, borrow/deposit/repay/withdraw operations, notifications, display preferences, pending transactions, turbo processing.

Provider hierarchy is in `App.tsx` — ErrorBoundary → AuthProvider → UIProvider → ResponsiveProvider → WalletProvider → (PendingTransactions, Cashu, WalletData) → AppNavigator.

### Navigation

`RootNavigator.tsx` is the top-level navigator switching between auth and main flows. Feature flows (send, vault, borrow, deposit, repay, withdraw) each have their own stack navigator. `MainTabs.tsx` provides bottom tab navigation.

### Key Service Domains

- **Wallet:** `walletService.ts` — HD wallet (BIP32/39/84/86), key derivation, address generation
- **Transactions:** `services/transaction/` — BTC and Runes PSBT building, UTXO selection, signing, broadcasting
- **Cashu:** `services/cashu/` — E-cash mint client, proof management, P2PK operations, token send/receive
- **Vault:** `services/vault/` + `services/vaultWallet/` — Vault state, deposit/borrow/repay/withdraw operations
- **Security:** PIN (PBKDF2 hashing, lockout), biometrics, SecureStore, passkey backup
- **Turbo:** `services/turbo/` — TurboUNIT P2PK token processing and linking

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

## Testing Notes

- Jest runs in Node environment (not jsdom)
- `jest.setup.js` mocks Expo and React Native modules extensively
- Native modules (biometrics, SecureStore, passkey) are excluded from coverage — tested via E2E
- `resetMocks: false` in Jest config — mocks persist across tests in a file
- E2E tests assume app is installed on iOS simulator (`com.ducatprotocol.DucatProtocolWallet`)

## Bitcoin/Crypto Notes

- BIP32 initialized with `@bitcoinerlab/secp256k1` ECC library in `App.tsx`
- `bitcoinjs-lib` v7 requires explicit ECC initialization before use
- Crypto polyfill imported at top of `App.tsx` — must remain first import
- Buffer polyfill set as global in `App.tsx`
