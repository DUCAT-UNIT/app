# DUCAT Wallet

DUCAT Wallet is a non-custodial Expo/React Native wallet for Bitcoin Mutinynet,
UNIT Runes, Cashu e-cash, and BTC-backed Ducat vault workflows.

[![CI](https://github.com/DUCAT-UNIT/app/actions/workflows/ci.yml/badge.svg)](https://github.com/DUCAT-UNIT/app/actions/workflows/ci.yml)
[![Expo SDK 54](https://img.shields.io/badge/Expo_SDK-54-4630EB?logo=expo&logoColor=white)](https://expo.dev)
[![React Native 0.81](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> DUCAT Wallet is hard-locked to Mutinynet. It is not a mainnet wallet and must
> not be used with mainnet funds.

## Product Surface

| Area            | What the app supports                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| BTC             | SegWit receive/send, Taproot-aware flows, fee selection, pending send recovery   |
| Turbo BTC       | Cashu `sat` proofs for app-to-app P2PK sends and receives inside the BTC asset   |
| UNIT            | Bitcoin Runes balance, send, receive, transaction history, and vault repayment   |
| Turbo UNIT      | Cashu `unit` proofs for instant UNIT transfers and mint/melt conversion          |
| Vaults          | Open, borrow, repay, deposit, withdraw, liquidation state, and recovery journals |
| USDC settlement | Hidden developer-gated Sepolia USDC flows for vault payout/repayment testing     |
| Passkeys        | WebAuthn encrypted seed backup and restore through iCloud Keychain               |
| Notifications   | Transaction, vault health, and liquidation opportunity alerts                    |

BTC and UNIT each have an on-chain form and a Turbo Cashu form:

| Asset | On-chain form         | Turbo form                                                       |
| ----- | --------------------- | ---------------------------------------------------------------- |
| BTC   | Mutinynet BTC UTXOs   | Cashu `sat` proofs stored in an account-scoped BTC proof store   |
| UNIT  | Bitcoin Runes outputs | Cashu `unit` proofs stored in an account-scoped UNIT proof store |

Turbo BTC is Cashu `sat` only in this release. Lightning Cashu support is out of
scope.

## Technical Stack

| Layer         | Technology                                                                   |
| ------------- | ---------------------------------------------------------------------------- |
| App framework | Expo SDK 54, React Native 0.81, React 19                                     |
| Language      | TypeScript strict mode                                                       |
| Navigation    | React Navigation 7 stacks and bottom tabs                                    |
| Bitcoin       | `bitcoinjs-lib` v7, BIP32/39/84/86, `@bitcoinerlab/secp256k1`                |
| UNIT / Runes  | Ducat SDK, Ducat runestone tooling, Mutinynet ord data                       |
| E-cash        | `@cashu/cashu-ts` v4, Cashu `onchain/unit`, Cashu `onchain/sat`, NUT-11 P2PK |
| EVM testing   | Sepolia USDC, wUNIT, bridge router, and pool wiring                          |
| State         | React Context for session state, Zustand for durable workflow state          |
| Security      | SecureStore, biometric auth, PBKDF2 PIN hashing, passkey backup              |
| Quality       | Jest, Maestro, ESLint, TypeScript, Knip, custom release doctors              |

## Architecture

The repo keeps UI composition, state orchestration, protocol logic, and tooling
separate:

```text
components/      Reusable UI components
screens/         Navigation targets and full-screen flows
hooks/           Presentation logic and state composition
contexts/        Session-scoped providers
stores/          Durable Zustand workflow and recovery state
services/        API clients, wallet logic, signing, Cashu, vault, liquidation
utils/           Pure utilities, formatting, safety checks, error taxonomy
constants/       Network, security, analytics, and app constants
navigation/      Root, stack, and tab navigators
e2e/             Maestro product and live regression flows
docs/            Architecture, recovery, release, and protocol documentation
scripts/         Local validation, release, regression, and maintenance scripts
vendor/          Local Ducat protocol packages consumed through file dependencies
bridge-service/  Server-side bridge reference code and fixtures
evm/             EVM-side bridge and settlement helpers
store/           App Store metadata and screenshots
```

Important boundaries:

- [docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md) defines ownership and import rules.
- [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) documents context/store responsibilities.
- [docs/RECOVERY_MATRIX.md](docs/RECOVERY_MATRIX.md) maps crash and relaunch recovery behavior.
- [services/ERROR_HANDLING.md](services/ERROR_HANDLING.md) documents error handling conventions.

## Security Model

- The wallet is non-custodial and derives keys from a BIP39 seed phrase.
- Seed material is stored in iOS Keychain through Expo SecureStore.
- Passkey backup encrypts the mnemonic before iCloud storage.
- PINs are PBKDF2-hashed and protected by lockout.
- Transaction signing is guarded by typed PSBT validation and signing-context checks.
- Cashu proof storage is split by account and unit so Turbo BTC and Turbo UNIT
  proofs cannot mix.
- Analytics hash addresses, truncate transaction IDs, and suppress sensitive payloads.

Report suspected vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## Quick Start

### Prerequisites

- Node.js 22.x and npm 10+
- Xcode 15+ for iOS development
- EAS CLI for store/TestFlight builds
- Maestro CLI for local end-to-end flows

### Install

```bash
git clone https://github.com/DUCAT-UNIT/app.git
cd app
npm ci
npm run doctor
```

### Run Locally

```bash
npm run start
npm run ios
```

The app is intended to run as a native app or development client. Expo Go is not
the production target.

## Environment

The app ships with public Mutinynet/Sepolia defaults and can run without a local
`.env`. Copy [.env.example](.env.example) only when overriding public endpoints
or supplying optional live-test fixture values.

Core public endpoints:

| Service            | Default                                               |
| ------------------ | ----------------------------------------------------- |
| Esplora            | `https://mutinynet.com/api`                           |
| Ord API            | `https://ord-mutinynet.ducatprotocol.com`             |
| Guardian WebSocket | `wss://guardian-mutinynet-1.ducatprotocol.com`        |
| Vault API          | `https://validator.ducatprotocol.com/api`             |
| Cashu mint         | `https://dev-cashu-mint.ducatprotocol.com`            |
| Quote service      | `https://quote.ducatprotocol.com`                     |
| Price service      | `https://price.ducatprotocol.com`                     |
| Unit bridge API    | `https://unit-bridge-sepolia-z6mcndbb6q-ue.a.run.app` |

The mobile runtime rejects non-Mutinynet `EXPO_PUBLIC_APP_NETWORK` values in
[app.config.ts](app.config.ts) and [utils/networkConfig.ts](utils/networkConfig.ts).

## Quality Gates

Use the smallest gate that matches the risk of your change:

```bash
npm run typecheck
npm run lint -- --quiet
npm test -- --runInBand
npm run verify:quick
```

For protocol, wallet, auth, Cashu, recovery, or release changes, run the broader
gate:

```bash
npm run verify
```

`npm run verify` runs the local doctor, TypeScript, ESLint, cleanup guardrails,
dead-code detection, Maestro flow validation, user-facing regression manifest
validation, and Jest coverage.

Focused release checks:

```bash
npm run release:doctor
npm run release:doctor -- --quick
```

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

Regression documentation:

- [REGRESSION.md](REGRESSION.md) describes live regression scope.
- [e2e/USER_FACING_REGRESSION.md](e2e/USER_FACING_REGRESSION.md) maps user-facing flows.
- [docs/RELEASE_DOCTOR.md](docs/RELEASE_DOCTOR.md) explains release gating.

## Release

Run the release gate first:

```bash
npm run release:doctor
```

Then build and submit with EAS:

```bash
eas build --platform ios --profile production --auto-submit
```

Production releases use the Mutinynet environment, remote iOS credentials, and
App Store Connect submit metadata from `eas.json`.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - contributor workflow and review expectations
- [CODING_STANDARDS.md](CODING_STANDARDS.md) - code style and app conventions
- [SECURITY.md](SECURITY.md) - vulnerability reporting and high-risk areas
- [docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md) - workspace ownership and import rules
- [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) - context and store responsibilities
- [docs/RECOVERY_MATRIX.md](docs/RECOVERY_MATRIX.md) - recovery behavior by workflow
- [docs/RELEASE_DOCTOR.md](docs/RELEASE_DOCTOR.md) - release gate details
- [scripts/README.md](scripts/README.md) - validation and maintenance scripts

## License

MIT. See [LICENSE](LICENSE).
