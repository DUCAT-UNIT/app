# Contributing

Thanks for taking the time to improve DUCAT Wallet. This repo contains security-
sensitive wallet code, so changes should be small, reviewable, and covered by the
right checks.

## Development Setup

```bash
npm ci
npm run doctor
npm run start
```

Use Node.js 22.x and npm 10+. Project scripts route through the local Node 22
runner where needed, but matching the expected runtime avoids avoidable drift.

## Before Opening A Pull Request

Run the focused checks for your change, then run the quick gate:

```bash
npm run typecheck
npm run lint -- --quiet
npm test -- --runInBand
npm run verify:quick
```

For protocol, wallet, auth, or recovery changes, run the broader gate:

```bash
npm run verify
```

Maestro flows require an iOS simulator with the app installed:

```bash
npm run e2e:validate
npm run e2e
```

## Pull Request Standards

- Keep PRs scoped to one behavior or refactor.
- Include tests for user-facing behavior, protocol logic, wallet security, and
  regression-prone state transitions.
- Keep Mutinynet-only behavior intact. Do not add mainnet runtime switching.
- Do not commit secrets, private keys, mnemonics, local `.env` files, simulator
  data, or generated build artifacts.
- Use `logger` from `utils/logger` in app code instead of raw console calls.
- Keep mobile runtime imports out of `bridge-service/`, `evm/`, and `web/`.

## Security-Sensitive Areas

Extra review is expected for:

- Seed phrase storage and key derivation
- PIN, biometric, passkey, and lockout logic
- PSBT construction, validation, signing, and broadcast
- Cashu proof storage, P2PK locking, mint, melt, and swap flows
- Vault signing context and liquidation execution
- Analytics, notification, QR, short URL, and raw response logging

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
