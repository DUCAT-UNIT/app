# DUCAT Client SDK

[![npm version](https://img.shields.io/npm/v/@ducat-unit/client-sdk.svg)](https://www.npmjs.com/package/@ducat-unit/client-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TypeScript SDK for integrating DUCAT vault flows into wallets, applications, and bots. The package handles validator reads, oracle data retrieval, guardian communication, PSBT planning, and vault request creation.

## What The SDK Covers

- Wallet integration through `ProtoWallet`, `ProtoWalletAccountAPI`, and `ProtoWalletConnectAPI`
- Vault planning through `VaultAPI`, `create_vault_action_estimate`, and `create_vault_action_quote`
- Guardian communication through `GuardianClient`
- Oracle relay access through `PriceOracleClient`
- Shared fetch helpers, interfaces, schemas, fee estimation, and observability utilities

This repository is intentionally SDK-first. It includes only the protocol context needed to use the package correctly.

## Installation

```bash
npm install @ducat-unit/core @ducat-unit/client-sdk
```

Both packages are published through GitHub Packages. Configure `.npmrc` with the appropriate token before installing.

## Integration Requirements

Most SDK consumers need:

- a validator base URL for protocol reads
- a wallet adapter that can provide pubkeys, addresses, UTXOs, and PSBT signatures

Vault creation, borrowing, and liquidation flows also need:

- one or more oracle pubkeys and Nostr relay URLs
- a guardian WebSocket endpoint

## Package Surfaces

| Surface | Use |
| --- | --- |
| `@ducat-unit/client-sdk` | Top-level classes and vault helpers |
| `@ducat-unit/client-sdk/vault` | Vault action APIs and request builders |
| `@ducat-unit/client-sdk/wallet` | Wallet types and helpers |
| `@ducat-unit/client-sdk/guard` | Guardian client |
| `@ducat-unit/client-sdk/oracle` | Oracle client |
| `@ducat-unit/client-sdk/fetch` | Validator and explorer fetch helpers |
| `@ducat-unit/client-sdk/lib` | Shared utilities |
| `@ducat-unit/client-sdk/schema` | Zod schemas |
| `@ducat-unit/client-sdk/const` | Constants and transaction metadata |

## API Reference

The full public surface — each subpath module with its primary functions and
signatures, plus the `WebSocketClient` / `GuardianClient` / `ProtoWallet`
classes — is documented in [docs/API.md](docs/API.md). Protocol constants and
transaction-size metadata live in [docs/CONSTANTS.md](docs/CONSTANTS.md); the
data shapes (configs, requests, profiles) are in
[docs/INTERFACES.md](docs/INTERFACES.md).

## Security Considerations

See [docs/SECURITY.md](docs/SECURITY.md) for the SDK's security model. The
load-bearing controls:

- **Boundary validation** — external responses and user configs are validated
  against Zod schemas before use.
- **URL path-segment allowlist** — dynamic URL segments are constrained to a
  strict allowlist, preventing path traversal / injection (`PATH_SAFE_SEGMENT`).
- **Bounded WebSocket deserialization** — socket payloads are sanitized and
  length-capped (`MAX_BOUNCED_DATA_LENGTH`).
- **Oracle freshness** — stale oracle-signed price data is rejected by a max-age
  window.
- **Secret-key isolation** — no raw keys on the SDK surface; `GuardianSigner`
  lives in `@ducat-unit/core` with module-private key isolation.
- **Log redaction** — the observability layer scrubs secrets and signatures
  before emitting.
- **Supply chain** — a small, pinned dependency set; no install scripts.

## Wallet Integration

The SDK does not ship a browser wallet. You provide one by implementing:

- `ProtoWalletAccountAPI` for the public keys and addresses the SDK should use
- `ProtoWalletConnectAPI` for UTXO fetch and PSBT signing operations

```ts
import { ProtoWallet } from '@ducat-unit/client-sdk'

const wallet = new ProtoWallet(accounts, connector, {
  chain_network : 'regtest',
  txfee_rate    : 1
})
```

See [docs/INTERFACES.md](docs/INTERFACES.md) for the full wallet-facing type surface and [docs/QUICKSTART.md](docs/QUICKSTART.md) for an end-to-end vault example.

## First Vault Flow

The normal open-vault path is:

1. Fetch the current protocol profile from a validator.
2. Fetch oracle quotes from relays.
3. Create an action estimate and final quote.
4. Fetch oracle contracts for the selected bucket.
5. Reserve an issuance account through a guardian.
6. Build vault PSBTs and sign them with the user wallet.
7. Submit the signed request to the guardian for validation and co-signing.

The detailed sequence, including code, lives in [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Observability

The SDK exposes logger and tracer helpers that can be shared across wallet, guardian, and vault flows:

```ts
import {
  create_console_logger,
  create_logger_tracer,
  GuardianClient,
  ProtoWallet
} from '@ducat-unit/client-sdk'

const logger = create_console_logger({ level: 'debug' })
const tracer = create_logger_tracer(logger)
const observability = { logger, tracer, default_fields: { app: 'vault-demo' } }

const wallet = new ProtoWallet(accounts, connector, { observability })
const guardian = new GuardianClient(GUARDIAN_URL, 'regtest', { observability })
```

See [docs/LOGGING.md](docs/LOGGING.md) for the output model, redaction behavior, and advanced helpers.

## Documentation Map

- [docs/INDEX.md](docs/INDEX.md): SDK documentation map
- [docs/API.md](docs/API.md): public API-surface reference
- [docs/CONSTANTS.md](docs/CONSTANTS.md): constants and transaction-size metadata
- [docs/SECURITY.md](docs/SECURITY.md): security considerations
- [docs/QUICKSTART.md](docs/QUICKSTART.md): first vault walk-through
- [docs/INTERFACES.md](docs/INTERFACES.md): SDK-facing types
- [docs/GUARDIAN.md](docs/GUARDIAN.md): guardian client, request lifecycle, and fetch helpers
- [docs/ORACLES.md](docs/ORACLES.md): oracle client, relays, and event retrieval
- [docs/FEES.md](docs/FEES.md): fee estimation model
- [docs/LOGGING.md](docs/LOGGING.md): logging and tracing
- [dev/README.md](dev/README.md): developer knowledge base and contributor workflow
- [CONTRIBUTING.md](CONTRIBUTING.md): human contributor workflow

## Development Commands

```bash
npm install
npm run check
npm run lint
npm run dev
npm run test:unit
npm run test:int
npm run test:core
npm run build
```

Use `npm run scratch` for one-off experiments and `npm run script <path/to/file.ts>` for executable dev and test scripts.

## Releases

Release workflow and packaging notes live in [dev/docs/RELEASE.md](dev/docs/RELEASE.md).
