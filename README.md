# DUCAT Wallet

DUCAT Wallet is a non-custodial mobile wallet for Bitcoin Mutinynet, UNIT Runes,
Cashu e-cash, and BTC-backed UNIT vault workflows.

[![CI](https://github.com/DUCAT-UNIT/app/actions/workflows/ci.yml/badge.svg)](https://github.com/DUCAT-UNIT/app/actions/workflows/ci.yml)
[![Expo SDK 54](https://img.shields.io/badge/Expo_SDK-54-4630EB?logo=expo&logoColor=white)](https://expo.dev)
[![React Native 0.81](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> DUCAT Wallet is hard-locked to Mutinynet. It is not a mainnet wallet, and it
> must not be used with mainnet funds.

## What It Supports

| Asset or flow | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| BTC           | SegWit receive/send support on Mutinynet                                |
| UNIT          | Bitcoin Runes token support with Taproot addresses                      |
| Turbo UNIT    | Cashu e-cash UNIT for instant off-chain transfers                       |
| Vaults        | Deposit BTC, borrow UNIT, repay, withdraw, and monitor health           |
| Liquidations  | Claim undercollateralized vaults with optional BTC-to-UNIT swap routing |
| Passkeys      | WebAuthn-based encrypted seed backup through iCloud Keychain            |
| Notifications | Transaction, vault health, and liquidation opportunity alerts           |

UNIT appears in two forms:

| Form          | Where it lives       | Transfer profile                               |
| ------------- | -------------------- | ---------------------------------------------- |
| On-chain UNIT | Bitcoin Runes output | Bitcoin confirmation time and network fees     |
| Turbo UNIT    | Cashu proofs         | Instant off-chain transfer with no network fee |

The app can convert between the two forms through the Ducat Cashu mint.

## Technical Stack

| Layer         | Technology                                                             |
| ------------- | ---------------------------------------------------------------------- |
| App framework | Expo SDK 54, React Native 0.81, React 19                               |
| Language      | TypeScript strict mode                                                 |
| Navigation    | React Navigation 7 stacks and bottom tabs                              |
| Bitcoin       | `bitcoinjs-lib` v7, BIP32/39/84/86, `@bitcoinerlab/secp256k1`          |
| Runes         | Ducat runestone tooling and Mutinynet ord data                         |
| E-cash        | `@cashu/cashu-ts` v4, Cashu `onchain/unit`, NUT-11 P2PK                |
| State         | React Context for session state, Zustand for persistent workflow state |
| Security      | SecureStore, biometric auth, PBKDF2 PIN hashing, passkey backup        |
| Quality       | Jest, Maestro, ESLint, TypeScript, Knip, custom protocol doctors       |

## Architecture

The app keeps UI composition, state orchestration, and protocol logic separated:

```text
components/     Reusable UI components
screens/        Navigation targets and full-screen flows
hooks/          Presentation logic and state composition
contexts/       Session-scoped providers
stores/         Persistent Zustand workflow state
services/       Business logic, API clients, wallet, crypto, protocol operations
utils/          Pure utilities and formatters
constants/      Network, security, analytics, and app constants
navigation/     Root, stack, and tab navigators
```

Important boundaries are documented in [docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md).
State ownership is documented in [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md).

### State Model

React Context owns session-scoped state such as authentication, wallet data, Cashu
operations, transaction build/execution, responsive layout, and seed phrase handling.

Zustand stores own long-lived workflow state such as send intent, vault operations,
display preferences, pending transactions, Turbo processing, liquidation flows, and
operation recovery.

Data-fetching contexts use an anti-flicker polling pattern: values are memoized,
loading state is only shown on the first fetch, and background refreshes skip state
updates when data has not changed.

### Security Model

- The wallet is non-custodial and derives keys from a BIP39 seed phrase.
- Seed material is stored in iOS Keychain through Expo SecureStore.
- Passkey backup encrypts the mnemonic before iCloud storage.
- PINs are PBKDF2-hashed and protected by lockout.
- Transaction signing is guarded by typed PSBT validation and signing context checks.
- Analytics hash addresses, truncate transaction IDs, and suppress sensitive payloads.

Security reporting instructions are in [SECURITY.md](SECURITY.md).

## Quick Start

### Prerequisites

- Node.js 22.x and npm 10+
- Xcode 15+ for iOS development
- EAS CLI for release builds
- Maestro CLI for local end-to-end flows

### Install

```bash
git clone https://github.com/DUCAT-UNIT/app.git
cd app/app
npm ci
npm run doctor
```

### Run Locally

```bash
npm run start
npm run ios
```

### Quality Gates

```bash
npm run typecheck
npm run lint -- --quiet
npm test
npm run verify
```

`npm run verify` is the release-quality gate. It runs the local doctor,
TypeScript, ESLint, cleanup guardrails, dead-code detection, Maestro flow
validation, user-facing regression manifest validation, and Jest coverage.

## Environment

The app ships with public Mutinynet defaults and can run without a local `.env`.
Use [.env.example](.env.example) only when overriding endpoints or setting optional
analytics and live test fixtures.

Core public endpoints:

| Service            | Default                                           |
| ------------------ | ------------------------------------------------- |
| Esplora            | `https://mutinynet.com/api`                       |
| Ord API            | `https://ord-mutinynet.ducatprotocol.com`         |
| Guardian WebSocket | `wss://guardian-mutinynet-1.ducatprotocol.com`    |
| Vault API          | `https://validator.ducatprotocol.com/api`         |
| Cashu mint         | `https://dev-cashu-mint.ducatprotocol.com`        |
| Quote service      | `https://quote.ducatprotocol.com`                 |
| Price service      | `https://price.ducatprotocol.com`                 |

The mobile runtime rejects non-Mutinynet `EXPO_PUBLIC_APP_NETWORK` values in
`app.config.ts` and `utils/networkConfig.ts`.

## Testing

```bash
npm test
npm run test:coverage
npm run e2e:validate
npm run e2e
```

Maestro flows live under `e2e/maestro/flows/`. Live funded regression flows are
separate from deterministic product flows because they can spend Mutinynet and
Sepolia test funds.

## Release

```bash
npm run release:doctor -- --quick
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Release readiness is documented in [docs/RELEASE_DOCTOR.md](docs/RELEASE_DOCTOR.md).

## Infrastructure

Production services run on Google Cloud Platform under the Ducat Protocol
infrastructure. Public service domains are used by the app; private operational
access is intentionally not documented in this repository.

## Documentation

- [docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md) - workspace ownership and import rules
- [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) - context and store responsibilities
- [docs/RECOVERY_MATRIX.md](docs/RECOVERY_MATRIX.md) - recovery behavior by workflow
- [docs/RELEASE_DOCTOR.md](docs/RELEASE_DOCTOR.md) - release gate details
- [scripts/README.md](scripts/README.md) - maintenance and validation scripts
- [CONTRIBUTING.md](CONTRIBUTING.md) - contribution workflow

## License

MIT. See [LICENSE](LICENSE).
